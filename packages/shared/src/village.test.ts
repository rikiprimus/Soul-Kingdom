import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { deserializeState, serializeState } from './save';
import {
  createInitialState,
  isMixerUnlocked,
  speedUpCost,
  type ActionResult,
  type PlayerState,
} from './state';
import {
  buildBuilding,
  canPlace,
  collectAll,
  collectBuilding,
  isReadyToCollect,
  sellBuilding,
  sellValue,
  cropStatus,
  harvestCrop,
  levelDef,
  maxCountFor,
  moveBuilding,
  occupancy,
  pendingProduction,
  plantCrop,
  settleVillage,
  speedUpBuilding,
  townHallLevel,
  upgradeBuilding,
} from './village';
import { idleWorkers, populationFree } from './workers';

const T0 = 1_000_000;
const { village } = gameData.village;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** A rich player on a map without obstacles, for placement tests. */
function rich(): PlayerState {
  const s = createInitialState(T0, 42);
  s.village.obstacles = [];
  s.resources.gold = 10_000_000;
  s.resources.food = 10_000_000;
  s.resources.wood = 10_000_000;
  s.resources.stone = 10_000_000;
  s.resources.gems = 100_000;
  // Placement tests do not care about locked land.
  const n = gameData.village.village.mapSize / gameData.village.village.plotSize;
  s.village.unlockedPlots = Array.from(
    { length: n * n },
    (_, i) => `${i % n},${Math.floor(i / n)}`,
  );
  return s;
}

const byType = (s: PlayerState, type: string) => s.village.buildings.find((b) => b.type === type)!;

function freeSpot(s: PlayerState, size: number) {
  for (let y = 0; y < village.mapSize; y++) {
    for (let x = 0; x < village.mapSize; x++) if (canPlace(s.village, size, x, y)) return { x, y };
  }
  throw new Error('peta penuh');
}

/** Sets the Balai Utama level instantly. */
function setHall(s: PlayerState, level: number) {
  byType(s, gameData.townHallId).level = level;
  return s;
}

describe('new village', () => {
  it('places the starting buildings and obstacles without overlap', () => {
    const s = createInitialState(T0, 7);
    let area = 0;
    for (const b of s.village.buildings) area += gameData.buildingById.get(b.type)!.size ** 2;
    for (const o of s.village.obstacles) area += gameData.obstacleById.get(o.type)!.size ** 2;
    expect(occupancy(s.village).size).toBe(area);
    expect(
      s.village.obstacles.filter((o) => o.type !== gameData.wilds.goldVeins.node),
    ).toHaveLength(village.initialObstacles);
    expect(townHallLevel(s)).toBe(gameData.rules.economy.startingTownHallLevel);
    expect(populationFree(s)).toBeGreaterThanOrEqual(0);
    expect(idleWorkers(s)).toHaveLength(gameData.rules.workers.startingWorkers);
  });

  it('is deterministic for a seed', () => {
    expect(createInitialState(T0, 9).village).toEqual(createInitialState(T0, 9).village);
    expect(createInitialState(T0, 9).village).not.toEqual(createInitialState(T0, 10).village);
  });
});

describe('placement', () => {
  it('rejects footprints outside the map or on top of something', () => {
    const s = rich();
    const hall = byType(s, gameData.townHallId);
    expect(canPlace(s.village, 2, -1, 0)).toBe(false);
    expect(canPlace(s.village, 2, village.mapSize - 1, 0)).toBe(false);
    expect(canPlace(s.village, 1, hall.x + 1, hall.y + 1)).toBe(false);
    expect(canPlace(s.village, 1, 0, 0)).toBe(true);
  });

  it('moves a building to a free spot only', () => {
    const s = rich();
    const pasar = byType(s, 'pasar');
    const hall = byType(s, gameData.townHallId);
    expect(moveBuilding(s, { buildingId: pasar.id, x: hall.x, y: hall.y })).toEqual({
      ok: false,
      error: 'blocked',
    });
    // Overlapping its own old footprint is fine.
    const moved = ok(moveBuilding(s, { buildingId: pasar.id, x: pasar.x + 1, y: pasar.y }));
    expect(byType(moved.state, 'pasar').x).toBe(pasar.x + 1);
  });
});

