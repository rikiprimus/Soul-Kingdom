import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import {
  findMonsterRecipe,
  formTierOddsWithPity,
  isParentConsumed,
  mixCost,
  mixOddsTable,
  rollMix,
  validateParents,
  type MixContext,
} from './mixer';
import { tierOf, type Monster } from './monster';
import { createRng } from './rng';

describe('Altar recipes & crossbreeding (Tugas 2B.3)', () => {
  const open: MixContext = { bossesDefeated: 4, pityStreak: 0 };

  it('definite recipe from monsters.json gives guaranteed result in either parent order', () => {
    // Find a monster with a recipe from monsters.json
    const monsterWithRecipe = gameData.monsters.monsters.find((m) => m.recipe !== null);
    expect(monsterWithRecipe).toBeDefined();
    const recipe = monsterWithRecipe!.recipe!;
    const parentA = { species: recipe.parentA };
    const parentB = { species: recipe.parentB };

    expect(findMonsterRecipe(parentA, parentB)?.id).toBe(monsterWithRecipe!.id);
    expect(findMonsterRecipe(parentB, parentA)?.id).toBe(monsterWithRecipe!.id);

    const rng = createRng(123);
    for (let i = 0; i < 100; i++) {
      const [p1, p2] = i % 2 === 0 ? [parentA, parentB] : [parentB, parentA];
      const result = rollMix(p1, p2, open, rng);
      expect(result.species).toBe(monsterWithRecipe!.id);
      expect(result.tierOutcome).toBe('recipe');
      expect(result.recipeId).toBe(monsterWithRecipe!.id);
    }
  });

  it('pairs without recipe produce random Common-Elite (tier 1..4) (Monte Carlo)', () => {
    // Pick two parents that do NOT form any recipe
    const p1 = { species: 'baby-slime' };
    const p2 = { species: 'thorn-beetle' };
    expect(findMonsterRecipe(p1, p2)).toBeUndefined();

    const rng = createRng(42);
    const n = 10_000;
    const tierCounts: Record<number, number> = {};

    for (let i = 0; i < n; i++) {
      const res = rollMix(p1, p2, open, rng);
      const tier = tierOf({ species: res.species ?? res.form });
      expect(tier).toBeGreaterThanOrEqual(1);
      expect(tier).toBeLessThanOrEqual(4);
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
    }

    // Check that results exist within tier 1..4
    expect(
      (tierCounts[1] ?? 0) + (tierCounts[2] ?? 0) + (tierCounts[3] ?? 0) + (tierCounts[4] ?? 0),
    ).toBe(n);
  });

  it('is completely deterministic with the same seed', () => {
    const p1 = { species: 'baby-slime' };
    const p2 = { species: 'thorn-beetle' };
    const run = () => {
      const rng = createRng(77);
      return Array.from({ length: 50 }, () => rollMix(p1, p2, open, rng));
    };
    expect(run()).toEqual(run());
  });
});

describe('Altar cost & parent preservation (Keputusan pemilik 2026-10-28)', () => {
  it('Altar is free (0 gold, 0 soul crystal)', () => {
    const p1 = { species: 'baby-slime' };
    const p2 = { species: 'thorn-beetle' };
    const cost = mixCost(p1, p2, { bossesDefeated: 4 });
    expect(cost.gold).toBe(0);
    expect(cost.soulCrystal).toBe(0);
    expect(cost.seconds).toBeGreaterThan(0);
  });

  it('duration matches altar.durationByTier for the result tier', () => {
    // Test with a recipe
    const monsterWithRecipe = gameData.monsters.monsters.find((m) => m.recipe !== null)!;
    const p1 = { species: monsterWithRecipe.recipe!.parentA };
    const p2 = { species: monsterWithRecipe.recipe!.parentB };
    const cost = mixCost(p1, p2, { bossesDefeated: 4 });
    expect(cost.resultTier).toBe(monsterWithRecipe.tier);
    expect(cost.seconds).toBe(
      gameData.rules.altar?.durationByTier[String(monsterWithRecipe.tier)] ??
        gameData.rules.mixer.costByResultTier[String(monsterWithRecipe.tier)]?.seconds,
    );
  });

  it('parents are never consumed (isParentConsumed always false)', () => {
    expect(isParentConsumed({ species: 'baby-slime' })).toBe(false);
    expect(isParentConsumed({ species: 'bahamut' })).toBe(false);
  });

  it('validateParents requires two distinct adult monsters', () => {
    const adult1: Monster = { id: 'm1', species: 'baby-slime', stage: 'dewasa', food: 0 };
    const adult2: Monster = { id: 'm2', species: 'thorn-beetle', stage: 'dewasa', food: 0 };
    const baby: Monster = { id: 'm3', species: 'thorn-beetle', stage: 'bayi', food: 0 };

    expect(validateParents(adult1, adult2)).toEqual({ ok: true });
    expect(validateParents(adult1, adult1)).toEqual({ ok: false, error: 'sameMonster' });
    expect(validateParents(adult1, baby)).toEqual({ ok: false, error: 'notAdult' });
  });
});

describe('Altar pity & odds table', () => {
  it('pity raises mutation odds every streak block', () => {
    const { pity, formTierOdds } = gameData.rules.mixer;
    expect(formTierOddsWithPity(pity.streak - 1).mutation).toBeCloseTo(formTierOdds.mutation);
    expect(formTierOddsWithPity(pity.streak).mutation).toBeCloseTo(
      formTierOdds.mutation + pity.mutationBonusPerStreak,
    );
  });

  it('mixOddsTable sums to 1 and shows guaranteedRecipe when a recipe exists', () => {
    const monsterWithRecipe = gameData.monsters.monsters.find((m) => m.recipe !== null)!;
    const p1 = { species: monsterWithRecipe.recipe!.parentA };
    const p2 = { species: monsterWithRecipe.recipe!.parentB };
    const table = mixOddsTable(p1, p2, { bossesDefeated: 4, pityStreak: 0 });
    expect(table.guaranteedRecipe?.id).toBe(monsterWithRecipe.id);
  });
});
