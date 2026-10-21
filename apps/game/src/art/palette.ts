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
