import Phaser from 'phaser';
import { cssSize, dpr } from './dpr';
import { contentBottom, uiLayout } from './layout';
import { COLORS, hex, textStyle } from './theme';
import { t } from '../text';
import { playSfx } from '../audio/sound';
import type { SoundId } from '../audio/synth';

/** Shared tap-vs-drag flag: set by scroll areas once a drag passes the threshold. */
export const pointerState = { dragMoved: false };

const modalCounts = new WeakMap<Phaser.Scene, number>();
export const openModalCount = (scene: Phaser.Scene) => modalCounts.get(scene) ?? 0;

/**
 * Runs a click handler after the current input event finishes, so handlers may
 * freely destroy and rebuild the objects (including the button) under the pointer.
 */
export function deferClick(scene: Phaser.Scene, onClick: () => void): void {
  scene.time.delayedCall(0, onClick);
}

export function lighten(color: number, amount: number): number {
  const c = Phaser.Display.Color.ValueToColor(color);
  return Phaser.Display.Color.GetColor(
    c.red + (255 - c.red) * amount,
    c.green + (255 - c.green) * amount,
    c.blue + (255 - c.blue) * amount,
  );
}

export function darken(color: number, amount: number): number {
  const c = Phaser.Display.Color.ValueToColor(color);
  const k = 1 - amount;
  return Phaser.Display.Color.GetColor(c.red * k, c.green * k, c.blue * k);
}

export function roundedPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = COLORS.panel,
  stroke: number | null = COLORS.stroke,
  radius = 12,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(fill, 1);
  g.fillRoundedRect(0, 0, w, h, radius);
  if (stroke !== null) {
    g.lineStyle(1.5, stroke, 1);
    g.strokeRoundedRect(0, 0, w, h, radius);
  }
  return g;
}

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  color?: number;
  fontSize?: number;
  disabled?: boolean;
  /** Optional small icon drawn left of the label. */
  icon?: (g: Phaser.GameObjects.Graphics, size: number) => void;
}

/** Rounded button; x/y is its center. Fires on release if the pointer did not drag. */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private disabled = false;
  private icon?: Phaser.GameObjects.Graphics;
  private iconSize = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly opts: ButtonOptions,
  ) {
    super(scene, x, y);
    const { width: w, height: h } = opts;
    this.bg = scene.add.graphics();
    this.labelText = scene.add
      .text(0, 0, opts.label, textStyle(opts.fontSize ?? 14, COLORS.text, { fontStyle: 'bold' }))
      .setOrigin(0.5);
    this.add([this.bg, this.labelText]);
    if (opts.icon) {
      this.iconSize = Math.min(16, h * 0.5);
      this.icon = scene.add.graphics();
      opts.icon(this.icon, this.iconSize);
      this.add(this.icon);
    }
    this.layoutLabel();
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.disabled) this.setScale(0.96);
    });
    this.on('pointerout', () => this.setScale(1));
    this.on('pointerup', () => {
      this.setScale(1);
      if (!this.disabled && !pointerState.dragMoved) {
        playSfx(this.scene, 'click');
        deferClick(this.scene, this.opts.onClick);
      }
    });
    this.setDisabled(opts.disabled ?? false);
    scene.add.existing(this);
  }

  /** Shrinks the label to fit and centers icon + label together. */
  private layoutLabel() {
    // Icon-only buttons: no gap and no label to shrink.
    const hasLabel = this.labelText.text.length > 0;
    const iconSpace = this.icon ? this.iconSize + (hasLabel ? 6 : 0) : 0;
    const max = Math.max(1, this.opts.width - 14 - iconSpace);
    this.labelText.setScale(1).setWordWrapWidth(null);
    if (hasLabel && this.labelText.width > max) {
      // Long labels (costs) wrap onto a second line first, and only then shrink.
      this.labelText.setAlign('center').setWordWrapWidth(max, true);
      const fit = Math.min(
        1,
        max / this.labelText.width,
        (this.opts.height - 4) / this.labelText.height,
      );
      this.labelText.setScale(fit);
    }
    const labelW = this.labelText.displayWidth;
    const total = iconSpace + labelW;
    this.icon?.setPosition(-total / 2 + this.iconSize / 2, 0);
    this.labelText.setX(-total / 2 + iconSpace + labelW / 2);
  }

  private draw() {
    const { width: w, height: h } = this.opts;
    const base = this.disabled ? COLORS.disabled : (this.opts.color ?? COLORS.accent);
    this.bg.clear();
    this.bg.fillStyle(darken(base, 0.35), 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, Math.min(12, h / 2));
    this.bg.fillStyle(base, 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(12, h / 2));
    this.bg.fillStyle(lighten(base, 0.25), 0.5);
    this.bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.35, Math.min(8, h / 4));
    this.labelText.setColor(hex(this.disabled ? COLORS.textDim : COLORS.text));
  }

  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    this.draw();
    return this;
  }

  setLabel(label: string): this {
    if (label === this.labelText.text) return this;
    this.labelText.setText(label);
    this.layoutLabel();
    return this;
  }
}

