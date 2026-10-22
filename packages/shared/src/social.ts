import { deepClone } from './clone';
import { gameData, VILLAGE_RESOURCES, type GameData } from './data';
import { recordAction } from './player';
import { dayNumber } from './quests';
import type { Monster } from './monster';
import type { ActionError, PlayerState } from './state';
import { allBuildings } from './village';

/** What a player did with friends today (Tugas 2.1). */
export interface SocialDay {
  /** Friend id → day number of the last help given. */
  helped: Record<string, number>;
  /** Day number a friend's monster was last borrowed for a mix. */
  borrowDay: number | null;
}

/** A borrowed monster's id: it never clashes with the player's own ids. */
export const borrowedId = (friendId: string, monsterId: string) => `f:${friendId}:${monsterId}`;

/** The friend id and the friend's own monster id inside a `borrowedId`. */
export function parseBorrowedId(id: string): { friendId: string; monsterId: string } | null {
  const m = /^f:([^:]+):([^:]+)$/.exec(id);
  return m ? { friendId: m[1]!, monsterId: m[2]! } : null;
}

/** The server's copy of a friend's monster to borrow (renamed with `borrowedId`), if it exists. */
export function borrowFrom(
  friend: PlayerState,
  friendId: string,
  monsterId: string,
): Monster | null {
  const m = friend.monsters.find((x) => x.id === monsterId);
  return m ? { ...deepClone(m), id: borrowedId(friendId, monsterId) } : null;
}

export function canHelp(
  state: PlayerState,
  friendId: string,
  now: number,
  data: GameData = gameData,
) {
  return state.social.helped[friendId] !== dayNumber(now, data);
}

export function canBorrow(state: PlayerState, now: number, data: GameData = gameData) {
  return state.social.borrowDay !== dayNumber(now, data);
}

/**
 * The helper helps a friend's base, once a day per friend: the friend's construction with
 * the most time left is sped up (or, with nothing being built, the friend gets gold); the
 * helper is paid and gets help XP. Pure: returns both new states.
 */
export function helpFriend(
  helper: PlayerState,
  friend: PlayerState,
  friendId: string,
  now: number,
  data: GameData = gameData,
):
  | { ok: true; helper: PlayerState; friend: PlayerState; spedUp: boolean }
  | { ok: false; error: ActionError } {
  if (!canHelp(helper, friendId, now, data)) return { ok: false, error: 'alreadyClaimed' };
  const { helpSpeedUpSeconds, helpFriendGold, helpReward } = data.rules.social;
  const nextFriend = deepClone(friend);
  const building = allBuildings(nextFriend)
    .filter((b) => b.construction && b.construction.endsAt > now)
    .sort((a, b) => b.construction!.endsAt - a.construction!.endsAt)[0];
  if (building) {
    building.construction!.endsAt = Math.max(
      now,
      building.construction!.endsAt - helpSpeedUpSeconds,
    );
  } else {
    nextFriend.resources.gold += helpFriendGold;
  }
  const nextHelper = deepClone(helper);
  for (const r of VILLAGE_RESOURCES) nextHelper.resources[r] += helpReward[r];
  const today = dayNumber(now, data);
  // Only today's entries matter; older ones are dropped so the list stays short.
  nextHelper.social.helped = Object.fromEntries(
    Object.entries(nextHelper.social.helped).filter(([, day]) => day === today),
  );
  nextHelper.social.helped[friendId] = today;
  recordAction(nextHelper, 'help', 1, data);
  return { ok: true, helper: nextHelper, friend: nextFriend, spedUp: !!building };
}
