import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import type { Monster } from './monster';
import { deserializeState, serializeState } from './save';
import { collectMix, createInitialState, type ActionResult, type PlayerState } from './state';
import {
  addConstructionWorkers,
  buildBuilding,
  canPlaceBuilding,
  constructionTime,
  constructionWorkers,
  maxConstructionWorkers,
  levelDef,
  settleVillage,
  speedUpBuilding,
  upgradeBuilding,
} from './village';
import {
  assignWorkers,
  createWorkers,
  idleWorkers,
  monsterSlots,
  populationCap,
  populationFree,
  populationUsed,
  releaseMonster,
  releaseWorkers,
  trainWorker,
  trainingRemaining,
} from './workers';

const T0 = 1_000_000;
const { workers: workerRules, population, battle } = gameData.rules;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

function rich(hall = 1): PlayerState {
  const s = createInitialState(T0, 11);
  s.village.obstacles = [];
  for (const r of ['gold', 'food', 'wood', 'stone', 'gems'] as const) s.resources[r] = 10_000_000;
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = hall;
  const n = gameData.village.village.mapSize / gameData.village.village.plotSize;
  s.village.unlockedPlots = Array.from(
    { length: n * n },
    (_, i) => `${i % n},${Math.floor(i / n)}`,
  );
  return s;
}

function formOfTier(tier: number) {
  return gameData.forms.forms.find((f) => f.tier === tier)!;
}

function monster(id: string, tier: number): Monster {
  const adult = gameData.rules.growth.stages[gameData.rules.growth.stages.length - 1]!.id;
  return { id, form: formOfTier(tier).id, element: 'api', stage: adult, food: 0 };
}

/** Adds tier-1 monsters until the village has `free` slots left. */
function fillTo(s: PlayerState, free: number) {
  let i = 0;
  while (populationFree(s) > free) s.monsters.push(monster(`fill${i++}`, 1));
  return s;
}

function freeSpot(s: PlayerState, size: number) {
  const { mapSize } = gameData.village.village;
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) if (canPlaceBuilding(s.village, size, x, y)) return { x, y };
  }
  throw new Error('peta penuh');
}

describe('population', () => {
  it('counts workers and monsters by form tier against Balai and Rumah', () => {
    const s = createInitialState(T0, 3);
    const hall = gameData.buildingById.get(gameData.townHallId)!;
    expect(populationCap(s)).toBe(hall.levels[0]!.population);
    expect(s.workers).toHaveLength(workerRules.startingWorkers);
    const monsters = s.monsters.reduce((sum, m) => sum + monsterSlots(m), 0);
    expect(populationUsed(s)).toBe(s.workers.length * population.workerSlots + monsters);
    for (const tier of gameData.formTiers) {
      expect(monsterSlots(monster('x', tier))).toBe(battle.powerPoints[String(tier)]);
    }
    const before = populationUsed(s);
    s.monsters.push(monster('big', 3));
    expect(populationUsed(s)).toBe(before + battle.powerPoints['3']!);
  });

  it('grows when a Rumah is finished and upgraded', () => {
    let s = rich(2);
    const cap = populationCap(s);
    const house = ok(buildBuilding(s, { type: 'rumah', ...freeSpot(s, 2) }, T0));
    s = house.state;
    expect(populationCap(s)).toBe(cap);
    const t1 = T0 + levelDef('rumah', 1)!.seconds;
    s = settleVillage(s, t1);
    expect(populationCap(s)).toBe(cap + levelDef('rumah', 1)!.population!);
    s = ok(upgradeBuilding(s, house.buildingId, t1)).state;
    s = settleVillage(s, t1 + levelDef('rumah', 2)!.seconds);
    expect(populationCap(s)).toBe(cap + levelDef('rumah', 2)!.population!);
  });

  it('allows as many Rumah as the Balai level gives (2 more each level)', () => {
    const slots = gameData.buildingById.get('rumah')!.maxCount;
    expect(slots[1]! - slots[0]!).toBe(2);
    let s = rich(1);
    for (let i = 0; i < slots[0]!; i++) {
      s = ok(buildBuilding(s, { type: 'rumah', ...freeSpot(s, 2) }, T0 + i * 10_000)).state;
    }
    expect(buildBuilding(s, { type: 'rumah', ...freeSpot(s, 2) }, T0 + 99_000)).toEqual({
      ok: false,
      error: 'maxCountReached',
    });
  });

  it('refuses a hatching monster when the village is full', () => {
    const full = fillTo(rich(), 0);
    const kind = monster('k', 1);
    full.mixQueue.push({
      id: 'x1',
      parents: [monster('p1', 1), monster('p2', 1)],
      consumedParentIds: ['p1', 'p2'],
      result: {
        form: kind.form,
        element: kind.element,
        rarity: 'biasa',
        tierOutcome: 'same',
        elementSource: 'parent',
        mutation: false,
        secretElement: false,
        nextPityStreak: 0,
      },
      cost: { resultTier: 1, seconds: 0, gold: 0, soulCrystal: 0, prophecyGems: 0 },
      status: 'mixing',
      endsAt: T0,
      prophesied: false,
    });
    expect(collectMix(full, 'x1', T0)).toEqual({ ok: false, error: 'populationFull' });
    const roomy = fillTo(rich(), monsterSlots(kind));
    roomy.mixQueue = deepClone(full.mixQueue);
    expect(collectMix(roomy, 'x1', T0).ok).toBe(true);
  });

  it('frees slots when a monster is released, but not one in the Soul Mixer', () => {
    const s = fillTo(rich(), 0);
    const target = s.monsters[0]!;
    const r = ok(releaseMonster(s, target.id));
    expect(populationFree(r.state)).toBe(monsterSlots(target));
    expect(r.state.monsters.some((m) => m.id === target.id)).toBe(false);
    expect(releaseMonster(s, 'nope')).toEqual({ ok: false, error: 'monsterNotFound' });
    const busy = deepClone(s);
    busy.mixQueue = [
      {
        id: 'x2',
        parents: [deepClone(target), monster('other', 1)],
        consumedParentIds: [],
        result: {
          form: target.form,
          element: target.element,
          rarity: 'biasa',
          tierOutcome: 'same',
          elementSource: 'parent',
          mutation: false,
          secretElement: false,
          nextPityStreak: 0,
        },
        cost: { resultTier: 1, seconds: 60, gold: 0, soulCrystal: 0, prophecyGems: 0 },
        status: 'mixing',
        endsAt: T0 + 60,
        prophesied: false,
      },
    ];
    expect(releaseMonster(busy, target.id)).toEqual({ ok: false, error: 'parentBusy' });
  });
});

