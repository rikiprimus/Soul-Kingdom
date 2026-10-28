import { deepClone } from './clone';
import {
  gameData,
  type BuildingDef,
  type BuildingFeature,
  type BuildingLevel,
  type GameData,
  type ObstacleDef,
  type VillageAmount,
  type VillageResource,
  VILLAGE_RESOURCES,
} from './data';
import type { Rng } from './rng';
import type { RanchAnimal, WildAnimal } from './animals';
import { settleHealing } from './healing';
import { settleResearch, getResearchBonus } from './research';
import { settleMissions, type WildEncounter } from './missions';
import { aggroEncounters } from './aggro';
import { settleUnits } from './units';
import type { ActionError, ActionResult, PlayerState } from './state';
import { settleBarracks } from './barracks';
import { settleWorkshop } from './workshop';
import { recordAction } from './player';
import { assignWorkers, idleWorkers, releaseWorkers, settleTraining } from './workers';

export interface Construction {
  toLevel: number;
  endsAt: number;
}

export interface Building {
  id: string;
  type: string;
  /** Top corner tile of the footprint. */
  x: number;
  y: number;
  /** Finished level; 0 while the first construction is running. */
  level: number;
  construction: Construction | null;
  /** Passive production is counted from this time (s). */
  lastCollectAt: number;
  /** A planted crop (farms only); its harvest is fixed when planted. */
  crop: { endsAt: number; food: number } | null;
  /** Drawn mirrored (the second facing); left out when not. */
  flipped?: boolean;
  /** Gerbang shut by the player (own units cannot pass); left out when open. */
  closed?: boolean;
}

export interface Obstacle {
  id: string;
  type: string;
  x: number;
  y: number;
  /** Worker-seconds gathered so far (see wilds.ts); it only grows while the game is open. */
  work: number;
  /** Refilling nodes (gold veins): empty until this time, and not gatherable meanwhile. */
  refillAt?: number | null;
}

export interface Village {
  buildings: Building[];
  obstacles: Obstacle[];
  /** Open plots as "px,py" (plot coordinates, not tiles). */
  unlockedPlots: string[];
  /** Wild nodes have regrown up to this time (s). */
  regrowAt: number;
  /** Wild animals roaming the map, and when they last spawned (s). */
  animals: WildAnimal[];
  animalsAt: number;
  /** Captured animals, each living in a Peternakan. */
  ranchAnimals: RanchAnimal[];
  /** Wild enemy groups on the map, and when they last spawned (s). */
  encounters: WildEncounter[];
  encountersAt: number;
  /** Seconds of active play since the last raid on the village (raids.ts). */
  raidClock: number;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export function buildingDef(type: string, data: GameData = gameData): BuildingDef {
  const def = data.buildingById.get(type);
  if (!def) throw new Error(`Bangunan tidak dikenal: "${type}"`);
  return def;
}

export function obstacleDef(type: string, data: GameData = gameData): ObstacleDef {
  const def = data.obstacleById.get(type);
  if (!def) throw new Error(`Rintangan tidak dikenal: "${type}"`);
  return def;
}

/** Definition of level `level` (1-based) of a building type. */
export function levelDef(
  type: string,
  level: number,
  data: GameData = gameData,
): BuildingLevel | undefined {
  return buildingDef(type, data).levels[level - 1];
}

export function sizeOf(type: string, data: GameData = gameData): number {
  return (data.buildingById.get(type) ?? obstacleDef(type, data)).size;
}

/** The island being played (`state.village`). */
export function currentIsland(state: PlayerState, data: GameData = gameData) {
  return data.islands.islands.find((i) => i.id === state.island) ?? data.islands.islands[0]!;
}

/** The main island's village, where the Balai Utama stands. */
export function mainVillage(state: PlayerState, data: GameData = gameData): Village {
  const main = data.islands.islands[0]!.id;
  return state.island === main ? state.village : (state.islands[main] ?? state.village);
}

/** Buildings on every island (population, features and barracks count everywhere). */
export function allBuildings(state: PlayerState): Building[] {
  const others = Object.values(state.islands);
  if (others.length === 0) return state.village.buildings;
  return [state.village, ...others].flatMap((v) => v.buildings);
}

/** Level of the finished Balai Utama on the main island (0 if there is none). */
export function townHallLevel(state: PlayerState, data: GameData = gameData): number {
  const hall = mainVillage(state, data).buildings.find((b) => b.type === data.townHallId);
  return hall?.level ?? 0;
}

/** A finished building with this feature on any island. */
export function hasFeature(
  state: PlayerState,
  feature: BuildingFeature,
  data: GameData = gameData,
) {
  return allBuildings(state).some(
    (b) => b.level >= 1 && data.buildingById.get(b.type)?.feature === feature,
  );
}

export function countBuildings(state: PlayerState, type: string): number {
  return state.village.buildings.filter((b) => b.type === type).length;
}

/** How many of `type` the current Balai Utama level allows (an island may set its own). */
export function maxCountFor(state: PlayerState, type: string, data: GameData = gameData): number {
  const island = currentIsland(state, data).maxCount;
  if (island) return island[type] ?? 0;
  const level = Math.max(1, townHallLevel(state, data));
  const table = buildingDef(type, data).maxCount;
  return table[Math.min(level, table.length) - 1] ?? 0;
}

// ---------- Workers on constructions ----------

/** Most workers that can build one building of this type at once (by its size). */
export function maxConstructionWorkers(type: string, data: GameData = gameData): number {
  return data.rules.workers.constructionMaxBySize[String(sizeOf(type, data))] ?? 1;
}

/** Seconds a construction takes with `workers` builders: base time / workers. */
export function constructionTime(
  baseSeconds: number,
  workers: number,
  buildTimeReduction = 0,
): number {
  if (baseSeconds <= 0) return 0;
  const eff = Math.max(0.1, 1 - buildTimeReduction);
  return Math.max(1, Math.ceil((baseSeconds * eff) / Math.max(1, workers)));
}

/** Workers currently building this building. */
export function constructionWorkers(state: PlayerState, buildingId: string): number {
  return state.workers.filter((w) => w.task.kind === 'building' && w.task.buildingId === buildingId)
    .length;
}

/** Why `workers` builders cannot start on `type` now, or null when they can. */
function workerError(
  state: PlayerState,
  type: string,
  workers: number,
  data: GameData,
): ActionError | null {
  if (!Number.isInteger(workers) || workers < 1) return 'invalidAmount';
  if (workers > maxConstructionWorkers(type, data)) return 'tooManyWorkers';
  if (idleWorkers(state).length < workers) return 'buildersBusy';
  return null;
}

export function isConstructing(b: Building, now: number): boolean {
  return b.construction !== null && b.construction.endsAt > now;
}

// ---------- Placement ----------

const key = (x: number, y: number) => `${x},${y}`;

/** Map of occupied tiles → id of the building or obstacle standing there. */
export function occupancy(village: Village, data: GameData = gameData, ignoreId?: string) {
  const tiles = new Map<string, string>();
  const mark = (id: string, x: number, y: number, size: number) => {
    if (id === ignoreId) return;
    for (let dx = 0; dx < size; dx++)
      for (let dy = 0; dy < size; dy++) tiles.set(key(x + dx, y + dy), id);
  };
  for (const b of village.buildings) mark(b.id, b.x, b.y, sizeOf(b.type, data));
  for (const o of village.obstacles) mark(o.id, o.x, o.y, sizeOf(o.type, data));
  return tiles;
}

/** Whether a `size`×`size` footprint at (x, y) is inside the map and free. */
export function canPlace(
  village: Village,
  size: number,
  x: number,
  y: number,
  data: GameData = gameData,
  ignoreId?: string,
): boolean {
  const { mapSize } = data.village.village;
  if (x < 0 || y < 0 || x + size > mapSize || y + size > mapSize) return false;
  const tiles = occupancy(village, data, ignoreId);
  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) if (tiles.has(key(x + dx, y + dy))) return false;
  }
  return true;
}

