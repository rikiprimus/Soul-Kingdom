import { payPrize } from './collections';
import { deepClone } from './clone';
import { gameData, type GameData, type Prize } from './data';
import { dayNumber } from './quests';
import { createRng } from './rng';
import type { ActionError, ActionResult, PlayerState } from './state';
import { allBuildings } from './village';

// Undian Harian at the Pasar (Tugas 1C.5).

/** The draw's state: the day it was last used (null = never). */
export interface MarketDraw {
  lastDay: number | null;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

/** Highest finished level of the draw building (Pasar) on any island; 0 when there is none. */
export function bestMarketLevel(state: PlayerState, data: GameData = gameData): number {
  const { building } = data.rules.marketDraw;
  return allBuildings(state)
    .filter((b) => b.type === building)
    .reduce((best, b) => Math.max(best, b.level), 0);
}

/** Index of the prize table for a Pasar level: the last one whose minLevel it reaches. */
export function marketTableIndex(level: number, data: GameData = gameData): number {
  let index = 0;
  data.rules.marketDraw.tables.forEach((t, i) => {
    if (t.minLevel <= level) index = i;
  });
  return index;
}

/** Whether today's draw is free to use, and which table it would roll on. */
export function marketDrawStatus(state: PlayerState, now: number, data: GameData = gameData) {
  const level = bestMarketLevel(state, data);
  const today = dayNumber(now, data);
  const offset = data.rules.daily.dayOffsetSeconds;
  return {
    hasMarket: level >= 1,
    available: level >= 1 && state.marketDraw.lastDay !== today,
    table: marketTableIndex(level, data),
    /** Seconds until the next day starts (when the draw opens again). */
    nextIn: (today + 1) * 86400 - offset - now,
  };
}

/** Picks one prize of a table by weight. */
export function rollMarketPrize(
  tableIndex: number,
  r: number,
  data: GameData = gameData,
): { index: number; prize: Prize } {
  const { prizes } = data.rules.marketDraw.tables[tableIndex]!;
  const total = prizes.reduce((sum, p) => sum + p.weight, 0);
  let left = r * total;
  for (let i = 0; i < prizes.length; i++) {
    left -= prizes[i]!.weight;
    if (left < 0) return { index: i, prize: prizes[i]!.prize };
  }
  return { index: prizes.length - 1, prize: prizes[prizes.length - 1]!.prize };
}

/**
 * Uses today's free draw: one seeded roll on the table of the best Pasar. Resources and
 * Telur Jiwa are paid at once, decorations go to the Gudang.
 */
export function drawMarket(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): ActionResult<{ prize: Prize; table: number; index: number }> {
  const status = marketDrawStatus(state, now, data);
  if (!status.hasMarket) return fail('noMarket');
  if (!status.available) return fail('alreadyClaimed');
  const next = deepClone(state);
  const rng = createRng(next.rngState);
  const { index, prize } = rollMarketPrize(status.table, rng.next(), data);
  next.rngState = rng.getState();
  const paid = { ...prize, decorations: [...prize.decorations] };
  payPrize(next, paid);
  next.marketDraw = { lastDay: dayNumber(now, data) };
  return { ok: true, state: next, prize: paid, table: status.table, index };
}
