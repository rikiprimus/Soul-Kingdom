import { soldierPower } from './barracks';
import { deepClone } from './clone';
import { allBuildings } from './village';
import { gameData, type GameData } from './data';
import { formTierOf, type MonsterKind } from './monster';
import type { ActionError, ActionResult, PlayerState } from './state';

/** What a worker is doing. Gathering and staffed jobs arrive with Tugas 1A.6–1A.7. */
export type WorkerTask =
  | { kind: 'idle' }
  | { kind: 'building'; buildingId: string }
  | { kind: 'gathering'; targetId: string }
  | { kind: 'staffed'; buildingId: string };

export interface Worker {
  id: string;
  task: WorkerTask;
}

/** A worker in training at the Balai Utama; the queue trains one at a time. */
export interface WorkerTraining {
  endsAt: number;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

// ---------- Population ----------

/** Population slots a monster takes: its form tier's power points (babies count as adults). */
export function monsterSlots(kind: MonsterKind, data: GameData = gameData): number {
  return data.rules.battle.powerPoints[String(formTierOf(kind, data))] ?? 1;
}

/** Maximum population from every finished building with `population` (Balai, Rumah). */
export function populationCap(state: PlayerState, data: GameData = gameData): number {
  let total = 0;
  for (const b of allBuildings(state)) {
    if (b.level < 1) continue;
    total += data.buildingById.get(b.type)?.levels[b.level - 1]?.population ?? 0;
  }
  return total;
}

/** Slots used by workers, soldiers (also those in training) and monsters. */
export function populationUsed(state: PlayerState, data: GameData = gameData): number {
  const { workerSlots } = data.rules.population;
  const workers = (state.workers.length + state.workerTraining.length) * workerSlots;
  const soldiers = [...state.soldiers, ...state.barracksQueue].reduce(
    (sum, s) => sum + soldierPower(s, data),
    0,
  );
  return workers + soldiers + state.monsters.reduce((sum, m) => sum + monsterSlots(m, data), 0);
}

export function populationFree(state: PlayerState, data: GameData = gameData): number {
  return populationCap(state, data) - populationUsed(state, data);
}

/** Whether a new monster of this kind fits in the village. */
export function hasRoomFor(kind: MonsterKind, state: PlayerState, data: GameData = gameData) {
  return populationFree(state, data) >= monsterSlots(kind, data);
}

// ---------- Workers ----------

export function idleWorkers(state: PlayerState): Worker[] {
  return state.workers.filter((w) => w.task.kind === 'idle');
}

/** Gives `count` idle workers a task (mutates `state`); null when too few are idle. */
export function assignWorkers(
  state: PlayerState,
  count: number,
  task: WorkerTask,
): string[] | null {
  const idle = idleWorkers(state);
  if (idle.length < count) return null;
  return idle.slice(0, count).map((w) => {
    w.task = { ...task };
    return w.id;
  });
}

/** Sends every worker whose task matches back to idle (mutates `state`); returns how many. */
export function releaseWorkers(state: PlayerState, match: (task: WorkerTask) => boolean): number {
  let released = 0;
  for (const w of state.workers) {
    if (w.task.kind === 'idle' || !match(w.task)) continue;
    w.task = { kind: 'idle' };
    released += 1;
  }
  return released;
}

export function createWorkers(state: PlayerState, count: number): void {
  for (let i = 0; i < count; i++) {
    state.workers.push({ id: `w${state.nextId}`, task: { kind: 'idle' } });
    state.nextId += 1;
  }
}

/** Seconds until the next worker in training is ready (null when nobody is training). */
export function trainingRemaining(state: PlayerState, now: number): number | null {
  const first = state.workerTraining[0];
  return first ? Math.max(0, first.endsAt - now) : null;
}

/** Trained workers join the village (returns the same object when nothing finished). */
export function settleTraining(state: PlayerState, now: number): PlayerState {
  const done = state.workerTraining.filter((e) => e.endsAt <= now).length;
  if (done === 0) return state;
  const next = deepClone(state);
  next.workerTraining = next.workerTraining.slice(done);
  createWorkers(next, done);
  return next;
}

/** Queue a new worker at the Balai Utama: costs food and a free population slot. */
export function trainWorker(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): ActionResult<{ endsAt: number }> {
  const s = settleTraining(state, now);
  const { trainFood, trainSeconds, trainQueueMax } = data.rules.workers;
  if (s.workerTraining.length >= trainQueueMax) return fail('trainingQueueFull');
  if (populationFree(s, data) < data.rules.population.workerSlots) return fail('populationFull');
  if (s.resources.food < trainFood) return fail('notEnoughFood');
  const next = s === state ? deepClone(s) : s;
  next.resources.food -= trainFood;
  const last = next.workerTraining[next.workerTraining.length - 1];
  const endsAt = Math.max(now, last?.endsAt ?? now) + trainSeconds;
  next.workerTraining.push({ endsAt });
  return { ok: true, state: next, endsAt };
}

// ---------- Monsters ----------

/** Let a monster go to free its population slots. Monsters in the Soul Mixer stay. */
export function releaseMonster(state: PlayerState, monsterId: string): ActionResult {
  if (!state.monsters.some((m) => m.id === monsterId)) return fail('monsterNotFound');
  if (state.mixQueue.some((e) => e.parents.some((p) => p.id === monsterId))) {
    return fail('parentBusy');
  }
  if (state.missions.some((m) => m.monsterIds.includes(monsterId))) return fail('monsterBusy');
  const next = deepClone(state);
  next.monsters = next.monsters.filter((m) => m.id !== monsterId);
  return { ok: true, state: next };
}
