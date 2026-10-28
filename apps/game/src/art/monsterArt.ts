import Phaser from 'phaser';
import {
  gameData,
  getStage,
  hashSeed,
  isSecretElement,
  type ElementId,
  type FormId,
  type StageId,
} from '@soul-monster/shared';
import { darken, lighten } from '../ui/widgets';
import { elementColors } from './palette';

/** Textures are drawn at this multiple of display size for crisp scaling. */
export const ART_RES = 2;

export interface MonsterArtSpec {
  species?: string;
  form?: FormId;
  element?: ElementId;
  stage: StageId;
}

export function getSpecInfo(spec: MonsterArtSpec) {
  const speciesId = spec.species ?? spec.form;
  const def = speciesId ? gameData.monsterById.get(speciesId) : undefined;
  const form = spec.form ? gameData.formById.get(spec.form) : undefined;
  const tier = def?.tier ?? form?.tier ?? 1;
  const role = def?.role ?? form?.role ?? 'penahan';
  const element = (def?.element ?? spec.element ?? 'normal') as ElementId;
  const id = speciesId ?? 'baby-slime';
  return { id, tier, role, element };
}

type Pt = { x: number; y: number };
type G = Phaser.GameObjects.Graphics;

function fillStroke(g: G, points: Pt[], fill: number, outline: number, width: number, alpha = 1) {
  g.fillStyle(fill, alpha).fillPoints(points, true);
  g.lineStyle(width, outline, 1).strokePoints(points, true, true);
}

function ellipse(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  outline: number,
  lw: number,
) {
  g.fillStyle(fill, 1).fillEllipse(x, y, w, h);
  g.lineStyle(lw, outline, 1).strokeEllipse(x, y, w, h);
}

const mirror = (points: Pt[], cx: number): Pt[] => points.map((p) => ({ x: 2 * cx - p.x, y: p.y }));

/**
 * Draws a code-generated monster: tier sets the silhouette (round → fanged →
 * horned → winged → crowned), the stage sets size and head proportion, and the
 * element units set the colours. Form/species id adds small stable variations.
 */
