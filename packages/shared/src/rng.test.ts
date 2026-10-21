import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(createRng('soul').next()).toBe(createRng('soul').next());
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('continues from a saved state', () => {
    const rng = createRng(99);
    for (let i = 0; i < 10; i++) rng.next();
    const resumed = createRng(rng.getState());
    const fromResumed = Array.from({ length: 10 }, () => resumed.next());
    const fromOriginal = Array.from({ length: 10 }, () => rng.next());
    expect(fromResumed).toEqual(fromOriginal);
  });

  it('spreads int() evenly across its range', () => {
    const rng = createRng(7);
    const counts: number[] = new Array(6).fill(0);
    const n = 120_000;
    for (let i = 0; i < n; i++) counts[rng.int(1, 6) - 1]!++;
    for (const c of counts) expect(Math.abs(c / n - 1 / 6)).toBeLessThan(0.01);
  });

  it('keeps next() in [0, 1) with a mean near 0.5', () => {
    const rng = createRng(42);
    let sum = 0;
    let outside = 0;
    for (let i = 0; i < 100_000; i++) {
      const x = rng.next();
      if (x < 0 || x >= 1) outside++;
      sum += x;
    }
    expect(outside).toBe(0);
    expect(Math.abs(sum / 100_000 - 0.5)).toBeLessThan(0.005);
  });

  it('honours chance(), pick() and shuffle()', () => {
    const rng = createRng(3);
    let hits = 0;
    for (let i = 0; i < 100_000; i++) if (rng.chance(0.3)) hits++;
    expect(Math.abs(hits / 100_000 - 0.3)).toBeLessThan(0.01);
    expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']));
    expect(rng.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(() => rng.pick([])).toThrow();
    expect(() => rng.int(5, 1)).toThrow();
  });
});
