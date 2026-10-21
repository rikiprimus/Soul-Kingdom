import { soldierTexture } from '../art/soldierArt';
import Phaser from 'phaser';
import {
  buildBuilding,
  buildLine,
  canPlace,
  canPlaceBuilding,
  isPlotUnlocked,
  isTileUnlocked,
  nextPlotPrice,
  plotKey,
  plotOf,
  plotsPerSide,
  plotStatus,
  townHallLevel,
  countBuildings,
  lineTiles,
  maxCountFor,
  monsterName,
  encounterGroup,
  isOnMission,
  type Mission,
  gatherWorkers,
  obstacleDef,
  animalWorkers,
  jobSeconds,
  ranchAnimalsIn,
  collectBuilding,
  constructionRemaining,
  cropStatus,
  gameData,
  getStage,
  harvestCrop,
  isReadyToCollect,
  levelDef,
  mixRemaining,
  moveBuilding,
  hashSeed,
  hatchEgg,
  soldierName,
  moveGroup,
  groupMoveTiles,
  connectedGroup,
  pendingProduction,
  productionOf,
  scaleAmount,
  sizeOf,
  type Building,
  type Monster,
} from '@soul-monster/shared';
import {
  BUILDING_RES,
  buildingTexture,
  constructionSiteTexture,
  scaffoldTexture,
  wallMask,
  type ArtTexture,
  type BuildingVariant,
} from '../art/buildingArt';
import {
  footprintCenter,
  isoDrawOrder,
  isoToWorld,
  rankBehindPoint,
  TILE_H,
  worldToIso,
  type Footprint,
} from '../art/iso';
import { MonsterView } from '../art/MonsterView';
import {
  EVT,
  type CollectFx,
  type PlacementConfirm,
  type PlacementRequest,
  type PlacementStatus,
  type Selection,
} from '../events';
import type { GameStore } from '../store';
import { errorText, formatDuration, formatNumber, t } from '../text';
import { costLabel } from '../ui/cost';
import { burst, pop } from '../fx/feel';
import { loadMusic, playSfx, preloadSounds, prepareSounds } from '../audio/sound';
import type { FeelTier } from '../fx/math';
import { encounterTitle } from '../views/enemyText';
import { COLORS, textStyle } from '../ui/theme';
import { cssSize, dpr } from '../ui/dpr';
import { darken, icons } from '../ui/widgets';

interface Sprite {
  id: string;
  kind: 'building' | 'obstacle';
  type: string;
  x: number;
  y: number;
  size: number;
  signature: string;
  image: Phaser.GameObjects.Image;
  overlay?: Phaser.GameObjects.Image;
  bar?: Phaser.GameObjects.Graphics;
  timer?: Phaser.GameObjects.Text;
  bubble?: Phaser.GameObjects.Container;
}

/** Closest the village camera may zoom in. */
const MAX_ZOOM = 2.2;

/**
 * Text that lives on the map is scaled by the camera, so it is drawn at the highest zoom
 * (times the screen density) to stay smooth when zoomed in instead of breaking up.
 */
function worldTextStyle(...args: Parameters<typeof textStyle>) {
  const style = textStyle(...args);
  return { ...style, resolution: Math.min((window.devicePixelRatio || 1) * MAX_ZOOM, 4) };
}

/** Wild animals are drawn smaller than a full tile so buildings read as bigger. */
const ANIMAL_SCALE = 0.65;

/** Trees, rocks and bushes vary in size (0.7–1.15×), fixed per node so it never flickers. */
function wildScale(id: string): number {
  return 0.7 + ((hashSeed(id) % 1000) / 1000) * 0.45;
}

interface Placement {
  type: string;
  moveId?: string;
  x: number;
  y: number;
  size: number;
  ghost: Phaser.GameObjects.Image;
  footprint: Phaser.GameObjects.Graphics;
  valid: boolean;
  /** Line buildings: the tapped start tile (x, y is then the end) and the segment ghosts. */
  line?: { start: { x: number; y: number } | null; ghosts: Phaser.GameObjects.Image[] };
  /** Moving a whole stretch of walls: its building ids and one ghost per segment. */
  group?: { ids: string[]; ghosts: Phaser.GameObjects.Image[] };
}

interface Walker {
  monsterId: string;
  /** Out on (or coming back from) a mission, off the open land. */
  away?: boolean;
  view: MonsterView;
  /** Tile centre the walker is standing on (or walking from). */
  u: number;
  v: number;
  /** Current, possibly in-between, position. */
  cu: number;
  cv: number;
  tween?: Phaser.Tweens.Tween;
  nextMoveAt: number;
}

const MAX_WALKERS = 8;

/** A worker drawn as a little person: wanders near the Balai or walks to its job. */
/** Something that walks tile to tile (workers, animals). */
interface Walkable {
  image: Phaser.GameObjects.Image;
  u: number;
  v: number;
  cu: number;
  cv: number;
  tween?: Phaser.Tweens.Tween;
}

interface Person {
  workerId: string;
  image: Phaser.GameObjects.Image;
  u: number;
  v: number;
  cu: number;
  cv: number;
  tween?: Phaser.Tweens.Tween;
  nextMoveAt: number;
  /** Tile centre of the job (null: wander) and the building it faces. */
  target: { u: number; v: number } | null;
  faceU: number;
}

const PERSON_KEY = 'fx:worker';

/** A wild animal: wanders around its tile, stands still while workers are on it. */
interface AnimalView {
  id: string;
  type: string;
  image: Phaser.GameObjects.Image;
  homeU: number;
  homeV: number;
  u: number;
  v: number;
  cu: number;
  cv: number;
  tween?: Phaser.Tweens.Tween;
  nextMoveAt: number;
}

type BubbleKind = 'gold' | 'food' | 'seed' | 'egg';
const CLIFF = 46;

export class VillageScene extends Phaser.Scene {
  private sprites = new Map<string, Sprite>();
  private selection: Selection = null;
  private selectionGfx?: Phaser.GameObjects.Graphics;
  private placement: Placement | null = null;
  private grid?: Phaser.GameObjects.Graphics;
  private walkers: Walker[] = [];
  private people: Person[] = [];
  private animals: AnimalView[] = [];
  /** Wild enemy groups on the map, by encounter id. */
  private enemies = new Map<string, Phaser.GameObjects.Container>();
  /** Monsters picked for the next fight (highlight rings). */
  private team = new Set<string>();
  private teamGfx?: Phaser.GameObjects.Graphics;
  /** Health bars of running fights, redrawn every frame. */
  private fightGfx?: Phaser.GameObjects.Graphics;
  /** Per mission: when its fight started and ends (scene ms), and its soldier figures. */
  private fights = new Map<
    string,
    { start: number; end: number; soldiers: { id: string; image: Phaser.GameObjects.Image }[] }
  >();
  /** Active play time not yet added to gathering (committed in small batches). */
  private pendingGather = 0;
  private lastTickAt = 0;
  private gatherGfx?: Phaser.GameObjects.Graphics;
  private clouds: Phaser.GameObjects.Image[] = [];
  /** Camera centre from the last frame, restored after a resize. */
  private lastMid?: { x: number; y: number };
  /** Footprints and their draw ranks, recomputed when the layout changes. */
  private footprints: Footprint[] = [];
  private drawOrder = new Map<string, number>();
  private layoutKey = '';
  private hoverGfx?: Phaser.GameObjects.Graphics;
  private hoveredId: string | null = null;
  /** "x,y" of every line-building tile (walls), for connected wall drawing. */
  private wallTiles = new Set<string>();
  /** Locked-land shading and fences; redrawn when plots or their prices change. */
  private landGfx?: Phaser.GameObjects.Graphics;
  private landKey = '';
  /** Price signs on locked plots next to open land, keyed by "px,py". */
  private plotSigns = new Map<string, Phaser.GameObjects.Container>();

  // Pointer gesture state.
  private downAt: { x: number; y: number } | null = null;
  private moved = false;
  private dragGhost: { du: number; dv: number } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;

  constructor(private readonly store: GameStore) {
    super('village');
  }

  private get mapSize() {
    return gameData.village.village.mapSize;
  }

  /**
   * Loads every packed atlas listed in atlas/atlases.json (written by pnpm atlas). The list
   * is read as text and parsed defensively: a missing or broken file (a dev server answers
   * with HTML) just means no painted art, never a crash.
   */
  preload(): void {
    preloadSounds(this);
    this.load.text('atlas-index', 'atlas/atlases.json');
    this.load.once('filecomplete-text-atlas-index', (_key: string, _type: string, raw: unknown) => {
      let list: unknown = [];
      try {
        list = JSON.parse(String(raw));
      } catch {
        console.warn('atlas/atlases.json tidak valid; memakai gambar buatan kode');
      }
      if (!Array.isArray(list)) return;
      for (const name of list) {
        if (typeof name === 'string') this.load.multiatlas(name, `atlas/${name}.json`, 'atlas/');
      }
    });
  }

