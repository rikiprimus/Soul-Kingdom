import { gameData, type BattleReward, type GameData, type Quest } from './data';
import { deepClone } from './clone';
import { payPrize } from './collections';
import { payReward } from './serbu';
import type { ActionError, ActionResult, PlayerState } from './state';
import type { XpAction } from './player';

/** Where the player is in the quest chain; `start` = action counts when the quest began. */
export interface QuestProgress {
  index: number;
  start: Record<XpAction, number>;
}

/** Daily bonus: the next reward in the cycle and the day it was last claimed. */
export interface DailyBonus {
  next: number;
  lastDay: number | null;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export interface GoalStatus {
  current: number;
  target: number;
  done: boolean;
}

/** The active quest and how far each goal is (null once the chain is finished). */
export function activeQuest(
  state: PlayerState,
  data: GameData = gameData,
): { quest: Quest; goals: GoalStatus[]; complete: boolean } | null {
  const quest = data.quests.chain[state.quest.index];
  if (!quest) return null;
  const goals = quest.goals.map((g): GoalStatus => {
    const current =
      g.kind === 'action'
        ? state.actions[g.action] - state.quest.start[g.action]
        : g.kind === 'monsters'
          ? state.monsters.length
          : state.village.buildings.filter(
              (b) => b.type === g.building && b.level >= g.level && !b.construction,
            ).length;
    const target = g.count;
    return { current: Math.min(current, target), target, done: current >= target };
  });
  return { quest, goals, complete: goals.every((g) => g.done) };
}

/** Pays a finished quest and starts the next one (its action goals count from now). */
export function claimQuest(
  state: PlayerState,
  data: GameData = gameData,
): ActionResult<{ reward: Quest['reward']; wonder: boolean }> {
  const active = activeQuest(state, data);
  if (!active) return fail('entryNotFound');
  if (!active.complete) return fail('notReady');
  const next = deepClone(state);
  const reward = { ...active.quest.reward };
  const wonder = payPrize(next, reward);
  next.quest = { index: state.quest.index + 1, start: { ...next.actions } };
  return { ok: true, state: next, reward, wonder };
}

/** Day number of a time (days cut at `rules.daily.dayOffsetSeconds` from UTC midnight). */
export function dayNumber(now: number, data: GameData = gameData): number {
  return Math.floor((now + data.rules.daily.dayOffsetSeconds) / 86400);
}

/** Today's daily bonus: whether it can be claimed and which reward it is. */
export function dailyStatus(state: PlayerState, now: number, data: GameData = gameData) {
  const { rewards } = data.rules.daily;
  const index = state.daily.next % rewards.length;
  return {
    available: state.daily.lastDay !== dayNumber(now, data),
    index,
    reward: rewards[index]!,
  };
}

/**
 * Claims today's bonus. The cycle only moves on a claim: missed days neither reset it
 * nor skip ahead, so the player goes on with the next reward.
 */
export function claimDaily(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): ActionResult<{ reward: BattleReward; index: number }> {
  const status = dailyStatus(state, now, data);
  if (!status.available) return fail('alreadyClaimed');
  const next = deepClone(state);
  const reward = { ...status.reward };
  payReward(next, reward);
  next.daily = {
    next: (status.index + 1) % data.rules.daily.rewards.length,
    lastDay: dayNumber(now, data),
  };
  return { ok: true, state: next, reward, index: status.index };
}
