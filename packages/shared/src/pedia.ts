import { gameData, type GameData } from './data';
import { parseMonsterKey } from './monster';
import type { Monsterpedia } from './state';

/** What the player has discovered so far, derived from the Monsterpedia. */
export function pediaProgress(pedia: Monsterpedia, data: GameData = gameData) {
  const discoveredSpecies = new Set<string>();
  const discoveredElements = new Set<string>();
  for (const key of pedia.monsters) {
    const parsed = parseMonsterKey(key, data);
    if ('element' in parsed && parsed.element) {
      discoveredElements.add(parsed.element);
    }
    if ('form' in parsed && parsed.form) {
      discoveredSpecies.add(parsed.form);
    }
    if ('species' in parsed && parsed.species) {
      discoveredSpecies.add(parsed.species);
      const def = data.monsterById.get(parsed.species);
      if (def?.element) discoveredElements.add(def.element);
    }
  }

  const recipes = new Set(pedia.recipes);
  const monsterCount = data.monsters.monsters.length;
  const elementCount = data.elements.elements.length;
  const recipeCount = data.monsters.monsters.filter((m) => m.recipe !== null).length;
  const found = discoveredSpecies.size + recipes.size;
  const total = monsterCount + recipeCount;

  return {
    discoveredSpecies,
    speciesCount: discoveredSpecies.size,
    monsterCount,
    elements: discoveredElements,
    elementCount,
    recipes,
    recipeCount,
    found,
    total,
    ratio: total > 0 ? found / total : 0,
    kinds: pedia.monsters.map((k) => parseMonsterKey(k, data)),
    forms: discoveredSpecies,
    formCount: monsterCount,
  };
}

export type PediaProgress = ReturnType<typeof pediaProgress>;
