import type Phaser from 'phaser';
import type { SoldierKind } from '@soul-monster/shared';

/** Code-drawn soldiers (until painted art exists); rank shows as gold stripes on the chest. */
export function soldierTexture(scene: Phaser.Scene, s: SoldierKind): string {
  const key = `soldier:${s.kind}:${s.rank}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  const mounted = s.kind === 'penombak-berkuda';
  const W = mounted ? 56 : 36;
  const H = 56;
  // Riders sit on the horse's back; foot soldiers stand on the ground.
  const ox = mounted ? 14 : 2;
  const oy = mounted ? -2 : 0;
  g.fillStyle(0x000000, 0.22).fillEllipse(W / 2, 52, mounted ? 40 : 20, 6);
  if (mounted) {
    const horse = 0x8a5a36;
    g.fillStyle(0x4a2f1c).fillRect(12, 38, 4, 14).fillRect(20, 38, 4, 14);
    g.fillRect(34, 38, 4, 14).fillRect(42, 38, 4, 14);
    g.fillStyle(horse).fillRoundedRect(10, 26, 38, 16, 7);
    g.fillRoundedRect(4, 14, 12, 18, 4);
    g.fillStyle(0x4a2f1c).fillRect(6, 12, 10, 4).fillRect(46, 28, 6, 3);
    g.fillStyle(0x1b1530).fillRect(7, 19, 2, 2);
    g.fillStyle(0x3f6fb8).fillRect(20, 24, 18, 6);
  } else {
    g.fillStyle(0x2b2522)
      .fillRect(ox + 10, 36, 5, 13)
      .fillRect(ox + 17, 36, 5, 13);
  }
  const tunic = s.kind === 'pemanah' ? 0x3f9a45 : 0x3f6fb8;
  g.fillStyle(tunic).fillRoundedRect(ox + 8, oy + 21, 16, 18, 5);
  g.fillStyle(0x6b4026).fillRect(ox + 8, oy + 31, 16, 3);
  for (let i = 0; i < s.rank; i++) g.fillStyle(0xffcf40).fillRect(ox + 10, oy + 24 + i * 3, 12, 2);
  g.fillStyle(0xe0b088).fillCircle(ox + 16, oy + 14, 7);
  g.fillStyle(0x1b1530)
    .fillRect(ox + 11, oy + 13, 3, 2)
    .fillRect(ox + 18, oy + 13, 3, 2);
  if (s.kind === 'pemanah') {
    g.fillStyle(0x2f6b34).fillRect(ox + 9, oy + 6, 14, 5);
    g.lineStyle(2, 0x7a4a26, 1).beginPath();
    g.arc(ox + 27, oy + 28, 10, -Math.PI / 2, Math.PI / 2).strokePath();
    g.lineStyle(1, 0xf4f0e6, 1).lineBetween(ox + 27, oy + 18, ox + 27, oy + 38);
  } else {
    g.fillStyle(0xa8adb8).fillRect(ox + 9, oy + 6, 14, 5);
  }
  if (s.kind === 'prajurit') {
    g.fillStyle(0xc94a3b).fillRoundedRect(ox + 1, oy + 22, 9, 13, 3);
    g.fillStyle(0xffcf40).fillRect(ox + 4, oy + 26, 3, 5);
    g.lineStyle(3, 0xd9d9e0, 1).lineBetween(ox + 26, oy + 34, ox + 31, oy + 17);
  }
  if (mounted) {
    g.lineStyle(2, 0x7a4a26, 1).lineBetween(ox + 24, oy + 36, ox + 38, oy + 8);
    g.fillStyle(0xd9d9e0).fillTriangle(ox + 36, oy + 8, ox + 41, oy + 2, ox + 40, oy + 10);
  }
  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}
