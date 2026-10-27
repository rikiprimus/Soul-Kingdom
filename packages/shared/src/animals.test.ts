import { describe, expect, it } from 'vitest';
import {
  animalRespawnSeconds,
  animalType,
  freeRanchSlots,
  huntersOf,
  ranchAnimalsIn,
  sendToAnimal,
  spawnAnimals,
} from './animals';
import { deepClone } from './clone';
import { gameData } from './data';
import { deserializeState, serializeState } from './save';
import { runAction } from './server/actions';
import { huntAnimal } from './units';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import {
  buildBuilding,
  canPlaceBuilding,
  levelDef,
  pendingProduction,
  settleVillage,
} from './village';
import { advanceWilds, recallWorkers } from './wilds';
import { createWorkers } from './workers';

const T0 = 1_000_000;
const HOUR = 3600;
const { animals } = gameData.wilds;
const ranchLevel = levelDef('peternakan', 1)!;

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

/** A village with 8 workers and one animal of `type` (id "a1"), optionally a finished ranch. */
function setup(type: string, ranch = false) {
  let s = createInitialState(T0, 41);
  s.village.obstacles = [];
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 1_000_000;
  createWorkers(s, 8 - s.workers.length);
  s.village.animals = [{ id: 'a1', type, x: 1, y: 1, work: 0, job: null }];
  let ranchId = '';
  let at = T0;
  if (ranch) {
    const r = ok(buildBuilding(s, { type: 'peternakan', ...freeSpot(s, 3) }, T0));
    at = T0 + ranchLevel.seconds;
    s = settleVillage(r.state, at);
    ranchId = r.buildingId;
  }
  return { s, ranchId, at };
}

