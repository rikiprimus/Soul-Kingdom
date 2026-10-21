import Phaser from 'phaser';
import {
  adventureNode,
  attackBase,
  attackNode,
  defendersPower,
  gameData,
  maxFormTier,
  nodeStatus,
  regionStatus,
  getForm,
  monsterName,
  serbuArmy,
  serbuBase,
  serbuBaseStatus,
  serbuPowerCap,
  serbuUnitPower,
  soldierDef,
  soldierName,
  type AdventureNode,
  type BattleEvent,
  type BattleReward,
  type Defender,
  type SerbuBase,
  type SerbuResult,
} from '@soul-monster/shared';
import { MonsterView } from '../art/MonsterView';
import { buildingTexture } from '../art/buildingArt';
import { banditTexture } from '../art/enemyArt';
import { soldierTexture } from '../art/soldierArt';
import { playSfx } from '../audio/sound';
import type { GameStore } from '../store';
import { errorText, formatDuration, formatNumber, t } from '../text';
import { costLabel } from '../ui/cost';
import { cssSize, dpr } from '../ui/dpr';
import { COLORS, textStyle } from '../ui/theme';
import { Button, roundedPanel, ScrollArea, toast } from '../ui/widgets';

/** What a fighter on the Serbu field looks like. */
type UnitLook =
  | { type: 'monster'; form: string; element: string; stage: string; boss?: boolean }
  | { type: 'soldier'; kind: string; rank: number }
  | { type: 'bandit' }
  | { type: 'tower'; level: number };

interface Field {
  x: number;
  y: number;
  cell: number;
}

interface ReplayUnit {
  view: Phaser.GameObjects.Container;
  side: 'attackers' | 'defenders';
  maxHp: number;
  hp: number;
  attacks: number;
  skill: boolean;
  dead: boolean;
}

interface Replay {
  result: SerbuResult;
  /** Our units' names, taken before the attack (the fallen leave the state). */
  names: Map<string, string>;
  field: Field;
  units: Map<string, ReplayUnit>;
  tick: number;
  speed: number;
  next: number;
  done: boolean;
  bars: Phaser.GameObjects.Graphics;
  timer: Phaser.GameObjects.Text;
}

/** Order on the field, front to back: tanks first, archers last. */
const ROLE_ORDER = ['penahan', 'petarung', 'penembak'];

const rewardLabel = (r: BattleReward) =>
  costLabel(r) +
  (r.soulCrystal ? ` + ${r.soulCrystal} ${t('res.soulCrystal')}` : '') +
  (r.gems ? ` + ${r.gems} ${t('res.gems')}` : '');

/** What is attacked: a Serbu base or a Petualangan node. */
interface Target {
  name: string;
  defenders: readonly Defender[];
  node?: AdventureNode;
}

function targetOf(id: string): Target | null {
  const base = serbuBase(id);
  if (base) return { name: base.name, defenders: base.defenders };
  const found = adventureNode(id);
  return found
    ? { name: found.node.name, defenders: found.node.defenders, node: found.node }
    : null;
}

/** Defenders in the same order (and ids) as `defenderFighters`. */
function defenderLooks(defenders: readonly Defender[]): UnitLook[] {
  return defenders.flatMap((d) =>
    Array.from({ length: d.count }, (): UnitLook => {
      if (d.kind === 'monster') {
        return { type: 'monster', form: d.form, element: d.element, stage: d.stage };
      }
      if (d.kind === 'boss') {
        return { type: 'monster', form: d.form, element: d.element, stage: d.stage, boss: true };
      }
      if (d.kind === 'soldier') return { type: 'soldier', kind: d.soldier, rank: d.rank };
      if (d.kind === 'tower') return { type: 'tower', level: d.level };
      return { type: 'bandit' };
    }),
  );
}

/** "Bandit ×4 · Serigala Kegelapan ×2 · Menara Jaga Lv 1". */
function defenderSummary(defenders: readonly Defender[]): string {
  return defenders
    .map((d) => {
      if (d.kind === 'bandit') return t('enemy.bandits', { n: d.count });
      if (d.kind === 'boss') return t('adventure.boss', { name: d.name });
      const name =
        d.kind === 'monster'
          ? monsterName(d)
          : d.kind === 'soldier'
            ? soldierName({ kind: d.soldier, rank: d.rank })
            : t('serbu.tower', { level: d.level });
      return `${name} ×${d.count}`;
    })
    .join(' · ');
}

/**
 * Mode Serbu (Tugas 1.4) and Petualangan (Tugas 1.5), over the village: pick an NPC
 * base (or a node on a region map), place the army on the left columns of the field
 * (drag, or tap a unit then a cell), attack, and watch the battle replayed from its log
 * (1x/2x, skip) before the result.
 */
export class SerbuScene extends Phaser.Scene {
  private mode: 'list' | 'place' | 'replay' = 'list';
  /** Serbu bases, or the Petualangan map. */
  private source: 'serbu' | 'adventure' = 'serbu';
  /** The base or node being attacked. */
  private targetId = '';
  /** Petualangan: the region shown and the node picked on its map. */
  private regionIndex = -1;
  private selectedNode: string | null = null;
  /** Placed units: id → cell. */
  private cells = new Map<string, { x: number; y: number }>();
  private picked: string | null = null;
  private layer?: Phaser.GameObjects.Container;
  private scroll?: ScrollArea;
  private field?: Field;
  private drag?: {
    id: string;
    fromField: boolean;
    x: number;
    y: number;
    ghost?: Phaser.GameObjects.Container;
  };
  private replay?: Replay;
  private resultPanel?: Phaser.GameObjects.Container;

