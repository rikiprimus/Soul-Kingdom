import { describe, expect, it } from 'vitest';
import { combinedBarracksLevel, serbuPowerCap } from './barracks';
import { simulateBattle, type Fighter } from './battle';
import { gameData } from './data';
import { deserializeState, serializeState } from './save';
import { attackBase, serbuArmy, serbuUnitPower } from './serbu';
import { runAction } from './server/actions';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { settleVillage } from './village';
import { populationFree, populationUsed } from './workers';
import {
  buildMachine,
  machineFighter,
  machineName,
  machinePower,
  machineStats,
  workshopLevel,
  workshopQueueMax,
} from './workshop';

// Tugas 1C.7: Bengkel, Ketapel and Pendobrak.
const T0 = 1_000_000;
const { workshop, battle } = gameData.rules;
const [ketapel, pendobrak] = workshop.machines as [
  (typeof workshop.machines)[number],
  (typeof workshop.machines)[number],
];

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** A rich village (Balai 8) with a finished Bengkel at `level` (id "shop"). */
function withWorkshop(level = 1): PlayerState {
  const s = createInitialState(T0, 61);
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 10_000_000;
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = 8;
  s.village.buildings.push(
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `house${i}`,
      type: 'rumah',
      x: i * 2,
      y: 0,
      level: 6,
      construction: null,
      lastCollectAt: T0,
      crop: null,
    })),
    {
      id: 'shop',
      type: workshop.building,
      x: 40,
      y: 40,
      level,
      construction: null,
      lastCollectAt: T0,
      crop: null,
    },
  );
  return s;
}

describe('Bengkel data', () => {
  it('opens at Balai 4, one per village, six levels; machines have a name per level', () => {
    const def = gameData.buildingById.get(workshop.building)!;
    expect(def.feature).toBe('workshop');
    expect(def.levels[0]!.requiresTownHall).toBe(4);
    expect(def.maxCount).toEqual([0, 0, 0, 1, 1, 1, 1, 1]);
    expect(def.levels).toHaveLength(6);
    expect(workshop.versionMultiplier).toEqual([1, 1.3, 1.6, 2, 2.4, 2.8]);
    for (const m of workshop.machines) expect(m.names).toHaveLength(def.levels.length);
    expect(ketapel.stats.range).toBeGreaterThan(pendobrak.stats.range);
    expect(pendobrak.stats.hp).toBeGreaterThan(ketapel.stats.hp);
    expect(pendobrak.buildingsOnly).toBe(true);
    expect(ketapel.buildingsOnly).toBe(false);
  });
});

describe('building machines', () => {
  it('costs gold, wood and stone, takes population now, and joins the army when done', () => {
    const s = withWorkshop();
    const used = populationUsed(s);
    const r = ok(buildMachine(s, { buildingId: 'shop', kind: ketapel.id }, T0));
    expect(r.endsAt).toBe(T0 + ketapel.build.seconds);
    expect(r.state.resources.gold).toBe(s.resources.gold - ketapel.build.gold);
    expect(r.state.resources.wood).toBe(s.resources.wood - ketapel.build.wood);
    expect(r.state.resources.stone).toBe(s.resources.stone - ketapel.build.stone);
    expect(populationUsed(r.state)).toBe(used + ketapel.powerPoints);
    const done = settleVillage(r.state, r.endsAt);
    expect(done.machines).toEqual([{ id: expect.any(String), kind: ketapel.id }]);
    expect(done.workshopQueue).toEqual([]);
    expect(populationUsed(done)).toBe(used + ketapel.powerPoints);
    // Machines stay out of the village: no unit place, no wild fights.
    expect(done.units[done.machines[0]!.id]).toBeUndefined();
  });

  it('queues up to its limit, one more at level 6', () => {
    for (const level of [1, 6]) {
      let s = withWorkshop(level);
      const max = workshopQueueMax(level);
      expect(max).toBe(workshop.queueMax + (level === 6 ? 1 : 0));
      for (let i = 0; i < max; i++) {
        s = ok(buildMachine(s, { buildingId: 'shop', kind: pendobrak.id }, T0)).state;
      }
      expect(buildMachine(s, { buildingId: 'shop', kind: pendobrak.id }, T0)).toEqual({
        ok: false,
        error: 'trainingQueueFull',
      });
    }
  });

  it('refuses other buildings, unfinished ones, unknown machines, no room or no money', () => {
    const s = withWorkshop();
    const hall = s.village.buildings.find((b) => b.type === gameData.townHallId)!;
    expect(buildMachine(s, { buildingId: hall.id, kind: ketapel.id }, T0)).toEqual({
      ok: false,
      error: 'notWorkshop',
    });
    const fresh = withWorkshop(0);
    expect(buildMachine(fresh, { buildingId: 'shop', kind: ketapel.id }, T0)).toEqual({
      ok: false,
      error: 'underConstruction',
    });
    expect(buildMachine(s, { buildingId: 'shop', kind: 'naga' }, T0)).toEqual({
      ok: false,
      error: 'notUnlocked',
    });
    const poor = withWorkshop();
    poor.resources.stone = ketapel.build.stone - 1;
    expect(buildMachine(poor, { buildingId: 'shop', kind: ketapel.id }, T0)).toEqual({
      ok: false,
      error: 'notEnoughStone',
    });
    const full = withWorkshop();
    while (populationFree(full) > 0) {
      full.soldiers.push({ id: `f${full.soldiers.length}`, kind: 'prajurit', rank: 0 });
    }
    expect(buildMachine(full, { buildingId: 'shop', kind: ketapel.id }, T0)).toEqual({
      ok: false,
      error: 'populationFull',
    });
  });

  it('is a server action', () => {
    const r = runAction(
      withWorkshop(),
      'buildMachine',
      { buildingId: 'shop', kind: ketapel.id },
      T0,
    );
    expect(r.ok).toBe(true);
  });
});

