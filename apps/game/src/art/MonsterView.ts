import Phaser from 'phaser';
import { elementUnits, gameData, rarityOf, type Rarity } from '@soul-monster/shared';
import { lighten } from '../ui/widgets';
import { ART_RES, glowTexture, monsterTexture, type MonsterArtSpec } from './monsterArt';
import { elementColor, unitColor } from './palette';

const GOLD = 0xffcf40;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

/** Particle texture per base unit, drawn once and shared by every monster. */
function unitParticleTexture(scene: Phaser.Scene, unit: string): string {
  const key = `fx:${unit}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  const c = unitColor(unit);
  let w = 16;
  let h = 16;
  switch (unit) {
    case 'api':
      g.fillStyle(0xffffff).fillCircle(8, 8, 6);
      break;
    case 'air':
      g.fillStyle(lighten(c, 0.3)).fillCircle(8, 10, 5).fillTriangle(3.5, 9, 12.5, 9, 8, 1);
      break;
    case 'tanah':
      g.fillStyle(c).fillPoints(
        [
          { x: 2, y: 4 },
          { x: 11, y: 2 },
          { x: 14, y: 11 },
          { x: 5, y: 14 },
        ],
        true,
      );
      break;
    case 'angin':
      w = 32;
      h = 6;
      g.fillStyle(0xffffff, 0.9).fillRoundedRect(0, 1, 32, 4, 2);
      break;
    case 'cahaya':
      g.fillStyle(0xffffff).fillPoints(
        [
          { x: 8, y: 0 },
          { x: 10, y: 6 },
          { x: 16, y: 8 },
          { x: 10, y: 10 },
          { x: 8, y: 16 },
          { x: 6, y: 10 },
          { x: 0, y: 8 },
          { x: 6, y: 6 },
        ],
        true,
      );
      break;
    default:
      // kegelapan: soft smoke puff
      g.fillStyle(0xffffff, 0.35).fillCircle(8, 8, 8);
      g.fillStyle(0xffffff, 0.6).fillCircle(8, 8, 5);
  }
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

/** Emitter recipe per base unit; `s` scales speeds and zones to the monster size. */
function unitEmitterConfig(unit: string, s: number, frequency: number): EmitterConfig {
  const c = unitColor(unit);
  const zone = (r: number, y = 0) => ({
    type: 'random' as const,
    source: new Phaser.Geom.Circle(0, y * s, r * s),
    quantity: 1,
  });
  const common = { frequency, maxAliveParticles: 8, emitZone: zone(30) };
  switch (unit) {
    case 'api': // embers drifting up
      return {
        ...common,
        lifespan: 1000,
        speedY: { min: -40 * s, max: -18 * s },
        speedX: { min: -8 * s, max: 8 * s },
        scale: { start: 0.55 * s, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffd166, c, 0xff3d00],
        blendMode: 'ADD',
      };
    case 'air': // droplets falling
      return {
        ...common,
        emitZone: zone(26, -18),
        lifespan: 900,
        speedY: { min: 8 * s, max: 20 * s },
        gravityY: 70 * s,
        scale: { start: 0.55 * s, end: 0.3 * s },
        alpha: { start: 0.9, end: 0 },
      };
    case 'tanah': // shards popping out
      return {
        ...common,
        emitZone: zone(14, 22),
        lifespan: 900,
        speed: { min: 25 * s, max: 45 * s },
        angle: { min: 210, max: 330 },
        gravityY: 140 * s,
        rotate: { min: 0, max: 360 },
        scale: { start: 0.55 * s, end: 0.35 * s },
        alpha: { start: 1, end: 0 },
      };
    case 'angin': // wind streaks
      return {
        ...common,
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Rectangle(-40 * s, -30 * s, 20 * s, 60 * s),
          quantity: 1,
        },
        lifespan: 700,
        speedX: { min: 60 * s, max: 95 * s },
        scaleX: { start: 0.7 * s, end: 0.2 * s },
        scaleY: 0.6 * s,
        alpha: { start: 0, end: 0.9, ease: 'Sine.easeInOut' },
        tint: [0xffffff, c],
      };
    case 'cahaya': // twinkles
      return {
        ...common,
        emitZone: zone(36),
        lifespan: 800,
        speed: { min: 0, max: 6 * s },
        scale: { start: 0.75 * s, end: 0 },
        rotate: { start: 0, end: 90 },
        alpha: { start: 1, end: 0.2 },
        tint: [0xffffff, c],
        blendMode: 'ADD',
      };
    default: // kegelapan: dark smoke
      return {
        ...common,
        emitZone: zone(24, 8),
        lifespan: 1500,
        speedY: { min: -14 * s, max: -5 * s },
        speedX: { min: -5 * s, max: 5 * s },
        scale: { start: 0.6 * s, end: 1.6 * s },
        alpha: { start: 0.55, end: 0 },
        tint: [c, 0x2a1440],
      };
  }
}

export interface MonsterViewOptions {
  /** Rarity effects (animation, aura, particles). Default true. */
  effects?: boolean;
  /** Black "???" silhouette for undiscovered entries. */
  silhouette?: boolean;
}

/**
 * A monster with its rarity effects from `rules.rarity.visuals`: biasa is still;
 * langka breathes with an element aura; epik adds unit particles; legenda adds a
 * gold aura (the gold card frame is drawn by the card).
 */
export class MonsterView extends Phaser.GameObjects.Container {
  readonly rarity: Rarity;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    spec: MonsterArtSpec,
    size: number,
    opts: MonsterViewOptions = {},
  ) {
    super(scene, x, y);
    this.rarity = rarityOf(spec);
    const visuals = gameData.rules.rarity.visuals[this.rarity];
    const effects = (opts.effects ?? true) && !opts.silhouette;
    const s = size / 100;

    if (effects && visuals.aura !== 'none') {
      const color = visuals.aura === 'gold' ? GOLD : elementColor(spec.element);
      const aura = scene.add
        .image(0, size * 0.08, glowTexture(scene))
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.55)
        .setScale((size * (visuals.aura === 'gold' ? 1.25 : 1.05)) / 128);
      this.add(aura);
      scene.tweens.add({
        targets: aura,
        alpha: 0.85,
        scale: aura.scale * 1.1,
        duration: 1100 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const body = scene.add
      .image(0, size * 0.44, monsterTexture(scene, spec, size))
      .setOrigin(0.5, 0.94);
    body.setScale(1 / ART_RES);
    if (opts.silhouette) body.setTintFill(0x0c0818).setAlpha(0.85);
    this.add(body);

    if (effects && visuals.elementEffect) {
      const units = elementUnits(spec.element);
      const frequency = 160 * Math.max(1, units.length * 0.8);
      for (const unit of units) {
        const emitter = scene.add.particles(
          0,
          0,
          unitParticleTexture(scene, unit),
          unitEmitterConfig(unit, s, frequency),
        );
        this.add(emitter);
      }
      if (this.rarity === 'legenda') {
        const sparkle = scene.add.particles(0, 0, unitParticleTexture(scene, 'cahaya'), {
          ...unitEmitterConfig('cahaya', s, 260),
          tint: [GOLD, 0xfff1b0],
        });
        this.add(sparkle);
      }
    }
    if (effects && visuals.animation) {
      const base = body.scale;
      scene.tweens.add({
        targets: body,
        scaleY: base * 1.05,
        scaleX: base * 0.975,
        duration: 850 + Math.random() * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 400,
      });
      scene.tweens.add({
        targets: body,
        angle: { from: -2.5, to: 2.5 },
        duration: 1500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    scene.add.existing(this);
  }
}
