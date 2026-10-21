import type Phaser from 'phaser';

/**
 * Canvas pixels per CSS pixel. The game draws at the screen's density (Windows 125/150 %
 * scaling, phones) so text stays sharp; cameras zoom by this, layouts stay in CSS px.
 */
export const dpr = (): number => Math.min(window.devicePixelRatio || 1, 3);

/** The game size in CSS pixels, which every layout works in. */
export function cssSize(scene: Phaser.Scene): { width: number; height: number } {
  const d = dpr();
  return { width: scene.scale.width / d, height: scene.scale.height / d };
}
