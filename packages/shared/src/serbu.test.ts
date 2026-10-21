import { describe, expect, it } from 'vitest';
import { serbuPowerCap } from './barracks';
import { gameData, VILLAGE_RESOURCES } from './data';
import { deserializeState, serializeState } from './save';
import {
  attackBase,
  baseFighters,
  basePower,
  serbuArmy,
  serbuBaseStatus,
  serbuUnitPower,
  type SerbuCell,
} from './serbu';
import { createInitialState, type PlayerState } from './state';

const T0 = 1_000_000;
const { serbu, battle } = gameData.rules;
const [first, second, third] = serbu.bases;
const adult = gameData.rules.growth.stages.at(-1)!.id;
const baby = gameData.rules.growth.stages[0]!.id;

/** A new game with one adult dragon (8 power points, inside the no-barracks cap). */
function army(): PlayerState {
  const s = createInitialState(T0, 9);
  s.monsters.push({ id: 'm1', form: 'naga', element: 'api', stage: adult, food: 0 });
  return s;
}

const at = (id: string, x = 0, y = 0): SerbuCell => ({ id, x, y });

function ok<T extends object>(r: ReturnType<typeof attackBase> & T) {
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('serbu bases', () => {
  it('open one after another, each also needing its Balai level', () => {
    const s = createInitialState(T0, 1);
    expect(serbuBaseStatus(s, first!.id)).toBe('open');
    expect(serbuBaseStatus(s, second!.id)).toBe('locked');
    s.serbu.cleared.push(first!.id, second!.id);
    expect(serbuBaseStatus(s, first!.id)).toBe('cleared');
    expect(third!.requiresTownHall).toBeGreaterThan(1);
    expect(serbuBaseStatus(s, third!.id)).toBe('townHall');
    s.village.buildings.find((b) => b.type === gameData.townHallId)!.level =
      third!.requiresTownHall;
    expect(serbuBaseStatus(s, third!.id)).toBe('open');
  });

  it('turn every defender into a fighter; towers never move', () => {
    for (const base of serbu.bases) {
      const fighters = baseFighters(base);
      expect(fighters).toHaveLength(base.defenders.reduce((n, d) => n + d.count, 0));
      const towers = base.defenders.filter((d) => d.kind === 'tower');
      expect(fighters.filter((f) => f.fixed)).toHaveLength(towers.reduce((n, d) => n + d.count, 0));
      expect(basePower(base)).toBeGreaterThan(0);
    }
  });

  it('get stronger down the list', () => {
    const powers = serbu.bases.map((b) => basePower(b));
    expect(powers.at(-1)!).toBeGreaterThan(powers[0]! * 10);
  });
});

describe('attacking a base', () => {
  it('rejects bad placements, busy units, locked bases and armies over the cap', () => {
    const s = army();
    s.monsters.push({ id: 'm2', form: 'harimau', element: 'air', stage: adult, food: 0 });
    const attack = (cells: SerbuCell[], baseId = first!.id) => attackBase(s, { baseId, cells });
    expect(attack([at('m1')], second!.id)).toEqual({ ok: false, error: 'notUnlocked' });
    expect(attack([])).toEqual({ ok: false, error: 'invalidAmount' });
    expect(attack([at('m1'), at('m1', 1)])).toEqual({ ok: false, error: 'invalidAmount' });
    expect(attack([at('m1', serbu.placeColumns)])).toEqual({ ok: false, error: 'blocked' });
    expect(attack([at('m1', 0, serbu.grid.rows)])).toEqual({ ok: false, error: 'blocked' });
    expect(attack([at('m1'), at('m2')])).toEqual({ ok: false, error: 'blocked' });
    expect(attack([at('nobody')])).toEqual({ ok: false, error: 'monsterNotFound' });
    // Dragon (8) + tiger (4) is over the no-barracks cap.
    expect(serbuUnitPower(s, 'm1') + serbuUnitPower(s, 'm2')).toBeGreaterThan(serbuPowerCap(s));
    expect(attack([at('m1'), at('m2', 1)])).toEqual({ ok: false, error: 'powerCapExceeded' });
    s.missions.push({ id: 't1', encounterId: 'e1', monsterIds: ['m2'], arriveAt: T0, fight: null });
    expect(serbuArmy(s)).toEqual(['m1']);
    expect(attack([at('m2')])).toEqual({ ok: false, error: 'monsterBusy' });
    const many = Array.from({ length: battle.maxUnits + 1 }, (_, i) => at(`u${i}`, 0, i));
    expect(attack(many)).toEqual({ ok: false, error: 'invalidAmount' });
  });

  it('pays the first reward once and opens the next base; later wins pay the repeat reward', () => {
    const s = army();
    const r = ok(attackBase(s, { baseId: first!.id, cells: [at('m1', 2, 3)] }));
    expect(r.result.won).toBe(true);
    expect(r.result.first).toBe(true);
    for (const res of VILLAGE_RESOURCES) {
      expect(r.state.resources[res]).toBe(s.resources[res] + first!.firstReward[res]);
    }
    expect(r.state.serbu.cleared).toEqual([first!.id]);
    expect(serbuBaseStatus(r.state, second!.id)).toBe('open');
    const again = ok(attackBase(r.state, { baseId: first!.id, cells: [at('m1')] }));
    expect(again.result.first).toBe(false);
    expect(again.state.resources.gold).toBe(r.state.resources.gold + first!.repeatReward.gold);
    expect(again.state.serbu.cleared).toEqual([first!.id]);
  });

  it('sends fallen monsters to the Kuburan and removes fallen soldiers; a loss pays nothing', () => {
    const s = createInitialState(T0, 3);
    s.monsters.push({ id: 'm1', form: 'kucing', element: 'api', stage: baby, food: 0 });
    s.soldiers.push({ id: 's1', kind: 'pemanah', rank: 0 });
    // The last base, opened for the test: far too strong for a baby and a recruit.
    const last = serbu.bases.at(-1)!;
    s.serbu.cleared = serbu.bases.slice(0, -1).map((b) => b.id);
    s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = last.requiresTownHall;
    const r = ok(attackBase(s, { baseId: last.id, cells: [at('m1'), at('s1', 0, 1)] }));
    expect(r.result.won).toBe(false);
    expect(r.result.dead.sort()).toEqual(['m1', 's1']);
    expect(r.state.monsters).toEqual([]);
    expect(r.state.soldiers).toEqual([]);
    expect(r.state.graveyard.map((m) => m.id)).toEqual(['m1']);
    expect(r.state.resources.gold).toBe(s.resources.gold);
    expect(r.state.serbu.cleared).toEqual(s.serbu.cleared);
  });

  it('starts our units on the chosen cells, the base on the right, within the time limit', () => {
    const r = ok(attackBase(army(), { baseId: first!.id, cells: [at('m1', 3, 5)] }));
    const { battle: b } = r.result;
    const starts = b.events.filter((e) => e.kind === 'start');
    for (const e of starts) {
      if (e.kind !== 'start') continue;
      if (e.side === 'attackers') expect([e.x, e.y]).toEqual([3.5, 5.5]);
      else expect(e.x).toBeGreaterThan(serbu.grid.columns - serbu.placeColumns);
    }
    expect(b.ticks).toBeLessThanOrEqual(battle.maxTicks);
    expect(b.frames![0]!.tick).toBe(0);
    expect(b.frames!.at(-1)!.tick).toBe(b.ticks);
    expect(b.frames![1]!.tick).toBe(serbu.trackEveryTicks);
  });

  it('is deterministic for the same state and placement', () => {
    const s = army();
    s.soldiers.push({ id: 's1', kind: 'prajurit', rank: 0 });
    const cells = [at('m1', 1, 2), at('s1', 3, 4)];
    expect(attackBase(s, { baseId: first!.id, cells })).toEqual(
      attackBase(s, { baseId: first!.id, cells }),
    );
  });
});

describe('serbu saves', () => {
  it('round-trips progress and migrates v16 saves with nothing beaten', () => {
    const won = ok(attackBase(army(), { baseId: first!.id, cells: [at('m1')] })).state;
    expect(deserializeState(serializeState(won))).toEqual(won);
    const v16 = JSON.parse(serializeState(won)).state;
    delete v16.serbu;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 16, state: v16 }));
    expect(loaded.serbu).toEqual({ cleared: [] });
  });
});