function drawMonster(g: G, spec: MonsterArtSpec, S: number) {
  const { id, tier, role, element } = getSpecInfo(spec);
  const stages = gameData.rules.growth.stages.length;
  const grow = stages > 1 ? getStage(spec.stage).index / (stages - 1) : 1;
  const variant = hashSeed(id);
  const v1 = variant & 3;
  const v2 = (variant >> 2) & 3;

  const colors = elementColors(element);
  const c0 = colors[0]!;
  const c1 = colors[1] ?? lighten(c0, 0.45);
  const c2 = colors[2] ?? darken(c0, 0.22);
  const extra = colors.slice(3);
  const outline = darken(c0, 0.6);
  const lw = S * 0.014;
  const gold = 0xffcf40;

  const k = 0.62 + 0.38 * grow;
  const headScale = 1.4 - 0.4 * grow;
  const tierScale = [1, 1, 1.03, 1.07, 1.12, 1.15, 1.2, 1.25][tier - 1] ?? 1;
  const cx = S / 2;
  const ground = S * 0.94;
  const bodyW = S * 0.44 * k * tierScale * (role === 'penahan' ? 1.12 : 1);
  const bodyH = S * 0.33 * k * tierScale;
  const bodyCY = ground - bodyH / 2 - S * 0.03 * k;
  const r = S * 0.15 * k * headScale * tierScale;
  const headCY = bodyCY - bodyH * 0.42 - r * 0.55;
  const headCX = cx + (role === 'petarung' ? bodyW * 0.06 : 0);

  // Halo behind everything for legends.
  if (tier >= 5) {
    g.lineStyle(S * 0.02, gold, 0.8).strokeCircle(headCX, headCY, r * 1.45);
    g.lineStyle(S * 0.008, lighten(gold, 0.5), 0.9).strokeCircle(headCX, headCY, r * 1.58);
  }

  // Wings.
  if ((tier === 4 && role !== 'penahan') || tier >= 5) {
    const span = Math.min(bodyW * 1.02, S * 0.47);
    const wing: Pt[] = [
      { x: cx - bodyW * 0.15, y: bodyCY - bodyH * 0.35 },
      { x: cx - span, y: bodyCY - bodyH * 1.35 },
      { x: cx - span * 0.98, y: bodyCY - bodyH * 0.15 },
      { x: cx - span * 0.72, y: bodyCY - bodyH * 0.32 },
      { x: cx - span * 0.6, y: bodyCY + bodyH * 0.05 },
      { x: cx - span * 0.38, y: bodyCY - bodyH * 0.12 },
    ];
    for (const pts of [wing, mirror(wing, cx)]) {
      fillStroke(g, pts, c1, darken(c1, 0.55), lw, 0.95);
      g.lineStyle(lw * 0.7, darken(c1, 0.35), 0.8);
      const root = pts[0]!;
      for (const i of [2, 4]) g.lineBetween(root.x, root.y, pts[i]!.x, pts[i]!.y);
    }
  }

  // Tail.
  if (tier >= 2 || v1 !== 0) {
    const dir = role === 'petarung' ? -1 : 1;
    const start = { x: cx + dir * bodyW * 0.42, y: bodyCY + bodyH * 0.12 };
    const tip = {
      x: cx + dir * Math.min(bodyW * 0.78, S * 0.44),
      y: bodyCY - bodyH * (0.55 + 0.1 * tier),
    };
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(start.x, start.y),
      new Phaser.Math.Vector2(tip.x + dir * S * 0.02, start.y),
      new Phaser.Math.Vector2(tip.x, tip.y),
    );
    const pts = curve.getPoints(16);
    g.lineStyle(S * 0.06 * k, outline, 1).strokePoints(pts);
    g.lineStyle(S * 0.06 * k - lw * 2, c0, 1).strokePoints(pts);
    if (role === 'penembak') {
      g.fillStyle(c1, 0.35).fillCircle(tip.x, tip.y, S * 0.06 * k);
      ellipse(g, tip.x, tip.y, S * 0.07 * k, S * 0.07 * k, c1, darken(c1, 0.5), lw);
      g.fillStyle(0xffffff, 0.8).fillCircle(tip.x - S * 0.01, tip.y - S * 0.01, S * 0.012);
    } else if (tier >= 3) {
      fillStroke(
        g,
        [
          { x: tip.x - S * 0.03, y: tip.y + S * 0.01 },
          { x: tip.x + dir * S * 0.02, y: tip.y - S * 0.05 },
          { x: tip.x + S * 0.03, y: tip.y + S * 0.01 },
        ],
        c2,
        outline,
        lw,
      );
    }
  }

  // Back spikes for hunters and above (or a hedgehog-like variant).
  if (tier >= 3 || (tier === 1 && v1 === 3)) {
    const n = tier >= 4 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = cx - bodyW * 0.42 + t * bodyW * 0.55;
      const y = bodyCY - bodyH * 0.35 - Math.sin(t * Math.PI) * bodyH * 0.12;
      const h = S * (0.05 + 0.012 * tier) * k;
      fillStroke(
        g,
        [
          { x: x - h * 0.45, y: y + h * 0.3 },
          { x: x - h * 0.2, y: y - h },
          { x: x + h * 0.45, y: y + h * 0.2 },
        ],
        c2,
        outline,
        lw,
      );
    }
  }

  // Feet with claws.
  const footY = ground - S * 0.025 * k;
  for (const side of [-1, 1]) {
    const fx = cx + side * bodyW * 0.27;
    ellipse(g, fx, footY, bodyW * 0.28, S * 0.075 * k, darken(c0, 0.15), outline, lw);
    if (tier >= 2) {
      g.fillStyle(0xfff6e0, 1);
      for (let i = -1; i <= 1; i++) {
        const x = fx + i * bodyW * 0.07;
        g.fillTriangle(
          x - S * 0.012,
          footY + S * 0.02 * k,
          x + S * 0.012,
          footY + S * 0.02 * k,
          x,
          footY + S * 0.05 * k,
        );
      }
    }
  }

  // Body.
  if (tier <= 2) {
    ellipse(g, cx, bodyCY, bodyW * (tier === 2 ? 1.05 : 1), bodyH, c0, outline, lw);
  } else {
    const w = bodyW / 2;
    const h = bodyH / 2;
    const body: Pt[] =
      tier === 3
        ? [
            { x: cx - w, y: bodyCY },
            { x: cx - w * 0.6, y: bodyCY - h },
            { x: cx + w * 0.6, y: bodyCY - h },
            { x: cx + w, y: bodyCY },
            { x: cx + w * 0.62, y: bodyCY + h },
            { x: cx - w * 0.62, y: bodyCY + h },
          ]
        : [
            { x: cx - w * 1.02, y: bodyCY - h * 0.15 },
            { x: cx - w * 0.82, y: bodyCY - h * 0.85 },
            { x: cx - w * 0.3, y: bodyCY - h * 1.05 },
            { x: cx + w * 0.3, y: bodyCY - h * 1.05 },
            { x: cx + w * 0.82, y: bodyCY - h * 0.85 },
            { x: cx + w * 1.02, y: bodyCY - h * 0.15 },
            { x: cx + w * 0.75, y: bodyCY + h },
            { x: cx - w * 0.75, y: bodyCY + h },
          ];
    fillStroke(g, body, c0, outline, lw);
  }

  // Belly patch.
  g.fillStyle(c1, 0.95).fillEllipse(cx, bodyCY + bodyH * 0.14, bodyW * 0.52, bodyH * 0.58);

  // Spots/markings from the remaining units.
  const spots = [
    { x: -0.3, y: -0.12, c: c2 },
    { x: 0.31, y: -0.05, c: c2 },
    { x: -0.18, y: 0.28, c: extra[0] ?? c2 },
    { x: 0.22, y: 0.3, c: extra[1] ?? extra[0] ?? c2 },
    { x: 0.02, y: -0.3, c: extra[2] ?? c2 },
  ];
  const spotCount = colors.length >= 3 ? 5 : colors.length === 2 ? 2 : v2 === 0 ? 0 : 2;
  for (const s of spots.slice(0, spotCount)) {
    g.fillStyle(s.c, 0.95).fillCircle(cx + s.x * bodyW, bodyCY + s.y * bodyH, bodyW * 0.075);
  }

  // Armour plates for tanks.
  if (role === 'penahan' && tier >= 3) {
    for (let i = 0; i < 3; i++) {
      const y = bodyCY - bodyH * 0.08 + i * bodyH * 0.17;
      const w = bodyW * (0.42 - i * 0.06);
      g.fillStyle(darken(c2, 0.1), 1).fillRoundedRect(cx - w / 2, y, w, bodyH * 0.12, bodyH * 0.04);
      g.lineStyle(lw * 0.8, outline, 1).strokeRoundedRect(
        cx - w / 2,
        y,
        w,
        bodyH * 0.12,
        bodyH * 0.04,
      );
    }
  }

  // Ears / horns (behind the head outline).
  const earStyle = tier === 1 ? v1 : tier === 2 ? (v1 % 2 === 0 ? 1 : 2) : -1;
  for (const side of [-1, 1]) {
    const ex = headCX + side * r * 0.62;
    const ey = headCY - r * 0.72;
    if (earStyle === 0 || earStyle === 3) {
      ellipse(g, ex, ey, r * 0.62, r * 0.62, c0, outline, lw);
      g.fillStyle(c1, 1).fillCircle(ex, ey, r * 0.17);
    } else if (earStyle === 1) {
      const tri: Pt[] = [
        { x: ex - side * r * 0.32, y: ey + r * 0.25 },
        { x: ex + side * r * 0.12, y: ey - r * 0.65 },
        { x: ex + side * r * 0.38, y: ey + r * 0.3 },
      ];
      fillStroke(g, tri, c0, outline, lw);
      g.fillStyle(c1, 1).fillTriangle(
        ex - side * r * 0.14,
        ey + r * 0.15,
        ex + side * r * 0.1,
        ey - r * 0.35,
        ex + side * r * 0.22,
        ey + r * 0.18,
      );
    } else if (earStyle === 2) {
      ellipse(g, ex + side * r * 0.05, ey - r * 0.4, r * 0.38, r * 1.15, c0, outline, lw);
      g.fillStyle(c1, 1).fillEllipse(ex + side * r * 0.05, ey - r * 0.38, r * 0.16, r * 0.8);
    } else {
      const len = r * (tier >= 4 ? 1.25 : 0.95);
      const horn: Pt[] = [
        { x: headCX + side * r * 0.25, y: headCY - r * 0.7 },
        { x: headCX + side * r * 0.62, y: headCY - r * 0.55 },
        { x: headCX + side * r * 0.95, y: headCY - r * 0.6 - len },
      ];
      fillStroke(g, horn, lighten(c1, 0.2), darken(c1, 0.6), lw);
    }
  }

  // Head.
  if (tier <= 2) {
    ellipse(g, headCX, headCY, r * 2, r * (tier === 2 ? 1.85 : 1.95), c0, outline, lw);
  } else {
    const head: Pt[] = [
      { x: headCX - r * 0.95, y: headCY - r * 0.35 },
      { x: headCX - r * 0.6, y: headCY - r * 0.9 },
      { x: headCX + r * 0.6, y: headCY - r * 0.9 },
      { x: headCX + r * 0.95, y: headCY - r * 0.35 },
      { x: headCX + r * 0.7, y: headCY + r * 0.55 },
      { x: headCX, y: headCY + r * 0.95 },
      { x: headCX - r * 0.7, y: headCY + r * 0.55 },
    ];
    fillStroke(g, head, c0, outline, lw);
  }
  // Muzzle.
  g.fillStyle(lighten(c1, 0.35), 1).fillEllipse(headCX, headCY + r * 0.42, r * 0.95, r * 0.6);

  // Eyes.
  const big = tier === 1 || grow < 0.5;
  const eyeW = r * (big ? 0.5 : 0.4);
  const eyeH = r * (tier >= 3 ? 0.32 : big ? 0.58 : 0.46);
  for (const side of [-1, 1]) {
    const ex = headCX + side * r * 0.4;
    const ey = headCY - r * 0.05;
    g.fillStyle(tier >= 3 ? lighten(c1, 0.3) : 0xffffff, 1).fillEllipse(ex, ey, eyeW, eyeH);
    g.lineStyle(lw * 0.8, outline, 1).strokeEllipse(ex, ey, eyeW, eyeH);
    if (tier >= 3) {
      g.fillStyle(0x140b24, 1).fillEllipse(ex, ey, eyeW * 0.22, eyeH * 0.9);
    } else {
      g.fillStyle(0x1a1030, 1).fillCircle(ex + side * eyeW * 0.05, ey + eyeH * 0.08, eyeW * 0.3);
      g.fillStyle(0xffffff, 1).fillCircle(ex - eyeW * 0.08, ey - eyeH * 0.12, eyeW * 0.12);
    }
    if (tier >= 3) {
      // Brow ridge.
      g.lineStyle(lw * 1.4, outline, 1).lineBetween(
        ex - side * eyeW * 0.6,
        ey - eyeH * 0.9,
        ex + side * eyeW * 0.6,
        ey - eyeH * 0.5,
      );
    }
  }
  if (tier === 1) {
    g.fillStyle(0xff7aa8, 0.45).fillEllipse(
      headCX - r * 0.62,
      headCY + r * 0.3,
      r * 0.34,
      r * 0.18,
    );
    g.fillStyle(0xff7aa8, 0.45).fillEllipse(
      headCX + r * 0.62,
      headCY + r * 0.3,
      r * 0.34,
      r * 0.18,
    );
  }

  // Nose and mouth.
  g.fillStyle(outline, 1).fillEllipse(headCX, headCY + r * 0.3, r * 0.2, r * 0.12);
  g.lineStyle(lw, outline, 1);
  g.beginPath();
  g.arc(headCX, headCY + r * 0.42, r * 0.22, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
  g.strokePath();
  if (tier >= 2) {
    const fang = r * (0.12 + 0.04 * tier);
    g.fillStyle(0xffffff, 1);
    for (const side of [-1, 1]) {
      const fx = headCX + side * r * 0.16;
      const fy = headCY + r * 0.6;
      g.fillTriangle(fx - fang * 0.4, fy, fx + fang * 0.4, fy, fx, fy + fang);
    }
  }

  // Crown for legends.
  if (tier >= 5) {
    const top = headCY - r * 0.85;
    const crown: Pt[] = [
      { x: headCX - r * 0.55, y: top + r * 0.12 },
      { x: headCX - r * 0.6, y: top - r * 0.45 },
      { x: headCX - r * 0.28, y: top - r * 0.2 },
      { x: headCX, y: top - r * 0.6 },
      { x: headCX + r * 0.28, y: top - r * 0.2 },
      { x: headCX + r * 0.6, y: top - r * 0.45 },
      { x: headCX + r * 0.55, y: top + r * 0.12 },
    ];
    fillStroke(g, crown, gold, darken(gold, 0.55), lw);
    g.fillStyle(c0, 1).fillCircle(headCX, top - r * 0.12, r * 0.09);
    g.fillStyle(0xffffff, 0.9).fillCircle(headCX - r * 0.025, top - r * 0.15, r * 0.03);
  }

  // Secret elements get a glowing chest gem.
  if (isSecretElement(element)) {
    const gy = bodyCY + bodyH * 0.05;
    g.fillStyle(0xffffff, 0.35).fillCircle(cx, gy, bodyW * 0.11);
    fillStroke(
      g,
      [
        { x: cx, y: gy - bodyW * 0.08 },
        { x: cx + bodyW * 0.06, y: gy },
        { x: cx, y: gy + bodyW * 0.08 },
        { x: cx - bodyW * 0.06, y: gy },
      ],
      lighten(c1, 0.4),
      outline,
      lw,
    );
  }
}

function drawToTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  draw: (g: G, S: number) => void,
) {
  if (scene.textures.exists(key)) return key;
  const S = Math.round(size * ART_RES);
  const g = scene.make.graphics({}, false);
  draw(g, S);
  g.generateTexture(key, S, S);
  g.destroy();
  return key;
}

/** Returns a cached texture key for this monster at `size` display pixels. */
export function monsterTexture(scene: Phaser.Scene, spec: MonsterArtSpec, size: number): string {
  const { id, element } = getSpecInfo(spec);
  const key = `mon:${id}:${element}:${spec.stage}:${size}`;
  if (scene.textures.exists(key)) return key;
  const frame = paintedFrame(scene, spec);
  if (frame) return paintedMonster(scene, spec, frame, key, Math.round(size * ART_RES));
  return drawToTexture(scene, key, size, (g, S) => drawMonster(g, spec, S));
}

const MONSTER_ATLAS = 'monsters';

/**
 * Painted frame "<form>/<stage>"; a stage without its own art yet uses the baby art
 * ("<form>/bayi"), still scaled up by growth stage.
 */
function paintedFrame(scene: Phaser.Scene, spec: MonsterArtSpec): string | undefined {
  if (!scene.textures.exists(MONSTER_ATLAS)) return undefined;
  const atlas = scene.textures.get(MONSTER_ATLAS);
  const { id } = getSpecInfo(spec);
  return [`${id}/${spec.stage}`, `${id}/bayi`].find((name) => atlas.has(name));
}

