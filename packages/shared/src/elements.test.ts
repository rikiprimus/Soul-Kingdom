import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import {
  capElementForFormTier,
  capUnits,
  elementAdvantage,
  elementUnits,
  findElementByComposition,
  unionComposition,
} from './elements';
import { rarityOf } from './monster';
import { createRng } from './rng';

const mix = (a: string, b: string) => findElementByComposition(unionComposition(a, b));

describe('element engine', () => {
  it('combines compositions', () => {
    expect(mix('uap', 'tanah')).toBe('geiser');
    expect(mix('uap', 'lava')).toBe('geiser');
    expect(mix('api', 'api')).toBe('api');
    expect(mix('semesta', 'api')).toBe('semesta');
    expect(mix('waktu', 'supernova')).toBe('semesta');
  });

  it('never finds secret elements by composition', () => {
    for (const el of gameData.elements.elements.filter((e) => e.secret)) {
      const found = findElementByComposition(el.composition);
      expect(found).toBeDefined();
      expect(found).not.toBe(el.id);
    }
    expect(findElementByComposition(['api', 'angin', 'cahaya', 'kegelapan'])).toBe('plasma');
  });

  it('lists element units in base order', () => {
    expect(elementUnits('uap')).toEqual(['api', 'air']);
    expect(elementUnits('semesta')).toHaveLength(6);
    expect(() => elementUnits('bukan-elemen')).toThrow();
  });

  it('caps elements to the form tier limit', () => {
    const rng = createRng(5);
    for (let i = 0; i < 200; i++) {
      const capped = capElementForFormTier('semesta', 2, rng);
      expect(elementUnits(capped)).toHaveLength(2);
    }
    expect(capElementForFormTier('uap', 2, rng)).toBe('uap');
    expect(elementUnits(capElementForFormTier('geiser', 1, rng))).toHaveLength(1);
    // Secret elements are only allowed on tier 5 forms.
    expect(capElementForFormTier('petir-hitam', 5, rng)).toBe('petir-hitam');
    expect(capElementForFormTier('petir-hitam', 4, rng)).toBe('plasma');
  });

  it('keeps protected units while capping', () => {
    const rng = createRng(8);
    for (let i = 0; i < 200; i++) {
      expect(capUnits(['api', 'air', 'tanah', 'angin'], 2, rng, ['angin'])).toContain('angin');
    }
  });

  it('computes elemental advantage', () => {
    expect(elementAdvantage('api', 'angin')).toBeGreaterThan(1);
    expect(elementAdvantage('angin', 'api')).toBeLessThan(1);
    expect(elementAdvantage('api', 'api')).toBe(1);
    expect(elementAdvantage('api', 'angin')).toBe(1 + gameData.rules.battle.advantageStep);
    // Es (air+angin) vs Lava (api+tanah): air>api, angin>tanah, tanah>air, api>angin → 0.
    expect(elementAdvantage('es', 'lava')).toBe(1);
    // Uap (api+air) vs Asap (api+angin): api>angin, air>api → +2.
    expect(elementAdvantage('uap', 'asap')).toBe(1 + 2 * gameData.rules.battle.advantageStep);
  });

  it('respects the damage multiplier bounds', () => {
    const { advantageMin, advantageMax } = gameData.rules.battle;
    const ids = gameData.elements.elements.map((e) => e.id);
    let max = -Infinity;
    let min = Infinity;
    for (const a of ids) {
      for (const d of ids) {
        const m = elementAdvantage(a, d);
        max = Math.max(max, m);
        min = Math.min(min, m);
      }
    }
    expect(max).toBeLessThanOrEqual(advantageMax);
    expect(min).toBeGreaterThanOrEqual(advantageMin);
  });
});

describe('rarityOf', () => {
  it('follows rules.rarity', () => {
    expect(rarityOf({ form: 'kucing', element: 'api' })).toBe('biasa');
    expect(rarityOf({ form: 'serigala', element: 'uap' })).toBe('langka');
    expect(rarityOf({ form: 'elang', element: 'geiser' })).toBe('epik');
    expect(rarityOf({ form: 'naga', element: 'badai' })).toBe('legenda');
    expect(rarityOf({ form: 'titan', element: 'api' })).toBe('legenda');
    expect(rarityOf({ form: 'titan', element: 'petir-hitam' })).toBe('legenda');
  });
});
