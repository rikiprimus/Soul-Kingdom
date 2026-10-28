import { describe, expect, it } from 'vitest';
import {
  arenaBotSeed,
  arenaPointsAfterReset,
  claimableArenaSeason,
  claimArenaSeasonReward,
  createArenaSnapshot,
  fightArena,
  generateArenaBotOpponent,
  getArenaTier,
  getSeasonWeek,
  isArenaOpponentInRange,
  matchmakeArenaOpponents,
  refillArenaTickets,
  resolveArenaBot,
  rollArenaSeason,
  seasonSecondsRemaining,
  seasonStart,
  setArenaDefenseTeam,
  setArenaTeam,
  type ArenaSnapshot,
} from './arena';
import { deepClone } from './clone';
import { gameData } from './data';
import { createInitialState, type PlayerState } from './state';
import { deserializeState } from './save';

const T0 = 1_000_000;
const DAY = 86400;
const rules = gameData.rules.arena;
const SEASON = rules.seasonDays * DAY;

function stateWithMonsters() {
  const s = createInitialState(T0, 42);
  const adult = gameData.rules.growth.stages[gameData.rules.growth.stages.length - 1]!.id;
  s.monsters = [
    { id: 'm1', form: 'kucing', element: 'api', stage: adult, food: 100 },
    { id: 'm2', form: 'anjing', element: 'air', stage: adult, food: 100 },
    { id: 'm3', form: 'landak', element: 'tanah', stage: adult, food: 100 },
    { id: 'm4', form: 'kelinci', element: 'angin', stage: adult, food: 100 },
  ];
  return s;
}

function withTeam(s: PlayerState, team = ['m1', 'm2', 'm3']): PlayerState {
  const res = setArenaTeam(s, team);
  if (!res.ok) throw new Error(`setArenaTeam failed: ${res.error}`);
  return res.state;
}

describe('Arena tiers and season', () => {
  it('identifies correct tiers according to points', () => {
    expect(getArenaTier(800).id).toBe('perunggu');
    expect(getArenaTier(1000).id).toBe('perunggu');
    expect(getArenaTier(1150).id).toBe('perak');
    expect(getArenaTier(1350).id).toBe('emas');
    expect(getArenaTier(1550).id).toBe('berlian');
    expect(getArenaTier(1850).id).toBe('master');
  });

  it('uses rules.arena.seasonDays for the season length', () => {
    expect(getSeasonWeek(T0)).toBe(Math.floor(T0 / SEASON));
    const remaining = seasonSecondsRemaining(T0);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(SEASON);
    const longer = {
      ...gameData,
      rules: { ...gameData.rules, arena: { ...rules, seasonDays: 14 } },
    };
    expect(getSeasonWeek(T0, longer)).toBe(Math.floor(T0 / (14 * DAY)));
  });

  it('starts new players from the rules', () => {
    const s = createInitialState(T0, 1);
    expect(s.arena.points).toBe(rules.startingPoints);
    expect(s.arena.tickets).toBe(rules.dailyTickets);
    expect(s.arena.seasonWeek).toBe(getSeasonWeek(T0));
    expect(s.arena.lastSeason).toBeNull();
  });
});

describe('Arena tickets refill', () => {
  it('refills tickets after a new day begins', () => {
    const s = stateWithMonsters();
    s.arena.tickets = 1;
    s.arena.ticketsLastRefill = T0;
    expect(refillArenaTickets(s, T0 + 3600).arena.tickets).toBe(1);
    const nextDay = refillArenaTickets(s, T0 + DAY + 1);
    expect(nextDay.arena.tickets).toBe(rules.dailyTickets);
    expect(nextDay.arena.ticketsLastRefill).toBe(T0 + DAY + 1);
  });
});

