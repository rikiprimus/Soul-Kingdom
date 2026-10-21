import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import { elementUnits, maxElementUnitsForFormTier } from './elements';
import {
  formTierOddsWithPity,
  isParentConsumed,
  maxFormTier,
  mixCost,
  mixOddsTable,
  rollMix,
  validateParents,
  type MixContext,
} from './mixer';
import { formTierOf, type Monster, type MonsterKind } from './monster';
import { createRng } from './rng';

const N = 100_000;
const TOLERANCE = 0.01;
const { mixer } = gameData.rules;

function countOutcomes(
  a: MonsterKind,
  b: MonsterKind,
  context: MixContext,
  key: (r: ReturnType<typeof rollMix>) => string,
  seed = 1,
) {
  const rng = createRng(seed);
  const counts = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const k = key(rollMix(a, b, context, rng));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return (k: string) => (counts.get(k) ?? 0) / N;
}

describe('rollMix (Monte Carlo)', () => {
  const open: MixContext = { bossesDefeated: 3, pityStreak: 0 };
  const wolf = { form: 'serigala', element: 'api' };
  const snake = { form: 'ular', element: 'air' };

  it('rolls form tier outcomes at the rules.json odds', () => {
    const freq = countOutcomes(wolf, snake, open, (r) => r.tierOutcome);
    for (const outcome of ['same', 'up', 'down', 'mutation'] as const) {
      expect(Math.abs(freq(outcome) - mixer.formTierOdds[outcome])).toBeLessThan(TOLERANCE);
    }
  });

  it('maps tier outcomes to the right form tier', () => {
    const rng = createRng(2);
    const expected = { same: 2, up: 3, down: 1, mutation: 3, recipe: -1 };
    for (let i = 0; i < 5000; i++) {
      const r = rollMix(wolf, snake, open, rng);
      expect(formTierOf(r)).toBe(expected[r.tierOutcome]);
    }
  });

  it('rolls element sources at the rules.json odds', () => {
    const freq = countOutcomes(wolf, snake, open, (r) => r.elementSource);
    for (const source of ['fullUnion', 'parent', 'partial'] as const) {
      expect(Math.abs(freq(source) - mixer.elementOdds[source])).toBeLessThan(TOLERANCE);
    }
  });

  it('picks a random form of the resulting tier', () => {
    const freq = countOutcomes(wolf, snake, open, (r) => r.form);
    const tier2 = gameData.formsByTier.get(2)!;
    const sameOdds = mixer.formTierOdds.same / tier2.length;
    for (const form of tier2) expect(Math.abs(freq(form.id) - sameOdds)).toBeLessThan(TOLERANCE);
  });

  it('always gives the fixed result for a monster recipe, in any order', () => {
    const tiger = { form: 'harimau', element: 'api' };
    const croc = { form: 'buaya', element: 'air' };
    const rng = createRng(3);
    for (let i = 0; i < 2000; i++) {
      const [a, b] = i % 2 ? [tiger, croc] : [croc, tiger];
      const r = rollMix(a, b, { bossesDefeated: 2, pityStreak: i % 25 }, rng);
      expect(r).toMatchObject({ form: 'naga', element: 'uap', recipeId: 'naga-uap' });
    }
  });

  it('skips recipes whose tier is not unlocked yet', () => {
    const rng = createRng(4);
    const tiger = { form: 'harimau', element: 'api' };
    const croc = { form: 'buaya', element: 'air' };
    for (let i = 0; i < 2000; i++) {
      const r = rollMix(tiger, croc, { bossesDefeated: 1, pityStreak: 0 }, rng);
      expect(r.recipeId).toBeUndefined();
      expect(formTierOf(r)).toBeLessThanOrEqual(3);
    }
  });

  it('never exceeds the Adventure tier cap or the element cap of the form', () => {
    const rng = createRng(5);
    const forms = gameData.forms.forms;
    const elements = gameData.elements.elements.filter((e) => !e.secret);
    for (let i = 0; i < 20_000; i++) {
      const fa = rng.pick(forms);
      const fb = rng.pick(forms);
      const pickElement = (tier: number) =>
        rng.pick(elements.filter((e) => e.composition.length <= maxElementUnitsForFormTier(tier)));
      const a = { form: fa.id, element: pickElement(fa.tier).id };
      const b = { form: fb.id, element: pickElement(fb.tier).id };
      const bossesDefeated = rng.int(0, 4);
      const r = rollMix(a, b, { bossesDefeated, pityStreak: rng.int(0, 40) }, rng);
      const tier = formTierOf(r);
      expect(tier).toBeLessThanOrEqual(maxFormTier(bossesDefeated));
      expect(elementUnits(r.element).length).toBeLessThanOrEqual(maxElementUnitsForFormTier(tier));
    }
  });

  it('gives secret elements only to tier 5 forms', () => {
    const rng = createRng(6);
    let secrets = 0;
    const dragon = { form: 'naga', element: 'petir' };
    const bird = { form: 'burung-agung', element: 'gerhana' };
    for (let i = 0; i < 20_000; i++) {
      const r = rollMix(dragon, bird, open, rng);
      if (r.secretElement) {
        secrets++;
        expect(r.element).toBe('petir-hitam');
        expect(formTierOf(r)).toBe(5);
      }
    }
    expect(secrets).toBeGreaterThan(0);
    // Tier 3 parents capped at tier 3 can never reach a secret element.
    const eagle = { form: 'elang', element: 'petir' };
    const ghost = { form: 'hantu', element: 'gerhana' };
    for (let i = 0; i < 5000; i++) {
      expect(rollMix(eagle, ghost, { bossesDefeated: 1, pityStreak: 0 }, rng).secretElement).toBe(
        false,
      );
    }
  });

  it('adds an extra base unit on mutation', () => {
    const rng = createRng(7);
    let mutations = 0;
    for (let i = 0; i < 50_000; i++) {
      const r = rollMix(wolf, snake, open, rng);
      if (!r.mutation) continue;
      mutations++;
      expect(r.mutationUnit).toBeDefined();
      expect(elementUnits(r.element)).toContain(r.mutationUnit);
      if (r.elementSource === 'fullUnion') expect(['api', 'air']).not.toContain(r.mutationUnit);
    }
    expect(mutations).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed', () => {
    const run = () => {
      const rng = createRng(77);
      return Array.from({ length: 200 }, () => rollMix(wolf, snake, open, rng));
    };
    expect(run()).toEqual(run());
  });
});

