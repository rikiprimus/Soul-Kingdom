import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { addToStorage, placeStored, rotateBuilding, storeBuilding } from './storage';
import { canPlaceBuilding, isTileUnlocked, plotOf, type Building } from './village';

const T0 = 1_000_000;
const DECO = gameData.village.buildings.find((b) => b.category === 'dekorasi')!.id;
const WONDER = gameData.village.buildings.find((b) => b.feature === 'wonder')!;
const WALL = gameData.village.buildings.find((b) => b.lineBuild)!.id;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

function freeSpot(s: PlayerState, size: number, skip = 0) {
  const { mapSize } = gameData.village.village;
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      if (canPlaceBuilding(s.village, size, x, y) && skip-- <= 0) return { x, y };
    }
  }
  throw new Error('peta penuh');
}

function add(
  s: PlayerState,
  type: string,
  at: { x: number; y: number },
  extra: Partial<Building> = {},
) {
  const b: Building = {
    id: `t${s.village.buildings.length}`,
    type,
    ...at,
    level: 1,
    construction: null,
    lastCollectAt: T0,
    crop: null,
    ...extra,
  };
  s.village.buildings.push(b);
  return b;
}

describe('rotating', () => {
  it('flips a building between its two facings and keeps it in the save', () => {
    const s = createInitialState(T0, 1);
    const deco = s.village.buildings.find((b) => b.type === DECO)!;
    const once = ok(rotateBuilding(s, deco.id)).state;
    expect(once.village.buildings.find((b) => b.id === deco.id)!.flipped).toBe(true);
    const back = deserializeState(serializeState(once));
    expect(back.village.buildings.find((b) => b.id === deco.id)!.flipped).toBe(true);
    const twice = ok(rotateBuilding(once, deco.id)).state;
    expect(twice.village.buildings.find((b) => b.id === deco.id)!.flipped).toBe(false);
  });

  it('walls do not turn (they join up by neighbours)', () => {
    const s = createInitialState(T0, 1);
    const wall = add(s, WALL, freeSpot(s, 1));
    expect(rotateBuilding(s, wall.id)).toEqual({ ok: false, error: 'cannotRotate' });
  });
});

describe('Gudang', () => {
  it('keeps a decoration with its level and facing, and places it again anywhere open', () => {
    const s = createInitialState(T0, 1);
    const deco = s.village.buildings.find((b) => b.type === DECO)!;
    const flipped = ok(rotateBuilding(s, deco.id)).state;
    const stored = ok(storeBuilding(flipped, deco.id, T0));
    expect(stored.state.village.buildings.some((b) => b.id === deco.id)).toBe(false);
    expect(stored.state.storage).toEqual([
      { id: stored.itemId, type: DECO, level: deco.level, flipped: true },
    ]);
    const spot = freeSpot(stored.state, 1, 5);
    const placed = ok(placeStored(stored.state, { itemId: stored.itemId, ...spot }, T0 + 10));
    const b = placed.state.village.buildings.find((x) => x.id === placed.buildingId)!;
    expect(b).toMatchObject({ type: DECO, ...spot, level: deco.level, flipped: true });
    expect(placed.state.storage).toEqual([]);
    expect(placed.state.resources).toEqual(stored.state.resources);
  });

  it('places only on free, open land', () => {
    const s = createInitialState(T0, 1);
    addToStorage(s, DECO);
    const itemId = s.storage[0]!.id;
    const hall = s.village.buildings.find((b) => b.type === gameData.townHallId)!;
    expect(placeStored(s, { itemId, x: hall.x, y: hall.y }, T0)).toEqual({
      ok: false,
      error: 'blocked',
    });
    const { mapSize } = gameData.village.village;
    let locked: { x: number; y: number } | null = null;
    for (let y = 0; y < mapSize && !locked; y++) {
      for (let x = 0; x < mapSize && !locked; x++)
        if (!isTileUnlocked(s.village, x, y)) locked = { x, y };
    }
    expect(plotOf(locked!.x, locked!.y)).toBeDefined();
    expect(placeStored(s, { itemId, ...locked! }, T0)).toEqual({ ok: false, error: 'plotLocked' });
    expect(placeStored(s, { itemId: 'tidak-ada', x: 0, y: 0 }, T0)).toEqual({
      ok: false,
      error: 'entryNotFound',
    });
  });

  it('a Keajaiban hands over what it made before going in', () => {
    const s = createInitialState(T0, 1);
    const w = add(s, WONDER.id, freeSpot(s, WONDER.size));
    const r = ok(storeBuilding(s, w.id, T0 + 3600));
    const { resource, perHour } = WONDER.levels[0]!.production!;
    expect(r.collected).toBe(perHour);
    expect(r.state.resources[resource]).toBe(s.resources[resource] + perHour);
  });

  it('only decorations and Keajaiban; nothing under construction; never monsters', () => {
    const s = createInitialState(T0, 1);
    const hall = s.village.buildings.find((b) => b.type === gameData.townHallId)!;
    expect(storeBuilding(s, hall.id, T0)).toEqual({ ok: false, error: 'notStorable' });
    const building = add(s, DECO, freeSpot(s, 1), {
      level: 0,
      construction: { toLevel: 1, endsAt: T0 + 60 },
    });
    expect(storeBuilding(s, building.id, T0)).toEqual({ ok: false, error: 'underConstruction' });
    s.monsters.push({ id: 'm1', form: 'kucing', element: 'api', stage: 'bayi', food: 0 });
    expect(storeBuilding(s, 'm1', T0)).toEqual({ ok: false, error: 'buildingNotFound' });
  });

  it('keeps the count limit when placing', () => {
    const s = createInitialState(T0, 1);
    addToStorage(s, WONDER.id);
    add(s, WONDER.id, freeSpot(s, WONDER.size));
    expect(placeStored(s, { itemId: s.storage[0]!.id, ...freeSpot(s, WONDER.size) }, T0)).toEqual({
      ok: false,
      error: 'maxCountReached',
    });
  });

  it('old saves: won Keajaiban move into the Gudang', () => {
    const s = createInitialState(T0, 1);
    const old = deepClone(s) as Partial<PlayerState> & { wonders: string[] };
    delete old.storage;
    old.wonders = [WONDER.id];
    const v22 = deserializeState(JSON.stringify({ schemaVersion: 22, state: old }));
    expect(v22.storage).toMatchObject([{ type: WONDER.id, level: 1, flipped: false }]);
    expect('wonders' in v22).toBe(false);
  });
});