describe('construction', () => {
  it('builds with a timer, pays the cost and finishes on time', () => {
    const s = rich();
    const lvl = levelDef('ladang', 1)!;
    const r = ok(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3) }, T0));
    const b = r.state.village.buildings.find((x) => x.id === r.buildingId)!;
    expect(b).toMatchObject({ level: 0, construction: { toLevel: 1, endsAt: T0 + lvl.seconds } });
    expect(r.state.resources.gold).toBe(s.resources.gold - lvl.cost.gold);
    const done = settleVillage(r.state, T0 + lvl.seconds);
    expect(done.village.buildings.find((x) => x.id === r.buildingId)).toMatchObject({
      level: 1,
      construction: null,
    });
    expect(settleVillage(done, T0 + lvl.seconds)).toBe(done);
  });

  it('places instant decorations at level 1', () => {
    const s = rich();
    const r = ok(buildBuilding(s, { type: 'bunga', ...freeSpot(s, 1) }, T0));
    expect(r.state.village.buildings.find((x) => x.id === r.buildingId)!.level).toBe(1);
  });

  it('enforces town hall level, count limits, space and resources', () => {
    const s = rich();
    expect(buildBuilding(s, { type: 'altar', ...freeSpot(s, 3) }, T0)).toEqual({
      ok: false,
      error: 'townHallTooLow',
    });
    expect(maxCountFor(s, 'pasar')).toBe(1);
    expect(buildBuilding(s, { type: 'pasar', ...freeSpot(s, 2) }, T0)).toEqual({
      ok: false,
      error: 'maxCountReached',
    });
    expect(buildBuilding(s, { type: 'nope', x: 0, y: 0 }, T0)).toEqual({
      ok: false,
      error: 'unknownBuilding',
    });
    const hall = byType(s, gameData.townHallId);
    expect(buildBuilding(s, { type: 'ladang', x: hall.x, y: hall.y }, T0)).toEqual({
      ok: false,
      error: 'blocked',
    });
    const poor = deepClone(s);
    poor.resources.gold = 0;
    expect(buildBuilding(poor, { type: 'ladang', ...freeSpot(s, 3) }, T0)).toEqual({
      ok: false,
      error: 'notEnoughGold',
    });
  });

  it('needs an idle worker for timed constructions', () => {
    let s = setHall(rich(), 3);
    const workers = s.workers.length;
    for (let i = 0; i < workers; i++) {
      s = ok(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3) }, T0)).state;
    }
    expect(idleWorkers(s)).toHaveLength(0);
    expect(s.workers.every((w) => w.task.kind === 'building')).toBe(true);
    expect(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3) }, T0)).toEqual({
      ok: false,
      error: 'buildersBusy',
    });
    // Instant decorations do not need a builder.
    expect(buildBuilding(s, { type: 'bunga', ...freeSpot(s, 1) }, T0).ok).toBe(true);
    // Once a timer runs out the builder is free again.
    const later = T0 + levelDef('ladang', 1)!.seconds;
    expect(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3) }, later).ok).toBe(true);
  });

  it('upgrades the town hall, which unlocks more buildings', () => {
    let s = rich();
    const hall = byType(s, gameData.townHallId);
    const next = levelDef(hall.type, 2)!;
    s = ok(upgradeBuilding(s, hall.id, T0)).state;
    expect(townHallLevel(s)).toBe(1);
    expect(upgradeBuilding(s, hall.id, T0)).toEqual({ ok: false, error: 'underConstruction' });
    s = settleVillage(s, T0 + next.seconds);
    expect(townHallLevel(s)).toBe(2);
    expect(maxCountFor(s, 'pasar')).toBe(gameData.buildingById.get('pasar')!.maxCount[1]);
  });

  it('refuses upgrades past the max level or above the town hall', () => {
    const s = rich();
    expect(upgradeBuilding(s, byType(s, 'pasar').id, T0)).toEqual({
      ok: false,
      error: 'townHallTooLow',
    });
    setHall(s, gameData.maxTownHallLevel);
    expect(upgradeBuilding(s, byType(s, gameData.townHallId).id, T0)).toEqual({
      ok: false,
      error: 'maxLevel',
    });
  });

  it('speeds up construction with gems', () => {
    const s = rich();
    const r = ok(buildBuilding(s, { type: 'ladang', ...freeSpot(s, 3) }, T0));
    const seconds = levelDef('ladang', 1)!.seconds;
    const sped = ok(speedUpBuilding(r.state, r.buildingId, T0, speedUpCost));
    expect(sped.gems).toBe(speedUpCost(seconds));
    expect(sped.state.village.buildings.find((b) => b.id === r.buildingId)!.level).toBe(1);
    expect(speedUpBuilding(sped.state, r.buildingId, T0, speedUpCost)).toEqual({
      ok: false,
      error: 'alreadyFinished',
    });
  });
});