describe('hunting (soldiers, Tugas 1C.9)', () => {
  /** `n` soldiers standing next to the animal at (1, 1). */
  function withHunters(s: PlayerState, n: number) {
    for (let i = 0; i < n; i++) {
      s.soldiers.push({ id: `h${i}`, kind: 'prajurit', rank: 0 });
      s.units[`h${i}`] = { x: 2 + i, y: 3, path: [], departAt: T0, guard: null };
    }
    return Array.from({ length: n }, (_, i) => `h${i}`);
  }

  it('workers cannot hunt any more, only capture', () => {
    const { s } = setup('rusa', true);
    expect(sendToAnimal(s, 'a1', 'hunt', 1)).toEqual({ ok: false, error: 'huntNeedsSoldiers' });
  });

  it('turns an animal into food, faster with more hunters, then they stop guarding it', () => {
    for (const def of animals.types) {
      for (let n = 1; n <= def.maxWorkers; n++) {
        const { s, at } = setup(def.id);
        const ids = withHunters(s, n);
        const sent = ok(huntAnimal(s, { ids, animalId: 'a1' }, at)).state;
        expect(huntersOf(sent, 'a1')).toEqual(ids);
        expect(sent.village.animals[0]!.job).toBe('hunt');
        const almost = advanceWilds(sent, def.hunt.workSeconds / n - 1, at);
        expect(almost.animals).toHaveLength(0);
        const done = advanceWilds(almost.state, 1, at);
        expect(done.animals).toEqual([
          expect.objectContaining({ animalId: 'a1', job: 'hunt', food: def.hunt.food }),
        ]);
        expect(done.state.resources.food).toBe(s.resources.food + def.hunt.food);
        expect(done.state.village.animals).toHaveLength(0);
        expect(ids.every((id) => done.state.units[id]!.guard === null)).toBe(true);
      }
    }
  });

  it('refuses too many hunters, workers as hunters, a busy animal or a missing one', () => {
    const def = animalType('ayam-hutan');
    const { s } = setup(def.id, true);
    const ids = withHunters(s, def.maxWorkers + 1);
    expect(huntAnimal(s, { ids, animalId: 'a1' }, T0)).toEqual({
      ok: false,
      error: 'tooManyWorkers',
    });
    expect(huntAnimal(s, { ids: [s.workers[0]!.id], animalId: 'a1' }, T0)).toEqual({
      ok: false,
      error: 'huntNeedsSoldiers',
    });
    expect(huntAnimal(s, { ids: [ids[0]!], animalId: 'nope' }, T0)).toEqual({
      ok: false,
      error: 'animalNotFound',
    });
    const hunting = ok(huntAnimal(s, { ids: [ids[0]!], animalId: 'a1' }, T0)).state;
    expect(sendToAnimal(hunting, 'a1', 'capture', 1)).toEqual({ ok: false, error: 'animalBusy' });
    const capturing = ok(sendToAnimal(s, 'a1', 'capture', 1)).state;
    expect(huntAnimal(capturing, { ids: [ids[0]!], animalId: 'a1' }, T0)).toEqual({
      ok: false,
      error: 'animalBusy',
    });
    // Called back, the animal can be captured instead; the work starts over.
    const back = ok(recallWorkers(advanceWilds(hunting, 10, T0).state, 'a1')).state;
    expect(huntersOf(back, 'a1')).toEqual([]);
    expect(back.village.animals[0]!.work).toBe(10);
    const capture = ok(sendToAnimal(back, 'a1', 'capture', 1)).state;
    expect(capture.village.animals[0]).toMatchObject({ job: 'capture', work: 0 });
  });

  it('is a server action', () => {
    const { s } = setup('rusa');
    const ids = withHunters(s, 1);
    expect(runAction(s, 'huntAnimal', { ids, animalId: 'a1' }, T0).ok).toBe(true);
  });

  it('pauses during a raid on the village, like gathering', () => {
    const { s, at } = setup('rusa');
    const ids = withHunters(s, 1);
    const sent = ok(huntAnimal(s, { ids, animalId: 'a1' }, at)).state;
    sent.village.encounters.push({
      id: 'r',
      level: 0,
      group: 0,
      x: 40,
      y: 40,
      count: 1,
      enemies: [],
      raid: { warnLeft: 0, next: null, stepLeft: 0, stepSeconds: 0, breaking: null },
    });
    const r = advanceWilds(sent, 1000, at);
    expect(r.animals).toEqual([]);
    expect(r.state.village.animals[0]!.work).toBe(0);
  });

  it('migrates v29 saves: workers out hunting come back idle', () => {
    const { s } = setup('rusa');
    s.village.animals[0]!.job = 'hunt';
    s.village.animals[0]!.work = 20;
    s.workers[0]!.task = { kind: 'gathering', targetId: 'a1' };
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 29, state: s }));
    expect(loaded.workers[0]!.task).toEqual({ kind: 'idle' });
    expect(loaded.village.animals[0]).toMatchObject({ job: null, work: 0 });
  });
});