/**
 * Painted art from the monsters atlas: one neutral grey sprite per form and stage, tinted
 * with the element's main colour and scaled by growth stage like the code-drawn art.
 * ponytail: only the first element colour tints the body; mixed elements show the rest via
 * aura and particles. Per-unit colour masks if that reads too flat.
 */
function paintedMonster(
  scene: Phaser.Scene,
  spec: MonsterArtSpec,
  frame: string,
  key: string,
  S: number,
) {
  const { tier, element } = getSpecInfo(spec);
  const stages = gameData.rules.growth.stages.length;
  const grow = stages > 1 ? getStage(spec.stage).index / (stages - 1) : 1;
  const tierScale = [1, 1, 1.03, 1.07, 1.12, 1.15, 1.2, 1.25][tier - 1] ?? 1;
  const image = scene.make.image({ key: MONSTER_ATLAS, frame }, false);
  image
    .setOrigin(0.5, 1)
    .setScale(((0.62 + 0.38 * grow) * tierScale * S * 0.86) / image.width)
    .setTint(lighten(elementColors(element)[0]!, 0.2));
  // The render texture owns the saved texture, so it is kept rather than destroyed.
  const rt = scene.make.renderTexture({ width: S, height: S }, false);
  rt.draw(image, S / 2, S * 0.94).saveTexture(key);
  image.destroy();
  return key;
}