  create(): void {
    prepareSounds(this);
    // The scene's own loader is still wrapping up during create(); start the (large) music
    // download once the village is on screen.
    this.time.delayedCall(500, () => loadMusic(this));
    this.cameras.main.setBackgroundColor('#2f7fb5');
    this.input.addPointer(1);
    this.drawGround();
    this.landGfx = this.add.graphics().setDepth(-999);
    this.selectionGfx = this.add.graphics().setDepth(2);
    this.hoverGfx = this.add.graphics().setDepth(2);

    const span = this.mapSize * 32;
    this.cameras.main.setBounds(
      -span - 200,
      -260,
      span * 2 + 400,
      this.mapSize * TILE_H + CLIFF + 460,
    );
    // Short screens (phones held sideways) start a little zoomed out.
    const css = cssSize(this);
    const short = Math.min(css.width, css.height);
    this.cameras.main.setZoom(Phaser.Math.Clamp(short / 420, 0.6, 1.1) * dpr());
    // Art keeps the soft look it had when the browser stretched a 1x canvas: a faint blur
    // as strong as the extra density (none on a plain 100 % screen). Text is in the UI scene
    // or drawn on top of this blur only slightly, so it stays readable.
    if (dpr() > 1) this.cameras.main.postFX?.addBlur(0, dpr() - 1, dpr() - 1, 1);
    this.focusOnTownHall();

    this.sync();
    this.createClouds();
    // The UI runs as its own scene on top of the village.
    if (!this.scene.isActive('ui')) this.scene.launch('ui');

    const unsubscribe = this.store.subscribe(() => {
      this.sync();
      this.refreshPlacement();
    });
    const timer = this.time.addEvent({ delay: 500, loop: true, callback: () => this.tick() });

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('wheel', this.onWheel, this);

    // Keep the same world point in the middle of the screen when the window resizes.
    const onResize = () => {
      const mid = this.lastMid;
      if (mid) this.time.delayedCall(0, () => this.cameras.main.centerOn(mid.x, mid.y));
    };
    this.scale.on('resize', onResize);
    this.time.delayedCall(0, () => this.focusOnTownHall());

    const ev = this.game.events;
    const onStart = (req: PlacementRequest) => this.startPlacement(req);
    const onConfirm = (opts?: PlacementConfirm) => this.confirmPlacement(opts);
    const onCancel = () => this.endPlacement();
    const onDeselect = () => this.select(null);
    const onFocus = (id: string) => this.focusOn(id);
    const onTeam = (ids: string[]) => (this.team = new Set(ids));
    ev.on(EVT.startPlacement, onStart);
    ev.on(EVT.confirmPlacement, onConfirm);
    ev.on(EVT.cancelPlacement, onCancel);
    ev.on(EVT.deselect, onDeselect);
    ev.on(EVT.focus, onFocus);
    ev.on(EVT.teamChanged, onTeam);
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      unsubscribe();
      timer.remove();
      ev.off(EVT.startPlacement, onStart);
      ev.off(EVT.confirmPlacement, onConfirm);
      ev.off(EVT.cancelPlacement, onCancel);
      ev.off(EVT.deselect, onDeselect);
      ev.off(EVT.focus, onFocus);
      ev.off(EVT.teamChanged, onTeam);
    });
  }

  override update(_time: number, delta: number): void {
    this.drawFights();
    const cam = this.cameras.main;
    this.lastMid = { x: cam.midPoint.x, y: cam.midPoint.y };
    for (const w of this.walkers) {
      const rank = rankBehindPoint(w.cu, w.cv, this.footprints, this.drawOrder);
      w.view.setDepth((rank + 1) * 10 + 5);
    }
    for (const person of this.people) {
      const rank = rankBehindPoint(person.cu, person.cv, this.footprints, this.drawOrder);
      person.image.setDepth((rank + 1) * 10 + 6);
    }
    for (const a of this.animals) {
      const rank = rankBehindPoint(a.cu, a.cv, this.footprints, this.drawOrder);
      a.image.setDepth((rank + 1) * 10 + 4);
    }
    for (const [id, view] of this.enemies) {
      const e = this.store.state.village.encounters.find((x) => x.id === id);
      if (!e) continue;
      const rank = rankBehindPoint(e.x + 0.5, e.y + 0.5, this.footprints, this.drawOrder);
      view.setDepth((rank + 1) * 10 + 4);
    }
    this.drawTeamRings();
    for (const cloud of this.clouds) {
      cloud.x += (delta / 1000) * (cloud.getData('speed') as number);
      const limit = this.mapSize * 32 + 500;
      if (cloud.x > limit) cloud.x = -limit;
    }
    if (this.time.now > (this.data.get('nextWalk') ?? 0)) {
      this.data.set('nextWalk', this.time.now + 300);
      this.moveWalkers();
      this.movePeople();
      this.moveAnimals();
    }
  }

  // ---------- Ground ----------

  private drawGround() {
    const n = this.mapSize;
    const g = this.add.graphics().setDepth(-1000);
    const corner = (u: number, v: number) => isoToWorld(u, v);
    // Cliff faces on the two front edges make the village an island.
    const leftFace = [
      corner(0, n),
      corner(n, n),
      { ...corner(n, n), y: corner(n, n).y + CLIFF },
      { ...corner(0, n), y: corner(0, n).y + CLIFF },
    ];
    const rightFace = [
      corner(n, n),
      corner(n, 0),
      { ...corner(n, 0), y: corner(n, 0).y + CLIFF },
      { ...corner(n, n), y: corner(n, n).y + CLIFF },
    ];
    g.fillStyle(0x000000, 0.18).fillEllipse(
      0,
      corner(n, n).y * 0.5 + CLIFF + 30,
      n * 64 + 120,
      n * 32 + 80,
    );
    g.fillStyle(0x9a6a3a).fillPoints(leftFace, true);
    g.fillStyle(0x7a5230).fillPoints(rightFace, true);
    for (let i = 1; i < 4; i++) {
      g.lineStyle(2, 0x5a3c22, 0.5);
      const y = (CLIFF * i) / 4;
      g.lineBetween(corner(0, n).x, corner(0, n).y + y, corner(n, n).x, corner(n, n).y + y);
      g.lineBetween(corner(n, n).x, corner(n, n).y + y, corner(n, 0).x, corner(n, 0).y + y);
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
        const base = (i + j) % 2 === 0 ? 0x78c350 : 0x70bb49;
        const color = h % 11 === 0 ? darken(base, 0.08) : h % 13 === 0 ? 0x80c95a : base;
        g.fillStyle(color, 1).fillPoints(
          [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)],
          true,
        );
        if (h % 17 === 0) {
          const c = isoToWorld(i + 0.5, j + 0.5);
          g.fillStyle(0xffffff, 0.8).fillCircle(c.x - 6, c.y, 1.6);
          g.fillStyle(0xffe066, 0.9).fillCircle(c.x + 5, c.y + 3, 1.6);
        }
      }
    }
    g.lineStyle(3, 0x5a9e3a, 1).strokePoints(
      [corner(0, 0), corner(n, 0), corner(n, n), corner(0, n)],
      true,
    );
  }

  private get plotSize() {
    return gameData.village.village.plotSize;
  }

  /** Iso corners of a plot, in world space. */
  private plotQuad(px: number, py: number) {
    const s = this.plotSize;
    return [
      isoToWorld(px * s, py * s),
      isoToWorld((px + 1) * s, py * s),
      isoToWorld((px + 1) * s, (py + 1) * s),
      isoToWorld(px * s, (py + 1) * s),
    ];
  }

  /** Shades locked plots (open land stays bright) and puts price signs on buyable plots. */
  private drawLand() {
    const state = this.store.state;
    const { village } = state;
    const price = nextPlotPrice(village);
    const key = [
      [...village.unlockedPlots].sort().join(';'),
      townHallLevel(state),
      price?.gold ?? '-',
    ].join('|');
    if (key === this.landKey || !this.landGfx) return;
    this.landKey = key;
    const g = this.landGfx.clear();
    const n = plotsPerSide();
    for (let px = 0; px < n; px++) {
      for (let py = 0; py < n; py++) {
        if (!isPlotUnlocked(village, px, py)) {
          g.fillStyle(0x24304a, 0.42).fillPoints(this.plotQuad(px, py), true);
        }
      }
    }
    for (const sign of this.plotSigns.values()) sign.destroy();
    this.plotSigns.clear();
    if (!price) return;
    for (let px = 0; px < n; px++) {
      for (let py = 0; py < n; py++) {
        const status = plotStatus(state, px, py);
        if (status !== 'buyable' && status !== 'needsTownHall') continue;
        this.plotSigns.set(plotKey(px, py), this.createPlotSign(px, py, status, price));
      }
    }
  }

  private createPlotSign(
    px: number,
    py: number,
    status: 'buyable' | 'needsTownHall',
    price: { gold: number; requiresTownHall: number },
  ) {
    const s = this.plotSize;
    const c = isoToWorld(px * s + s / 2, py * s + s / 2);
    const buyable = status === 'buyable';
    const label = this.add
      .text(
        0,
        0,
        buyable ? formatNumber(price.gold) : t('plot.needsHall', { level: price.requiresTownHall }),
        worldTextStyle(14, buyable ? COLORS.text : COLORS.textDim, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);
    const w = label.width + 40;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 2, -13, w, 30, 12);
    bg.fillStyle(0x4a3220, 0.92).fillRoundedRect(-w / 2, -15, w, 30, 12);
    bg.lineStyle(2, buyable ? COLORS.gold : 0x9a8f86, 1).strokeRoundedRect(-w / 2, -15, w, 30, 12);
    const icon = this.add.graphics({ x: -w / 2 + 17, y: 0 });
    (buyable ? icons.gold : icons.lock)(icon, 18);
    label.setX(-w / 2 + 31);
    return this.add.container(c.x, c.y, [bg, icon, label]).setDepth(800_000).setSize(w, 30);
  }

  private createClouds() {
    const key = 'fx:cloud';
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1);
      for (const [x, y, r] of [
        [60, 50, 34],
        [100, 40, 40],
        [140, 52, 32],
        [90, 64, 30],
      ] as const) {
        g.fillCircle(x, y, r);
      }
      g.generateTexture(key, 200, 110);
      g.destroy();
    }
    for (let i = 0; i < 4; i++) {
      const cloud = this.add
        .image(-600 + i * 520, -40 + ((i * 197) % 420), key)
        .setAlpha(0.22)
        .setScale(1.4 + (i % 2) * 0.6)
        .setDepth(1_000_000)
        .setData('speed', 8 + i * 3);
      this.clouds.push(cloud);
    }
  }

  // ---------- Sprites ----------

  private variantOf(b: Building, now: number): BuildingVariant {
    if (gameData.buildingById.get(b.type)?.lineBuild) {
      return `wall-${wallMask(b.x, b.y, this.wallTiles)}`;
    }
    if (gameData.buildingById.get(b.type)?.feature === 'ranch') {
      return `ranch-${ranchAnimalsIn(this.store.state, b.id).length}`;
    }
    const status = cropStatus(b, now);
    if (status === 'empty') return 'crop-empty';
    if (status === 'growing') return 'crop-growing';
    if (status === 'ready') return 'crop-ready';
    return 'normal';
  }

  private bubbleKind(b: Building, now: number): BubbleKind | null {
    if (b.level >= 1 && gameData.buildingById.get(b.type)?.feature === 'mixer') {
      const ready = this.store.state.mixQueue.some((e) => mixRemaining(e, now) === 0);
      return ready ? 'egg' : null;
    }
    // Monster eggs hatch at the Kandang.
    if (b.level >= 1 && gameData.buildingById.get(b.type)?.feature === 'stable') {
      return this.store.state.eggs.some((e) => e.readyAt <= now) ? 'egg' : null;
    }
    const status = cropStatus(b, now);
    if (status === 'ready') return 'food';
    if (status === 'empty') return b.construction ? null : 'seed';
    const state = this.store.state;
    if (b.construction || !isReadyToCollect(state, b, now)) return null;
    const resource = productionOf(state, b)?.resource;
    return resource === 'gold' || resource === 'food' ? resource : null;
  }

  /** Creates, updates or removes sprites so they match the store state. */
  private sync() {
    const now = this.store.now();
    const { buildings, obstacles } = this.store.state.village;
    this.wallTiles = new Set(
      buildings
        .filter((b) => gameData.buildingById.get(b.type)?.lineBuild)
        .map((b) => `${b.x},${b.y}`),
    );
    const seen = new Set<string>();
    for (const b of buildings) {
      seen.add(b.id);
      const signature = [
        b.type,
        b.level,
        b.x,
        b.y,
        this.variantOf(b, now),
        b.construction?.toLevel ?? '-',
        this.bubbleKind(b, now) ?? '-',
      ].join('|');
      const existing = this.sprites.get(b.id);
      if (existing?.signature === signature) {
        this.updateConstruction(existing, b, now);
        continue;
      }
      this.destroySprite(existing);
      this.sprites.set(b.id, this.createBuildingSprite(b, signature, now));
    }
    const village = this.store.state.village;
    for (const o of obstacles) {
      seen.add(o.id);
      const locked = !isTileUnlocked(village, o.x, o.y);
      const signature = `${o.type}|${o.x}|${o.y}|${locked}`;
      if (this.sprites.get(o.id)?.signature === signature) continue;
      this.destroySprite(this.sprites.get(o.id));
      const size = sizeOf(o.type);
      const image = this.placeImage(buildingTexture(this, o.type, 1), o.x, o.y, size);
      image.setScale(image.scaleX * wildScale(o.id));
      // Wild things on locked land look faded; they can still be gathered.
      if (locked) image.setTint(0xb4bccb);
      this.sprites.set(o.id, {
        id: o.id,
        kind: 'obstacle',
        type: o.type,
        x: o.x,
        y: o.y,
        size,
        signature,
        image,
      });
    }
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        this.destroySprite(sprite);
        this.sprites.delete(id);
      }
    }
    this.drawLand();
    const sel = this.selection;
    const gone =
      sel?.kind === 'plot'
        ? this.store.state.village.unlockedPlots.includes(sel.id)
        : sel?.kind === 'animal'
          ? !this.store.state.village.animals.some((a) => a.id === sel.id)
          : sel?.kind === 'encounter'
            ? !this.store.state.village.encounters.some((e) => e.id === sel.id)
            : sel !== null && !this.sprites.has(sel.id);
    if (gone) this.select(null);
    this.applyDepths();
    this.drawSelection();
    this.syncWalkers();
    this.syncPeople();
    this.syncAnimals();
    this.syncEnemies();
  }

  /** Sorts buildings and obstacles into a correct isometric draw order. */
  private applyDepths() {
    const sprites = [...this.sprites.values()];
    const key = sprites.map((s) => s.id + ':' + s.x + ':' + s.y).join(';');
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.footprints = sprites.map(({ id, x, y, size }) => ({ id, x, y, size }));
      this.drawOrder = isoDrawOrder(this.footprints);
    }
    for (const s of sprites) {
      const depth = ((this.drawOrder.get(s.id) ?? 0) + 1) * 10;
      s.image.setDepth(depth);
      s.overlay?.setDepth(depth + 1);
    }
  }

  private placeImage(art: ArtTexture, x: number, y: number, size: number) {
    const c = footprintCenter(x, y, size);
    return this.add
      .image(c.x, c.y, art.key, art.frame)
      .setOrigin(art.originX, art.originY)
      .setScale(1 / BUILDING_RES);
  }

  private createBuildingSprite(b: Building, signature: string, now: number): Sprite {
    const size = sizeOf(b.type);
    const firstBuild = b.level < 1;
    const art = firstBuild
      ? constructionSiteTexture(this, size)
      : buildingTexture(this, b.type, b.level, this.variantOf(b, now));
    const image = this.placeImage(art, b.x, b.y, size);
    const sprite: Sprite = {
      id: b.id,
      kind: 'building',
      type: b.type,
      x: b.x,
      y: b.y,
      size,
      signature,
      image,
    };
    if (this.isBeingMoved(b.id)) image.setVisible(false);
    if (b.construction && !firstBuild) {
      sprite.overlay = this.placeImage(scaffoldTexture(this, size), b.x, b.y, size);
    }
    const top = image.y - Math.max(art.height, sizeOf(b.type) * 16 + 20);
    image.setData('top', top);
    if (b.construction) {
      sprite.bar = this.add.graphics().setDepth(900_000);
      sprite.timer = this.add
        .text(
          image.x,
          top - 4,
          '',
          worldTextStyle(12, COLORS.text, {
            fontStyle: 'bold',
            stroke: '#1b1530',
            strokeThickness: 4,
            resolution: 2,
          }),
        )
        .setOrigin(0.5, 1)
        .setDepth(900_001);
      this.updateConstruction(sprite, b, now);
    }
    const bubble = this.bubbleKind(b, now);
    if (bubble) sprite.bubble = this.createBubble(image.x, top + 6, bubble);
    return sprite;
  }

  private updateConstruction(sprite: Sprite, b: Building, now: number) {
    if (!b.construction || !sprite.bar || !sprite.timer) return;
    const total = levelDef(b.type, b.construction.toLevel)?.seconds ?? 1;
    const remaining = constructionRemaining(b, now);
    const frac = Phaser.Math.Clamp(1 - remaining / Math.max(1, total), 0, 1);
    const top = (sprite.image.getData('top') as number | undefined) ?? sprite.image.y - 60;
    const w = 56;
    const x = sprite.image.x - w / 2;
    const y = top + 2;
    sprite.bar.clear();
    sprite.bar.fillStyle(0x1b1530, 0.85).fillRoundedRect(x - 2, y - 2, w + 4, 10, 5);
    sprite.bar.fillStyle(COLORS.warn, 1).fillRoundedRect(x, y, Math.max(6, w * frac), 6, 3);
    sprite.timer.setPosition(sprite.image.x, y - 3).setText(formatDuration(remaining));
  }

  private createBubble(x: number, y: number, kind: BubbleKind) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.2).fillEllipse(0, 20, 18, 6);
    g.fillStyle(0xffffff, kind === 'seed' ? 0.75 : 1).fillCircle(0, 0, 14);
    g.lineStyle(2, kind === 'seed' ? 0x8a6a3a : COLORS.gold, 1).strokeCircle(0, 0, 14);
    g.fillTriangle(-5, 12, 5, 12, 0, 19);
    const icon = this.add.graphics();
    if (kind === 'gold') icons.gold(icon, 16);
    else if (kind === 'food') icons.food(icon, 16);
    else if (kind === 'egg') {
      icon.fillStyle(0xf6efe0).fillEllipse(0, 1, 13, 17);
      icon.fillStyle(0x8a6cff).fillCircle(-2, -2, 2.2).fillCircle(3, 3, 2.6);
    } else {
      icon.fillStyle(0x8a5a32).fillEllipse(0, 4, 14, 6);
      icon.fillStyle(0x5ec24a).fillEllipse(-3, -2, 6, 9).fillEllipse(3, -3, 6, 9);
    }
    const bubble = this.add.container(x, y, [g, icon]).setDepth(950_000);
    this.tweens.add({
      targets: bubble,
      y: y - 6,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return bubble;
  }

  private destroySprite(sprite?: Sprite) {
    if (!sprite) return;
    sprite.image.destroy();
    sprite.overlay?.destroy();
    sprite.bar?.destroy();
    sprite.timer?.destroy();
    sprite.bubble?.destroy();
  }

  private tick() {
    // Finishing constructions changes the state, which re-syncs via the subscription.
    const workersBefore = this.store.state.workers.length;
    const soldiersBefore = this.store.state.barracksQueue.length;
    const missionsBefore = this.store.state.missions;
    const enemySpots = new Map(
      this.store.state.village.encounters.map((e) => [e.id, isoToWorld(e.x + 0.5, e.y + 0.5)]),
    );
    const enemiesBefore = new Set(this.store.state.village.encounters.map((e) => e.id));
    const finished = this.store.settle();
    if (this.store.state.village.encounters.some((e) => !enemiesBefore.has(e.id))) {
      playSfx(this, 'enemy');
    }
    this.reportMissions(missionsBefore, enemySpots);
    this.tickGathering();
    if (this.store.state.workers.length > workersBefore) {
      playSfx(this, 'ready');
      this.game.events.emit(EVT.toast, { message: t('village.workerReady'), color: COLORS.good });
    }
    if (this.store.state.barracksQueue.length < soldiersBefore) {
      const soldier = this.store.state.soldiers.at(-1);
      if (soldier) {
        playSfx(this, 'ready');
        this.game.events.emit(EVT.toast, {
          message: t('barracks.ready', { name: soldierName(soldier) }),
          color: COLORS.good,
        });
      }
    }
    if (finished.length === 0) {
      this.sync();
      return;
    }
    for (const b of finished) {
      const sprite = this.sprites.get(b.id);
      if (sprite) this.floatText(sprite, t('village.levelUp', { level: b.level }), COLORS.good);
      this.feelBuilding(b.id, 'large', 'sparkle');
      playSfx(this, 'build-done');
      const name = gameData.buildingById.get(b.type)?.name ?? b.type;
      this.game.events.emit(EVT.toast, {
        message: t('village.finished', { name, level: b.level }),
        color: COLORS.good,
      });
    }
  }

  // ---------- Selection ----------

  private select(selection: Selection) {
    this.selection = selection;
    this.drawSelection();
    this.game.events.emit(EVT.select, selection);
  }

  /** Centre x, top and bottom of the selected thing in screen pixels, for the info card. */
  selectionAnchor(): { x: number; top: number; bottom: number } | null {
    const s = this.selection;
    if (!s) return null;
    let box: { x: number; top: number; bottom: number } | undefined;
    const bounds = (
      s.kind === 'encounter'
        ? this.enemies.get(s.id)
        : s.kind === 'animal'
          ? this.animals.find((a) => a.id === s.id)?.image
          : s.kind === 'plot'
            ? this.plotSigns.get(s.id)
            : this.sprites.get(s.id)?.image
    )?.getBounds();
    if (bounds) box = { x: bounds.centerX, top: bounds.top, bottom: bounds.bottom };
    else if (s.kind === 'plot') {
      const [px = 0, py = 0] = s.id.split(',').map(Number);
      const quad = this.plotQuad(px, py);
      const ys = quad.map((p) => p.y);
      box = { x: (quad[0]!.x + quad[2]!.x) / 2, top: Math.min(...ys), bottom: Math.max(...ys) };
    }
    if (!box) return null;
    const cam = this.cameras.main;
    const sy = (y: number) => ((y - cam.worldView.y) * cam.zoom + cam.y) / dpr();
    return {
      x: ((box.x - cam.worldView.x) * cam.zoom + cam.x) / dpr(),
      top: sy(box.top),
      bottom: sy(box.bottom),
    };
  }

  private drawSelection() {
    const g = this.selectionGfx;
    if (!g) return;
    g.clear();
    if (this.selection?.kind === 'plot' && !this.placement) {
      const [px = 0, py = 0] = this.selection.id.split(',').map(Number);
      const pts = this.plotQuad(px, py);
      g.fillStyle(0xffe066, 0.18).fillPoints(pts, true);
      g.lineStyle(3, 0xffe066, 1).strokePoints(pts, true, true);
      return;
    }
    const sprite = this.selection ? this.sprites.get(this.selection.id) : undefined;
    if (!sprite || this.placement) return;
    const { x, y, size } = sprite;
    const pts = [
      isoToWorld(x, y),
      isoToWorld(x + size, y),
      isoToWorld(x + size, y + size),
      isoToWorld(x, y + size),
    ];
    g.fillStyle(0xffe066, 0.25).fillPoints(pts, true);
    g.lineStyle(3, 0xffe066, 1).strokePoints(pts, true, true);
  }

  // ---------- Input ----------

  private worldPoint(p: Phaser.Input.Pointer) {
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }

  private onDown(p: Phaser.Input.Pointer) {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown) {
      this.pinch = {
        dist: Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y),
        zoom: this.cameras.main.zoom,
      };
      this.moved = true;
      this.dragGhost = null;
      return;
    }
    this.downAt = { x: p.x, y: p.y };
    this.moved = false;
    this.dragGhost = null;
    if (this.placement) {
      const w = this.worldPoint(p);
      const { u, v } = worldToIso(w.x, w.y);
      const pl = this.placement;
      if (u >= pl.x && u < pl.x + pl.size && v >= pl.y && v < pl.y + pl.size) {
        this.dragGhost = { du: u - pl.x, dv: v - pl.y };
      }
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    const cam = this.cameras.main;
    if (this.pinch) {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (!p1.isDown || !p2.isDown) return;
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      this.zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (this.pinch.zoom * dist) / this.pinch.dist);
      return;
    }
    if (!p.isDown) {
      this.hover(p);
      return;
    }
    if (!this.downAt) return;
    if (!this.moved && Phaser.Math.Distance.Between(p.x, p.y, this.downAt.x, this.downAt.y) > 8)
      this.moved = true;
    if (!this.moved) return;
    if (this.dragGhost && this.placement) {
      const w = this.worldPoint(p);
      const { u, v } = worldToIso(w.x, w.y);
      this.moveGhost(Math.round(u - this.dragGhost.du), Math.round(v - this.dragGhost.dv));
      return;
    }
    cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
    cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (this.pinch) {
      if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinch = null;
      return;
    }
    if (this.downAt && !this.moved) {
      const w = this.worldPoint(p);
      this.tap(w.x, w.y);
    }
    this.downAt = null;
    this.dragGhost = null;
  }

  private onWheel(p: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) {
    this.zoomAt(p.x, p.y, this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1));
  }

  private zoomAt(sx: number, sy: number, zoom: number) {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(sx, sy);
    cam.setZoom(Phaser.Math.Clamp(zoom, 0.4 * dpr(), MAX_ZOOM * dpr()));
    cam.preRender();
    const after = cam.getWorldPoint(sx, sy);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

  private focusOnTownHall() {
    const hall = this.store.state.village.buildings.find((b) => b.type === gameData.townHallId);
    const c = hall
      ? footprintCenter(hall.x, hall.y, sizeOf(hall.type))
      : isoToWorld(this.mapSize / 2, this.mapSize / 2);
    this.cameras.main.centerOn(c.x, c.y + 40);
  }

  private focusOn(id: string) {
    const sprite = this.sprites.get(id);
    if (sprite) this.cameras.main.pan(sprite.image.x, sprite.image.y, 300, 'Sine.easeInOut');
  }

  /** Mouse hover outline (desktop only). */
  private hover(p: Phaser.Input.Pointer) {
    if (p.wasTouch || this.placement) return;
    const w = this.worldPoint(p);
    const hit = this.pick(w.x, w.y);
    const id = hit?.id ?? null;
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.input.setDefaultCursor(hit ? 'pointer' : 'default');
    const g = this.hoverGfx;
    if (!g) return;
    g.clear();
    if (!hit) return;
    const pts = [
      isoToWorld(hit.x, hit.y),
      isoToWorld(hit.x + hit.size, hit.y),
      isoToWorld(hit.x + hit.size, hit.y + hit.size),
      isoToWorld(hit.x, hit.y + hit.size),
    ];
    g.lineStyle(2, 0xffffff, 0.7).strokePoints(pts, true, true);
  }

  // ---------- Tapping ----------

  private pick(wx: number, wy: number): Sprite | null {
    const sorted = [...this.sprites.values()].sort((a, b) => b.image.depth - a.image.depth);
    for (const s of sorted) {
      if (s.bubble && Phaser.Math.Distance.Between(wx, wy, s.bubble.x, s.bubble.y) < 20) return s;
    }
    for (const s of sorted) {
      const img = s.image;
      if (!img.visible || !img.getBounds().contains(wx, wy)) continue;
      const left = img.x - img.displayOriginX * img.scaleX;
      const top = img.y - img.displayOriginY * img.scaleY;
      let alpha: number | null = 255;
      try {
        // Atlas art needs its frame name; textures that cannot be read count as solid.
        alpha = this.textures.getPixelAlpha(
          Math.floor((wx - left) / img.scaleX),
          Math.floor((wy - top) / img.scaleY),
          img.texture.key,
          img.frame.name,
        );
      } catch {
        alpha = 255;
      }
      if ((alpha ?? 0) > 40) return s;
    }
    const { u, v } = worldToIso(wx, wy);
    const tx = Math.floor(u);
    const ty = Math.floor(v);
    return (
      sorted.find((s) => tx >= s.x && tx < s.x + s.size && ty >= s.y && ty < s.y + s.size) ?? null
    );
  }

  private tap(wx: number, wy: number) {
    if (this.placement) {
      const { u, v } = worldToIso(wx, wy);
      const pl = this.placement;
      if (pl.line && !pl.line.start) {
        // First tap of a wall: fix the start point; later taps move the end.
        pl.line.start = { x: Math.floor(u), y: Math.floor(v) };
      }
      this.moveGhost(Math.round(u - pl.size / 2), Math.round(v - pl.size / 2));
      return;
    }
    const walker = this.walkers.find(
      (w) => !w.away && Phaser.Math.Distance.Between(wx, wy, w.view.x, w.view.y) < 22,
    );
    if (walker) {
      this.game.events.emit(EVT.teamToggle, walker.monsterId);
      return;
    }
    for (const [id, view] of this.enemies) {
      if (view.getBounds().contains(wx, wy)) {
        this.select({ kind: 'encounter', id });
        return;
      }
    }
    const animal = this.animals.find((a) => a.image.getBounds().contains(wx, wy));
    if (animal) {
      this.select({ kind: 'animal', id: animal.id });
      return;
    }
    for (const [id, sign] of this.plotSigns) {
      if (sign.getBounds().contains(wx, wy)) {
        this.select({ kind: 'plot', id });
        return;
      }
    }
    const hit = this.pick(wx, wy);
    if (!hit) {
      const { u, v } = worldToIso(wx, wy);
      const tx = Math.floor(u);
      const ty = Math.floor(v);
      const inside = tx >= 0 && ty >= 0 && tx < this.mapSize && ty < this.mapSize;
      if (inside && !isTileUnlocked(this.store.state.village, tx, ty)) {
        const { px, py } = plotOf(tx, ty);
        this.select({ kind: 'plot', id: plotKey(px, py) });
        return;
      }
      this.select(null);
      return;
    }
    if (hit.kind === 'building' && this.quickAction(hit)) return;
    this.select({ kind: hit.kind, id: hit.id });
    pop(this, hit.image, 'small');
    playSfx(this, 'tap');
  }

  /** Tapping a producer collects; tapping a ripe field harvests. Returns true if handled. */
  private quickAction(sprite: Sprite): boolean {
    const now = this.store.now();
    const b = this.store.state.village.buildings.find((x) => x.id === sprite.id);
    if (!b) return false;
    // A ready egg on the Soul Mixer opens the mixer straight away.
    if (this.bubbleKind(b, now) === 'egg') {
      const egg = this.store.state.eggs.find((e) => e.readyAt <= now);
      if (gameData.buildingById.get(b.type)?.feature === 'stable' && egg) {
        const r = this.store.apply((s, n) => hatchEgg(s, egg.id, n));
        if (!r.ok) {
          this.game.events.emit(EVT.toast, { message: errorText(r.error) });
          return true;
        }
        playSfx(this, 'ready');
        this.feelBuilding(b.id, 'medium', 'sparkle');
        this.game.events.emit(EVT.toast, {
          message: t('egg.hatched', { name: monsterName(r.monster) }),
          color: COLORS.good,
        });
        return true;
      }
      this.game.events.emit(EVT.openPanel, 'mixer');
      return true;
    }
    const status = cropStatus(b, now);
    if (status === 'ready') {
      const from = this.spriteTop(sprite);
      const r = this.store.apply((s, n) => harvestCrop(s, b.id, n));
      if (r.ok) {
        this.floatText(sprite, `+${formatNumber(r.food)}`, COLORS.food);
        this.flyResources({ food: r.food }, from.x, from.y);
        this.feelBuilding(b.id, 'medium', 'chips');
      }
      return r.ok;
    }
    const state = this.store.state;
    if (
      !b.construction &&
      isReadyToCollect(state, b, now) &&
      pendingProduction(state, b, now) > 0
    ) {
      const from = this.spriteTop(sprite);
      const r = this.store.apply((s, n) => collectBuilding(s, b.id, n));
      if (r.ok) {
        this.floatText(sprite, `+${formatNumber(r.amount)}`, COLORS[r.resource]);
        this.flyResources({ [r.resource]: r.amount }, from.x, from.y);
        this.feelBuilding(b.id, 'medium', 'sparkle');
      }
      return r.ok;
    }
    return false;
  }

  // ---------- Game feel ----------

  /** Screen position (CSS px) of a world point, for effects drawn by the UI scene. */
  private toScreen(wx: number, wy: number) {
    const cam = this.cameras.main;
    return {
      x: ((wx - cam.worldView.x) * cam.zoom + cam.x) / dpr(),
      y: ((wy - cam.worldView.y) * cam.zoom + cam.y) / dpr(),
    };
  }

  /** Earned resources fly from a world point to their HUD pills. */
  private flyResources(
    amounts: Partial<Record<CollectFx['resource'], number>>,
    wx: number,
    wy: number,
  ) {
    const at = this.toScreen(wx, wy);
    for (const [resource, amount] of Object.entries(amounts)) {
      if (!amount || amount <= 0) continue;
      const fx: CollectFx = {
        resource: resource as CollectFx['resource'],
        amount,
        x: at.x,
        y: at.y,
      };
      this.game.events.emit(EVT.collectFx, fx);
    }
  }

  /** Pops a building (looked up again: an action may have rebuilt its sprite) with dust. */
  private feelBuilding(id: string, tier: FeelTier, dust: 'dust' | 'chips' | 'sparkle' = 'dust') {
    const sprite = this.sprites.get(id);
    if (!sprite) return;
    pop(this, sprite.image, tier);
    const c = footprintCenter(sprite.x, sprite.y, sprite.size);
    burst(this, c.x, c.y, dust, tier);
  }

  /** Top of a sprite in world space, where earned resources start their flight. */
  private spriteTop(sprite: Sprite) {
    return {
      x: sprite.image.x,
      y: ((sprite.image.getData('top') as number | undefined) ?? sprite.image.y - 50) + 10,
    };
  }

  floatText(sprite: Sprite, text: string, color: number) {
    const y = ((sprite.image.getData('top') as number | undefined) ?? sprite.image.y - 60) + 10;
    this.floatAt(sprite.image.x, y, text, color);
  }

  private floatAt(x: number, y: number, text: string, color: number) {
    const label = this.add
      .text(
        x,
        y,
        text,
        worldTextStyle(18, color, {
          fontStyle: 'bold',
          stroke: '#1b1530',
          strokeThickness: 5,
          resolution: 2,
        }),
      )
      .setOrigin(0.5)
      .setDepth(2_000_000);
    this.tweens.add({
      targets: label,
      y: y - 50,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  // ---------- Gathering ----------

  /**
   * Gathering only runs while the game is open: active seconds pile up here and go
   * to the store every few seconds, or as soon as a node would be finished.
   */
  private tickGathering() {
    const nowMs = this.time.now;
    // A long gap (tab hidden, device asleep) does not count as play time.
    const dt = this.lastTickAt ? Math.min(2, (nowMs - this.lastTickAt) / 1000) : 0;
    this.lastTickAt = nowMs;
    const state = this.store.state;
    const worked = state.village.obstacles
      .map((o) => ({ o, crew: gatherWorkers(state, o.id) }))
      .filter((x) => x.crew > 0);
    const hunted = state.village.animals
      .map((a) => ({ a, crew: animalWorkers(state, a.id) }))
      .filter((x) => x.crew > 0 && x.a.job);
    if (worked.length === 0 && hunted.length === 0) {
      this.pendingGather = 0;
      this.gatherGfx?.clear();
      return;
    }
    this.pendingGather += dt;
    const due =
      this.pendingGather >= 5 ||
      worked.some(
        ({ o, crew }) => o.work + this.pendingGather * crew >= obstacleDef(o.type).work.workSeconds,
      ) ||
      hunted.some(
        ({ a, crew }) => a.work + this.pendingGather * crew >= jobSeconds(a.type, a.job!),
      );
    if (due) {
      const spots = new Map(
        worked.map(({ o }) => {
          const img = this.sprites.get(o.id)?.image;
          return [o.id, img ? { x: img.x, y: img.y - img.displayHeight * 0.7 } : null] as const;
        }),
      );
      for (const { a } of hunted) {
        const view = this.animals.find((x) => x.id === a.id);
        if (view) spots.set(a.id, { x: view.image.x, y: view.image.y - 30 });
      }
      const seconds = this.pendingGather;
      this.pendingGather = 0;
      const result = this.store.gather(seconds);
      for (const d of result.animals) {
        const at = spots.get(d.animalId);
        if (!at) continue;
        if (d.job === 'hunt') {
          this.floatAt(at.x, at.y, `+${formatNumber(d.food)} ${t('res.food')}`, COLORS.food);
          this.flyResources({ food: d.food }, at.x, at.y);
          burst(this, at.x, at.y + 24, 'dust', 'medium');
          playSfx(this, 'gather');
        } else {
          this.floatAt(at.x, at.y, t('animal.captured'), COLORS.good);
          burst(this, at.x, at.y + 24, 'sparkle', 'medium');
          playSfx(this, 'ready');
        }
      }
      for (const g of result.gathered) {
        const at = spots.get(g.obstacleId);
        if (!at) continue;
        this.floatAt(at.x, at.y, `+${costLabel(g.amount)}`, COLORS.good);
        const base = isoToWorld(g.x + 0.5, g.y + 0.5);
        burst(this, base.x, base.y, 'chips', 'medium');
        playSfx(this, 'gather');
        this.flyResources({ ...g.amount, soulCrystal: g.soulCrystal }, at.x, at.y);
        if (g.soulCrystal) {
          this.floatAt(
            at.x,
            at.y - 24,
            `+${g.soulCrystal} ${t('res.soulCrystal')}!`,
            COLORS.crystal,
          );
        }
      }
    }
    this.drawGatherBars();
  }

  /** Little progress bars over the nodes being worked on. */
  private drawGatherBars() {
    if (!this.gatherGfx) this.gatherGfx = this.add.graphics().setDepth(900_000);
    const g = this.gatherGfx.clear();
    const state = this.store.state;
    for (const a of state.village.animals) {
      const crew = animalWorkers(state, a.id);
      const view = this.animals.find((x) => x.id === a.id);
      if (crew === 0 || !a.job || !view) continue;
      const done = Math.min(1, (a.work + this.pendingGather * crew) / jobSeconds(a.type, a.job));
      const w = 30;
      const x = view.image.x - w / 2;
      const y = view.image.y - 44;
      g.fillStyle(0x1b1530, 0.85).fillRoundedRect(x - 2, y - 2, w + 4, 9, 4);
      g.fillStyle(a.job === 'hunt' ? COLORS.food : COLORS.warn, 1).fillRoundedRect(
        x,
        y,
        Math.max(3, w * done),
        5,
        2,
      );
    }
    for (const o of state.village.obstacles) {
      const crew = gatherWorkers(state, o.id);
      const img = this.sprites.get(o.id)?.image;
      if (crew === 0 || !img) continue;
      const total = obstacleDef(o.type).work.workSeconds;
      const done = Math.min(1, (o.work + this.pendingGather * crew) / total);
      const w = 34;
      const x = img.x - w / 2;
      const y = img.y - img.displayHeight * 0.75 - 8;
      g.fillStyle(0x1b1530, 0.85).fillRoundedRect(x - 2, y - 2, w + 4, 9, 4);
      g.fillStyle(COLORS.good, 1).fillRoundedRect(x, y, Math.max(3, w * done), 5, 2);
    }
  }

  // ---------- Placement ----------

  private startPlacement(req: PlacementRequest) {
    this.endPlacement();
    this.select(null);
    const moving =
      'moveId' in req
        ? this.store.state.village.buildings.find((b) => b.id === req.moveId)
        : undefined;
    const type = moving?.type ?? ('type' in req ? req.type : '');
    if (!gameData.buildingById.has(type)) return;
    const size = sizeOf(type);
    let x: number;
    let y: number;
    if (moving) {
      x = moving.x;
      y = moving.y;
    } else {
      const cam = this.cameras.main;
      const mid = worldToIso(cam.midPoint.x, cam.midPoint.y);
      x = Math.round(mid.u - size / 2);
      y = Math.round(mid.v - size / 2);
    }
    const art = buildingTexture(
      this,
      type,
      moving?.level || 1,
      type === 'ladang' ? 'crop-empty' : 'normal',
    );
    const ghost = this.add
      .image(0, 0, art.key, art.frame)
      .setOrigin(art.originX, art.originY)
      .setScale(1 / BUILDING_RES)
      .setAlpha(0.8)
      .setDepth(1_500_001);
    const footprint = this.add.graphics().setDepth(1_500_000);
    this.placement = { type, moveId: moving?.id, x, y, size, ghost, footprint, valid: false };
    if (!moving && gameData.buildingById.get(type)?.lineBuild) {
      this.placement.line = { start: null, ghosts: [] };
    }
    if (moving && 'group' in req && req.group) {
      const ids = connectedGroup(this.store.state, moving.id).map((g) => g.id);
      this.placement.group = { ids, ghosts: [] };
    }
    for (const id of this.placement.group?.ids ?? (moving ? [moving.id] : [])) {
      this.sprites.get(id)?.image.setVisible(false);
    }
    this.drawGrid(true);
    this.moveGhost(x, y);
  }

  private moveGhost(x: number, y: number) {
    const pl = this.placement;
    if (!pl) return;
    const max = this.mapSize - pl.size;
    pl.x = Phaser.Math.Clamp(x, 0, max);
    pl.y = Phaser.Math.Clamp(y, 0, max);
    const c = footprintCenter(pl.x, pl.y, pl.size);
    pl.ghost.setPosition(c.x, c.y);
    this.refreshPlacement();
  }

  private refreshPlacement() {
    const pl = this.placement;
    if (!pl) return;
    if (pl.line) {
      this.refreshLinePlacement(pl, pl.line);
      return;
    }
    if (pl.group) {
      this.refreshGroupPlacement(pl, pl.group);
      return;
    }
    pl.valid = canPlaceBuilding(this.store.state.village, pl.size, pl.x, pl.y, gameData, pl.moveId);
    const { x, y, size } = pl;
    const pts = [
      isoToWorld(x, y),
      isoToWorld(x + size, y),
      isoToWorld(x + size, y + size),
      isoToWorld(x, y + size),
    ];
    const color = pl.valid ? COLORS.good : COLORS.danger;
    pl.footprint
      .clear()
      .fillStyle(color, 0.45)
      .fillPoints(pts, true)
      .lineStyle(2, color, 1)
      .strokePoints(pts, true, true);
    pl.ghost.setTint(pl.valid ? 0xffffff : 0xff9a9a);
    const status: PlacementStatus = {
      active: true,
      valid: pl.valid,
      type: pl.type,
      moving: !!pl.moveId,
    };
    this.game.events.emit(EVT.placement, status);
  }

  /** Wall line preview: one ghost per segment, green when the whole line fits. */
  private refreshLinePlacement(pl: Placement, line: NonNullable<Placement['line']>) {
    const state = this.store.state;
    const tiles = line.start ? lineTiles(line.start, { x: pl.x, y: pl.y }) : [{ x: pl.x, y: pl.y }];
    const fitsCount = countBuildings(state, pl.type) + tiles.length <= maxCountFor(state, pl.type);
    const free = tiles.every((t) => canPlaceBuilding(state.village, 1, t.x, t.y));
    pl.valid = line.start !== null && free && fitsCount;
    line.ghosts = this.tileGhosts(pl, line.ghosts, tiles, free && fitsCount, 1);
    const price = levelDef(pl.type, 1)!.cost;
    const status: PlacementStatus = {
      active: true,
      valid: pl.valid,
      type: pl.type,
      line: {
        started: line.start !== null,
        count: tiles.length,
        cost: scaleAmount(price, tiles.length),
      },
    };
    this.game.events.emit(EVT.placement, status);
  }

  /** Moving a stretch of walls: one ghost per segment, green when every new tile is free. */
  private refreshGroupPlacement(pl: Placement, group: NonNullable<Placement['group']>) {
    const moving = this.store.state.village.buildings.find((b) => b.id === pl.moveId);
    const { tiles, ok } = groupMoveTiles(this.store.state, {
      buildingId: pl.moveId ?? '',
      x: pl.x,
      y: pl.y,
    });
    pl.valid = ok;
    group.ghosts = this.tileGhosts(pl, group.ghosts, tiles, ok, moving?.level ?? 1);
    const status: PlacementStatus = { active: true, valid: ok, type: pl.type, moving: true };
    this.game.events.emit(EVT.placement, status);
  }

  /** Replaces `old` with one wall ghost per tile and paints their footprints. */
  private tileGhosts(
    pl: Placement,
    old: Phaser.GameObjects.Image[],
    tiles: { x: number; y: number }[],
    fine: boolean,
    level: number,
  ): Phaser.GameObjects.Image[] {
    for (const g of old) g.destroy();
    const inLine = new Set(tiles.map((t) => `${t.x},${t.y}`));
    const color = fine ? COLORS.good : COLORS.danger;
    pl.ghost.setVisible(false);
    pl.footprint.clear();
    for (const t of tiles) {
      const pts = [
        isoToWorld(t.x, t.y),
        isoToWorld(t.x + 1, t.y),
        isoToWorld(t.x + 1, t.y + 1),
        isoToWorld(t.x, t.y + 1),
      ];
      pl.footprint
        .fillStyle(color, 0.45)
        .fillPoints(pts, true)
        .lineStyle(2, color, 1)
        .strokePoints(pts, true, true);
    }
    return tiles.map((t) => {
      const art = buildingTexture(this, pl.type, level, `wall-${wallMask(t.x, t.y, inLine)}`);
      const c = footprintCenter(t.x, t.y, 1);
      return this.add
        .image(c.x, c.y, art.key, art.frame)
        .setOrigin(art.originX, art.originY)
        .setScale(1 / BUILDING_RES)
        .setAlpha(0.85)
        .setTint(fine ? 0xffffff : 0xff9a9a)
        .setDepth(1_500_001 + t.x + t.y);
    });
  }

  private isBeingMoved(id: string): boolean {
    const pl = this.placement;
    return !!pl && (pl.group ? pl.group.ids.includes(id) : pl.moveId === id);
  }

  private confirmPlacement(opts: PlacementConfirm = {}) {
    const pl = this.placement;
    if (!pl) return;
    if (pl.line) {
      const start = pl.line.start;
      if (!start) return;
      const r = this.store.apply((s, now) =>
        buildLine(s, { type: pl.type, from: start, to: { x: pl.x, y: pl.y } }, now),
      );
      if (!r.ok) {
        this.game.events.emit(EVT.toast, { message: errorText(r.error) });
        return;
      }
      for (const id of r.buildingIds) this.feelBuilding(id, 'small');
      playSfx(this, 'place');
      // Ready for the next line, starting fresh.
      pl.line.start = null;
      this.refreshPlacement();
      return;
    }
    if (pl.group) {
      const moved = this.store.apply((s) =>
        moveGroup(s, { buildingId: pl.moveId!, x: pl.x, y: pl.y }),
      );
      if (!moved.ok) {
        this.game.events.emit(EVT.toast, { message: errorText(moved.error) });
        return;
      }
      const ids = pl.group.ids;
      playSfx(this, 'place');
      this.endPlacement();
      for (const id of ids) this.feelBuilding(id, 'small');
      this.select({ kind: 'building', id: ids[0]! });
      return;
    }
    const result = pl.moveId
      ? this.store.apply((s) => moveBuilding(s, { buildingId: pl.moveId!, x: pl.x, y: pl.y }))
      : this.store.apply((s, now) =>
          buildBuilding(s, { type: pl.type, x: pl.x, y: pl.y, workers: opts.workers }, now),
        );
    if (!result.ok) {
      this.game.events.emit(EVT.toast, { message: errorText(result.error) });
      return;
    }
    // The new (or moved) building lands with a squash and a puff of dust.
    const placed =
      pl.moveId ?? ('buildingId' in result ? (result.buildingId as string) : undefined);
    if (placed) this.feelBuilding(placed, pl.moveId ? 'small' : 'medium');
    playSfx(this, 'place');
    const keepGoing = !pl.moveId && pl.size === 1 && levelDef(pl.type, 1)?.seconds === 0;
    if (keepGoing) {
      // Small decorations and walls: keep placing the next one beside it.
      this.moveGhost(pl.x + 1, pl.y);
      return;
    }
    const placedId = pl.moveId;
    this.endPlacement();
    if (placedId) this.select({ kind: 'building', id: placedId });
  }

  private endPlacement() {
    const pl = this.placement;
    if (!pl) return;
    pl.ghost.destroy();
    pl.footprint.destroy();
    for (const g of [...(pl.line?.ghosts ?? []), ...(pl.group?.ghosts ?? [])]) g.destroy();
    for (const id of pl.group?.ids ?? (pl.moveId ? [pl.moveId] : [])) {
      this.sprites.get(id)?.image.setVisible(true);
    }
    this.placement = null;
    this.drawGrid(false);
    this.sync();
    this.game.events.emit(EVT.placement, { active: false, valid: false } satisfies PlacementStatus);
  }

  private drawGrid(show: boolean) {
    this.grid?.destroy();
    this.grid = undefined;
    if (!show) return;
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, 0xffffff, 0.18);
    const n = this.mapSize;
    for (let i = 0; i <= n; i++) {
      const a = isoToWorld(i, 0);
      const b = isoToWorld(i, n);
      g.lineBetween(a.x, a.y, b.x, b.y);
      const c = isoToWorld(0, i);
      const d = isoToWorld(n, i);
      g.lineBetween(c.x, c.y, d.x, d.y);
    }
    this.grid = g;
  }

  // ---------- Wandering monsters ----------

  private syncWalkers() {
    const state = this.store.state;
    const monsters = [...state.monsters]
      .sort(
        (a, b) =>
          Number(isOnMission(state, b.id)) - Number(isOnMission(state, a.id)) ||
          getStage(b.stage).index - getStage(a.stage).index,
      )
      .slice(0, MAX_WALKERS);
    const ids = new Set(monsters.map((m) => m.id));
    this.walkers = this.walkers.filter((w) => {
      const keep =
        ids.has(w.monsterId) &&
        this.store.state.monsters.some(
          (m) => m.id === w.monsterId && m.stage === w.view.getData('stage'),
        );
      if (!keep) {
        w.tween?.stop();
        w.view.destroy();
      }
      return keep;
    });
    // A building placed on top of a walker pushes it to a free tile.
    const village = this.store.state.village;
    for (const w of this.walkers) {
      if (w.away || canPlaceBuilding(village, 1, Math.floor(w.u), Math.floor(w.v))) continue;
      const spot = this.randomFreeTile({ u: w.u, v: w.v }, 3) ?? this.randomFreeTile();
      if (!spot) continue;
      w.tween?.stop();
      w.u = w.cu = spot.u;
      w.v = w.cv = spot.v;
      const p = isoToWorld(spot.u, spot.v);
      w.view.setPosition(p.x, p.y - 16);
    }
    for (const m of monsters) {
      if (this.walkers.some((w) => w.monsterId === m.id)) continue;
      const spot = this.randomFreeTile();
      if (spot) this.walkers.push(this.createWalker(m, spot.u, spot.v));
    }
  }

  private stableCenter() {
    const stable = this.store.state.village.buildings.find(
      (b) => gameData.buildingById.get(b.type)?.feature === 'stable',
    );
    if (!stable) return { u: this.mapSize / 2, v: this.mapSize / 2 };
    const size = sizeOf(stable.type);
    return { u: stable.x + size / 2, v: stable.y + size + 1 };
  }

  private randomFreeTile(near = this.stableCenter(), radius = 5) {
    const village = this.store.state.village;
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(near.u + (Math.random() * 2 - 1) * radius);
      const y = Math.floor(near.v + (Math.random() * 2 - 1) * radius);
      if (canPlaceBuilding(village, 1, x, y)) return { u: x + 0.5, v: y + 0.5 };
    }
    return null;
  }

  /** A random free tile next to (u, v), so walkers never cut through buildings. */
  private neighbourTile(u: number, v: number) {
    const village = this.store.state.village;
    const x = Math.floor(u);
    const y = Math.floor(v);
    const options: { u: number; v: number }[] = [];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      if (canPlaceBuilding(village, 1, x + dx, y + dy)) {
        options.push({ u: x + dx + 0.5, v: y + dy + 0.5 });
      }
    }
    return options.length ? options[Math.floor(Math.random() * options.length)]! : null;
  }

  private createWalker(m: Monster, u: number, v: number): Walker {
    const p = isoToWorld(u, v);
    const view = new MonsterView(this, p.x, p.y - 16, m, 40);
    view.setData('stage', m.stage);
    return {
      monsterId: m.id,
      view,
      u,
      v,
      cu: u,
      cv: v,
      nextMoveAt: this.time.now + Math.random() * 3000,
    };
  }

  private moveWalkers() {
    for (const w of this.walkers) {
      if (this.time.now < w.nextMoveAt || w.tween?.isPlaying()) continue;
      if (this.moveOnMission(w)) continue;
      const target = this.neighbourTile(w.u, w.v);
      w.nextMoveAt = this.time.now + 2000 + Math.random() * 4000;
      if (!target) continue;
      const from = isoToWorld(w.u, w.v);
      const to = isoToWorld(target.u, target.v);
      const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
      w.view.setScale(to.x < from.x ? -1 : 1, 1);
      const state = { t: 0 };
      w.tween = this.tweens.add({
        targets: state,
        t: 1,
        duration: (dist / 28) * 1000,
        onUpdate: () => {
          const u = w.u + (target.u - w.u) * state.t;
          const v = w.v + (target.v - w.v) * state.t;
          const p = isoToWorld(u, v);
          w.view.setPosition(p.x, p.y - 16 - Math.abs(Math.sin(state.t * Math.PI * 4)) * 3);
          w.cu = u;
          w.cv = v;
        },
        onComplete: () => {
          w.u = w.cu = target.u;
          w.v = w.cv = target.v;
        },
      });
    }
  }

  // ---------- Workers ----------

  private personTexture() {
    if (this.textures.exists(PERSON_KEY)) return;
    const g = this.make.graphics({}, false);
    g.fillStyle(0x000000, 0.22).fillEllipse(16, 49, 20, 6);
    g.fillStyle(0x4a3a2a).fillRect(10, 36, 5, 13).fillRect(17, 36, 5, 13);
    g.fillStyle(0x3f7fd1).fillRoundedRect(8, 21, 16, 18, 5);
    g.fillStyle(0x2c5c9e).fillRect(8, 33, 16, 3);
    g.fillStyle(0xf1c27d).fillCircle(16, 14, 7);
    g.lineStyle(1.5, 0x5a3d22, 0.8).strokeCircle(16, 14, 7);
    g.fillStyle(0xffcf40).fillRoundedRect(8, 4, 16, 8, { tl: 7, tr: 7, bl: 1, br: 1 });
    g.fillStyle(0xe0a91c).fillRect(6, 10, 20, 3);
    g.generateTexture(PERSON_KEY, 32, 52);
    g.destroy();
  }

  private hallSpot() {
    const hall = this.store.state.village.buildings.find((b) => b.type === gameData.townHallId);
    if (!hall) return { u: this.mapSize / 2, v: this.mapSize / 2 };
    const size = sizeOf(hall.type);
    return { u: hall.x + size + 1, v: hall.y + size / 2 };
  }

  /** A free tile beside a footprint, front edges (the ones the camera sees) first. */
  private workSpot(f: { x: number; y: number; size: number }, index: number) {
    const { x, y, size } = f;
    const spots: { u: number; v: number }[] = [];
    for (let i = 0; i < size; i++) {
      spots.push({ u: x + i, v: y + size }, { u: x + size, v: y + i });
    }
    for (let i = 0; i < size; i++) spots.push({ u: x + i, v: y - 1 }, { u: x - 1, v: y + i });
    const village = this.store.state.village;
    for (let k = 0; k < spots.length; k++) {
      const t = spots[(index + k) % spots.length]!;
      // Gatherers may stand on locked land; the tile only has to be empty.
      if (canPlace(village, 1, t.u, t.v)) return { u: t.u + 0.5, v: t.v + 0.5 };
    }
    return null;
  }

  private syncPeople() {
    this.personTexture();
    const { workers, village } = this.store.state;
    const ids = new Set(workers.map((w) => w.id));
    this.people = this.people.filter((p) => {
      if (ids.has(p.workerId)) return true;
      p.tween?.stop();
      p.image.destroy();
      return false;
    });
    const perBuilding = new Map<string, number>();
    for (const w of workers) {
      let person = this.people.find((p) => p.workerId === w.id);
      if (!person) {
        const spot = this.randomFreeTile(this.hallSpot(), 3) ?? this.hallSpot();
        const pos = isoToWorld(spot.u, spot.v);
        person = {
          workerId: w.id,
          image: this.add
            .image(pos.x, pos.y + 3, PERSON_KEY)
            .setOrigin(0.5, 1)
            .setScale(0.5),
          u: spot.u,
          v: spot.v,
          cu: spot.u,
          cv: spot.v,
          nextMoveAt: this.time.now + Math.random() * 1500,
          target: null,
          faceU: 0,
        };
        this.people.push(person);
      }
      const task = w.task;
      // Workers living in a mine or mill are inside: hidden until they come out.
      const home =
        task.kind === 'staffed' ? village.buildings.find((x) => x.id === task.buildingId) : null;
      if (home) {
        if (person.image.visible) {
          person.tween?.stop();
          person.image.setVisible(false);
        }
        const size = sizeOf(home.type);
        person.u = person.cu = home.x + size + 0.5;
        person.v = person.cv = home.y + size / 2;
        person.target = null;
        continue;
      }
      if (!person.image.visible) {
        const door = isoToWorld(person.u, person.v);
        person.image.setPosition(door.x, door.y + 3).setVisible(true);
      }
      const b =
        task.kind === 'building' ? village.buildings.find((x) => x.id === task.buildingId) : null;
      const o =
        task.kind === 'gathering' ? village.obstacles.find((x) => x.id === task.targetId) : null;
      const prey =
        task.kind === 'gathering' ? village.animals.find((x) => x.id === task.targetId) : null;
      const job = b
        ? { id: b.id, x: b.x, y: b.y, size: sizeOf(b.type) }
        : o
          ? { id: o.id, x: o.x, y: o.y, size: sizeOf(o.type) }
          : prey
            ? { id: prey.id, x: prey.x, y: prey.y, size: 1 }
            : null;
      if (!job) {
        person.target = null;
        continue;
      }
      const n = perBuilding.get(job.id) ?? 0;
      perBuilding.set(job.id, n + 1);
      const spot = this.workSpot(job, n * 2);
      if (spot && (person.target?.u !== spot.u || person.target?.v !== spot.v)) {
        person.target = spot;
        person.faceU = job.x + job.size / 2;
        person.nextMoveAt = 0;
      }
    }
  }

  private movePeople() {
    const now = this.time.now;
    const village = this.store.state.village;
    for (const p of this.people) {
      if (!p.image.visible || now < p.nextMoveAt || p.tween?.isPlaying()) continue;
      const target = p.target ?? null;
      if (
        target &&
        Math.floor(p.u) === Math.floor(target.u) &&
        Math.floor(p.v) === Math.floor(target.v)
      ) {
        // At the job: hammer away, facing the building.
        p.image.setFlipX(p.faceU < p.u);
        p.tween = this.tweens.add({
          targets: p.image,
          scaleY: 0.44,
          duration: 120,
          yoyo: true,
          repeat: 1,
        });
        p.nextMoveAt = now + 500 + Math.random() * 400;
        continue;
      }
      let step: { u: number; v: number } | null;
      if (target) {
        // Greedy walk towards the job; cut across when boxed in.
        const dist = (a: { u: number; v: number }) =>
          Math.abs(a.u - target.u) + Math.abs(a.v - target.v);
        step = target;
        let best = dist({ u: p.u, v: p.v });
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const t = { u: Math.floor(p.u) + dx + 0.5, v: Math.floor(p.v) + dy + 0.5 };
          if (!canPlace(village, 1, Math.floor(t.u), Math.floor(t.v))) continue;
          if (dist(t) < best) {
            best = dist(t);
            step = t;
          }
        }
        p.nextMoveAt = now;
      } else {
        // Idle workers potter around near the Balai.
        const home = this.hallSpot();
        const far = Math.abs(p.u - home.u) + Math.abs(p.v - home.v) > 6;
        step = far ? (this.randomFreeTile(home, 2) ?? null) : this.neighbourTile(p.u, p.v);
        p.nextMoveAt = now + 1500 + Math.random() * 3000;
      }
      if (step) this.walkPerson(p, step);
    }
  }

  private walkPerson(p: Walkable, to: { u: number; v: number }, lift = 3, speed = 34) {
    const from = isoToWorld(p.u, p.v);
    const end = isoToWorld(to.u, to.v);
    const dist = Phaser.Math.Distance.Between(from.x, from.y, end.x, end.y);
    p.image.setFlipX(end.x < from.x);
    const state = { t: 0 };
    const su = p.u;
    const sv = p.v;
    p.tween = this.tweens.add({
      targets: state,
      t: 1,
      duration: Math.max(150, (dist / speed) * 1000),
      onUpdate: () => {
        p.cu = su + (to.u - su) * state.t;
        p.cv = sv + (to.v - sv) * state.t;
        const pos = isoToWorld(p.cu, p.cv);
        p.image.setPosition(pos.x, pos.y + lift - Math.abs(Math.sin(state.t * Math.PI * 3)) * 2);
      },
      onComplete: () => {
        p.u = p.cu = to.u;
        p.v = p.cv = to.v;
      },
    });
  }

  // ---------- Wild animals ----------

  private syncAnimals() {
    const { animals } = this.store.state.village;
    const ids = new Set(animals.map((a) => a.id));
    this.animals = this.animals.filter((v) => {
      if (ids.has(v.id)) return true;
      v.tween?.stop();
      v.image.destroy();
      return false;
    });
    for (const a of animals) {
      if (this.animals.some((v) => v.id === a.id)) continue;
      const art = buildingTexture(this, a.type, 1);
      const u = a.x + 0.5;
      const v = a.y + 0.5;
      const pos = isoToWorld(u, v);
      const image = this.add
        .image(pos.x, pos.y, art.key, art.frame)
        .setOrigin(art.originX, art.originY)
        .setScale(ANIMAL_SCALE / BUILDING_RES);
      this.animals.push({
        id: a.id,
        type: a.type,
        image,
        homeU: u,
        homeV: v,
        u,
        v,
        cu: u,
        cv: v,
        nextMoveAt: this.time.now + Math.random() * 3000,
      });
    }
  }

  private moveAnimals() {
    const now = this.time.now;
    const state = this.store.state;
    for (const a of this.animals) {
      if (now < a.nextMoveAt || a.tween?.isPlaying()) continue;
      const held = animalWorkers(state, a.id) > 0;
      const atHome = a.u === a.homeU && a.v === a.homeV;
      if (held) {
        // Caught: go back to its own tile, where the workers are, and stay put.
        if (!atHome) {
          this.walkPerson(a, { u: a.homeU, v: a.homeV }, 0, 24);
          a.image.toggleFlipX();
        }
        a.nextMoveAt = now + 800;
        continue;
      }
      a.nextMoveAt = now + 2500 + Math.random() * 4000;
      const options: { u: number; v: number }[] = [];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const u = a.u + dx;
        const v = a.v + dy;
        const near = Math.abs(u - a.homeU) <= 2 && Math.abs(v - a.homeV) <= 2;
        if (near && canPlace(state.village, 1, Math.floor(u), Math.floor(v)))
          options.push({ u, v });
      }
      if (options.length > 0) {
        this.walkPerson(a, options[Math.floor(Math.random() * options.length)]!, 0, 20);
        // The animal art faces left, unlike the workers.
        a.image.toggleFlipX();
      }
    }
  }

  // ---------- Wild enemies and missions ----------

  private banditTexture() {
    const key = 'fx:bandit';
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({}, false);
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

  /** Enemy groups: bandits or wild monsters standing on a red danger ring. */
  private syncEnemies() {
    const { encounters } = this.store.state.village;
    const ids = new Set(encounters.map((e) => e.id));
    for (const [id, view] of this.enemies) {
      if (!ids.has(id)) {
        view.destroy();
        this.enemies.delete(id);
      }
    }
    for (const e of encounters) {
      if (this.enemies.has(e.id)) continue;
      const c = isoToWorld(e.x + 0.5, e.y + 0.5);
      const view = this.add.container(c.x, c.y);
      const ring = this.add.graphics();
      ring.fillStyle(0xd63c3c, 0.22).fillEllipse(0, 0, 70, 34);
      ring.lineStyle(2, 0xd63c3c, 0.8).strokeEllipse(0, 0, 70, 34);
      view.add(ring);
      const spots = [
        [-14, -2],
        [12, 4],
        [0, 10],
        [-2, -10],
      ];
      const shown = Math.min(e.count, encounterGroup(e).kind === 'bandit' ? 4 : 3);
      for (let i = 0; i < shown; i++) {
        const [dx, dy] = spots[i]!;
        if (encounterGroup(e).kind === 'bandit') {
          view.add(
            this.add
              .image(dx!, dy! + 4, this.banditTexture())
              .setOrigin(0.5, 1)
              .setScale(0.55)
              .setFlipX(i % 2 === 1),
          );
        } else {
          const kind = e.enemies[i]!;
          view.add(new MonsterView(this, dx!, dy! - 12, { ...kind }, 30));
        }
      }
      const label = this.add
        .text(
          0,
          -46,
          encounterTitle(e),
          worldTextStyle(11, 0xffd0d0, {
            fontStyle: 'bold',
            stroke: '#1b1530',
            strokeThickness: 4,
          }),
        )
        .setOrigin(0.5);
      view.add(label);
      view.setSize(80, 70);
      this.enemies.set(e.id, view);
    }
  }

  /** Gold rings under the monsters picked for the next fight. */
  private drawTeamRings() {
    if (!this.teamGfx) this.teamGfx = this.add.graphics().setDepth(3);
    const g = this.teamGfx.clear();
    if (this.team.size === 0) return;
    for (const w of this.walkers) {
      if (!this.team.has(w.monsterId)) continue;
      g.lineStyle(3, COLORS.gold, 0.95).strokeEllipse(w.view.x, w.view.y + 16, 34, 16);
      g.fillStyle(COLORS.gold, 0.2).fillEllipse(w.view.x, w.view.y + 16, 34, 16);
    }
  }

  /** Walkers on a mission march to their enemy and scuffle there; afterwards they go home. */
  private moveOnMission(w: Walker): boolean {
    const state = this.store.state;
    const mission = state.missions.find((m) => m.monsterIds.includes(w.monsterId));
    const e = mission && state.village.encounters.find((x) => x.id === mission.encounterId);
    if (mission && e) {
      const i = mission.monsterIds.indexOf(w.monsterId);
      const spot = { u: e.x + 0.5 + ((i % 3) - 1) * 0.7, v: e.y + 1.4 + Math.floor(i / 3) * 0.6 };
      w.away = true;
      w.nextMoveAt = this.time.now + 500;
      if (Math.abs(w.u - spot.u) + Math.abs(w.v - spot.v) > 0.05) {
        this.walkWalker(w, spot, 60);
      } else {
        // At the fight: little jumps.
        w.tween = this.tweens.add({ targets: w.view, y: w.view.y - 6, duration: 120, yoyo: true });
      }
      return true;
    }
    if (w.away) {
      w.away = false;
      const home = this.randomFreeTile();
      if (home) this.walkWalker(w, home, 60);
      w.nextMoveAt = this.time.now + 1000;
      return true;
    }
    return false;
  }

  private walkWalker(w: Walker, to: { u: number; v: number }, speed: number) {
    const from = isoToWorld(w.u, w.v);
    const end = isoToWorld(to.u, to.v);
    const dist = Phaser.Math.Distance.Between(from.x, from.y, end.x, end.y);
    w.view.setScale(end.x < from.x ? -1 : 1, 1);
    const su = w.u;
    const sv = w.v;
    const state = { t: 0 };
    w.tween = this.tweens.add({
      targets: state,
      t: 1,
      duration: Math.max(200, (dist / speed) * 1000),
      onUpdate: () => {
        w.cu = su + (to.u - su) * state.t;
        w.cv = sv + (to.v - sv) * state.t;
        const p = isoToWorld(w.cu, w.cv);
        w.view.setPosition(p.x, p.y - 16 - Math.abs(Math.sin(state.t * Math.PI * 6)) * 3);
      },
      onComplete: () => {
        w.u = w.cu = to.u;
        w.v = w.cv = to.v;
      },
    });
  }

  /**
   * Health bars while a team fights: they appear when the first member reaches the enemy
   * and drain over the rest of the mission to the HP left in the battle simulated at
   * departure (`Mission.hpLeft` / `enemyHpLeft`).
   */
  private drawFights() {
    if (!this.fightGfx) this.fightGfx = this.add.graphics().setDepth(1_400_000);
    const g = this.fightGfx.clear();
    const state = this.store.state;
    const live = new Set(state.missions.map((m) => m.id));
    for (const [id, f] of this.fights) {
      if (live.has(id)) continue;
      for (const sd of f.soldiers) sd.image.destroy();
      this.fights.delete(id);
    }
    for (const m of state.missions) {
      const e = state.village.encounters.find((x) => x.id === m.encounterId);
      const view = this.enemies.get(m.encounterId);
      if (!e || !view) continue;
      let fight = this.fights.get(m.id);
      if (!fight) {
        const walkers = this.walkers.filter((w) => m.monsterIds.includes(w.monsterId));
        // The fight shows from the team's arrival, or from half-time if the walk is long.
        const halfway = m.endsAt - this.store.now() <= gameData.rules.skirmish.missionSeconds / 2;
        const arrived =
          walkers.length === 0 ||
          halfway ||
          walkers.some((w) => {
            const p = isoToWorld(w.cu, w.cv);
            return Phaser.Math.Distance.Between(p.x, p.y, view.x, view.y) < 60;
          });
        if (!arrived) continue;
        const left = Math.max(1, m.endsAt - this.store.now()) * 1000;
        fight = { start: this.time.now, end: this.time.now + left, soldiers: [] };
        // Soldiers have no walkers in the village: they stand in front of the enemy.
        const soldiers = state.soldiers.filter((x) => m.monsterIds.includes(x.id));
        soldiers.forEach((sd, i) => {
          const pos = isoToWorld(e.x + 0.5 + (i - (soldiers.length - 1) / 2) * 0.55, e.y + 1.5);
          fight!.soldiers.push({
            id: sd.id,
            image: this.add
              .image(pos.x, pos.y, soldierTexture(this, sd))
              .setOrigin(0.5, 1)
              .setScale(0.6)
              .setFlipX(true)
              .setDepth(view.depth + 1),
          });
        });
        this.fights.set(m.id, fight);
      }
      const t = Phaser.Math.Clamp((this.time.now - fight.start) / (fight.end - fight.start), 0, 1);
      // Bars drain from full to the HP the simulator left each fighter with.
      const drain = (left: number | undefined) => 1 - t * (1 - (left ?? 1));
      const bar = (x: number, y: number, hp: number, color: number) => {
        g.fillStyle(0x1b1530, 0.85).fillRect(x - 14, y, 28, 5);
        g.fillStyle(color, 1).fillRect(x - 13, y + 1, 26 * Phaser.Math.Clamp(hp, 0, 1), 3);
      };
      let shown = 0;
      for (const child of view.list) {
        if (!(child instanceof MonsterView) && !(child instanceof Phaser.GameObjects.Image))
          continue;
        const top = child instanceof MonsterView ? child.y - 30 : child.y - 34;
        bar(view.x + child.x, view.y + top, drain(m.enemyHpLeft[shown++]), COLORS.danger);
      }
      const team = (id: string) => drain(m.hpLeft[id]);
      for (const w of this.walkers) {
        if (m.monsterIds.includes(w.monsterId))
          bar(w.view.x, w.view.y - 30, team(w.monsterId), COLORS.good);
      }
      for (const sd of fight.soldiers) {
        bar(sd.image.x, sd.image.y - 38, team(sd.id), COLORS.good);
      }
    }
  }

  /** Toasts for missions that finished during the last settle. */
  private reportMissions(before: Mission[], enemySpots: Map<string, { x: number; y: number }>) {
    const now = this.store.state.missions;
    for (const m of before) {
      if (now.some((x) => x.id === m.id)) continue;
      const spot = enemySpots.get(m.encounterId);
      playSfx(this, m.won ? 'win' : 'lose');
      if (m.won && spot) {
        burst(this, spot.x, spot.y, 'sparkle', 'large');
        this.flyResources({ ...m.reward, soulCrystal: m.soulCrystal }, spot.x, spot.y - 30);
      }
      const message = m.won
        ? t('mission.won', {
            reward:
              costLabel(m.reward) +
              (m.soulCrystal ? ` + ${m.soulCrystal} ${t('res.soulCrystal')}` : ''),
          })
        : t('mission.lost', { n: m.dead.length });
      this.game.events.emit(EVT.toast, {
        message,
        color: m.won ? COLORS.good : COLORS.danger,
        sound: null,
      });
    }
  }
}