// ---------- Plots (locked land) ----------

export interface Plot {
  px: number;
  py: number;
}

export const plotKey = (px: number, py: number) => `${px},${py}`;

export function plotsPerSide(data: GameData = gameData): number {
  const { mapSize, plotSize } = data.village.village;
  return Math.floor(mapSize / plotSize);
}

/** The plot a tile belongs to. */
export function plotOf(x: number, y: number, data: GameData = gameData): Plot {
  const { plotSize } = data.village.village;
  return { px: Math.floor(x / plotSize), py: Math.floor(y / plotSize) };
}

export function isPlotUnlocked(village: Village, px: number, py: number): boolean {
  return village.unlockedPlots.includes(plotKey(px, py));
}

export function isTileUnlocked(village: Village, x: number, y: number, data: GameData = gameData) {
  const { px, py } = plotOf(x, y, data);
  return isPlotUnlocked(village, px, py);
}

/** Every tile of a size×size footprint at (x, y) lies on open land. */
export function isAreaUnlocked(
  village: Village,
  size: number,
  x: number,
  y: number,
  data: GameData = gameData,
): boolean {
  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) {
      if (!isTileUnlocked(village, x + dx, y + dy, data)) return false;
    }
  }
  return true;
}

/** Like `canPlace`, but buildings also need open (bought) land. */
export function canPlaceBuilding(
  village: Village,
  size: number,
  x: number,
  y: number,
  data: GameData = gameData,
  ignoreId?: string,
): boolean {
  return canPlace(village, size, x, y, data, ignoreId) && isAreaUnlocked(village, size, x, y, data);
}

/** A locked plot that shares an edge with open land can be bought. */
export function isPlotAdjacent(village: Village, px: number, py: number): boolean {
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => isPlotUnlocked(village, px + dx!, py + dy!));
}

/** Price and Balai requirement of the next plot purchase, or null when all are bought. */
export function nextPlotPrice(
  village: Village,
  data: GameData = gameData,
): { gold: number; requiresTownHall: number } | null {
  const { initialPlots, plotCostGold, plotRequiresTownHall } = data.village.village;
  const bought = village.unlockedPlots.length - initialPlots.length;
  const gold = plotCostGold[Math.max(0, bought)];
  if (gold === undefined) return null;
  return { gold, requiresTownHall: plotRequiresTownHall[Math.max(0, bought)] ?? 1 };
}

export type PlotStatus = 'open' | 'buyable' | 'needsTownHall' | 'notAdjacent' | 'outOfMap';

export function plotStatus(
  state: PlayerState,
  px: number,
  py: number,
  data: GameData = gameData,
): PlotStatus {
  const n = plotsPerSide(data);
  if (px < 0 || py < 0 || px >= n || py >= n) return 'outOfMap';
  if (isPlotUnlocked(state.village, px, py)) return 'open';
  if (!isPlotAdjacent(state.village, px, py)) return 'notAdjacent';
  const price = nextPlotPrice(state.village, data);
  if (!price || townHallLevel(state, data) < price.requiresTownHall) return 'needsTownHall';
  return 'buyable';
}

