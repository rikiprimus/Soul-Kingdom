import { simulateBattle, type BattleResult, type Fighter, type FighterStats } from './battle';
import { deepClone } from './clone';
import { gameData, type BattleReward, type GameData } from './data';
import { withWounds } from './healing';
import { monsterElement, monsterStats } from './monster';
import { playerLevel } from './player';
import { createRng } from './rng';
import { getResearchBonus } from './research';
import { payReward, serbuArmy } from './serbu';
import type { ActionError, ActionResult, PlayerState } from './state';

const DAY_SECONDS = 86400;

export interface ArenaTier {
  id: string;
  name: string;
  minPoints: number;
  weeklyReward: BattleReward;
}

export interface ArenaHistoryEntry {
  id: string;
  opponentId: string;
  opponentName: string;
  opponentLevel: number;
  opponentPower: number;
  won: boolean;
  pointsDelta: number;
  reward: BattleReward;
  timestamp: number;
}

/** Rating at the end of a season the player fought in, until its weekly reward is claimed. */
export interface ArenaSeasonResult {
  week: number;
  points: number;
  claimed: boolean;
}

export interface ArenaState {
  /** Monster ids chosen for arena attack (at most `rules.arena.teamSize`). */
  team: string[];
  /** Monster ids chosen for arena defense (at most `rules.arena.teamSize`). */
  defenseTeam: string[];
  /** Current arena rating points. */
  points: number;
  /** Challenge tickets left today. */
  tickets: number;
  /** When the tickets were last refilled. */
  ticketsLastRefill: number;
  /** Season index `seasonFights` counts for. */
  seasonWeek: number;
  /** Duels fought in `seasonWeek`. */
  seasonFights: number;
  /** The last finished season the player fought in. */
  lastSeason: ArenaSeasonResult | null;
  /** Recent duels, newest first (at most `rules.arena.historyLimit`). */
  history: ArenaHistoryEntry[];
}

export interface ArenaSnapshot {
  id: string;
  name: string;
  level: number;
  power: number;
  points: number;
  tier: string;
  team: Fighter[];
  updatedAt: number;
}

export interface ArenaBattleResult {
  won: boolean;
  pointsDelta: number;
  reward: BattleReward;
  replay: BattleResult;
}

const BOT_ID_PREFIX = 'arena_bot_';
/** Defender ids in an arena battle, so they never clash with the attacker's monster ids. */
const DEFENDER_ID_PREFIX = 'arena_def_';

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

/** A fresh arena state for a new (or newly migrated) player. */
export function initialArenaState(now: number, data: GameData = gameData): ArenaState {
  const { startingPoints, dailyTickets } = data.rules.arena;
  return {
    team: [],
    defenseTeam: [],
    points: startingPoints,
    tickets: dailyTickets,
    ticketsLastRefill: now,
    seasonWeek: getSeasonWeek(now, data),
    seasonFights: 0,
    lastSeason: null,
    history: [],
  };
}

const seasonSeconds = (data: GameData) => data.rules.arena.seasonDays * DAY_SECONDS;

/** Returns current season index. */
export function getSeasonWeek(now: number, data: GameData = gameData): number {
  return Math.floor(now / seasonSeconds(data));
}

/** Seconds remaining until the current season ends. */
export function seasonSecondsRemaining(now: number, data: GameData = gameData): number {
  const nextStart = (getSeasonWeek(now, data) + 1) * seasonSeconds(data);
  return Math.max(0, nextStart - now);
}

/** Resolves the arena tier for a given rating. */
export function getArenaTier(points: number, data: GameData = gameData): ArenaTier {
  const { tiers } = data.rules.arena;
  let current = tiers[0]!;
  for (const t of tiers) {
    if (points >= t.minPoints) current = t;
  }
  return current;
}

/** Refills the daily challenge tickets if a new day has arrived. */
export function refillArenaTickets(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  const lastDay = Math.floor(state.arena.ticketsLastRefill / DAY_SECONDS);
  const currentDay = Math.floor(now / DAY_SECONDS);
  if (currentDay <= lastDay) return state;
  const next = deepClone(state);
  next.arena.tickets = data.rules.arena.dailyTickets;
  next.arena.ticketsLastRefill = now;
  return next;
}

