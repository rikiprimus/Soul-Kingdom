import { deepClone } from './clone';
import { gameData, type CollectionSet, type GameData, type Prize } from './data';
import { parseMonsterKey } from './monster';
import { addSoulEggs } from './nest';
import { payReward } from './serbu';
import { addToStorage } from './storage';
import type { ActionError, ActionResult, PlayerState } from './state';
import { allBuildings } from './village';

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export interface SetItem {
  kind: 'form' | 'element';
  id: string;
  found: boolean;
}

/** What a set asks for, each marked found when the Monsterpedia has it. */
export function setProgress(state: PlayerState, set: CollectionSet, data: GameData = gameData) {
  const kinds = state.pedia.monsters.map(parseMonsterKey);
  const items: SetItem[] =
    set.kind === 'formTier'
      ? (data.formsByTier.get(set.tier) ?? []).map((f) => ({
          kind: 'form',
          id: f.id,
          found: kinds.some((k) => k.form === f.id),
        }))
      : [...data.elementByComposition.values()]
          .filter((e) => e.composition.includes(set.unit) && e.composition.length <= set.maxUnits)
          .map((e) => ({
            kind: 'element',
            id: e.id,
            found: kinds.some((k) => k.element === e.id),
          }));
  return {
    items,
    found: items.filter((i) => i.found).length,
    complete: items.every((i) => i.found),
    claimed: state.collections.includes(set.id),
  };
}

/** Owns this Keajaiban already: placed in the village or kept in the Gudang. */
export function ownsWonder(state: PlayerState, wonder: string): boolean {
  return (
    state.storage.some((i) => i.type === wonder) ||
    allBuildings(state).some((b) => b.type === wonder)
  );
}

/**
 * Pays a quest or set prize into a state being built (mutates it). Decorations and the
 * Keajaiban go to the Gudang; a Keajaiban the player already owns is not given again
 * (at most one per kind). Returns whether the Keajaiban was given.
 */
export function payPrize(state: PlayerState, prize: Prize): boolean {
  payReward(state, prize);
  addSoulEggs(state, prize.soulEggs);
  for (const type of prize.decorations) addToStorage(state, type);
  if (!prize.wonder || ownsWonder(state, prize.wonder)) return false;
  addToStorage(state, prize.wonder);
  return true;
}

/** Claims a complete set's prize, once. */
export function claimSet(
  state: PlayerState,
  setId: string,
  data: GameData = gameData,
): ActionResult<{ reward: Prize; wonder: boolean }> {
  const set = data.collections.sets.find((s) => s.id === setId);
  if (!set) return fail('entryNotFound');
  const progress = setProgress(state, set, data);
  if (progress.claimed) return fail('alreadyClaimed');
  if (!progress.complete) return fail('notReady');
  const next = deepClone(state);
  const reward = { ...set.reward };
  const wonder = payPrize(next, reward);
  next.collections.push(set.id);
  return { ok: true, state: next, reward, wonder };
}