export function buyPlot(
  state: PlayerState,
  plot: Plot,
  data: GameData = gameData,
): ActionResult<{ gold: number }> {
  const status = plotStatus(state, plot.px, plot.py, data);
  if (status === 'outOfMap') return fail('plotOutOfMap');
  if (status === 'open') return fail('plotAlreadyOpen');
  if (status === 'notAdjacent') return fail('plotNotAdjacent');
  if (status === 'needsTownHall') return fail('townHallTooLow');
  const price = nextPlotPrice(state.village, data)!;
  if (state.resources.gold < price.gold) return fail('notEnoughGold');
  const next = deepClone(state);
  next.resources.gold -= price.gold;
  next.village.unlockedPlots.push(plotKey(plot.px, plot.py));
  return { ok: true, state: next, gold: price.gold };
}

// ---------- Time ----------

/** Finishes every construction whose timer has run out. Returns the same object if none did. */
/**
 * Finishes due constructions (their workers go back to idle), worker and barracks
 * training, and missions.
 * Returns the same object when nothing changed.
 */
export function settleVillage(state: PlayerState, now: number): PlayerState {
  // Enemies wake after units have moved (they chase whoever came close).
  const trained = aggroEncounters(
    settleUnits(
      settleMissions(
        settleHealing(
          settleWorkshop(settleBarracks(settleResearch(settleTraining(state, now), now), now), now),
          now,
        ),
        now,
      ),
      now,
    ),
    now,
  );
  // Constructions on the other islands keep going while the player is away.
  const done = allBuildings(trained).some((b) => b.construction && b.construction.endsAt <= now);
  if (!done) return trained;
  const next = trained === state ? deepClone(state) : trained;
  for (const b of allBuildings(next)) {
    if (!b.construction || b.construction.endsAt > now) continue;
    b.level = b.construction.toLevel;
    b.lastCollectAt = b.construction.endsAt;
    b.construction = null;
    releaseWorkers(next, (task) => task.kind === 'building' && task.buildingId === b.id);
  }
  return next;
}

/** Applies the settled state and runs `action` on it. */
function withSettled<T extends object>(
  state: PlayerState,
  now: number,
  action: (s: PlayerState) => ActionResult<T>,
): ActionResult<T> {
  return action(settleVillage(state, now));
}

function newId(state: PlayerState, prefix: string): string {
  const id = `${prefix}${state.nextId}`;
  state.nextId += 1;
  return id;
}

const MISSING: Record<(typeof VILLAGE_RESOURCES)[number], ActionError> = {
  gold: 'notEnoughGold',
  food: 'notEnoughFood',
  wood: 'notEnoughWood',
  stone: 'notEnoughStone',
};

/** The first resource the player is short of, as an error code. */
export function canPay(state: PlayerState, cost: VillageAmount): ActionError | null {
  for (const r of VILLAGE_RESOURCES) if (state.resources[r] < cost[r]) return MISSING[r];
  return null;
}

/** Adds `amount` × `times` to the resources (negative times pays a cost). */
function applyAmount(state: PlayerState, amount: VillageAmount, times = 1): void {
  for (const r of VILLAGE_RESOURCES) state.resources[r] += amount[r] * times;
}

/** `amount` scaled by `times` (e.g. a per-segment wall price for a whole line). */
export function scaleAmount(amount: VillageAmount, times: number): VillageAmount {
  return {
    gold: amount.gold * times,
    food: amount.food * times,
    wood: amount.wood * times,
    stone: amount.stone * times,
  };
}

/** True if the building type exists and may be built now (not hidden for a later task). */
export function isBuildable(type: string, data: GameData = gameData): boolean {
  const def = data.buildingById.get(type);
  return def !== undefined && !def.hidden;
}

// ---------- Building actions ----------

export function buildBuilding(
  state: PlayerState,
  params: { type: string; x: number; y: number; workers?: number },
  now: number,
  data: GameData = gameData,
): ActionResult<{ buildingId: string }> {
  return withSettled(state, now, (s) => {
    const def = data.buildingById.get(params.type);
    if (!def) return fail('unknownBuilding');
    if (def.hidden) return fail('notAvailableYet');
    // A Keajaiban is never built: it is won (quest or set prize) and placed from the Gudang.
    if (def.feature === 'wonder') return fail('notUnlocked');
    const first = def.levels[0]!;
    if (townHallLevel(s, data) < first.requiresTownHall) return fail('townHallTooLow');
    if (countBuildings(s, def.id) >= maxCountFor(s, def.id, data)) return fail('maxCountReached');
    const instant = first.seconds === 0;
    const workers = params.workers ?? 1;
    const busy = instant ? null : workerError(s, def.id, workers, data);
    if (busy) return fail(busy);
    if (!canPlace(s.village, def.size, params.x, params.y, data)) return fail('blocked');
    if (!isAreaUnlocked(s.village, def.size, params.x, params.y, data)) return fail('plotLocked');
    const unpaid = canPay(s, first.cost);
    if (unpaid) return fail(unpaid);

    const next = deepClone(s);
    applyAmount(next, first.cost, -1);
    const building: Building = {
      id: newId(next, 'b'),
      type: def.id,
      x: params.x,
      y: params.y,
      level: instant ? 1 : 0,
      construction: instant
        ? null
        : {
            toLevel: 1,
            endsAt:
              now +
              constructionTime(
                first.seconds,
                workers,
                getResearchBonus(s, 'buildTimeReduction', data),
              ),
          },
      lastCollectAt: now,
      crop: null,
    };
    next.village.buildings.push(building);
    if (!instant) assignWorkers(next, workers, { kind: 'building', buildingId: building.id });
    recordAction(next, 'build', 1, data);
    return { ok: true, state: next, buildingId: building.id };
  });
}

