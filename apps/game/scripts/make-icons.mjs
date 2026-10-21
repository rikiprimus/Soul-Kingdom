// Draws the temporary app icon with code (no external art) and writes PNGs to public/icons.
// Run: pnpm --filter @soul-monster/game icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** Encodes RGBA pixels as a PNG. */
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const inTri = (px, py, a, b, c) => {
  const s = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = s([px, py], a, b);
  const d2 = s([px, py], b, c);
  const d3 = s([px, py], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

/**
 * Colour of a point in unit space (0..1). `maskable` keeps the art inside the 80%
 * safe zone and fills the background to the edges.
 */
function shade(u, v, maskable) {
  const k = maskable ? 0.78 : 1;
  const x = (u - 0.5) / k + 0.5;
  const y = (v - 0.5) / k + 0.5;
  // Background: rounded square (full bleed for maskable), purple vertical gradient.
  const r = maskable ? 0 : 0.2;
  const qx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0);
  const qy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
  if (!maskable && Math.hypot(qx, qy) > r) return null;
  const top = hex(0x3a2f63);
  const bottom = hex(0x16112a);
  let c = top.map((t, i) => t + (bottom[i] - t) * v);
  // Soft glow behind the monster.
  const glow = Math.max(0, 1 - Math.hypot(x - 0.5, y - 0.55) / 0.42);
  c = c.map((ch, i) => ch + (hex(0x8a6cff)[i] - ch) * glow * 0.45);
  const fire = hex(0xff6b35);
  const dark = hex(0x6b2a14);
  const ears = [
    [
      [0.3, 0.42],
      [0.36, 0.2],
      [0.47, 0.36],
    ],
    [
      [0.7, 0.42],
      [0.64, 0.2],
      [0.53, 0.36],
    ],
  ];
  if (ears.some(([a, b, cc]) => inTri(x, y, a, b, cc))) c = fire;
  const head = Math.hypot(x - 0.5, y - 0.55);
  if (head < 0.27) c = head > 0.255 ? dark : fire;
  if (Math.hypot(x - 0.5, (y - 0.68) * 1.4) < 0.13) c = hex(0xffb38a); // muzzle
  for (const ex of [0.4, 0.6]) {
    const e = Math.hypot(x - ex, (y - 0.52) * 0.85);
    if (e < 0.075) c = e < 0.04 ? hex(0x1a1030) : hex(0xffffff);
    if (Math.hypot(x - ex + 0.015, y - 0.505) < 0.014) c = hex(0xffffff);
  }
  return c;
}

function draw(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const ss = 3; // supersampling for smooth edges
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let aa = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = shade((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, maskable);
          if (!c) continue;
          rr += c[0];
          gg += c[1];
          bb += c[2];
          aa += 1;
        }
      }
      const i = (py * size + px) * 4;
      const n = ss * ss;
      if (aa > 0) {
        rgba[i] = Math.round(rr / aa);
        rgba[i + 1] = Math.round(gg / aa);
        rgba[i + 2] = Math.round(bb / aa);
      }
      rgba[i + 3] = Math.round((aa / n) * 255);
    }
  }
  return png(size, rgba);
}

mkdirSync(outDir, { recursive: true });
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
]) {
  writeFileSync(join(outDir, name), draw(size, maskable));
  console.log('wrote', name);
}
