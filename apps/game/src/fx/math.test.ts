import { describe, expect, it } from 'vitest';
import { arcPoint, countUp, flyIconCount, TIERS } from './math';

describe('game-feel helpers', () => {
  it('arcs from start to end, bulging upward in between', () => {
    expect(arcPoint(0, 100, 200, 0, 40, 0)).toEqual({ x: 0, y: 100 });
    expect(arcPoint(0, 100, 200, 0, 40, 1)).toEqual({ x: 200, y: 0 });
    const mid = arcPoint(0, 100, 200, 100, 40, 0.5);
    expect(mid.x).toBe(100);
    expect(mid.y).toBeLessThan(100);
  });

  it('counts up with ease-out and lands exactly on the target', () => {
    expect(countUp(10, 110, 0)).toBe(10);
    expect(countUp(10, 110, 1)).toBe(110);
    expect(countUp(10, 110, 0.5)).toBeGreaterThan(60);
    let last = 10;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = countUp(10, 110, t);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('sends a few icons for small sums and caps the swarm', () => {
    expect(flyIconCount(0)).toBe(0);
    expect(flyIconCount(5)).toBe(2);
    expect(flyIconCount(150)).toBe(4);
    expect(flyIconCount(1_000_000)).toBe(6);
  });

  it('keeps the tiers proportional', () => {
    expect(TIERS.small.squash).toBeLessThan(TIERS.medium.squash);
    expect(TIERS.medium.squash).toBeLessThan(TIERS.large.squash);
    expect(TIERS.small.particles).toBeLessThan(TIERS.medium.particles);
    expect(TIERS.medium.particles).toBeLessThan(TIERS.large.particles);
  });
});
