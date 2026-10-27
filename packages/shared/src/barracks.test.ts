import { describe, expect, it } from 'vitest';
import {
  barracksQueue,
  barracksQueueMax,
  barracksRemaining,
  combinedBarracksLevel,
  hatchEgg,
  rollEgg,
  serbuPowerCap,
  soldierKindOf,
  soldierName,
  soldierPower,
  soldierStats,
  soldierTrainCost,
  trainSoldier,
  unlockedRanks,
} from './barracks';
import { deepClone } from './clone';
import { gameData } from './data';
import { createRng } from './rng';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { buildBuilding, canPlaceBuilding, levelDef, settleVillage } from './village';
import { populationFree, populationUsed } from './workers';

const T0 = 1_000_000;
const { barracks, battle, economy, growth } = gameData.rules;
const BARRACKS = {
  barak: 'prajurit',
  'lapangan-panah': 'pemanah',
  'kandang-kuda': 'penombak-berkuda',
} as const;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

function freeSpot(s: PlayerState, size: number) {
  const { mapSize } = gameData.village.village;
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) if (canPlaceBuilding(s.village, size, x, y)) return { x, y };
  }
  throw new Error('peta penuh');
}

/** A rich village (Balai 5, all land open) with a finished barracks of `type` at `level`. */
function withBarracks(type: string, level = 1) {
  let s = createInitialState(T0, 51);
  s.village.obstacles = [];
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 1_000_000;
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = 5;
  const r = ok(buildBuilding(s, { type, ...freeSpot(s, 3) }, T0));
  s = settleVillage(r.state, T0 + levelDef(type, 1)!.seconds);
  s.village.buildings.find((b) => b.id === r.buildingId)!.level = level;
  return { s, id: r.buildingId, at: T0 + levelDef(type, 1)!.seconds };
}

describe('soldier kinds and ranks', () => {
  it('each barracks trains its own soldier; the Guild trains nothing', () => {
    for (const [type, kind] of Object.entries(BARRACKS)) {
      expect(soldierKindOf(type)?.id).toBe(kind);
    }
    expect(soldierKindOf('guild')).toBeUndefined();
    expect(soldierKindOf('pasar')).toBeUndefined();
  });

  it('opens rank n at barracks level n, capped at the last rank', () => {
    expect(unlockedRanks(0)).toBe(0);
    expect(unlockedRanks(1)).toBe(1);
    expect(unlockedRanks(2)).toBe(2);
    expect(unlockedRanks(99)).toBe(barracks.ranks.length);
  });

  it('scales stats, power, cost and time by rank (speed and range stay)', () => {
    const def = barracks.soldiers.find((x) => x.id === 'prajurit')!;
    const top = barracks.ranks.length - 1;
    const r = barracks.ranks[top]!;
    const elite = { kind: 'prajurit', rank: top };
    expect(soldierStats(elite)).toEqual({
      hp: Math.round(def.stats.hp * r.statMultiplier),
      atk: Math.round(def.stats.atk * r.statMultiplier),
      def: Math.round(def.stats.def * r.statMultiplier),
      spd: def.stats.spd,
      range: def.stats.range,
    });
    expect(soldierPower(elite)).toBe(def.powerPoints + r.powerBonus);
    expect(soldierTrainCost(elite)).toEqual({
      gold: Math.round(def.train.gold * r.costMultiplier),
      food: Math.round(def.train.food * r.costMultiplier),
      seconds: Math.round(def.train.seconds * r.timeMultiplier),
    });
    expect(soldierName(elite)).toBe(`${def.name} ${r.name}`);
  });
});

