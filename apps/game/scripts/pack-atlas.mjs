/**
 * pnpm atlas — packs the source art into Phaser texture atlases.
 *
 * Every folder in apps/game/art/ (e.g. art/buildings/, art/ui/) becomes one atlas:
 * public/atlas/<folder>.png + public/atlas/<folder>.json (Phaser 3 multi-atlas format),
 * and public/atlas/atlases.json lists them for the game to load.
 * Frame names are the file paths inside the folder without extension, so
 * art/buildings/balai-utama/lv1.png becomes the frame "balai-utama/lv1".
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packAsync } from 'free-tex-packer-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'art');
const target = join(root, 'public', 'atlas');

/** All PNG files below `dir`, recursively. */
function pngs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pngs(path);
    return name.toLowerCase().endsWith('.png') ? [path] : [];
  });
}

const options = {
  width: 2048,
  height: 2048,
  fixedSize: false,
  powerOfTwo: true,
  padding: 2,
  extrude: 1,
  allowRotation: false,
  detectIdentical: true,
  allowTrim: true,
  exporter: 'Phaser3',
  removeFileExtension: true,
  prependFolderName: true,
};

let folders = [];
try {
  folders = readdirSync(source).filter((name) => statSync(join(source, name)).isDirectory());
} catch {
  console.log(`Folder seni belum ada: ${relative(process.cwd(), source)}`);
  process.exit(0);
}

mkdirSync(target, { recursive: true });
const packed = [];
for (const folder of folders) {
  const files = pngs(join(source, folder));
  if (files.length === 0) {
    console.log(`  ${folder}: kosong, dilewati`);
    continue;
  }
  packed.push(folder);
  const images = files.map((path) => ({
    path: relative(join(source, folder), path).replaceAll('\\', '/'),
    contents: readFileSync(path),
  }));
  const output = await packAsync(images, { ...options, textureName: folder });
  for (const file of output) writeFileSync(join(target, file.name), file.buffer);
  console.log(`  ${folder}: ${files.length} gambar → ${output.map((f) => f.name).join(', ')}`);
}
// The game loads exactly the atlases listed here (an empty list is fine).
writeFileSync(join(target, 'atlases.json'), `${JSON.stringify(packed)}\n`);
console.log(`  atlases.json: [${packed.join(', ')}]`);
