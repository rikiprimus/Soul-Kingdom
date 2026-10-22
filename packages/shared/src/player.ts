import { gameData, VILLAGE_RESOURCES, type GameData, type XP_ACTIONS } from './data';
import type { PlayerState } from './state';

export type XpAction = (typeof XP_ACTIONS)[number];

/** Player level for a total XP (1-based, capped at the last level in the data). */
export function playerLevel(xp: number, data: GameData = gameData): number {
  const { levels } = data.rules.player;
  let level = 1;
  while (level < levels.length && xp >= levels[level]!.xp) level++;
  return level;
}

/** XP gained inside the current level and XP that level needs (null at the max level). */
export function levelProgress(xp: number, data: GameData = gameData) {
  const { levels } = data.rules.player;
  const level = playerLevel(xp, data);
  const from = levels[level - 1]!.xp;
  const to = levels[level]?.xp;
  return { level, current: xp - from, needed: to === undefined ? null : to - from };
}

/**
 * Records `times` × `action` on a state being built (mutates it): counts it for quests,
 * adds its XP and pays the reward of every level reached. Returns the levels gained.
 */
export function recordAction(
  state: PlayerState,
  action: XpAction,
  times = 1,
  data: GameData = gameData,
): number {
  state.actions[action] += times;
  const before = playerLevel(state.xp, data);
  state.xp += data.rules.player.xp[action] * times;
  const after = playerLevel(state.xp, data);
  for (let level = before + 1; level <= after; level++) {
    const reward = data.rules.player.levels[level - 1]!.reward;
    for (const r of VILLAGE_RESOURCES) state.resources[r] += reward[r];
  }
  return after - before;
}