export function upgradeBuilding(
  state: PlayerState,
  buildingId: string,
  now: number,
  options: { workers?: number } = {},
  data: GameData = gameData,
): ActionResult<{ collected: number }> {
  return withSettled(state, now, (s) => {
    const b = s.village.buildings.find((x) => x.id === buildingId);
    if (!b) return fail('buildingNotFound');
    if (b.construction) return fail('underConstruction');
    const target = levelDef(b.type, b.level + 1, data);
    if (!target) return fail('maxLevel');
    if (townHallLevel(s, data) < target.requiresTownHall) return fail('townHallTooLow');
    const workers = options.workers ?? 1;
    const busy = target.seconds > 0 ? workerError(s, b.type, workers, data) : null;
    if (busy) return fail(busy);
    const unpaid = canPay(s, target.cost);
    if (unpaid) return fail(unpaid);

    const next = deepClone(s);
    const nb = next.village.buildings.find((x) => x.id === buildingId)!;
    // Bank what was produced so far; production pauses during the upgrade.
    const collected = bankProduction(next, nb, now, data);
    applyAmount(next, target.cost, -1);
    if (target.seconds === 0) {
      nb.level += 1;
      nb.lastCollectAt = now;
    } else {
      nb.construction = {
        toLevel: nb.level + 1,
        endsAt:
          now +
          constructionTime(
            target.seconds,
            workers,
            getResearchBonus(s, 'buildTimeReduction', data),
          ),
      };
      assignWorkers(next, workers, { kind: 'building', buildingId: nb.id });
    }
    recordAction(next, 'build', 1, data);
    return { ok: true, state: next, collected };
  });
}

/**
 * Puts more idle workers on a running construction. The work left is shared out
 * again: remaining time × old workers / new workers.
 */
export function addConstructionWorkers(
  state: PlayerState,
  buildingId: string,
  count: number,
  now: number,
  data: GameData = gameData,
): ActionResult<{ endsAt: number }> {
  return withSettled(state, now, (s) => {
    const b = s.village.buildings.find((x) => x.id === buildingId);
    if (!b) return fail('buildingNotFound');
    if (!b.construction) return fail('notConstructing');
    if (!Number.isInteger(count) || count < 1) return fail('invalidAmount');
    const current = constructionWorkers(s, b.id);
    if (current + count > maxConstructionWorkers(b.type, data)) return fail('tooManyWorkers');
    if (idleWorkers(s).length < count) return fail('buildersBusy');
    const next = deepClone(s);
    const nb = next.village.buildings.find((x) => x.id === buildingId)!;
    const left = Math.max(0, nb.construction!.endsAt - now);
    const endsAt = now + Math.ceil((left * Math.max(1, current)) / (current + count));
    nb.construction!.endsAt = endsAt;
    assignWorkers(next, count, { kind: 'building', buildingId: nb.id });
    return { ok: true, state: next, endsAt };
  });
}

// ---------- Line buildings (walls) ----------

export interface Tile {
  x: number;
  y: number;
}

/**
 * Tiles of a straight line from `from` towards `to`, following whichever axis
 * the pointer moved further along (so a slightly crooked drag stays straight).
 */
export function lineTiles(from: Tile, to: Tile): Tile[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const alongX = Math.abs(dx) >= Math.abs(dy);
  const steps = Math.abs(alongX ? dx : dy);
  const dir = Math.sign(alongX ? dx : dy);
  const tiles: Tile[] = [];
  for (let i = 0; i <= steps; i++) {
    tiles.push(alongX ? { x: from.x + i * dir, y: from.y } : { x: from.x, y: from.y + i * dir });
  }
  return tiles;
}

/** Builds a whole straight line of a `lineBuild` type (e.g. walls) at once. */
export function buildLine(
  state: PlayerState,
  params: { type: string; from: Tile; to: Tile },
  now: number,
  data: GameData = gameData,
): ActionResult<{ buildingIds: string[] }> {
  return withSettled(state, now, (s) => {
    const def = data.buildingById.get(params.type);
    if (!def) return fail('unknownBuilding');
    if (!def.lineBuild) return fail('notLineBuilding');
    if (def.hidden) return fail('notAvailableYet');
    const first = def.levels[0]!;
    if (townHallLevel(s, data) < first.requiresTownHall) return fail('townHallTooLow');
    const tiles = lineTiles(params.from, params.to);
    if (countBuildings(s, def.id) + tiles.length > maxCountFor(s, def.id, data)) {
      return fail('maxCountReached');
    }
    const occupied = occupancy(s.village, data);
    const { mapSize } = data.village.village;
    for (const t of tiles) {
      const inside = t.x >= 0 && t.y >= 0 && t.x < mapSize && t.y < mapSize;
      if (!inside || occupied.has(key(t.x, t.y))) return fail('blocked');
      if (!isTileUnlocked(s.village, t.x, t.y, data)) return fail('plotLocked');
    }
    const cost = scaleAmount(first.cost, tiles.length);
    const unpaid = canPay(s, cost);
    if (unpaid) return fail(unpaid);

    const next = deepClone(s);
    applyAmount(next, cost, -1);
    const buildingIds = tiles.map((t) => {
      const id = newId(next, 'b');
      next.village.buildings.push({
        id,
        type: def.id,
        x: t.x,
        y: t.y,
        level: 1,
        construction: null,
        lastCollectAt: now,
        crop: null,
      });
      return id;
    });
    // One XP award per action, however long the line.
    recordAction(next, 'build', 1, data);
    return { ok: true, state: next, buildingIds };
  });
}