/** Vertically scrolling, masked region with drag, wheel and inertia. */
export class ScrollArea {
  readonly content: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly layer: number;
  private scrollY = 0;
  private contentHeight = 0;
  private dragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private lastY = 0;
  private velocity = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly rect: Phaser.Geom.Rectangle,
    depth = 0,
  ) {
    this.layer = openModalCount(scene);
    this.content = scene.add.container(rect.x, rect.y).setDepth(depth);
    this.maskShape = scene.make.graphics({}, false);
    this.maskShape.fillStyle(0xffffff).fillRect(rect.x, rect.y, rect.width, rect.height);
    this.content.setMask(this.maskShape.createGeometryMask());
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('wheel', this.onWheel, this);
    scene.events.on('update', this.onUpdate, this);
  }

  get scroll(): number {
    return this.scrollY;
  }

  private get maxScroll(): number {
    return Math.max(0, this.contentHeight - this.rect.height);
  }

  private active(pointer: Phaser.Input.Pointer): boolean {
    return (
      openModalCount(this.scene) === this.layer &&
      this.rect.contains(pointer.x / dpr(), pointer.y / dpr())
    );
  }

  setContentHeight(h: number): void {
    this.contentHeight = h;
    this.scrollTo(this.scrollY);
  }

  scrollTo(y: number): void {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScroll);
    this.content.y = this.rect.y - this.scrollY;
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    pointerState.dragMoved = false;
    if (!this.active(pointer)) return;
    this.dragging = true;
    this.velocity = 0;
    this.dragStartY = this.lastY = pointer.y / dpr();
    this.dragStartScroll = this.scrollY;
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (!this.dragging || !pointer.isDown) return;
    const y = pointer.y / dpr();
    if (Math.abs(y - this.dragStartY) > 8) pointerState.dragMoved = true;
    if (!pointerState.dragMoved) return;
    this.velocity = this.lastY - y;
    this.lastY = y;
    this.scrollTo(this.dragStartScroll + (this.dragStartY - y));
  }

  private onUp() {
    this.dragging = false;
  }

  private onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) {
    if (!this.active(pointer)) return;
    this.velocity = 0;
    this.scrollTo(this.scrollY + dy * 0.6);
  }

  private onUpdate() {
    if (this.dragging || Math.abs(this.velocity) < 0.3) return;
    this.scrollTo(this.scrollY + this.velocity);
    this.velocity *= 0.92;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('wheel', this.onWheel, this);
    this.scene.events.off('update', this.onUpdate, this);
    this.content.destroy();
    this.maskShape.destroy();
  }
}

export interface ModalOptions {
  width: number;
  height: number;
  title?: string;
  /** Close when tapping the dimmed background. */
  dismissible?: boolean;
  onClose?: () => void;
}