/** When the current season began (seconds). */
export function seasonStart(now: number, data: GameData = gameData): number {
  return getSeasonWeek(now, data) * seasonSeconds(data);
}

/**
 * Soft reset after `seasons` season changes: each one keeps `rules.arena.seasonKeepRatio`
 * of the distance from the starting points (above or below them).
 */
export function arenaPointsAfterReset(
  points: number,
  seasons: number,
  data: GameData = gameData,
): number {
  const { startingPoints, seasonKeepRatio } = data.rules.arena;
  const kept = (points - startingPoints) * seasonKeepRatio ** Math.max(0, seasons);
  return Math.max(0, Math.round(startingPoints + kept));
}

/**
 * Closes the season `arena.seasonWeek` when a later one has begun: if the player fought in
 * it, its final rating becomes `lastSeason` (replacing an older one, claimed or not). Then
 * the rating is soft-reset once for every season that has ended since.
 */
export function rollArenaSeason(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  const week = getSeasonWeek(now, data);
  if (week <= state.arena.seasonWeek) return state;
  const next = deepClone(state);
  const arena = next.arena;
  if (arena.seasonFights > 0) {
    arena.lastSeason = { week: arena.seasonWeek, points: arena.points, claimed: false };
  }
  arena.points = arenaPointsAfterReset(arena.points, week - arena.seasonWeek, data);
  arena.seasonWeek = week;
  arena.seasonFights = 0;
  return next;
}

/** Arena state brought up to `now`: tickets refilled and the season rolled over. */
export function settleArena(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  return rollArenaSeason(refillArenaTickets(state, now, data), now, data);
}

/** The weekly reward waiting to be claimed (null when there is none). */
export function claimableArenaSeason(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): ArenaSeasonResult | null {
  const last = rollArenaSeason(state, now, data).arena.lastSeason;
  return last && !last.claimed ? last : null;
}

/** Checks a team: 1..teamSize distinct monsters the player owns (and, to attack, free ones). */
function checkArenaTeam(
  state: PlayerState,
  team: readonly string[],
  needFree: boolean,
  data: GameData,
): ActionError | null {
  if (team.length === 0 || team.length > data.rules.arena.teamSize) return 'invalidAmount';
  if (new Set(team).size !== team.length) return 'invalidAmount';
  const free = needFree ? new Set(serbuArmy(state)) : null;
  for (const id of team) {
    if (!state.monsters.some((m) => m.id === id)) return 'monsterNotFound';
    if (free && !free.has(id)) return 'monsterBusy';
  }
  return null;
}

function setTeam(
  state: PlayerState,
  team: readonly string[],
  field: 'team' | 'defenseTeam',
  data: GameData,
): ActionResult {
  const error = checkArenaTeam(state, team, field === 'team', data);
  if (error) return fail(error);
  const next = deepClone(state);
  next.arena[field] = [...team];
  return { ok: true, state: next };
}

/** Sets the arena attack team (monsters not on a mission or in the Soul Mixer). */
export function setArenaTeam(
  state: PlayerState,
  team: readonly string[],
  data: GameData = gameData,
): ActionResult {
  return setTeam(state, team, 'team', data);
}

/** Sets the arena defense team other players fight. */
export function setArenaDefenseTeam(
  state: PlayerState,
  team: readonly string[],
  data: GameData = gameData,
): ActionResult {
  return setTeam(state, team, 'defenseTeam', data);
}

/** Builds a Fighter for one of the player's monsters (unhurt; wounds are added by the caller). */
export function buildArenaFighter(
  state: PlayerState,
  monsterId: string,
  data: GameData = gameData,
): Fighter | null {
  const m = state.monsters.find((x) => x.id === monsterId);
  if (!m) return null;
  return {
    id: m.id,
    stats: monsterStats(m, data, getResearchBonus(state, 'monsterStatsBonus', data)),
    element: monsterElement(m, data),
    skill: true,
    elementBonus: getResearchBonus(state, 'elementAdvantageBonus', data),
  };
}

