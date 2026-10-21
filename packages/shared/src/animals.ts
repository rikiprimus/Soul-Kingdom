import { deepClone } from './clone';
import { gameData, type GameData } from './data';
import { createRng, type Rng } from './rng';
import type { ActionError, ActionResult, PlayerState } from './state';
import { bankProduction, canPlace, levelDef, type Building } from './village';
import { assignWorkers, idleWorkers, releaseWorkers } from './workers';

export type AnimalJob = 'hunt' | 'capture';
export type AnimalType = GameData['wilds']['animals']['types'][number];

/** An animal roaming the map; workers hunt it for food or capture it for a Peternakan. */
export interface WildAnimal {
  id: string;
  type: string;
  /** Tile it spawned on (it wanders around here). */
  x: number;
  y: number;
  /** Worker-seconds put into `job` so far; only grows while the game is open. */
  work: number;
  job: AnimalJob | null;
}

/** A captured animal living in a Peternakan. */
export interface RanchAnimal {
  id: string;
  type: string;
  buildingId: string;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export function animalType(type: string, data: GameData = gameData): AnimalType {
  const def = data.wilds.animals.types.find((a) => a.id === type);
  if (!def) throw new Error(`Hewan tidak dikenal: "${type}"`);
  return def;
}

/** Worker-seconds a job on this animal needs. */
export function jobSeconds(type: string, job: AnimalJob, data: GameData = gameData): number {
  const def = animalType(type, data);
  return job === 'hunt' ? def.hunt.workSeconds : def.capture.workSeconds;
}

const onAnimal = (animalId: string) => (task: { kind: string; targetId?: string }) =>
  task.kind === 'gathering' && task.targetId === animalId;

export function animalWorkers(state: PlayerState, animalId: string): number {
  return state.workers.filter((w) => onAnimal(animalId)(w.task)).length;
}

// ---------- Peternakan ----------

const isRanch = (b: Building, data: GameData) =>
  b.level >= 1 && data.buildingById.get(b.type)?.feature === 'ranch';

/** Animal slots of one finished Peternakan. */
export function ranchSlots(b: Building, data: GameData = gameData): number {
  return isRanch(b, data) ? (levelDef(b.type, b.level, data)?.animalSlots ?? 0) : 0;
}

export function ranchAnimalsIn(state: PlayerState, buildingId: string): RanchAnimal[] {
  return state.village.ranchAnimals.filter((a) => a.buildingId === buildingId);
}

/** Captures in progress keep a slot reserved so two of them cannot claim the last one. */
function reservedSlots(state: PlayerState): number {
  return state.village.animals.filter((a) => a.job === 'capture' && animalWorkers(state, a.id) > 0)
    .length;
}

/** Free Peternakan slots across the village, after the captures already under way. */
export function freeRanchSlots(state: PlayerState, data: GameData = gameData): number {
  let free = 0;
  for (const b of state.village.buildings) {
    free += ranchSlots(b, data) - ranchAnimalsIn(state, b.id).length;
  }
  return free - reservedSlots(state);
}

/** Food per hour a Peternakan makes from its animals. */
export function ranchFoodPerHour(state: PlayerState, b: Building, data: GameData = gameData) {
  return ranchAnimalsIn(state, b.id).reduce(
    (sum, a) => sum + animalType(a.type, data).ranchFoodPerHour,
    0,
  );
}

// ---------- Hunting and capturing ----------

/** Sends idle workers to hunt or capture an animal (up to its `maxWorkers`). */
export function sendToAnimal(
  state: PlayerState,
  animalId: string,
  job: AnimalJob,
  count: number,
  data: GameData = gameData,
): ActionResult {
  const animal = state.village.animals.find((a) => a.id === animalId);
  if (!animal) return fail('animalNotFound');
  if (!Number.isInteger(count) || count < 1) return fail('invalidAmount');
  const crew = animalWorkers(state, animal.id);
  if (crew > 0 && animal.job !== job) return fail('animalBusy');
  if (crew + count > animalType(animal.type, data).maxWorkers) return fail('tooManyWorkers');
  if (idleWorkers(state).length < count) return fail('buildersBusy');
  if (job === 'capture' && crew === 0) {
    if (!state.village.buildings.some((b) => isRanch(b, data))) return fail('noRanch');
    if (freeRanchSlots(state, data) < 1) return fail('ranchFull');
  }
  const next = deepClone(state);
  const a = next.village.animals.find((x) => x.id === animalId)!;
  // Switching between hunting and capturing starts the work over.
  if (a.job !== job) {
    a.job = job;
    a.work = 0;
  }
  assignWorkers(next, count, { kind: 'gathering', targetId: a.id });
  return { ok: true, state: next };
}

/** What finished hunts and captures gave (see `advanceAnimals`). */
export interface AnimalDone {
  animalId: string;
  type: string;
  x: number;
  y: number;
  job: AnimalJob;
  food: number;
  /** The Peternakan a captured animal went to. */
  ranchId: string | null;
}

/**
 * Adds `seconds` of active play to every hunt and capture (mutates `state`, which
 * must already be a copy). Hunts pay food; captures move the animal into the
 * Peternakan with a free slot, banking its output first so the new rate is not
 * applied backwards.
 */
export function advanceAnimals(
  state: PlayerState,
  seconds: number,
  now: number,
  data: GameData = gameData,
): AnimalDone[] {
  const done: AnimalDone[] = [];
  for (const a of state.village.animals) {
    const crew = animalWorkers(state, a.id);
    if (crew === 0 || !a.job) continue;
    const need = jobSeconds(a.type, a.job, data);
    a.work = Math.min(need, a.work + seconds * crew);
    if (a.work < need) continue;
    let food = 0;
    let ranchId: string | null = null;
    if (a.job === 'hunt') {
      food = animalType(a.type, data).hunt.food;
      state.resources.food += food;
    } else {
      const ranch = state.village.buildings.find(
        (b) => ranchSlots(b, data) > ranchAnimalsIn(state, b.id).length,
      );
      // The slot was reserved when the capture started; without one, keep waiting.
      if (!ranch) continue;
      bankProduction(state, ranch, now, data);
      state.village.ranchAnimals.push({ id: a.id, type: a.type, buildingId: ranch.id });
      ranchId = ranch.id;
    }
    releaseWorkers(state, onAnimal(a.id));
    done.push({ animalId: a.id, type: a.type, x: a.x, y: a.y, job: a.job, food, ranchId });
  }
  const gone = new Set(done.map((d) => d.animalId));
  state.village.animals = state.village.animals.filter((a) => !gone.has(a.id));
  return done;
}

// ---------- Spawning ----------

/** Seconds between animal spawns. */
export const animalRespawnSeconds = (data: GameData = gameData) =>
  data.wilds.animals.respawnHours * 3600;

function placeAnimals(state: PlayerState, rng: Rng, data: GameData) {
  const { count, types } = data.wilds.animals;
  const { mapSize } = data.village.village;
  const total = types.reduce((sum, a) => sum + a.weight, 0);
  let attempts = 0;
  while (state.village.animals.length < count && attempts < count * 50) {
    attempts++;
    let r = rng.next() * total;
    const def = types.find((a) => (r -= a.weight) < 0) ?? types[0]!;
    const x = rng.int(0, mapSize - 1);
    const y = rng.int(0, mapSize - 1);
    if (!canPlace(state.village, 1, x, y, data)) continue;
    state.village.animals.push({ id: `a${state.nextId}`, type: def.id, x, y, work: 0, job: null });
    state.nextId += 1;
  }
}

/**
 * Once `respawnHours` have passed since the last spawn, animals come back up to
 * `count` on random free tiles and the timer restarts from `now` (a missed day is
 * not made up). Deterministic from the saved RNG.
 */
export function spawnAnimals(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  if (now - state.village.animalsAt < animalRespawnSeconds(data)) return state;
  const next = deepClone(state);
  const rng = createRng(next.rngState);
  placeAnimals(next, rng, data);
  next.village.animalsAt = now;
  next.rngState = rng.getState();
  return next;
}
