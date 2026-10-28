import { gameData, type GameData } from './data';
import type { PlayerState } from './state';
import { allBuildings } from './village';

/**
 * Returns the highest completed level of the Guild building in the village (Tugas 1C.12).
 * Returns 0 if none are built or all are under construction.
 */
export function guildLevel(state: PlayerState, data: GameData = gameData): number {
  let highest = 0;
  for (const b of allBuildings(state)) {
    if (b.type === data.rules.guild.building && !b.construction) {
      if (b.level > highest) highest = b.level;
    }
  }
  return highest;
}

/**
 * Maximum guild community members allowed at this Guild building level (10..30).
 * Returns 0 if the Guild building is not yet built (level <= 0).
 */
export function guildMaxMembers(level: number, data: GameData = gameData): number {
  if (level <= 0) return 0;
  const list = data.rules.guild.maxMembersByLevel;
  return list[Math.min(level - 1, list.length - 1)] ?? 10;
}

/**
 * Bonus ratio for Serbu and guild mission rewards (+0%, +5%, +10%, +15%, +20%).
 * Returns 0 if level <= 0.
 */
export function guildSerbuRewardBonus(level: number, data: GameData = gameData): number {
  if (level <= 0) return 0;
  const list = data.rules.guild.serbuRewardBonusByLevel;
  return list[Math.min(level - 1, list.length - 1)] ?? 0;
}