/**
 * Buildings of the same type and level joined to `buildingId` through
 * edge-neighbouring tiles (e.g. one connected stretch of wall).
 */
export function connectedGroup(
  state: PlayerState,
  buildingId: string,
  data: GameData = gameData,
): Building[] {
  const start = state.village.buildings.find((b) => b.id === buildingId);
  if (!start) return [];
  const size = sizeOf(start.type, data);
  const byTile = new Map<string, Building>();
  for (const b of state.village.buildings) {
    if (b.type === start.type && b.level === start.level && !b.construction) {
      byTile.set(key(b.x, b.y), b);
    }
  }
  const group: Building[] = [];
  const seen = new Set<string>([start.id]);
  const queue = [start];
  while (queue.length > 0) {
    const b = queue.shift()!;
    group.push(b);
    for (const [dx, dy] of [
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ] as const) {
      const n = byTile.get(key(b.x + dx, b.y + dy));
      if (n && !seen.has(n.id)) {
        seen.add(n.id);
        queue.push(n);
      }
    }
  }
  return group;
}

/** Upgrades every building in a connected stretch of a `lineBuild` type at once. */
export function upgradeGroup(
  state: PlayerState,
  buildingId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ count: number }> {
  return withSettled(state, now, (s) => {
    const b = s.village.buildings.find((x) => x.id === buildingId);
    if (!b) return fail('buildingNotFound');
    if (!buildingDef(b.type, data).lineBuild) return fail('notLineBuilding');
    if (b.construction) return fail('underConstruction');
    const target = levelDef(b.type, b.level + 1, data);
    if (!target) return fail('maxLevel');
    if (townHallLevel(s, data) < target.requiresTownHall) return fail('townHallTooLow');
    const group = connectedGroup(s, buildingId, data);
    const cost = scaleAmount(target.cost, group.length);
    const unpaid = canPay(s, cost);
    if (unpaid) return fail(unpaid);
    const next = deepClone(s);
    applyAmount(next, cost, -1);
    const ids = new Set(group.map((g) => g.id));
    for (const nb of next.village.buildings) {
      if (ids.has(nb.id)) nb.level += 1;
    }
    recordAction(next, 'build', 1, data);
    return { ok: true, state: next, count: group.length };
  });
}

export function moveBuilding(
  state: PlayerState,
  params: { buildingId: string; x: number; y: number },
  data: GameData = gameData,
): ActionResult {
  const b = state.village.buildings.find((x) => x.id === params.buildingId);
  if (!b) return fail('buildingNotFound');
  if (!isAreaUnlocked(state.village, sizeOf(b.type, data), params.x, params.y, data)) {
    return fail('plotLocked');
  }
  if (!canPlace(state.village, sizeOf(b.type, data), params.x, params.y, data, b.id))
    return fail('blocked');
  const next = deepClone(state);
  const nb = next.village.buildings.find((x) => x.id === params.buildingId)!;
  nb.x = params.x;
  nb.y = params.y;
  return { ok: true, state: next };
}

/**
 * Where a connected stretch of a `lineBuild` type (see connectedGroup) would stand if
 * `buildingId` moved to (x, y) and the rest kept their place relative to it, and whether
 * every new tile is inside the map, on open land and free of anything outside the stretch.
 */
export function groupMoveTiles(
  state: PlayerState,
  params: { buildingId: string; x: number; y: number },
  data: GameData = gameData,
): { ids: string[]; tiles: { x: number; y: number }[]; ok: boolean } {
  const b = state.village.buildings.find((x) => x.id === params.buildingId);
  if (!b || !buildingDef(b.type, data).lineBuild) return { ids: [], tiles: [], ok: false };
  const group = connectedGroup(state, b.id, data);
  const ids = new Set(group.map((g) => g.id));
  const dx = params.x - b.x;
  const dy = params.y - b.y;
  const tiles = group.map((g) => ({ x: g.x + dx, y: g.y + dy }));
  const taken = occupancy(state.village, data);
  const { mapSize } = data.village.village;
  const ok = tiles.every((t) => {
    const owner = taken.get(key(t.x, t.y));
    return (
      t.x >= 0 &&
      t.y >= 0 &&
      t.x < mapSize &&
      t.y < mapSize &&
      (owner === undefined || ids.has(owner)) &&
      isAreaUnlocked(state.village, 1, t.x, t.y, data)
    );
  });
  return { ids: group.map((g) => g.id), tiles, ok };
}

/** Moves a whole connected stretch of walls at once (see groupMoveTiles). */
export function moveGroup(
  state: PlayerState,
  params: { buildingId: string; x: number; y: number },
  data: GameData = gameData,
): ActionResult<{ count: number }> {
  const b = state.village.buildings.find((x) => x.id === params.buildingId);
  if (!b) return fail('buildingNotFound');
  if (!buildingDef(b.type, data).lineBuild) return fail('notLineBuilding');
  const { ids, tiles, ok } = groupMoveTiles(state, params, data);
  if (!ok) {
    const locked = tiles.some(
      (t) => t.x >= 0 && t.y >= 0 && !isAreaUnlocked(state.village, 1, t.x, t.y, data),
    );
    return fail(locked ? 'plotLocked' : 'blocked');
  }
  const next = deepClone(state);
  ids.forEach((id, i) => {
    const nb = next.village.buildings.find((x) => x.id === id)!;
    nb.x = tiles[i]!.x;
    nb.y = tiles[i]!.y;
  });
  return { ok: true, state: next, count: ids.length };
}

