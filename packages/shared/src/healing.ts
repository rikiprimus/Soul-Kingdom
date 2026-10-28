import { soldierStats } from './barracks';
import type { Fighter } from './battle';
import { deepClone } from './clone';
import { gameData, type GameData } from './data';
import { isOnMission } from './missions';
import { monsterStats } from './monster';
import { currentRaid } from './raids';
import { speedUpCost, type ActionError, type ActionResult, type PlayerState } from './state';
import { allBuildings, levelDef } from './village';

// Pohon Jiwa and healing (Tugas 1C.10).

/**
 * Wounds of the living monsters and soldiers, as the share of max HP lost (0–1, missing =
 * full HP), healed once a minute from `at`.
 */
export interface Healing {
  at: number;
  wounds: Record<string, number>;
}

const EPS = 1e-9;
const MINUTE = 60;

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

/** Highest finished Pohon Jiwa level on any island (0 when there is none). */
export function healingTreeLevel(state: PlayerState, data: GameData = gameData): number {
  return allBuildings(state)
    .filter((b) => data.buildingById.get(b.type)?.feature === 'healing')
    .reduce((best, b) => Math.max(best, b.level), 0);
}

/** % of max HP every wounded unit heals per minute: the Pohon Jiwa's rate, or the base one. */
export function healPercentPerMinute(state: PlayerState, data: GameData = gameData): number {
  const level = healingTreeLevel(state, data);
  const tree = allBuildings(state).find(
    (b) => b.level === level && data.buildingById.get(b.type)?.feature === 'healing',
  );
  const rate = tree ? levelDef(tree.type, level, data)?.healPercentPerMinute : undefined;
  return rate ?? data.rules.healing.basePercentPerMinute;
}

/** Max HP of a monster or soldier (undefined for any other id). */
export function unitMaxHp(
  state: PlayerState,
  id: string,
  data: GameData = gameData,
): number | undefined {
  const m = state.monsters.find((x) => x.id === id);
  if (m) return monsterStats(m, data).hp;
  const s = state.soldiers.find((x) => x.id === id);
  if (s) return soldierStats(s, data).hp;
  return undefined;
}

/** Share of max HP a unit has lost (0 = unhurt). */
export function woundOf(state: PlayerState, id: string): number {
  return state.healing.wounds[id] ?? 0;
}

/** HP a unit has right now (whole HP, at least 1 for a living unit). */
export function unitHp(state: PlayerState, id: string, data: GameData = gameData): number {
  const max = unitMaxHp(state, id, data) ?? 0;
  return Math.max(1, Math.round(max * (1 - woundOf(state, id))));
}

/** The fighter, starting the battle with the HP its wounds left it. */
export function withWounds(state: PlayerState, f: Fighter): Fighter {
  const wound = woundOf(state, f.id);
  return wound > 0 ? { ...f, startHp: Math.max(1, f.stats.hp * (1 - wound)) } : f;
}

/**
 * Keeps what a fight left: `hpLeft` is the share of max HP per fighter id (0 = fallen).
 * Only monsters and soldiers keep wounds; the fallen and the unhurt have none. Mutates `next`.
 */
export function setWounds(
  next: PlayerState,
  hpLeft: Readonly<Record<string, number>>,
  now: number,
): void {
  const { healing } = next;
  // Healing restarts its minute clock when the first wound comes in.
  if (Object.keys(healing.wounds).length === 0) healing.at = now;
  for (const [id, left] of Object.entries(hpLeft)) {
    const known = next.monsters.some((m) => m.id === id) || next.soldiers.some((s) => s.id === id);
    if (!known) continue;
    const wound = 1 - left;
    if (left <= 0 || wound <= EPS) delete healing.wounds[id];
    else healing.wounds[id] = Math.min(1, wound);
  }
}

/** Wounded units that can heal now: alive and not out fighting. */
export function healableIds(state: PlayerState): string[] {
  return Object.keys(state.healing.wounds).filter(
    (id) =>
      (state.monsters.some((m) => m.id === id) || state.soldiers.some((s) => s.id === id)) &&
      !isOnMission(state, id),
  );
}

/**
 * Heals every wounded unit by `healPercentPerMinute` for each whole minute since
 * `healing.at`. Nothing heals while the village is being raided, nor units out on a
 * fight; wounds of units that are gone are dropped. Same object when nothing changed.
 */
