/**
 * pnpm art:iso <input.png> <size> <output.png> [--cutoff N]
 *
 * Normalises a generated isometric sprite to the game's art contract (see the
 * soul-monster-art-style skill):
 *  - alpha below the cutoff (default 12) becomes fully transparent, and hidden colour in
 *    transparent pixels is cleared (it would bleed into edges when the texture is scaled);
 *  - only the largest connected blob is kept (generators leave haze between grid cells);
 *  - the footprint diamond is measured from that blob (left/right corners and the
 *    bottom tip) and rescaled to exactly size·128 × size·64 px — a 2:1 diamond at 2× world
 *    scale, fixing generators that draw the ground slightly too steep or too flat;
 *  - the image is cropped so the diamond's bottom tip sits at the bottom centre.
 * Resampling is bilinear on premultiplied colour, so edges do not darken.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const cutoffAt = args.indexOf('--cutoff');
const cutoff = cutoffAt >= 0 ? Number(args[cutoffAt + 1]) : 12;
const positional =
  cutoffAt >= 0 ? args.filter((_, i) => i !== cutoffAt && i !== cutoffAt + 1) : args;
const [input, sizeArg, output] = positional;
const size = Number(sizeArg);
if (!input || !output || !Number.isInteger(size) || size < 1) {
  console.error('Pakai: pnpm art:iso <masukan.png> <ukuran ubin> <keluaran.png> [--cutoff N]');
  process.exit(1);
}

const src = PNG.sync.read(readFileSync(input));
const { width: W, height: H, data } = src;

// 1. Clean alpha.
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] < cutoff) data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
}

// 2. Keep only the building: the largest connected blob of solid pixels (alpha ≥ 224, plus a
// 1 px soft rim). Generated haze between grid cells sits around alpha 64–191 and is dropped.
const SOLID = 224;
const label = new Int32Array(W * H).fill(-1);
let best = -1;
let bestSize = 0;
for (let start = 0; start < W * H; start++) {
  if (label[start] !== -1 || data[start * 4 + 3] < SOLID) continue;
  const id = start;
  let size = 0;
  const stack = [start];
  label[start] = id;
  while (stack.length) {
    const p = stack.pop();
    size++;
    const x = p % W;
    const y = (p - x) / W;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (label[q] === -1 && data[q * 4 + 3] >= SOLID) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
  }
  if (size > bestSize) {
    bestSize = size;
    best = id;
  }
}
if (best < 0) {
  console.error('Gambar kosong setelah membersihkan alpha.');
  process.exit(1);
}
const keep = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  if (label[p] !== best) continue;
  const x = p % W;
  const y = (p - x) / W;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) keep[ny * W + nx] = 1;
    }
  }
}
for (let p = 0; p < W * H; p++) {
  if (!keep[p]) data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = data[p * 4 + 3] = 0;
}

// Measure the footprint: the outermost left/right columns are the base's side corners and
// the lowest pixel is its bottom tip. The corner is taken at the BOTTOM of the corner column,
// i.e. the lower edge of the ground slab, so slab thickness does not skew the 2:1 fit.
const solid = (x, y) => label[y * W + x] === best;
let minX = W;
let maxX = -1;
let maxY = -1;
let topY = H;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 0 && y < topY) topY = y;
    if (!solid(x, y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
}
const lowestAt = (x) => {
  for (let y = H - 1; y >= 0; y--) if (solid(x, y)) return y;
  return maxY;
};
const sideY = (lowestAt(minX) + lowestAt(maxX)) / 2;
const diamondW = maxX - minX + 1;
const halfH = maxY - sideY;
const ratio = diamondW / (2 * halfH);

// 3. Scale so the diamond is exactly size·128 wide and size·64 tall.
const outW = size * 128;
const sx = outW / diamondW;
const sy = (size * 64) / 2 / halfH;
const outH = Math.ceil((maxY - topY + 1) * sy);
const cx = (minX + maxX) / 2;

function sample(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const acc = [0, 0, 0, 0];
  for (const [dx, dy, w] of [
    [0, 0, (1 - fx) * (1 - fy)],
    [1, 0, fx * (1 - fy)],
    [0, 1, (1 - fx) * fy],
    [1, 1, fx * fy],
  ]) {
    const px = x0 + dx;
    const py = y0 + dy;
    if (px < 0 || py < 0 || px >= W || py >= H || w === 0) continue;
    const i = (py * W + px) * 4;
    const a = data[i + 3] / 255;
    acc[0] += data[i] * a * w;
    acc[1] += data[i + 1] * a * w;
    acc[2] += data[i + 2] * a * w;
    acc[3] += a * w;
  }
  if (acc[3] <= 0) return [0, 0, 0, 0];
  return [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], acc[3] * 255];
}

const out = new PNG({ width: outW, height: outH });
for (let oy = 0; oy < outH; oy++) {
  for (let ox = 0; ox < outW; ox++) {
    const x = cx + (ox + 0.5 - outW / 2) / sx - 0.5;
    const y = maxY + 0.5 - (outH - (oy + 0.5)) / sy;
    const [r, g, b, a] = sample(x, y);
    const o = (oy * outW + ox) * 4;
    const alpha = Math.round(a);
    out.data[o] = alpha < cutoff ? 0 : Math.round(r);
    out.data[o + 1] = alpha < cutoff ? 0 : Math.round(g);
    out.data[o + 2] = alpha < cutoff ? 0 : Math.round(b);
    out.data[o + 3] = alpha < cutoff ? 0 : alpha;
  }
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, PNG.sync.write(out));
console.log(
  `Berlian asli ${diamondW}×${Math.round(2 * halfH)} px (rasio ${ratio.toFixed(2)}:1) → ` +
    `${outW}×${size * 64}; skala x ${sx.toFixed(3)}, y ${sy.toFixed(3)}; keluaran ${outW}×${outH} px`,
);
