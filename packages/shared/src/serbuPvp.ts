import { simulateBattle, type Fighter } from './battle';
import { serbuPowerCap, soldierStats } from './barracks';
import { deepClone } from './clone';
import { gameData, VILLAGE_RESOURCES, type BattleReward, type GameData } from './data';
import { monsterElement, monsterStats } from './monster';
import { setWounds, withWounds } from './healing';
import { recordAction } from './player';
import { createRng, type Rng } from './rng';
import type { ActionError, ActionResult, PlayerState } from './state';
import { townHallLevel } from './village';
import { machineFighter, workshopLevel } from './workshop';
import { getResearchBonus } from './research';
import { serbuArmy, serbuUnitPower, type SerbuCell, type SerbuResult } from './serbu';

/** One unit placed on the defending side (x: 8..11, y: 0..7). */
export interface PvpDefenseCell {
  id: string;
  x: number;
  y: number;
}

/** Entry in a player's defense log (replays of attacks against their base). */
export interface PvpDefenseLogEntry {
  id: string;
  attackerId: string;
  attackerName: string;
  attackerLevel: number;
  attackerPower: number;
  won: boolean; // true = defender won; false = attacker broke through
  trophyChange: number; // e.g. +16 or -15
  stolen: BattleReward;
  timestamp: number;
  replay: SerbuResult;
}

/** Player's PvP state. */
export interface PvpState {
  defenseCells: PvpDefenseCell[];
  trophies: number;
  history: PvpDefenseLogEntry[];
}

