import { describe, expect, it } from 'vitest';
import { pediaProgress } from './pedia';

describe('pediaProgress', () => {
  it('counts unique elements, forms and recipes', () => {
    const p = pediaProgress({
      monsters: ['kucing:api', 'anjing:api', 'naga:uap'],
      recipes: ['naga-uap'],
    });
    expect([...p.elements].sort()).toEqual(['api', 'uap']);
    expect([...p.forms].sort()).toEqual(['anjing', 'kucing', 'naga']);
    expect(p.total).toBe(p.monsterCount + p.recipeCount);
    expect(p.found).toBe(p.discoveredSpecies.size + p.recipes.size);
    expect(p.ratio).toBeCloseTo(p.found / p.total);
  });

  it('starts empty', () => {
    expect(pediaProgress({ monsters: [], recipes: [] }).found).toBe(0);
  });
});
