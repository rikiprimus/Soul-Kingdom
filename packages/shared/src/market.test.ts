import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import {
  bestMarketLevel,
  drawMarket,
  marketDrawStatus,
  marketTableIndex,
  rollMarketPrize,
} from './market';
import { dayNumber } from './quests';
import { createRng } from './rng';
import { deserializeState, serializeState } from './save';
import { runAction } from './server/actions';
import { createInitialState, type ActionResult, type PlayerState } from './state';

const { marketDraw, daily } = gameData.rules;
const DAY = 86400;
/** Noon of a day, so a few hours either way stay on the same day. */
const T0 = 20_000 * DAY + 12 * 3600 - daily.dayOffsetSeconds;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** A new game (it starts with one Pasar) whose Pasars are all at `level`. */
function withMarket(level: number, seed = 7): PlayerState {
  const s = createInitialState(T0, seed);
  for (const b of s.village.buildings) if (b.type === marketDraw.building) b.level = level;
  return s;
}

describe('Undian Harian', () => {
  it('is free once a day per account and opens again the next day', () => {
    const s = withMarket(1);
    expect(marketDrawStatus(s, T0).available).toBe(true);
    const r = ok(drawMarket(s, T0));
    expect(r.state.marketDraw.lastDay).toBe(dayNumber(T0));
    expect(drawMarket(r.state, T0 + 3600)).toEqual({ ok: false, error: 'alreadyClaimed' });
    const status = marketDrawStatus(r.state, T0 + 3600);
    expect(status.available).toBe(false);
    expect(status.nextIn).toBe(12 * 3600 - 3600);
    expect(dayNumber(T0 + 3600 + status.nextIn)).toBe(dayNumber(T0) + 1);
    expect(marketDrawStatus(r.state, T0 + DAY).available).toBe(true);
    ok(drawMarket(r.state, T0 + DAY));
  });

  it('needs a finished Pasar', () => {
    const s = createInitialState(T0, 7);
    s.village.buildings = s.village.buildings.filter((b) => b.type !== marketDraw.building);
    expect(marketDrawStatus(s, T0)).toMatchObject({ hasMarket: false, available: false });
    expect(drawMarket(s, T0)).toEqual({ ok: false, error: 'noMarket' });
    const building = withMarket(0);
    expect(drawMarket(building, T0)).toEqual({ ok: false, error: 'noMarket' });
  });

  it('rolls on the table of the highest Pasar level', () => {
    const s = withMarket(1);
    const second = { ...s.village.buildings.find((b) => b.type === marketDraw.building)! };
    s.village.buildings.push({ ...second, id: 'pasar2', x: 0, y: 0, level: 5 });
    expect(bestMarketLevel(s)).toBe(5);
    expect(marketDrawStatus(s, T0).table).toBe(marketTableIndex(5));
    const levels = gameData.buildingById.get(marketDraw.building)!.levels.length;
    for (let level = 1; level <= levels; level++) {
      const i = marketTableIndex(level);
      expect(marketDraw.tables[i]!.minLevel).toBeLessThanOrEqual(level);
      expect(marketDraw.tables[i + 1]?.minLevel ?? Infinity).toBeGreaterThan(level);
    }
  });

  it('higher tables give more of every resource and a better chance of a Telur Jiwa', () => {
    const best = (i: number, key: 'gold' | 'food' | 'wood' | 'stone' | 'soulCrystal') =>
      Math.max(...marketDraw.tables[i]!.prizes.map((p) => p.prize[key]));
    const eggChance = (i: number) => {
      const { prizes } = marketDraw.tables[i]!;
      const total = prizes.reduce((sum, p) => sum + p.weight, 0);
      return prizes.filter((p) => p.prize.soulEggs > 0).reduce((s, p) => s + p.weight, 0) / total;
    };
    for (let i = 1; i < marketDraw.tables.length; i++) {
      for (const key of ['gold', 'food', 'wood', 'stone', 'soulCrystal'] as const) {
        expect(best(i, key)).toBeGreaterThan(best(i - 1, key));
      }
      expect(eggChance(i)).toBeGreaterThan(eggChance(i - 1));
    }
    // A rare prize, never a monster (rule 7).
    for (let i = 0; i < marketDraw.tables.length; i++) {
      expect(eggChance(i)).toBeGreaterThan(0);
      expect(eggChance(i)).toBeLessThanOrEqual(0.05);
    }
  });

  it('pays prizes by weight (Monte Carlo, 100 000 rolls per table)', () => {
    const N = 100_000;
    marketDraw.tables.forEach((table, t) => {
      const rng = createRng(1000 + t);
      const counts = new Array<number>(table.prizes.length).fill(0);
      for (let i = 0; i < N; i++) counts[rollMarketPrize(t, rng.next()).index]! += 1;
      const total = table.prizes.reduce((sum, p) => sum + p.weight, 0);
      table.prizes.forEach((p, i) => {
        const expected = p.weight / total;
        // Within 4 standard deviations of the binomial count.
        const tolerance = 4 * Math.sqrt((expected * (1 - expected)) / N);
        expect(Math.abs(counts[i]! / N - expected)).toBeLessThan(tolerance);
      });
    });
  });

  it('pays resources, sends decorations to the Gudang and gives Telur Jiwa', () => {
    const seen = { resource: false, decoration: false, egg: false };
    for (let seed = 1; seed < 3000 && !(seen.resource && seen.decoration && seen.egg); seed++) {
      const s = withMarket(6, seed);
      const r = ok(drawMarket(s, T0));
      const { prize } = r;
      if (prize.decorations.length > 0) {
        seen.decoration = true;
        expect(r.state.storage.map((x) => x.type).sort()).toEqual(
          [...s.storage.map((x) => x.type), ...prize.decorations].sort(),
        );
      } else if (prize.soulEggs > 0) {
        seen.egg = true;
        expect(r.state.soulEggs).toHaveLength(s.soulEggs.length + prize.soulEggs);
        expect(r.state.monsters).toEqual(s.monsters);
      } else {
        seen.resource = true;
        expect(r.state.resources.gold).toBe(s.resources.gold + prize.gold);
        expect(r.state.resources.stone).toBe(s.resources.stone + prize.stone);
        expect(r.state.resources.soulCrystal).toBe(s.resources.soulCrystal + prize.soulCrystal);
      }
      expect(r.state.resources.gems).toBe(s.resources.gems);
    }
    expect(seen).toEqual({ resource: true, decoration: true, egg: true });
  });

  it('is deterministic for the same state and time', () => {
    const a = ok(drawMarket(withMarket(3, 99), T0));
    const b = ok(drawMarket(withMarket(3, 99), T0));
    expect(a.prize).toEqual(b.prize);
    expect(a.state.rngState).toBe(b.state.rngState);
  });

  it('runs as a server action', () => {
    const r = runAction(withMarket(1), 'drawMarket', {}, T0);
    expect(r.ok).toBe(true);
  });

  it('saves the draw day; saves from v27 start with today’s draw free', () => {
    const drawn = ok(drawMarket(withMarket(1), T0)).state;
    expect(deserializeState(serializeState(drawn)).marketDraw).toEqual(drawn.marketDraw);
    const old = withMarket(1) as Partial<PlayerState>;
    delete old.marketDraw;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 27, state: old }));
    expect(loaded.marketDraw).toEqual({ lastDay: null });
    expect(marketDrawStatus(loaded, T0).available).toBe(true);
  });
});
