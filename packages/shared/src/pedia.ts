import { gameData, type GameData } from './data';
import { parseMonsterKey } from './monster';
import type { Monsterpedia } from './state';

/** What the player has discovered so far, derived from the Monsterpedia. */
export function pediaProgress(pedia: Monsterpedia, data: GameData = gameData) {
  const kinds = pedia.monsters.map(parseMonsterKey);
  const elements = new Set(kinds.map((k) => k.element));
  const forms = new Set(kinds.map((k) => k.form));
  const recipes = new Set(pedia.recipes);
  const elementCount = data.elements.elements.length;
  const formCount = data.forms.forms.length;
  const recipeCount = data.recipes.monsterRecipes.length;
  const found = elements.size + forms.size + recipes.size;
  const total = elementCount + formCount + recipeCount;
  return {
    kinds,
    elements,
    forms,
    recipes,
    elementCount,
    formCount,
    recipeCount,
    found,
    total,
    ratio: total > 0 ? found / total : 0,
  };
}

export type PediaProgress = ReturnType<typeof pediaProgress>;
