import { gameData, type ElementId } from '@soul-monster/shared';

/** Display colour of each element (visual only, not game data). */
export const UNIT_COLORS: Record<string, number> = {
  normal: 0xa8a878,
  api: 0xf08030,
  air: 0x6890f0,
  angin: 0x4dd0e1,
  tanah: 0x8d6e63,
  lightning: 0xffd700,
  ice: 0x80deea,
  nature: 0x4caf50,
  dark: 0x424254,
  magma: 0xff5722,
  light: 0xffd54f,
  arcane: 0xba68c8,
  void: 0x4a148c,
  // legacy aliases
  cahaya: 0xffd54f,
  kegelapan: 0x424254,
};

export const unitColor = (unit: string) => {
  const el = gameData.elementById.get(unit);
  if (el?.color) {
    const parsed = parseInt(el.color.replace('#', ''), 16);
    if (!isNaN(parsed)) return parsed;
  }
  return UNIT_COLORS[unit] ?? 0xa8a878;
};

export function elementColors(element: ElementId): number[] {
  return [unitColor(element)];
}

/** Main colour used for auras and accents. */
export function elementColor(element: ElementId): number {
  return elementColors(element)[0] ?? 0xa8a878;
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