describe('training soldiers', () => {
  it('pays, queues one after another, holds the slots and delivers soldiers', () => {
    const { s, id, at } = withBarracks('kandang-kuda', 2);
    const kind = { buildingId: id, rank: 1 };
    const cost = soldierTrainCost({ kind: 'penombak-berkuda', rank: 1 });
    const power = soldierPower({ kind: 'penombak-berkuda', rank: 1 });
    const before = populationUsed(s);
    const a = ok(trainSoldier(s, kind, at));
    expect(a.state.resources.gold).toBe(s.resources.gold - cost.gold);
    expect(a.state.resources.food).toBe(s.resources.food - cost.food);
    expect(a.endsAt).toBe(at + cost.seconds);
    expect(populationUsed(a.state)).toBe(before + power);
    const b = ok(trainSoldier(a.state, kind, at));
    expect(b.endsAt).toBe(at + cost.seconds * 2);
    expect(barracksQueue(b.state, id)).toHaveLength(2);
    expect(barracksRemaining(b.state, id, at + 10)).toBe(cost.seconds - 10);

    const done = settleVillage(b.state, at + cost.seconds * 2);
    expect(done.barracksQueue).toEqual([]);
    expect(done.soldiers.map((x) => [x.kind, x.rank])).toEqual([
      ['penombak-berkuda', 1],
      ['penombak-berkuda', 1],
    ]);
    // Soldiers are not monsters and still hold their slots.
    expect(done.monsters).toEqual(s.monsters);
    expect(populationUsed(done)).toBe(before + power * 2);
  });

  it('refuses locked ranks, a full queue, no room and too little gold or food', () => {
    const { s, id, at } = withBarracks('barak', 1);
    expect(trainSoldier(s, { buildingId: id, rank: 1 }, at)).toEqual({
      ok: false,
      error: 'notUnlocked',
    });
    const kind = { buildingId: id, rank: 0 };
    let q = s;
    for (let i = 0; i < barracks.queueMax; i++) q = ok(trainSoldier(q, kind, at)).state;
    expect(trainSoldier(q, kind, at)).toEqual({ ok: false, error: 'trainingQueueFull' });

    const full = deepClone(s);
    while (populationFree(full) > 0) {
      full.soldiers.push({ id: `f${full.soldiers.length}`, kind: 'prajurit', rank: 0 });
    }
    expect(trainSoldier(full, kind, at)).toEqual({ ok: false, error: 'populationFull' });

    const cost = soldierTrainCost({ kind: 'prajurit', rank: 0 });
    const poor = deepClone(s);
    poor.resources.gold = cost.gold - 1;
    expect(trainSoldier(poor, kind, at)).toEqual({ ok: false, error: 'notEnoughGold' });
    poor.resources.gold = cost.gold;
    poor.resources.food = cost.food - 1;
    expect(trainSoldier(poor, kind, at)).toEqual({ ok: false, error: 'notEnoughFood' });
  });

  it('top-level barracks queue one more soldier', () => {
    for (const type of Object.keys(BARRACKS)) {
      const levels = gameData.buildingById.get(type)!.levels;
      for (let level = 1; level < levels.length; level++) {
        expect(barracksQueueMax(type, level)).toBe(barracks.queueMax);
      }
      expect(barracksQueueMax(type, levels.length)).toBe(barracks.queueMax + 1);
    }
    const { s, id, at } = withBarracks('barak', 6);
    let q = s;
    const kind = { buildingId: id, rank: 0 };
    for (let i = 0; i < barracks.queueMax + 1; i++) q = ok(trainSoldier(q, kind, at)).state;
    expect(trainSoldier(q, kind, at)).toEqual({ ok: false, error: 'trainingQueueFull' });
  });

  it('Kandang Kuda opens at Balai 3', () => {
    const def = gameData.buildingById.get('kandang-kuda')!;
    expect(def.levels[0]!.requiresTownHall).toBe(3);
    expect(def.maxCount.slice(0, 3)).toEqual([0, 0, 1]);
  });

  it('cannot train in an unfinished barracks or in the Guild', () => {
    const s = createInitialState(T0, 52);
    s.village.obstacles = [];
    for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 1_000_000;
    const r = ok(buildBuilding(s, { type: 'barak', ...freeSpot(s, 3) }, T0));
    expect(trainSoldier(r.state, { buildingId: r.buildingId, rank: 0 }, T0)).toEqual({
      ok: false,
      error: 'underConstruction',
    });
    const guild = withBarracks('guild', 3);
    expect(trainSoldier(guild.s, { buildingId: guild.id, rank: 0 }, guild.at)).toEqual({
      ok: false,
      error: 'notBarracks',
    });
  });
});

describe('Serbu power cap', () => {
  it('follows the combined level of the three soldier barracks (not the Guild)', () => {
    let { s } = withBarracks('barak', 2);
    expect(combinedBarracksLevel(s)).toBe(2);
    expect(serbuPowerCap(s)).toBe(battle.powerCapByCombinedBarracksLevel[2]);
    for (const type of ['lapangan-panah', 'kandang-kuda', 'guild']) {
      const r = ok(buildBuilding(s, { type, ...freeSpot(s, 3) }, T0));
      s = settleVillage(r.state, T0 + 10_000);
      s.village.buildings.find((b) => b.id === r.buildingId)!.level = 3;
    }
    expect(combinedBarracksLevel(s)).toBe(8);
    expect(serbuPowerCap(s)).toBe(battle.powerCapByCombinedBarracksLevel[8]);
    const table = battle.powerCapByCombinedBarracksLevel;
    const top = Object.keys(BARRACKS).reduce(
      (sum, type) => sum + gameData.buildingById.get(type)!.levels.length,
      0,
    );
    expect(table).toHaveLength(top + 1);
    for (let i = 1; i < table.length; i++) expect(table[i]!).toBeGreaterThan(table[i - 1]!);
  });
});