describe('machine versions', () => {
  it('every machine, built or not, follows the highest Bengkel level', () => {
    const s = withWorkshop(1);
    expect(workshopLevel(s)).toBe(1);
    expect(machineName(ketapel.id, 1)).toBe(ketapel.names[0]);
    workshop.versionMultiplier.forEach((k, i) => {
      const stats = machineStats(ketapel.id, i + 1);
      expect(stats.hp).toBe(Math.round(ketapel.stats.hp * k));
      expect(stats.atk).toBe(Math.round(ketapel.stats.atk * k));
      expect(stats.range).toBe(ketapel.stats.range);
      expect(machineName(pendobrak.id, i + 1)).toBe(pendobrak.names[i]);
    });
    s.village.buildings.find((b) => b.id === 'shop')!.level = 4;
    expect(workshopLevel(s)).toBe(4);
  });
});

describe('machines in battle', () => {
  const tower: Fighter = {
    id: 'tower',
    stats: { hp: 5000, atk: 1, def: 0, spd: 1, range: 1 },
    element: null,
    skill: false,
    fixed: true,
  };
  const guard: Fighter = {
    id: 'guard',
    stats: { hp: 5000, atk: 1, def: 0, spd: 1, range: 1 },
    element: null,
    skill: false,
  };

  it('hits buildings for its building multiplier', () => {
    const k = machineFighter({ id: 'k', kind: ketapel.id }, 1);
    const plain = { ...k, id: 'p', siege: undefined };
    const hit = (f: Fighter) => {
      const r = simulateBattle([f], [tower], 3, gameData, { cells: { [f.id]: { x: 0, y: 0 } } });
      return r.events.find((e) => e.kind === 'attack' && e.id === f.id) as { damage: number };
    };
    const ratio = hit(k).damage / hit(plain).damage;
    expect(ratio).toBeGreaterThan(ketapel.buildingMultiplier * 0.8);
    expect(ratio).toBeLessThan(ketapel.buildingMultiplier * 1.25);
  });

  it('a Pendobrak only attacks buildings, walking past other fighters', () => {
    const ram = machineFighter({ id: 'ram', kind: pendobrak.id }, 1);
    const r = simulateBattle([ram], [guard, tower], 3, gameData);
    const targets = new Set(
      r.events
        .filter((e) => e.kind === 'attack' && e.id === 'ram')
        .map((e) => (e as { target: string }).target),
    );
    expect([...targets]).toEqual(['tower']);
  });
});

describe('Serbu army and power cap', () => {
  it('machines join the Serbu army with their power points', () => {
    const s = withWorkshop();
    s.machines.push({ id: 'w1', kind: pendobrak.id });
    expect(serbuArmy(s)).toContain('w1');
    expect(serbuUnitPower(s, 'w1')).toBe(machinePower(pendobrak.id));
  });

  it('the Bengkel level adds to the combined level behind the power cap', () => {
    const s = withWorkshop(3);
    expect(combinedBarracksLevel(s)).toBe(3);
    expect(serbuPowerCap(s)).toBe(battle.powerCapByCombinedBarracksLevel[3]);
  });

  it('a fallen machine is gone after the fight', () => {
    const s = withWorkshop();
    s.machines.push({ id: 'w1', kind: ketapel.id });
    const base = gameData.rules.serbu.bases[0]!;
    const r = ok(attackBase(s, { baseId: base.id, cells: [{ id: 'w1', x: 0, y: 0 }] }, 0));
    const alive = (r.result.battle.hp['w1'] ?? 0) > 0;
    expect(r.result.dead.includes('w1')).toBe(!alive);
    expect(r.state.machines.some((m) => m.id === 'w1')).toBe(alive);
  });
});

describe('saving', () => {
  it('keeps machines and the build queue; v28 saves start with none', () => {
    const s = ok(buildMachine(withWorkshop(), { buildingId: 'shop', kind: ketapel.id }, T0)).state;
    s.machines.push({ id: 'w9', kind: pendobrak.id });
    const loaded = deserializeState(serializeState(s));
    expect(loaded.machines).toEqual(s.machines);
    expect(loaded.workshopQueue).toEqual(s.workshopQueue);
    const old = createInitialState(T0, 3) as Partial<PlayerState>;
    delete old.machines;
    delete old.workshopQueue;
    const migrated = deserializeState(JSON.stringify({ schemaVersion: 28, state: old }));
    expect(migrated.machines).toEqual([]);
    expect(migrated.workshopQueue).toEqual([]);
  });
});
