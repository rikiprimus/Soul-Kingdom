import type { Rarity } from '@soul-monster/shared';

/** Rounded game font (self-hosted via @fontsource, works offline on Android). */
export const FONT = 'Fredoka, system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export const COLORS = {
  background: 0x16112a,
  backgroundTop: 0x241a45,
  panel: 0x2a2148,
  panelLight: 0x3a2f63,
  panelDark: 0x1d1736,
  stroke: 0x4b3f7d,
  accent: 0x8a6cff,
  accentDark: 0x5b43c7,
  good: 0x3ccf91,
  warn: 0xffb347,
  danger: 0xff5c7a,
  gold: 0xf5c542,
  goldDark: 0xa87b14,
  text: 0xf4f0ff,
  textDim: 0xb4aad6,
  disabled: 0x4a4466,
  gem: 0x4de3ff,
  crystal: 0xc77dff,
  food: 0x7ed957,
  wood: 0xc68642,
  stone: 0xa8adb8,
} as const;

export const RARITY_COLORS: Record<Rarity, number> = {
  biasa: 0x9aa0b4,
  langka: 0x4fc3f7,
  epik: 0xc77dff,
  legenda: 0xffc83d,
};

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Text style factory; resolution keeps text crisp on high-density screens. */
export function textStyle(
  size: number,
  color: number = COLORS.text,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: hex(color),
    resolution: Math.min(window.devicePixelRatio || 1, 3),
    ...extra,
  };
}