describe('a new game and its egg', () => {
  it('starts with no monster and one egg', () => {
    const s = createInitialState(T0, 1);
    expect(s.monsters).toEqual([]);
    expect(s.soldiers).toEqual([]);
    expect(s.eggs).toHaveLength(1);
    expect(s.eggs[0]!.readyAt).toBe(T0 + economy.startingEgg.hatchSeconds);
  });

  it('hatches the egg into a tier-1 baby with a base element once it is ready', () => {
    const s = createInitialState(T0, 2);
    const egg = s.eggs[0]!;
    expect(hatchEgg(s, egg.id, egg.readyAt)).toEqual({ ok: false, error: 'noNest' });
    s.village.buildings.push({
      id: 'nest',
      type: 'sarang-telur',
      x: 0,
      y: 0,
      level: 1,
      construction: null,
      lastCollectAt: T0,
      crop: null,
    });
    expect(hatchEgg(s, egg.id, egg.readyAt - 1)).toEqual({ ok: false, error: 'notReady' });
    const r = ok(hatchEgg(s, egg.id, egg.readyAt));
    expect(r.monster).toMatchObject({ form: egg.form, element: egg.element, food: 0 });
    expect(r.monster.stage).toBe(growth.stages[0]!.id);
    expect(gameData.formById.get(egg.form)!.tier).toBe(gameData.formTiers[0]);
    expect(gameData.baseUnits).toContain(egg.element);
    expect(r.state.monsters).toEqual([r.monster]);
    expect(r.state.eggs).toEqual([]);
    expect(r.state.pedia.monsters).toContain(`${egg.form}:${egg.element}`);
    expect(hatchEgg(r.state, egg.id, egg.readyAt)).toEqual({ ok: false, error: 'entryNotFound' });
  });

  it('needs room in the village to hatch', () => {
    const s = createInitialState(T0, 3);
    s.village.buildings.push({
      id: 'nest',
      type: 'sarang-telur',
      x: 0,
      y: 0,
      level: 1,
      construction: null,
      lastCollectAt: T0,
      crop: null,
    });
    while (populationFree(s) > 0)
      s.soldiers.push({ id: `f${s.soldiers.length}`, kind: 'prajurit', rank: 0 });
    const egg = s.eggs[0]!;
    expect(hatchEgg(s, egg.id, egg.readyAt)).toEqual({ ok: false, error: 'populationFull' });
  });

  it('rolls every tier-1 form and base element about equally (Monte Carlo)', () => {
    const rng = createRng(77);
    const forms = new Map<string, number>();
    const elements = new Map<string, number>();
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const e = rollEgg(rng, 'e', 0);
      forms.set(e.form, (forms.get(e.form) ?? 0) + 1);
      elements.set(e.element, (elements.get(e.element) ?? 0) + 1);
    }
    const tier1 = gameData.formsByTier.get(gameData.formTiers[0]!)!;
    expect([...forms.keys()].sort()).toEqual(tier1.map((f) => f.id).sort());
    for (const n of forms.values()) expect(Math.abs(n / N - 1 / tier1.length)).toBeLessThan(0.01);
    expect([...elements.keys()].sort()).toEqual([...gameData.baseUnits].sort());
    for (const n of elements.values()) {
      expect(Math.abs(n / N - 1 / gameData.baseUnits.length)).toBeLessThan(0.01);
    }
  });
});

describe('save migration v10', () => {
  it('turns monsters still in barracks training into adult monsters', () => {
    const v10 = deepClone(createInitialState(T0, 4)) as unknown as Record<string, unknown>;
    delete v10.soldiers;
    delete v10.eggs;
    v10.barracksQueue = [{ buildingId: 'b1', form: 'anjing', element: 'air', endsAt: T0 + 50 }];
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 10, state: v10 }));
    expect(loaded.barracksQueue).toEqual([]);
    expect(loaded.soldiers).toEqual([]);
    expect(loaded.eggs).toEqual([]);
    const adult = growth.stages[growth.stages.length - 1]!.id;
    expect(loaded.monsters).toEqual([
      { id: expect.any(String), form: 'anjing', element: 'air', stage: adult, food: 0 },
    ]);
    expect(loaded.pedia.monsters).toContain('anjing:air');
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});