/** Arena strength of one fighter, weighted by `rules.arena.power`. */
export function arenaFighterPower(stats: FighterStats, data: GameData = gameData): number {
  const w = data.rules.arena.power;
  return Math.round(stats.hp * w.hp + stats.atk * w.atk + stats.def * w.def + stats.spd * w.spd);
}

/** Calculates total power of an arena monster team. */
export function calculateArenaTeamPower(
  state: PlayerState,
  team: readonly string[],
  data: GameData = gameData,
): number {
  return team.reduce((sum, id) => {
    const f = buildArenaFighter(state, id, data);
    return f ? sum + arenaFighterPower(f.stats, data) : sum;
  }, 0);
}

/** Creates a shareable arena defense snapshot for matchmaking. */
export function createArenaSnapshot(
  state: PlayerState,
  playerId: string,
  name: string,
  now: number,
  data: GameData = gameData,
): ArenaSnapshot {
  const { teamSize } = data.rules.arena;
  const teamIds =
    state.arena.defenseTeam.length > 0
      ? state.arena.defenseTeam
      : state.arena.team.length > 0
        ? state.arena.team
        : state.monsters.slice(0, teamSize).map((m) => m.id);

  const team: Fighter[] = [];
  for (const id of teamIds) {
    const f = buildArenaFighter(state, id, data);
    if (f) team.push(f);
  }

  return {
    id: playerId,
    name,
    level: playerLevel(state.xp, data),
    power: calculateArenaTeamPower(state, teamIds, data),
    points: state.arena.points,
    tier: getArenaTier(state.arena.points, data).name,
    team,
    updatedAt: now,
  };
}

/** Whether an opponent id belongs to a generated bot (not a real player). */
export function isArenaBotId(id: string): boolean {
  return id.startsWith(BOT_ID_PREFIX);
}

/**
 * Generates bot opponent `slot` near `targetPoints`. Same seed + slot + points always
 * gives the same bot, so the server can rebuild the bot a player picked.
 */
export function generateArenaBotOpponent(
  targetPoints: number,
  seed: string,
  slot = 0,
  data: GameData = gameData,
): ArenaSnapshot {
  const { startingPoints, bot } = data.rules.arena;
  const rng = createRng(`${seed}:${slot}`);
  const name = rng.pick(bot.names);
  const points = Math.max(
    bot.minPoints,
    targetPoints + rng.int(-bot.pointsJitter, bot.pointsJitter),
  );
  const scale = 1 + (points - startingPoints) / bot.pointsScale;
  const elements = data.elements.elements.map((e) => e.id);

  const team: Fighter[] = bot.units.map((u, i) => ({
    id: `${BOT_ID_PREFIX}unit_${i}`,
    stats: {
      hp: Math.round(u.hp * scale),
      atk: Math.round(u.atk * scale),
      def: Math.round(u.def * scale),
      spd: u.spd,
      range: u.range,
    },
    element: rng.pick(elements),
    skill: true,
  }));

  return {
    id: `${BOT_ID_PREFIX}${slot}`,
    name,
    level: Math.max(1, Math.round(points / bot.pointsPerLevel)),
    power: team.reduce((sum, f) => sum + arenaFighterPower(f.stats, data), 0),
    points,
    tier: getArenaTier(points, data).name,
    team,
    updatedAt: 0,
  };
}

/**
 * Seed for the bots offered to a player: fixed for the day until they spend a ticket,
 * and only known to whoever holds their save (the server).
 */
export function arenaBotSeed(state: PlayerState, playerId: string, now: number): string {
  return `${playerId}:${Math.floor(now / DAY_SECONDS)}:${state.arena.tickets}`;
}

/** Up to `count` opponents: the closest-rated snapshots in the pool, then bots. */
export function matchmakeArenaOpponents(
  myPoints: number,
  pool: readonly ArenaSnapshot[],
  botSeed: string,
  count: number,
  data: GameData = gameData,
): ArenaSnapshot[] {
  const out = pool
    .filter((s) => s.team.length > 0)
    .sort((a, b) => Math.abs(a.points - myPoints) - Math.abs(b.points - myPoints))
    .slice(0, count);
  for (let slot = 0; out.length < count; slot++) {
    out.push(generateArenaBotOpponent(myPoints, botSeed, slot, data));
  }
  return out;
}