describe('production', () => {
  it('accumulates passive gold up to its capacity and collects it', () => {
    const s = rich();
    const pasar = byType(s, 'pasar');
    const prod = levelDef('pasar', 1)!.production!;
    expect(pendingProduction(s, pasar, T0 + 3600)).toBe(prod.perHour);
    expect(pendingProduction(s, pasar, T0 + 3600 * 1000)).toBe(prod.capacity);
    const r = ok(collectBuilding(s, pasar.id, T0 + 3600));
    expect(r).toMatchObject({ resource: prod.resource, amount: prod.perHour });
    expect(r.state.resources.gold).toBe(s.resources.gold + prod.perHour);
    expect(collectBuilding(r.state, pasar.id, T0 + 3600)).toEqual({
      ok: false,
      error: 'nothingToCollect',
    });
  });

  it('banks production when an upgrade starts', () => {
    const s = setHall(rich(), 2);
    const pasar = byType(s, 'pasar');
    const r = ok(upgradeBuilding(s, pasar.id, T0 + 3600));
    expect(r.collected).toBe(levelDef('pasar', 1)!.production!.perHour);
    expect(pendingProduction(s, byType(r.state, 'pasar'), T0 + 7200)).toBe(0);
  });

  it('plants, grows and harvests crops', () => {
    const s = rich();
    const farm = byType(s, 'ladang');
    const crop = levelDef('ladang', 1)!.crop!;
    expect(cropStatus(farm, T0)).toBe('empty');
    expect(harvestCrop(s, farm.id, T0)).toEqual({ ok: false, error: 'noCrop' });
    const planted = ok(plantCrop(s, farm.id, T0));
    expect(planted.state.resources.gold).toBe(s.resources.gold - crop.plantGold);
    expect(plantCrop(planted.state, farm.id, T0)).toEqual({ ok: false, error: 'alreadyPlanted' });
    expect(harvestCrop(planted.state, farm.id, T0 + 1)).toEqual({ ok: false, error: 'notReady' });
    const harvested = ok(harvestCrop(planted.state, farm.id, T0 + crop.seconds));
    expect(harvested.food).toBe(crop.food);
    expect(harvested.state.resources.food).toBe(s.resources.food + crop.food);
    expect(cropStatus(byType(harvested.state, 'ladang'), T0 + crop.seconds)).toBe('empty');
    expect(plantCrop(s, byType(s, 'pasar').id, T0)).toEqual({ ok: false, error: 'notAFarm' });
  });
});

describe('the mixer building', () => {
  it('unlocks the mixer only with a finished Soul Mixer', () => {
    const s = setHall(rich(), gameData.rules.mixer.unlockTownHallLevel);
    expect(isMixerUnlocked(s)).toBe(false);
    const r = ok(buildBuilding(s, { type: 'altar', ...freeSpot(s, 3) }, T0));
    expect(isMixerUnlocked(r.state)).toBe(false);
    expect(isMixerUnlocked(settleVillage(r.state, T0 + 10 ** 6))).toBe(true);
  });
});

