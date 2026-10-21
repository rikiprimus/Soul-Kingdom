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
    expect(p.total).toBe(66 + 23 + 4);
    expect(p.found).toBe(2 + 3 + 1);
    expect(p.ratio).toBeCloseTo(6 / 93);
  });

  it('starts empty', () => {
    expect(pediaProgress({ monsters: [], recipes: [] }).found).toBe(0);
  });
});