export function constructionRemaining(b: Building, now: number): number {
  return b.construction ? Math.max(0, b.construction.endsAt - now) : 0;
}

export function speedUpBuilding(
  state: PlayerState,
  buildingId: string,
  now: number,
  gemsFor: (seconds: number) => number,
): ActionResult<{ gems: number }> {
  const b = state.village.buildings.find((x) => x.id === buildingId);
  if (!b) return fail('buildingNotFound');
  const remaining = constructionRemaining(b, now);
  if (!b.construction || remaining === 0) return fail('alreadyFinished');
  const gems = gemsFor(remaining);
  if (state.resources.gems < gems) return fail('notEnoughGems');
  const next = deepClone(state);
  next.resources.gems -= gems;
  next.village.buildings.find((x) => x.id === buildingId)!.construction!.endsAt = now;
  return { ok: true, state: settleVillage(next, now), gems };
}

// ---------- Production ----------

export interface ProductionRate {
  resource: VillageResource;
  perHour: number;
  capacity: number;
}

/** Workers living and working inside a building (Tambang Emas, Penggilingan). */
export function staffWorkers(state: PlayerState, buildingId: string): number {
  return state.workers.filter((w) => w.task.kind === 'staffed' && w.task.buildingId === buildingId)
    .length;
}

/**
 * What a finished building produces per hour: a fixed rate (Pasar), or per worker
 * inside for staffed buildings. Null for buildings that produce nothing.
 */
export function productionOf(
  state: PlayerState,
  b: Building,
  data: GameData = gameData,
): ProductionRate | null {
  if (b.level < 1) return null;
  const level = levelDef(b.type, b.level, data);
  const allProd = getResearchBonus(state, 'allProductionBonus', data);
  if (level?.production) {
    const goldBonus =
      level.production.resource === 'gold' ? getResearchBonus(state, 'marketGoldBonus', data) : 0;
    const mult = 1 + allProd + goldBonus;
    return {
      resource: level.production.resource,
      perHour: Math.floor(level.production.perHour * mult),
      capacity: level.production.capacity,
    };
  }
  if (level?.ranchCapacity !== undefined) {
    // Peternakan: food from every animal living there.
    const ranchBonus = getResearchBonus(state, 'ranchYieldBonus', data);
    const mult = 1 + allProd + ranchBonus;
    const basePerHour = state.village.ranchAnimals
      .filter((a) => a.buildingId === b.id)
      .reduce(
        (sum, a) =>
          sum + (data.wilds.animals.types.find((t) => t.id === a.type)?.ranchFoodPerHour ?? 0),
        0,
      );
    return {
      resource: 'food',
      perHour: Math.floor(basePerHour * mult),
      capacity: level.ranchCapacity,
    };
  }
  const staffed = level?.staffedProduction;
  if (!staffed) return null;
  const staffedBonus = getResearchBonus(state, 'staffedYieldBonus', data);
  const mult = 1 + allProd + staffedBonus;
  return {
    resource: staffed.resource,
    perHour: Math.floor(staffed.perWorkerPerHour * staffWorkers(state, b.id) * mult),
    capacity: staffed.capacity,
  };
}

/**
 * Resource waiting in a producer (capped by its capacity). It is counted from the
 * clock, so it keeps growing while the game is closed.
 */
export function pendingProduction(
  state: PlayerState,
  b: Building,
  now: number,
  data: GameData = gameData,
): number {
  if (b.construction) return 0;
  const production = productionOf(state, b, data);
  if (!production) return 0;
  const hours = Math.max(0, now - b.lastCollectAt) / 3600;
  return Math.min(production.capacity, Math.floor(production.perHour * hours));
}

/** Moves what a producer holds into the resources and restarts its clock (mutates). */
export function bankProduction(
  state: PlayerState,
  b: Building,
  now: number,
  data: GameData,
): number {
  const production = productionOf(state, b, data);
  const amount = pendingProduction(state, b, now, data);
  if (production && amount > 0) state.resources[production.resource] += amount;
  b.lastCollectAt = now;
  return amount;
}

export function collectBuilding(
  state: PlayerState,
  buildingId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ resource: VillageResource; amount: number }> {
  return withSettled(state, now, (s) => {
    const b = s.village.buildings.find((x) => x.id === buildingId);
    if (!b) return fail('buildingNotFound');
    const production = productionOf(s, b, data);
    const amount = pendingProduction(s, b, now, data);
    if (!production || amount <= 0) return fail('nothingToCollect');
    const next = deepClone(s);
    next.resources[production.resource] += amount;
    next.village.buildings.find((x) => x.id === buildingId)!.lastCollectAt = now;
    recordAction(next, 'collect', 1, data);
    return { ok: true, state: next, resource: production.resource, amount };
  });
}

/** Puts idle workers inside a staffed building; they stay until taken out. */
export function staffBuilding(
  state: PlayerState,
  buildingId: string,
  count: number,
  now: number,
  data: GameData = gameData,
): ActionResult<{ collected: number }> {
  return withSettled(state, now, (s) => {
    const b = s.village.buildings.find((x) => x.id === buildingId);
    if (!b) return fail('buildingNotFound');
    if (buildingDef(b.type, data).feature !== 'staffed') return fail('notStaffed');
    if (b.level < 1) return fail('underConstruction');
    if (!Number.isInteger(count) || count < 1) return fail('invalidAmount');
    const slots = levelDef(b.type, b.level, data)?.workerSlots ?? 0;
    if (staffWorkers(s, b.id) + count > slots) return fail('tooManyWorkers');
    if (idleWorkers(s).length < count) return fail('buildersBusy');
    const next = deepClone(s);
    const nb = next.village.buildings.find((x) => x.id === buildingId)!;
    // The rate changes now, so bank what the old crew made first.
    const collected = bankProduction(next, nb, now, data);
    assignWorkers(next, count, { kind: 'staffed', buildingId: nb.id });
    return { ok: true, state: next, collected };
  });
}