/** Public snapshot of a player's base defense for matchmaking. */
export interface PvpDefenseSnapshot {
  id: string;
  name: string;
  townHall: number;
  level: number;
  power: number;
  trophies: number;
  resources: { gold: number; food: number; wood: number; stone: number };
  cells: PvpDefenseCell[];
  fighters: Fighter[];
  updatedAt: number;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

const zeroReward = (): BattleReward => ({
  gold: 0,
  food: 0,
  wood: 0,
  stone: 0,
  soulCrystal: 0,
  gems: 0,
});

/** Validates that a cell is inside the defending zone (right 4 columns: 8..11, y: 0..7). */
export function isDefendingCell(c: { x: number; y: number }, data: GameData = gameData): boolean {
  const { grid, placeColumns } = data.rules.serbu;
  const minX = grid.columns - placeColumns;
  return (
    Number.isInteger(c.x) &&
    Number.isInteger(c.y) &&
    c.x >= minX &&
    c.x < grid.columns &&
    c.y >= 0 &&
    c.y < grid.rows
  );
}

/** Automatically picks a smart defense formation if the player hasn't customized one. */
export function defaultDefenseCells(
  state: PlayerState,
  data: GameData = gameData,
): PvpDefenseCell[] {
  const { grid, placeColumns } = data.rules.serbu;
  const minX = grid.columns - placeColumns;
  const maxX = grid.columns - 1;
  const cap = serbuPowerCap(state, data);
  const army = serbuArmy(state);

  // Score units: higher power first
  const sorted = [...army]
    .map((id) => ({ id, power: serbuUnitPower(state, id, data) }))
    .sort((a, b) => b.power - a.power);

  const picked: string[] = [];
  let curPower = 0;
  for (const u of sorted) {
    if (picked.length >= data.rules.battle.maxUnits) break;
    if (curPower + u.power <= cap) {
      picked.push(u.id);
      curPower += u.power;
    }
  }

  // Also include built defense towers if available
  const towers = state.village.buildings.filter(
    (b) => (b.type.startsWith('menara') || b.type === 'katapel') && !b.construction,
  );
  for (const t of towers) {
    if (picked.length >= data.rules.battle.maxUnits) break;
    picked.push(t.id);
  }

  const cells: PvpDefenseCell[] = [];
  const taken = new Set<string>();

  picked.forEach((id, idx) => {
    // Front row is minX (x=8), then x=9..11 behind
    const col = idx < grid.rows ? minX : minX + 1 + (idx % (placeColumns - 1));
    const row = idx % grid.rows;
    const finalX = Math.min(maxX, col);
    const key = `${finalX},${row}`;
    if (!taken.has(key)) {
      taken.add(key);
      cells.push({ id, x: finalX, y: row });
    }
  });

  return cells;
}

/** Builds Fighter instances for the defense cells of a player state. */
export function buildDefenseFighters(
  state: PlayerState,
  cells: readonly PvpDefenseCell[],
  data: GameData = gameData,
): Fighter[] {
  const mStatsBonus = getResearchBonus(state, 'monsterStatsBonus', data);
  const elementBonus = getResearchBonus(state, 'elementAdvantageBonus', data);
  const soldierHpBonus = getResearchBonus(state, 'soldierHpBonus', data);
  const soldierAtkBonus = getResearchBonus(state, 'soldierAtkBonus', data);
  const machineAtkBonus = getResearchBonus(state, 'machineAtkBonus', data);

  return cells.map((c): Fighter => {
    const m = state.monsters.find((x) => x.id === c.id);
    if (m) {
      const f: Fighter = {
        id: c.id,
        stats: monsterStats(m, data, mStatsBonus),
        element: monsterElement(m, data),
        skill: true,
        elementBonus,
      };
      return withWounds(state, f);
    }
    const s = state.soldiers.find((x) => x.id === c.id);
    if (s) {
      const f: Fighter = {
        id: c.id,
        stats: soldierStats(s, data, { hpBonus: soldierHpBonus, atkBonus: soldierAtkBonus }),
        element: null,
        skill: false,
      };
      return withWounds(state, f);
    }
    const w = state.machines.find((x) => x.id === c.id);
    if (w) {
      return machineFighter(w, workshopLevel(state, data), data, machineAtkBonus);
    }
    // Tower building
    const b = state.village.buildings.find((x) => x.id === c.id);
    if (b) {
      const lvl = Math.max(1, b.level);
      const towerLevels = data.rules.raids.tower.levels;
      const stats = towerLevels[Math.min(lvl, towerLevels.length) - 1]!;
      return { id: c.id, stats: { ...stats }, element: null, skill: false, fixed: true };
    }
    // Fallback dummy
    return {
      id: c.id,
      stats: { hp: 100, atk: 10, def: 5, spd: 10, range: 1 },
      element: null,
      skill: false,
    };
  });
}

/** Calculates total defense power for given defense cells. */
export function calculateDefensePower(
  state: PlayerState,
  cells: readonly PvpDefenseCell[],
  data: GameData = gameData,
): number {
  return cells.reduce((sum, c) => {
    const p = serbuUnitPower(state, c.id, data);
    if (p > 0) return sum + p;
    const b = state.village.buildings.find((x) => x.id === c.id);
    if (b) return sum + b.level * 15;
    return sum;
  }, 0);
}

/** Creates a shareable defense snapshot from current player state. */
export function createDefenseSnapshot(
  state: PlayerState,
  playerId: string,
  name: string,
  now: number,
  data: GameData = gameData,
): PvpDefenseSnapshot {
  const cells =
    state.pvp.defenseCells.length > 0 ? state.pvp.defenseCells : defaultDefenseCells(state, data);
  const fighters = buildDefenseFighters(state, cells, data);
  const power = calculateDefensePower(state, cells, data);

  return {
    id: playerId,
    name,
    townHall: townHallLevel(state, data),
    level: Math.floor(state.xp / 100) + 1,
    power,
    trophies: state.pvp.trophies,
    resources: {
      gold: state.resources.gold,
      food: state.resources.food,
      wood: state.resources.wood,
      stone: state.resources.stone,
    },
    cells,
    fighters,
    updatedAt: now,
  };
}

/** Updates player defense cells layout. */
export function setDefenseLayout(
  state: PlayerState,
  cells: PvpDefenseCell[],
  data: GameData = gameData,
): ActionResult {
  if (cells.length > data.rules.battle.maxUnits) return fail('invalidAmount');
  const spots = new Set<string>();
  for (const c of cells) {
    if (!isDefendingCell(c, data)) return fail('blocked');
    const key = `${c.x},${c.y}`;
    if (spots.has(key)) return fail('blocked');
    spots.add(key);
  }
  const next = deepClone(state);
  next.pvp.defenseCells = cells;
  return { ok: true, state: next };
}

const BOT_NAMES = [
  'Benteng Garuda',
  'Desa Bayangan',
  'Markas Rimba',
  'Klan Siluman Seta',
  'Benteng Gunung Api',
  'Ksatria Lembah Surya',
  'Garda Rimba Gelap',
  'Pusat Serigala Putih',
];

/** Generates procedural bot opponents matching target power. */
export function generateBotOpponent(
  targetPower: number,
  targetTrophies: number,
  rng: Rng,
  data: GameData = gameData,
): PvpDefenseSnapshot {
  const name = rng.pick(BOT_NAMES);
  const powerMult = 0.85 + rng.next() * 0.3; // 85% - 115% of target
  const power = Math.max(10, Math.round(targetPower * powerMult));
  const th = Math.min(5, Math.max(1, Math.round(power / 40)));
  const trophies = Math.max(200, targetTrophies + rng.int(-40, 40));

  const { grid, placeColumns } = data.rules.serbu;
  const minX = grid.columns - placeColumns;
  const cells: PvpDefenseCell[] = [];
  const fighters: Fighter[] = [];

  const unitCount = Math.min(data.rules.battle.maxUnits, Math.max(3, Math.round(power / 10)));
  for (let i = 0; i < unitCount; i++) {
    const col = minX + (i % placeColumns);
    const row = Math.floor(i / placeColumns) % grid.rows;
    const id = `bot_${i}`;
    cells.push({ id, x: col, y: row });
    fighters.push({
      id,
      stats: {
        hp: 120 + th * 40,
        atk: 12 + th * 4,
        def: 5 + th * 2,
        spd: 10,
        range: i % 3 === 0 ? 4 : 1,
      },
      element: null,
      skill: i % 2 === 0,
    });
  }

  return {
    id: `bot_${rng.int(1000, 9999)}`,
    name,
    townHall: th,
    level: th * 2,
    power,
    trophies,
    resources: {
      gold: 500 * th,
      food: 300 * th,
      wood: 200 * th,
      stone: 200 * th,
    },
    cells,
    fighters,
    updatedAt: 0,
  };
}

/** Matchmakes 1 to 3 suitable opponents from a pool (or creates bot fallbacks). */
export function matchmakeOpponents(
  myPower: number,
  myTrophies: number,
  pool: readonly PvpDefenseSnapshot[],
  rng: Rng,
  count = 3,
  data: GameData = gameData,
): PvpDefenseSnapshot[] {
  const candidates = pool
    .filter((s) => s.power > 0)
    .sort((a, b) => Math.abs(a.power - myPower) - Math.abs(b.power - myPower));

  const out = candidates.slice(0, count);
  while (out.length < count) {
    out.push(generateBotOpponent(myPower, myTrophies, rng, data));
  }
  return out;
}

export interface PvpAttackResult {
  won: boolean;
  trophiesWon: number;
  stolen: BattleReward;
  dead: string[];
  replay: SerbuResult;
}

/** Simulates an attack against a player's defense snapshot. */
export function attackPlayerBase(
  state: PlayerState,
  params: {
    defender: PvpDefenseSnapshot;
    cells: SerbuCell[];
  },
  now: number,
  data: GameData = gameData,
): ActionResult<{
  result: PvpAttackResult;
  defenseLogEntry: PvpDefenseLogEntry;
}> {
  const { grid, placeColumns, trackEveryTicks } = data.rules.serbu;
  const { cells, defender } = params;

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

  const mStatsBonus = getResearchBonus(next, 'monsterStatsBonus', data);
  const elementBonus = getResearchBonus(next, 'elementAdvantageBonus', data);
  const soldierHpBonus = getResearchBonus(next, 'soldierHpBonus', data);
  const soldierAtkBonus = getResearchBonus(next, 'soldierAtkBonus', data);
  const machineAtkBonus = getResearchBonus(next, 'machineAtkBonus', data);

  const attackers = cells.map((c): Fighter => {
    const m = next.monsters.find((x) => x.id === c.id);
    if (m) {
      return withWounds(next, {
        id: c.id,
        stats: monsterStats(m, data, mStatsBonus),
        element: monsterElement(m, data),
        skill: true,
        elementBonus,
      });
    }
    const s = next.soldiers.find((x) => x.id === c.id);
    if (s) {
      return withWounds(next, {
        id: c.id,
        stats: soldierStats(s, data, { hpBonus: soldierHpBonus, atkBonus: soldierAtkBonus }),
        element: null,
        skill: false,
      });
    }
    const w = next.machines.find((x) => x.id === c.id)!;
    return machineFighter(w, workshopLevel(next, data), data, machineAtkBonus);
  });

  const defenders = deepClone(defender.fighters);

  // Position mapping for attackers and defenders
  const allCells: Record<string, { x: number; y: number }> = {};
  for (const c of cells) allCells[c.id] = { x: c.x, y: c.y };
  for (const c of defender.cells) allCells[c.id] = { x: c.x, y: c.y };

  const battle = simulateBattle(attackers, defenders, rng.int(0, 0x7fffffff), data, {
    grid,
    sideColumns: placeColumns,
    cells: allCells,
    trackEvery: trackEveryTicks,
  });

  const won = battle.winner === 'attackers';
  const trophiesPerWin = data.rules.serbu.pvp?.trophiesPerWin ?? 25;
  const trophiesPerLoss = data.rules.serbu.pvp?.trophiesPerLoss ?? 15;
  const trophyChange = won ? trophiesPerWin : -trophiesPerLoss;

  const stealRatio = data.rules.serbu.pvp?.lootStealRatio ?? 0.15;
  const stolen: BattleReward = won
    ? {
        gold: Math.floor(defender.resources.gold * stealRatio),
        food: Math.floor(defender.resources.food * stealRatio),
        wood: Math.floor(defender.resources.wood * stealRatio),
        stone: Math.floor(defender.resources.stone * stealRatio),
        soulCrystal: 0,
        gems: 0,
      }
    : zeroReward();

  if (won) {
    for (const r of VILLAGE_RESOURCES) next.resources[r] += stolen[r];
    recordAction(next, 'defeatEnemy', 1, data);
  }

  next.pvp.trophies = Math.max(0, next.pvp.trophies + trophyChange);
  next.rngState = rng.getState();

  const dead = cells.map((c) => c.id).filter((id) => (battle.hp[id] ?? 0) <= 0);
  setWounds(
    next,
    Object.fromEntries(attackers.map((f) => [f.id, (battle.hp[f.id] ?? 0) / f.stats.hp])),
    now,
  );

  for (const id of dead) {
    next.soldiers = next.soldiers.filter((x) => x.id !== id);
    next.machines = next.machines.filter((x) => x.id !== id);
    const fallen = next.monsters.find((x) => x.id !== id);
    if (fallen) {
      next.monsters = next.monsters.filter((x) => x.id !== id);
      next.graveyard.push(fallen);
    }
  }

  const replay: SerbuResult = {
    targetId: defender.id,
    won,
    first: false,
    reward: stolen,
    dead,
    attackers,
    defenders,
    battle,
  };

  const defenseLogEntry: PvpDefenseLogEntry = {
    id: `log_${now}_${rng.int(100, 999)}`,
    attackerId: 'player',
    attackerName: 'Penyerang',
    attackerLevel: Math.floor(state.xp / 100) + 1,
    attackerPower: power,
    won: !won, // defender won if attacker lost
    trophyChange: -trophyChange,
    stolen,
    timestamp: now,
    replay,
  };

  return {
    ok: true,
    state: next,
    result: {
      won,
      trophiesWon: trophyChange,
      stolen,
      dead,
      replay,
    },
    defenseLogEntry,
  };
}
