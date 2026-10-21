import { compositionKey, gameData, type BaseUnit, type ElementId, type GameData } from './data';
import type { Rng } from './rng';

function getElement(id: ElementId, data: GameData) {
  const el = data.elementById.get(id);
  if (!el) throw new Error(`Elemen tidak dikenal: "${id}"`);
  return el;
}

/** Base units of an element, in `baseElements` order. */
export function elementUnits(id: ElementId, data: GameData = gameData): BaseUnit[] {
  return sortUnits(getElement(id, data).composition, data);
}

export function sortUnits(units: readonly BaseUnit[], data: GameData = gameData): BaseUnit[] {
  const key = compositionKey(units, data.baseUnits);
  return key === '' ? [] : key.split('+');
}

/** Union of the base units of two elements. */
export function unionComposition(
  a: ElementId,
  b: ElementId,
  data: GameData = gameData,
): BaseUnit[] {
  return sortUnits([...elementUnits(a, data), ...elementUnits(b, data)], data);
}

/** Finds the non-secret element with exactly these units. Secret elements are never returned. */
export function findElementByComposition(
  units: readonly BaseUnit[],
  data: GameData = gameData,
): ElementId | undefined {
  return data.elementByComposition.get(compositionKey(units, data.baseUnits))?.id;
}

export function isSecretElement(id: ElementId, data: GameData = gameData): boolean {
  return getElement(id, data).secret === true;
}

export function maxElementUnitsForFormTier(tier: number, data: GameData = gameData): number {
  const cap = data.rules.mixer.maxElementUnitsByFormTier[String(tier)];
  if (cap === undefined) throw new Error(`Tingkat wujud tidak dikenal: ${tier}`);
  return cap;
}

/**
 * Randomly drops units until at most `limit` remain. Units in `keep` are dropped
 * only if nothing else is left to drop.
 */
export function capUnits(
  units: readonly BaseUnit[],
  limit: number,
  rng: Rng,
  keep: readonly BaseUnit[] = [],
  data: GameData = gameData,
): BaseUnit[] {
  let remaining = sortUnits(units, data);
  while (remaining.length > limit) {
    const droppable = remaining.filter((u) => !keep.includes(u));
    const drop = rng.pick(droppable.length > 0 ? droppable : remaining);
    remaining = remaining.filter((u) => u !== drop);
  }
  return remaining;
}

/**
 * Returns an element allowed on a form of `tier`: unchanged if it fits, otherwise
 * the non-secret element left after dropping random units down to the tier limit.
 * Secret elements below `secretElementMinFormTier` fall back to their composition.
 */
export function capElementForFormTier(
  id: ElementId,
  tier: number,
  rng: Rng,
  data: GameData = gameData,
): ElementId {
  const limit = maxElementUnitsForFormTier(tier, data);
  const units = elementUnits(id, data);
  const secretAllowed = tier >= data.rules.mixer.secretElementMinFormTier;
  if (units.length <= limit && (!isSecretElement(id, data) || secretAllowed)) return id;
  const capped = capUnits(units, limit, rng, [], data);
  const found = findElementByComposition(capped, data);
  if (!found) throw new Error(`Tidak ada elemen untuk komposisi ${capped.join('+')}`);
  return found;
}

/** Number of (a, d) unit pairs where a beats d, minus pairs where d beats a. */
export function elementAdvantageScore(
  attackerId: ElementId,
  defenderId: ElementId,
  data: GameData = gameData,
): number {
  const beats = (x: BaseUnit, y: BaseUnit) => data.elements.beats[x]?.includes(y) ?? false;
  let score = 0;
  for (const a of elementUnits(attackerId, data)) {
    for (const d of elementUnits(defenderId, data)) {
      if (beats(a, d)) score++;
      if (beats(d, a)) score--;
    }
  }
  return score;
}

/** Damage multiplier: clamp(1 + score × advantageStep, advantageMin, advantageMax). */
export function elementAdvantage(
  attackerId: ElementId,
  defenderId: ElementId,
  data: GameData = gameData,
): number {
  const { advantageStep, advantageMin, advantageMax } = data.rules.battle;
  const raw = 1 + elementAdvantageScore(attackerId, defenderId, data) * advantageStep;
  return Math.min(advantageMax, Math.max(advantageMin, raw));
}