/** Centered dialog over a dimmed, input-blocking overlay. */
export class Modal {
  readonly panel: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y: number;
  /** Below 1 when the dialog was shrunk to fit a short (landscape phone) screen. */
  readonly fit: number;
  readonly depth: number;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly owned: { destroy(): void }[] = [];
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: ModalOptions,
  ) {
    const count = openModalCount(scene) + 1;
    modalCounts.set(scene, count);
    this.depth = 1000 + count * 20;
    const { width, height } = scene.scale;
    this.overlay = scene.add
      .rectangle(0, 0, width, height, 0x07050f, 0.75)
      .setOrigin(0)
      .setDepth(this.depth)
      .setInteractive();
    this.overlay.on('pointerup', () => {
      if (opts.dismissible && !pointerState.dragMoved) deferClick(scene, () => this.close());
    });
    this.fit = Math.min(1, (height - 16) / opts.height, (width - 16) / opts.width);
    this.x = Math.round((width - opts.width * this.fit) / 2);
    this.y = Math.round((height - opts.height * this.fit) / 2);
    this.panel = scene.add.container(this.x, this.y).setDepth(this.depth + 1);
    const bg = roundedPanel(scene, 0, 0, opts.width, opts.height, COLORS.panel, COLORS.accent, 16);
    // Swallow taps on the panel so they do not reach the overlay.
    const blocker = scene.add.zone(0, 0, opts.width, opts.height).setOrigin(0).setInteractive();
    this.panel.add([bg, blocker]);
    if (opts.title) {
      this.panel.add(
        scene.add
          .text(opts.width / 2, 22, opts.title, textStyle(18, COLORS.text, { fontStyle: 'bold' }))
          .setOrigin(0.5),
      );
    }
    this.panel.setScale(this.fit).setAlpha(0);
    scene.tweens.add({
      targets: this.panel,
      scale: { from: this.fit * 0.94, to: this.fit },
      alpha: 1,
      duration: 160,
      ease: 'Back.easeOut',
    });
  }

  /** Destroy `obj` together with the modal (for top-level objects such as scroll areas). */
  own<T extends { destroy(): void }>(obj: T): T {
    this.owned.push(obj);
    return obj;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    modalCounts.set(this.scene, Math.max(0, openModalCount(this.scene) - 1));
    for (const obj of this.owned) obj.destroy();
    this.overlay.destroy();
    this.panel.destroy();
    this.opts.onClose?.();
  }
}

/**
 * Short message above the dock. Red (error) toasts buzz unless `sound` says otherwise;
 * pass null when the action already played its own sound. `lift` raises it (px) so it
 * can sit above another toast from the same action.
 */
export function toast(
  scene: Phaser.Scene,
  message: string,
  color: number = COLORS.danger,
  sound: SoundId | null = color === COLORS.danger ? 'error' : null,
  lift = 0,
): void {
  if (sound) playSfx(scene, sound);
  const { width, height } = cssSize(scene);
  const layout = uiLayout(width, height);
  const { play } = layout;
  const baseY = contentBottom(layout, true) - 20 - lift;
  const text = scene.add
    .text(
      0,
      0,
      message,
      textStyle(14, COLORS.text, {
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: width - 64 },
      }),
    )
    .setOrigin(0.5);
  const w = text.width + 28;
  const h = text.height + 16;
  const bg = scene.add.graphics();
  bg.fillStyle(darken(color, 0.55), 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  bg.lineStyle(2, color).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  const box = scene.add
    .container(play.x + play.w / 2, baseY, [bg, text])
    .setDepth(5000)
    .setAlpha(0);
  scene.tweens.add({
    targets: box,
    alpha: 1,
    y: baseY - 10,
    duration: 180,
    yoyo: true,
    hold: 1800,
    onComplete: () => box.destroy(),
  });
}

/** Speaker body for the sound on/off icons (left half of the icon box). */
function speaker(g: Phaser.GameObjects.Graphics, s: number) {
  g.fillStyle(COLORS.text, 1).fillPoints(
    [
      { x: -s * 0.48, y: -s * 0.14 },
      { x: -s * 0.26, y: -s * 0.14 },
      { x: -s * 0.02, y: -s * 0.38 },
      { x: -s * 0.02, y: s * 0.38 },
      { x: -s * 0.26, y: s * 0.14 },
      { x: -s * 0.48, y: s * 0.14 },
    ],
    true,
  );
}

