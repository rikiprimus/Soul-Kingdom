import Phaser from 'phaser';
import { TIERS, type FeelTier } from './math';

/**
 * Game-feel effects (see the game-feel skill): eased squash & stretch "pops" and short
 * particle bursts. Effects are transient — everything returns to rest — and particles
 * come from one reused emitter per kind instead of being created per event.
 */

export type BurstKind = 'dust' | 'chips' | 'sparkle';

const BURST_COLORS: Record<BurstKind, number[]> = {
  dust: [0xd9c49a, 0xbfa77a, 0xe8dcc0],
  chips: [0xa86b3c, 0x7a4a26, 0xc9cbd3, 0x8fcf63],
  sparkle: [0xffe066, 0xfff4c2, 0xffcf40],
};

function ensureTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('fx:dot')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 0.35).fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 1).fillCircle(8, 8, 5);
    g.generateTexture('fx:dot', 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists('fx:star')) {
    const g = scene.make.graphics({}, false);
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? 8 : 3;
      pts.push({ x: 8 + Math.cos(a) * r, y: 8 + Math.sin(a) * r });
    }
    g.fillStyle(0xffffff, 1).fillPoints(pts, true);
    g.generateTexture('fx:star', 16, 16);
    g.destroy();
  }
}

const emitters = new WeakMap<
  Phaser.Scene,
  Map<BurstKind, Phaser.GameObjects.Particles.ParticleEmitter>
>();

function emitterFor(scene: Phaser.Scene, kind: BurstKind) {
  ensureTextures(scene);
  let byKind = emitters.get(scene);
  if (!byKind) {
    byKind = new Map();
    emitters.set(scene, byKind);
    scene.events.once('shutdown', () => emitters.delete(scene));
  }
  let emitter = byKind.get(kind);
  if (!emitter || !emitter.scene) {
    const sparkle = kind === 'sparkle';
    emitter = scene.add.particles(0, 0, sparkle ? 'fx:star' : 'fx:dot', {
      emitting: false,
      lifespan: { min: 350, max: sparkle ? 900 : 650 },
      speed: { min: 40, max: sparkle ? 160 : 110 },
      angle: sparkle ? { min: 0, max: 360 } : { min: 200, max: 340 },
      gravityY: sparkle ? 60 : 220,
      scale: { start: sparkle ? 0.9 : 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: sparkle ? { min: 0, max: 360 } : 0,
      tint: BURST_COLORS[kind],
      // Particles start anywhere on a flat ellipse, like the footprint of a tile.
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Ellipse(0, 0, sparkle ? 90 : 70, sparkle ? 45 : 32),
      } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
    emitter.setDepth(1_200_000);
    byKind.set(kind, emitter);
  }
  return emitter;
}

/** A short burst of dust, wood/stone chips or sparkles at a world point. */
export function burst(scene: Phaser.Scene, x: number, y: number, kind: BurstKind, tier: FeelTier) {
  const { particles } = TIERS[tier];
  if (particles === 0) return;
  emitterFor(scene, kind).explode(particles, x, y);
}

/**
 * Squash & stretch "pop": squash on the event, then spring back past rest with an
 * overshoot (Back ease) and settle. The object's own scale is the rest pose.
 */
export function pop(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject,
  tier: FeelTier,
) {
  const { squash, popMs } = TIERS[tier];
  const restX = (target.getData('restScaleX') as number | undefined) ?? target.scaleX;
  const restY = (target.getData('restScaleY') as number | undefined) ?? target.scaleY;
  target.setData('restScaleX', restX).setData('restScaleY', restY);
  scene.tweens.killTweensOf(target);
  target.setScale(restX * (1 + squash), restY * (1 - squash));
  scene.tweens.add({
    targets: target,
    scaleX: restX,
    scaleY: restY,
    duration: popMs,
    ease: 'Back.easeOut',
  });
}
