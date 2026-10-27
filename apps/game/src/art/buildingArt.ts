import Phaser from 'phaser';
import { gameData } from '@soul-monster/shared';
import { darken, lighten } from '../ui/widgets';
import { TILE_H, TILE_W } from './iso';

/** Building textures are drawn at this multiple of world size, for crisp zooming. */
export const BUILDING_RES = 2;

type Pt = { x: number; y: number };
type G = Phaser.GameObjects.Graphics;

export type BuildingVariant =
  | 'normal'
  | 'crop-empty'
  | 'crop-growing'
  | 'crop-ready'
  /** Wall joined to its neighbours: bit 1 = +x, 2 = +y, 4 = -x, 8 = -y. */
  | `wall-${number}`
  /** Peternakan holding this many animals. */
  | `ranch-${number}`
  /** Gerbang with its wall neighbours (same bits as walls), open or shut. */
  | `gate-${number}-${'open' | 'closed'}`;

/** Connection mask for a wall at (x, y) given the set of wall tiles ("x,y"). */
export function wallMask(x: number, y: number, walls: ReadonlySet<string>): number {
  return (
    (walls.has(`${x + 1},${y}`) ? 1 : 0) |
    (walls.has(`${x},${y + 1}`) ? 2 : 0) |
    (walls.has(`${x - 1},${y}`) ? 4 : 0) |
    (walls.has(`${x},${y - 1}`) ? 8 : 0)
  );
}

const C = {
  stone: 0xd9ccae,
  stoneDark: 0xa99c82,
  wood: 0xa86b3c,
  roofRed: 0xc94a3b,
  roofBlue: 0x3f6fb8,
  roofBrown: 0x6b4026,
  gold: 0xffcf40,
  purple: 0x8a5cd6,
  grass: 0x6fbf4a,
  leaf: 0x3f9a45,
  soil: 0x8c5a32,
  water: 0x4fb3ff,
};

/** Draws in "footprint" space: (u, v) ∈ [0, 1]² across the building's tiles, `lift` in px up. */
class Painter {
  readonly hw: number;
  readonly hh: number;

  constructor(
    readonly g: G,
    readonly R: number,
    readonly cx: number,
    readonly cy: number,
    readonly n: number,
  ) {
    this.hw = (n * TILE_W) / 2;
    this.hh = (n * TILE_H) / 2;
  }

  /** Footprint coordinates → local px (unscaled, origin at footprint center). */
  fp(u: number, v: number, lift = 0): Pt {
    return { x: (u - v) * this.hw, y: (u + v) * this.hh - this.hh - lift };
  }

  private s(p: Pt): Pt {
    return { x: this.cx + p.x * this.R, y: this.cy + p.y * this.R };
  }

  poly(points: Pt[], fill: number, outline: number | null = darken(fill, 0.55), alpha = 1) {
    const pts = points.map((p) => this.s(p));
    this.g.fillStyle(fill, alpha).fillPoints(pts, true);
    if (outline !== null)
      this.g.lineStyle(1.2 * this.R, outline, 0.9).strokePoints(pts, true, true);
  }

  ellipse(c: Pt, rx: number, ry: number, fill: number, outline: number | null = null, alpha = 1) {
    const p = this.s(c);
    this.g.fillStyle(fill, alpha).fillEllipse(p.x, p.y, rx * 2 * this.R, ry * 2 * this.R);
    if (outline !== null) {
      this.g
        .lineStyle(1.2 * this.R, outline, 0.9)
        .strokeEllipse(p.x, p.y, rx * 2 * this.R, ry * 2 * this.R);
    }
  }

  line(a: Pt, b: Pt, color: number, width = 1.5, alpha = 1) {
    const pa = this.s(a);
    const pb = this.s(b);
    this.g.lineStyle(width * this.R, color, alpha).lineBetween(pa.x, pa.y, pb.x, pb.y);
  }

  /** Flat diamond covering [u0,u1]×[v0,v1] at height `lift`. */
  flat(
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    fill: number,
    lift = 0,
    outline: number | null = darken(fill, 0.4),
  ) {
    this.poly(
      [this.fp(u0, v0, lift), this.fp(u1, v0, lift), this.fp(u1, v1, lift), this.fp(u0, v1, lift)],
      fill,
      outline,
    );
  }

  /** Box over [u0,u1]×[v0,v1] from `base` to `base + h` px; returns the wall helper. */
  box(u0: number, v0: number, u1: number, v1: number, h: number, color: number, base = 0) {
    const top = base + h;
    this.poly(
      [this.fp(u0, v1, base), this.fp(u1, v1, base), this.fp(u1, v1, top), this.fp(u0, v1, top)],
      color,
    );
    this.poly(
      [this.fp(u1, v1, base), this.fp(u1, v0, base), this.fp(u1, v0, top), this.fp(u1, v1, top)],
      darken(color, 0.22),
    );
    this.flat(u0, v0, u1, v1, lighten(color, 0.12), top, darken(color, 0.5));
    return {
      /** Quad on the left (front-left) wall: t along the wall 0..1, z height px from base. */
      left: (t0: number, t1: number, z0: number, z1: number, fill: number) => {
        const at = (t: number, z: number) => this.fp(u0 + (u1 - u0) * t, v1, base + z);
        this.poly([at(t0, z0), at(t1, z0), at(t1, z1), at(t0, z1)], fill);
      },
      right: (t0: number, t1: number, z0: number, z1: number, fill: number) => {
        const at = (t: number, z: number) => this.fp(u1, v1 + (v0 - v1) * t, base + z);
        this.poly([at(t0, z0), at(t1, z0), at(t1, z1), at(t0, z1)], darken(fill, 0.15));
      },
    };
  }

  /** Four-sided roof over [u0,u1]×[v0,v1] starting at `base`, apex `h` higher. */
  pyramid(
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    base: number,
    h: number,
    color: number,
    stripes: number | null = null,
  ) {
    const apex = this.fp((u0 + u1) / 2, (v0 + v1) / 2, base + h);
    const T = this.fp(u0, v0, base);
    const Rt = this.fp(u1, v0, base);
    const B = this.fp(u1, v1, base);
    const L = this.fp(u0, v1, base);
    this.poly([L, T, apex], darken(color, 0.1));
    this.poly([T, Rt, apex], darken(color, 0.3));
    if (stripes === null) {
      this.poly([L, B, apex], color);
      this.poly([B, Rt, apex], darken(color, 0.2));
      return apex;
    }
    // Striped awning: alternate slices on the two front faces.
    const slices = 4;
    const lerp = (a: Pt, b: Pt, t: number) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
    for (const [a, b, shade] of [
      [L, B, 0],
      [B, Rt, 0.2],
    ] as const) {
      for (let i = 0; i < slices; i++) {
        const c = i % 2 === 0 ? color : stripes;
        this.poly(
          [lerp(a, b, i / slices), lerp(a, b, (i + 1) / slices), apex],
          darken(c, shade),
          darken(color, 0.5),
        );
      }
    }
    return apex;
  }

  /** Vertical cylinder centered on footprint point (cu, cv); r is a fraction of the footprint. */
  cylinder(cu: number, cv: number, r: number, h: number, side: number, top: number, base = 0) {
    const c = this.fp(cu, cv, base);
    const rx = r * this.hw;
    const ry = r * this.hh;
    this.ellipse(c, rx, ry, darken(side, 0.25), darken(side, 0.6));
    this.poly(
      [
        { x: c.x - rx, y: c.y },
        { x: c.x + rx, y: c.y },
        { x: c.x + rx, y: c.y - h },
        { x: c.x - rx, y: c.y - h },
      ],
      side,
      null,
    );
    // Shade the right half.
    this.poly(
      [
        { x: c.x, y: c.y + ry },
        { x: c.x + rx, y: c.y },
        { x: c.x + rx, y: c.y - h },
        { x: c.x, y: c.y - h + ry },
      ],
      darken(side, 0.2),
      null,
      0.6,
    );
    this.line({ x: c.x - rx, y: c.y }, { x: c.x - rx, y: c.y - h }, darken(side, 0.6), 1.2);
    this.line({ x: c.x + rx, y: c.y }, { x: c.x + rx, y: c.y - h }, darken(side, 0.6), 1.2);
    this.ellipse({ x: c.x, y: c.y - h }, rx, ry, top, darken(side, 0.6));
    return { x: c.x, y: c.y - h };
  }

  star(c: Pt, r: number, color: number) {
    const pts: Pt[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.35;
      pts.push({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr });
    }
    this.poly(pts, color, null);
  }
}

type Design = { top: number; draw: (p: Painter, level: number, variant: BuildingVariant) => void };

/** Animals shown in a Peternakan, from its `ranch-<count>` variant. */
function ranchCount(variant: BuildingVariant): number {
  return variant.startsWith('ranch-') ? Number(variant.slice(6)) : 0;
}

/** Captured animals grazing in the Peternakan pen (code-drawn and painted art alike). */
function ranchAnimals(p: Painter, count: number) {
  const spots = [
    [0.6, 0.6],
    [0.78, 0.5],
    [0.55, 0.8],
    [0.8, 0.78],
    [0.68, 0.38],
    [0.42, 0.55],
    [0.7, 0.68],
  ];
  for (const [u, v] of spots.slice(0, count)) {
    const c = p.fp(u!, v!);
    p.ellipse({ x: c.x, y: c.y - 5 }, 6, 4, 0xf4ecd8, 0x8a7a66);
    p.ellipse({ x: c.x - 5, y: c.y - 7 }, 2.6, 2.4, 0x5a4030);
  }
}

function tree(p: Painter, u: number, v: number, scale: number, color: number = C.leaf) {
  const base = p.fp(u, v);
  p.poly(
    [
      { x: base.x - 3 * scale, y: base.y },
      { x: base.x + 3 * scale, y: base.y },
      { x: base.x + 2 * scale, y: base.y - 14 * scale },
      { x: base.x - 2 * scale, y: base.y - 14 * scale },
    ],
    0x7a4a26,
  );
  p.ellipse(
    { x: base.x - 6 * scale, y: base.y - 18 * scale },
    9 * scale,
    8 * scale,
    darken(color, 0.1),
    darken(color, 0.5),
  );
  p.ellipse(
    { x: base.x + 6 * scale, y: base.y - 19 * scale },
    9 * scale,
    8 * scale,
    darken(color, 0.2),
    darken(color, 0.5),
  );
  p.ellipse(
    { x: base.x, y: base.y - 26 * scale },
    10 * scale,
    9 * scale,
    color,
    darken(color, 0.5),
  );
  p.ellipse(
    { x: base.x - 3 * scale, y: base.y - 29 * scale },
    4 * scale,
    3 * scale,
    lighten(color, 0.3),
    null,
    0.8,
  );
}