describe('workers', () => {
  it('trains workers one after another for food', () => {
    let s = rich();
    s.resources.food = workerRules.trainFood * 2;
    const before = s.workers.length;
    const a = ok(trainWorker(s, T0));
    expect(a.endsAt).toBe(T0 + workerRules.trainSeconds);
    s = a.state;
    const b = ok(trainWorker(s, T0));
    expect(b.endsAt).toBe(T0 + workerRules.trainSeconds * 2);
    s = b.state;
    expect(s.resources.food).toBe(0);
    expect(trainingRemaining(s, T0)).toBe(workerRules.trainSeconds);
    // Workers in training already take their population slot.
    expect(populationUsed(s)).toBe(populationUsed(rich()) + 2 * population.workerSlots);

    s = settleVillage(s, T0 + workerRules.trainSeconds);
    expect(s.workers).toHaveLength(before + 1);
    expect(s.workerTraining).toHaveLength(1);
    s = settleVillage(s, T0 + workerRules.trainSeconds * 2);
    expect(s.workers).toHaveLength(before + 2);
    expect(idleWorkers(s)).toHaveLength(before + 2);
    expect(trainingRemaining(s, T0)).toBeNull();
  });

  it('refuses training without food, room or queue space', () => {
    const poor = rich();
    poor.resources.food = workerRules.trainFood - 1;
    expect(trainWorker(poor, T0)).toEqual({ ok: false, error: 'notEnoughFood' });
    expect(trainWorker(fillTo(rich(), 0), T0)).toEqual({ ok: false, error: 'populationFull' });
    let s = rich(gameData.maxTownHallLevel);
    expect(populationFree(s)).toBeGreaterThan(workerRules.trainQueueMax);
    for (let i = 0; i < workerRules.trainQueueMax; i++) s = ok(trainWorker(s, T0)).state;
    expect(trainWorker(s, T0)).toEqual({ ok: false, error: 'trainingQueueFull' });
  });

  it('sends a worker to each construction and back when it is done', () => {
    let s = rich(3);
    const r = ok(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3) }, T0));
    s = r.state;
    const busy = s.workers.filter((w) => w.task.kind === 'building');
    expect(busy).toHaveLength(1);
    expect(busy[0]!.task).toEqual({ kind: 'building', buildingId: r.buildingId });
    s = settleVillage(s, T0 + levelDef('ladang', 1)!.seconds);
    expect(idleWorkers(s)).toHaveLength(s.workers.length);

    const up = ok(upgradeBuilding(s, r.buildingId, T0 + 10_000)).state;
    expect(idleWorkers(up)).toHaveLength(s.workers.length - 1);
    const sped = ok(speedUpBuilding(up, r.buildingId, T0 + 10_000, () => 1)).state;
    expect(idleWorkers(sped)).toHaveLength(s.workers.length);
  });

  it('assigns only idle workers and releases matching tasks', () => {
    const s = rich();
    const n = s.workers.length;
    expect(assignWorkers(s, n + 1, { kind: 'gathering', targetId: 'o1' })).toBeNull();
    expect(assignWorkers(s, 1, { kind: 'gathering', targetId: 'o1' })).toHaveLength(1);
    expect(idleWorkers(s)).toHaveLength(n - 1);
    expect(releaseWorkers(s, (t) => t.kind === 'gathering' && t.targetId === 'o2')).toBe(0);
    expect(releaseWorkers(s, (t) => t.kind === 'gathering')).toBe(1);
    expect(idleWorkers(s)).toHaveLength(n);
  });
});