describe('save migration', () => {
  it('upgrades a Fase 0 (v1) save to a village', () => {
    const v2 = createInitialState(T0, 5);
    const v1 = deepClone(v2) as unknown as Record<string, unknown>;
    delete v1.village;
    v1.townHallLevel = 4;
    v1.lastHarvestAt = T0;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 1, state: v1 }));
    expect(townHallLevel(loaded)).toBe(4);
    expect(isMixerUnlocked(loaded)).toBe(true);
    expect(loaded.monsters).toEqual(v2.monsters);
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});

describe('farms during upgrades', () => {
  it('keeps the harvest fixed at planting time', () => {
    let s = setHall(rich(), 2);
    const farm = byType(s, 'ladang');
    const crop1 = levelDef('ladang', 1)!.crop!;
    s = ok(plantCrop(s, farm.id, T0)).state;
    s = ok(upgradeBuilding(s, farm.id, T0)).state;
    s = settleVillage(s, T0 + levelDef('ladang', 2)!.seconds);
    expect(byType(s, 'ladang').level).toBe(2);
    const harvested = ok(harvestCrop(s, farm.id, T0 + 10 ** 6));
    expect(harvested.food).toBe(crop1.food);
  });

  it('can harvest but not replant while upgrading', () => {
    let s = setHall(rich(), 2);
    const farm = byType(s, 'ladang');
    const crop = levelDef('ladang', 1)!.crop!;
    s = ok(plantCrop(s, farm.id, T0)).state;
    s = ok(upgradeBuilding(s, farm.id, T0 + 10)).state;
    const ripe = T0 + crop.seconds;
    expect(byType(s, 'ladang').construction!.endsAt).toBeGreaterThan(ripe);
    s = ok(harvestCrop(s, farm.id, ripe)).state;
    expect(plantCrop(s, farm.id, ripe)).toEqual({ ok: false, error: 'underConstruction' });
  });
});

describe('collect all', () => {
  it('collects ready producers and ripe fields in one go', () => {
    let s = rich();
    const farm = byType(s, 'ladang');
    const crop = levelDef('ladang', 1)!.crop!;
    const prod = levelDef('pasar', 1)!.production!;
    s = ok(plantCrop(s, farm.id, T0)).state;
    const later = T0 + Math.max(crop.seconds, 3600);
    expect(isReadyToCollect(s, byType(s, 'pasar'), later)).toBe(true);
    expect(isReadyToCollect(s, byType(s, 'ladang'), later)).toBe(true);
    const r = ok(collectAll(s, later));
    expect(r.count).toBe(2);
    expect(r.food).toBe(crop.food);
    expect(r.gold).toBe(Math.min(prod.capacity, Math.floor((prod.perHour * (later - T0)) / 3600)));
    expect(r.state.resources.gold).toBe(s.resources.gold + r.gold);
    expect(collectAll(r.state, later)).toEqual({ ok: false, error: 'nothingToCollect' });
  });

  it('waits until a producer is filled past the ready ratio', () => {
    const s = rich();
    const prod = levelDef('pasar', 1)!.production!;
    const ratio = gameData.village.village.collectReadyRatio;
    const almost = Math.floor(((prod.capacity * ratio - 1) / prod.perHour) * 3600);
    expect(isReadyToCollect(s, byType(s, 'pasar'), T0 + almost)).toBe(false);
    expect(isReadyToCollect(s, byType(s, 'pasar'), T0 + 3600 * 100)).toBe(true);
  });
});