export function settleHealing(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  const { at, wounds } = state.healing;
  if (Object.keys(wounds).length === 0) return state;
  const minutes = Math.floor((now - at) / MINUTE);
  if (minutes <= 0) return state;
  const next = deepClone(state);
  next.healing.at = at + minutes * MINUTE;
  if (currentRaid(next)) return next;
  const healed = (minutes * healPercentPerMinute(next, data)) / 100;
  const healable = new Set(healableIds(next));
  for (const id of Object.keys(next.healing.wounds)) {
    const alive = next.monsters.some((m) => m.id === id) || next.soldiers.some((s) => s.id === id);
    if (!alive) {
      delete next.healing.wounds[id];
      continue;
    }
    if (!healable.has(id)) continue;
    const wound = next.healing.wounds[id]! - healed;
    if (wound <= EPS) delete next.healing.wounds[id];
    else next.healing.wounds[id] = wound;
  }
  return next;
}

/** Seconds until a unit is fully healed at the current rate (0 when unhurt). */
export function healSeconds(
  state: PlayerState,
  id: string,
  now: number,
  data: GameData = gameData,
): number {
  const wound = woundOf(state, id);
  if (wound <= 0) return 0;
  const minutes = Math.ceil((wound * 100) / healPercentPerMinute(state, data) - EPS);
  return Math.max(0, state.healing.at + minutes * MINUTE - now);
}

/** Food and gold to heal these units at once: per HP lost. */
export function healCost(
  state: PlayerState,
  ids: readonly string[],
  data: GameData = gameData,
): { food: number; gold: number } {
  const hp = ids.reduce(
    (sum, id) => sum + (unitMaxHp(state, id, data) ?? 0) * woundOf(state, id),
    0,
  );
  const { foodPerHp, goldPerHp } = data.rules.healing;
  return { food: Math.ceil(hp * foodPerHp), gold: Math.ceil(hp * goldPerHp) };
}

/** Gems for "Sembuhkan semua": the speed-up price of the longest wait left. */
export function healAllGems(state: PlayerState, now: number, data: GameData = gameData): number {
  const longest = healableIds(state).reduce(
    (most, id) => Math.max(most, healSeconds(state, id, now, data)),
    0,
  );
  return speedUpCost(longest, data);
}

function healNow(next: PlayerState, ids: readonly string[]): void {
  for (const id of ids) delete next.healing.wounds[id];
}

/**
 * Heals wounded units to full at once with food and gold (`ids`, or every one that can
 * heal). Not while the village is being raided, nor units out on a fight.
 */
export function healWithFood(
  state: PlayerState,
  params: { ids?: string[] },
  data: GameData = gameData,
): ActionResult<{ healed: string[]; food: number; gold: number }> {
  if (currentRaid(state)) return fail('underAttack');
  const healable = healableIds(state);
  const ids = params.ids ? params.ids.filter((id) => healable.includes(id)) : healable;
  if (params.ids?.some((id) => isOnMission(state, id))) return fail('monsterBusy');
  if (ids.length === 0) return fail('notWounded');
  const cost = healCost(state, ids, data);
  if (state.resources.food < cost.food) return fail('notEnoughFood');
  if (state.resources.gold < cost.gold) return fail('notEnoughGold');
  const next = deepClone(state);
  next.resources.food -= cost.food;
  next.resources.gold -= cost.gold;
  healNow(next, ids);
  return { ok: true, state: next, healed: ids, ...cost };
}

/** "Sembuhkan semua" at the Pohon Jiwa: every unit that can heal, for gems (a speed-up). */
export function healAllWithGems(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): ActionResult<{ healed: string[]; gems: number }> {
  if (healingTreeLevel(state, data) < 1) return fail('noHealingTree');
  if (currentRaid(state)) return fail('underAttack');
  const ids = healableIds(state);
  if (ids.length === 0) return fail('notWounded');
  const gems = healAllGems(state, now, data);
  if (state.resources.gems < gems) return fail('notEnoughGems');
  const next = deepClone(state);
  next.resources.gems -= gems;
  healNow(next, ids);
  return { ok: true, state: next, healed: ids, gems };
}