function flag(p: Painter, at: Pt, h: number, color: number) {
  p.line(at, { x: at.x, y: at.y - h }, 0x4a3520, 1.6);
  p.poly(
    [
      { x: at.x, y: at.y - h },
      { x: at.x + 14, y: at.y - h + 5 },
      { x: at.x, y: at.y - h + 10 },
    ],
    color,
  );
}

const DESIGNS: Record<string, Design> = {
  /** Not a building: the "land for sale" sign shown on the locked-plot card. */
  /** Card icons for wild enemies (not buildings). */
  'enemy-bandit': {
    top: 60,
    draw(p) {
      p.flat(0.08, 0.08, 0.92, 0.92, 0x8a7a5a);
      p.pyramid(0.15, 0.15, 0.6, 0.6, 0, 34, 0x7a3b2e);
      const fire = p.fp(0.72, 0.72);
      p.ellipse({ x: fire.x, y: fire.y - 2 }, 9, 4, 0x4a3520);
      p.ellipse({ x: fire.x, y: fire.y - 9 }, 5, 8, 0xff8a3d);
      p.ellipse({ x: fire.x, y: fire.y - 8 }, 2.5, 4, 0xffe066);
    },
  },
  'enemy-monster': {
    top: 60,
    draw(p) {
      p.flat(0.08, 0.08, 0.92, 0.92, 0x5c6b4a);
      const cave = p.pyramid(0.1, 0.1, 0.9, 0.9, 0, 40, 0x5a5560);
      const mouth = { x: cave.x, y: cave.y + 30 };
      p.ellipse(mouth, 12, 9, 0x15111c);
      p.ellipse({ x: mouth.x - 4, y: mouth.y - 1 }, 1.8, 1.8, 0xff4444);
      p.ellipse({ x: mouth.x + 4, y: mouth.y - 1 }, 1.8, 1.8, 0xff4444);
    },
  },
  'plot-sign': {
    top: 70,
    draw(p) {
      p.flat(0.08, 0.08, 0.92, 0.92, 0x6fae48);
      const post = p.fp(0.5, 0.5);
      p.line(post, { x: post.x, y: post.y - 40 }, 0x6b4026, 3);
      p.poly(
        [
          { x: post.x - 20, y: post.y - 48 },
          { x: post.x + 20, y: post.y - 48 },
          { x: post.x + 20, y: post.y - 26 },
          { x: post.x - 20, y: post.y - 26 },
        ],
        0xc8955a,
      );
      p.ellipse({ x: post.x, y: post.y - 37 }, 6, 6, C.gold, darken(C.gold, 0.4));
    },
  },
  'balai-utama': {
    top: 150,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0xcdbf9c);
      const h = 40 + level * 6;
      if (level >= 3) {
        for (const [u, v] of [
          [0.08, 0.62],
          [0.62, 0.08],
        ] as const) {
          p.box(u, v, u + 0.18, v + 0.18, h + 18, C.stoneDark);
          p.pyramid(u - 0.02, v - 0.02, u + 0.2, v + 0.2, h + 18, 26, C.roofBlue);
        }
      }
      const wall = p.box(0.2, 0.2, 0.8, 0.8, h, 0xeee2c6);
      for (const t of [0.15, 0.45, 0.75]) {
        wall.left(t, t + 0.12, h * 0.55, h * 0.8, 0x5a7fb5);
        if (t !== 0.45) wall.right(t, t + 0.12, h * 0.55, h * 0.8, 0x5a7fb5);
      }
      wall.right(0.38, 0.62, 0, h * 0.42, 0x6b3f22);
      wall.left(0.05, 0.95, h * 0.94, h, level >= 6 ? C.gold : 0xc9b48f);
      const apex = p.pyramid(0.15, 0.15, 0.85, 0.85, h, 40 + level * 4, C.roofRed);
      flag(p, apex, 26, 0x8a6cff);
      if (level >= 6) p.star({ x: apex.x, y: apex.y - 30 }, 7, C.gold);
    },
  },
  pasar: {
    top: 70,
    draw(p, level) {
      p.flat(0.03, 0.03, 0.97, 0.97, 0xcdbf9c);
      const wall = p.box(0.2, 0.2, 0.75, 0.75, 20, C.wood);
      wall.left(0.15, 0.85, 4, 14, 0x5c3a1e);
      p.pyramid(0.12, 0.12, 0.85, 0.85, 20, 22 + level * 2, C.roofRed, 0xfff4e0);
      p.box(0.78, 0.62, 0.95, 0.8, 9, 0xc58b4f);
      p.box(0.6, 0.8, 0.78, 0.96, 8, 0xc58b4f);
      const fruit = [0xff5a5a, 0xffc93c, 0x7ed957];
      fruit.forEach((c, i) => p.ellipse(p.fp(0.83 + i * 0.03, 0.7, 11), 3, 2.5, c));
      if (level >= 3) {
        const pile = p.fp(0.12, 0.88);
        for (let i = 0; i < 3 + level; i++) {
          p.ellipse(
            { x: pile.x + (i % 3) * 5 - 5, y: pile.y - Math.floor(i / 3) * 3 },
            4,
            2.2,
            C.gold,
            0xa87b14,
          );
        }
      }
    },
  },
  ladang: {
    top: 40,
    draw(p, level, variant) {
      p.flat(0.02, 0.02, 0.98, 0.98, C.soil, 0, 0x5a3a1e);
      for (let i = 1; i < 6; i++) {
        const v = 0.05 + (i * 0.9) / 6;
        p.line(p.fp(0.06, v), p.fp(0.94, v), darken(C.soil, 0.3), 2);
      }
      if (variant === 'crop-growing' || variant === 'crop-ready') {
        const ready = variant === 'crop-ready';
        for (let i = 0; i < 6; i++) {
          for (let j = 1; j < 6; j++) {
            const base = p.fp(0.1 + i * 0.15, 0.05 + (j * 0.9) / 6);
            if (ready) {
              p.poly(
                [
                  { x: base.x - 3, y: base.y },
                  { x: base.x + 3, y: base.y },
                  { x: base.x, y: base.y - 14 },
                ],
                (i + j) % 3 === 0 ? 0xff7b39 : 0xf1c232,
                0x8a6a10,
              );
            } else {
              p.ellipse({ x: base.x, y: base.y - 3 }, 3, 3, 0x7ed957, 0x3c7a2a);
            }
          }
        }
      }
      // Fence posts on the front edges.
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        for (const pt of [p.fp(t, 1), p.fp(1, t)])
          p.line(pt, { x: pt.x, y: pt.y - 8 }, 0x6b4426, 2);
      }
      p.line(p.fp(0, 1, 6), p.fp(1, 1, 6), 0x8a5a33, 1.5);
      p.line(p.fp(1, 1, 6), p.fp(1, 0, 6), 0x8a5a33, 1.5);
      if (level >= 3) {
        const s = p.fp(0.15, 0.15);
        p.line(s, { x: s.x, y: s.y - 26 }, 0x6b4426, 2);
        p.line({ x: s.x - 9, y: s.y - 18 }, { x: s.x + 9, y: s.y - 18 }, 0x6b4426, 2);
        p.ellipse({ x: s.x, y: s.y - 28 }, 5, 5, 0xf1c232, 0x8a6a10);
      }
    },
  },
  gudang: {
    top: 80,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0x9ccf6a);
      const h = 30 + level * 3;
      const wall = p.box(0.18, 0.15, 0.72, 0.7, h, 0xb24a32);
      wall.right(0.3, 0.7, 0, h * 0.75, 0xf2e6d0);
      wall.right(0.34, 0.66, 0, h * 0.7, 0x6b3f22);
      wall.left(0.2, 0.35, h * 0.5, h * 0.75, 0xf2e6d0);
      wall.left(0.65, 0.8, h * 0.5, h * 0.75, 0xf2e6d0);
      p.pyramid(0.12, 0.1, 0.78, 0.76, h, 30, C.roofBrown);
      // Hay bales and fence.
      p.cylinder(0.85, 0.3, 0.08, 9, 0xe8c45a, 0xf5dc8a);
      p.cylinder(0.85, 0.48, 0.08, 9, 0xe8c45a, 0xf5dc8a);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        for (const pt of [p.fp(t, 0.98), p.fp(0.98, t)])
          p.line(pt, { x: pt.x, y: pt.y - 9 }, 0xf2e6d0, 2);
      }
      p.line(p.fp(0, 0.98, 6), p.fp(0.98, 0.98, 6), 0xf2e6d0, 1.6);
      p.line(p.fp(0.98, 0.98, 6), p.fp(0.98, 0, 6), 0xf2e6d0, 1.6);
    },
  },
  altar: {
    top: 120,
    draw(p) {
      p.cylinder(0.5, 0.5, 0.82, 8, 0x8c86a6, 0xb9b3d1);
      for (const [u, v] of [
        [0.12, 0.5],
        [0.5, 0.12],
        [0.88, 0.5],
        [0.5, 0.88],
      ] as const) {
        p.box(u - 0.05, v - 0.05, u + 0.05, v + 0.05, 30, 0x6f6890, 8);
        const top = p.fp(u, v, 44);
        p.poly(
          [
            { x: top.x, y: top.y - 10 },
            { x: top.x + 5, y: top.y },
            { x: top.x, y: top.y + 6 },
            { x: top.x - 5, y: top.y },
          ],
          0xd6b8ff,
          0x6a3fb0,
        );
      }
      const rim = p.cylinder(0.5, 0.5, 0.42, 34, 0x3b2a5c, 0x2a1d45, 8);
      p.ellipse(rim, 0.36 * p.hw, 0.36 * p.hh, 0xb388ff, null, 0.95);
      p.ellipse({ x: rim.x - 6, y: rim.y - 2 }, 8, 4, 0xe8dbff, null, 0.8);
      p.ellipse({ x: rim.x, y: rim.y - 34 }, 12, 12, 0xd9c4ff, 0x8a5cd6, 0.95);
      p.ellipse({ x: rim.x - 3, y: rim.y - 37 }, 4, 4, 0xffffff, null, 0.9);
    },
  },
  'tambang-emas': {
    top: 90,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0xa48b68);
      // Rocky hill with a timbered tunnel mouth.
      const h = 44 + level * 6;
      p.pyramid(0.08, 0.05, 0.92, 0.8, 0, h, 0x8f8579);
      for (const [u, v, r] of [
        [0.3, 0.3, 5],
        [0.55, 0.25, 4],
        [0.42, 0.5, 3.5],
      ] as const) {
        p.ellipse(p.fp(u, v, h * 0.45), r, r * 0.7, C.gold, darken(C.gold, 0.45));
      }
      const door = p.fp(0.42, 0.8);
      p.poly(
        [
          { x: door.x - 12, y: door.y },
          { x: door.x + 12, y: door.y },
          { x: door.x + 12, y: door.y - 20 },
          { x: door.x, y: door.y - 27 },
          { x: door.x - 12, y: door.y - 20 },
        ],
        0x241a14,
      );
      p.line({ x: door.x - 13, y: door.y }, { x: door.x - 13, y: door.y - 21 }, C.wood, 3);
      p.line({ x: door.x + 13, y: door.y }, { x: door.x + 13, y: door.y - 21 }, C.wood, 3);
      p.line({ x: door.x - 15, y: door.y - 22 }, { x: door.x + 15, y: door.y - 22 }, C.wood, 3);
      // Cart full of gold by the entrance.
      p.box(0.66, 0.78, 0.92, 0.96, 9, 0x6b4026);
      p.ellipse(p.fp(0.79, 0.87, 11), 9, 4.5, C.gold, darken(C.gold, 0.45));
      p.ellipse(p.fp(0.68, 0.97), 2.5, 2.5, 0x2c2c38);
      p.ellipse(p.fp(0.9, 0.97), 2.5, 2.5, 0x2c2c38);
    },
  },
  'tambang-batu': {
    top: 90,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0xb8ab94);
      // Terraced grey cliff with cut blocks stacked in front.
      const h = 40 + level * 6;
      p.box(0.08, 0.05, 0.75, 0.62, h, 0x9a958c);
      p.box(0.08, 0.05, 0.5, 0.4, h + 16, 0x85807a);
      for (const [u, v] of [
        [0.62, 0.72],
        [0.78, 0.72],
        [0.7, 0.86],
      ] as const) {
        p.box(u - 0.07, v - 0.06, u + 0.07, v + 0.06, 10, C.stone);
      }
      p.box(0.7 - 0.07, 0.72 - 0.06, 0.7 + 0.07, 0.72 + 0.06, 9, C.stoneDark, 10);
      // Wooden pulley frame over the cliff edge.
      const a = p.fp(0.2, 0.68);
      const b = p.fp(0.42, 0.68);
      p.line(a, { x: a.x, y: a.y - 34 }, C.wood, 3);
      p.line(b, { x: b.x, y: b.y - 34 }, C.wood, 3);
      p.line({ x: a.x - 3, y: a.y - 34 }, { x: b.x + 3, y: b.y - 34 }, C.wood, 3);
      p.line(
        { x: (a.x + b.x) / 2, y: a.y - 34 },
        { x: (a.x + b.x) / 2, y: a.y - 14 },
        0x3a2a1c,
        1.4,
      );
      p.box(0.27, 0.64, 0.35, 0.72, 7, C.stone, 6);
    },
  },
  'tukang-kayu': {
    top: 90,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0xc9a97a);
      // Log cabin with a stack of logs and a sawhorse.
      const h = 30 + level * 4;
      const wall = p.box(0.15, 0.12, 0.62, 0.58, h, C.wood);
      for (let i = 1; i < 4; i++) wall.left(0, 1, (h * i) / 4 - 1, (h * i) / 4 + 1, 0x7a4a26);
      wall.left(0.4, 0.62, 0, h * 0.7, 0x4a2e1a);
      p.pyramid(0.1, 0.08, 0.67, 0.63, h, 22, C.roofBrown);
      for (const [v, z] of [
        [0.72, 5],
        [0.84, 5],
        [0.78, 14],
      ] as const) {
        p.line(p.fp(0.6, v, z), p.fp(0.95, v, z), 0x8a5a32, 9);
        p.ellipse(p.fp(0.95, v, z), 4, 4, 0xe2c08a, 0x7a4a26);
      }
      // Sawhorse with a big saw, sawdust on the ground.
      const s = p.fp(0.8, 0.3);
      p.line({ x: s.x - 10, y: s.y }, { x: s.x - 4, y: s.y - 12 }, 0x7a4a26, 2);
      p.line({ x: s.x + 10, y: s.y }, { x: s.x + 4, y: s.y - 12 }, 0x7a4a26, 2);
      p.line({ x: s.x - 12, y: s.y - 12 }, { x: s.x + 12, y: s.y - 12 }, 0x8a5a32, 4);
      p.poly(
        [
          { x: s.x - 2, y: s.y - 14 },
          { x: s.x + 16, y: s.y - 24 },
          { x: s.x + 18, y: s.y - 20 },
          { x: s.x + 1, y: s.y - 12 },
        ],
        0xc8ccd4,
        0x6a6e78,
      );
      p.ellipse(p.fp(0.75, 0.42), 8, 3, 0xf0d9a6, null, 0.9);
    },
  },
  mansion: {
    top: 130,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0x9ccf6a);
      // Two-storey manor with a blue roof, a balcony and a small flower bed by the door.
      const h = 46 + level * 5;
      const wall = p.box(0.14, 0.14, 0.78, 0.74, h, 0xf1e6cf);
      wall.left(0.05, 0.95, h * 0.48, h * 0.53, 0xa86b3c);
      for (const t of [0.12, 0.42, 0.72]) {
        wall.left(t, t + 0.14, h * 0.62, h * 0.86, 0x5a7fb5);
        wall.left(t, t + 0.14, h * 0.14, h * 0.38, 0x5a7fb5);
      }
      wall.right(0.15, 0.3, h * 0.62, h * 0.86, 0x5a7fb5);
      wall.right(0.4, 0.6, 0, h * 0.4, 0x6b3f22);
      wall.right(0.7, 0.85, h * 0.62, h * 0.86, 0x5a7fb5);
      // Balcony rail on the right face.
      wall.right(0.3, 0.7, h * 0.5, h * 0.56, C.wood);
      const apex = p.pyramid(0.1, 0.1, 0.82, 0.78, h, 34, C.roofBlue);
      if (level >= 5) {
        p.box(0.66, 0.08, 0.84, 0.26, h + 16, C.stone);
        p.pyramid(0.64, 0.06, 0.86, 0.28, h + 16, 22, C.roofBlue);
      }
      if (level >= 3) flag(p, apex, 22, 0x8a6cff);
      for (const [u, c] of [
        [0.88, 0xff7aa8],
        [0.92, 0xffe066],
        [0.96, 0xffffff],
      ] as const) {
        p.ellipse(p.fp(u, 0.88), 2.4, 2, c);
      }
    },
  },
  penggilingan: {
    top: 120,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0xc9b98f);
      const h = 40 + level * 6;
      const wall = p.box(0.25, 0.25, 0.75, 0.75, h, 0xe6d6b0);
      wall.left(0.38, 0.62, 0, h * 0.45, 0x6b4026);
      const roof = p.pyramid(0.2, 0.2, 0.8, 0.8, h, 24, C.roofBrown);
      // Four sails on the front, crossing at the hub.
      const hub = { x: roof.x, y: roof.y + 22 };
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const tip = { x: hub.x + Math.cos(a) * 34, y: hub.y + Math.sin(a) * 34 };
        const side = { x: -Math.sin(a) * 6, y: Math.cos(a) * 6 };
        p.line(hub, tip, 0x6b4026, 2.2);
        p.poly(
          [
            { x: hub.x + Math.cos(a) * 10, y: hub.y + Math.sin(a) * 10 },
            tip,
            { x: tip.x + side.x, y: tip.y + side.y },
            { x: hub.x + Math.cos(a) * 10 + side.x, y: hub.y + Math.sin(a) * 10 + side.y },
          ],
          0xf4ecd8,
        );
      }
      p.ellipse(hub, 4, 4, 0x6b4026);
      // Sacks of flour.
      p.ellipse(p.fp(0.86, 0.6, 5), 6, 6, 0xf1e6c8, 0x9c8a62);
      p.ellipse(p.fp(0.86, 0.78, 5), 6, 6, 0xf1e6c8, 0x9c8a62);
    },
  },
  kuburan: {
    top: 70,
    draw(p) {
      p.flat(0.04, 0.04, 0.96, 0.96, 0x6f8a5a);
      // A bare tree at the back, rows of headstones, and a low iron fence in front.
      const trunk = p.fp(0.18, 0.18);
      p.line(trunk, { x: trunk.x, y: trunk.y - 34 }, 0x4a3a30, 3);
      p.line({ x: trunk.x, y: trunk.y - 22 }, { x: trunk.x + 10, y: trunk.y - 32 }, 0x4a3a30, 2);
      p.line({ x: trunk.x, y: trunk.y - 26 }, { x: trunk.x - 9, y: trunk.y - 35 }, 0x4a3a30, 2);
      for (const [u, v] of [
        [0.45, 0.3],
        [0.7, 0.3],
        [0.3, 0.55],
        [0.55, 0.55],
        [0.8, 0.55],
        [0.45, 0.8],
        [0.7, 0.8],
      ] as const) {
        p.box(u - 0.06, v - 0.03, u + 0.06, v + 0.03, 12, 0xb7b9c2);
        p.ellipse(p.fp(u, v + 0.03, 12), 4.5, 3, 0xc9cbd3, 0x7a7c86);
        p.flat(u - 0.08, v + 0.04, u + 0.08, v + 0.14, 0x5a4a38, 0, null);
      }
      for (let i = 0; i <= 8; i++) {
        const u = 0.06 + i * 0.11;
        p.line(p.fp(u, 0.96), p.fp(u, 0.96, 10), 0x2c2c38, 1.6);
        p.line(p.fp(0.96, u), p.fp(0.96, u, 10), 0x2c2c38, 1.6);
      }
      p.line(p.fp(0.06, 0.96, 8), p.fp(0.96, 0.96, 8), 0x2c2c38, 1.4);
      p.line(p.fp(0.96, 0.96, 8), p.fp(0.96, 0.06, 8), 0x2c2c38, 1.4);
    },
  },
  'pohon-emas-purba': {
    top: 110,
    draw(p) {
      p.flat(0.04, 0.04, 0.96, 0.96, 0xb8a27a);
      p.box(0.25, 0.25, 0.75, 0.75, 8, 0x9a8a70);
      // An old trunk with a crown of golden leaves and a few hanging coins.
      p.cylinder(0.5, 0.5, 0.1, 50, 0x6a4a2a, 0x8a6a40, 8);
      const c = p.fp(0.5, 0.5, 58);
      for (const [dx, dy, r] of [
        [0, -18, 30],
        [-24, 0, 22],
        [24, 0, 22],
        [-12, -34, 18],
        [14, -32, 18],
      ] as const) {
        p.ellipse({ x: c.x + dx, y: c.y + dy }, r, r * 0.8, 0xf5c542, 0xa87b14);
      }
      for (const [dx, dy] of [
        [-18, 14],
        [6, 18],
        [22, 10],
        [-4, -20],
      ] as const) {
        p.star({ x: c.x + dx, y: c.y + dy }, 3.5, 0xfff3b0);
      }
    },
  },
  'lumbung-abadi': {
    top: 90,
    draw(p) {
      p.flat(0.04, 0.04, 0.96, 0.96, 0x8aa85a);
      p.box(0.2, 0.2, 0.8, 0.8, 40, 0xb04a3a);
      p.pyramid(0.16, 0.16, 0.84, 0.84, 40, 34, 0xf5c542);
      // Golden sheaves and baskets of fruit spilling out in front.
      for (const [u, v] of [
        [0.88, 0.3],
        [0.88, 0.55],
        [0.3, 0.9],
        [0.6, 0.9],
      ] as const) {
        p.cylinder(u, v, 0.05, 14, 0xd9a83a, 0xf0c860);
      }
      p.ellipse(p.fp(0.88, 0.8, 6), 7, 4, 0xff5c4a, 0x9a2a20);
    },
  },
  'kolam-jiwa': {
    top: 70,
    draw(p) {
      p.flat(0.04, 0.04, 0.96, 0.96, 0x6a7a9a);
      const c = p.fp(0.5, 0.5);
      p.ellipse(c, 44, 22, 0x8a8aa0, 0x4a4a60);
      p.ellipse({ x: c.x, y: c.y + 1 }, 38, 18, 0x5b43c7, null);
      p.ellipse({ x: c.x, y: c.y }, 26, 12, 0xc77dff, null, 0.6);
      // Soul crystals around the rim and sparks over the water.
      for (const [u, v] of [
        [0.15, 0.5],
        [0.85, 0.5],
        [0.5, 0.15],
        [0.5, 0.85],
      ] as const) {
        const at = p.fp(u, v);
        p.poly(
          [
            { x: at.x, y: at.y - 26 },
            { x: at.x + 6, y: at.y - 8 },
            { x: at.x, y: at.y },
            { x: at.x - 6, y: at.y - 8 },
          ],
          0xc77dff,
        );
      }
      for (const [dx, dy] of [
        [-12, -14],
        [10, -20],
        [2, -8],
      ] as const) {
        p.star({ x: c.x + dx, y: c.y + dy }, 3, 0xffffff);
      }
    },
  },
  'sarang-telur': {
    top: 56,
    draw(p) {
      p.flat(0.04, 0.04, 0.96, 0.96, 0x7a9a5a);
      // Four carved posts around a straw nest holding a glowing Telur Jiwa.
      for (const [u, v] of [
        [0.15, 0.15],
        [0.85, 0.15],
        [0.15, 0.85],
        [0.85, 0.85],
      ] as const) {
        p.cylinder(u, v, 0.05, 22, 0x8a5a34, 0xa8744a);
        p.ellipse(p.fp(u, v, 24), 3.5, 2.5, 0xc77dff, 0x7a3fb0);
      }
      const c = p.fp(0.5, 0.5);
      p.ellipse({ x: c.x, y: c.y - 4 }, 26, 13, 0x9a7240, 0x5e4224);
      p.ellipse({ x: c.x, y: c.y - 8 }, 20, 9, 0xc89a5a, 0x7a5a30);
      p.ellipse({ x: c.x, y: c.y - 22 }, 15, 15, 0xc77dff, null, 0.25);
      p.ellipse({ x: c.x, y: c.y - 20 }, 9, 12, 0xe6d2ff, 0x8a5cc7);
      p.star({ x: c.x - 3, y: c.y - 25 }, 3, 0xffffff);
    },
  },
  peternakan: {
    top: 70,
    draw(p, level, variant) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0x86c35a);
      p.flat(0.45, 0.45, 0.9, 0.9, 0x9b7b4f, 0, null);
      const post = 0x7a5230;
      const rail = 0xb07a3f;
      const fence = (pts: [number, number][]) => {
        for (const lift of [5, 10]) {
          for (let i = 1; i < pts.length; i++) {
            const [u0, v0] = pts[i - 1]!;
            const [u1, v1] = pts[i]!;
            p.line(p.fp(u0, v0, lift), p.fp(u1, v1, lift), rail, 1.6);
          }
        }
        for (const [u, v] of pts) p.line(p.fp(u, v), p.fp(u, v, 13), post, 2.2);
      };
      const steps = [0.05, 0.275, 0.5, 0.725, 0.95];
      // Back fences, then the barn, then animals, then the front fences.
      fence(steps.map((u) => [u, 0.05]));
      fence(steps.map((v) => [0.05, v]));
      const h = 22 + level * 4;
      p.box(0.1, 0.1, 0.38, 0.38, h, 0xb8432f);
      p.pyramid(0.07, 0.07, 0.41, 0.41, h, 16, C.roofBrown);
      p.ellipse(p.fp(0.6, 0.2, 5), 9, 5, 0xe6c25a, darken(0xe6c25a, 0.4));
      p.box(0.15, 0.62, 0.35, 0.72, 6, 0x8a5a2b);
      p.flat(0.17, 0.64, 0.33, 0.7, 0x4fb3ff, 6, null);
      ranchAnimals(p, ranchCount(variant));
      fence(steps.map((u) => [u, 0.95]));
      fence(steps.map((v) => [0.95, v]));
    },
  },
  'ayam-hutan': {
    top: 30,
    draw(p) {
      const c = p.fp(0.5, 0.55);
      p.ellipse({ x: c.x, y: c.y - 1 }, 7, 2.5, 0x000000, null, 0.18);
      p.line({ x: c.x - 3, y: c.y }, { x: c.x - 3, y: c.y - 7 }, 0xd9a21b, 1.4);
      p.line({ x: c.x + 2, y: c.y }, { x: c.x + 2, y: c.y - 7 }, 0xd9a21b, 1.4);
      p.poly(
        [
          { x: c.x + 5, y: c.y - 11 },
          { x: c.x + 13, y: c.y - 21 },
          { x: c.x + 12, y: c.y - 9 },
        ],
        0x2e6b3a,
      );
      p.ellipse({ x: c.x, y: c.y - 11 }, 8, 6, 0xa0522d, 0x5a2c16);
      p.ellipse({ x: c.x - 7, y: c.y - 18 }, 4, 4, 0xa0522d, 0x5a2c16);
      p.ellipse({ x: c.x - 7, y: c.y - 22.5 }, 2.6, 1.8, 0xd63c3c);
      p.poly(
        [
          { x: c.x - 11, y: c.y - 19 },
          { x: c.x - 14.5, y: c.y - 17.5 },
          { x: c.x - 11, y: c.y - 16 },
        ],
        0xf2c14e,
      );
      p.ellipse({ x: c.x - 8, y: c.y - 19 }, 0.9, 0.9, 0x111111);
    },
  },
  rusa: {
    top: 48,
    draw(p) {
      const c = p.fp(0.5, 0.55);
      p.ellipse({ x: c.x, y: c.y - 1 }, 12, 3, 0x000000, null, 0.18);
      for (const dx of [-9, -5, 5, 9]) {
        p.line({ x: c.x + dx, y: c.y - 16 }, { x: c.x + dx, y: c.y }, 0x7a5236, 2);
      }
      p.ellipse({ x: c.x, y: c.y - 19 }, 13, 7, 0xb5835a, 0x6b4a30);
      p.ellipse({ x: c.x, y: c.y - 16 }, 9, 3, 0xe2c7a3, null);
      p.poly(
        [
          { x: c.x - 7, y: c.y - 24 },
          { x: c.x - 11, y: c.y - 33 },
          { x: c.x - 16, y: c.y - 32 },
          { x: c.x - 12, y: c.y - 21 },
        ],
        0xb5835a,
        0x6b4a30,
      );
      p.ellipse({ x: c.x - 15, y: c.y - 34 }, 5.5, 3.6, 0xb5835a, 0x6b4a30);
      const antler = 0x8a6a4a;
      for (const side of [-1, 1]) {
        const base = { x: c.x - 14 + side * 2, y: c.y - 37 };
        const top = { x: base.x + side * 3, y: base.y - 9 };
        p.line(base, top, antler, 1.6);
        p.line(
          { x: base.x + side, y: base.y - 4 },
          { x: base.x + side * 5, y: base.y - 6 },
          antler,
          1.3,
        );
      }
      p.ellipse({ x: c.x + 12, y: c.y - 22 }, 2.6, 2, 0xf2e6d0);
      p.ellipse({ x: c.x - 17, y: c.y - 35 }, 0.9, 0.9, 0x111111);
    },
  },
  'babi-liar': {
    top: 34,
    draw(p) {
      const c = p.fp(0.5, 0.55);
      p.ellipse({ x: c.x, y: c.y - 1 }, 12, 3, 0x000000, null, 0.18);
      for (const dx of [-8, -4, 5, 9]) {
        p.line({ x: c.x + dx, y: c.y - 7 }, { x: c.x + dx, y: c.y }, 0x3b2a20, 2.4);
      }
      p.ellipse({ x: c.x + 1, y: c.y - 12 }, 13, 8, 0x5a4030, 0x2e1f16);
      p.line({ x: c.x - 6, y: c.y - 19 }, { x: c.x + 8, y: c.y - 19 }, 0x2e1f16, 2.2);
      p.ellipse({ x: c.x - 11, y: c.y - 12 }, 6, 5.5, 0x5a4030, 0x2e1f16);
      p.ellipse({ x: c.x - 16, y: c.y - 11 }, 3, 2.6, 0xc9907a, 0x7a4a3a);
      p.poly(
        [
          { x: c.x - 14, y: c.y - 9 },
          { x: c.x - 17, y: c.y - 14 },
          { x: c.x - 13, y: c.y - 10 },
        ],
        0xf4f0e6,
      );
      p.ellipse({ x: c.x - 12, y: c.y - 14 }, 0.9, 0.9, 0x111111);
    },
  },
  domba: {
    top: 34,
    draw(p) {
      const c = p.fp(0.5, 0.55);
      p.ellipse({ x: c.x, y: c.y - 1 }, 11, 3, 0x000000, null, 0.18);
      for (const dx of [-7, -3, 4, 8]) {
        p.line({ x: c.x + dx, y: c.y - 7 }, { x: c.x + dx, y: c.y }, 0x3a3030, 2.2);
      }
      // Woolly body: a ring of puffs around a round core.
      const wool = 0xf4f0e6;
      const woolLine = 0xa39a88;
      for (const [dx, dy] of [
        [-7, -12],
        [-2, -16],
        [5, -16],
        [9, -12],
        [3, -9],
        [-4, -9],
      ] as const) {
        p.ellipse({ x: c.x + dx, y: c.y + dy }, 5, 4.5, wool, woolLine);
      }
      p.ellipse({ x: c.x + 1, y: c.y - 12.5 }, 9, 5.5, wool, null);
      p.ellipse({ x: c.x - 12, y: c.y - 14 }, 4.5, 4, 0x3a3030, 0x1e1818);
      p.ellipse({ x: c.x - 12, y: c.y - 18 }, 3.5, 2.2, wool, woolLine);
      p.ellipse({ x: c.x - 13.5, y: c.y - 14.5 }, 0.9, 0.9, 0xffffff);
    },
  },
  sapi: {
    top: 44,
    draw(p) {
      const c = p.fp(0.5, 0.55);
      p.ellipse({ x: c.x, y: c.y - 1 }, 14, 3.5, 0x000000, null, 0.18);
      for (const dx of [-10, -5, 6, 11]) {
        p.line({ x: c.x + dx, y: c.y - 12 }, { x: c.x + dx, y: c.y }, 0xe8e2d6, 2.6);
        p.line({ x: c.x + dx, y: c.y - 2 }, { x: c.x + dx, y: c.y }, 0x2e2622, 2.6);
      }
      const hide = 0xf4f0e6;
      const hideLine = 0x6e6458;
      p.ellipse({ x: c.x + 1, y: c.y - 16 }, 15, 8, hide, hideLine);
      // Black patches.
      p.ellipse({ x: c.x + 5, y: c.y - 18 }, 5, 3.5, 0x2e2622);
      p.ellipse({ x: c.x - 5, y: c.y - 14 }, 3.5, 2.6, 0x2e2622);
      p.ellipse({ x: c.x + 11, y: c.y - 13 }, 2.6, 2, 0x2e2622);
      // Head with a pink muzzle and small horns.
      p.ellipse({ x: c.x - 14, y: c.y - 20 }, 6, 5.5, hide, hideLine);
      p.ellipse({ x: c.x - 17, y: c.y - 17 }, 4, 3, 0xe8a5a0, 0x9a6460);
      p.line({ x: c.x - 16, y: c.y - 25 }, { x: c.x - 19, y: c.y - 29 }, 0xd9c9a3, 1.6);
      p.line({ x: c.x - 11, y: c.y - 25 }, { x: c.x - 9, y: c.y - 29 }, 0xd9c9a3, 1.6);
      p.ellipse({ x: c.x - 15, y: c.y - 21.5 }, 0.9, 0.9, 0x111111);
    },
  },
  'kandang-kuda': {
    top: 80,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0xc9b98f);
      // Long wooden stable with a blue roof, a paddock fence and a lance banner.
      const h = 22 + level * 3;
      const stable = p.box(0.1, 0.1, 0.55, 0.9, h, C.wood);
      stable.right(0.15, 0.35, 0, h * 0.7, 0x4a3520);
      stable.right(0.45, 0.65, 0, h * 0.7, 0x4a3520);
      stable.right(0.75, 0.95, 0, h * 0.7, 0x4a3520);
      p.pyramid(0.07, 0.07, 0.58, 0.93, h, 14, C.roofBlue);
      const rail = 0xb07a3f;
      for (const lift of [5, 10]) {
        p.line(p.fp(0.65, 0.12, lift), p.fp(0.95, 0.12, lift), rail, 1.6);
        p.line(p.fp(0.95, 0.12, lift), p.fp(0.95, 0.9, lift), rail, 1.6);
        p.line(p.fp(0.65, 0.9, lift), p.fp(0.95, 0.9, lift), rail, 1.6);
      }
      for (const [u, v] of [
        [0.65, 0.12],
        [0.95, 0.12],
        [0.95, 0.5],
        [0.95, 0.9],
        [0.65, 0.9],
      ] as const) {
        p.line(p.fp(u, v), p.fp(u, v, 13), 0x7a5230, 2.2);
      }
      p.ellipse(p.fp(0.8, 0.5, 5), 8, 4, 0xe6c25a, darken(0xe6c25a, 0.4));
      flag(p, p.fp(0.12, 0.12, h + 14), 26, 0x3f6fb8);
    },
  },
  guild: {
    top: 90,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0xc2b38e);
      const h = 32 + level * 4;
      const wall = p.box(0.15, 0.15, 0.85, 0.85, h, 0x9c9caa);
      wall.right(0.4, 0.6, 0, h * 0.5, 0x4a3520);
      wall.left(0.2, 0.3, h * 0.6, h * 0.8, 0x2c2c38);
      wall.left(0.7, 0.8, h * 0.6, h * 0.8, 0x2c2c38);
      wall.right(0.12, 0.28, h * 0.25, h * 0.9, 0xc0392b);
      wall.right(0.72, 0.88, h * 0.25, h * 0.9, 0xc0392b);
      for (let i = 0; i < 4; i++) {
        const t = 0.15 + i * 0.2;
        p.box(t, 0.77, t + 0.1, 0.85, 8, 0x9c9caa, h);
        p.box(0.77, t, 0.85, t + 0.1, 8, 0x9c9caa, h);
      }
      flag(p, p.fp(0.2, 0.2, h), 30, 0xc0392b);
    },
  },
  barak: {
    top: 80,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0xc9b98f);
      // Sand ring with a rope fence and wooden training dummies.
      p.ellipse(p.fp(0.5, 0.5), 0.78 * p.hw, 0.78 * p.hh, 0xe3c98e, 0x9c8455);
      for (const [u, v] of [
        [0.15, 0.5],
        [0.5, 0.15],
        [0.85, 0.5],
        [0.5, 0.85],
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ] as const) {
        p.line(p.fp(u, v), p.fp(u, v, 14), C.wood, 2.4);
      }
      for (const [u, v] of [
        [0.4, 0.45],
        [0.6, 0.55],
      ] as const) {
        const base = p.fp(u, v);
        p.line(base, { x: base.x, y: base.y - 26 }, 0x7a4a26, 2.6);
        p.line({ x: base.x - 9, y: base.y - 20 }, { x: base.x + 9, y: base.y - 20 }, 0x7a4a26, 2.4);
        p.ellipse({ x: base.x, y: base.y - 16 }, 5, 7, 0xd8b26a, 0x7a5a2a);
        p.ellipse({ x: base.x, y: base.y - 29 }, 4, 4, 0xd8b26a, 0x7a5a2a);
      }
      flag(p, p.fp(0.12, 0.12), 34 + level * 3, 0xd35400);
    },
  },
  'lapangan-panah': {
    top: 80,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0x8fcf63);
      // Shooting line, a small shed and straw targets on stands.
      p.flat(0.05, 0.75, 0.95, 0.82, 0xd9c48f, 0, null);
      p.box(0.08, 0.08, 0.32, 0.32, 18 + level * 3, 0xa86b3c);
      p.pyramid(0.05, 0.05, 0.35, 0.35, 18 + level * 3, 14, 0x3f8a4a);
      for (const [u, v] of [
        [0.55, 0.2],
        [0.8, 0.3],
        [0.68, 0.5],
      ] as const) {
        const base = p.fp(u, v);
        p.line(base, { x: base.x - 5, y: base.y - 16 }, C.wood, 2);
        p.line(base, { x: base.x + 5, y: base.y - 16 }, C.wood, 2);
        const c = { x: base.x, y: base.y - 22 };
        p.ellipse(c, 10, 10, 0xf4ecd8, 0x8a7a66);
        p.ellipse(c, 6.5, 6.5, 0xd63c3c);
        p.ellipse(c, 3, 3, 0xf4ecd8);
      }
      flag(p, p.fp(0.9, 0.85), 30 + level * 3, 0x2e86c1);
    },
  },
  'gerbang-petualangan': {
    top: 110,
    draw(p) {
      p.flat(0.05, 0.05, 0.95, 0.95, 0xb5a988);
      p.box(0.1, 0.4, 0.3, 0.6, 70, 0x9d927a);
      p.box(0.7, 0.4, 0.9, 0.6, 70, 0x9d927a);
      const c = p.fp(0.5, 0.5, 34);
      p.ellipse(c, 34, 36, 0x1d6f6a, null, 0.9);
      p.ellipse(c, 26, 28, 0x37c9b5, null, 0.8);
      p.ellipse(c, 14, 16, 0xb8fff2, null, 0.85);
      p.box(0.06, 0.36, 0.94, 0.64, 12, 0x857a63, 70);
      p.star(p.fp(0.5, 0.5, 96), 7, 0x7fffe8);
    },
  },
  arena: {
    top: 60,
    draw(p) {
      const rim = p.cylinder(0.5, 0.5, 0.92, 28, 0xcbb994, 0xdcccaa);
      p.ellipse(rim, 0.68 * p.hw, 0.68 * p.hh, 0xe5c98a, 0x8a7550);
      p.ellipse({ x: rim.x, y: rim.y + 2 }, 0.3 * p.hw, 0.3 * p.hh, 0xd9b877, null);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.1 + (i * 0.8) / 8);
        const x = rim.x + Math.cos(a) * 0.92 * p.hw;
        const y = rim.y + 28 + Math.sin(a) * 0.92 * p.hh;
        p.poly(
          [
            { x: x - 4, y },
            { x: x + 4, y },
            { x: x + 4, y: y - 14 },
            { x: x - 4, y: y - 14 },
          ],
          0x6b5a3c,
          null,
        );
      }
      flag(p, { x: rim.x - 0.9 * p.hw, y: rim.y }, 26, 0xc0392b);
      flag(p, { x: rim.x + 0.9 * p.hw, y: rim.y }, 26, 0x3f6fb8);
    },
  },
  menara: {
    top: 140,
    draw(p, level) {
      const h = 64 + level * 8;
      const wall = p.box(0.28, 0.28, 0.72, 0.72, h, 0xc0b6a0);
      wall.left(0.4, 0.6, h * 0.5, h * 0.7, 0x2c2c38);
      wall.right(0.4, 0.6, h * 0.65, h * 0.85, 0x2c2c38);
      p.box(0.2, 0.2, 0.8, 0.8, 8, 0xa89e88, h);
      p.pyramid(0.18, 0.18, 0.82, 0.82, h + 8, 34, C.roofBlue);
    },
  },
  gerbang: {
    top: 60,
    draw(p, level, variant) {
      const [, maskText, state] = variant.split('-');
      const mask = Number(maskText ?? 0);
      // The gate runs along the wall it sits in: along y when only y neighbours join.
      const alongY = (mask & 10) !== 0 && (mask & 5) === 0;
      const box = (u0: number, v0: number, u1: number, v1: number, h: number, c: number, z = 0) =>
        alongY ? p.box(v0, u0, v1, u1, h, c, z) : p.box(u0, v0, u1, v1, h, c, z);
      const color = level >= 7 ? 0x6f6c6a : level >= 5 ? 0x8f8a84 : level >= 3 ? 0xb3aa99 : C.wood;
      const door = level >= 6 ? 0x5a5e66 : 0x7a4a26;
      const h = 16 + level * 2;
      box(0.04, 0.32, 0.24, 0.68, h + 10, color);
      if (state === 'open') {
        // Leaves swung inwards, the way through left clear.
        box(0.24, 0.58, 0.3, 0.92, h, door);
        box(0.7, 0.58, 0.76, 0.92, h, door);
      } else {
        box(0.24, 0.44, 0.76, 0.56, h, door);
        box(0.24, 0.43, 0.76, 0.57, 3, darken(door, 0.2), h * 0.45);
      }
      box(0.76, 0.32, 0.96, 0.68, h + 10, color);
      box(0.04, 0.38, 0.96, 0.62, 5, lighten(color, 0.08), h + 4);
      if (level >= 7) box(0.44, 0.44, 0.56, 0.56, 5, C.gold, h + 9);
    },
  },
  bengkel: {
    top: 110,
    draw(p, level) {
      p.flat(0.02, 0.02, 0.98, 0.98, 0xa48b68);
      // Workshop shed with a glowing forge, a smoking chimney, a wheel and a half-built catapult.
      const h = 34 + level * 4;
      const wall = p.box(0.12, 0.12, 0.62, 0.62, h, 0x9a7a52);
      wall.right(0.25, 0.75, 0, h * 0.7, 0x3a2a1c);
      wall.right(0.32, 0.5, h * 0.1, h * 0.35, 0xff8a3d);
      wall.left(0.2, 0.4, h * 0.5, h * 0.75, 0x5a7fb5);
      p.pyramid(0.08, 0.08, 0.66, 0.66, h, 26, C.roofBrown);
      p.box(0.14, 0.4, 0.24, 0.5, h + 30, C.stoneDark);
      const smoke = p.fp(0.19, 0.45, h + 36);
      p.ellipse(smoke, 6, 5, 0xd8d4cc, null, 0.7);
      p.ellipse({ x: smoke.x + 5, y: smoke.y - 9 }, 5, 4, 0xe6e2da, null, 0.55);
      // Big wheel leaning on the wall and a catapult frame in the yard.
      p.ellipse(p.fp(0.66, 0.3, 10), 9, 9, 0x6b4026, 0x3a2a1c);
      p.ellipse(p.fp(0.66, 0.3, 10), 3, 3, 0x9a9ea6);
      const yard = p.fp(0.82, 0.78);
      p.line({ x: yard.x - 16, y: yard.y }, { x: yard.x + 16, y: yard.y }, 0x8a5a32, 4);
      p.line({ x: yard.x - 8, y: yard.y }, { x: yard.x, y: yard.y - 16 }, 0x5a3a20, 3);
      p.line({ x: yard.x + 8, y: yard.y }, { x: yard.x, y: yard.y - 16 }, 0x5a3a20, 3);
      p.line({ x: yard.x - 12, y: yard.y - 8 }, { x: yard.x + 18, y: yard.y - 26 }, 0x6b4026, 3);
      if (level >= 4) flag(p, p.fp(0.37, 0.37, h + 26), 18, 0xc94a3b);
    },
  },
  'menara-sihir': {
    top: 160,
    draw(p, level) {
      p.flat(0.06, 0.06, 0.94, 0.94, 0xb8b0c8);
      // Round stone tower with a glowing purple crystal dome and runes floating around it.
      const h = 70 + level * 8;
      p.cylinder(0.5, 0.5, 0.52, h, 0x9a93a8, 0xc4bdd2);
      p.cylinder(0.5, 0.5, 0.6, 6, 0x7d768c, 0xa79fb8, h);
      const top = p.fp(0.5, 0.5, h + 6);
      const r = 14 + level * 2;
      p.ellipse({ x: top.x, y: top.y - r * 0.5 }, r + 8, r + 8, 0xd9c4ff, null, 0.3);
      p.ellipse({ x: top.x, y: top.y - r * 0.5 }, r, r * 0.9, 0xb388ff, 0x6a3fb0);
      p.ellipse(
        { x: top.x - r * 0.35, y: top.y - r * 0.8 },
        r * 0.3,
        r * 0.25,
        0xffffff,
        null,
        0.8,
      );
      const door = p.fp(0.5, 0.98);
      p.ellipse({ x: door.x - 8, y: door.y - 12 }, 6, 9, 0x2c2440);
      for (let i = 0; i < Math.min(5, 2 + level); i++) {
        const a = (i / 5) * Math.PI * 2;
        const pt = { x: top.x + Math.cos(a) * (r + 18), y: top.y - h * 0.35 + Math.sin(a) * 10 };
        p.poly(
          [
            { x: pt.x, y: pt.y - 5 },
            { x: pt.x + 3, y: pt.y },
            { x: pt.x, y: pt.y + 5 },
            { x: pt.x - 3, y: pt.y },
          ],
          0xe8dbff,
          C.purple,
        );
      }
    },
  },
  tembok: {
    top: 44,
    draw(p, level, variant) {
      const color = [0xb3aa99, 0x8f8a84, 0x6f6c6a][level - 1] ?? 0x8f8a84;
      const mask = variant.startsWith('wall-') ? Number(variant.slice(5)) : 0;
      const h = 14 + level * 3;
      // Back connectors first, then the post, then the front connectors.
      if (mask & 4) p.box(0, 0.3, 0.5, 0.7, h, color);
      if (mask & 8) p.box(0.3, 0, 0.7, 0.5, h, color);
      p.box(0.2, 0.2, 0.8, 0.8, h + 6, darken(color, 0.04));
      p.box(0.27, 0.27, 0.73, 0.73, 5, lighten(color, 0.08), h + 6);
      if (level >= 3) p.box(0.38, 0.38, 0.62, 0.62, 5, 0xffcf40, h + 11);
      if (mask & 1) p.box(0.5, 0.3, 1, 0.7, h, color);
      if (mask & 2) p.box(0.3, 0.5, 0.7, 1, h, color);
    },
  },
  'pohon-hias': {
    top: 60,
    draw(p) {
      p.flat(0.1, 0.1, 0.9, 0.9, 0x5aa83a, 0, null);
      tree(p, 0.5, 0.5, 1.05, 0x4cae4c);
      [0xff7aa8, 0xffe066, 0xffffff].forEach((c, i) =>
        p.ellipse(p.fp(0.3 + i * 0.2, 0.75), 2, 1.6, c),
      );
    },
  },
  bunga: {
    top: 24,
    draw(p) {
      p.flat(0.1, 0.1, 0.9, 0.9, 0x5aa83a, 0, 0x3c7a2a);
      const colors = [0xff5a8a, 0xffd23f, 0xb388ff, 0xffffff, 0xff8c42];
      for (let i = 0; i < 7; i++) {
        const c = p.fp(0.25 + ((i * 37) % 50) / 100, 0.25 + ((i * 53) % 50) / 100);
        p.line(c, { x: c.x, y: c.y - 6 }, 0x2f7a2f, 1.2);
        p.ellipse({ x: c.x, y: c.y - 7 }, 3, 2.5, colors[i % colors.length]!);
        p.ellipse({ x: c.x, y: c.y - 7 }, 1, 1, 0xfff4b0);
      }
    },
  },
  lampu: {
    top: 60,
    draw(p) {
      const base = p.fp(0.5, 0.5);
      p.ellipse(base, 6, 3, 0x5a5a66);
      p.line(base, { x: base.x, y: base.y - 36 }, 0x3a3a46, 2.4);
      p.ellipse({ x: base.x, y: base.y - 40 }, 14, 14, 0xffe58a, null, 0.25);
      p.poly(
        [
          { x: base.x - 5, y: base.y - 36 },
          { x: base.x + 5, y: base.y - 36 },
          { x: base.x + 4, y: base.y - 45 },
          { x: base.x - 4, y: base.y - 45 },
        ],
        0xffe066,
        0x6b5a20,
      );
      p.poly(
        [
          { x: base.x - 6, y: base.y - 45 },
          { x: base.x + 6, y: base.y - 45 },
          { x: base.x, y: base.y - 51 },
        ],
        0x3a3a46,
      );
    },
  },
  'air-mancur': {
    top: 60,
    draw(p) {
      const rim = p.cylinder(0.5, 0.5, 0.78, 12, 0xbab3a3, 0xd6d0c2);
      p.ellipse(rim, 0.64 * p.hw, 0.64 * p.hh, C.water, 0x2c7fc0);
      const top = p.cylinder(0.5, 0.5, 0.14, 24, 0xbab3a3, 0xd6d0c2, 12);
      for (const dx of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const t = i / 6;
          const x = top.x + dx * t * 26;
          const y = top.y - 6 - Math.sin(t * Math.PI) * 14 + t * 26;
          p.ellipse({ x, y }, 2, 2, 0xbfe6ff, null, 0.9);
        }
      }
      p.ellipse({ x: top.x, y: top.y - 8 }, 3, 6, 0xbfe6ff, null, 0.9);
    },
  },
  'monumen-keajaiban': {
    top: 150,
    draw(p) {
      p.flat(0.06, 0.06, 0.94, 0.94, 0xd9ccae, 0, C.stoneDark);
      p.box(0.24, 0.24, 0.76, 0.76, 10, C.stoneDark);
      // White obelisk banded with the six base elements, a glowing crystal on top.
      const h = 96;
      const pillar = p.box(0.36, 0.36, 0.64, 0.64, h, 0xf2eee4, 10);
      const bands = [0xff6b35, 0x3fa7ff, 0xa8743f, 0x7fe0b0, 0xffe066, 0x7b4bb3];
      bands.forEach((color, i) => {
        const z = h * (0.12 + i * 0.13);
        pillar.left(0.1, 0.9, z, z + 5, color);
        pillar.right(0.1, 0.9, z, z + 5, darken(color, 0.15));
      });
      const apex = p.pyramid(0.34, 0.34, 0.66, 0.66, h + 10, 14, 0xf2eee4);
      const gem = { x: apex.x, y: apex.y - 12 };
      p.ellipse(gem, 12, 12, 0xd9c4ff, null, 0.35);
      p.poly(
        [
          { x: gem.x, y: gem.y - 11 },
          { x: gem.x + 6, y: gem.y },
          { x: gem.x, y: gem.y + 8 },
          { x: gem.x - 6, y: gem.y },
        ],
        0xd6b8ff,
        0x6a3fb0,
      );
    },
  },
  patung: {
    top: 60,
    draw(p) {
      p.box(0.15, 0.15, 0.85, 0.85, 14, 0xbab3a3);
      const c = p.fp(0.5, 0.5, 14);
      p.poly(
        [
          { x: c.x - 4, y: c.y - 20 },
          { x: c.x - 20, y: c.y - 36 },
          { x: c.x - 12, y: c.y - 16 },
        ],
        0xe0b030,
      );
      p.poly(
        [
          { x: c.x + 4, y: c.y - 20 },
          { x: c.x + 20, y: c.y - 36 },
          { x: c.x + 12, y: c.y - 16 },
        ],
        0xc9961f,
      );
      p.ellipse({ x: c.x, y: c.y - 12 }, 9, 12, C.gold, 0x8a6a10);
      p.ellipse({ x: c.x + 3, y: c.y - 28 }, 7, 6, C.gold, 0x8a6a10);
      p.poly(
        [
          { x: c.x + 1, y: c.y - 33 },
          { x: c.x + 3, y: c.y - 42 },
          { x: c.x + 6, y: c.y - 33 },
        ],
        0xfff1b0,
      );
    },
  },
  // Obstacles
  pohon: {
    top: 70,
    draw(p) {
      const base = p.fp(0.5, 0.5);
      p.ellipse({ x: base.x, y: base.y }, 14, 6, 0x000000, null, 0.18);
      p.poly(
        [
          { x: base.x - 3, y: base.y },
          { x: base.x + 3, y: base.y },
          { x: base.x + 2, y: base.y - 12 },
          { x: base.x - 2, y: base.y - 12 },
        ],
        0x6b4426,
      );
      for (const [w, y, c] of [
        [18, 10, 0x2e6b36],
        [15, 24, 0x347a3d],
        [11, 37, 0x3d8c46],
      ] as const) {
        p.poly(
          [
            { x: base.x - w, y: base.y - y },
            { x: base.x + w, y: base.y - y },
            { x: base.x, y: base.y - y - 22 },
          ],
          c,
        );
      }
    },
  },
  kaktus: {
    top: 60,
    draw(p) {
      const c = p.fp(0.5, 0.5);
      p.ellipse({ x: c.x, y: c.y }, 12, 5, 0x000000, null, 0.18);
      // A tall trunk with two raised arms.
      const arm = (x0: number, y0: number, dx: number) =>
        p.poly(
          [
            { x: x0, y: y0 },
            { x: x0 + dx, y: y0 },
            { x: x0 + dx, y: y0 - 16 },
            { x: x0 + dx * 0.55, y: y0 - 16 },
            { x: x0 + dx * 0.55, y: y0 - 5 },
            { x: x0, y: y0 - 5 },
          ],
          0x4f9a4a,
          0x2d5e2b,
        );
      arm(c.x - 4, c.y - 18, -11);
      arm(c.x + 4, c.y - 26, 11);
      p.poly(
        [
          { x: c.x - 5, y: c.y },
          { x: c.x + 5, y: c.y },
          { x: c.x + 5, y: c.y - 44 },
          { x: c.x, y: c.y - 48 },
          { x: c.x - 5, y: c.y - 44 },
        ],
        0x5aaa52,
        0x2d5e2b,
      );
      p.line({ x: c.x, y: c.y - 2 }, { x: c.x, y: c.y - 44 }, 0x3f7f3a, 1.2);
      p.ellipse({ x: c.x, y: c.y - 48 }, 3, 2.5, 0xff8fb0, 0xc04a70);
    },
  },
  'batu-pasir': {
    top: 30,
    draw(p) {
      const c = p.fp(0.5, 0.5);
      p.ellipse({ x: c.x, y: c.y + 2 }, 16, 7, 0x000000, null, 0.18);
      p.poly(
        [
          { x: c.x - 16, y: c.y + 2 },
          { x: c.x - 13, y: c.y - 12 },
          { x: c.x + 2, y: c.y - 18 },
          { x: c.x + 15, y: c.y - 10 },
          { x: c.x + 16, y: c.y + 1 },
          { x: c.x + 4, y: c.y + 5 },
        ],
        0xd29a5a,
        0x8a5a2c,
      );
      // Layered bands of sandstone.
      p.line({ x: c.x - 14, y: c.y - 4 }, { x: c.x + 15, y: c.y - 3 }, 0xb57a3e, 1.6);
      p.line({ x: c.x - 13, y: c.y - 9 }, { x: c.x + 14, y: c.y - 7 }, 0xe6b77a, 1.4);
    },
  },
  cemara: {
    top: 74,
    draw(p) {
      const base = p.fp(0.5, 0.5);
      p.ellipse({ x: base.x, y: base.y }, 14, 6, 0x000000, null, 0.18);
      p.poly(
        [
          { x: base.x - 3, y: base.y },
          { x: base.x + 3, y: base.y },
          { x: base.x + 2, y: base.y - 10 },
          { x: base.x - 2, y: base.y - 10 },
        ],
        0x5a3a22,
      );
      for (const [w, y] of [
        [17, 8],
        [14, 22],
        [10, 36],
      ] as const) {
        p.poly(
          [
            { x: base.x - w, y: base.y - y },
            { x: base.x + w, y: base.y - y },
            { x: base.x, y: base.y - y - 22 },
          ],
          0x1f5a4a,
        );
        // Snow resting on each layer.
        p.poly(
          [
            { x: base.x - w * 0.6, y: base.y - y - 8 },
            { x: base.x + w * 0.5, y: base.y - y - 9 },
            { x: base.x, y: base.y - y - 22 },
          ],
          0xf4f8fc,
          null,
        );
      }
    },
  },
  'batu-es': {
    top: 34,
    draw(p) {
      const c = p.fp(0.5, 0.5);
      p.ellipse({ x: c.x, y: c.y + 2 }, 16, 7, 0x000000, null, 0.15);
      p.poly(
        [
          { x: c.x - 15, y: c.y + 2 },
          { x: c.x - 10, y: c.y - 16 },
          { x: c.x - 1, y: c.y - 22 },
          { x: c.x + 12, y: c.y - 13 },
          { x: c.x + 15, y: c.y + 1 },
          { x: c.x + 3, y: c.y + 5 },
        ],
        0x9fd8f0,
        0x4a8cb0,
      );
      p.poly(
        [
          { x: c.x - 1, y: c.y - 22 },
          { x: c.x + 12, y: c.y - 13 },
          { x: c.x + 15, y: c.y + 1 },
          { x: c.x + 3, y: c.y - 6 },
        ],
        0x7cc0e0,
        null,
      );
      p.ellipse({ x: c.x - 6, y: c.y - 12 }, 3, 4, 0xffffff, null, 0.85);
    },
  },
  'batu-emas': {
    top: 30,
    draw(p) {
      const c = p.fp(0.5, 0.5);
      p.ellipse({ x: c.x, y: c.y + 2 }, 16, 7, 0x000000, null, 0.18);
      p.poly(
        [
          { x: c.x - 15, y: c.y + 2 },
          { x: c.x - 11, y: c.y - 9 },
          { x: c.x - 1, y: c.y - 15 },
          { x: c.x + 11, y: c.y - 11 },
          { x: c.x + 15, y: c.y },
          { x: c.x + 5, y: c.y + 5 },
        ],
        0x8f8a80,
        0x4e4a44,
      );
      // Gold nuggets catching the light from the top-left.
      for (const [dx, dy, r] of [
        [-7, -5, 3.4],
        [3, -9, 2.8],
        [7, -2, 3],
        [-1, 0, 2.4],
      ] as const) {
        p.ellipse({ x: c.x + dx, y: c.y + dy }, r, r * 0.8, 0xffcf40, 0xb8860b);
        p.ellipse({ x: c.x + dx - r * 0.3, y: c.y + dy - r * 0.3 }, r * 0.35, r * 0.3, 0xfff3b0);
      }
    },
  },
  batu: {
    top: 30,
    draw(p) {
      const c = p.fp(0.5, 0.5);
      p.ellipse({ x: c.x, y: c.y + 2 }, 16, 7, 0x000000, null, 0.18);
      p.poly(
        [
          { x: c.x - 16, y: c.y + 2 },
          { x: c.x - 12, y: c.y - 10 },
          { x: c.x - 2, y: c.y - 17 },
          { x: c.x + 11, y: c.y - 12 },
          { x: c.x + 16, y: c.y },
          { x: c.x + 6, y: c.y + 5 },
        ],
        0x9a9a9a,
      );
      p.poly(
        [
          { x: c.x - 2, y: c.y - 17 },
          { x: c.x + 11, y: c.y - 12 },
          { x: c.x + 16, y: c.y },
          { x: c.x + 4, y: c.y - 6 },
        ],
        0x7d7d7d,
        null,
      );
      p.ellipse({ x: c.x - 6, y: c.y - 9 }, 3, 2, 0xd0d0d0, null, 0.8);
    },
  },
  semak: {
    top: 26,
    draw(p) {
      const c = p.fp(0.5, 0.5);
      p.ellipse({ x: c.x, y: c.y + 2 }, 15, 6, 0x000000, null, 0.18);
      for (const [dx, dy, r] of [
        [-8, -6, 8],
        [7, -6, 8],
        [0, -12, 9],
      ] as const) {
        p.ellipse({ x: c.x + dx, y: c.y + dy }, r, r * 0.85, 0x3f7f3a, 0x24502a);
      }
      for (const [dx, dy] of [
        [-6, -10],
        [4, -14],
        [8, -5],
      ] as const) {
        p.ellipse({ x: c.x + dx, y: c.y + dy }, 1.8, 1.8, 0xd23b3b);
      }
    },
  },
};

