import { deepClone } from './clone';
import { gameData, type ElementId, type FormId, type GameData } from './data';
import { monsterKey, type Monster } from './monster';
import type { ActionError, ActionResult, PlayerState } from './state';
import { hasRoomFor } from './workers';

/** A soldier being trained in one barracks; each barracks trains one at a time. */
export interface BarracksTraining {
  buildingId: string;
  form: FormId;
  element: ElementId;
  endsAt: number;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

/** What a finished barracks of this level can train: tier-1 forms of its role, base elements. */
export function trainingOptions(
  type: string,
  level: number,
  data: GameData = gameData,
): { forms: FormId[]; elements: ElementId[] } {
  const role = data.buildingById.get(type)?.trainsRole;
  const unlock = data.rules.barracks.unlocksByLevel[level - 1];
  if (!role || !unlock || level < 1) return { forms: [], elements: [] };
  const tier1 = data.formsByTier.get(data.formTiers[0]!) ?? [];
  const forms = tier1.filter((f) => f.role === role).slice(0, unlock.forms);
  return { forms: forms.map((f) => f.id), elements: [...unlock.elements] };
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

/** Finished soldiers join the village as adults (same object when nothing finished). */
export function settleBarracks(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  if (!state.barracksQueue.some((e) => e.endsAt <= now)) return state;
  const next = deepClone(state);
  const adult = data.rules.growth.stages[data.rules.growth.stages.length - 1]!.id;
  for (const e of next.barracksQueue.filter((x) => x.endsAt <= now)) {
    const monster: Monster = {
      id: `m${next.nextId}`,
      form: e.form,
      element: e.element,
      stage: adult,
      food: 0,
    };
    next.nextId += 1;
    next.monsters.push(monster);
    const key = monsterKey(monster);
    if (!next.pedia.monsters.includes(key)) next.pedia.monsters.push(key);
  }
  next.barracksQueue = next.barracksQueue.filter((e) => e.endsAt > now);
  return next;
}

/**
 * Queues a basic soldier (tier-1 form of the barracks' role, base element) that is
 * born an adult. It costs gold and food and takes its population slot right away.
 */
export function trainSoldier(
  state: PlayerState,
  params: { buildingId: string; form: FormId; element: ElementId },
  now: number,
  data: GameData = gameData,
): ActionResult<{ endsAt: number }> {
  const s = settleBarracks(state, now, data);
  const b = s.village.buildings.find((x) => x.id === params.buildingId);
  if (!b) return fail('buildingNotFound');
  if (data.buildingById.get(b.type)?.feature !== 'barracks') return fail('notBarracks');
  if (b.level < 1) return fail('underConstruction');
  const options = trainingOptions(b.type, b.level, data);
  if (!options.forms.includes(params.form) || !options.elements.includes(params.element)) {
    return fail('notUnlocked');
  }
  const { train, queueMax } = data.rules.barracks;
  const queue = barracksQueue(s, b.id);
  if (queue.length >= queueMax) return fail('trainingQueueFull');
  if (!hasRoomFor(params, s, data)) return fail('populationFull');
  if (s.resources.gold < train.gold) return fail('notEnoughGold');
  if (s.resources.food < train.food) return fail('notEnoughFood');
  const next = s === state ? deepClone(s) : s;
  next.resources.gold -= train.gold;
  next.resources.food -= train.food;
  const endsAt = Math.max(now, queue[queue.length - 1]?.endsAt ?? now) + train.seconds;
  next.barracksQueue.push({ ...params, buildingId: b.id, endsAt });
  return { ok: true, state: next, endsAt };
}

/** Sum of the levels of every finished barracks (Barak, Arena Petarung, Lapangan Panah). */
export function combinedBarracksLevel(state: PlayerState, data: GameData = gameData): number {
  return state.village.buildings
    .filter((b) => data.buildingById.get(b.type)?.feature === 'barracks')
    .reduce((sum, b) => sum + b.level, 0);
}

/** Power points a Serbu army may field: grows with the combined barracks level (Tugas 1.4). */
export function serbuPowerCap(state: PlayerState, data: GameData = gameData): number {
  const table = data.rules.battle.powerCapByCombinedBarracksLevel;
  return table[Math.min(combinedBarracksLevel(state, data), table.length - 1)]!;
}