describe('building with workers', () => {
  const base = levelDef('ladang', 1)!.seconds;
  const max = maxConstructionWorkers('ladang');

  function crew(n: number) {
    const s = rich(3);
    createWorkers(s, n - s.workers.length);
    return s;
  }

  it('divides the base time by the number of workers', () => {
    expect(max).toBe(
      workerRules.constructionMaxBySize[String(gameData.buildingById.get('ladang')!.size)],
    );
    for (let n = 1; n <= max; n++) {
      const s = crew(max);
      const r = ok(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3), workers: n }, T0));
      const b = r.state.village.buildings.find((x) => x.id === r.buildingId)!;
      expect(b.construction!.endsAt - T0).toBe(Math.ceil(base / n));
      expect(constructionWorkers(r.state, r.buildingId)).toBe(n);
      expect(idleWorkers(r.state)).toHaveLength(max - n);
    }
    expect(constructionTime(100, 3)).toBe(34);
  });

  it('caps workers by building size and needs enough idle workers', () => {
    const s = crew(max + 1);
    const spot = freeSpot(s, 3);
    expect(buildBuilding(s, { type: 'ladang', ...spot, workers: max + 1 }, T0)).toEqual({
      ok: false,
      error: 'tooManyWorkers',
    });
    expect(buildBuilding(s, { type: 'ladang', ...spot, workers: 0 }, T0)).toEqual({
      ok: false,
      error: 'invalidAmount',
    });
    // One worker short: everyone but one is idle.
    const few = crew(max);
    assignWorkers(few, 1, { kind: 'gathering', targetId: 'o1' });
    expect(buildBuilding(few, { type: 'ladang', ...spot, workers: max }, T0)).toEqual({
      ok: false,
      error: 'buildersBusy',
    });
    // Instant buildings ignore the worker count.
    expect(buildBuilding(few, { type: 'bunga', ...freeSpot(few, 1), workers: 99 }, T0).ok).toBe(
      true,
    );
  });

  it('upgrades faster with more workers', () => {
    let s = crew(max);
    const farm = ok(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3), workers: max }, T0));
    const done = T0 + Math.ceil(base / max);
    s = settleVillage(farm.state, done);
    const up = ok(upgradeBuilding(s, farm.buildingId, done, { workers: 2 }));
    const b = up.state.village.buildings.find((x) => x.id === farm.buildingId)!;
    expect(b.construction!.endsAt - done).toBe(Math.ceil(levelDef('ladang', 2)!.seconds / 2));
    expect(upgradeBuilding(s, farm.buildingId, done, { workers: max + 1 })).toEqual({
      ok: false,
      error: 'tooManyWorkers',
    });
  });

  it('shares the remaining work when workers join mid-way', () => {
    let s = crew(4);
    const r = ok(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3), workers: 1 }, T0));
    s = r.state;
    const half = T0 + base / 2;
    const added = ok(addConstructionWorkers(s, r.buildingId, 1, half));
    expect(added.endsAt).toBe(half + Math.ceil(base / 2 / 2));
    expect(constructionWorkers(added.state, r.buildingId)).toBe(2);
    expect(addConstructionWorkers(added.state, r.buildingId, max, half)).toEqual({
      ok: false,
      error: 'tooManyWorkers',
    });
    // Room for one more on the site, but nobody idle to send.
    const busy = deepClone(s);
    assignWorkers(busy, idleWorkers(busy).length, { kind: 'gathering', targetId: 'o1' });
    expect(addConstructionWorkers(busy, r.buildingId, 1, half)).toEqual({
      ok: false,
      error: 'buildersBusy',
    });
    const hall = s.village.buildings.find((b) => b.type === gameData.townHallId)!;
    expect(addConstructionWorkers(s, hall.id, 1, half)).toEqual({
      ok: false,
      error: 'notConstructing',
    });
    // Everybody goes back to idle when it is done.
    const finished = settleVillage(added.state, added.endsAt);
    expect(idleWorkers(finished)).toHaveLength(finished.workers.length);
  });
});

describe('save migration v5', () => {
  it('gives old villages workers, one per running construction', () => {
    let s = rich(3);
    s = ok(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3) }, T0)).state;
    const v5 = deepClone(s) as unknown as Record<string, unknown>;
    delete v5.workers;
    delete v5.workerTraining;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 5, state: v5 }));
    expect(loaded.workers).toHaveLength(workerRules.startingWorkers);
    expect(loaded.workers.filter((w) => w.task.kind === 'building')).toHaveLength(1);
    expect(loaded.workerTraining).toEqual([]);
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});