describe('selling', () => {
  it('sells decorations for a share of their price', () => {
    const s = rich();
    const flowers = byType(s, 'bunga');
    const price = levelDef('bunga', 1)!.cost;
    const ratio = gameData.village.village.sellRefundRatio;
    expect(sellValue(flowers)).toEqual({
      gold: Math.floor(price.gold * ratio),
      food: Math.floor(price.food * ratio),
      wood: Math.floor(price.wood * ratio),
      stone: Math.floor(price.stone * ratio),
    });
    const r = ok(sellBuilding(s, flowers.id, T0));
    expect(r.state.village.buildings.some((b) => b.id === flowers.id)).toBe(false);
    expect(r.state.resources.gold).toBe(s.resources.gold + r.gold);
  });

  it('refuses to sell core buildings', () => {
    const s = rich();
    expect(sellBuilding(s, byType(s, gameData.townHallId).id, T0)).toEqual({
      ok: false,
      error: 'notSellable',
    });
    expect(sellBuilding(s, byType(s, 'pasar').id, T0)).toEqual({ ok: false, error: 'notSellable' });
  });
});

describe('save migration v2', () => {
  it('fills in the harvest of crops planted before v3', () => {
    let s = rich();
    s = ok(plantCrop(s, byType(s, 'ladang').id, T0)).state;
    const v2 = deepClone(s);
    delete (byType(v2, 'ladang').crop as { food?: number }).food;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 2, state: v2 }));
    expect(byType(loaded, 'ladang').crop!.food).toBe(levelDef('ladang', 1)!.crop!.food);
  });
});

describe('Tugas 1A.2 data', () => {
  it('has every building of Fase 1A available now', () => {
    expect(gameData.village.buildings.filter((b) => b.hidden)).toEqual([]);
  });

  it('charges wood and stone', () => {
    const s = setHall(rich(), 2);
    const lvl = levelDef('pasar', 2)!;
    expect(lvl.cost.wood).toBeGreaterThan(0);
    const r = ok(upgradeBuilding(s, byType(s, 'pasar').id, T0));
    expect(r.state.resources.wood).toBe(s.resources.wood - lvl.cost.wood);
    const poor = setHall(rich(), 2);
    poor.resources.wood = 0;
    expect(upgradeBuilding(poor, byType(poor, 'pasar').id, T0)).toEqual({
      ok: false,
      error: 'notEnoughWood',
    });
  });

  it('starts new villages on the big map with wilds all around', () => {
    const s = createInitialState(T0, 4);
    const { mapSize } = gameData.village.village;
    expect(s.village.obstacles.filter((o) => o.type !== gameData.wilds.goldVeins.node).length).toBe(
      gameData.village.village.initialObstacles,
    );
    expect(s.village.obstacles.some((o) => o.x >= 32 || o.y >= 32)).toBe(true);
    expect(s.village.obstacles.every((o) => o.x < mapSize && o.y < mapSize)).toBe(true);
  });
});

describe('save migration v3', () => {
  it('centres an old 28×28 village on the bigger map and adds wood, stone and wilds', () => {
    const v4 = createInitialState(T0, 6);
    const v3 = deepClone(v4) as unknown as {
      resources: Record<string, number>;
      village: PlayerState['village'];
    };
    delete v3.resources.wood;
    delete v3.resources.stone;
    // An old village: everything inside 0..27.
    v3.village.buildings = v4.village.buildings.map((b) => ({ ...b, x: b.x - 10, y: b.y - 10 }));
    v3.village.obstacles = [{ id: 'old', type: 'batu', x: 2, y: 3, work: 0 }];
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 3, state: v3 }));
    expect(loaded.resources.wood).toBe(gameData.rules.economy.startingResources.wood);
    expect(loaded.resources.stone).toBe(gameData.rules.economy.startingResources.stone);
    expect(loaded.village.buildings.map((b) => [b.x, b.y])).toEqual(
      v4.village.buildings.map((b) => [b.x, b.y]),
    );
    expect(loaded.village.obstacles.find((o) => o.id === 'old')).toMatchObject({ x: 12, y: 13 });
    expect(loaded.village.obstacles.length).toBeGreaterThan(
      gameData.village.village.initialObstacles,
    );
    // Nothing new appears inside the old village area.
    const added = loaded.village.obstacles.filter((o) => o.id !== 'old');
    expect(added.every((o) => o.x < 10 || o.x >= 38 || o.y < 10 || o.y >= 38)).toBe(true);
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});
