import { describe, expect, it } from 'vitest';
import { aggroEncounters, aggroRadius, ambushAt } from './aggro';
import { deepClone } from './clone';
import { gameData } from './data';
import { createInitialState, type PlayerState } from './state';
import { guardNode, settleUnits } from './units';
import { advanceWilds } from './wilds';
import { canPlace, settleVillage } from './village';
import { createWorkers } from './workers';

const T0 = 1_000_000;
const adult = gameData.rules.growth.stages.at(-1)!.id;
const { aggro, ambush } = gameData.wilds.encounters;

/** A village with no wilds or enemies, two soldiers and one cat, all placed. */
function base(): PlayerState {
  const s = createInitialState(T0, 77);
  s.village.obstacles = [];
  s.village.encounters = [];
  s.monsters.push({ id: 'm1', form: 'kucing', element: 'api', stage: adult, food: 0 });
  s.soldiers.push({ id: 's1', kind: 'prajurit', rank: 0 }, { id: 's2', kind: 'pemanah', rank: 0 });
  return settleUnits(s, T0);
}

const bandits = (id: string, x: number, y: number) => ({
  id,
  level: 0,
  group: 0,
  x,
  y,
  count: 2,
  enemies: [],
});

describe('enemies chase whoever comes close', () => {
  it('stays put while nobody is in reach, then chases the nearest units', () => {
    const s = base();
    const m1 = s.units.m1!;
    // Just outside the bandits' reach: nothing happens.
    const far = deepClone(s);
    far.village.encounters = [bandits('e1', m1.x + Math.ceil(aggro.banditTiles) + 3, m1.y)];
    expect(aggroEncounters(far, T0)).toBe(far);
    // Within reach: a fight mission with the units in range, arriving by chase speed.
    const near = deepClone(s);
    near.village.encounters = [bandits('e1', m1.x + 2, m1.y)];
    const woke = aggroEncounters(near, T0);
    expect(woke.missions).toHaveLength(1);
    const m = woke.missions[0]!;
    expect(m.encounterId).toBe('e1');
    expect(m.monsterIds).toContain('m1');
    expect(m.arriveAt).toBe(T0 + Math.ceil(2 / aggro.chaseTilesPerSecond));
    // A busy enemy does not wake twice.
    expect(aggroEncounters(woke, T0 + 1)).toBe(woke);
  });

  it('uses a wider reach for wild monsters than for bandits', () => {
    const e = { ...bandits('e1', 0, 0), level: 1, group: 1, enemies: [] };
    expect(aggroRadius(e)).toBe(aggro.monsterTiles);
    expect(aggroRadius(bandits('e2', 0, 0))).toBe(aggro.banditTiles);
  });

  it('strikes workers gathering in reach when no unit is near, and sends the rest home', () => {
    const s = base();
    s.units = {};
    s.monsters = [];
    s.soldiers = [];
    createWorkers(s, 4);
    s.village.obstacles = [{ id: 'n1', type: 'pohon', x: 5, y: 5, work: 0 }];
    for (const w of s.workers) w.task = { kind: 'gathering', targetId: 'n1' };
    s.village.encounters = [bandits('e1', 6, 6)];
    const r = aggroEncounters(s, T0);
    expect(r.workers.length).toBeLessThanOrEqual(s.workers.length);
    expect(r.workers.every((w) => w.task.kind === 'idle')).toBe(true);
  });
});

describe('ambushes while gathering', () => {
  it('spawns an enemy at the node; without guards each worker may fall (Monte Carlo)', () => {
    let lost = 0;
    let crews = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const s = base();
      s.rngState = seed;
      createWorkers(s, 2);
      const ids = s.workers.slice(0, 2).map((w) => w.id);
      const r = ambushAt(s, { id: 'n1', x: 3, y: 3 }, ids, T0);
      expect(r.guarded).toBe(false);
      expect(s.village.encounters.some((e) => e.id === r.encounterId)).toBe(true);
      lost += r.workersLost;
      crews += ids.length;
    }
    expect(Math.abs(lost / crews - ambush.workerDeathChance)).toBeLessThan(0.03);
  });

  it('lets guards fight first; workers are safe when the guards win', () => {
    const s = base();
    const spot = { x: s.units.m1!.x + 1, y: s.units.m1!.y };
    s.village.obstacles = [{ id: 'n1', type: 'pohon', ...spot, work: 0 }];
    const posted = guardNode(s, { ids: ['m1', 's1', 's2'], obstacleId: 'n1' }, T0);
    if (!posted.ok) throw new Error(posted.error);
    const guarded = posted.state;
    createWorkers(guarded, 2);
    const ids = guarded.workers.slice(0, 2).map((w) => w.id);
    let wins = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = deepClone(guarded);
      g.rngState = seed;
      const r = ambushAt(g, { id: 'n1', ...spot }, ids, T0);
      expect(r.guarded).toBe(true);
      expect(g.missions.some((m) => m.encounterId === r.encounterId && m.fight)).toBe(true);
      if (r.guardsWon) {
        wins++;
        expect(r.workersLost).toBe(0);
      }
    }
    expect(wins).toBeGreaterThan(0);
  });

  it('calls out ambushes from finished nodes at about the node chance (Monte Carlo)', () => {
    const def = gameData.obstacleById.get('pohon')!;
    let ambushes = 0;
    const n = 20_000;
    let s = base();
    for (let i = 0; i < n; i++) {
      s.village.obstacles = [{ id: 'n1', type: 'pohon', x: 10, y: 10, work: 0 }];
      s.village.encounters = [];
      s.missions = [];
      if (s.workers.length === 0) createWorkers(s, 1);
      s.workers[0]!.task = { kind: 'gathering', targetId: 'n1' };
      const r = advanceWilds(s, def.work.workSeconds, T0);
      if (r.gathered[0]!.ambush) ambushes++;
      s = r.state;
    }
    expect(Math.abs(ambushes / n - def.ambushChance)).toBeLessThan(0.006);
  });

  it('sends ambush enemies away after leaveHours unless they are fighting', () => {
    const s = base();
    s.units = {};
    const r = ambushAt(s, { id: 'n1', x: 3, y: 3 }, [], T0);
    const e = s.village.encounters.find((x) => x.id === r.encounterId)!;
    expect(e.leavesAt).toBe(T0 + ambush.leaveHours * 3600);
    expect(aggroEncounters(s, e.leavesAt! - 1).village.encounters).toContainEqual(e);
    expect(aggroEncounters(s, e.leavesAt!).village.encounters.some((x) => x.id === e.id)).toBe(
      false,
    );
    // Busy fighting: it stays until the fight is over.
    const busy = deepClone(s);
    busy.missions.push({ id: 't1', encounterId: e.id, monsterIds: [], arriveAt: T0, fight: null });
    expect(aggroEncounters(busy, e.leavesAt!).village.encounters.some((x) => x.id === e.id)).toBe(
      true,
    );
  });

  it('settles a chase into a fight like any mission', () => {
    const s = base();
    const m1 = s.units.m1!;
    let at = { x: m1.x + 2, y: m1.y };
    if (!canPlace(s.village, 1, at.x, at.y)) at = { x: m1.x - 2, y: m1.y };
    s.village.encounters = [bandits('e1', at.x, at.y)];
    const woke = settleVillage(s, T0);
    const m = woke.missions[0]!;
    const fought = settleVillage(woke, m.arriveAt);
    expect(fought.missions[0]?.fight ?? null).not.toBeNull();
  });
});
