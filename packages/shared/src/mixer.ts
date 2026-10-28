import {
  gameData,
  type BaseUnit,
  type ElementId,
  type FormId,
  type GameData,
  type Rarity,
} from './data';
import {
  capUnits,
  elementUnits,
  findElementByComposition,
  isSecretElement,
  maxElementUnitsForFormTier,
  sortUnits,
  unionComposition,
} from './elements';
import {
  formTierOf,
  getStage,
  monsterKey,
  rarityOf,
  rarityRank,
  type Monster,
  type MonsterKind,
} from './monster';
import type { Rng } from './rng';

export interface MixContext {
  bossesDefeated: number;
  /** Consecutive mixes without a result of `pity.resetOnRarity` or better. */
  pityStreak: number;
}

export type TierOutcome = 'recipe' | 'same' | 'up' | 'down' | 'mutation';
export type ElementSource = 'recipe' | 'secret' | 'fullUnion' | 'parent' | 'partial';

export interface MixResult {
  form: FormId;
  element: ElementId;
  rarity: Rarity;
  tierOutcome: TierOutcome;
  elementSource: ElementSource;
  /** Set when a monster recipe from recipes.json produced the result. */
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
  const min = data.formTiers[0]!;
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

export function findMonsterRecipe(a: MonsterKind, b: MonsterKind, data: GameData = gameData) {
  const ka = monsterKey(a);
  const kb = monsterKey(b);
  return data.recipes.monsterRecipes.find(
    ({ parents: [p, q] }) => (p === ka && q === kb) || (p === kb && q === ka),
  );
}

function findSecretElementRecipe(a: ElementId, b: ElementId, data: GameData) {
  return data.elements.secretRecipes.find(
    ({ pair: [p, q] }) => (p === a && q === b) || (p === b && q === a),
  );
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
 * Rolls a Soul Mixer result. Order: monster recipe → form tier (capped by the
 * Adventure tier) → random form → element (secret pair → full union / a parent /
 * partial union) → mutation unit → element unit cap for the form → pity.
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
    const [form = '', element = ''] = recipe.result.split(':');
    const kind = { form, element };
    if (formTierOf(kind, data) <= maxFormTier(context.bossesDefeated, data)) {
      const rarity = rarityOf(kind, data);
      return {
        ...kind,
        rarity,
        tierOutcome: 'recipe',
        elementSource: 'recipe',
        recipeId: recipe.id,
        mutation: false,
        secretElement: isSecretElement(element, data),
        nextPityStreak: nextPity(rarity, context, data),
      };
    }
  }

  const baseTier = Math.max(formTierOf(parentA, data), formTierOf(parentB, data));
  const tierOutcome = rollTierOutcome(
    formTierOddsWithPity(context.pityStreak, data, mutationBonus),
    rng,
  );
  const tier = clampTier(baseTier + TIER_DELTA[tierOutcome], context, data);
  const candidates = data.formsByTier.get(tier);
  if (!candidates || candidates.length === 0) throw new Error(`Tidak ada wujud tingkat ${tier}`);
  const form = rng.pick(candidates).id;
  const mutation = tierOutcome === 'mutation';
  const secretAllowed = tier >= data.rules.mixer.secretElementMinFormTier;

  let element: ElementId | undefined;
  let elementSource: ElementSource;
  let mutationUnit: BaseUnit | undefined;

  const secretRecipe = secretAllowed
    ? findSecretElementRecipe(parentA.element, parentB.element, data)
    : undefined;
  if (secretRecipe && rng.chance(secretRecipe.chance)) {
    element = secretRecipe.result;
    elementSource = 'secret';
  } else {
    const union = unionComposition(parentA.element, parentB.element, data);
    const { fullUnion, parent } = data.rules.mixer.elementOdds;
    const r = rng.next();
    let units: BaseUnit[];
    if (r < fullUnion) {
      elementSource = 'fullUnion';
      units = union;
    } else if (r < fullUnion + parent) {
      elementSource = 'parent';
      const chosen = rng.chance(0.5) ? parentA.element : parentB.element;
      if (isSecretElement(chosen, data) && secretAllowed && !mutation) element = chosen;
      units = elementUnits(chosen, data);
    } else {
      elementSource = 'partial';
      const size = union.length > 1 ? rng.int(1, union.length - 1) : union.length;
      units = rng.shuffle(union).slice(0, size);
    }

    if (element === undefined) {
      if (mutation) {
        const missing = data.baseUnits.filter((u) => !units.includes(u));
        if (missing.length > 0) {
          mutationUnit = rng.pick(missing);
          units = [...units, mutationUnit];
        }
      }
      const limit = maxElementUnitsForFormTier(tier, data);
      units = capUnits(units, limit, rng, mutationUnit ? [mutationUnit] : [], data);
      element = findElementByComposition(sortUnits(units, data), data);
      if (!element) throw new Error(`Tidak ada elemen untuk komposisi ${units.join('+')}`);
    }
  }