// Legacy/compatibility aliases for procedural fallbacks
if (DESIGNS.gudang) DESIGNS.kandang = DESIGNS.gudang;
if (DESIGNS.altar) DESIGNS['soul-mixer'] = DESIGNS.altar;
if (DESIGNS['kandang-kuda']) DESIGNS['barak-berkuda'] = DESIGNS['kandang-kuda'];
if (DESIGNS.barak) DESIGNS.petarung = DESIGNS.barak;

function sizeOfType(type: string): number {
  return (gameData.buildingById.get(type) ?? gameData.obstacleById.get(type))?.size ?? 1;
}

export interface ArtTexture {
  key: string;
  /** Frame inside an atlas texture (painted art from apps/game/art/); none for code-drawn art. */
  frame?: string;
  originX: number;
  originY: number;
  /** Roughly how far (world px) the drawing rises above the footprint centre. */
  height: number;
}

function draw(
  scene: Phaser.Scene,
  key: string,
  n: number,
  top: number,
  paint: (p: Painter) => void,
): ArtTexture {
  const pad = 14;
  const w = n * TILE_W + pad * 2;
  const cyLocal = pad + top + (n * TILE_H) / 2;
  const h = cyLocal + (n * TILE_H) / 2 + pad;
  if (!scene.textures.exists(key)) {
    const R = BUILDING_RES;
    const g = scene.make.graphics({}, false);
    paint(new Painter(g, R, (w / 2) * R, cyLocal * R, n));
    g.generateTexture(key, Math.ceil(w * R), Math.ceil(h * R));
    g.destroy();
  }
  return { key, originX: 0.5, originY: cyLocal / h, height: top * 0.8 };
}

