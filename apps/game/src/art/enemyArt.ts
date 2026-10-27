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

/** Code-drawn goblin (Tugas 1C.9): small, blue-green, pointed ears, bone dagger, round shield. */
export function goblinTexture(scene: Phaser.Scene): string {
  const key = 'fx:goblin';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  const skin = 0x5fae9a;
  g.fillStyle(0x000000, 0.22).fillEllipse(16, 49, 18, 6);
  g.fillStyle(0x3a2f26).fillRect(11, 40, 4, 9).fillRect(17, 40, 4, 9);
  g.fillStyle(0x6b5a3a).fillRoundedRect(9, 28, 14, 14, 4);
  g.fillStyle(skin).fillCircle(16, 21, 8);
  // Pointed ears.
  g.fillTriangle(8, 19, 1, 14, 9, 23).fillTriangle(24, 19, 31, 14, 23, 23);
  g.fillStyle(0xffe066).fillRect(12, 19, 3, 3).fillRect(18, 19, 3, 3);
  g.fillStyle(0x1b1530).fillRect(13, 20, 1, 1).fillRect(19, 20, 1, 1);
  // Round wooden shield and a bone dagger.
  g.fillStyle(0x8a5a32).fillCircle(7, 34, 6);
  g.fillStyle(0x5a3a20).fillCircle(7, 34, 2);
  g.lineStyle(3, 0xeae2cc, 1).lineBetween(24, 36, 29, 26);
  g.generateTexture(key, 32, 52);
  g.destroy();
  return key;
}
