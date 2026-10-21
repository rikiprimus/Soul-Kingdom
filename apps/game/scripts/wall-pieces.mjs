/**
 * pnpm art:wall <sheet.png> <config.json> <outDir> [--cutoff N]
 *
 * Turns generated wall art (one post and one long straight wall section per level, the section
 * running from upper-left to lower-right) into the pieces the game joins into lines of wall:
 *   lv<n>-post.png                    the post, centred on the tile
 *   lv<n>-seg-xn.png / lv<n>-seg-xp.png  half a tile of wall towards −x / +x
 *   lv<n>-seg-yn.png / lv<n>-seg-yp.png  the same, mirrored for the y direction (slightly darker,
 *                                      since that face is turned away from the light)
 * Every piece is a 128 px wide canvas (one tile at 2× world scale) with the bottom tip of the tile
 * diamond at the bottom centre, so the game can stack them on one texture.
 *
 * config.json: { "scale"?: number, "levels": [{ "level": 1, "post": [x, y, w, h], "segment": [x, y, w, h] }] }
 * Rectangles are cells of the sheet; only the largest solid blob in each cell is used.
 * One scale is used for every level so the levels keep their relative sizes; it is raised
 * when needed so a full tile of wall fits inside each section.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const cutoffAt = args.indexOf('--cutoff');
const cutoff = cutoffAt >= 0 ? Number(args[cutoffAt + 1]) : 12;
const positional =
  cutoffAt >= 0 ? args.filter((_, i) => i !== cutoffAt && i !== cutoffAt + 1) : args;
const [sheetPath, configPath, outDir] = positional;
if (!sheetPath || !configPath || !outDir) {
  console.error('Pakai: pnpm art:wall <lembar.png> <config.json> <folder keluaran> [--cutoff N]');
  process.exit(1);
}

const TILE = 128; // tile width in the PNG (2× world)
const HALF_W = TILE / 4; // horizontal span of half a tile of wall: centre → edge midpoint
const BELOW = 32; // tile diamond half-height below its centre
const SOLID = 224;
const MIRROR_SHADE = 0.85;

const sheet = PNG.sync.read(readFileSync(sheetPath));
const config = JSON.parse(readFileSync(configPath, 'utf8'));

/** Cell of the sheet with weak alpha removed and only its largest solid blob kept. */
function cell([x0, y0, w, h]) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y0 + y) * sheet.width + x0 + x) * 4;
      const d = (y * w + x) * 4;
      if (sheet.data[s + 3] < cutoff) continue;
      for (let c = 0; c < 4; c++) data[d + c] = sheet.data[s + c];
    }
  }
  const label = new Int32Array(w * h).fill(-1);
  let best = -1;
  let bestSize = 0;
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < SOLID) continue;
    let size = 0;
    const stack = [start];
    label[start] = start;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (label[q] === -1 && data[q * 4 + 3] >= SOLID) {
            label[q] = start;
            stack.push(q);
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = start;
    }
  }
  if (best < 0) throw new Error(`Sel ${[x0, y0, w, h]} kosong.`);
  const keep = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== best) continue;
    const x = p % w;
    const y = (p - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) keep[ny * w + nx] = 1;
      }
    }
  }
  for (let p = 0; p < w * h; p++) if (!keep[p]) data.fill(0, p * 4, p * 4 + 4);
  const solid = (x, y) => label[y * w + x] === best;
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const lowest = (x) => {
    for (let y = h - 1; y >= 0; y--) if (solid(x, y)) return y;
    return -1;
  };
  let lowX = 0;
  let n = 0;
  for (let x = minX; x <= maxX; x++) {
    if (lowest(x) === maxY) {
      lowX += x;
      n++;
    }
  }
  return { w, h, data, minX, maxX, minY, maxY, lowX: lowX / n, lowest };
}

function sample(img, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const acc = [0, 0, 0, 0];
  for (const [dx, dy, wt] of [
    [0, 0, (1 - fx) * (1 - fy)],
    [1, 0, fx * (1 - fy)],
    [0, 1, (1 - fx) * fy],
    [1, 1, fx * fy],
  ]) {
    const px = x0 + dx;
    const py = y0 + dy;
    if (px < 0 || py < 0 || px >= img.w || py >= img.h || wt === 0) continue;
    const i = (py * img.w + px) * 4;
    const a = img.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) acc[c] += img.data[i + c] * a * wt;
    acc[3] += a * wt;
  }
  if (acc[3] <= 0) return [0, 0, 0, 0];
  return [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], acc[3] * 255];
}