/** Atlas holding painted building, wild-node and animal art (see apps/game/art/README.md). */
export const BUILDING_ATLAS = 'buildings';

/**
 * Painted art from the buildings atlas, when there is some: frame "<type>/lv<level>-<variant>",
 * then "<type>/lv<level>", then lower levels. The PNG is drawn at BUILDING_RES × world size
 * with the bottom tip of the footprint diamond at the bottom centre of the image.
 */
function atlasArt(
  scene: Phaser.Scene,
  type: string,
  level: number,
  variant: BuildingVariant,
  n: number,
): ArtTexture | null {
  if (!scene.textures.exists(BUILDING_ATLAS)) return null;
  const atlas = scene.textures.get(BUILDING_ATLAS);
  const names: string[] = [];
  for (let l = level; l >= 1; l--) {
    if (variant !== 'normal') names.push(`${type}/lv${l}-${variant}`);
    names.push(`${type}/lv${l}`);
  }
  const name = names.find((x) => atlas.has(x));
  if (!name) return null;
  const frame = atlas.get(name);
  const h = frame.realHeight;
  const half = (n * TILE_H * BUILDING_RES) / 2;
  return {
    key: BUILDING_ATLAS,
    frame: name,
    originX: 0.5,
    originY: 1 - half / h,
    height: (h - half) / BUILDING_RES,
  };
}