describe('capturing and the Peternakan', () => {
  it('needs a Peternakan with a free slot', () => {
    const { s } = setup('rusa');
    expect(sendToAnimal(s, 'a1', 'capture', 1)).toEqual({ ok: false, error: 'noRanch' });
    const { s: full, ranchId } = setup('rusa', true);
    full.village.ranchAnimals = Array.from({ length: ranchLevel.animalSlots! }, (_, i) => ({
      id: `r${i}`,
      type: 'ayam-hutan',
      buildingId: ranchId,
    }));
    expect(freeRanchSlots(full)).toBe(0);
    expect(sendToAnimal(full, 'a1', 'capture', 1)).toEqual({ ok: false, error: 'ranchFull' });
  });

  it('reserves the slot while a capture runs', () => {
    const { s, ranchId } = setup('rusa', true);
    s.village.ranchAnimals = Array.from({ length: ranchLevel.animalSlots! - 1 }, (_, i) => ({
      id: `r${i}`,
      type: 'ayam-hutan',
      buildingId: ranchId,
    }));
    s.village.animals.push({ id: 'a2', type: 'rusa', x: 2, y: 2, work: 0, job: null });
    const first = ok(sendToAnimal(s, 'a1', 'capture', 1)).state;
    expect(freeRanchSlots(first)).toBe(0);
    expect(sendToAnimal(first, 'a2', 'capture', 1)).toEqual({ ok: false, error: 'ranchFull' });
    // More hands on the same capture are fine.
    expect(sendToAnimal(first, 'a1', 'capture', 1).ok).toBe(true);
  });

  it('moves the animal in, and the Peternakan then makes food per animal, offline too', () => {
    const def = animalType('babi-liar');
    const { s, ranchId, at } = setup(def.id, true);
    const ranch = () => s.village.buildings.find((b) => b.id === ranchId)!;
    expect(pendingProduction(s, ranch(), at + HOUR)).toBe(0);
    const sent = ok(sendToAnimal(s, 'a1', 'capture', 1)).state;
    const done = advanceWilds(sent, def.capture.workSeconds, at);
    expect(done.animals[0]).toMatchObject({ job: 'capture', ranchId, food: 0 });
    expect(ranchAnimalsIn(done.state, ranchId)).toEqual([
      { id: 'a1', type: def.id, buildingId: ranchId },
    ]);
    expect(done.state.village.animals).toHaveLength(0);
    // Nothing ticks while the game is closed; the output is worked out on return.
    const back = settleVillage(done.state, at + 2 * HOUR);
    const b = back.village.buildings.find((x) => x.id === ranchId)!;
    expect(pendingProduction(back, b, at + 2 * HOUR)).toBe(
      Math.min(ranchLevel.ranchCapacity!, 2 * def.ranchFoodPerHour),
    );
    expect(pendingProduction(back, b, at + 1000 * HOUR)).toBe(ranchLevel.ranchCapacity);
  });
});

describe('animal spawns', () => {
  it('starts with a full set of animals on free tiles', () => {
    const s = createInitialState(T0, 3);
    expect(s.village.animals).toHaveLength(animals.count);
    expect(s.village.animalsAt).toBe(T0);
    for (const a of s.village.animals) {
      expect(canPlaceBuilding({ ...s.village, unlockedPlots: allPlots() }, 1, a.x, a.y)).toBe(true);
    }
  });

  it('come back up to the count once a day has passed since the last spawn', () => {
    const s = createInitialState(T0, 3);
    s.village.animals = s.village.animals.slice(0, 2);
    const day = animalRespawnSeconds();
    expect(spawnAnimals(s, T0 + day - 1)).toBe(s);
    const later = spawnAnimals(s, T0 + day + 500);
    expect(later.village.animals).toHaveLength(animals.count);
    expect(later.village.animals.slice(0, 2)).toEqual(s.village.animals);
    // The timer restarts from the spawn, so a long absence does not stack spawns.
    expect(later.village.animalsAt).toBe(T0 + day + 500);
    expect(spawnAnimals(deepClone(s), T0 + day + 500)).toEqual(later);
  });
});

describe('save migration v7', () => {
  it('starts old villages without animals, ready to spawn them', () => {
    const s = createInitialState(T0, 4);
    const v7 = deepClone(s) as unknown as { village: Record<string, unknown> };
    delete v7.village.animals;
    delete v7.village.ranchAnimals;
    delete v7.village.animalsAt;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 7, state: v7 }));
    expect(loaded.village.animals).toEqual([]);
    expect(loaded.village.ranchAnimals).toEqual([]);
    expect(spawnAnimals(loaded, s.village.regrowAt).village.animals).toHaveLength(animals.count);
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});

function allPlots() {
  const n = gameData.village.village.mapSize / gameData.village.village.plotSize;
  return Array.from({ length: n * n }, (_, i) => [i % n, Math.floor(i / n)].join(','));
}