  constructor(private readonly store: GameStore) {
    super('serbu');
  }

  create(data: { source?: 'serbu' | 'adventure' } = {}): void {
    this.cameras.main.setOrigin(0, 0).setZoom(dpr());
    this.source = data.source ?? 'serbu';
    this.regionIndex = -1;
    this.selectedNode = null;
    this.mode = 'list';
    this.cells.clear();
    this.picked = null;
    this.replay = undefined;
    // The village waits underneath; its UI takes no taps while Serbu is open.
    this.scene.pause('village');
    const ui = this.scene.get('ui');
    ui.input.enabled = false;
    const onResize = () => this.render();
    this.scale.on('resize', onResize);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.scroll?.destroy();
      this.scroll = undefined;
      this.scene.resume('village');
      ui.input.enabled = true;
    });
    this.render();
  }

  override update(_time: number, delta: number): void {
    if (this.replay) this.stepReplay(delta);
  }

  private get size() {
    return cssSize(this);
  }

  private back() {
    if (this.mode === 'replay') return;
    if (this.mode === 'place') {
      this.mode = 'list';
      this.render();
    } else {
      this.scene.stop();
    }
  }

  private render() {
    this.scroll?.destroy();
    this.scroll = undefined;
    this.layer?.destroy();
    this.resultPanel?.destroy();
    this.resultPanel = undefined;
    const { width, height } = this.size;
    this.layer = this.add.container(0, 0);
    // Swallows taps so nothing reaches the paused village.
    const bg = this.add
      .rectangle(0, 0, width, height, COLORS.background, 0.97)
      .setOrigin(0)
      .setInteractive();
    this.layer.add(bg);
    if (this.mode === 'list') {
      if (this.source === 'adventure') this.renderMap();
      else this.renderList();
    } else if (this.mode === 'place') this.renderPlace();
    else this.renderReplay();
  }

  private header(title: string, right?: string) {
    const { width } = this.size;
    const layer = this.layer!;
    layer.add(
      this.add
        .text(56, 22, title, textStyle(18, COLORS.text, { fontStyle: 'bold' }))
        .setOrigin(0, 0.5),
    );
    if (right) {
      layer.add(
        this.add.text(width - 16, 22, right, textStyle(12, COLORS.textDim)).setOrigin(1, 0.5),
      );
    }
    if (this.mode !== 'replay') {
      layer.add(
        new Button(this, 26, 22, {
          width: 36,
          height: 30,
          label: this.mode === 'list' ? '✕' : '‹',
          color: COLORS.panelLight,
          onClick: () => this.back(),
        }),
      );
    }
  }

  // ---------- Base list ----------

  private renderList() {
    const { width, height } = this.size;
    const cap = serbuPowerCap(this.store.state);
    this.header(t('serbu.title'), t('serbu.cap', { cap }));
    const top = 44;
    const area = new ScrollArea(this, new Phaser.Geom.Rectangle(0, top, width, height - top), 1);
    this.scroll = area;
    const cardW = Math.min(width - 24, 760);
    const x = Math.round((width - cardW) / 2);
    const cardH = 96;
    let y = 4;
    for (const base of gameData.rules.serbu.bases) {
      area.content.add(this.baseCard(base, x, y, cardW, cardH));
      y += cardH + 8;
    }
    area.setContentHeight(y + 8);
  }

  private baseCard(base: SerbuBase, x: number, y: number, w: number, h: number) {
    const status = serbuBaseStatus(this.store.state, base.id);
    const open = status === 'open' || status === 'cleared';
    const card = this.add.container(x, y);
    card.add(roundedPanel(this, 0, 0, w, h, open ? COLORS.panel : COLORS.panelDark));
    const statusText =
      status === 'townHall'
        ? t('serbu.status.townHall', { level: base.requiresTownHall })
        : t(`serbu.status.${status}`);
    const statusColor =
      status === 'cleared' ? COLORS.good : status === 'open' ? COLORS.gold : COLORS.textDim;
    const textW = w - 130;
    card.add([
      this.add.text(12, 10, base.name, textStyle(15, COLORS.text, { fontStyle: 'bold' })),
      this.add
        .text(w - 12, 12, statusText, textStyle(11, statusColor, { fontStyle: 'bold' }))
        .setOrigin(1, 0),
      this.add.text(
        12,
        32,
        defenderSummary(base.defenders),
        textStyle(11, COLORS.textDim, {
          wordWrap: { width: textW },
        }),
      ),
      this.add.text(
        12,
        h - 22,
        `${t('serbu.power', { power: defendersPower(base.defenders).toFixed(1) })} · ${t(
          status === 'cleared' ? 'serbu.repeatReward' : 'serbu.firstReward',
          { reward: rewardLabel(status === 'cleared' ? base.repeatReward : base.firstReward) },
        )}`,
        textStyle(11, COLORS.text),
      ),
    ]);
    card.add(
      new Button(this, w - 58, h - 30, {
        width: 96,
        height: 34,
        label: t('serbu.attack'),
        color: COLORS.danger,
        disabled: !open,
        onClick: () => this.choose(base.id),
      }),
    );
    return card;
  }

  /** Goes to placement against a base or node. */
  private choose(targetId: string) {
    this.targetId = targetId;
    this.mode = 'place';
    // Keep earlier placements that are still possible.
    const army = new Set(serbuArmy(this.store.state));
    for (const id of [...this.cells.keys()]) if (!army.has(id)) this.cells.delete(id);
    this.picked = null;
    this.render();
  }

  // ---------- Petualangan map ----------

  private renderMap() {
    const { width, height } = this.size;
    const state = this.store.state;
    const now = this.store.now();
    const { regions } = gameData.adventure;
    if (this.regionIndex < 0) {
      // The furthest region that can be played.
      const playable = regions.map((r) => regionStatus(state, r.id)).lastIndexOf('open');
      this.regionIndex = Math.max(0, playable);
    }
    const region = regions[this.regionIndex]!;
    const status = regionStatus(state, region.id);
    this.header(
      t('adventure.title'),
      t('adventure.mixerTier', { tier: maxFormTier(state.bossesDefeated) }),
    );
    const layer = this.layer!;
    // Region tabs.
    const tabW = Math.min(170, (width - 24) / regions.length - 6);
    regions.forEach((r, i) => {
      const s = regionStatus(state, r.id);
      layer.add(
        new Button(this, 12 + tabW / 2 + i * (tabW + 6), 62, {
          width: tabW,
          height: 28,
          fontSize: 12,
          label: s === 'done' ? `${r.name} ✓` : r.name,
          color: i === this.regionIndex ? COLORS.accent : COLORS.panelLight,
          onClick: () => {
            this.regionIndex = i;
            this.selectedNode = null;
            this.render();
          },
        }),
      );
    });
    // Map area (left) and the node card (right).
    const cardW = Math.min(280, Math.max(200, Math.round(width * 0.32)));
    const top = 84;
    const mapX = 12;
    const mapW = width - cardW - 30;
    const mapH = height - top - 12;
    layer.add(roundedPanel(this, mapX, top, mapW, mapH, 0x24402a, 0x3d6b45, 14));
    layer.add(
      this.add.text(
        mapX + 12,
        top + 10,
        region.description,
        textStyle(11, COLORS.textDim, {
          wordWrap: { width: mapW - 24 },
        }),
      ),
    );
    const pad = 36;
    const at = (n: AdventureNode) => ({
      x: mapX + pad + n.x * (mapW - pad * 2),
      y: top + pad + 14 + n.y * (mapH - pad * 2 - 14),
    });
    const g = this.add.graphics();
    layer.add(g);
    for (const n of region.nodes) {
      for (const id of n.after) {
        const from = region.nodes.find((x) => x.id === id);
        if (!from) continue;
        const a = at(from);
        const b = at(n);
        const done = state.adventure.cleared.includes(id);
        g.lineStyle(4, done ? 0xf5d78a : 0x6b5a3a, done ? 0.9 : 0.6).lineBetween(
          a.x,
          a.y,
          b.x,
          b.y,
        );
      }
    }
    for (const n of region.nodes) {
      const p = at(n);
      const s = nodeStatus(state, n.id, now);
      const r = n.kind === 'boss' ? 24 : 18;
      const color =
        n.kind === 'boss' ? COLORS.danger : n.kind === 'camp' ? COLORS.warn : COLORS.good;
      const dim = s === 'locked' || s === 'townHall';
      const dot = this.add.container(p.x, p.y);
      const ring = this.add.graphics();
      if (this.selectedNode === n.id) ring.lineStyle(3, COLORS.gold, 1).strokeCircle(0, 0, r + 6);
      ring.fillStyle(0x000000, 0.3).fillCircle(0, 3, r);
      ring.fillStyle(dim ? COLORS.disabled : color, 1).fillCircle(0, 0, r);
      ring.lineStyle(2, 0xffffff, dim ? 0.2 : 0.7).strokeCircle(0, 0, r);
      dot.add(ring);
      const mark = s === 'cleared' ? '✓' : s === 'refilling' ? '…' : n.kind === 'boss' ? '!' : '';
      if (mark) {
        dot.add(
          this.add
            .text(0, 0, mark, textStyle(16, COLORS.text, { fontStyle: 'bold' }))
            .setOrigin(0.5),
        );
      }
      dot.add(
        this.add
          .text(
            0,
            r + 4,
            n.name,
            textStyle(10, dim ? COLORS.textDim : COLORS.text, {
              fontStyle: 'bold',
              stroke: '#1b1530',
              strokeThickness: 3,
            }),
          )
          .setOrigin(0.5, 0),
      );
      dot.setSize(r * 2 + 8, r * 2 + 8).setInteractive({ useHandCursor: true });
      dot.on('pointerup', () => {
        this.selectedNode = n.id;
        playSfx(this, 'tap');
        this.render();
      });
      layer.add(dot);
    }
    if (status === 'locked' || status === 'townHall') {
      layer.add(this.add.rectangle(mapX, top, mapW, mapH, 0x07050f, 0.45).setOrigin(0));
      layer.add(
        this.add
          .text(
            mapX + mapW / 2,
            top + mapH / 2,
            status === 'locked'
              ? t('adventure.region.locked')
              : t('adventure.region.townHall', { level: region.requiresTownHall }),
            textStyle(15, COLORS.text, { fontStyle: 'bold', align: 'center' }),
          )
          .setOrigin(0.5),
      );
    }
    this.nodeCard(width - cardW - 12, top, cardW, mapH, now);
  }

  private nodeCard(x: number, y: number, w: number, h: number, now: number) {
    const layer = this.layer!;
    layer.add(roundedPanel(this, x, y, w, h, COLORS.panelDark));
    const id = this.selectedNode;
    const found = id ? adventureNode(id) : undefined;
    if (!found) {
      layer.add(
        this.add.text(
          x + 12,
          y + 12,
          t('adventure.pickNode'),
          textStyle(12, COLORS.textDim, {
            wordWrap: { width: w - 24 },
          }),
        ),
      );
      return;
    }
    const { node } = found;
    const status = nodeStatus(this.store.state, node.id, now);
    const lines: string[] = [
      t(`adventure.kind.${node.kind}`),
      defenderSummary(node.defenders),
      t('serbu.power', { power: defendersPower(node.defenders).toFixed(1) }),
      t('serbu.reward', { reward: rewardLabel(node.reward) }),
    ];
    if (node.kind === 'resource') {
      lines.push(t('adventure.refill', { hours: node.refillHours! }));
      if (node.gemChance > 0) {
        lines.push(t('adventure.gemChance', { pct: Math.round(node.gemChance * 100) }));
      }
    }
    if (node.kind === 'boss') lines.push(t('adventure.bossReward'));
    const statusText =
      status === 'townHall'
        ? t('adventure.region.townHall', { level: found.region.requiresTownHall })
        : status === 'refilling'
          ? t('adventure.status.refilling', {
              time: formatDuration((this.store.state.adventure.refillAt[node.id] ?? now) - now),
            })
          : t(`adventure.status.${status}`);
    layer.add(
      this.add.text(x + 12, y + 10, node.name, textStyle(15, COLORS.text, { fontStyle: 'bold' })),
    );
    layer.add(
      this.add.text(
        x + 12,
        y + 32,
        statusText,
        textStyle(11, status === 'open' ? COLORS.gold : COLORS.textDim, {
          fontStyle: 'bold',
        }),
      ),
    );
    layer.add(
      this.add.text(
        x + 12,
        y + 54,
        lines.join('\n'),
        textStyle(11, COLORS.text, {
          wordWrap: { width: w - 24 },
          lineSpacing: 4,
        }),
      ),
    );
    layer.add(
      new Button(this, x + w / 2, y + h - 30, {
        width: w - 24,
        height: 38,
        label: t('serbu.attack'),
        color: COLORS.danger,
        disabled: status !== 'open',
        onClick: () => this.choose(node.id),
      }),
    );
  }

  // ---------- Placement ----------

  private power(): number {
    let sum = 0;
    for (const id of this.cells.keys()) sum += serbuUnitPower(this.store.state, id);
    return sum;
  }

  private look(id: string): UnitLook | null {
    const m = this.store.state.monsters.find((x) => x.id === id);
    if (m) return { type: 'monster', form: m.form, element: m.element, stage: m.stage };
    const s = this.store.state.soldiers.find((x) => x.id === id);
    return s ? { type: 'soldier', kind: s.kind, rank: s.rank } : null;
  }

  private unitLabel(id: string): string {
    const m = this.store.state.monsters.find((x) => x.id === id);
    if (m) return monsterName(m);
    const s = this.store.state.soldiers.find((x) => x.id === id);
    return s ? soldierName(s) : id;
  }

  private role(id: string): string {
    const m = this.store.state.monsters.find((x) => x.id === id);
    if (m) return getForm(m.form).role;
    const s = this.store.state.soldiers.find((x) => x.id === id);
    return s ? soldierDef(s.kind).role : '';
  }

  /** A unit's picture, standing on (0, 0); `size` is about its height. */
  private unitView(look: UnitLook, size: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    if (look.type === 'monster') {
      // Bosses stand out: bigger, with their aura.
      const k = look.boss ? 1.6 : 1;
      c.add(
        new MonsterView(this, 0, -size * 0.55 * k, look, size * 0.9 * k, { effects: !!look.boss }),
      );
    } else if (look.type === 'tower') {
      const art = buildingTexture(this, gameData.rules.raids.tower.building, look.level);
      const img = this.add
        .image(0, size * 0.1, art.key, art.frame)
        .setOrigin(art.originX, art.originY);
      img.setScale((size * 1.5) / Math.max(1, img.height));
      c.add(img);
    } else {
      const key = look.type === 'soldier' ? soldierTexture(this, look) : banditTexture(this);
      const img = this.add.image(0, 0, key).setOrigin(0.5, 0.95);
      img.setScale(size / Math.max(1, img.height));
      c.add(img);
    }
    return c;
  }

  private layoutField(width: number, height: number, top: number, right: number): Field {
    const { columns, rows } = gameData.rules.serbu.grid;
    const w = width - right - 20;
    const h = height - top - 30;
    const cell = Math.max(16, Math.floor(Math.min(w / columns, h / rows)));
    return {
      x: Math.round(10 + (w - cell * columns) / 2),
      y: Math.round(top + (h - cell * rows) / 2),
      cell,
    };
  }

  private drawField(f: Field, zones: boolean) {
    const { columns, rows } = gameData.rules.serbu.grid;
    const { placeColumns } = gameData.rules.serbu;
    const g = this.add.graphics();
    g.fillStyle(0x2f5a2c, 1).fillRoundedRect(
      f.x - 6,
      f.y - 6,
      f.cell * columns + 12,
      f.cell * rows + 12,
      10,
    );
    for (let x = 0; x < columns; x++) {
      for (let y = 0; y < rows; y++) {
        const ours = x < placeColumns;
        const theirs = x >= columns - placeColumns;
        const shade = (x + y) % 2 === 0 ? 0x3d7a37 : 0x377033;
        g.fillStyle(shade, 1).fillRect(f.x + x * f.cell, f.y + y * f.cell, f.cell, f.cell);
        if (zones && (ours || theirs)) {
          g.fillStyle(ours ? 0x9cff8a : COLORS.danger, ours ? 0.22 : 0.2);
          g.fillRect(f.x + x * f.cell, f.y + y * f.cell, f.cell, f.cell);
        }
      }
    }
    g.lineStyle(1, 0x000000, 0.12);
    for (let x = 0; x <= columns; x++)
      g.lineBetween(f.x + x * f.cell, f.y, f.x + x * f.cell, f.y + rows * f.cell);
    for (let y = 0; y <= rows; y++)
      g.lineBetween(f.x, f.y + y * f.cell, f.x + columns * f.cell, f.y + y * f.cell);
    if (zones) {
      // Outlines: where our army may stand, and where the base defends.
      const { placeColumns } = gameData.rules.serbu;
      const zw = placeColumns * f.cell;
      g.lineStyle(2, 0x9cff8a, 0.9).strokeRect(f.x + 1, f.y + 1, zw - 2, rows * f.cell - 2);
      g.lineStyle(2, COLORS.danger, 0.9);
      g.strokeRect(f.x + (columns - placeColumns) * f.cell + 1, f.y + 1, zw - 2, rows * f.cell - 2);
    }
    this.layer!.add(g);
  }

  private cellAt(px: number, py: number): { x: number; y: number } | null {
    const f = this.field;
    if (!f) return null;
    const { placeColumns, grid } = gameData.rules.serbu;
    const x = Math.floor((px - f.x) / f.cell);
    const y = Math.floor((py - f.y) / f.cell);
    if (x < 0 || y < 0 || x >= placeColumns || y >= grid.rows) return null;
    return { x, y };
  }

  private renderPlace() {
    const { width, height } = this.size;
    const target = targetOf(this.targetId)!;
    const state = this.store.state;
    const cap = serbuPowerCap(state);
    const { maxUnits } = gameData.rules.battle;
    const { grid, placeColumns } = gameData.rules.serbu;
    this.header(target.name);
    const right = Math.min(260, Math.max(180, Math.round(width * 0.3)));
    const top = 44;
    const f = this.layoutField(width, height, top, right);
    this.field = f;
    this.drawField(f, true);
    const layer = this.layer!;

    // Preview of the defenders in their zone (the real cells are rolled at the attack).
    const looks = defenderLooks(target.defenders);
    // Centred down the column, so a big boss on top does not stick out of the field.
    const offset = Math.floor((grid.rows - Math.min(looks.length, grid.rows)) / 2);
    looks.forEach((look, i) => {
      const col = grid.columns - 1 - Math.floor(i / grid.rows);
      const row = (i + offset) % grid.rows;
      const v = this.unitView(look, f.cell * 0.9);
      v.setPosition(f.x + (col + 0.5) * f.cell, f.y + (row + 0.85) * f.cell).setAlpha(0.55);
      v.setScale(-1, 1);
      layer.add(v);
    });
    layer.add(
      this.add
        .text(
          f.x + grid.columns * f.cell,
          f.y + grid.rows * f.cell + 10,
          t('serbu.enemyHint'),
          textStyle(10, COLORS.textDim),
        )
        .setOrigin(1, 0),
    );
    layer.add(
      this.add
        .text(
          f.x,
          f.y + grid.rows * f.cell + 10,
          t('serbu.placeHint'),
          textStyle(10, COLORS.textDim, {
            wordWrap: { width: f.cell * (grid.columns - 4) },
          }),
        )
        .setOrigin(0, 0),
    );

    // Placed units (tap: back to the list; drag: move).
    for (const [id, c] of this.cells) {
      const look = this.look(id);
      if (!look) continue;
      const v = this.unitView(look, f.cell * 0.9);
      v.setPosition(f.x + (c.x + 0.5) * f.cell, f.y + (c.y + 0.85) * f.cell);
      const hit = this.add
        .zone(f.x + c.x * f.cell, f.y + c.y * f.cell, f.cell, f.cell)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => this.startDrag(id, true, p));
      layer.add([v, hit]);
    }
    // The placement zone takes taps for the picked unit.
    const zone = this.add
      .zone(f.x, f.y, f.cell * placeColumns, f.cell * grid.rows)
      .setOrigin(0)
      .setInteractive();
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.drag || !this.picked) return;
      const cell = this.cellAt(p.x / dpr(), p.y / dpr());
      if (cell) this.place(this.picked, cell, null);
    });
    layer.addAt(zone, 2);

    // Right column: counter, tools, roster, attack.
    const rx = width - right - 6;
    const power = this.power();
    layer.add(roundedPanel(this, rx, top, right, height - top - 8, COLORS.panelDark));
    layer.add(
      this.add
        .text(
          rx + right / 2,
          top + 14,
          t('serbu.counter', { p: power, cap, n: this.cells.size, max: maxUnits }),
          textStyle(12, power > cap ? COLORS.danger : COLORS.text, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5),
    );
    const half = (right - 24) / 2;
    layer.add(
      new Button(this, rx + 8 + half / 2, top + 44, {
        width: half,
        height: 30,
        fontSize: 12,
        label: t('serbu.auto'),
        color: COLORS.accentDark,
        onClick: () => this.autoFill(),
      }),
    );
    layer.add(
      new Button(this, rx + right - 8 - half / 2, top + 44, {
        width: half,
        height: 30,
        fontSize: 12,
        label: t('serbu.clear'),
        color: COLORS.panelLight,
        disabled: this.cells.size === 0,
        onClick: () => {
          this.cells.clear();
          this.render();
        },
      }),
    );
    const listTop = top + 66;
    const listH = height - listTop - 66;
    const area = new ScrollArea(
      this,
      new Phaser.Geom.Rectangle(rx + 4, listTop, right - 8, listH),
      1,
    );
    this.scroll = area;
    const free = serbuArmy(state).filter((id) => !this.cells.has(id));
    let y = 0;
    if (free.length === 0) {
      area.content.add(
        this.add.text(
          8,
          6,
          t(this.cells.size ? 'serbu.allPlaced' : 'serbu.noArmy'),
          textStyle(11, COLORS.textDim, { wordWrap: { width: right - 24 } }),
        ),
      );
      y = 40;
    }
    for (const id of free) {
      const row = this.add.container(0, y);
      const picked = this.picked === id;
      row.add(
        roundedPanel(
          this,
          2,
          0,
          right - 12,
          40,
          picked ? COLORS.accentDark : COLORS.panel,
          picked ? COLORS.gold : COLORS.stroke,
          8,
        ),
      );
      const look = this.look(id)!;
      const v = this.unitView(look, 30);
      v.setPosition(22, 36);
      row.add(v);
      row.add(
        this.add.text(
          42,
          6,
          this.unitLabel(id),
          textStyle(11, COLORS.text, { fontStyle: 'bold', wordWrap: { width: right - 60 } }),
        ),
      );
      row.add(
        this.add.text(
          42,
          24,
          t('serbu.unitPower', { n: serbuUnitPower(state, id) }),
          textStyle(10, COLORS.textDim),
        ),
      );
      const hit = this.add
        .zone(2, 0, right - 12, 40)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => this.startDrag(id, false, p));
      row.add(hit);
      area.content.add(row);
      y += 44;
    }
    area.setContentHeight(y + 4);
    layer.add(
      new Button(this, rx + right / 2, height - 38, {
        width: right - 20,
        height: 40,
        label: t('serbu.go'),
        color: COLORS.danger,
        disabled: this.cells.size === 0 || power > cap,
        onClick: () => this.attack(),
      }),
    );
  }

  private startDrag(id: string, fromField: boolean, p: Phaser.Input.Pointer) {
    this.drag = { id, fromField, x: p.x / dpr(), y: p.y / dpr() };
  }

  private onMove(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d || !p.isDown) return;
    const x = p.x / dpr();
    const y = p.y / dpr();
    if (!d.ghost) {
      const dx = Math.abs(x - d.x);
      const dy = Math.abs(y - d.y);
      if (Math.max(dx, dy) < 10) return;
      // In the list a mostly vertical drag scrolls it instead.
      if (!d.fromField && dy > dx) {
        this.drag = undefined;
        return;
      }
      const look = this.look(d.id);
      if (!look) return;
      d.ghost = this.unitView(look, (this.field?.cell ?? 40) * 0.9)
        .setDepth(50)
        .setAlpha(0.85);
    }
    d.ghost.setPosition(x, y + 12);
  }

  private onUp(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d || this.mode !== 'place') return;
    this.drag = undefined;
    if (d.ghost) {
      d.ghost.destroy();
      const cell = this.cellAt(p.x / dpr(), p.y / dpr());
      if (cell) {
        this.place(d.id, cell, d.fromField ? this.cells.get(d.id)! : null);
        return;
      }
      if (d.fromField) this.cells.delete(d.id);
      this.render();
      return;
    }
    // A tap: field units go back to the list; list units are picked (or unpicked).
    if (d.fromField) this.cells.delete(d.id);
    else this.picked = this.picked === d.id ? null : d.id;
    this.render();
  }

  /** Puts a unit on a cell; a unit already there swaps to `from` (or back to the list). */
  private place(id: string, cell: { x: number; y: number }, from: { x: number; y: number } | null) {
    const state = this.store.state;
    const other = [...this.cells].find(([, c]) => c.x === cell.x && c.y === cell.y)?.[0];
    if (!this.cells.has(id)) {
      const cap = serbuPowerCap(state);
      const freed = other ? serbuUnitPower(state, other) : 0;
      if (this.power() - freed + serbuUnitPower(state, id) > cap) {
        toast(this, t('serbu.overCap'));
        return;
      }
      if (!other && this.cells.size >= gameData.rules.battle.maxUnits) {
        toast(this, errorText('invalidAmount'));
        return;
      }
    }
    if (other && other !== id) {
      if (from) this.cells.set(other, from);
      else this.cells.delete(other);
    }
    this.cells.set(id, cell);
    this.picked = null;
    playSfx(this, 'place');
    this.render();
  }

  /** Strongest units that fit the cap, tanks in front and archers at the back. */
  private autoFill() {
    const state = this.store.state;
    const cap = serbuPowerCap(state);
    const { maxUnits } = gameData.rules.battle;
    const { placeColumns, grid } = gameData.rules.serbu;
    const chosen: string[] = [];
    let power = 0;
    const pool = serbuArmy(state).sort(
      (a, b) => serbuUnitPower(state, b) - serbuUnitPower(state, a) || (a < b ? -1 : 1),
    );
    for (const id of pool) {
      const p = serbuUnitPower(state, id);
      if (power + p > cap || chosen.length >= maxUnits) continue;
      chosen.push(id);
      power += p;
    }
    chosen.sort((a, b) => ROLE_ORDER.indexOf(this.role(a)) - ROLE_ORDER.indexOf(this.role(b)));
    // Rows from the middle outwards, columns front to back: tanks first, archers behind.
    const rows = Array.from({ length: grid.rows }, (_, i) => i).sort(
      (a, b) => Math.abs(a - (grid.rows - 1) / 2) - Math.abs(b - (grid.rows - 1) / 2),
    );
    this.cells.clear();
    const melee = chosen.filter((id) => this.role(id) !== 'penembak');
    const ranged = chosen.filter((id) => this.role(id) === 'penembak');
    // Archers start on a fresh column behind the melee units when there is room for them.
    const nextColumn = Math.ceil(melee.length / grid.rows) * grid.rows;
    const start =
      nextColumn + ranged.length <= grid.rows * placeColumns ? nextColumn : melee.length;
    [...melee, ...ranged].forEach((id, i) => {
      const slot = i < melee.length ? i : start + (i - melee.length);
      const col = placeColumns - 1 - Math.floor(slot / grid.rows);
      this.cells.set(id, { x: col, y: rows[slot % grid.rows]! });
    });
    this.picked = null;
    this.render();
  }

  private attack() {
    const looks = new Map([...this.cells.keys()].map((id) => [id, this.look(id)!]));
    const names = new Map([...this.cells.keys()].map((id) => [id, this.unitLabel(id)]));
    const cells = [...this.cells].map(([id, c]) => ({ id, ...c }));
    const targetId = this.targetId;
    const r = this.store.apply((s, now) =>
      this.source === 'adventure'
        ? attackNode(s, { nodeId: targetId, cells }, now)
        : attackBase(s, { baseId: targetId, cells }),
    );
    if (!r.ok) {
      toast(this, errorText(r.error));
      return;
    }
    playSfx(this, 'march');
    this.mode = 'replay';
    this.render();
    this.startReplay(r.result, looks, names);
  }

  // ---------- Replay ----------

  private renderReplay() {
    this.header(targetOf(this.targetId)!.name);
    const { width, height } = this.size;
    this.field = this.layoutField(width, height, 44, 0);
    this.drawField(this.field, false);
  }

  private startReplay(
    result: SerbuResult,
    looks: Map<string, UnitLook>,
    names: Map<string, string>,
  ) {
    const f = this.field!;
    const layer = this.layer!;
    const enemyLooks = defenderLooks(targetOf(result.targetId)!.defenders);
    const units = new Map<string, ReplayUnit>();
    const add = (
      id: string,
      side: ReplayUnit['side'],
      look: UnitLook,
      maxHp: number,
      skill: boolean,
    ) => {
      const view = this.unitView(look, f.cell * 0.95);
      if (side === 'defenders') view.setScale(-1, 1);
      layer.add(view);
      units.set(id, { view, side, maxHp, hp: maxHp, attacks: 0, skill, dead: false });
    };
    for (const a of result.attackers) add(a.id, 'attackers', looks.get(a.id)!, a.stats.hp, a.skill);
    result.defenders.forEach((d, i) => add(d.id, 'defenders', enemyLooks[i]!, d.stats.hp, d.skill));
    const bars = this.add.graphics().setDepth(5);
    layer.add(bars);
    const { width } = this.size;
    const timer = this.add
      .text(width / 2, 22, '', textStyle(14, COLORS.text, { fontStyle: 'bold' }))
      .setOrigin(0.5);
    layer.add(timer);
    const speedButton = new Button(this, width - 120, 22, {
      width: 52,
      height: 28,
      fontSize: 12,
      label: t('serbu.speed', { n: 1 }),
      color: COLORS.accentDark,
      onClick: () => {
        if (!this.replay) return;
        this.replay.speed = this.replay.speed === 1 ? 2 : 1;
        speedButton.setLabel(t('serbu.speed', { n: this.replay.speed }));
      },
    });
    const skipButton = new Button(this, width - 50, 22, {
      width: 76,
      height: 28,
      fontSize: 12,
      label: t('serbu.skip'),
      color: COLORS.panelLight,
      onClick: () => {
        if (this.replay && !this.replay.done)
          this.advanceTo(this.replay.result.battle.ticks, false);
      },
    });
    layer.add([speedButton, skipButton]);
    this.replay = {
      result,
      names,
      field: f,
      units,
      tick: 0,
      speed: 1,
      next: 0,
      done: false,
      bars,
      timer,
    };
    this.placeUnits();
  }

  private stepReplay(delta: number) {
    const r = this.replay!;
    if (r.done) return;
    const { ticksPerSecond } = gameData.rules.battle;
    this.advanceTo(r.tick + (delta / 1000) * ticksPerSecond * r.speed, true);
  }

  /** Moves the replay on to `tick`: events up to it (with effects when `show`), positions. */
  private advanceTo(tick: number, show: boolean) {
    const r = this.replay!;
    const { battle } = r.result;
    r.tick = Math.min(tick, battle.ticks);
    while (r.next < battle.events.length && battle.events[r.next]!.tick <= r.tick) {
      this.applyEvent(battle.events[r.next]!, show);
      r.next += 1;
    }
    this.placeUnits();
    const { ticksPerSecond, maxTicks } = gameData.rules.battle;
    r.timer.setText(`${Math.max(0, Math.ceil((maxTicks - r.tick) / ticksPerSecond))} dtk`);
    if (r.tick >= battle.ticks && !r.done) {
      r.done = true;
      this.time.delayedCall(show ? 700 : 100, () => this.showResult());
    }
  }

  private applyEvent(e: BattleEvent, show: boolean) {
    const r = this.replay!;
    if (e.kind === 'start') return;
    const u = r.units.get(e.id);
    if (!u) return;
    if (e.kind === 'death') {
      u.dead = true;
      u.hp = 0;
      if (show) this.tweens.add({ targets: u.view, alpha: 0.2, duration: 300 });
      else u.view.setAlpha(0.2);
      return;
    }
    u.attacks += 1;
    const target = r.units.get(e.target);
    if (!target) return;
    target.hp = Math.max(0, target.hp - e.damage);
    if (!show) return;
    const skill = e.kind === 'skill';
    const tx = target.view.x;
    const ty = target.view.y - r.field.cell * 0.9;
    const label = this.add
      .text(
        tx,
        ty,
        `-${formatNumber(e.damage)}`,
        textStyle(skill ? 15 : 11, skill ? COLORS.gold : COLORS.text, {
          fontStyle: 'bold',
          stroke: '#1b1530',
          strokeThickness: 3,
        }),
      )
      .setOrigin(0.5)
      .setDepth(6);
    this.layer!.add(label);
    this.tweens.add({
      targets: label,
      y: ty - 18,
      alpha: 0,
      duration: 650,
      onComplete: () => label.destroy(),
    });
    if (skill) {
      const ring = this.add
        .circle(tx, ty + r.field.cell * 0.5, r.field.cell * 0.3, COLORS.gold, 0.35)
        .setDepth(4);
      this.layer!.add(ring);
      this.tweens.add({
        targets: ring,
        scale: 2,
        alpha: 0,
        duration: 400,
        onComplete: () => ring.destroy(),
      });
    }
  }

  /** Positions between the recorded frames, plus the health bars and skill gauges. */
  private placeUnits() {
    const r = this.replay!;
    const frames = r.result.battle.frames ?? [];
    let i = 0;
    while (i + 1 < frames.length && frames[i + 1]!.tick <= r.tick) i++;
    const a = frames[i];
    const b = frames[Math.min(i + 1, frames.length - 1)];
    if (!a || !b) return;
    const k = b.tick > a.tick ? (r.tick - a.tick) / (b.tick - a.tick) : 0;
    const f = r.field;
    const { skillEvery } = gameData.rules.battle.sim;
    r.bars.clear();
    for (const [id, u] of r.units) {
      const p = a.pos[id];
      if (p) {
        const q = b.pos[id] ?? p;
        const x = p[0] + (q[0] - p[0]) * k;
        const y = p[1] + (q[1] - p[1]) * k;
        u.view.setPosition(f.x + x * f.cell, f.y + (y + 0.35) * f.cell);
        u.view.setDepth(10 + y);
      }
      if (u.dead) continue;
      const w = f.cell * 0.8;
      const bx = u.view.x - w / 2;
      const by = u.view.y - f.cell * 1.05;
      r.bars.fillStyle(0x1b1530, 0.85).fillRect(bx, by, w, 4);
      r.bars.fillStyle(u.side === 'attackers' ? COLORS.good : COLORS.danger, 1);
      r.bars.fillRect(bx + 1, by + 1, (w - 2) * (u.hp / u.maxHp), 2);
      if (u.skill) {
        // Skill gauge: fills with each attack, the next one at full is a skill.
        const fill = (u.attacks % skillEvery) / (skillEvery - 1);
        r.bars.fillStyle(COLORS.gold, 0.9).fillRect(bx, by + 5, w * Math.min(1, fill), 2);
      }
    }
  }

  private showResult() {
    const r = this.replay;
    if (!r) return;
    const { result } = r;
    const target = targetOf(result.targetId)!;
    playSfx(this, result.won ? 'win' : 'lose');
    const { width, height } = this.size;
    const w = Math.min(420, width - 40);
    const lines: string[] = [];
    if (result.won) {
      lines.push(t('serbu.reward', { reward: rewardLabel(result.reward) }));
      if (result.first && target.node?.kind === 'boss') {
        lines.push(t('adventure.bossWin', { tier: maxFormTier(this.store.state.bossesDefeated) }));
      } else if (result.first && this.source === 'serbu') {
        lines.push(t('serbu.firstWin'));
      }
    } else if (r.result.battle.ticks >= gameData.rules.battle.maxTicks) {
      lines.push(t('serbu.timeUp'));
    }
    const names = result.dead.map((id) => r.names.get(id) ?? id);
    lines.push(
      names.length ? t('serbu.fallen', { names: names.join(', ') }) : t('serbu.noneFallen'),
    );
    const h = 150 + lines.length * 18;
    const panel = this.add
      .container(Math.round((width - w) / 2), Math.round((height - h) / 2))
      .setDepth(100);
    panel.add(
      this.add
        .rectangle(-panel.x, -panel.y, width, height, 0x07050f, 0.6)
        .setOrigin(0)
        .setInteractive(),
    );
    panel.add(roundedPanel(this, 0, 0, w, h, COLORS.panel));
    panel.add(
      this.add
        .text(
          w / 2,
          26,
          result.won ? t('serbu.won') : t('serbu.lost'),
          textStyle(24, result.won ? COLORS.gold : COLORS.danger, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5),
    );
    panel.add(this.add.text(w / 2, 52, target.name, textStyle(12, COLORS.textDim)).setOrigin(0.5));
    lines.forEach((line, i) =>
      panel.add(
        this.add
          .text(
            w / 2,
            78 + i * 18,
            line,
            textStyle(12, COLORS.text, { align: 'center', wordWrap: { width: w - 24 } }),
          )
          .setOrigin(0.5, 0),
      ),
    );
    panel.add([
      new Button(this, w / 2 - 74, h - 30, {
        width: 132,
        height: 36,
        label: t(this.source === 'adventure' ? 'adventure.back' : 'serbu.back'),
        color: COLORS.accentDark,
        onClick: () => {
          this.replay = undefined;
          this.mode = 'list';
          this.cells.clear();
          this.render();
        },
      }),
      new Button(this, w / 2 + 74, h - 30, {
        width: 132,
        height: 36,
        label: t('serbu.toVillage'),
        color: COLORS.panelLight,
        onClick: () => this.scene.stop(),
      }),
    ]);
    this.resultPanel = panel;
  }
}
