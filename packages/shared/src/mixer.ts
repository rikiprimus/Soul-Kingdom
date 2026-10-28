import {
  gameData,
  type BaseUnit,
  type ElementId,
  type FormId,
  type GameData,
  type MonsterDef,
  type Rarity,
} from './data';
import { getStage, rarityOf, rarityRank, tierOf, type Monster, type MonsterKind } from './monster';
import type { Rng } from './rng';

export interface MixContext {
  bossesDefeated: number;
  /** Consecutive mixes without a result of `pity.resetOnRarity` or better. */
  pityStreak: number;
}

export type TierOutcome = 'recipe' | 'same' | 'up' | 'down' | 'mutation';
export type ElementSource = 'recipe' | 'secret' | 'fullUnion' | 'parent' | 'partial';

export interface MixResult {
  species?: string;
  form: FormId;
  element: ElementId;
  rarity: Rarity;
  tierOutcome: TierOutcome;
  elementSource: ElementSource;
  /** Set when a monster recipe from monsters.json / recipes.json produced the result. */
  recipeId?: string;
  mutation: boolean;
  /** The extra base unit added by a mutation (absent if none could be added). */
  mutationUnit?: BaseUnit;
  secretElement: boolean;
  /** Pity streak after this result. */
  nextPityStreak: number;
}

export interface FormTierOdds {
  same: number;
  up: number;
  down: number;
  mutation: number;
}

export interface MixCost {
  resultTier: number;
  seconds: number;
  gold: number;
  soulCrystal: number;
  prophecyGems: number;
}

export type ParentError = 'sameMonster' | 'notAdult';

/** Highest result form tier unlocked by the number of Adventure bosses defeated. */
export function maxFormTier(bossesDefeated: number, data: GameData = gameData): number {
  const table = data.rules.mixer.maxFormTierByBossesDefeated;
  return table[Math.min(Math.max(0, bossesDefeated), table.length - 1)]!;
}

function clampTier(tier: number, context: MixContext, data: GameData): number {
  const min = data.formTiers[0] ?? 1;
  return Math.max(min, Math.min(tier, maxFormTier(context.bossesDefeated, data)));
}

/**
 * Form tier odds after pity: every `pity.streak` mixes in the streak add
 * `mutationBonusPerStreak` to mutation, taken from "same" first, then up/down.
 */
export function formTierOddsWithPity(
  pityStreak: number,
  data: GameData = gameData,
  bonusMutation = 0,
): FormTierOdds {
  const { formTierOdds, pity } = data.rules.mixer;
  const wanted =
    Math.floor(Math.max(0, pityStreak) / pity.streak) * pity.mutationBonusPerStreak + bonusMutation;
  const odds = { ...formTierOdds };
  let left = Math.min(wanted, 1 - odds.mutation);
  odds.mutation += left;
  const fromSame = Math.min(left, odds.same);
  odds.same -= fromSame;
  left -= fromSame;
  if (left > 0) {
    const rest = odds.up + odds.down;
    const fromUp = rest > 0 ? (left * odds.up) / rest : 0;
    odds.up -= fromUp;
    odds.down -= left - fromUp;
  }
  return odds;
}

/** Looks up crossbreed recipe from monsters.json (parentA + parentB commutative). */
export function findMonsterRecipe(
  a: MonsterKind,
  b: MonsterKind,
  data: GameData = gameData,
): MonsterDef | undefined {
  const sa = 'species' in a && a.species ? a.species : a.form;
  const sb = 'species' in b && b.species ? b.species : b.form;
  const key = [sa, sb].sort().join('+');
  return data.monsterRecipeByParents.get(key);
}

function nextPity(rarity: Rarity, context: MixContext, data: GameData): number {
  const reset = rarityRank(rarity) >= rarityRank(data.rules.mixer.pity.resetOnRarity);
  return reset ? 0 : context.pityStreak + 1;
}

function rollTierOutcome(odds: FormTierOdds, rng: Rng): Exclude<TierOutcome, 'recipe'> {
  let r = rng.next();
  for (const outcome of ['same', 'up', 'down', 'mutation'] as const) {
    if (r < odds[outcome]) return outcome;
    r -= odds[outcome];
  }
  return 'same';
}

const TIER_DELTA: Record<Exclude<TierOutcome, 'recipe'>, number> = {
  same: 0,
  up: 1,
  down: -1,
  mutation: 1,
};

/**
 * Rolls an Altar crossbreed result:
 * 1. Definitive recipe from monsters.json if parents match a recipe.
 * 2. If no recipe matches, returns a random Common-Elite (tier 1..4) monster,
 *    influenced by pity and mutation.
 */
