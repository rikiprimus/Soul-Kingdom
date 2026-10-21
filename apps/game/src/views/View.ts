import Phaser from 'phaser';
import type { ActionResult, PlayerState } from '@soul-monster/shared';
import type { GameStore } from '../store';
import { errorText } from '../text';
import { ScrollArea, toast } from '../ui/widgets';

export interface ViewContext {
  scene: Phaser.Scene;
  store: GameStore;
  /** Content area between the HUD and the navigation bar. */
  rect: Phaser.Geom.Rectangle;
  /** Dev-only switches (e.g. skip the mixer unlock). */
  dev: { skipMixerUnlock: boolean };
  /** Display depth of the scrolling content (panels sit above the HUD layer). */
  depth?: number;
  /** The building a panel belongs to (e.g. which barracks trains). */
  targetId?: string;
  /** The team being picked for a wild encounter (owned by the UI scene). */
  team?: { ids(): string[]; toggle(id: string): void; clear(): void };
  /** Closes the panel this view is in. */
  close?: () => void;
}

/** A tab's content: rebuilt from the store state, scroll position preserved. */
export abstract class View {
  protected area?: ScrollArea;

  constructor(protected readonly ctx: ViewContext) {}

  protected get scene() {
    return this.ctx.scene;
  }

  protected get state(): PlayerState {
    return this.ctx.store.state;
  }

  /** Inner layout width (content is centered and capped for wide screens). */
  protected get width(): number {
    return Math.min(this.ctx.rect.width, 960);
  }

  protected get left(): number {
    return Math.round((this.ctx.rect.width - this.width) / 2);
  }

  /** Builds content into `this.area.content`; returns the content height. */
  protected abstract build(content: Phaser.GameObjects.Container): number;

  render(): void {
    const scroll = this.area?.scroll ?? 0;
    this.area?.destroy();
    this.area = new ScrollArea(this.scene, this.ctx.rect, this.ctx.depth ?? 0);
    const height = this.build(this.area.content);
    this.area.setContentHeight(height);
    this.area.scrollTo(scroll);
  }

  /** Called every second for countdowns. */
  tick(): void {}

  destroy(): void {
    this.area?.destroy();
    this.area = undefined;
  }

  /** Runs an action; shows the error text when it fails. */
  protected run<T extends object>(
    action: (state: PlayerState, now: number) => ActionResult<T>,
  ): (ActionResult<T> & { ok: true }) | null {
    const result = this.ctx.store.apply(action);
    if (!result.ok) {
      toast(this.scene, errorText(result.error));
      return null;
    }
    return result;
  }
}