/**
 * Painted Peternakan without its own `ranch-<count>` frame: the painted pen with the code-drawn
 * animals on top, baked once into a texture per level and count.
 */
function withRanchAnimals(
  scene: Phaser.Scene,
  painted: ArtTexture,
  n: number,
  count: number,
): ArtTexture {
  const key = `bld:painted:${painted.frame}:ranch-${count}`;
  const frame = scene.textures.getFrame(BUILDING_ATLAS, painted.frame);
  const w = frame.realWidth;
  const h = frame.realHeight;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addDynamicTexture(key, w, h);
    if (!tex) return painted;
    const img = scene.make.image({ key: BUILDING_ATLAS, frame: painted.frame }, false);
    img.setOrigin(0, 0);
    tex.draw(img, 0, 0);
    img.destroy();
    const g = scene.make.graphics({}, false);
    const half = (n * TILE_H * BUILDING_RES) / 2;
    ranchAnimals(new Painter(g, BUILDING_RES, w / 2, h - half, n), count);
    tex.draw(g, 0, 0);
    g.destroy();
  }
  return { key, originX: painted.originX, originY: painted.originY, height: painted.height };
}

/**
 * Painted wall tile joined from pieces (made by `pnpm art:wall`): the half-tile sections towards
 * each neighbour in the `wall-<mask>` variant, then the post on top. Every piece is a one-tile
 * canvas with the same anchor, so they stack at (0, 0). Baked once per level and mask.
 */