/** The bot behind `id` as matchmaking offered it, or null for an unknown id. */
export function resolveArenaBot(
  id: string,
  myPoints: number,
  botSeed: string,
  count: number,
  data: GameData = gameData,
): ArenaSnapshot | null {
  if (!isArenaBotId(id)) return null;
  const slot = Number(id.slice(BOT_ID_PREFIX.length));
  if (!Number.isInteger(slot) || slot < 0 || slot >= count) return null;
  return generateArenaBotOpponent(myPoints, botSeed, slot, data);
}

/** Whether a real player's rating is close enough to be challenged. */
export function isArenaOpponentInRange(
  myPoints: number,
  theirPoints: number,
  data: GameData = gameData,
): boolean {
  return Math.abs(theirPoints - myPoints) <= data.rules.arena.matchRange;
}

/**
 * Simulates a 3v3 Arena duel. `opponent` must come from the server's own records
 * (a stored snapshot or a rebuilt bot), never from the client. Wounded monsters start
 * hurt; nobody dies or gains wounds in the Arena.
 */
export function fightArena(
  state: PlayerState,
  opponent: ArenaSnapshot,
  now: number,
  data: GameData = gameData,
): { ok: true; state: PlayerState; result: ArenaBattleResult } | { ok: false; error: ActionError } {
  const rules = data.rules.arena;
  const current = settleArena(state, now, data);
  if (current.arena.tickets <= 0) return fail('noTickets');
  if (current.arena.team.length === 0) return fail('monsterNotFound');

  const free = new Set(serbuArmy(current));
  const attackers: Fighter[] = [];
  for (const id of current.arena.team) {
    const f = buildArenaFighter(current, id, data);
    if (f && free.has(id)) attackers.push(withWounds(current, f));
  }
  if (attackers.length === 0) return fail('monsterBusy');

  const defenders = opponent.team
    .slice(0, rules.teamSize)
    .map((f, i): Fighter => ({ ...deepClone(f), id: `${DEFENDER_ID_PREFIX}${i}` }));
  if (defenders.length === 0) return fail('opponentNotFound');

  const next = deepClone(current);
  next.arena.tickets -= 1;
  next.arena.seasonFights += 1;

  const rng = createRng(next.rngState);
  const lastColumn = rules.grid.columns - 1;
  const cells: Record<string, { x: number; y: number }> = {};
  attackers.forEach((f, i) => {
    cells[f.id] = { x: 0, y: i + 1 };
  });
  defenders.forEach((f, i) => {
    cells[f.id] = { x: lastColumn, y: i + 1 };
  });

  const battle = simulateBattle(attackers, defenders, rng.int(0, 0x7fffffff), data, {
    grid: rules.grid,
    sideColumns: rules.sideColumns,
    cells,
  });

  const won = battle.winner === 'attackers';
  const pointsDelta = won ? rules.winPoints : -rules.lossPoints;
  next.arena.points = Math.max(0, next.arena.points + pointsDelta);

  const reward = won ? rules.winReward : rules.lossReward;
  payReward(next, reward);

  const entry: ArenaHistoryEntry = {
    id: `arena_${now}_${rng.int(100, 999)}`,
    opponentId: opponent.id,
    opponentName: opponent.name,
    opponentLevel: opponent.level,
    opponentPower: opponent.power,
    won,
    pointsDelta,
    reward,
    timestamp: now,
  };
  next.arena.history = [entry, ...next.arena.history].slice(0, rules.historyLimit);
  next.rngState = rng.getState();

  return { ok: true, state: next, result: { won, pointsDelta, reward, replay: battle } };
}

/** Claims the weekly reward of the last finished season the player fought in. */
export function claimArenaSeasonReward(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): ActionResult {
  const next = deepClone(rollArenaSeason(state, now, data));
  const last = next.arena.lastSeason;
  if (!last) return fail('notReady');
  if (last.claimed) return fail('alreadyFinished');
  last.claimed = true;
  payReward(next, getArenaTier(last.points, data).weeklyReward);
  return { ok: true, state: next };
}
