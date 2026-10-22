import { deepClone } from './clone';
import { gameData, VILLAGE_RESOURCES, type GameData, type IslandDef } from './data';
import { createRng } from './rng';
import type { ActionError, ActionResult, PlayerState } from './state';
import { canPay, createIslandVillage, townHallLevel } from './village';

export type IslandStatus = 'current' | 'open' | 'buyable' | 'townHall';

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export function islandDef(id: string, data: GameData = gameData): IslandDef | undefined {
  return data.islands.islands.find((i) => i.id === id);
}

/** Where an island stands for the player: being played, opened, can be opened, or not yet. */
export function islandStatus(
  state: PlayerState,
  id: string,
  data: GameData = gameData,
): IslandStatus {
  if (state.island === id) return 'current';
  if (state.islands[id]) return 'open';
  const def = islandDef(id, data);
  return def && townHallLevel(state, data) >= def.requiresTownHall ? 'buyable' : 'townHall';
}

/** Opens a new island (Balai level and its price): an empty village with its own wilds. */
export function unlockIsland(
  state: PlayerState,
  id: string,
  now: number,
  data: GameData = gameData,
): ActionResult {
  const def = islandDef(id, data);
  if (!def) return fail('entryNotFound');
  const status = islandStatus(state, id, data);
  if (status === 'current' || status === 'open') return fail('alreadyFinished');
  if (status === 'townHall') return fail('townHallTooLow');
  const unpaid = canPay(state, def.cost);
  if (unpaid) return fail(unpaid);
  const next = deepClone(state);
  for (const r of VILLAGE_RESOURCES) next.resources[r] -= def.cost[r];
  const rng = createRng(next.rngState);
  next.islands[id] = createIslandVillage(rng, now, () => `o${next.nextId++}`, def.nodes, data);
  next.rngState = rng.getState();
  return { ok: true, state: next };
}

/**
 * Goes to another opened island. Resources, workers, monsters and soldiers are shared;
 * teams out fighting or a raid under way keep the player where they are.
 */
export function travelTo(state: PlayerState, id: string, data: GameData = gameData): ActionResult {
  const status = islandStatus(state, id, data);
  if (status === 'current') return fail('alreadyFinished');
  if (status !== 'open') return fail('notUnlocked');
  if (state.missions.length > 0) return fail('teamsAway');
  const next = deepClone(state);
  next.islands[state.island] = next.village;
  next.village = next.islands[id]!;
  delete next.islands[id];
  next.island = id;
  // Monsters and soldiers arrive fresh by the Kandang (or the middle of the island).
  next.units = {};
  return { ok: true, state: next };
}