export function rollMix(
  parentA: MonsterKind,
  parentB: MonsterKind,
  context: MixContext,
  rng: Rng,
  data: GameData = gameData,
  mutationBonus = 0,
): MixResult {
  const recipe = findMonsterRecipe(parentA, parentB, data);
  if (recipe) {
    const rarity = rarityOf({ species: recipe.id }, data);
    return {
      species: recipe.id,
      form: recipe.id,
      element: recipe.element,
      rarity,
      tierOutcome: 'recipe',
      elementSource: 'recipe',
      recipeId: recipe.id,
      mutation: false,
      secretElement: false,
      nextPityStreak: nextPity(rarity, context, data),
    };
  }

  // Non-recipe pairs: random Common to Elite (tier 1..4)
  const odds = formTierOddsWithPity(context.pityStreak, data, mutationBonus);
  const tierOutcome = rollTierOutcome(odds, rng);
  const mutation = tierOutcome === 'mutation';

  const baseTier = Math.min(4, Math.max(tierOf(parentA, data), tierOf(parentB, data)));
  const targetTier = Math.max(1, Math.min(4, baseTier + TIER_DELTA[tierOutcome]));

  const tierMonsters = (data.monstersByTier.get(targetTier) ?? []).filter(
    (m) => !m.sources.includes('boss'),
  );
  const pool =
    tierMonsters.length > 0
      ? tierMonsters
      : (data.monstersByTier.get(targetTier) ??
        [1, 2, 3, 4].flatMap((t) => data.monstersByTier.get(t) ?? []));

  const chosen = pool.length > 0 ? rng.pick(pool) : { id: 'baby-slime', element: 'air', tier: 1 };
  const rarity = rarityOf({ species: chosen.id }, data);

  return {
    species: chosen.id,
    form: chosen.id,
    element: chosen.element,
    rarity,
    tierOutcome,
    elementSource: 'parent',
    mutation,
    secretElement: false,
    nextPityStreak: nextPity(rarity, context, data),
  };
}

/**
 * Altar crossbreed cost:
 * Free (0 gold, 0 soul crystals) per owner decision 2026-10-28.
 * Duration is based on result tier from rules.json (altar.durationByTier).
 */
export function mixCost(
  parentA: MonsterKind,
  parentB: MonsterKind,
  context: Pick<MixContext, 'bossesDefeated'>,
  data: GameData = gameData,
  altarTimeReduction = 0,
): MixCost {
  const recipe = findMonsterRecipe(parentA, parentB, data);
  const baseTier = Math.max(tierOf(parentA, data), tierOf(parentB, data));
  const resultTier = recipe
    ? recipe.tier
    : clampTier(Math.min(4, baseTier + 1), { pityStreak: 0, ...context }, data);
  const t = String(resultTier);

  const durationSeconds =
    data.rules.altar?.durationByTier?.[t] ?? data.rules.mixer.costByResultTier[t]?.seconds ?? 600;
  const effSeconds = Math.max(
    1,
    Math.ceil(durationSeconds * Math.max(0.1, 1 - altarTimeReduction)),
  );

  return {
    resultTier,
    seconds: effSeconds,
    gold: 0,
    soulCrystal: 0,
    prophecyGems: data.rules.premium.soulProphecyGemsByResultTier[t] ?? 5,
  };
}

export function validateParents(
  parentA: Monster,
  parentB: Monster,
  data: GameData = gameData,
): { ok: true } | { ok: false; error: ParentError } {
  if (parentA.id === parentB.id) return { ok: false, error: 'sameMonster' };
  const required = getStage(data.rules.mixer.parentStage, data).index;
  for (const p of [parentA, parentB]) {
    if (getStage(p.stage, data).index < required) return { ok: false, error: 'notAdult' };
  }
  return { ok: true };
}

/** Parents are NOT consumed in the revised Altar system (Keputusan pemilik 2026-10-28). */
export function isParentConsumed(_parent: MonsterKind, _data: GameData = gameData): boolean {
  return false;
}

export interface MixOddsTable {
  baseTier: number;
  maxTier: number;
  tiers: { tier: number; probability: number }[];
  formTierOdds: FormTierOdds;
  guaranteedRecipe?: MonsterDef;
}

export function mixOddsTable(
  parentA: MonsterKind,
  parentB: MonsterKind,
  context: MixContext,
  data: GameData = gameData,
): MixOddsTable {
  const recipe = findMonsterRecipe(parentA, parentB, data);
  const baseTier = Math.min(4, Math.max(tierOf(parentA, data), tierOf(parentB, data)));
  const odds = formTierOddsWithPity(context.pityStreak, data);

  const byTier = new Map<number, number>();
  for (const outcome of ['same', 'up', 'down', 'mutation'] as const) {
    const tier = Math.max(1, Math.min(4, baseTier + TIER_DELTA[outcome]));
    byTier.set(tier, (byTier.get(tier) ?? 0) + odds[outcome]);
  }

  return {
    baseTier,
    maxTier: 4,
    tiers: [...byTier.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tier, probability]) => ({ tier, probability })),
    formTierOdds: odds,
    ...(recipe ? { guaranteedRecipe: recipe } : {}),
  };
}