/** Takes `count` workers out of a staffed building (they become idle). */
export function unstaffBuilding(
  state: PlayerState,
  buildingId: string,
  count: number,
  now: number,
  data: GameData = gameData,
): ActionResult<{ collected: number }> {
  return withSettled(state, now, (s) => {
    const b = s.village.buildings.find((x) => x.id === buildingId);
    if (!b) return fail('buildingNotFound');
    if (!Number.isInteger(count) || count < 1) return fail('invalidAmount');
    if (staffWorkers(s, b.id) === 0) return fail('noStaff');
    const next = deepClone(s);
    const nb = next.village.buildings.find((x) => x.id === buildingId)!;
    const collected = bankProduction(next, nb, now, data);
    next.workers
      .filter((w) => w.task.kind === 'staffed' && w.task.buildingId === nb.id)
      .slice(0, count)
      .forEach((w) => (w.task = { kind: 'idle' }));
    return { ok: true, state: next, collected };
  });
}

export type CropStatus = 'none' | 'empty' | 'growing' | 'ready';

export function cropStatus(b: Building, now: number, data: GameData = gameData): CropStatus {
  if (b.level < 1 || !levelDef(b.type, b.level, data)?.crop) return 'none';
  if (!b.crop) return 'empty';
  return b.crop.endsAt <= now ? 'ready' : 'growing';
}

export function plantCrop(
  state: PlayerState,
  buildingId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ gold: number }> {
  return withSettled(state, now, (s) => {
    const b = s.village.buildings.find((x) => x.id === buildingId);
    if (!b) return fail('buildingNotFound');
    const status = cropStatus(b, now, data);
    if (status === 'none') return fail('notAFarm');
    if (status !== 'empty') return fail('alreadyPlanted');
    // A field being upgraded can still be harvested, but not replanted.
    if (b.construction) return fail('underConstruction');
    const crop = levelDef(b.type, b.level, data)!.crop!;
    if (s.resources.gold < crop.plantGold) return fail('notEnoughGold');
    const yieldMult =
      1 +
      getResearchBonus(s, 'farmYieldBonus', data) +
      getResearchBonus(s, 'allProductionBonus', data);
    const next = deepClone(s);
    next.resources.gold -= crop.plantGold;
    next.village.buildings.find((x) => x.id === buildingId)!.crop = {
      endsAt: now + crop.seconds,
      food: Math.floor(crop.food * yieldMult),
    };
    return { ok: true, state: next, gold: crop.plantGold };
  });
}

export function harvestCrop(
  state: PlayerState,
  buildingId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ food: number }> {
  return withSettled(state, now, (s) => {
    const b = s.village.buildings.find((x) => x.id === buildingId);
    if (!b) return fail('buildingNotFound');
    const status = cropStatus(b, now, data);
    if (status === 'none') return fail('notAFarm');
    if (status === 'empty') return fail('noCrop');
    if (status === 'growing') return fail('notReady');
    const food = b.crop!.food;
    const next = deepClone(s);
    next.resources.food += food;
    next.village.buildings.find((x) => x.id === buildingId)!.crop = null;
    recordAction(next, 'harvest', 1, data);
    return { ok: true, state: next, food };
  });
}

/** Whether a building has something worth tapping for: a ripe field or a filled-up producer. */
export function isReadyToCollect(
  state: PlayerState,
  b: Building,
  now: number,
  data: GameData = gameData,
): boolean {
  if (cropStatus(b, now, data) === 'ready') return true;
  const production = productionOf(state, b, data);
  if (!production) return false;
  const threshold = Math.max(1, production.capacity * data.village.village.collectReadyRatio);
  return pendingProduction(state, b, now, data) >= threshold;
}

/** Collects every producer that is ready and harvests every ripe field. */
export function collectAll(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): ActionResult<VillageAmount & { count: number }> {
  return withSettled(state, now, (s) => {
    const next = deepClone(s);
    const total: VillageAmount = { gold: 0, food: 0, wood: 0, stone: 0 };
    let count = 0;
    let harvested = 0;
    for (const b of next.village.buildings) {
      if (!isReadyToCollect(s, b, now, data)) continue;
      if (b.crop && b.crop.endsAt <= now) {
        total.food += b.crop.food;
        b.crop = null;
        harvested++;
      } else {
        const production = productionOf(s, b, data)!;
        total[production.resource] += pendingProduction(s, b, now, data);
        b.lastCollectAt = now;
      }
      count++;
    }
    if (count === 0) return fail('nothingToCollect');
    applyAmount(next, total);
    recordAction(next, 'harvest', harvested, data);
    recordAction(next, 'collect', count - harvested, data);
    return { ok: true, state: next, ...total, count };
  });
}

/** Gold and food refunded when selling a sellable building (a share of what was paid). */
export function sellValue(b: Building, data: GameData = gameData): VillageAmount {
  const def = buildingDef(b.type, data);
  const paid: VillageAmount = { gold: 0, food: 0, wood: 0, stone: 0 };
  for (const level of def.levels.slice(0, Math.max(b.level, b.construction?.toLevel ?? 0))) {
    for (const r of VILLAGE_RESOURCES) paid[r] += level.cost[r];
  }
  const ratio = data.village.village.sellRefundRatio;
  const refund = { ...paid };
  for (const r of VILLAGE_RESOURCES) refund[r] = Math.floor(paid[r] * ratio);
  return refund;
}