  const rarity = rarityOf({ form, element }, data);
  const result: MixResult = {
    form,
    element,
    rarity,
    tierOutcome,
    elementSource,
    mutation,
    secretElement: isSecretElement(element, data),
    nextPityStreak: nextPity(rarity, context, data),
  };
  if (mutationUnit) result.mutationUnit = mutationUnit;
  return result;
}

/**
 * Cost is paid up front from the highest tier the pair could reach
 * (highest parent tier + 1, capped by the Adventure tier), so it reveals nothing.
 */
export function mixCost(
  parentA: MonsterKind,
  parentB: MonsterKind,
  context: Pick<MixContext, 'bossesDefeated'>,
  data: GameData = gameData,
  altarTimeReduction = 0,
): MixCost {
  const baseTier = Math.max(formTierOf(parentA, data), formTierOf(parentB, data));
  const resultTier = clampTier(baseTier + 1, { pityStreak: 0, ...context }, data);
  const t = String(resultTier);
  const cost = data.rules.mixer.costByResultTier[t]!;
  const effSeconds = Math.max(1, Math.ceil(cost.seconds * Math.max(0.1, 1 - altarTimeReduction)));
  return {
    resultTier,
    ...cost,
    seconds: effSeconds,
    prophecyGems: data.rules.premium.soulProphecyGemsByResultTier[t]!,
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

/**
 * Whether a parent is used up by mixing. With `protectLegendaryParents`, legendary
 * parents survive the mix (so recipes that need legendary parents stay reachable).
 */
export function isParentConsumed(parent: MonsterKind, data: GameData = gameData): boolean {
  const { consumeParents, protectLegendaryParents } = data.rules.mixer;
  if (!consumeParents) return false;
  return !(protectLegendaryParents && rarityOf(parent, data) === 'legenda');
}

export interface MixOddsTable {
  baseTier: number;
  maxTier: number;
  /** Probability of each resulting form tier, after the Adventure cap. */
  tiers: { tier: number; probability: number }[];
  formTierOdds: FormTierOdds;
  elements: {
    source: 'fullUnion' | 'parent' | 'partial';
    probability: number;
    element?: ElementId;
  }[];
}

/** The free "base odds" table shown before mixing. Never reveals recipes. */
export function mixOddsTable(
  parentA: MonsterKind,
  parentB: MonsterKind,
  context: MixContext,
  data: GameData = gameData,
): MixOddsTable {
  const baseTier = Math.max(formTierOf(parentA, data), formTierOf(parentB, data));
  const odds = formTierOddsWithPity(context.pityStreak, data);
  const byTier = new Map<number, number>();
  for (const outcome of ['same', 'up', 'down', 'mutation'] as const) {
    const tier = clampTier(baseTier + TIER_DELTA[outcome], context, data);
    byTier.set(tier, (byTier.get(tier) ?? 0) + odds[outcome]);
  }
  const { fullUnion, parent, partial } = data.rules.mixer.elementOdds;
  const unionElement = findElementByComposition(
    unionComposition(parentA.element, parentB.element, data),
    data,
  );
  const elements: MixOddsTable['elements'] = [
    { source: 'fullUnion', probability: fullUnion, ...(unionElement && { element: unionElement }) },
  ];
  if (parentA.element === parentB.element) {
    elements.push({ source: 'parent', probability: parent, element: parentA.element });
  } else {
    elements.push({ source: 'parent', probability: parent / 2, element: parentA.element });
    elements.push({ source: 'parent', probability: parent / 2, element: parentB.element });
  }
  elements.push({ source: 'partial', probability: partial });
  return {
    baseTier,
    maxTier: maxFormTier(context.bossesDefeated, data),
    tiers: [...byTier.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tier, probability]) => ({ tier, probability })),
    formTierOdds: odds,
    elements,
  };
}
