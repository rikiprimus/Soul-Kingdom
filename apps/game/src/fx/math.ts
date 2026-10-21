/** Pure helpers behind the game-feel effects (kept free of Phaser so they can be tested). */

export type FeelTier = 'small' | 'medium' | 'large';

/**
 * Importance tiers (see the game-feel skill): every juicy event is assigned one, so the
 * whole village stays proportional — a tap is not a level-up.
 */
export const TIERS: Record<FeelTier, { squash: number; popMs: number; particles: number }> = {
  small: { squash: 0.08, popMs: 180, particles: 0 },
  medium: { squash: 0.16, popMs: 260, particles: 10 },
  large: { squash: 0.24, popMs: 380, particles: 24 },
};

/** Point on a quadratic arc from a to b that bulges `lift` px upward at the middle. */
export function arcPoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  lift: number,
  t: number,
): { x: number; y: number } {
  const cx = (ax + bx) / 2;
  const cy = Math.min(ay, by) - lift;
  const u = 1 - t;
  return {
    x: u * u * ax + 2 * u * t * cx + t * t * bx,
    y: u * u * ay + 2 * u * t * cy + t * t * by,
  };
}

/** Counter value while counting from `from` to `to` (ease-out, whole numbers, ends exactly on `to`). */
export function countUp(from: number, to: number, t: number): number {
  if (t >= 1) return to;
  const k = 1 - (1 - Math.max(0, t)) ** 3;
  return Math.round(from + (to - from) * k);
}

/** How many icons fly to the HUD for an amount: a few for small sums, at most 6. */
export function flyIconCount(amount: number): number {
  if (amount <= 0) return 0;
  return Math.min(6, 2 + Math.floor(Math.log10(amount)));
}