describe('Arena team selection', () => {
  it('sets attack team up to teamSize valid monsters', () => {
    const s = withTeam(stateWithMonsters());
    expect(s.arena.team).toEqual(['m1', 'm2', 'm3']);
  });

  it('rejects duplicate, unknown or too many monsters', () => {
    const s = stateWithMonsters();
    expect(setArenaTeam(s, ['m1', 'm1', 'm2']).ok).toBe(false);
    expect(setArenaTeam(s, ['m1', 'nonexistent', 'm2'])).toEqual({
      ok: false,
      error: 'monsterNotFound',
    });
    expect(setArenaTeam(s, ['m1', 'm2', 'm3', 'm4']).ok).toBe(false);
    expect(setArenaTeam(s, []).ok).toBe(false);
  });

  it('rejects monsters busy in the Soul Mixer for attack, but not for defense', () => {
    const s = stateWithMonsters();
    s.mixQueue = [{ parents: [{ id: 'm1' }] } as unknown as PlayerState['mixQueue'][number]];
    expect(setArenaTeam(s, ['m1', 'm2'])).toEqual({ ok: false, error: 'monsterBusy' });
    const def = setArenaDefenseTeam(s, ['m1', 'm2']);
    expect(def.ok).toBe(true);
    if (def.ok) expect(def.state.arena.defenseTeam).toEqual(['m1', 'm2']);
  });

  it('snapshot uses the player level and the defense team', () => {
    const res = setArenaDefenseTeam(stateWithMonsters(), ['m2', 'm3', 'm4']);
    if (!res.ok) throw new Error('defense');
    const snap = createArenaSnapshot(res.state, 'p1', 'Alpha', T0);
    expect(snap.team.map((f) => f.id)).toEqual(['m2', 'm3', 'm4']);
    expect(snap.level).toBe(1);
    expect(snap.updatedAt).toBe(T0);
    expect(snap.power).toBeGreaterThan(0);
  });
});

describe('Arena bots and matchmaking', () => {
  it('generates the same bot for the same seed, slot and points', () => {
    const a = generateArenaBotOpponent(1050, 'seed', 1);
    const b = generateArenaBotOpponent(1050, 'seed', 1);
    expect(a).toEqual(b);
    expect(a.id).toBe('arena_bot_1');
    expect(a.team.length).toBe(rules.bot.units.length);
    expect(Math.abs(a.points - 1050)).toBeLessThanOrEqual(rules.bot.pointsJitter);
    expect(a.power).toBeGreaterThan(0);
  });

  it('fills the offer with bots the server can rebuild by id', () => {
    const real: ArenaSnapshot = {
      ...generateArenaBotOpponent(1020, 'x', 0),
      id: 'player_alpha',
      points: 1020,
    };
    const offer = matchmakeArenaOpponents(1000, [real], 'seed', rules.opponentsOffered);
    expect(offer.length).toBe(rules.opponentsOffered);
    expect(offer[0]!.id).toBe('player_alpha');
    for (const op of offer.slice(1)) {
      expect(resolveArenaBot(op.id, 1000, 'seed', rules.opponentsOffered)).toEqual(op);
    }
  });

  it('refuses bot ids outside the offer and non-bot ids', () => {
    const n = rules.opponentsOffered;
    expect(resolveArenaBot(`arena_bot_${n}`, 1000, 'seed', n)).toBeNull();
    expect(resolveArenaBot('arena_bot_-1', 1000, 'seed', n)).toBeNull();
    expect(resolveArenaBot('arena_bot_x', 1000, 'seed', n)).toBeNull();
    expect(resolveArenaBot('player_alpha', 1000, 'seed', n)).toBeNull();
  });

  it('changes the bot seed after a ticket is spent', () => {
    const s = stateWithMonsters();
    const before = arenaBotSeed(s, 'p1', T0);
    s.arena.tickets -= 1;
    expect(arenaBotSeed(s, 'p1', T0)).not.toBe(before);
  });

  it('only allows real opponents within matchRange', () => {
    expect(isArenaOpponentInRange(1000, 1000 + rules.matchRange)).toBe(true);
    expect(isArenaOpponentInRange(1000, 1000 + rules.matchRange + 1)).toBe(false);
  });
});