/** Measures one level: where the post's footprint centre is, and the wall section's ground line. */
function measure(level) {
  const post = cell(level.post);
  const postW = post.maxX - post.minX + 1;
  // A square post's footprint is a small 2:1 diamond: its centre sits a quarter of its width
  // above the lowest (front) corner.
  const postC = { x: post.lowX, y: post.maxY - postW / 4 };

  const seg = cell(level.segment);
  // The body runs from the left end to the front-bottom corner; right of that is the end face,
  // whose width equals the wall's thickness on screen.
  const bodyX0 = seg.minX;
  const bodyX1 = seg.lowX;
  const endFace = seg.maxX - seg.lowX;
  // Least-squares fit of the bottom edge over the middle 80 % of the body.
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let n = 0;
  const span = bodyX1 - bodyX0;
  for (let x = Math.round(bodyX0 + span * 0.1); x <= bodyX1 - span * 0.1; x++) {
    const y = seg.lowest(x);
    if (y < 0) continue;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
    n++;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const xm = (bodyX0 + bodyX1) / 2;
  // The wall's centre line lies above its front-bottom edge by half the end face's width.
  const segC = { x: xm, y: intercept + slope * xm - endFace / 2 };
  return { level: level.level, post, postC, seg, segC, slope, bodyWidth: span };
}

const measured = config.levels.map(measure);
const fitScale = Math.max(...measured.map((m) => (2 * HALF_W + 4) / (m.bodyWidth - 8)));
const scale = Math.max(config.scale ?? 0, fitScale);

mkdirSync(outDir, { recursive: true });
for (const m of measured) {
  const s = scale;
  const above = Math.max(m.postC.y - m.post.minY, m.segC.y - m.seg.minY) * s;
  const H = Math.ceil(above + BELOW + 4);
  const cy = H - BELOW;
  const cx = TILE / 2;
  const piece = (fn) => {
    const out = new PNG({ width: TILE, height: H });
    for (let oy = 0; oy < H; oy++) {
      for (let ox = 0; ox < TILE; ox++) {
        const px = fn(ox + 0.5 - cx, oy + 0.5 - cy);
        if (!px) continue;
        const o = (oy * TILE + ox) * 4;
        const a = Math.round(px[3]);
        if (a < cutoff) continue;
        out.data[o] = Math.round(px[0]);
        out.data[o + 1] = Math.round(px[1]);
        out.data[o + 2] = Math.round(px[2]);
        out.data[o + 3] = a;
      }
    }
    return out;
  };
  const post = piece((dx, dy) =>
    sample(m.post, m.postC.x + dx / s - 0.5, m.postC.y + dy / s - 0.5),
  );
  // Section half: source column from dx; the slope is sheared to exactly 2:1 so tiles line up.
  const half = (from, to) =>
    piece((dx, dy) => {
      if (dx < from - 0.5 || dx > to + 0.5) return null;
      const x = m.segC.x + dx / s;
      const y = m.segC.y + dy / s + (m.slope - 0.5) * (x - m.segC.x);
      return sample(m.seg, x - 0.5, y - 0.5);
    });
  const xn = half(-HALF_W, 0);
  const xp = half(0, HALF_W);
  const mirror = (src) => {
    const out = new PNG({ width: TILE, height: H });
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < TILE; x++) {
        const i = (y * TILE + (TILE - 1 - x)) * 4;
        const o = (y * TILE + x) * 4;
        for (let c = 0; c < 3; c++) out.data[o + c] = Math.round(src.data[i + c] * MIRROR_SHADE);
        out.data[o + 3] = src.data[i + 3];
      }
    }
    return out;
  };
  const files = {
    post,
    'seg-xn': xn,
    'seg-xp': xp,
    // −x runs to the upper-left, so its mirror runs to the upper-right: −y. Likewise +x → +y.
    'seg-yn': mirror(xn),
    'seg-yp': mirror(xp),
  };
  for (const [name, png] of Object.entries(files)) {
    writeFileSync(join(outDir, `lv${m.level}-${name}.png`), PNG.sync.write(png));
  }
  console.log(
    `Lv ${m.level}: kemiringan asli ${m.slope.toFixed(3)} → 0,5; tiang ${m.post.maxX - m.post.minX + 1} px, ` +
      `badan tembok ${m.bodyWidth} px; skala ${s.toFixed(3)}; kanvas ${TILE}×${H}`,
  );
}
