import Phaser from 'phaser';
import {
  collectAll,
  constructionTime,
  gameData,
  maxConstructionWorkers,
  idleWorkers,
  isMonsterBusy,
  isReadyToCollect,
  populationCap,
  populationUsed,
  townHallLevel,
  type ActionResult,
  type PlayerState,
} from '@soul-monster/shared';
import { BUILDING_RES, buildingIcon } from '../art/buildingArt';
import {
  EVT,
  type CollectFx,
  type PlacementStatus,
  type Selection,
  type ToastRequest,
} from '../events';
import type { GameStore } from '../store';
import type { VillageScene } from './VillageScene';
import { cssSize, dpr } from '../ui/dpr';
import { errorText, formatDuration, formatNumber, t } from '../text';
import { COLORS, textStyle } from '../ui/theme';
import { canFullscreen, isFullscreen, toggleFullscreen } from '../ui/fullscreen';
import { costLabel } from '../ui/cost';
import { contentBottom, uiLayout, type UILayout } from '../ui/layout';
import { Button, confirmDialog, icons, roundedPanel, stepper, toast } from '../ui/widgets';
import { BuildMenuView } from '../views/BuildMenuView';
import { CollectionView } from '../views/CollectionView';
import { MixerView } from '../views/MixerView';
import { PediaView } from '../views/PediaView';
import { BarracksView } from '../views/BarracksView';
import { GraveyardView } from '../views/GraveyardView';
import { TeamView } from '../views/TeamView';
import type { View, ViewContext } from '../views/View';
import { infoContent } from './infoCard';
import { arcPoint, countUp, flyIconCount } from '../fx/math';
import { isSoundOn, playSfx, setSoundOn } from '../audio/sound';

export type PanelKind =
  'build' | 'collection' | 'barracks' | 'mixer' | 'pedia' | 'team' | 'graveyard';
/** Tabs on the floating bar. Monsters and the Soul Mixer open from their buildings. */
const DOCK_TABS: PanelKind[] = ['build', 'pedia'];
const PANEL_DEPTH = 300;
const DOCK_DEPTH = 360;
const DOCK_KEY = 'soul-monster:dock-visible';

export interface DevFlags {
  skipMixerUnlock: boolean;
}

/** Survives scene restarts on resize. */
let openPanelKind: PanelKind | null = null;
let openPanelTarget: string | undefined;
/** Monsters picked for the next wild fight; kept across scene restarts (resizes). */
let team: string[] = [];

/** Whether the floating tab bar is shown (remembered per browser). */
/** Pilih mode: dragging the map picks units instead of moving the camera. */
let selectMode = false;

let dockVisible = (() => {
  try {
    return localStorage.getItem(DOCK_KEY) !== '0';
  } catch {
    return true;
  }
})();

function rememberDock(visible: boolean) {
  dockVisible = visible;
  try {
    localStorage.setItem(DOCK_KEY, visible ? '1' : '0');
  } catch {
    // Storage unavailable: the choice lasts for this session only.
  }
}

export class UIScene extends Phaser.Scene {
  private resourceTexts: Partial<Record<keyof PlayerState['resources'], Phaser.GameObjects.Text>> =
    {};
  private statusText?: Phaser.GameObjects.Text;
  private statusMaxWidth = 200;
  private resourceMaxWidth = 60;
  private resourceIcons: Partial<
    Record<CollectFx['resource'], Phaser.GameObjects.Graphics | Phaser.GameObjects.Container>
  > = {};
  /** Earned amounts still flying to the HUD: the pill shows them only when they land. */
  private inFlight: Partial<Record<CollectFx['resource'], number>> = {};
  /** Numbers currently counting up after icons landed. */
  private counting: Partial<Record<CollectFx['resource'], number>> = {};
  private dockLayer?: Phaser.GameObjects.Container;
  private info?: Phaser.GameObjects.Container;
  private infoTimers: (() => void)[] = [];
  private infoHome?: { x: number; y: number; w: number; h: number };
  private collectAllButton?: Button;
  private collectReady = 0;
  private selection: Selection = null;
  private placement: PlacementStatus = { active: false, valid: false };
  /** Builders chosen for the building being placed (null: as many as possible). */
  private placeWorkers: number | null = null;
  /** Builders chosen on the info card, per building ("upgrade:id" / "add:id"). */
  private cardWorkers = new Map<string, number>();
  private panel?: {
    kind: PanelKind;
    targetId?: string;
    view: View;
    layer: Phaser.GameObjects.Container;
  };
  private shownLoadError = false;

  private get layout(): UILayout {
    const { width, height } = cssSize(this);
    return uiLayout(width, height);
  }

