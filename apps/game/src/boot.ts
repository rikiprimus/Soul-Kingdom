import Phaser from 'phaser';
import { gameData } from '@soul-monster/shared';
import { mountDebugPanel } from './debug/DebugPanel';
import { LoginScene } from './scenes/LoginScene';
import { SerbuScene } from './scenes/SerbuScene';
import { UIScene } from './scenes/UIScene';
import { VillageScene } from './scenes/VillageScene';
import { GameStore } from './store';
import { t } from './text';
import { dpr } from './ui/dpr';
import { fullscreenOnFirstInteraction, mountRotateOverlay } from './ui/fullscreen';

export function boot(): void {
  document.title = t('game.title');
  const store = new GameStore();
  const { debug } = gameData.rules;
  // The debug panel exists in dev mode, or in a test build made with VITE_ENABLE_DEBUG=true.
  const debugEnabled =
    debug.enabledInDev && (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true');
  const dev = {
    skipMixerUnlock: import.meta.env.DEV && debug.enabledInDev && debug.skipMixerUnlock,
  };

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#16112a',
    // The canvas has one pixel per screen pixel and is shown at CSS size (zoom 1/dpr),
    // so the browser never stretches it (stretched text looks broken); resizing below.
    scale: {
      mode: Phaser.Scale.NONE,
      width: window.innerWidth * dpr(),
      height: window.innerHeight * dpr(),
      zoom: 1 / dpr(),
    },
    render: { antialias: true },
    // Dev-only: `?timer=1` drives the loop with setTimeout so automated tests keep
    // running when the page is in a hidden tab (requestAnimationFrame pauses there).
    fps: {
      forceSetTimeOut:
        import.meta.env.DEV && new URLSearchParams(window.location.search).has('timer'),
    },
    input: { activePointers: 3 },
    scene: [
      new LoginScene(store),
      new VillageScene(store),
      new UIScene(store, dev),
      new SerbuScene(store),
    ],
  });

  const fit = () => {
    game.scale.setZoom(1 / dpr());
    game.scale.resize(window.innerWidth * dpr(), window.innerHeight * dpr());
  };
  window.addEventListener('resize', fit);

  // Browser: go full screen on the first tap/click (a user gesture is required),
  // and ask phone players to turn the device sideways.
  fullscreenOnFirstInteraction();
  mountRotateOverlay(t('screen.rotate'));

  if (debugEnabled) mountDebugPanel(store);
  // Expose for manual testing in the browser console during development.
  if (import.meta.env.DEV) Object.assign(window, { soulMonster: { store, game } });
}
