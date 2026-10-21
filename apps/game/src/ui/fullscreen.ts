/**
 * Full screen and landscape handling for the browser build. Android (Capacitor)
 * locks landscape natively; iPhone Safari has no Fullscreen API for pages, so
 * there the game is best played from "Add to Home Screen" (standalone PWA).
 */

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null && document.fullscreenElement !== undefined;
}

export function canFullscreen(): boolean {
  return typeof document.documentElement.requestFullscreen === 'function';
}

/** Lock to landscape where the browser allows it (Chrome Android, in full screen). */
export function lockLandscape(): void {
  const orientation = screen.orientation as LockableOrientation | undefined;
  orientation?.lock?.('landscape').catch(() => {
    // Not supported (desktop, iOS) or not in full screen: the rotate overlay covers it.
  });
}

/** Must run inside (or shortly after) a user gesture. */
export async function enterFullscreen(): Promise<void> {
  if (!isFullscreen() && canFullscreen()) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      return;
    }
  }
  lockLandscape();
}

export async function exitFullscreen(): Promise<void> {
  if (isFullscreen()) await document.exitFullscreen().catch(() => undefined);
}

export function toggleFullscreen(): void {
  void (isFullscreen() ? exitFullscreen() : enterFullscreen());
}

/** Enter full screen on the first tap or click of the session (browsers need a gesture). */
export function fullscreenOnFirstInteraction(): void {
  if (!canFullscreen()) return;
  const handler = () => {
    window.removeEventListener('pointerup', handler, true);
    void enterFullscreen();
  };
  window.addEventListener('pointerup', handler, true);
}

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

/** "Rotate your phone" overlay, shown on touch devices held upright. */
export function mountRotateOverlay(message: string): void {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:50;display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#16112a;color:#f4f0ff;font:bold 18px system-ui,sans-serif;text-align:center;padding:24px';
  const phone = document.createElement('div');
  phone.style.cssText =
    'width:46px;height:80px;border:4px solid #8a6cff;border-radius:10px;animation:sm-rotate 1.6s ease-in-out infinite alternate';
  const style = document.createElement('style');
  style.textContent = '@keyframes sm-rotate{from{transform:rotate(0)}to{transform:rotate(-90deg)}}';
  const label = document.createElement('div');
  label.textContent = message;
  overlay.append(style, phone, label);
  document.body.appendChild(overlay);
  const update = () => {
    const portrait = window.innerHeight > window.innerWidth;
    overlay.style.display = isTouchDevice() && portrait ? 'flex' : 'none';
  };
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  update();
}
