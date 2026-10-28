import { gameData, type Element, type ElementId, type GameData } from './data';

function getElement(id: ElementId, data: GameData): Element {
  const el = data.elementById.get(id);
  if (el) return el;
  throw new Error(`Elemen tidak dikenal: "${id}"`);
}

/** Single-element unit shim returning [id] for single-element system. */
export function elementUnits(id: ElementId, data: GameData = gameData): string[] {
  getElement(id, data);
  return [id];
}

/** Legacy helper: returns false as secret elements are removed in 100-monster system. */
export function isSecretElement(_id: ElementId, _data: GameData = gameData): boolean {
  return false;
}

/** Legacy helper: max units is 1. */
export function maxElementUnitsForFormTier(_tier: number, _data: GameData = gameData): number {
  return 1;
}

/** Legacy helper shim for union. */
export function unionComposition(a: ElementId, b: ElementId, _data: GameData = gameData): string[] {
  return [a, b];
}

/** Legacy helper shim for composition. */
export function findElementByComposition(
  units: readonly string[],
  data: GameData = gameData,
): ElementId | undefined {
  if (units.length === 0) return undefined;
  return data.elementById.get(units[0]!)?.id;
}

/**
 * 1 if attacker beats defender, -1 if defender beats attacker, 0 if neutral or tied.
 * Uses 13-element advantage table in data/elements.json (beats).
 */
export function elementAdvantageScore(
  attackerId: ElementId,
  defenderId: ElementId,
  data: GameData = gameData,
): number {
  const beatsAttacker = data.elements.beats[attackerId]?.includes(defenderId) ?? false;
  const beatsDefender = data.elements.beats[defenderId]?.includes(attackerId) ?? false;
  if (beatsAttacker) return 1;
  if (beatsDefender) return -1;
  return 0;
}

/** Damage multiplier: clamp(1 + score × advantageStep, advantageMin, advantageMax). */
export function elementAdvantage(
  attackerId: ElementId,
  defenderId: ElementId,
  data: GameData = gameData,
  advantageBonus = 0,
): number {
  const { advantageStep, advantageMin, advantageMax } = data.rules.battle;
  const score = elementAdvantageScore(attackerId, defenderId, data);
  const step = score > 0 ? advantageStep * (1 + advantageBonus) : advantageStep;
  const raw = 1 + score * step;
  return Math.min(advantageMax * (1 + advantageBonus), Math.max(advantageMin, raw));
}
