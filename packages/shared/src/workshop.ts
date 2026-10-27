import type { Fighter } from './battle';
import { deepClone } from './clone';
import { gameData, type GameData } from './data';
import type { ActionError, ActionResult, PlayerState } from './state';
import { allBuildings } from './village';
import { populationFree } from './workers';

// Bengkel and its war machines (Tugas 1C.7).

/** A war machine for Serbu and Petualangan. Its version follows the Bengkel level. */
export interface Machine {
  id: string;
  kind: string;
}

/** A machine being built in a Bengkel; each Bengkel builds one at a time. */
export interface WorkshopBuild {
  kind: string;
  buildingId: string;
  endsAt: number;
}

export type MachineDef = GameData['rules']['workshop']['machines'][number];

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export function machineDef(kind: string, data: GameData = gameData): MachineDef {
  const def = data.rules.workshop.machines.find((m) => m.id === kind);
  if (!def) throw new Error(`Mesin perang tidak dikenal: ${kind}`);
  return def;
}

/** Highest finished Bengkel level on any island (0 when there is none): every machine's version. */
export function workshopLevel(state: PlayerState, data: GameData = gameData): number {
  const { building } = data.rules.workshop;
  return allBuildings(state)
    .filter((b) => b.type === building)
    .reduce((best, b) => Math.max(best, b.level), 0);
}

/** Index of the machine version for a Bengkel level (level 0 counts as the first version). */
function versionIndex(level: number, data: GameData): number {
  const n = data.rules.workshop.versionMultiplier.length;
  return Math.min(Math.max(1, level), n) - 1;
}

/** Player-facing name of a machine at a Bengkel level, e.g. "Ketapel Api". */
export function machineName(kind: string, level: number, data: GameData = gameData): string {
  return machineDef(kind, data).names[versionIndex(level, data)]!;
}

/** Battle stats at a Bengkel level: hp, atk and def grow with the version; speed and range do not. */
export function machineStats(kind: string, level: number, data: GameData = gameData) {
  const { stats } = machineDef(kind, data);
  const k = data.rules.workshop.versionMultiplier[versionIndex(level, data)]!;
  return {
    hp: Math.round(stats.hp * k),
    atk: Math.round(stats.atk * k),
    def: Math.round(stats.def * k),
    spd: stats.spd,
    range: stats.range,
  };
}

/** Power points (and population slots) of a machine. */
export function machinePower(kind: string, data: GameData = gameData): number {
  return machineDef(kind, data).powerPoints;
}

/** A machine as a fighter: strong against buildings, the Pendobrak hits nothing else. */
export function machineFighter(m: Machine, level: number, data: GameData = gameData): Fighter {
  const def = machineDef(m.kind, data);
  return {
    id: m.id,
    stats: machineStats(m.kind, level, data),
    element: null,
    skill: false,
    siege: { multiplier: def.buildingMultiplier, buildingsOnly: def.buildingsOnly },
  };
}

/** Machines a Bengkel can queue at once: the base limit plus its levels' queue bonuses. */
export function workshopQueueMax(level: number, data: GameData = gameData): number {
  const levels = data.buildingById.get(data.rules.workshop.building)?.levels ?? [];
  return levels
    .slice(0, level)
    .reduce((max, l) => max + (l.queueBonus ?? 0), data.rules.workshop.queueMax);
}

export function workshopQueue(state: PlayerState, buildingId: string): WorkshopBuild[] {
  return state.workshopQueue.filter((e) => e.buildingId === buildingId);
}

/** Finished machines join the army (same object when nothing finished). */
export function settleWorkshop(state: PlayerState, now: number): PlayerState {
  if (!state.workshopQueue.some((e) => e.endsAt <= now)) return state;
  const next = deepClone(state);
  for (const e of next.workshopQueue.filter((x) => x.endsAt <= now)) {
    next.machines.push({ id: `w${next.nextId}`, kind: e.kind });
    next.nextId += 1;
  }
  next.workshopQueue = next.workshopQueue.filter((e) => e.endsAt > now);
  return next;
}

/**
 * Queues a machine in a finished Bengkel. It costs gold, wood and stone and takes its
 * population slots (its power points) right away.
 */
export function buildMachine(
  state: PlayerState,
  params: { buildingId: string; kind: string },
  now: number,
  data: GameData = gameData,
): ActionResult<{ endsAt: number }> {
  const s = settleWorkshop(state, now);
  const b = s.village.buildings.find((x) => x.id === params.buildingId);
  if (!b) return fail('buildingNotFound');
  if (b.type !== data.rules.workshop.building) return fail('notWorkshop');
  if (b.level < 1) return fail('underConstruction');
  const def = data.rules.workshop.machines.find((m) => m.id === params.kind);
  if (!def) return fail('notUnlocked');
  const queue = workshopQueue(s, b.id);
  if (queue.length >= workshopQueueMax(b.level, data)) return fail('trainingQueueFull');
  if (populationFree(s, data) < def.powerPoints) return fail('populationFull');
  const { build } = def;
  if (s.resources.gold < build.gold) return fail('notEnoughGold');
  if (s.resources.food < build.food) return fail('notEnoughFood');
  if (s.resources.wood < build.wood) return fail('notEnoughWood');
  if (s.resources.stone < build.stone) return fail('notEnoughStone');
  const next = s === state ? deepClone(s) : s;
  next.resources.gold -= build.gold;
  next.resources.food -= build.food;
  next.resources.wood -= build.wood;
  next.resources.stone -= build.stone;
  const endsAt = Math.max(now, queue[queue.length - 1]?.endsAt ?? now) + build.seconds;
  next.workshopQueue.push({ kind: def.id, buildingId: b.id, endsAt });
  return { ok: true, state: next, endsAt };
}
