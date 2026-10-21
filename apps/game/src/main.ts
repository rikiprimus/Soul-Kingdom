import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';

/** Entry point: loads the game lazily so invalid data/ shows a clear error page. */
function showFatal(err: unknown) {
  console.error(err);
  const pre = document.createElement('pre');
  pre.style.cssText =
    'color:#ffb3c1;background:#1d1736;padding:16px;margin:16px;border-radius:12px;white-space:pre-wrap;font:13px/1.5 monospace;position:relative;z-index:10';
  pre.textContent = err instanceof Error ? err.message : String(err);
  document.body.appendChild(pre);
}

/**
 * A page opened minimized or in a background tab can report a 0×0 window; Phaser's WebGL
 * renderer cannot start on a 0×0 canvas, so wait until the window has a real size.
 */
function windowHasSize(): Promise<void> {
  const ready = () => window.innerWidth > 0 && window.innerHeight > 0;
  if (ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (!ready()) return;
      window.removeEventListener('resize', check);
      resolve();
    };
    window.addEventListener('resize', check);
  });
}

/** Phaser draws text into textures once, so the game font must be loaded before it starts. */
async function start() {
  await windowHasSize();
  await Promise.all(
    ['400 16px Fredoka', '500 16px Fredoka'].map((f) => document.fonts.load(f)),
  ).catch(() => undefined);
  const { boot } = await import('./boot');
  boot();
}

start().catch(showFatal);
