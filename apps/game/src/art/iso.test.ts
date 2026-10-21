import { describe, expect, it } from 'vitest';
import { isoDrawOrder, rankBehindPoint } from './iso';

describe('isoDrawOrder', () => {
  it('draws a small building in front of a big one after it', () => {
    // A 4x4 hall at (12,12) and a 1x1 decoration right of its front-right wall.
    const hall = { id: 'hall', x: 12, y: 12, size: 4 };
    const deco = { id: 'deco', x: 16, y: 12, size: 1 };
    const behind = { id: 'behind', x: 15, y: 11, size: 1 };
    const order = isoDrawOrder([deco, hall, behind]);
    expect(order.get('deco')!).toBeGreaterThan(order.get('hall')!);
    expect(order.get('behind')!).toBeLessThan(order.get('hall')!);
  });

  it('places walkers after what they stand in front of', () => {
    const hall = { id: 'hall', x: 12, y: 12, size: 4 };
    const order = isoDrawOrder([hall]);
    expect(rankBehindPoint(16.5, 13.5, [hall], order)).toBe(0);
    expect(rankBehindPoint(11.5, 13.5, [hall], order)).toBe(-1);
  });
});