  constructor(
    private readonly store: GameStore,
    private readonly dev: DevFlags,
  ) {
    super('ui');
  }

  create(): void {
    // Lay out in CSS pixels; the camera scales them up to the canvas density.
    this.cameras.main.setOrigin(0, 0).setZoom(dpr());
    this.buildHud();
    this.buildDock();
    if (openPanelKind) this.openPanel(openPanelKind, openPanelTarget, true);

    const unsubscribe = this.store.subscribe(() => {
      this.pruneTeam();
      this.refreshHud();
      this.buildInfo();
      this.buildTeamBar();
      this.panel?.view.render();
    });
    const timer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.refreshHud();
        this.panel?.view.tick();
        for (const update of this.infoTimers) update();
        const now = this.store.now();
        const collectable = this.store.state.village.buildings.filter((b) =>
          isReadyToCollect(this.store.state, b, now),
        ).length;
        if (collectable !== this.collectReady) this.buildInfo();
      },
    });

    const ev = this.game.events;
    const onSelect = (selection: Selection) => {
      this.selection = selection;
      this.buildInfo();
    };
    const onPlacement = (status: PlacementStatus) => {
      if (status.active && !this.placement.active) this.placeWorkers = null;
      this.placement = status;
      this.buildDock();
      this.buildInfo();
    };
    const onOpenPanel = (kind: PanelKind) => this.openPanel(kind);
    const onTeamToggle = (id: string) => this.toggleTeam(id);
    const onTeamSet = (ids: string[]) => this.setTeam(ids);
    ev.on(EVT.teamSet, onTeamSet);
    const onEnterSelect = () => this.setSelectMode(true);
    ev.on(EVT.enterSelect, onEnterSelect);
    ev.on(EVT.teamToggle, onTeamToggle);
    const onCollectFx = (fx: CollectFx) => this.flyToHud(fx);
    ev.on(EVT.collectFx, onCollectFx);
    const onToast = (req: ToastRequest) =>
      req.sound === undefined
        ? toast(this, req.message, req.color)
        : toast(this, req.message, req.color, req.sound);
    ev.on(EVT.select, onSelect);
    ev.on(EVT.placement, onPlacement);
    ev.on(EVT.toast, onToast);
    ev.on(EVT.openPanel, onOpenPanel);

    // window.* keeps the browser timer types (Node's are also visible to the compiler).
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        this.game.events.emit(EVT.deselect);
        this.scene.restart();
      }, 150);
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => {
      unsubscribe();
      timer.remove();
      window.clearTimeout(resizeTimer);
      this.scale.off('resize', onResize);
      ev.off(EVT.select, onSelect);
      ev.off(EVT.teamSet, onTeamSet);
      ev.off(EVT.enterSelect, onEnterSelect);
      ev.off(EVT.placement, onPlacement);
      ev.off(EVT.toast, onToast);
      ev.off(EVT.openPanel, onOpenPanel);
      ev.off(EVT.teamToggle, onTeamToggle);
      ev.off(EVT.collectFx, onCollectFx);
      this.panel?.view.destroy();
      this.panel = undefined;
    });

    this.pruneTeam();
    this.buildTeamBar();

    if (this.store.loadNotice && !this.shownLoadError) {
      this.shownLoadError = true;
      const restored = this.store.loadNotice === 'restored';
      toast(this, restored ? t('save.restored') : errorText('saveCorrupt'), COLORS.warn);
    }
  }

  // ---------- Earned resources flying to the HUD ----------

  private static readonly FLY_ICONS = {
    gold: icons.gold,
    food: icons.food,
    wood: icons.wood,
    stone: icons.stone,
    soulCrystal: icons.crystal,
    gems: icons.gem,
  } as const;

  private flyTexture(resource: CollectFx['resource']) {
    const key = `fx:icon-${resource}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({}, false);
      g.translateCanvas(16, 16);
      UIScene.FLY_ICONS[resource](g, 24);
      g.generateTexture(key, 32, 32);
      g.destroy();
    }
    return key;
  }

  /**
   * A few icons arc from where the resource was earned to its HUD pill; the pill holds
   * back the amount until they land, then counts up and pops (game-feel skill).
   */
  private flyToHud(fx: CollectFx) {
    const target = this.resourceIcons[fx.resource];
    const text = this.resourceTexts[fx.resource];
    if (!target || !text) return;
    const n = flyIconCount(fx.amount);
    if (n === 0) return;
    this.inFlight[fx.resource] = (this.inFlight[fx.resource] ?? 0) + fx.amount;
    this.refreshHud();
    playSfx(this, 'collect');
    // Coins clink as they land; goods land with a softer pop.
    const landSound = ['gold', 'gems', 'soulCrystal'].includes(fx.resource) ? 'coin' : 'pickup';
    let landed = 0;
    for (let i = 0; i < n; i++) {
      const icon = this.add
        .image(fx.x + (i - n / 2) * 10, fx.y, this.flyTexture(fx.resource))
        .setDepth(2000)
        .setScale(0.6);
      const sx = icon.x;
      const sy = icon.y;
      const state = { t: 0 };
      this.tweens.add({
        targets: state,
        t: 1,
        delay: i * 70,
        duration: 650,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          const p = arcPoint(sx, sy, target.x, target.y, 70, state.t);
          icon.setPosition(p.x, p.y).setScale(0.6 + 0.3 * Math.sin(state.t * Math.PI));
        },
        onComplete: () => {
          icon.destroy();
          this.popHud(target);
          playSfx(this, landSound);
          landed++;
          if (landed === n) this.landAmount(fx.resource, fx.amount);
        },
      });
    }
  }

  private popHud(target: Phaser.GameObjects.Graphics | Phaser.GameObjects.Container) {
    this.tweens.killTweensOf(target);
    target.setScale(1.35);
    this.tweens.add({ targets: target, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  /** The last icon landed: count the pill up to the real amount. */
  private landAmount(resource: CollectFx['resource'], amount: number) {
    const real = () => this.store.state.resources[resource];
    const from = real() - (this.inFlight[resource] ?? 0);
    this.inFlight[resource] = Math.max(0, (this.inFlight[resource] ?? 0) - amount);
    const to = real() - (this.inFlight[resource] ?? 0);
    const state = { t: 0 };
    this.tweens.add({
      targets: state,
      t: 1,
      duration: 380,
      onUpdate: () => {
        this.counting[resource] = countUp(from, to, state.t);
        this.refreshHud();
      },
      onComplete: () => {
        delete this.counting[resource];
        this.refreshHud();
      },
    });
  }

  // ---------- Team for wild fights ----------

  private teamBar?: Phaser.GameObjects.Container;

  /** Drops monsters that died, left, or got busy from the picked team. */
  private pruneTeam(): void {
    const s = this.store.state;
    const kept = team.filter(
      (id) =>
        (s.monsters.some((m) => m.id === id) || s.soldiers.some((x) => x.id === id)) &&
        !isMonsterBusy(s, id),
    );
    if (kept.length !== team.length) this.setTeam(kept);
  }

  private setTeam(ids: string[]): void {
    team = ids;
    this.game.events.emit(EVT.teamChanged, [...team]);
    this.buildTeamBar();
    this.buildInfo();
  }

  private toggleTeam(id: string): void {
    if (team.includes(id)) {
      this.setTeam(team.filter((x) => x !== id));
      return;
    }
    if (isMonsterBusy(this.store.state, id)) {
      toast(this, t('team.busy'));
      return;
    }
    if (team.length >= gameData.rules.skirmish.maxTeam) {
      toast(this, t('team.full', { max: gameData.rules.skirmish.maxTeam }));
      return;
    }
    this.setTeam([...team, id]);
  }

  /** "Tim: n monster" pill under the HUD while a team is being picked. */
  private buildTeamBar(): void {
    this.teamBar?.destroy();
    this.teamBar = undefined;
    // Panels show the team themselves; the pill would cover their title.
    if (team.length === 0 || this.panel) return;
    const L = this.layout;
    const x = 10;
    const y = L.hud.h + 8;
    const w = 210;
    const h = 34;
    const bar = this.add.container(0, 0).setDepth(DOCK_DEPTH);
    bar.add(roundedPanel(this, x, y, w, h, COLORS.panelDark, COLORS.gold, 12));
    bar.add(this.add.zone(x, y, w, h).setOrigin(0).setInteractive());
    bar.add(
      this.add
        .text(
          x + 12,
          y + h / 2,
          t('team.bar', { n: team.length }),
          textStyle(12, COLORS.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0, 0.5),
    );
    bar.add(
      new Button(this, x + w - 46, y + h / 2, {
        width: 80,
        height: 26,
        label: t('team.clear'),
        fontSize: 11,
        color: COLORS.panelLight,
        onClick: () => this.setTeam([]),
      }),
    );
    this.teamBar = bar;
  }

  /** Runs an action and shows its error; returns the result when it succeeded. */
  private run<T extends object>(action: (s: PlayerState, now: number) => ActionResult<T>) {
    const result = this.store.apply(action);
    if (!result.ok) {
      toast(this, errorText(result.error));
      return null;
    }
    return result;
  }

  // ---------- HUD ----------

  private buildHud(): void {
    const L = this.layout;
    const { hud: r } = L;
    const hud = this.add.container(0, 0).setDepth(100);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.panelDark, 0.92).fillRect(r.x, r.y, r.w, r.h);
    bg.lineStyle(2, COLORS.stroke, 1).lineBetween(r.x, r.y + r.h, r.x + r.w, r.y + r.h);
    hud.add([bg, this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive()]);

    // Landscape: one row (resources left, status + full screen right).
    // Portrait: resources on the first row, status on the second.
    const fsSize = canFullscreen() ? 34 : 0;
    // Sound on/off sits left of full screen (or alone at the right edge).
    const soundSize = 34;
    const tools = fsSize + soundSize + (fsSize ? 6 : 0);
    const pillH = 28;
    const pillY = L.landscape ? (r.h - pillH) / 2 : 8;
    const inner = Math.min(r.w, 960);
    const left = (r.w - inner) / 2 + 8;
    const gap = 6;
    // Landscape: all six resources in one row; portrait: two rows of three.
    const cols = L.landscape ? 6 : 3;
    const rowW = L.landscape ? Math.min(inner - 210, 660) - tools : inner - 16 - (tools + gap);
    const pillW = (rowW - gap * (cols - 1)) / cols;
    const resources = [
      ['gold', icons.gold, 'gold', COLORS.gold],
      ['food', icons.food, 'food', COLORS.food],
      ['wood', icons.wood, 'wood', COLORS.wood],
      ['stone', icons.stone, 'stone', COLORS.stone],
      ['soulCrystal', icons.crystal, 'crystal', COLORS.crystal],
      ['gems', icons.gem, 'gem', COLORS.gem],
    ] as const;
    resources.forEach(([key, icon, frame, color], i) => {
      const x = left + (i % cols) * (pillW + gap);
      const y = pillY + Math.floor(i / cols) * (pillH + 6);
      const pill = this.add.graphics();
      pill.fillStyle(COLORS.panel, 1).fillRoundedRect(x, y, pillW, pillH, 14);
      pill.lineStyle(1.5, color, 0.6).strokeRoundedRect(x, y, pillW, pillH, 14);
      // Painted icon from the ui atlas when there is one; code-drawn otherwise.
      const ic = this.textures.get('ui').has(`icon-${frame}`)
        ? this.add.container(x + 14, y + pillH / 2, [
            this.add.image(0, 0, 'ui', `icon-${frame}`).setDisplaySize(22, 22),
          ])
        : this.add.graphics({ x: x + 14, y: y + pillH / 2 });
      if (ic instanceof Phaser.GameObjects.Graphics) icon(ic, 15);
      const text = this.add
        .text(x + 26, y + pillH / 2, '0', textStyle(13, COLORS.text, { fontStyle: 'bold' }))
        .setOrigin(0, 0.5);
      this.resourceTexts[key] = text;
      this.resourceIcons[key] = ic;
      this.resourceMaxWidth = pillW - 32;
      hud.add([pill, ic, text]);
    });

    const right = (r.w + inner) / 2 - 8;
    if (fsSize) {
      const fsButton = new Button(this, right - fsSize / 2, pillY + pillH / 2, {
        width: fsSize,
        height: pillH + 2,
        label: '',
        color: COLORS.panelLight,
        icon: isFullscreen() ? icons.exitFullscreen : icons.fullscreen,
        onClick: () => toggleFullscreen(),
      });
      hud.add(fsButton);
    }
    const soundButton = new Button(
      this,
      right - (fsSize ? fsSize + gap : 0) - soundSize / 2,
      pillY + pillH / 2,
      {
        width: soundSize,
        height: pillH + 2,
        label: '',
        color: COLORS.panelLight,
        icon: isSoundOn() ? icons.soundOn : icons.soundOff,
        onClick: () => {
          setSoundOn(this.game, !isSoundOn());
          // Rebuilds the HUD so the icon shows the new state.
          this.scene.restart();
        },
      },
    );
    hud.add(soundButton);
    if (L.landscape) {
      const statusLeft = left + rowW + gap * 2;
      const statusRight = right - tools - gap;
      this.statusText = this.add
        .text(
          statusRight,
          r.h / 2,
          '',
          textStyle(11, COLORS.textDim, { fontStyle: 'bold', align: 'right' }),
        )
        .setOrigin(1, 0.5);
      this.statusMaxWidth = Math.max(60, statusRight - statusLeft);
    } else {
      this.statusText = this.add
        .text(r.w / 2, r.h - 14, '', textStyle(12, COLORS.textDim, { fontStyle: 'bold' }))
        .setOrigin(0.5);
      this.statusMaxWidth = r.w - 16;
    }
    hud.add(this.statusText);
    this.refreshHud();
  }

  private refreshHud(): void {
    const { state } = this.store;
    for (const [key, text] of Object.entries(this.resourceTexts)) {
      const k = key as CollectFx['resource'];
      const shown = this.counting[k] ?? state.resources[k] - (this.inFlight[k] ?? 0);
      text.setText(formatNumber(Math.max(0, shown)));
      // Big numbers shrink to stay inside their pill.
      text.setScale(1);
      if (text.width > this.resourceMaxWidth) text.setScale(this.resourceMaxWidth / text.width);
    }
    this.statusText?.setText(
      t('hud.status', {
        level: townHallLevel(state),
        idle: idleWorkers(state).length,
        workers: state.workers.length,
        used: populationUsed(state),
        cap: populationCap(state),
      }),
    );
    // Shrink the status line rather than let it run under the resource pills.
    const text = this.statusText;
    if (text) {
      text.setScale(1);
      if (text.width > this.statusMaxWidth) text.setScale(this.statusMaxWidth / text.width);
    }
  }

  // ---------- Bottom bar ----------

  /**
   * Floating tab bar at the bottom-left of the game: a toggle to hide/show it,
   * then the tabs side by side. During placement it becomes the place/cancel bar.
   */
  private buildDock(animate = false): void {
    this.dockLayer?.destroy();
    const L = this.layout;
    const d = L.dock;
    const layer = this.add.container(0, 0).setDepth(DOCK_DEPTH);
    this.dockLayer = layer;
    if (this.placement.active) {
      this.buildPlacementControls(layer, L);
      return;
    }
    const toggle = new Button(this, d.x + d.toggleW / 2, d.y + d.buttonH / 2, {
      width: d.toggleW,
      height: d.buttonH,
      label: '',
      color: COLORS.panelDark,
      icon: dockVisible ? icons.chevronLeft : icons.chevronRight,
      onClick: () => {
        rememberDock(!dockVisible);
        this.buildDock(true);
        this.buildInfo();
        this.layoutPanel();
      },
    });
    layer.add(toggle);
    this.buildSelectDock(layer, L);
    if (!dockVisible) return;
    DOCK_TABS.forEach((kind, i) => {
      const x = d.x + d.toggleW + d.gap + i * (d.buttonW + d.gap);
      const active = this.panel?.kind === kind;
      const button = new Button(this, x + d.buttonW / 2, d.y + d.buttonH / 2, {
        width: d.buttonW,
        height: d.buttonH,
        label: t(`nav.${kind}`),
        fontSize: 13,
        color: active ? COLORS.accent : kind === 'build' ? 0x3c9a5f : COLORS.panel,
        onClick: () => (this.panel?.kind === kind ? this.closePanel() : this.openPanel(kind)),
      });
      layer.add(button);
      if (animate) {
        // Slide in from the toggle when the bar is shown again.
        const x0 = button.x;
        button.setAlpha(0).setX(x0 - 12);
        this.tweens.add({ targets: button, alpha: 1, x: x0, duration: 140, delay: i * 30 });
      }
    });
  }

  /**
   * Right-hand dock (Tugas 1A.15): "Pilih" switches Pilih mode on; then it opens upwards with
   * Menjauh (fall back to the Kandang) and Kosongkan (clear the pick), and Pilih turns
   * into ✕ to go back to normal play.
   */
  private buildSelectDock(layer: Phaser.GameObjects.Container, L: UILayout) {
    const d = L.dock;
    const x = L.width - d.x - d.buttonW / 2;
    const y = d.y + d.buttonH / 2;
    const button = (row: number, label: string, color: number, onClick: () => void) =>
      layer.add(
        new Button(this, x, y - row * (d.buttonH + d.gap), {
          width: d.buttonW,
          height: d.buttonH,
          label,
          fontSize: 13,
          color,
          onClick,
        }),
      );
    if (!selectMode) {
      button(0, t('nav.select'), COLORS.panel, () => this.setSelectMode(true));
      return;
    }
    button(0, '✕', COLORS.danger, () => this.setSelectMode(false));
    button(1, t('select.clear'), COLORS.panelLight, () => this.setTeam([]));
    button(2, t('select.retreat'), COLORS.accentDark, () => {
      if (team.length === 0) toast(this, t('select.none'));
      else this.game.events.emit(EVT.retreat, [...team]);
    });
  }

  private setSelectMode(on: boolean): void {
    if (selectMode === on) return;
    selectMode = on;
    this.game.events.emit(EVT.selectMode, on);
    if (on) toast(this, t('select.hint'), COLORS.accent);
    else this.setTeam([]);
    this.buildDock();
  }

  /** Floating "place / cancel" bar shown while placing or moving a building. */
  private buildPlacementControls(layer: Phaser.GameObjects.Container, L: UILayout) {
    const def = this.placement.type ? gameData.buildingById.get(this.placement.type) : undefined;
    const first = def?.levels[0];
    const line = this.placement.line;
    const hint = this.placement.moving
      ? t('place.moveHint')
      : line && def
        ? line.started
          ? t('place.lineCost', {
              name: def.name,
              count: line.count,
              cost: costLabel(line.cost),
            })
          : t('place.lineStart', { name: def.name })
        : first
          ? t('place.cost', { name: def.name, cost: costLabel(first.cost) })
          : '';
    const w = Math.min(L.width - 20, 520);
    const h = L.dock.buttonH + 16;
    const x = (L.width - w) / 2;
    const y = L.height - 10 - h;
    // Timed constructions: choose how many workers build it (more = faster).
    let workers: number | undefined;
    if (def && first && first.seconds > 0 && !this.placement.moving && !line) {
      const avail = Math.min(idleWorkers(this.store.state).length, maxConstructionWorkers(def.id));
      const sw = 230;
      if (avail === 0) {
        layer.add(roundedPanel(this, x, y - 40, sw, 32, COLORS.panelDark, COLORS.warn, 14));
        layer.add(
          this.add
            .text(x + sw / 2, y - 24, t('place.noWorkers'), textStyle(12, COLORS.warn))
            .setOrigin(0.5),
        );
      } else {
        workers = Phaser.Math.Clamp(this.placeWorkers ?? avail, 1, avail);
        layer.add(
          stepper(this, x + sw / 2, y - 22, {
            width: sw,
            label: t('place.workers', {
              n: workers,
              max: avail,
              time: formatDuration(constructionTime(first.seconds, workers)),
            }),
            value: workers,
            min: 1,
            max: avail,
            onChange: (n) => {
              this.placeWorkers = n;
              this.buildDock();
            },
          }),
        );
      }
    }
    layer.add(roundedPanel(this, x, y, w, h, COLORS.panelDark, COLORS.accent, 14));
    layer.add(this.add.zone(x, y, w, h).setOrigin(0).setInteractive());
    const bw = 96;
    layer.add(
      this.add
        .text(
          x + 12,
          y + h / 2,
          hint,
          textStyle(11, COLORS.text, { wordWrap: { width: w - bw * 2 - 40 } }),
        )
        .setOrigin(0, 0.5),
    );
    layer.add(
      new Button(this, x + w - bw * 1.5 - 14, y + h / 2, {
        width: bw,
        height: L.dock.buttonH,
        label: t('place.cancel'),
        color: COLORS.danger,
        onClick: () => this.game.events.emit(EVT.cancelPlacement),
      }),
    );
    layer.add(
      new Button(this, x + w - bw / 2 - 8, y + h / 2, {
        width: bw,
        height: L.dock.buttonH,
        label: t('place.confirm'),
        color: COLORS.good,
        disabled: !this.placement.valid,
        onClick: () => this.game.events.emit(EVT.confirmPlacement, { workers }),
      }),
    );
  }

  // ---------- Panels ----------

  /** `quiet`: reopening after a restart (resize, sound toggle) plays no sound. */
  openPanel(kind: PanelKind, targetId?: string, quiet = false): void {
    if (!quiet) playSfx(this, 'panel');
    this.closePanel(false);
    this.game.events.emit(EVT.deselect);
    if (this.placement.active) this.game.events.emit(EVT.cancelPlacement);
    openPanelKind = kind;
    openPanelTarget = targetId;
    const L = this.layout;
    const { play } = L;
    const top = play.y;
    const bottom = contentBottom(L, dockVisible);
    const layer = this.add.container(0, 0).setDepth(PANEL_DEPTH);
    const dim = this.add
      .rectangle(play.x, top, play.w, play.h, 0x07050f, 0.55)
      .setOrigin(0)
      .setInteractive();
    const sheetW = Math.min(play.w - 12, 980);
    const sheetX = play.x + (play.w - sheetW) / 2;
    const sheet = roundedPanel(
      this,
      sheetX,
      top + 6,
      sheetW,
      bottom - top - 12,
      COLORS.background,
      COLORS.stroke,
      16,
    );
    const title = this.add
      .text(
        sheetX + 16,
        top + 24,
        t(`panel.${kind}`),
        textStyle(17, COLORS.text, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);
    const close = new Button(this, sheetX + sheetW - 26, top + 24, {
      width: 36,
      height: 32,
      label: 'X',
      color: COLORS.panelLight,
      onClick: () => this.closePanel(),
    });
    layer.add([dim, sheet, title, close]);
    const rect = new Phaser.Geom.Rectangle(sheetX + 2, top + 44, sheetW - 4, bottom - top - 54);
    const ctx: ViewContext = {
      scene: this,
      store: this.store,
      rect,
      dev: this.dev,
      depth: PANEL_DEPTH + 1,
      targetId,
      team: {
        ids: () => [...team],
        toggle: (id) => this.toggleTeam(id),
        clear: () => this.setTeam([]),
      },
      close: () => this.closePanel(),
    };
    const views: Record<PanelKind, () => View> = {
      build: () =>
        new BuildMenuView(ctx, (type) => {
          this.closePanel();
          this.game.events.emit(EVT.startPlacement, { type });
        }),
      collection: () => new CollectionView(ctx),
      barracks: () => new BarracksView(ctx),
      team: () => new TeamView(ctx),
      graveyard: () => new GraveyardView(ctx),
      mixer: () => new MixerView(ctx),
      pedia: () => new PediaView(ctx),
    };
    const view = views[kind]();
    view.render();
    this.panel = { kind, targetId, view, layer };
    this.buildTeamBar();
    this.buildInfo();
    this.buildDock();
  }

  /** Re-open the current panel so it fits the space left by the tab bar. */
  private layoutPanel(): void {
    if (this.panel) this.openPanel(this.panel.kind, this.panel.targetId);
  }

  closePanel(rebuildNav = true): void {
    if (!this.panel) return;
    this.panel.view.destroy();
    this.panel.layer.destroy();
    this.panel = undefined;
    openPanelKind = null;
    if (rebuildNav) {
      this.buildDock();
      this.buildInfo();
      this.buildTeamBar();
    }
  }

  // ---------- Selection info card ----------

  private buildInfo(): void {
    this.info?.destroy();
    this.info = undefined;
    this.infoTimers = [];
    if (!this.selection || this.panel || this.placement.active) {
      this.buildCollectAll();
      return;
    }
    const content = infoContent(this.store.state, this.selection, {
      now: () => this.store.now(),
      run: (action) => this.run(action),
      openPanel: (kind, targetId) => this.openPanel(kind, targetId),
      openBattles: (source) => {
        this.closePanel();
        this.scene.launch('serbu', { source });
      },
      toast: (message, color, sound) =>
        sound === undefined ? toast(this, message, color) : toast(this, message, color, sound),
      deselect: () => this.game.events.emit(EVT.deselect),
      startMove: (id, group) => this.game.events.emit(EVT.startPlacement, { moveId: id, group }),
      confirm: (message, onYes) => this.confirm(message, onYes),
      team: () => [...team],
      clearTeam: () => this.setTeam([]),
      workerCount: (key, fallback) => this.cardWorkers.get(key) ?? fallback,
      setWorkerCount: (key, n) => {
        this.cardWorkers.set(key, n);
        this.buildInfo();
      },
    });
    this.buildCollectAll();
    if (!content) return;

    const L = this.layout;
    const { play } = L;
    // The card is built at the origin and moved above the selected thing every frame
    // (positionInfo); when that is off screen it falls back to the bottom-right corner.
    const cardW = L.landscape
      ? Math.min(340, Math.max(280, play.w * 0.45))
      : Math.min(play.w - 16, 560);
    const x = 0;
    const { buttons } = content;
    const perRow = cardW < 420 ? 2 : 3;
    const rows = Math.ceil(buttons.length / perRow);
    const textW = cardW - 112;
    const body = this.add.text(
      x + 96,
      0,
      content.lines.join('\n'),
      textStyle(11, COLORS.textDim, { wordWrap: { width: textW } }),
    );
    const status = this.add.text(
      x + 96,
      0,
      content.status?.() ?? '',
      textStyle(12, COLORS.warn, { fontStyle: 'bold', wordWrap: { width: textW } }),
    );
    const headH = Math.max(86, 40 + body.height + status.height);
    const stepH = content.workers ? 40 : 0;
    const cardH = headH + stepH + rows * 42 + 10;
    const y = 0;
    this.infoHome = {
      x: L.landscape ? play.x + play.w - cardW - 8 : play.x + (play.w - cardW) / 2,
      y: Math.max(play.y + 8, contentBottom(L, dockVisible) - cardH),
      w: cardW,
      h: cardH,
    };
    const layer = this.add.container(0, 0).setDepth(150);
    const bg = roundedPanel(this, x, y, cardW, cardH, COLORS.panel, COLORS.accent, 14);
    const blocker = this.add.zone(x, y, cardW, cardH).setOrigin(0).setInteractive();
    layer.add([bg, blocker]);
    const art = buildingIcon(this, content.iconType, content.iconLevel);
    const img = this.add.image(x + 46, y + 46, art.key, art.frame);
    img.setScale(Math.min(80 / img.width, 76 / img.height, 1 / BUILDING_RES));
    layer.add(img);
    layer.add(
      this.add.text(
        x + 96,
        y + 10,
        content.title,
        textStyle(15, COLORS.text, { fontStyle: 'bold' }),
      ),
    );
    body.setY(y + 32);
    status.setY(y + 34 + body.height + 2);
    layer.add([body, status]);
    const update = content.status;
    if (update) this.infoTimers.push(() => status.setText(update()));
    layer.add(
      new Button(this, x + cardW - 20, y + 18, {
        width: 30,
        height: 26,
        label: 'X',
        fontSize: 12,
        color: COLORS.panelLight,
        onClick: () => this.game.events.emit(EVT.deselect),
      }),
    );
    const choice = content.workers;
    if (choice) {
      layer.add(
        stepper(this, x + cardW / 2, y + headH + 16, {
          width: Math.min(cardW - 20, 260),
          label: choice.label,
          value: choice.value,
          min: choice.min,
          max: choice.max,
          onChange: choice.set,
        }),
      );
    }
    const bw = (cardW - 20 - (perRow - 1) * 8) / perRow;
    buttons.forEach((btn, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      layer.add(
        new Button(this, x + 10 + col * (bw + 8) + bw / 2, y + headH + stepH + row * 42 + 18, {
          width: bw,
          height: 36,
          label: btn.label,
          fontSize: 12,
          color: btn.color ?? COLORS.accent,
          disabled: btn.disabled ?? false,
          onClick: btn.onClick,
        }),
      );
    });
    this.info = layer;
    this.positionInfo();
  }

  override update(): void {
    this.positionInfo();
  }

  /** Keeps the info card just above the selected thing, inside the play area. */
  private positionInfo(): void {
    const home = this.infoHome;
    if (!this.info || !home) return;
    const { play } = this.layout;
    const bottom = contentBottom(this.layout, dockVisible);
    const anchor = (this.scene.get('village') as VillageScene).selectionAnchor();
    const onScreen =
      anchor &&
      anchor.x > play.x &&
      anchor.x < play.x + play.w &&
      anchor.bottom > play.y &&
      anchor.top < bottom;
    if (!onScreen) {
      this.info.setPosition(home.x, home.y);
      return;
    }
    const gap = 10;
    const x = Phaser.Math.Clamp(anchor.x - home.w / 2, play.x + 8, play.x + play.w - home.w - 8);
    // Above the thing when there is room, else below it, else as close as fits.
    const above = anchor.top - gap - home.h;
    const below = anchor.bottom + gap;
    const y =
      above >= play.y + 8
        ? above
        : below + home.h <= bottom
          ? below
          : Phaser.Math.Clamp(above, play.y + 8, bottom - home.h);
    this.info.setPosition(x, y);
  }

  /** Floating "collect everything" button, shown when several buildings are ready. */
  private buildCollectAll(): void {
    this.collectAllButton?.destroy();
    this.collectAllButton = undefined;
    if (this.panel || this.placement.active || this.selection) return;
    const now = this.store.now();
    const state = this.store.state;
    const ready = state.village.buildings.filter((b) => isReadyToCollect(state, b, now));
    this.collectReady = ready.length;
    if (ready.length < 2) return;
    const L = this.layout;
    this.collectAllButton = new Button(
      this,
      L.width - 92 - L.dock.buttonW - L.dock.gap,
      L.dock.y + L.dock.buttonH / 2,
      {
        width: 168,
        height: L.dock.buttonH,
        label: t('village.collectAll', { count: ready.length }),
        fontSize: 13,
        color: 0x3c9a5f,
        icon: icons.gold,
        onClick: () => {
          const r = this.run((s, n) => collectAll(s, n));
          if (!r) return;
          toast(this, `+${costLabel(r)}`, COLORS.good);
          const from = { x: L.width - 92 - L.dock.buttonW - L.dock.gap, y: L.dock.y };
          for (const resource of ['gold', 'food', 'wood', 'stone'] as const) {
            if (r[resource] > 0) this.flyToHud({ resource, amount: r[resource], ...from });
          }
        },
      },
    ).setDepth(140);
  }

  /** Small yes/no dialog for destructive actions. */
  private confirm(message: string, onYes: () => void): void {
    confirmDialog(this, message, onYes);
  }
}