describe('Arena duel combat', () => {
  it('consumes a ticket, adjusts points, pays the reward and records history', () => {
    const s = withTeam(stateWithMonsters());
    const bot = generateArenaBotOpponent(1000, 'seed', 0);
    const duel = fightArena(s, bot, T0 + 100);
    expect(duel.ok).toBe(true);
    if (!duel.ok) return;

    expect(duel.state.arena.tickets).toBe(s.arena.tickets - 1);
    expect(duel.state.arena.seasonFights).toBe(1);
    expect(duel.state.arena.history.length).toBe(1);
    const entry = duel.state.arena.history[0]!;
    expect(entry.opponentId).toBe(bot.id);
    expect(entry).not.toHaveProperty('replay');
    expect(duel.result.replay.events.length).toBeGreaterThan(0);

    const reward = duel.result.won ? rules.winReward : rules.lossReward;
    expect(entry.reward).toEqual(reward);
    expect(duel.state.resources.gold).toBe(s.resources.gold + reward.gold);
    const delta = duel.result.won ? rules.winPoints : -rules.lossPoints;
    expect(duel.result.pointsDelta).toBe(delta);
    expect(duel.state.arena.points).toBe(s.arena.points + delta);
  });

  it('keeps attackers and defenders apart when their monster ids are the same', () => {
    const s = withTeam(stateWithMonsters());
    const mirror = createArenaSnapshot(s, 'p2', 'Mirror', T0);
    expect(mirror.team.map((f) => f.id)).toEqual(['m1', 'm2', 'm3']);
    const duel = fightArena(s, mirror, T0 + 100);
    if (!duel.ok) throw new Error(duel.error);
    const starts = duel.result.replay.events.filter((e) => e.kind === 'start');
    expect(new Set(starts.map((e) => e.id)).size).toBe(6);
    const sides = Object.fromEntries(starts.map((e) => [e.id, e.kind === 'start' && e.side]));
    expect(sides['m1']).toBe('attackers');
    expect(sides['arena_def_0']).toBe('defenders');
  });

  it('starts wounded monsters with the HP they have left', () => {
    const s = withTeam(stateWithMonsters());
    const bot = generateArenaBotOpponent(1000, 'seed', 0);
    const hurt = deepClone(s);
    hurt.healing.wounds = { m1: 0.99, m2: 0.99, m3: 0.99 };
    const healthy = fightArena(s, bot, T0 + 100);
    const wounded = fightArena(hurt, bot, T0 + 100);
    if (!healthy.ok || !wounded.ok) throw new Error('duel');
    expect(wounded.result.replay).not.toEqual(healthy.result.replay);
    expect(wounded.state.healing.wounds).toEqual(hurt.healing.wounds);
  });

  it('skips monsters that became busy after the team was set', () => {
    const s = withTeam(stateWithMonsters(), ['m1']);
    s.mixQueue = [{ parents: [{ id: 'm1' }] } as unknown as PlayerState['mixQueue'][number]];
    const duel = fightArena(s, generateArenaBotOpponent(1000, 'seed', 0), T0);
    expect(duel).toEqual({ ok: false, error: 'monsterBusy' });
  });

  it('fails if player has no tickets', () => {
    const s = withTeam(stateWithMonsters());
    s.arena.tickets = 0;
    const duel = fightArena(s, generateArenaBotOpponent(1000, 'seed', 0), T0);
    expect(duel).toEqual({ ok: false, error: 'noTickets' });
  });

  it('caps the history at historyLimit', () => {
    let s = withTeam(stateWithMonsters());
    const bot = generateArenaBotOpponent(1000, 'seed', 0);
    for (let i = 0; i < rules.historyLimit + 2; i++) {
      s.arena.tickets = 1;
      const duel = fightArena(s, bot, T0 + i);
      if (!duel.ok) throw new Error(duel.error);
      s = duel.state;
    }
    expect(s.arena.history.length).toBe(rules.historyLimit);
  });
});

