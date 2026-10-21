import type { VillageAmount } from '@soul-monster/shared';
import type { SoundId } from './audio/synth';

/** Events between the village (world) scene and the UI scene, sent on `game.events`. */
export const EVT = {
  /** Village → UI: a building, obstacle or locked plot was selected (or null). */
  select: 'village:select',
  /** UI → village: clear the selection. */
  deselect: 'village:deselect',
  /** UI → village: start placing a new building type, or moving a building. */
  startPlacement: 'village:start-placement',
  /** Village → UI: placement mode changed. */
  placement: 'village:placement',
  /** UI → village: confirm / cancel placement. */
  confirmPlacement: 'village:confirm-placement',
  cancelPlacement: 'village:cancel-placement',
  /** Village → UI: open a panel (e.g. tapping the Soul Mixer building). */
  openPanel: 'ui:open-panel',
  /** Any → UI: show a toast. */
  toast: 'ui:toast',
  /** UI → village: centre the camera on a building. */
  focus: 'village:focus',
  /** Village → UI: a monster in the village was tapped (add to / remove from the team). */
  teamToggle: 'team:toggle',
  /** UI → village: the chosen team changed (monster ids), for the highlight rings. */
  teamChanged: 'team:changed',
  /** Village → UI: resources were earned at a screen point; icons fly to the HUD. */
  collectFx: 'ui:collect-fx',
} as const;

/** `plot` ids are "px,py" in plot coordinates. */
export type Selection = {
  kind: 'building' | 'obstacle' | 'plot' | 'animal' | 'encounter';
  id: string;
} | null;

export type PlacementRequest = { type: string } | { moveId: string };

/** Sent with `confirmPlacement`: builders for a timed construction. */
export interface PlacementConfirm {
  workers?: number;
}

export interface PlacementStatus {
  active: boolean;
  valid: boolean;
  type?: string;
  moving?: boolean;
  /** Line buildings (walls): segments in the current line and its total price. */
  line?: { started: boolean; count: number; cost: VillageAmount };
}

/** Resource icons flying from a screen point (where they were earned) to their HUD pill. */
export interface CollectFx {
  resource: 'gold' | 'food' | 'wood' | 'stone' | 'soulCrystal' | 'gems';
  amount: number;
  x: number;
  y: number;
}

export interface ToastRequest {
  message: string;
  color?: number;
  /** Sound with the toast; null when the action already played one. */
  sound?: SoundId | null;
}
