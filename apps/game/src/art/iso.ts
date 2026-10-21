/** Isometric tile size in world pixels (2:1 diamonds). */
export const TILE_W = 64;
export const TILE_H = 32;

/** Tile-corner coordinates (u, v) → world pixels. Tile (i, j) spans corners i..i+1, j..j+1. */
export function isoToWorld(u: number, v: number): { x: number; y: number } {
  return { x: (u - v) * (TILE_W / 2), y: (u + v) * (TILE_H / 2) };
}

/** World pixels → fractional tile-corner coordinates. */
export function worldToIso(x: number, y: number): { u: number; v: number } {
  const a = x / (TILE_W / 2);
  const b = y / (TILE_H / 2);
  return { u: (a + b) / 2, v: (b - a) / 2 };
}

/** World position of the center of a size×size footprint whose top tile is (x, y). */
export function footprintCenter(x: number, y: number, size: number) {
  return isoToWorld(x + size / 2, y + size / 2);
}

export interface Footprint {
  id: string;
  x: number;
  y: number;
  size: number;
}

/** True if footprint `a` must be drawn before `b` (a lies behind b along u or v). */
function isBehind(a: Footprint, b: Footprint): boolean {
  return (a.x + a.size <= b.x && a.y < b.y + b.size) || (a.y + a.size <= b.y && a.x < b.x + b.size);
}

/**
 * Draw order for non-overlapping footprints of different sizes (a topological sort of
 * the "behind" relation). Sorting by a single corner breaks for large buildings next to
 * small ones; this does not. Returns id → rank (0 = drawn first).
 */
export function isoDrawOrder(items: readonly Footprint[]): Map<string, number> {
  const order = new Map<string, number>();
  const visiting = new Set<string>();
  let rank = 0;
  const visit = (item: Footprint) => {
    if (order.has(item.id) || visiting.has(item.id)) return;
    visiting.add(item.id);
    for (const other of items) if (other !== item && isBehind(other, item)) visit(other);
    visiting.delete(item.id);
    order.set(item.id, rank++);
  };
  for (const item of items) visit(item);
  return order;
}

/** Highest rank among footprints that a point (u, v) stands in front of, or -1. */
export function rankBehindPoint(
  u: number,
  v: number,
  items: readonly Footprint[],
  order: ReadonlyMap<string, number>,
): number {
  let best = -1;
  for (const f of items) {
    const inFront = (u >= f.x + f.size && v > f.y) || (v >= f.y + f.size && u > f.x);
    if (inFront) best = Math.max(best, order.get(f.id) ?? -1);
  }
  return best;
}