describe('Arena weekly rewards', () => {
  const week = getSeasonWeek(T0);
  const nextSeason = (week + 1) * SEASON + 100;

  it('pays the tier the player had when the season ended, once', () => {
    let s = withTeam(stateWithMonsters());
    const duel = fightArena(s, generateArenaBotOpponent(1000, 'seed', 0), T0);
    if (!duel.ok) throw new Error(duel.error);
    s = duel.state;
    s.arena.points = 1400; // Emas when the season ended

    expect(claimableArenaSeason(s, T0)).toBeNull();
    expect(claimArenaSeasonReward(s, T0).ok).toBe(false);

    const rolled = rollArenaSeason(s, nextSeason);
    expect(rolled.arena.lastSeason).toEqual({ week, points: 1400, claimed: false });
    // Climbing in the new season does not change the reward of the old one.
    rolled.arena.points = 1900;

    const claim = claimArenaSeasonReward(rolled, nextSeason);
    if (!claim.ok) throw new Error(claim.error);
    const emas = getArenaTier(1400).weeklyReward;
    expect(claim.state.resources.gold).toBe(rolled.resources.gold + emas.gold);
    expect(claim.state.resources.gems).toBe(rolled.resources.gems + emas.gems);
    expect(claimArenaSeasonReward(claim.state, nextSeason)).toEqual({
      ok: false,
      error: 'alreadyFinished',
    });
  });

  it('gives nothing for a season the player never fought in', () => {
    const s = stateWithMonsters();
    expect(claimableArenaSeason(s, nextSeason)).toBeNull();
    expect(claimArenaSeasonReward(s, nextSeason)).toEqual({ ok: false, error: 'notReady' });
  });
});

describe('Arena season soft reset', () => {
  const start = rules.startingPoints;
  const keep = rules.seasonKeepRatio;
  const week = getSeasonWeek(T0);

  it('keeps seasonKeepRatio of the distance from the starting points per season', () => {
    expect(arenaPointsAfterReset(start + 600, 1)).toBe(Math.round(start + 600 * keep));
    expect(arenaPointsAfterReset(start - 200, 1)).toBe(Math.round(start - 200 * keep));
    expect(arenaPointsAfterReset(start + 600, 2)).toBe(Math.round(start + 600 * keep * keep));
    expect(arenaPointsAfterReset(start + 600, 0)).toBe(start + 600);
    expect(arenaPointsAfterReset(start, 3)).toBe(start);
  });

  it('resets once per season that ended, and records the final rating first', () => {
    const s = stateWithMonsters();
    s.arena.points = start + 600;
    s.arena.seasonFights = 2;
    const oneLater = rollArenaSeason(s, (week + 1) * SEASON);
    expect(oneLater.arena.lastSeason).toEqual({ week, points: start + 600, claimed: false });
    expect(oneLater.arena.points).toBe(arenaPointsAfterReset(start + 600, 1));
    expect(oneLater.arena.seasonWeek).toBe(week + 1);
    expect(oneLater.arena.seasonFights).toBe(0);

    const threeLater = rollArenaSeason(s, (week + 3) * SEASON);
    expect(threeLater.arena.points).toBe(arenaPointsAfterReset(start + 600, 3));
    // Rolling again in the same season changes nothing.
    expect(rollArenaSeason(oneLater, (week + 1) * SEASON + 100)).toBe(oneLater);
  });

  it('applies the reset before a duel in the new season', () => {
    const s = withTeam(stateWithMonsters());
    s.arena.points = start + 600;
    const duel = fightArena(s, generateArenaBotOpponent(start, 'seed', 0), (week + 1) * SEASON);
    if (!duel.ok) throw new Error(duel.error);
    const reset = arenaPointsAfterReset(start + 600, 1);
    expect(duel.state.arena.points).toBe(Math.max(0, reset + duel.result.pointsDelta));
  });

  it('knows when the current season began', () => {
    expect(seasonStart(T0)).toBe(week * SEASON);
    expect(seasonStart(T0)).toBeLessThanOrEqual(T0);
  });
});

describe('Save migration v33 -> v34', () => {
  it('migrates save v33 to v34 with initial arena state', () => {
    const rawState = JSON.parse(JSON.stringify(stateWithMonsters()));
    delete rawState.arena;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 33, state: rawState }));
    expect(loaded.arena.points).toBe(rules.startingPoints);
    expect(loaded.arena.tickets).toBe(rules.dailyTickets);
    expect(loaded.arena.team).toEqual([]);
    expect(loaded.arena.defenseTeam).toEqual([]);
    expect(loaded.arena.lastSeason).toBeNull();
    expect(loaded.arena.history).toEqual([]);
  });
});
