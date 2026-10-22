import { elementUnits, type ElementId } from '@soul-monster/shared';

/** Display colour of each base unit (visual only, not game data). */
export const UNIT_COLORS: Record<string, number> = {
  api: 0xff6b35,
  air: 0x3fa7ff,
  tanah: 0xa8743f,
  angin: 0x7fe0b0,
  cahaya: 0xffe066,
  kegelapan: 0x7b4bb3,
};

export const unitColor = (unit: string) => UNIT_COLORS[unit] ?? 0xcccccc;

export function elementColors(element: ElementId): number[] {
  return elementUnits(element).map(unitColor);
}

/** Main colour used for auras and accents. */
export function elementColor(element: ElementId): number {
  return elementColors(element)[0] ?? 0xcccccc;
}

/** Ground colours per island (islands.json ids): two tile shades, a light spot, the edge. */
export const ISLAND_GROUND: Record<
  string,
  { tiles: [number, number]; light: number; edge: number; flowers: boolean }
> = {
  utama: { tiles: [0x78c350, 0x70bb49], light: 0x80c95a, edge: 0x5a9e3a, flowers: true },
  gurun: { tiles: [0xe6c47e, 0xdfbb72], light: 0xeed392, edge: 0xb8955a, flowers: false },
  salju: { tiles: [0xe9eff6, 0xdfe7f0], light: 0xf6f9fc, edge: 0xa9b8c8, flowers: false },
};
