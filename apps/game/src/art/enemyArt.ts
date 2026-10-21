import type Phaser from 'phaser';

/** Code-drawn bandit (wild enemies, raids and Serbu bases). */
export function banditTexture(scene: Phaser.Scene): string {
  const key = 'fx:bandit';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0x000000, 0.22).fillEllipse(16, 49, 20, 6);
  g.fillStyle(0x2b2522).fillRect(10, 36, 5, 13).fillRect(17, 36, 5, 13);
  g.fillStyle(0x4a3f5c).fillRoundedRect(8, 21, 16, 18, 5);
  g.fillStyle(0x6b4026).fillRect(8, 31, 16, 3);
  g.fillStyle(0xe0b088).fillCircle(16, 14, 7);
  g.fillStyle(0xb8322a).fillRect(9, 11, 14, 4);
  g.fillStyle(0x1b1530).fillRect(11, 12, 3, 2).fillRect(18, 12, 3, 2);
  g.lineStyle(3, 0x7a4a26, 1).lineBetween(25, 34, 30, 18);
  g.generateTexture(key, 32, 52);
  g.destroy();
  return key;
}
