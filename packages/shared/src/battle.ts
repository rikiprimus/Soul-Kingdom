import { gameData, type ElementId, type GameData } from './data';
import { elementAdvantage } from './elements';
import { createRng, type RngState } from './rng';

/** Battle stats of one fighter (monster, soldier or bandit). */
export interface FighterStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  range: number;
}

/** A fighter going into battle. Monsters have an element and use element skills. */
export interface Fighter {
  id: string;
  stats: FighterStats;
  element: ElementId | null;
  skill: boolean;
}

export type Side = 'attackers' | 'defenders';

/** What happened, by tick, so a battle can be shown again exactly. */
export type BattleEvent =
  | { tick: number; kind: 'start'; id: string; side: Side; x: number; y: number }
  | {
      tick: number;
      kind: 'attack' | 'skill';
      id: string;
      target: string;
      damage: number;
      x: number;
      y: number;
    }
  | { tick: number; kind: 'death'; id: string };

export interface BattleResult {
  winner: Side;
  ticks: number;
  /** HP left per fighter id (0 = fallen). */
  hp: Record<string, number>;
  events: BattleEvent[];
}

const EPS = 1e-6;

/** Safety net for untilDefeat fights (about 14 hours of battle at 20 ticks/s). */
const HARD_STOP = 1_000_000;

interface Live {
  f: Fighter;
  side: Side;
  x: number;
  y: number;
  hp: number;
  cooldown: number;
  attacks: number;
}

/**
 * Pure, deterministic auto-battle on the `rules.battle.grid` field (columns × rows,
 * one tile per cell). Attackers start in the two left columns, defenders in the two
 * right ones, on cells picked by the seeded RNG. Every tick each living fighter, in a
 * fixed order, walks towards its nearest enemy until it is in range, then attacks on its
 * cooldown. Same fighters + same seed always give the same result; when `maxTicks` runs
 * out the attackers have failed.
 */
export function simulateBattle(
  attackers: readonly Fighter[],
  defenders: readonly Fighter[],
  seed: RngState,
  data: GameData = gameData,
  opts: { untilDefeat?: boolean } = {},
): BattleResult {
  const { grid, maxTicks, ticksPerSecond, sim } = data.rules.battle;
  const rng = createRng(seed);
  const dt = 1 / ticksPerSecond;
  const events: BattleEvent[] = [];
  const place = (team: readonly Fighter[], side: Side, columns: number[]) => {
    const cells = rng.shuffle(
      columns.flatMap((x) => Array.from({ length: grid.rows }, (_, y) => ({ x, y }))),
    );
    return team.map((f, i): Live => {
      // More fighters than cells: later ones share a cell, nudged so they do not overlap.
      const cell = cells[i % cells.length]!;
      const nudge = Math.floor(i / cells.length) * 0.3;
      const unit = {
        f,
        side,
        x: cell.x + 0.5,
        y: cell.y + 0.5 + nudge,
        hp: f.stats.hp,
        cooldown: 0,
        attacks: 0,
      };
      events.push({ tick: 0, kind: 'start', id: f.id, side, x: unit.x, y: unit.y });
      return unit;
    });
  };
  const units = [
    ...place(attackers, 'attackers', [0, 1]),
    ...place(defenders, 'defenders', [grid.columns - 2, grid.columns - 1]),
  ];
  const alive = (side: Side) => units.some((u) => u.side === side && u.hp > 0);
  const interval = (u: Live) => (sim.attackSecondsAtSpd10 * 10) / u.f.stats.spd;

  // Wild fights (untilDefeat) have no time limit: one side must fall. Every hit does at
  // least minDamage, so they always end; HARD_STOP only guards against broken data.
  const limit = opts.untilDefeat ? HARD_STOP : maxTicks;
  let tick = 0;
  while (alive('attackers') && alive('defenders') && tick < limit) {
    tick += 1;
    for (const u of units) {
      if (u.hp <= 0) continue;
      let target: Live | undefined;
      let best = Infinity;
      for (const o of units) {
        if (o.side === u.side || o.hp <= 0) continue;
        const d = Math.hypot(o.x - u.x, o.y - u.y);
        if (d < best) {
          best = d;
          target = o;
        }
      }
      if (!target) break;
      u.cooldown = Math.max(0, u.cooldown - dt);
      // EPS: walking stops exactly at range, and rounding must not leave it a hair short.
      if (best > u.f.stats.range + EPS) {
        // Walk straight at the target, stopping once it is in range.
        const step = Math.min(u.f.stats.spd * sim.moveTilesPerSpd * dt, best - u.f.stats.range);
        u.x += ((target.x - u.x) / best) * step;
        u.y += ((target.y - u.y) / best) * step;
        continue;
      }
      if (u.cooldown > 0) continue;
      u.attacks += 1;
      const skill = u.f.skill && u.attacks % sim.skillEvery === 0;
      const edge =
        u.f.element && target.f.element ? elementAdvantage(u.f.element, target.f.element, data) : 1;
      const roll = 1 + sim.damageVariance * (rng.next() * 2 - 1);
      const raw =
        u.f.stats.atk * edge * (sim.defenseK / (sim.defenseK + target.f.stats.def)) * roll;
      const damage = Math.max(sim.minDamage, Math.round(raw * (skill ? sim.skillMultiplier : 1)));
      target.hp = Math.max(0, target.hp - damage);
      events.push({
        tick,
        kind: skill ? 'skill' : 'attack',
        id: u.f.id,
        target: target.f.id,
        damage,
        x: u.x,
        y: u.y,
      });
      if (target.hp === 0) events.push({ tick, kind: 'death', id: target.f.id });
      u.cooldown = interval(u);
    }
  }
  const winner: Side = alive('attackers') && !alive('defenders') ? 'attackers' : 'defenders';
  return {
    winner,
    ticks: tick,
    hp: Object.fromEntries(units.map((u) => [u.f.id, u.hp])),
    events,
  };
}

/** Share of `runs` fixed-seed simulations the attackers win (a stable preview of the odds). */
export function estimateWinChance(
  attackers: readonly Fighter[],
  defenders: readonly Fighter[],
  runs: number = gameData.rules.battle.sim.previewRuns,
  data: GameData = gameData,
  opts: { untilDefeat?: boolean } = {},
): number {
  if (attackers.length === 0) return 0;
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) {
    if (simulateBattle(attackers, defenders, seed, data, opts).winner === 'attackers') wins += 1;
  }
  return wins / runs;
}
