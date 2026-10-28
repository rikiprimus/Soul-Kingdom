import elements from '../../../../data/elements.json';
import forms from '../../../../data/forms.json';
import recipes from '../../../../data/recipes.json';
import rules from '../../../../data/rules.json';
import text from '../../../../data/text.json';
import buildings from '../../../../data/buildings.json';
import wilds from '../../../../data/wilds.json';
import adventure from '../../../../data/adventure.json';
import quests from '../../../../data/quests.json';
import collections from '../../../../data/collections.json';
import islands from '../../../../data/islands.json';
import monsters from '../../../../data/monsters.json';
import { loadGameData, type RawGameData } from './load';

export * from './load';
export * from './schema';

/** Raw JSON from `data/` — the single source of game content and numbers. */
export const rawGameData: RawGameData = {
  elements,
  forms,
  recipes,
  rules,
  text,
  buildings,
  wilds,
  adventure,
  quests,
  collections,
  islands,
  monsters,
};

/** Validated game data. Importing this module throws if `data/` is invalid. */
export const gameData = loadGameData(rawGameData);