/** Small resource icons drawn with code. */
export const icons = {
  wood(g: Phaser.GameObjects.Graphics, s: number) {
    const h = s / 2;
    g.fillStyle(darken(COLORS.wood, 0.25)).fillRoundedRect(-h, -h * 0.45, s, h * 0.9, h * 0.4);
    g.fillStyle(COLORS.wood).fillRoundedRect(-h, -h * 0.55, s * 0.92, h * 0.8, h * 0.4);
    g.fillStyle(0xf1d29b).fillEllipse(h * 0.55, -h * 0.15, h * 0.7, h * 0.8);
    g.lineStyle(1, darken(COLORS.wood, 0.4)).strokeEllipse(h * 0.55, -h * 0.15, h * 0.4, h * 0.45);
  },
  stone(g: Phaser.GameObjects.Graphics, s: number) {
    const h = s / 2;
    g.fillStyle(darken(COLORS.stone, 0.3)).fillPoints(
      [
        { x: -h, y: h * 0.5 },
        { x: -h * 0.6, y: -h * 0.4 },
        { x: h * 0.1, y: -h * 0.8 },
        { x: h * 0.9, y: -h * 0.2 },
        { x: h, y: h * 0.5 },
      ],
      true,
    );
    g.fillStyle(COLORS.stone).fillPoints(
      [
        { x: -h * 0.6, y: -h * 0.4 },
        { x: h * 0.1, y: -h * 0.8 },
        { x: h * 0.9, y: -h * 0.2 },
        { x: h * 0.2, y: h * 0.1 },
      ],
      true,
    );
  },
  chevronLeft(g: Phaser.GameObjects.Graphics, s: number) {
    g.lineStyle(3, COLORS.text, 1);
    g.beginPath();
    g.moveTo(s * 0.15, -s * 0.35);
    g.lineTo(-s * 0.2, 0);
    g.lineTo(s * 0.15, s * 0.35);
    g.strokePath();
  },
  chevronRight(g: Phaser.GameObjects.Graphics, s: number) {
    g.lineStyle(3, COLORS.text, 1);
    g.beginPath();
    g.moveTo(-s * 0.15, -s * 0.35);
    g.lineTo(s * 0.2, 0);
    g.lineTo(-s * 0.15, s * 0.35);
    g.strokePath();
  },
  fullscreen(g: Phaser.GameObjects.Graphics, s: number) {
    const h = s / 2;
    const k = s * 0.32;
    g.lineStyle(2.5, COLORS.text, 1);
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      g.beginPath();
      g.moveTo(x * h, y * (h - k));
      g.lineTo(x * h, y * h);
      g.lineTo(x * (h - k), y * h);
      g.strokePath();
    }
  },
  soundOn(g: Phaser.GameObjects.Graphics, s: number) {
    speaker(g, s);
    g.lineStyle(2, COLORS.text, 1);
    for (const r of [0.28, 0.46]) {
      g.beginPath();
      g.arc(s * 0.02, 0, s * r, -0.8, 0.8);
      g.strokePath();
    }
  },
  soundOff(g: Phaser.GameObjects.Graphics, s: number) {
    speaker(g, s);
    g.lineStyle(2.2, COLORS.danger, 1);
    g.lineBetween(s * 0.12, -s * 0.2, s * 0.48, s * 0.2);
    g.lineBetween(s * 0.12, s * 0.2, s * 0.48, -s * 0.2);
  },
  exitFullscreen(g: Phaser.GameObjects.Graphics, s: number) {
    const h = s / 2;
    const k = s * 0.32;
    g.lineStyle(2.5, COLORS.text, 1);
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      g.beginPath();
      g.moveTo(x * (h - k), y * h);
      g.lineTo(x * (h - k), y * (h - k));
      g.lineTo(x * h, y * (h - k));
      g.strokePath();
    }
  },
  lock(g: Phaser.GameObjects.Graphics, s: number) {
    const h = s / 2;
    g.lineStyle(s * 0.16, 0xc9ced8);
    g.beginPath();
    g.arc(0, -h * 0.1, h * 0.42, Math.PI, 0);
    g.strokePath();
    g.fillStyle(COLORS.goldDark).fillRoundedRect(-h * 0.72, -h * 0.12, h * 1.44, h * 1.08, h * 0.2);
    g.fillStyle(COLORS.gold).fillRoundedRect(-h * 0.72, -h * 0.18, h * 1.44, h * 1.0, h * 0.2);
    g.fillStyle(0x5a4010).fillCircle(0, h * 0.25, h * 0.16);
  },
  gold(g: Phaser.GameObjects.Graphics, s: number) {
    g.fillStyle(COLORS.goldDark).fillCircle(0, 1, s / 2);
    g.fillStyle(COLORS.gold).fillCircle(0, 0, s / 2);
    g.fillStyle(lighten(COLORS.gold, 0.5)).fillCircle(-s * 0.12, -s * 0.12, s * 0.16);
  },
  food(g: Phaser.GameObjects.Graphics, s: number) {
    g.fillStyle(0xd94b4b).fillCircle(0, s * 0.06, s * 0.44);
    g.fillStyle(0xff8080).fillCircle(-s * 0.14, -s * 0.06, s * 0.13);
    g.fillStyle(COLORS.food).fillEllipse(s * 0.14, -s * 0.38, s * 0.34, s * 0.18);
  },
  crystal(g: Phaser.GameObjects.Graphics, s: number) {
    const h = s / 2;
    g.fillStyle(darken(COLORS.crystal, 0.3)).fillPoints(
      [
        { x: 0, y: -h },
        { x: h * 0.7, y: 0 },
        { x: 0, y: h },
        { x: -h * 0.7, y: 0 },
      ],
      true,
    );
    g.fillStyle(COLORS.crystal).fillTriangle(0, -h, h * 0.7, 0, 0, h * 0.4);
  },
  gem(g: Phaser.GameObjects.Graphics, s: number) {
    const h = s / 2;
    g.fillStyle(darken(COLORS.gem, 0.35)).fillPoints(
      [
        { x: -h, y: -h * 0.3 },
        { x: -h * 0.5, y: -h * 0.8 },
        { x: h * 0.5, y: -h * 0.8 },
        { x: h, y: -h * 0.3 },
        { x: 0, y: h },
      ],
      true,
    );
    g.fillStyle(COLORS.gem).fillTriangle(-h * 0.5, -h * 0.3, h * 0.5, -h * 0.3, 0, h * 0.8);
  },
};