describe('pity', () => {
  const { pity } = mixer;

  it('raises mutation odds every streak block', () => {
    const base = mixer.formTierOdds.mutation;
    expect(formTierOddsWithPity(pity.streak - 1).mutation).toBeCloseTo(base);
    expect(formTierOddsWithPity(pity.streak).mutation).toBeCloseTo(
      base + pity.mutationBonusPerStreak,
    );
    expect(formTierOddsWithPity(pity.streak * 3).mutation).toBeCloseTo(
      base + 3 * pity.mutationBonusPerStreak,
    );
    const odds = formTierOddsWithPity(pity.streak * 3);
    expect(odds.same + odds.up + odds.down + odds.mutation).toBeCloseTo(1);
  });

  it('applies the pity bonus in rolls (Monte Carlo)', () => {
    const streak = pity.streak * 5;
    const freq = countOutcomes(
      { form: 'serigala', element: 'api' },
      { form: 'ular', element: 'air' },
      { bossesDefeated: 3, pityStreak: streak },
      (r) => r.tierOutcome,
    );
    expect(Math.abs(freq('mutation') - formTierOddsWithPity(streak).mutation)).toBeLessThan(
      TOLERANCE,
    );
  });

  it('counts up without an epic result and resets on one', () => {
    const rng = createRng(9);
    const cat = { form: 'kucing', element: 'api' };
    const dog = { form: 'anjing', element: 'api' };
    // Two Api parents at tier cap 2 can only ever produce single-unit (biasa) results...
    for (let i = 0; i < 500; i++) {
      const r = rollMix(cat, dog, { bossesDefeated: 0, pityStreak: 4 }, rng);
      if (!r.mutation) expect(r.nextPityStreak).toBe(5);
    }
    // ...while a recipe giving a legendary monster resets the streak.
    const r = rollMix(
      { form: 'harimau', element: 'api' },
      { form: 'buaya', element: 'air' },
      { bossesDefeated: 3, pityStreak: 12 },
      rng,
    );
    expect(r.rarity).toBe('langka');
    expect(r.nextPityStreak).toBe(13);
    const legend = rollMix(
      { form: 'naga', element: 'badai' },
      { form: 'burung-agung', element: 'petir' },
      { bossesDefeated: 3, pityStreak: 12 },
      rng,
    );
    expect(legend.rarity).toBe('legenda');
    expect(legend.nextPityStreak).toBe(0);
  });
});

describe('mixCost and validateParents', () => {
  const adult = (id: string, form: string, element: string, stage = 'dewasa'): Monster => ({
    id,
    form,
    element,
    stage,
    food: 0,
  });

  it('charges for the highest reachable tier, capped by the Adventure tier', () => {
    const a = adult('1', 'kucing', 'api');
    const b = adult('2', 'serigala', 'air');
    expect(mixCost(a, b, { bossesDefeated: 3 })).toMatchObject({
      resultTier: 3,
      ...mixer.costByResultTier['3'],
    });
    expect(mixCost(a, b, { bossesDefeated: 0 }).resultTier).toBe(2);
    expect(mixCost(a, b, { bossesDefeated: 0 }).prophecyGems).toBe(
      gameData.rules.premium.soulProphecyGemsByResultTier['2'],
    );
  });

  it('accepts two different adults only', () => {
    const a = adult('1', 'kucing', 'api');
    expect(validateParents(a, adult('2', 'anjing', 'air'))).toEqual({ ok: true });
    expect(validateParents(a, a)).toEqual({ ok: false, error: 'sameMonster' });
    expect(validateParents(a, adult('3', 'anjing', 'air', 'remaja'))).toEqual({
      ok: false,
      error: 'notAdult',
    });
  });

  it('protects legendary parents from being consumed', () => {
    expect(isParentConsumed({ form: 'kucing', element: 'api' })).toBe(mixer.consumeParents);
    expect(isParentConsumed({ form: 'naga', element: 'badai' })).toBe(
      mixer.consumeParents && !mixer.protectLegendaryParents,
    );
  });
});

describe('mixOddsTable', () => {
  it('sums to 1 and shows the Adventure cap', () => {
    const table = mixOddsTable(
      { form: 'kucing', element: 'api' },
      { form: 'anjing', element: 'air' },
      { bossesDefeated: 0, pityStreak: 0 },
    );
    expect(table.maxTier).toBe(2);
    expect(table.tiers.map((t) => t.tier)).toEqual([1, 2]);
    expect(table.tiers.reduce((s, t) => s + t.probability, 0)).toBeCloseTo(1);
    expect(table.elements.reduce((s, e) => s + e.probability, 0)).toBeCloseTo(1);
    expect(table.elements[0]).toMatchObject({ source: 'fullUnion', element: 'uap' });
  });
});