export function sellBuilding(
  state: PlayerState,
  buildingId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<VillageAmount> {
  return withSettled(state, now, (s) => {
    const b = s.village.buildings.find((x) => x.id === buildingId);
    if (!b) return fail('buildingNotFound');
    if (!buildingDef(b.type, data).sellable) return fail('notSellable');
    if (b.construction) return fail('underConstruction');
    const refund = sellValue(b, data);
    const next = deepClone(s);
    applyAmount(next, refund);
    next.village.buildings = next.village.buildings.filter((x) => x.id !== buildingId);
    releaseWorkers(next, (task) => task.kind === 'staffed' && task.buildingId === buildingId);
    return { ok: true, state: next, ...refund };
  });
}

// ---------- Obstacles ----------

// ---------- New village ----------

/** Starting buildings from buildings.json plus randomly scattered obstacles. */
export function createVillage(
  rng: Rng,
  now: number,
  nextId: () => string,
  data: GameData = gameData,
): Village {
  const { startingBuildings, initialObstacles, keepClearRadius } = data.village.village;
  const village: Village = {
    buildings: startingBuildings.map((sb) => ({
      id: nextId(),
      type: sb.type,
      x: sb.x,
      y: sb.y,
      level: sb.level,
      construction: null,
      lastCollectAt: now,
      crop: null,
    })),
    obstacles: [],
    unlockedPlots: data.village.village.initialPlots.map(([px, py]) => plotKey(px, py)),
    regrowAt: now,
    animals: [],
    animalsAt: now,
    ranchAnimals: [],
    encounters: [],
    encountersAt: now,
    raidClock: 0,
  };
  const nearBuilding = (x: number, y: number, size: number) =>
    village.buildings.some((b) => {
      const s = sizeOf(b.type, data);
      return (
        x + size > b.x - keepClearRadius &&
        x < b.x + s + keepClearRadius &&
        y + size > b.y - keepClearRadius &&
        y < b.y + s + keepClearRadius
      );
    });
  scatterObstacles(village, initialObstacles, rng, nextId, nearBuilding, data);
  placeGoldVeins(village, rng, nextId, nearBuilding, data);
  return village;
}

/**
 * Gold veins (Tugas 1A.14): `goldVeins.clusters` [min, max] groups, each a side × side
 * block of gold nodes on free tiles anywhere on the map (locked land too).
 */
export function placeGoldVeins(
  village: Village,
  rng: Rng,
  nextId: () => string,
  avoid: (x: number, y: number, size: number) => boolean = () => false,
  data: GameData = gameData,
): void {
  const { node, clusters, side } = data.wilds.goldVeins;
  const { mapSize } = data.village.village;
  const want = rng.int(clusters[0], clusters[1]);
  for (let placed = 0, tries = 0; placed < want && tries < 200; tries++) {
    const x = rng.int(0, mapSize - side);
    const y = rng.int(0, mapSize - side);
    if (avoid(x, y, side) || !canPlace(village, side, x, y, data)) continue;
    for (let dy = 0; dy < side; dy++) {
      for (let dx = 0; dx < side; dx++) {
        village.obstacles.push({ id: nextId(), type: node, x: x + dx, y: y + dy, work: 0 });
      }
    }
    placed += 1;
  }
}

/**
 * Adds wild trees/rocks/bushes (wilds.json nodes, by weight) on free tiles until
 * the village has `target` of them. `avoid` rejects tiles to keep clear.
 */
export function scatterObstacles(
  village: Village,
  target: number,
  rng: Rng,
  nextId: () => string,
  avoid: (x: number, y: number, size: number) => boolean = () => false,
  data: GameData = gameData,
  nodeIds: readonly string[] = data.islands.islands[0]!.nodes,
): void {
  const { mapSize } = data.village.village;
  const defs = data.wilds.nodes.filter((d) => nodeIds.includes(d.id));
  const totalWeight = defs.reduce((sum, d) => sum + d.weight, 0);
  let attempts = 0;
  while (village.obstacles.length < target && attempts < target * 50) {
    attempts++;
    let r = rng.next() * totalWeight;
    const def = defs.find((d) => (r -= d.weight) < 0) ?? defs[0]!;
    const x = rng.int(0, mapSize - def.size);
    const y = rng.int(0, mapSize - def.size);
    if (avoid(x, y, def.size) || !canPlace(village, def.size, x, y, data)) continue;
    village.obstacles.push({ id: nextId(), type: def.id, x, y, work: 0 });
  }
}

/**
 * A new island: open starting plots, no buildings, its own wild nodes. Its first wild
 * animals and enemies come at once.
 */
export function createIslandVillage(
  rng: Rng,
  now: number,
  nextId: () => string,
  nodeIds: readonly string[],
  data: GameData = gameData,
): Village {
  const village: Village = {
    buildings: [],
    obstacles: [],
    unlockedPlots: data.village.village.initialPlots.map(([px, py]) => plotKey(px, py)),
    regrowAt: now,
    animals: [],
    animalsAt: now - data.wilds.animals.respawnHours * 3600,
    ranchAnimals: [],
    encounters: [],
    encountersAt: now - data.wilds.encounters.respawnHours * 3600,
    raidClock: 0,
  };
  scatterObstacles(
    village,
    data.village.village.initialObstacles,
    rng,
    nextId,
    undefined,
    data,
    nodeIds,
  );
  return village;
}
