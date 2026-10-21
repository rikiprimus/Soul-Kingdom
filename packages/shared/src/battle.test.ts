import { describe, expect, it } from 'vitest';
import { estimateWinChance, simulateBattle, type Fighter, type FighterStats } from './battle';
import { gameData } from './data';
import { elementAdvantage } from './elements';

const { battle } = gameData.rules;
const { sim } = battle;

const stats = (over: Partial<FighterStats> = {}): FighterStats => ({
  hp: 100,
  atk: 20,
  def: 10,
  spd: 10,
  range: 1,
  ...over,
});
const fighter = (id: string, over: Partial<Fighter> = {}): Fighter => ({
  id,
  stats: stats(),
  element: null,
  skill: false,
  ...over,
});

describe('simulateBattle', () => {
  it('gives the same result for the same fighters and seed', () => {
    const a = [fighter('a1'), fighter('a2', { stats: stats({ range: 4, hp: 70 }) })];
    const d = [fighter('d1'), fighter('d2', { element: 'api', skill: true })];
    for (const seed of [1, 42, 999_999]) {
      expect(simulateBattle(a, d, seed)).toEqual(simulateBattle(a, d, seed));
    }
    const runs = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(simulateBattle(a, d, s))));
    expect(runs.size).toBeGreaterThan(1);
  });

  it('always ends before maxTicks; a stall counts as a loss for the attackers', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = simulateBattle([fighter('a'), fighter('b')], [fighter('c')], seed);
      expect(r.ticks).toBeLessThanOrEqual(battle.maxTicks);
    }
    // Neither side can hurt the other in time: tanks with 1 attack against huge HP.
    const tank = (id: string) => fighter(id, { stats: stats({ hp: 1e9, atk: 1 }) });
    const r = simulateBattle([tank('a')], [tank('d')], 7);
    expect(r.ticks).toBe(battle.maxTicks);
    expect(r.winner).toBe('defenders');
  });

  it('fights on past maxTicks until one side falls when untilDefeat is set', () => {
    // 1 damage a second against 4 000 HP takes far longer than maxTicks.
    const slow = (id: string) => fighter(id, { stats: stats({ hp: 4000, atk: 1, def: 0 }) });
    const r = simulateBattle([slow('a'), slow('b')], [slow('d')], 9, gameData, {
      untilDefeat: true,
    });
    expect(r.ticks).toBeGreaterThan(battle.maxTicks);
    expect(r.winner).toBe('attackers');
    expect(r.hp.d).toBe(0);
  });

  it('never stalls at the edge of range: untilDefeat fights end with one side gone', () => {
    const team = [fighter('a'), fighter('b', { stats: stats({ hp: 160, def: 14, spd: 8 }) })];
    const foes = [0, 1, 2, 3].map((i) =>
      fighter(`x${i}`, { stats: stats({ hp: 120, atk: 10, def: 8, spd: 9 }) }),
    );
    for (let seed = 0; seed < 300; seed++) {
      const r = simulateBattle(team, foes, seed * 7919, gameData, { untilDefeat: true });
      expect(r.ticks).toBeLessThan(battle.maxTicks);
      const loser = r.winner === 'attackers' ? foes : team;
      for (const f of loser) expect(r.hp[f.id]).toBe(0);
    }
  });

  it('hits for atk × element edge × defenseK / (defenseK + def), within the variance', () => {
    const a = fighter('a', { element: 'air', stats: stats({ atk: 40 }) });
    const d = fighter('d', { element: 'api', stats: stats({ def: 25, hp: 1e6, atk: 1 }) });
    const r = simulateBattle([a], [d], 3);
    const base = 40 * elementAdvantage('air', 'api') * (sim.defenseK / (sim.defenseK + 25));
    const hits = r.events.filter((e) => e.kind === 'attack' && e.id === 'a');
    expect(hits.length).toBeGreaterThan(5);
    for (const e of hits) {
      if (e.kind !== 'attack') continue;
      expect(e.damage).toBeGreaterThanOrEqual(Math.round(base * (1 - sim.damageVariance)) - 1);
      expect(e.damage).toBeLessThanOrEqual(Math.round(base * (1 + sim.damageVariance)) + 1);
    }
  });

  it('turns every skillEvery-th monster attack into a skill; soldiers never use one', () => {
    const monster = fighter('m', { element: 'api', skill: true });
    const soldier = fighter('s');
    const wall = fighter('w', { stats: stats({ hp: 1e6, atk: 1 }) });
    const r = simulateBattle([monster, soldier], [wall], 5);
    const own = r.events.filter((e) => (e.kind === 'attack' || e.kind === 'skill') && e.id === 'm');
    own.forEach((e, i) => expect(e.kind).toBe((i + 1) % sim.skillEvery === 0 ? 'skill' : 'attack'));
    expect(r.events.some((e) => e.kind === 'skill' && e.id === 's')).toBe(false);
  });

  it('logs starting cells on each side and a death for everyone left at 0 HP', () => {
    const r = simulateBattle([fighter('a', { stats: stats({ atk: 80 }) })], [fighter('d')], 11);
    const starts = r.events.filter((e) => e.kind === 'start');
    for (const s of starts) {
      if (s.kind !== 'start') continue;
      const left = s.x < 2;
      expect(left).toBe(s.side === 'attackers');
      expect(s.y).toBeLessThan(battle.grid.rows + 1);
    }
    expect(r.winner).toBe('attackers');
    expect(r.hp.d).toBe(0);
    expect(r.events.some((e) => e.kind === 'death' && e.id === 'd')).toBe(true);
  });

  it('keeps fixed fighters (towers) on their starting cell; they only shoot what is in range', () => {
    const tower = fighter('t', { stats: stats({ range: 3, hp: 400 }), fixed: true });
    const r = simulateBattle([fighter('a'), fighter('b')], [tower], 5, gameData, {
      untilDefeat: true,
    });
    const start = r.events.find((e) => e.kind === 'start' && e.id === 't');
    const shots = r.events.filter((e) => e.kind === 'attack' && e.id === 't');
    expect(shots.length).toBeGreaterThan(0);
    for (const e of shots) {
      if (e.kind !== 'attack' || start?.kind !== 'start') continue;
      expect([e.x, e.y]).toEqual([start.x, start.y]);
    }
  });

  it('lets the stronger side win more often (Monte Carlo)', () => {
    const weak = [fighter('a')];
    const strong = [fighter('a'), fighter('b')];
    const enemy = [fighter('x'), fighter('y', { stats: stats({ hp: 60 }) })];
    const runs = 400;
    expect(estimateWinChance(strong, enemy, runs)).toBeGreaterThan(
      estimateWinChance(weak, enemy, runs),
    );
    expect(estimateWinChance([], enemy, runs)).toBe(0);
    // Mirror match: about even.
    const even = estimateWinChance([fighter('a')], [fighter('d')], 2000);
    expect(Math.abs(even - 0.5)).toBeLessThan(0.1);
  });
});
