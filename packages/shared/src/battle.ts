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
  /** Stays where it starts (a watchtower): it only shoots what comes into range. */
  fixed?: boolean;
  /** Area damage (Menara Sihir): each hit also strikes other enemies within `radius`
   * tiles of the target for `ratio` of that hit's damage. */
  splash?: { radius: number; ratio: number };
  /** War machine (Bengkel): `multiplier` × damage against buildings (fighters that never
   * move); with `buildingsOnly` it attacks nothing else. */
  siege?: { multiplier: number; buildingsOnly: boolean };
  /** HP it starts with when wounded (Pohon Jiwa, Tugas 1C.10); `stats.hp` when not given. */
  startHp?: number;
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
  /** Positions of the living fighters every `trackEvery` ticks (only when asked, for replays). */
  frames?: BattleFrame[];
}

export interface BattleFrame {
  tick: number;
  pos: Record<string, [number, number]>;
}

export interface BattleOptions {
  /** Wild fights: no time limit, one side must fall. */
  untilDefeat?: boolean;
  /** Field size; `rules.battle.grid` when not given. */
  grid?: { columns: number; rows: number };
  /** How many columns each side starts in, from its own edge (2 when not given). */
  sideColumns?: number;
  /** Starting cells chosen by the player (Serbu), by fighter id; the rest are seeded. */
  cells?: Readonly<Record<string, { x: number; y: number }>>;
  /** Record every fighter's position every this many ticks (replays). */
  trackEvery?: number;
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
 * one tile per cell; Serbu passes its own `grid`). Attackers start in the left
 * `sideColumns` columns, defenders in the right ones, on cells picked by the seeded RNG
 * unless `cells` places them. Every tick each living fighter, in a
 * fixed order, walks towards its nearest enemy until it is in range, then attacks on its
 * cooldown. Same fighters + same seed always give the same result; when `maxTicks` runs
 * out the attackers have failed.
 */
export function simulateBattle(
  attackers: readonly Fighter[],
  defenders: readonly Fighter[],
  seed: RngState,
  data: GameData = gameData,
  opts: BattleOptions = {},
): BattleResult {
  const { maxTicks, ticksPerSecond, sim } = data.rules.battle;
  const grid = opts.grid ?? data.rules.battle.grid;
  const sideColumns = opts.sideColumns ?? 2;
  const rng = createRng(seed);
  const dt = 1 / ticksPerSecond;
  const events: BattleEvent[] = [];
  const place = (team: readonly Fighter[], side: Side, columns: number[]) => {
    const cells = rng.shuffle(
      columns.flatMap((x) => Array.from({ length: grid.rows }, (_, y) => ({ x, y }))),
    );
    let seeded = 0;
    return team.map((f): Live => {
      const chosen = opts.cells?.[f.id];
      // More fighters than cells: later ones share a cell, nudged so they do not overlap.
      const i = chosen ? 0 : seeded++;
      const cell = chosen ?? cells[i % cells.length]!;
      const nudge = chosen ? 0 : Math.floor(i / cells.length) * 0.3;
      const unit = {
        f,
        side,
        x: cell.x + 0.5,
        y: cell.y + 0.5 + nudge,
        hp: Math.min(f.startHp ?? f.stats.hp, f.stats.hp),
        cooldown: 0,
        attacks: 0,
      };
      events.push({ tick: 0, kind: 'start', id: f.id, side, x: unit.x, y: unit.y });
      return unit;
    });
  };
  const columns = (from: number) => Array.from({ length: sideColumns }, (_, i) => from + i);
  const units = [
    ...place(attackers, 'attackers', columns(0)),
    ...place(defenders, 'defenders', columns(grid.columns - sideColumns)),
  ];
  const frames: BattleFrame[] | undefined = opts.trackEvery ? [] : undefined;
  const snapshot = (tick: number) =>
    frames?.push({
      tick,
      pos: Object.fromEntries(
        units.filter((u) => u.hp > 0).map((u) => [u.f.id, [u.x, u.y] as [number, number]]),
      ),
    });
  snapshot(0);
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
      const buildingsOnly = u.f.siege?.buildingsOnly ?? false;
      for (const o of units) {
        if (o.side === u.side || o.hp <= 0) continue;
        if (buildingsOnly && !o.f.fixed) continue;
        const d = Math.hypot(o.x - u.x, o.y - u.y);
        if (d < best) {
          best = d;
          target = o;
        }
      }
      // A Pendobrak with no building left waits; anyone else has nobody left to fight.
      if (!target) {
        if (buildingsOnly) continue;
        break;
      }
      u.cooldown = Math.max(0, u.cooldown - dt);
      // EPS: walking stops exactly at range, and rounding must not leave it a hair short.
      if (best > u.f.stats.range + EPS) {
        if (u.f.fixed) continue;
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
      const siege = u.f.siege && target.f.fixed ? u.f.siege.multiplier : 1;
      const raw =
        u.f.stats.atk * edge * siege * (sim.defenseK / (sim.defenseK + target.f.stats.def)) * roll;
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
      if (u.f.splash) {
        const { radius, ratio } = u.f.splash;
        for (const o of units) {
          if (o === target || o.side === u.side || o.hp <= 0) continue;
          if (Math.hypot(o.x - target.x, o.y - target.y) > radius + EPS) continue;
          const hit = Math.max(sim.minDamage, Math.round(damage * ratio));
          o.hp = Math.max(0, o.hp - hit);
          events.push({
            tick,
            kind: 'attack',
            id: u.f.id,
            target: o.f.id,
            damage: hit,
            x: u.x,
            y: u.y,
          });
          if (o.hp === 0) events.push({ tick, kind: 'death', id: o.f.id });
        }
      }
      u.cooldown = interval(u);
    }
    if (frames && tick % opts.trackEvery! === 0) snapshot(tick);
  }
  if (frames && frames.at(-1)!.tick !== tick) snapshot(tick);
  const winner: Side = alive('attackers') && !alive('defenders') ? 'attackers' : 'defenders';
  return {
    winner,
    ticks: tick,
    hp: Object.fromEntries(units.map((u) => [u.f.id, u.hp])),
    events,
    ...(frames ? { frames } : {}),
  };
}

/** Share of `runs` fixed-seed simulations the attackers win (a stable preview of the odds). */
export function estimateWinChance(
  attackers: readonly Fighter[],
  defenders: readonly Fighter[],
  runs: number = gameData.rules.battle.sim.previewRuns,
  data: GameData = gameData,
  opts: BattleOptions = {},
): number {
  if (attackers.length === 0) return 0;
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) {
    if (simulateBattle(attackers, defenders, seed, data, opts).winner === 'attackers') wins += 1;
  }
  return wins / runs;
}