/** Yes/no question; `onYes` runs after the dialog closes. */
export function confirmDialog(scene: Phaser.Scene, message: string, onYes: () => void): void {
  const { width } = scene.scale;
  const mw = Math.min(width - 32, 340);
  const modal = new Modal(scene, { width: mw, height: 170, dismissible: true });
  modal.panel.add(
    scene.add
      .text(
        mw / 2,
        54,
        message,
        textStyle(14, COLORS.text, { align: 'center', wordWrap: { width: mw - 32 } }),
      )
      .setOrigin(0.5),
  );
  const bw = (mw - 36) / 2;
  modal.panel.add(
    new Button(scene, 12 + bw / 2, 134, {
      width: bw,
      height: 38,
      label: t('dialog.no'),
      color: COLORS.panelLight,
      onClick: () => modal.close(),
    }),
  );
  modal.panel.add(
    new Button(scene, mw - 12 - bw / 2, 134, {
      width: bw,
      height: 38,
      label: t('dialog.yes'),
      color: COLORS.danger,
      onClick: () => {
        modal.close();
        onYes();
      },
    }),
  );
}

export interface StepperOptions {
  width: number;
  height?: number;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/** "−  label  +" control centred on (x, y); the buttons stop at min and max. */
export function stepper(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: StepperOptions,
): Phaser.GameObjects.Container {
  const h = opts.height ?? 30;
  const bw = h + 4;
  const box = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.panelDark, 0.95).fillRoundedRect(
    -opts.width / 2,
    -h / 2,
    opts.width,
    h,
    h / 2,
  );
  bg.lineStyle(1.5, COLORS.stroke, 1).strokeRoundedRect(
    -opts.width / 2,
    -h / 2,
    opts.width,
    h,
    h / 2,
  );
  const label = scene.add
    .text(0, 0, opts.label, textStyle(12, COLORS.text, { fontStyle: 'bold' }))
    .setOrigin(0.5);
  const room = opts.width - bw * 2 - 8;
  if (label.width > room) label.setScale(room / label.width);
  const step = (dir: number, sx: number) =>
    new Button(scene, sx, 0, {
      width: bw,
      height: h - 4,
      label: dir < 0 ? '−' : '+',
      fontSize: 16,
      color: COLORS.accentDark,
      disabled: dir < 0 ? opts.value <= opts.min : opts.value >= opts.max,
      onClick: () => opts.onChange(opts.value + dir),
    });
  box.add([
    bg,
    label,
    step(-1, -opts.width / 2 + bw / 2 + 2),
    step(1, opts.width / 2 - bw / 2 - 2),
  ]);
  return box;
}
