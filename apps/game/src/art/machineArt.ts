import type Phaser from 'phaser';

/**
 * Code-drawn war machines (until painted art exists): a Ketapel (catapult) or a Pendobrak
 * (battering ram). Higher versions get iron fittings, then fire and gold trim.
 */
export function machineTexture(scene: Phaser.Scene, kind: string, level: number): string {
  const tier = level >= 4 ? 2 : level >= 3 ? 1 : 0;
  const key = `machine:${kind}:${tier}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  const W = 64;
  const H = 52;
  const wood = 0x8a5a32;
  const dark = 0x5a3a20;
  const metal = tier >= 1 ? 0x7d828c : wood;
  g.fillStyle(0x000000, 0.22).fillEllipse(W / 2, 48, 52, 7);
  // Wheels.
  for (const x of [16, 48]) {
    g.fillStyle(dark).fillCircle(x, 42, 7);
    g.fillStyle(metal).fillCircle(x, 42, 3);
  }
  if (kind === 'pendobrak') {
    // A roofed frame on wheels with a heavy ram hanging inside.
    g.fillStyle(wood).fillRect(8, 30, 48, 8);
    g.fillStyle(dark).fillRect(10, 14, 4, 18).fillRect(50, 14, 4, 18);
    g.fillStyle(tier >= 2 ? 0xc94a3b : 0x6b4026).fillTriangle(4, 16, 60, 16, 32, 2);
    g.fillStyle(0x6b4026).fillRoundedRect(4, 22, 52, 7, 3);
    g.fillStyle(metal).fillRect(0, 21, 8, 9);
    if (tier >= 2) g.fillStyle(0xffcf40).fillRect(0, 21, 3, 9);
  } else {
    // A frame with a throwing arm, the bucket raised behind it.
    g.fillStyle(wood).fillRect(8, 32, 48, 7);
    g.fillStyle(dark).fillTriangle(22, 33, 42, 33, 32, 14);
    g.lineStyle(4, 0x6b4026, 1).lineBetween(14, 30, 52, 6);
    g.fillStyle(metal).fillCircle(52, 6, 5);
    if (tier >= 2) {
      g.fillStyle(0xff6b35).fillCircle(52, 4, 4);
      g.fillStyle(0xffe066).fillCircle(52, 4, 2);
    } else {
      g.fillStyle(0xa99c82).fillCircle(52, 4, 3);
    }
    if (tier >= 1) g.fillStyle(metal).fillRect(30, 18, 4, 4);
  }
  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}
