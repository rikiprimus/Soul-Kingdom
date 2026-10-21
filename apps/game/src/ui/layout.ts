/** Screen regions shared by the UI scene, panels, cards and toasts. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UILayout {
  /** Wider than tall (phones held sideways): thin one-row HUD. */
  landscape: boolean;
  /** Short screens: tighter cards and modals. */
  compact: boolean;
  width: number;
  height: number;
  hud: Rect;
  /** Everything below the HUD; the game shows through here. */
  play: Rect;
  /** Floating tab bar along the bottom-left of the play area. */
  dock: { x: number; y: number; buttonW: number; buttonH: number; gap: number; toggleW: number };
  /** Space reserved at the bottom while the tab bar is visible. */
  dockSpace: number;
}

export function uiLayout(width: number, height: number): UILayout {
  const landscape = width > height;
  const compact = height < 480;
  const hudH = landscape ? 44 : 104;
  const buttonH = compact ? 40 : 46;
  const margin = 10;
  return {
    landscape,
    compact,
    width,
    height,
    hud: { x: 0, y: 0, w: width, h: hudH },
    play: { x: 0, y: hudH, w: width, h: height - hudH },
    dock: {
      x: margin,
      y: height - margin - buttonH,
      buttonW: compact ? 92 : 104,
      buttonH,
      gap: 6,
      toggleW: buttonH,
    },
    dockSpace: buttonH + margin * 2,
  };
}

/** Bottom edge (y) that cards and panels should stay above. */
export function contentBottom(layout: UILayout, dockVisible: boolean): number {
  return layout.height - (dockVisible ? layout.dockSpace : 8);
}
