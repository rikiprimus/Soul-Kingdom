import { simulateBattle, type BattleResult, type Fighter } from './battle';
import { serbuPowerCap, soldierPower, soldierStats } from './barracks';
import { deepClone } from './clone';
import {
  gameData,
  VILLAGE_RESOURCES,
  type BattleReward,
  type Defender,
  type GameData,
} from './data';
import { isOnMission, monsterPower } from './missions';
import { monsterStats, powerPointsOf } from './monster';
import { setWounds, withWounds } from './healing';
import { recordAction } from './player';
import { createRng, type Rng } from './rng';
import type { ActionError, ActionResult, PlayerState } from './state';
import { townHallLevel } from './village';
import { machineFighter, machinePower, workshopLevel } from './workshop';

/** An NPC base to attack in Serbu (`rules.serbu.bases`). */
export type SerbuBase = GameData['rules']['serbu']['bases'][number];

/** One unit the player placed: its id and its cell on the attacking side. */
export interface SerbuCell {
  id: string;
  x: number;
  y: number;
}

/** Serbu progress: the NPC bases beaten at least once. */
export interface SerbuProgress {
  cleared: string[];
}

/** What an attack did, with everything a replay needs. */
export interface SerbuResult {
  /** The Serbu base or Petualangan node that was attacked. */
  targetId: string;
  won: boolean;
  /** First win against this target (it stays beaten and opens what comes after it). */
  first: boolean;
  reward: BattleReward;
  /** Our units that fell: monsters went to the Kuburan, soldiers are gone. */
  dead: string[];
  attackers: Fighter[];
  defenders: Fighter[];
  battle: BattleResult;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export const noReward = (): BattleReward => ({
  gold: 0,
  food: 0,
  wood: 0,
  stone: 0,
  soulCrystal: 0,
  gems: 0,
});

export function serbuBase(id: string, data: GameData = gameData): SerbuBase | undefined {
  return data.rules.serbu.bases.find((b) => b.id === id);
}

/**
 * Where a base stands for the player: `locked` until the one before it is beaten,
 * `townHall` while the Balai is too low, then `open`, and `cleared` once beaten.
 */
export type SerbuBaseStatus = 'locked' | 'townHall' | 'open' | 'cleared';

export function serbuBaseStatus(
  state: PlayerState,
  baseId: string,
  data: GameData = gameData,
): SerbuBaseStatus {
  const { bases } = data.rules.serbu;
  const i = bases.findIndex((b) => b.id === baseId);
  if (i < 0) return 'locked';
  if (state.serbu.cleared.includes(baseId)) return 'cleared';
  if (i > 0 && !state.serbu.cleared.includes(bases[i - 1]!.id)) return 'locked';
  if (townHallLevel(state, data) < bases[i]!.requiresTownHall) return 'townHall';
  return 'open';
}

/** Power points one of our units costs in a Serbu army (0 when unknown). */
export function serbuUnitPower(state: PlayerState, id: string, data: GameData = gameData): number {
  const m = state.monsters.find((x) => x.id === id);
  if (m) return powerPointsOf(m, data);
  const s = state.soldiers.find((x) => x.id === id);
  if (s) return soldierPower(s, data);
  const w = state.machines.find((x) => x.id === id);
  return w ? machinePower(w.kind, data) : 0;
}

/** Monsters, soldiers and war machines free to attack: not out on a mission, not in the Soul Mixer. */
export function serbuArmy(state: PlayerState): string[] {
  const inMixer = new Set(state.mixQueue.flatMap((q) => q.parents.map((p) => p.id)));
  return [
    ...state.monsters.map((m) => m.id),
    ...state.soldiers.map((s) => s.id),
    ...state.machines.map((w) => w.id),
  ].filter((id) => !inMixer.has(id) && !isOnMission(state, id));
}

/** NPC defenders as fighters (ids "x0", "x1", … in list order; towers never move). */
export function defenderFighters(
  defenders: readonly Defender[],
  data: GameData = gameData,
): Fighter[] {
  const out: Fighter[] = [];
  const add = (f: Omit<Fighter, 'id'>) => out.push({ id: `x${out.length}`, ...f });
  for (const d of defenders) {
    for (let i = 0; i < d.count; i++) {
      if (d.kind === 'bandit') {
        const { stats, powerScale } = data.rules.battle.bandit;
        const k = d.power * powerScale;
        add({
          stats: { ...stats, hp: stats.hp * k, atk: stats.atk * k, def: stats.def * k },
          element: null,
          skill: false,
        });
      } else if (d.kind === 'monster') {
        add({ stats: monsterStats(d, data), element: d.element, skill: true });
      } else if (d.kind === 'boss') {
        const stats = monsterStats(d, data);
        const k = d.statMultiplier;
        add({
          stats: { ...stats, hp: stats.hp * k, atk: stats.atk * k, def: stats.def * k },
          element: d.element,
          skill: true,
        });
      } else if (d.kind === 'soldier') {
        const stats = soldierStats({ kind: d.soldier, rank: d.rank }, data);
        add({ stats, element: null, skill: false });
      } else {
        const { levels } = data.rules.raids.tower;
        const stats = levels[Math.min(d.level, levels.length) - 1]!;
        add({ stats: { ...stats }, element: null, skill: false, fixed: true });
      }
    }
  }
  return out;
}

/** The base's defenders as fighters. */
export function baseFighters(base: SerbuBase, data: GameData = gameData): Fighter[] {
  return defenderFighters(base.defenders, data);
}

/** Rough strength of defenders in power points (towers not counted), for the lists. */
export function defendersPower(defenders: readonly Defender[], data: GameData = gameData): number {
  let sum = 0;
  for (const d of defenders) {
    if (d.kind === 'bandit') sum += d.power * d.count;
    else if (d.kind === 'monster') sum += monsterPower(d, data) * d.count;
    else if (d.kind === 'boss') sum += monsterPower(d, data) * d.statMultiplier * d.count;
    else if (d.kind === 'soldier') {
      sum += soldierPower({ kind: d.soldier, rank: d.rank }, data) * d.count;
    }
  }
  return sum;
}

export function basePower(base: SerbuBase, data: GameData = gameData): number {
  return defendersPower(base.defenders, data);
}

/** Adds a reward to the player's resources. */
export function payReward(next: PlayerState, reward: BattleReward): void {
  for (const r of VILLAGE_RESOURCES) next.resources[r] += reward[r];
  next.resources.soulCrystal += reward.soulCrystal;
  next.resources.gems += reward.gems;
}

/**
 * The fight shared by Serbu and Petualangan: our units placed on the left
 * `placeColumns` columns of the Serbu field (one per cell, at most `battle.maxUnits`,
 * power within the combined barracks cap) against NPC defenders. Simulated at once
 * (seeded, `maxTicks` is the time limit); fallen monsters go to the Kuburan and fallen
 * soldiers are gone. `onWin` adds what the caller pays and records, using the same RNG.
 */
export function fightPlaced(
  state: PlayerState,
  cells: readonly SerbuCell[],
  defenders: readonly Defender[],
  onWin: (next: PlayerState, rng: Rng) => BattleReward,
  now: number,
  data: GameData = gameData,
): ActionResult<
  { won: boolean; reward: BattleReward } & Omit<
    SerbuResult,
    'targetId' | 'first' | 'won' | 'reward'
  >
> {
  const { grid, placeColumns, trackEveryTicks } = data.rules.serbu;
  if (cells.length < 1 || cells.length > data.rules.battle.maxUnits) return fail('invalidAmount');
  if (new Set(cells.map((c) => c.id)).size !== cells.length) return fail('invalidAmount');
  const spots = new Set<string>();
  for (const c of cells) {
    const inside = Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0;
    if (!inside || c.x >= placeColumns || c.y >= grid.rows) return fail('blocked');
    if (spots.has(`${c.x},${c.y}`)) return fail('blocked');
    spots.add(`${c.x},${c.y}`);
  }
  const army = new Set(serbuArmy(state));
  for (const c of cells) {
    const known =
      state.monsters.some((m) => m.id === c.id) ||
      state.soldiers.some((s) => s.id === c.id) ||
      state.machines.some((w) => w.id === c.id);
    if (!known) return fail('monsterNotFound');
    if (!army.has(c.id)) return fail('monsterBusy');
  }
  const power = cells.reduce((sum, c) => sum + serbuUnitPower(state, c.id, data), 0);
  if (power > serbuPowerCap(state, data)) return fail('powerCapExceeded');

  const next = deepClone(state);
  const rng = createRng(next.rngState);
  const attackers = cells.map((c): Fighter => {
    const m = next.monsters.find((x) => x.id === c.id);
    if (m) {
      const f: Fighter = {
        id: c.id,
        stats: monsterStats(m, data),
        element: m.element,
        skill: true,
      };
      return withWounds(next, f);
    }
    const s = next.soldiers.find((x) => x.id === c.id);
    if (s) {
      const f: Fighter = { id: c.id, stats: soldierStats(s, data), element: null, skill: false };
      return withWounds(next, f);
    }
    const w = next.machines.find((x) => x.id === c.id)!;
    return machineFighter(w, workshopLevel(next, data), data);
  });
  const enemies = defenderFighters(defenders, data);
  const battle = simulateBattle(attackers, enemies, rng.int(0, 0x7fffffff), data, {
    grid,
    sideColumns: placeColumns,
    cells: Object.fromEntries(cells.map((c) => [c.id, { x: c.x, y: c.y }])),
    trackEvery: trackEveryTicks,
  });
  const won = battle.winner === 'attackers';
  const reward = won ? onWin(next, rng) : noReward();
  if (won) recordAction(next, 'defeatEnemy', 1, data);
  next.rngState = rng.getState();
  const dead = cells.map((c) => c.id).filter((id) => (battle.hp[id] ?? 0) <= 0);
  // Survivors come home with the HP they have left.
  setWounds(
    next,
    Object.fromEntries(attackers.map((f) => [f.id, (battle.hp[f.id] ?? 0) / f.stats.hp])),
    now,
  );
  for (const id of dead) {
    next.soldiers = next.soldiers.filter((x) => x.id !== id);
    next.machines = next.machines.filter((x) => x.id !== id);
    const fallen = next.monsters.find((x) => x.id === id);
    if (!fallen) continue;
    next.monsters = next.monsters.filter((x) => x.id !== id);
    next.graveyard.push(fallen);
  }
  return { ok: true, state: next, won, reward, dead, attackers, defenders: enemies, battle };
}

/** The replay-ready result of a `fightPlaced` fight against `targetId`. */
export function fightResult(
  r: Omit<SerbuResult, 'targetId' | 'first'>,
  targetId: string,
  first: boolean,
): SerbuResult {
  const { won, reward, dead, attackers, defenders, battle } = r;
  return { targetId, won, first: first && won, reward, dead, attackers, defenders, battle };
}

/**
 * Attacks an NPC base with placed units (see `fightPlaced`). A win pays the first or
 * the repeat reward; the first win opens the next base. The result carries the battle
 * log and position frames for the replay.
 */
export function attackBase(
  state: PlayerState,
  params: { baseId: string; cells: SerbuCell[] },
  now: number,
  data: GameData = gameData,
): ActionResult<{ result: SerbuResult }> {
  const base = serbuBase(params.baseId, data);
  if (!base) return fail('notUnlocked');
  const status = serbuBaseStatus(state, base.id, data);
  if (status === 'locked') return fail('notUnlocked');
  if (status === 'townHall') return fail('townHallTooLow');
  const first = status === 'open';
  const r = fightPlaced(
    state,
    params.cells,
    base.defenders,
    (next) => {
      const reward = { ...(first ? base.firstReward : base.repeatReward) };
      payReward(next, reward);
      if (first) next.serbu.cleared.push(base.id);
      return reward;
    },
    now,
    data,
  );
  if (!r.ok) return r;
  return { ok: true, state: r.state, result: fightResult(r, base.id, first) };
}
