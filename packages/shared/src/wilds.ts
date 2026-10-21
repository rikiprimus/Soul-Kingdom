import { deepClone } from './clone';
import { gameData, VILLAGE_RESOURCES, type GameData, type VillageAmount } from './data';
import { advanceAnimals, type AnimalDone } from './animals';
import { createRng } from './rng';
import type { ActionError, ActionResult, PlayerState } from './state';
import { canPlace, obstacleDef, plotOf, plotsPerSide, type Obstacle } from './village';
import { assignWorkers, idleWorkers, releaseWorkers } from './workers';

/** A wild node finished by workers, with what it gave. */
export interface Gathered {
  obstacleId: string;
  type: string;
  x: number;
  y: number;
  amount: VillageAmount;
  soulCrystal: number;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

const gathering = (obstacleId: string) => (task: { kind: string; targetId?: string }) =>
  task.kind === 'gathering' && task.targetId === obstacleId;

/** Workers currently gathering this node. */
export function gatherWorkers(state: PlayerState, obstacleId: string): number {
  return state.workers.filter((w) => gathering(obstacleId)(w.task)).length;
}

/** Seconds left on a node with its current crew (null when nobody works on it). */
export function gatherRemaining(
  state: PlayerState,
  o: Obstacle,
  data: GameData = gameData,
): number | null {
  const crew = gatherWorkers(state, o.id);
  if (crew === 0) return null;
  return Math.max(0, obstacleDef(o.type, data).work.workSeconds - o.work) / crew;
}

/** Sends `count` idle workers to a tree, rock or bush (up to the node's capacity). */
export function sendWorkers(
  state: PlayerState,
  obstacleId: string,
  count: number,
  data: GameData = gameData,
): ActionResult {
  const o = state.village.obstacles.find((x) => x.id === obstacleId);
  if (!o) return fail('obstacleNotFound');
  if (!Number.isInteger(count) || count < 1) return fail('invalidAmount');
  const max = obstacleDef(o.type, data).work.maxWorkers;
  if (gatherWorkers(state, o.id) + count > max) return fail('tooManyWorkers');
  if (idleWorkers(state).length < count) return fail('buildersBusy');
  const next = deepClone(state);
  assignWorkers(next, count, { kind: 'gathering', targetId: o.id });
  return { ok: true, state: next };
}

/** Calls every worker on a node or animal back; the work done so far stays. */
export function recallWorkers(state: PlayerState, obstacleId: string): ActionResult {
  if (gatherWorkers(state, obstacleId) === 0) return fail('notGathering');
  const next = deepClone(state);
  releaseWorkers(next, gathering(obstacleId));
  return { ok: true, state: next };
}

/**
 * Advances gathering by `seconds` of active play. The client calls this only while
 * the game is open, so nothing progresses offline. Each worker adds one second of
 * work per second; a node with enough work is removed and pays out its yield.
 */
export function advanceWilds(
  state: PlayerState,
  seconds: number,
  now: number,
  data: GameData = gameData,
): { state: PlayerState; gathered: Gathered[]; animals: AnimalDone[] } {
  const busy = state.workers.some((w) => w.task.kind === 'gathering');
  if (seconds <= 0 || !busy) return { state, gathered: [], animals: [] };
  const next = deepClone(state);
  const rng = createRng(next.rngState);
  const gathered: Gathered[] = [];
  for (const o of next.village.obstacles) {
    const crew = gatherWorkers(next, o.id);
    if (crew === 0) continue;
    const def = obstacleDef(o.type, data);
    o.work = Math.min(def.work.workSeconds, o.work + seconds * crew);
    if (o.work < def.work.workSeconds) continue;
    const soulCrystal = rng.chance(def.soulCrystalChance) ? 1 : 0;
    for (const r of VILLAGE_RESOURCES) next.resources[r] += def.yield[r];
    next.resources.soulCrystal += soulCrystal;
    releaseWorkers(next, gathering(o.id));
    gathered.push({
      obstacleId: o.id,
      type: o.type,
      x: o.x,
      y: o.y,
      amount: { ...def.yield },
      soulCrystal,
    });
  }
  const done = new Set(gathered.map((g) => g.obstacleId));
  next.village.obstacles = next.village.obstacles.filter((o) => !done.has(o.id));
  const animals = advanceAnimals(next, seconds, now, data);
  // Workers whose node or animal vanished some other way go back to idle too.
  const alive = new Set([
    ...next.village.obstacles.map((o) => o.id),
    ...next.village.animals.map((a) => a.id),
  ]);
  releaseWorkers(next, (task) => task.kind === 'gathering' && !alive.has(task.targetId));
  next.rngState = rng.getState();
  return { state: next, gathered, animals };
}

/**
 * Wild nodes grow back: every `regrow.stepSeconds` since `village.regrowAt`, each
 * plot rolls each node type's `chancePerStep` and adds one on a free tile while the
 * plot holds fewer than `maxPerPlot`. Deterministic from the saved RNG and the time;
 * at most `regrow.maxSteps` steps are played at once.
 */
export function regrowWilds(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  const { stepSeconds, maxSteps } = data.wilds.regrow;
  const steps = Math.floor((now - state.village.regrowAt) / stepSeconds);
  if (steps <= 0) return state;
  const next = deepClone(state);
  const { village } = next;
  const rng = createRng(next.rngState);
  const n = plotsPerSide(data);
  const { plotSize } = data.village.village;
  const counts = new Map<string, number>();
  const countKey = (px: number, py: number, type: string) => `${px},${py},${type}`;
  for (const o of village.obstacles) {
    const { px, py } = plotOf(o.x, o.y, data);
    const k = countKey(px, py, o.type);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (let step = 0; step < Math.min(steps, maxSteps); step++) {
    for (let px = 0; px < n; px++) {
      for (let py = 0; py < n; py++) {
        for (const def of data.wilds.nodes) {
          if (!rng.chance(def.regrow.chancePerStep)) continue;
          const k = countKey(px, py, def.id);
          if ((counts.get(k) ?? 0) >= def.regrow.maxPerPlot) continue;
          // A few tries for a free tile inside the plot; a crowded plot just skips.
          for (let attempt = 0; attempt < 6; attempt++) {
            const x = px * plotSize + rng.int(0, plotSize - def.size);
            const y = py * plotSize + rng.int(0, plotSize - def.size);
            if (!canPlace(village, def.size, x, y, data)) continue;
            village.obstacles.push({ id: `o${next.nextId}`, type: def.id, x, y, work: 0 });
            next.nextId += 1;
            counts.set(k, (counts.get(k) ?? 0) + 1);
            break;
          }
        }
      }
    }
  }
  village.regrowAt += steps * stepSeconds;
  next.rngState = rng.getState();
  return next;
}
