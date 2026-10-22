import { deepClone } from './clone';
import { gameData, type GameData } from './data';
import type { ActionError, ActionResult, PlayerState } from './state';
import {
  bankProduction,
  buildingDef,
  canPlace,
  countBuildings,
  isAreaUnlocked,
  maxCountFor,
  sizeOf,
} from './village';

/** A decoration or Keajaiban kept in the Gudang, placed again with its level and facing. */
export interface StoredItem {
  id: string;
  type: string;
  level: number;
  flipped: boolean;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

/** Decorations and Keajaiban can go to the Gudang; monsters and other buildings cannot. */
export function isStorable(type: string, data: GameData = gameData): boolean {
  const def = buildingDef(type, data);
  return def.category === 'dekorasi' || def.feature === 'wonder';
}

/** Adds a new item to the Gudang of a state being built (mutates it). */
export function addToStorage(state: PlayerState, type: string, level = 1): void {
  state.storage.push({ id: `g${state.nextId}`, type, level, flipped: false });
  state.nextId += 1;
}

/** Mirrors a building (two facings); walls join up by neighbours, so they do not turn. */
export function rotateBuilding(
  state: PlayerState,
  buildingId: string,
  data: GameData = gameData,
): ActionResult {
  const b = state.village.buildings.find((x) => x.id === buildingId);
  if (!b) return fail('buildingNotFound');
  if (buildingDef(b.type, data).lineBuild) return fail('cannotRotate');
  const next = deepClone(state);
  const nb = next.village.buildings.find((x) => x.id === buildingId)!;
  nb.flipped = !b.flipped;
  return { ok: true, state: next };
}

/** Takes a decoration or Keajaiban off the map into the Gudang (a Keajaiban's output is collected first). */
export function storeBuilding(
  state: PlayerState,
  buildingId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ itemId: string; collected: number }> {
  const b = state.village.buildings.find((x) => x.id === buildingId);
  if (!b) return fail('buildingNotFound');
  if (!isStorable(b.type, data)) return fail('notStorable');
  if (b.construction) return fail('underConstruction');
  const next = deepClone(state);
  const nb = next.village.buildings.find((x) => x.id === buildingId)!;
  const collected = bankProduction(next, nb, now, data);
  next.village.buildings = next.village.buildings.filter((x) => x.id !== buildingId);
  const itemId = `g${next.nextId}`;
  next.nextId += 1;
  next.storage.push({ id: itemId, type: b.type, level: b.level, flipped: !!b.flipped });
  return { ok: true, state: next, itemId, collected };
}

/** Places a Gudang item on free, open land, at its level and facing, at once and for free. */
export function placeStored(
  state: PlayerState,
  params: { itemId: string; x: number; y: number },
  now: number,
  data: GameData = gameData,
): ActionResult<{ buildingId: string }> {
  const item = state.storage.find((i) => i.id === params.itemId);
  if (!item) return fail('entryNotFound');
  const size = sizeOf(item.type, data);
  if (!isAreaUnlocked(state.village, size, params.x, params.y, data)) return fail('plotLocked');
  if (!canPlace(state.village, size, params.x, params.y, data)) return fail('blocked');
  if (countBuildings(state, item.type) >= maxCountFor(state, item.type, data)) {
    return fail('maxCountReached');
  }
  const next = deepClone(state);
  const buildingId = `b${next.nextId}`;
  next.nextId += 1;
  next.village.buildings.push({
    id: buildingId,
    type: item.type,
    x: params.x,
    y: params.y,
    level: item.level,
    construction: null,
    lastCollectAt: now,
    crop: null,
    ...(item.flipped ? { flipped: true } : {}),
  });
  next.storage = next.storage.filter((i) => i.id !== item.id);
  return { ok: true, state: next, buildingId };
}
