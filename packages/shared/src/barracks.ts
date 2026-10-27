import { deepClone } from './clone';
import { gameData, type ElementId, type FormId, type GameData } from './data';
import { monsterKey, type Monster } from './monster';
import type { Rng } from './rng';
import type { ActionError, ActionResult, PlayerState } from './state';
import { recordAction } from './player';
import { populationFree } from './workers';
import { allBuildings, hasFeature } from './village';

/** A human soldier from one of the three barracks (Tugas 1A.13). `rank` is 0-based. */
export interface Soldier {
  id: string;
  kind: string;
  rank: number;
}

export type SoldierKind = Pick<Soldier, 'kind' | 'rank'>;

/** A soldier being trained in one barracks; each barracks trains one at a time. */
export interface BarracksTraining extends SoldierKind {
  buildingId: string;
  endsAt: number;
}

/** An unhatched monster egg; the monster inside is rolled when the egg is made. */
export interface Egg {
  id: string;
  form: FormId;
  element: ElementId;
  readyAt: number;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export type SoldierDef = GameData['rules']['barracks']['soldiers'][number];

export function soldierDef(kind: string, data: GameData = gameData): SoldierDef {
  const def = data.rules.barracks.soldiers.find((s) => s.id === kind);
  if (!def) throw new Error(`Prajurit tidak dikenal: ${kind}`);
  return def;
}

function rankDef(rank: number, data: GameData) {
  const def = data.rules.barracks.ranks[rank];
  if (!def) throw new Error(`Pangkat tidak dikenal: ${rank}`);
  return def;
}

/** The soldier kind a barracks building trains, if it is one. */
export function soldierKindOf(type: string, data: GameData = gameData): SoldierDef | undefined {
  const b = data.buildingById.get(type);
  if (b?.feature !== 'barracks' || !b.trainsSoldier) return undefined;
  return soldierDef(b.trainsSoldier, data);
}

/** How many ranks a barracks of this level has opened (rank n opens at level n). */
export function unlockedRanks(level: number, data: GameData = gameData): number {
  return Math.max(0, Math.min(level, data.rules.barracks.ranks.length));
}

/** Power points (and population slots) of a soldier: base points + rank bonus. */
export function soldierPower(s: SoldierKind, data: GameData = gameData): number {
  return soldierDef(s.kind, data).powerPoints + rankDef(s.rank, data).powerBonus;
}

/** Battle stats: hp/atk/def grow with rank; speed and range do not. */
export function soldierStats(s: SoldierKind, data: GameData = gameData) {
  const { stats } = soldierDef(s.kind, data);
  const k = rankDef(s.rank, data).statMultiplier;
  return {
    hp: Math.round(stats.hp * k),
    atk: Math.round(stats.atk * k),
    def: Math.round(stats.def * k),
    spd: stats.spd,
    range: stats.range,
  };
}

/** Gold, food and seconds to train one soldier of this kind and rank. */
export function soldierTrainCost(s: SoldierKind, data: GameData = gameData) {
  const { train } = soldierDef(s.kind, data);
  const r = rankDef(s.rank, data);
  return {
    gold: Math.round(train.gold * r.costMultiplier),
    food: Math.round(train.food * r.costMultiplier),
    seconds: Math.round(train.seconds * r.timeMultiplier),
  };
}

/** Player-facing name, e.g. "Pemanah Veteran". */
export function soldierName(s: SoldierKind, data: GameData = gameData): string {
  return `${soldierDef(s.kind, data).name} ${rankDef(s.rank, data).name}`;
}

/** Soldiers a barracks can queue at once: the base limit plus its levels' queue bonuses. */
export function barracksQueueMax(type: string, level: number, data: GameData = gameData): number {
  const levels = data.buildingById.get(type)?.levels ?? [];
  return levels
    .slice(0, level)
    .reduce((max, l) => max + (l.queueBonus ?? 0), data.rules.barracks.queueMax);
}

export function barracksQueue(state: PlayerState, buildingId: string): BarracksTraining[] {
  return state.barracksQueue.filter((e) => e.buildingId === buildingId);
}

/** Seconds until the next soldier of a barracks is ready (null when it is idle). */
export function barracksRemaining(
  state: PlayerState,
  buildingId: string,
  now: number,
): number | null {
  const first = barracksQueue(state, buildingId)[0];
  return first ? Math.max(0, first.endsAt - now) : null;
}

/** Finished soldiers join the village (same object when nothing finished). */
export function settleBarracks(state: PlayerState, now: number): PlayerState {
  if (!state.barracksQueue.some((e) => e.endsAt <= now)) return state;
  const next = deepClone(state);
  for (const e of next.barracksQueue.filter((x) => x.endsAt <= now)) {
    next.soldiers.push({ id: `s${next.nextId}`, kind: e.kind, rank: e.rank });
    next.nextId += 1;
  }
  next.barracksQueue = next.barracksQueue.filter((e) => e.endsAt > now);
  return next;
}

/**
 * Queues a soldier of the barracks' kind at a rank its level has opened. It costs gold
 * and food and takes its population slots (its power points) right away.
 */
export function trainSoldier(
  state: PlayerState,
  params: { buildingId: string; rank: number },
  now: number,
  data: GameData = gameData,
): ActionResult<{ endsAt: number }> {
  const s = settleBarracks(state, now);
  const b = s.village.buildings.find((x) => x.id === params.buildingId);
  if (!b) return fail('buildingNotFound');
  const def = soldierKindOf(b.type, data);
  if (!def) return fail('notBarracks');
  if (b.level < 1) return fail('underConstruction');
  if (
    !Number.isInteger(params.rank) ||
    params.rank < 0 ||
    params.rank >= unlockedRanks(b.level, data)
  ) {
    return fail('notUnlocked');
  }
  const kind = { kind: def.id, rank: params.rank };
  const queue = barracksQueue(s, b.id);
  if (queue.length >= barracksQueueMax(b.type, b.level, data)) return fail('trainingQueueFull');
  if (populationFree(s, data) < soldierPower(kind, data)) return fail('populationFull');
  const cost = soldierTrainCost(kind, data);
  if (s.resources.gold < cost.gold) return fail('notEnoughGold');
  if (s.resources.food < cost.food) return fail('notEnoughFood');
  const next = s === state ? deepClone(s) : s;
  next.resources.gold -= cost.gold;
  next.resources.food -= cost.food;
  const endsAt = Math.max(now, queue[queue.length - 1]?.endsAt ?? now) + cost.seconds;
  next.barracksQueue.push({ ...kind, buildingId: b.id, endsAt });
  return { ok: true, state: next, endsAt };
}

/** Sum of the levels of every finished soldier barracks. */
export function combinedBarracksLevel(state: PlayerState, data: GameData = gameData): number {
  return allBuildings(state)
    .filter((b) => data.buildingById.get(b.type)?.feature === 'barracks')
    .reduce((sum, b) => sum + b.level, 0);
}

/** Power points a Serbu army may field: grows with the combined barracks level (Tugas 1.4). */
export function serbuPowerCap(state: PlayerState, data: GameData = gameData): number {
  const table = data.rules.battle.powerCapByCombinedBarracksLevel;
  return table[Math.min(combinedBarracksLevel(state, data), table.length - 1)]!;
}

// ---------- Eggs ----------

/** A fresh egg with a random tier-1 form and base element, ready at `readyAt`. */
export function rollEgg(rng: Rng, id: string, readyAt: number, data: GameData = gameData): Egg {
  const tier1 = data.formsByTier.get(data.formTiers[0]!) ?? [];
  return {
    id,
    form: rng.pick(tier1).id,
    element: rng.pick(data.baseUnits) as ElementId,
    readyAt,
  };
}

/** Hatches a ready egg into a baby monster; it needs room for the monster's slots. */
export function hatchEgg(
  state: PlayerState,
  eggId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ monster: Monster }> {
  const egg = state.eggs.find((e) => e.id === eggId);
  if (!egg) return fail('entryNotFound');
  if (!hasFeature(state, 'nest', data)) return fail('noNest');
  if (egg.readyAt > now) return fail('notReady');
  const slots = data.rules.battle.powerPoints[String(data.formTiers[0]!)] ?? 1;
  if (populationFree(state, data) < slots) return fail('populationFull');
  const next = deepClone(state);
  const monster: Monster = {
    id: `m${next.nextId}`,
    form: egg.form,
    element: egg.element,
    stage: data.rules.growth.stages[0]!.id,
    food: 0,
  };
  next.nextId += 1;
  next.monsters.push(monster);
  const key = monsterKey(monster);
  if (!next.pedia.monsters.includes(key)) next.pedia.monsters.push(key);
  next.eggs = next.eggs.filter((e) => e.id !== eggId);
  recordAction(next, 'hatch', 1, data);
  return { ok: true, state: next, monster };
}