/** Egg used in the mixer queue and the hatching animation. */
export function eggTexture(scene: Phaser.Scene, size: number, color = 0x8a6cff): string {
  const key = `egg:${color}:${size}`;
  return drawToTexture(scene, key, size, (g, S) => {
    const cx = S / 2;
    const cy = S * 0.55;
    const w = S * 0.62;
    const h = S * 0.8;
    const shell = 0xf6efe0;
    g.fillStyle(darken(color, 0.4), 0.25).fillEllipse(cx, S * 0.93, w * 0.8, S * 0.08);
    g.fillStyle(shell, 1).fillEllipse(cx, cy, w, h);
    g.fillStyle(color, 0.85);
    g.fillCircle(cx - w * 0.2, cy - h * 0.15, S * 0.06);
    g.fillCircle(cx + w * 0.22, cy + h * 0.05, S * 0.08);
    g.fillCircle(cx - w * 0.08, cy + h * 0.28, S * 0.05);
    g.fillCircle(cx + w * 0.1, cy - h * 0.32, S * 0.04);
    g.fillStyle(0xffffff, 0.6).fillEllipse(cx - w * 0.2, cy - h * 0.25, w * 0.18, h * 0.22);
    g.lineStyle(S * 0.015, darken(shell, 0.45), 1).strokeEllipse(cx, cy, w, h);
  });
}

/** Round element badge: one pie slice per base unit. */
export function elementIconTexture(scene: Phaser.Scene, element: ElementId, size: number): string {
  const key = `elicon:${element}:${size}`;
  return drawToTexture(scene, key, size, (g, S) => {
    const colors = elementColors(element);
    const cx = S / 2;
    const r = S * 0.42;
    const step = (Math.PI * 2) / colors.length;
    colors.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.slice(cx, cx, r, -Math.PI / 2 + i * step, -Math.PI / 2 + (i + 1) * step, false);
      g.fillPath();
    });
    g.fillStyle(0xffffff, 0.25).fillCircle(cx - r * 0.3, cx - r * 0.35, r * 0.3);
    const secret = isSecretElement(element);
    g.lineStyle(S * (secret ? 0.06 : 0.035), secret ? 0xffcf40 : 0x0d0918, 1).strokeCircle(
      cx,
      cx,
      r,
    );
  });
}

/** Soft radial glow, tinted per use for auras. */
export function glowTexture(scene: Phaser.Scene): string {
  const key = 'fx:glow';
  if (scene.textures.exists(key)) return key;
  const size = 128;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return key;
  const ctx = canvas.getContext();
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();
  return key;
}