function wallPiecesArt(
  scene: Phaser.Scene,
  type: string,
  level: number,
  variant: BuildingVariant,
): ArtTexture | null {
  if (!scene.textures.exists(BUILDING_ATLAS)) return null;
  const atlas = scene.textures.get(BUILDING_ATLAS);
  let l = level;
  while (l >= 1 && !atlas.has(`${type}/lv${l}-post`)) l--;
  if (l < 1) return null;
  const mask = variant.startsWith('wall-') ? Number(variant.slice(5)) : 0;
  const pieces = [
    [4, 'seg-xn'],
    [8, 'seg-yn'],
    [1, 'seg-xp'],
    [2, 'seg-yp'],
  ]
    .filter(([bit]) => mask & (bit as number))
    .map(([, name]) => `${type}/lv${l}-${name}`)
    .filter((name) => atlas.has(name));
  pieces.push(`${type}/lv${l}-post`);
  const post = atlas.get(`${type}/lv${l}-post`);
  const w = post.realWidth;
  const h = post.realHeight;
  const key = `bld:painted:${type}:lv${l}:wall-${mask}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addDynamicTexture(key, w, h);
    if (!tex) return null;
    for (const frame of pieces) {
      const img = scene.make.image({ key: BUILDING_ATLAS, frame }, false);
      img.setOrigin(0, 0);
      tex.draw(img, 0, 0);
      img.destroy();
    }
  }
  const half = (TILE_H * BUILDING_RES) / 2;
  return { key, originX: 0.5, originY: 1 - half / h, height: (h - half) / BUILDING_RES };
}

/** Texture of a building (or obstacle) type; anchored at its footprint center. */
export function buildingTexture(
  scene: Phaser.Scene,
  type: string,
  level: number,
  variant: BuildingVariant = 'normal',
): ArtTexture {
  const n = sizeOfType(type);
  if (gameData.buildingById.get(type)?.lineBuild) {
    const wall = wallPiecesArt(scene, type, Math.max(1, level), variant);
    if (wall) return wall;
  }
  const painted = atlasArt(scene, type, Math.max(1, level), variant, n);
  if (painted) {
    const count = ranchCount(variant);
    if (count > 0 && !painted.frame!.endsWith(variant))
      return withRanchAnimals(scene, painted, n, count);
    return painted;
  }
  const design = DESIGNS[type];
  const key = `bld:${type}:${level}:${variant}`;
  if (!design) {
    return draw(scene, key, n, 40, (p) => p.box(0.1, 0.1, 0.9, 0.9, 24, 0xcc66cc));
  }
  return draw(scene, key, n, design.top, (p) => design.draw(p, Math.max(1, level), variant));
}

/** Dirt plot with scaffolding, shown while a building is constructed for the first time. */
export function constructionSiteTexture(scene: Phaser.Scene, size: number): ArtTexture {
  return draw(scene, `site:${size}`, size, 60, (p) => {
    p.flat(0.04, 0.04, 0.96, 0.96, 0xa07548, 0, 0x6b4a2a);
    p.box(0.3, 0.3, 0.7, 0.7, 14, 0xd9ccae);
    scaffold(p);
    p.box(0.75, 0.1, 0.92, 0.27, 8, 0xc58b4f);
  });
}

/** Wooden scaffolding drawn over a building being upgraded. */
export function scaffoldTexture(scene: Phaser.Scene, size: number): ArtTexture {
  return draw(scene, `scaffold:${size}`, size, 60, scaffold);
}

function scaffold(p: Painter) {
  const h = 34 + p.n * 4;
  const wood = 0x8a5a2b;
  const corners: [number, number][] = [
    [0.12, 0.88],
    [0.88, 0.88],
    [0.88, 0.12],
  ];
  for (const [u, v] of corners) p.line(p.fp(u, v), p.fp(u, v, h), wood, 2.2);
  for (const z of [h * 0.45, h]) {
    p.line(p.fp(0.12, 0.88, z), p.fp(0.88, 0.88, z), 0xb07a3f, 2.6);
    p.line(p.fp(0.88, 0.88, z), p.fp(0.88, 0.12, z), 0xb07a3f, 2.6);
  }
  p.line(p.fp(0.12, 0.88), p.fp(0.88, 0.88, h * 0.45), wood, 1.4);
  p.line(p.fp(0.88, 0.88), p.fp(0.88, 0.12, h * 0.45), wood, 1.4);
}

/** Small icon of a building for menus (normal variant, current max look). */
export function buildingIcon(scene: Phaser.Scene, type: string, level = 1): ArtTexture {
  if (gameData.buildingById.get(type)?.lineBuild)
    return buildingTexture(scene, type, level, 'wall-5');
  return buildingTexture(scene, type, level, type === 'ladang' ? 'crop-ready' : 'normal');
}
