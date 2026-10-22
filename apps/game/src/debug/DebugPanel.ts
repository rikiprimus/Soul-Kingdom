import {
  deepClone,
  gameData,
  mainVillage,
  plotKey,
  plotsPerSide,
  townHallLevel,
  type PlayerState,
} from '@soul-monster/shared';
import type { GameStore } from '../store';
import { t } from '../text';

/**
 * Development-only panel (plain DOM, outside the game canvas): add resources,
 * skip time, change Town Hall level and bosses defeated, reset the save.
 */
export function mountDebugPanel(store: GameStore): void {
  const edit = (change: (s: PlayerState) => void) => {
    const next = deepClone(store.state);
    change(next);
    store.set(next);
  };
  const lastStage = gameData.rules.growth.stages.at(-1)!.id;
  const setHall = (s: PlayerState, delta: number) => {
    const hall = mainVillage(s).buildings.find((b) => b.type === gameData.townHallId);
    if (hall) hall.level = Math.min(gameData.maxTownHallLevel, Math.max(1, hall.level + delta));
  };

  const groups: { title: string; buttons: [string, () => void][] }[] = [
    {
      title: t('debug.resources'),
      buttons: [
        [`+1000 ${t('res.gold')}`, () => edit((s) => void (s.resources.gold += 1000))],
        [`+1000 ${t('res.food')}`, () => edit((s) => void (s.resources.food += 1000))],
        [`+1000 ${t('res.wood')}`, () => edit((s) => void (s.resources.wood += 1000))],
        [`+1000 ${t('res.stone')}`, () => edit((s) => void (s.resources.stone += 1000))],
        [`+100 ${t('res.gems')}`, () => edit((s) => void (s.resources.gems += 100))],
        [`+10 ${t('res.soulCrystal')}`, () => edit((s) => void (s.resources.soulCrystal += 10))],
        [
          t('debug.unlockPlots'),
          () =>
            edit((s) => {
              const n = plotsPerSide();
              s.village.unlockedPlots = Array.from({ length: n * n }, (_, i) =>
                plotKey(i % n, Math.floor(i / n)),
              );
            }),
        ],
      ],
    },
    {
      title: t('debug.time'),
      buttons: [
        ['+1m', () => store.skipTime(60)],
        ['+10m', () => store.skipTime(600)],
        ['+1j', () => store.skipTime(3600)],
        ['+1h', () => store.skipTime(86400)],
      ],
    },
    {
      title: t('debug.raids'),
      buttons: [
        [
          t('debug.raid'),
          () => {
            // A full raid clock: the next bit of play time sends a raid (once the Balai reaches rules.raids.minTownHall).
            edit((s) => void (s.village.raidClock = gameData.rules.raids.intervalSeconds));
            store.raid(0.01);
          },
        ],
      ],
    },
    {
      title: t('debug.townHall'),
      buttons: [
        ['−1', () => edit((s) => setHall(s, -1))],
        ['+1', () => edit((s) => setHall(s, 1))],
      ],
    },
    {
      title: t('debug.bosses'),
      buttons: [
        ['−1', () => edit((s) => void (s.bossesDefeated = Math.max(0, s.bossesDefeated - 1)))],
        ['+1', () => edit((s) => void (s.bossesDefeated += 1))],
      ],
    },
    {
      title: t('debug.monsters'),
      buttons: [
        [
          t('debug.allAdult'),
          () =>
            edit((s) => {
              for (const m of s.monsters) {
                m.stage = lastStage;
                m.food = 0;
              }
            }),
        ],
      ],
    },
    {
      title: t('debug.save'),
      buttons: [
        [
          t('debug.reset'),
          () => {
            if (window.confirm(t('debug.resetConfirm'))) store.reset();
          },
        ],
      ],
    },
  ];

  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;right:8px;z-index:20;font:12px system-ui,sans-serif;color:#f4f0ff;display:flex;flex-direction:column-reverse;align-items:flex-end';
  // Bottom-right, above the "collect all" button (the bottom-left belongs to the tab bar).
  const place = () => {
    root.style.bottom = window.innerHeight < 480 ? '66px' : '72px';
  };
  window.addEventListener('resize', place);
  place();
  const toggle = document.createElement('button');
  toggle.textContent = t('debug.title');
  const buttonCss =
    'background:#3a2f63;color:#f4f0ff;border:1px solid #8a6cff;border-radius:8px;padding:5px 9px;margin:2px;cursor:pointer;font:inherit';
  toggle.style.cssText = `${buttonCss};opacity:0.7;padding:2px 8px;font-size:11px`;
  const panel = document.createElement('div');
  panel.style.cssText =
    'display:none;background:rgba(22,17,42,0.96);border:1px solid #8a6cff;border-radius:12px;padding:8px 10px;margin-bottom:6px;max-width:300px;max-height:calc(100vh - 140px);overflow:auto';
  const info = document.createElement('div');
  info.style.cssText = 'color:#b4aad6;margin-bottom:4px';
  panel.appendChild(info);

  for (const group of groups) {
    const row = document.createElement('div');
    row.style.cssText = 'margin:4px 0';
    const label = document.createElement('div');
    label.textContent = group.title;
    label.style.cssText = 'color:#b4aad6;font-weight:bold';
    row.appendChild(label);
    for (const [text, onClick] of group.buttons) {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = buttonCss;
      b.addEventListener('click', onClick);
      row.appendChild(b);
    }
    panel.appendChild(row);
  }

  const updateInfo = () => {
    const s = store.state;
    info.textContent = t('debug.info', {
      level: townHallLevel(s),
      bosses: s.bossesDefeated,
      pity: s.pityStreak,
    });
  };
  store.subscribe(updateInfo);
  updateInfo();

  toggle.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  root.append(toggle, panel);
  document.body.appendChild(root);
}
