import { simulateBattle, type Fighter } from './battle';
import { deepClone } from './clone';
import { gameData, VILLAGE_RESOURCES, type GameData, type VillageAmount } from './data';
import { encounterLevelIndex, rollEncounter } from './encounters';
import {
  encounterFighters,
  encounterGroup,
  isOnMission,
  missionFor,
  teamFighters,
  type Mission,
  type WildEncounter,
} from './missions';
import { createRng } from './rng';
import type { PlayerState } from './state';
import { unitPoint } from './units';
import {
  isTileUnlocked,
  occupancy,
  sizeOf,
  townHallLevel,
  type Building,
  type Tile,
} from './village';

/**
 * How a raid on the village is going (Tugas 1.7). It only moves with active play: first
 * `warnLeft` seconds of warning on the spawn tile, then one step at a time towards the
 * Balai Utama. A step onto a wall segment first breaks it (`breaking`).
 */
export interface RaidMarch {
  warnLeft: number;
  /** Tile of the current step (null while standing), seconds left of it and its full length. */
  next: Tile | null;
  stepLeft: number;
  stepSeconds: number;
  /** Wall segment (building id) on `next` that is being broken before stepping there. */
  breaking: string | null;
}

/** What a stretch of raid time did, for the client to show. */
export type RaidEvent =
  | { kind: 'warning'; encounterId: string; x: number; y: number }
  | { kind: 'wallBroken'; buildingId: string; x: number; y: number }
  | {
      kind: 'defence';
      encounterId: string;
      missionId: string;
      defenders: number;
      towers: number;
    };

/** The group raiding the village right now, if any (there is at most one). */
export function currentRaid(state: PlayerState): WildEncounter | undefined {
  return state.village.encounters.find((e) => e.raid);
}

export const isTower = (b: Building, data: GameData = gameData) =>
  b.type === data.rules.raids.tower.building && b.level >= 1;

const isWall = (b: Building, data: GameData) => b.type === data.rules.raids.wall.building;

/** Fractional tile the raiders are at (between tiles while stepping, still while breaking). */
export function raidPoint(e: WildEncounter): { x: number; y: number } {
  const march = e.raid;
  if (!march?.next || march.breaking || march.stepSeconds <= 0) return { x: e.x, y: e.y };
  const f = 1 - march.stepLeft / march.stepSeconds;
  return { x: e.x + (march.next.x - e.x) * f, y: e.y + (march.next.y - e.y) * f };
}

/** Damage per second of the whole group, ignoring armour: how fast it breaks walls. */
export function raidDps(e: WildEncounter, data: GameData = gameData): number {
  const { attackSecondsAtSpd10 } = data.rules.battle.sim;
  return encounterFighters(e, data).reduce(
    (sum, f) => sum + (f.stats.atk * f.stats.spd) / (attackSecondsAtSpd10 * 10),
    0,
  );
}

/** Seconds a group with `dps` needs to break one wall segment. */
export function wallBreakSeconds(wall: Building, dps: number, data: GameData = gameData): number {
  const { hpByLevel } = data.rules.raids.wall;
  const hp = hpByLevel[Math.min(Math.max(1, wall.level), hpByLevel.length) - 1]!;
  return hp / dps;
}

/** A watchtower as a fighter that never moves, with the stats of its level. */
export function towerFighter(b: Building, data: GameData = gameData): Fighter {
  const { levels } = data.rules.raids.tower;
  const stats = levels[Math.min(Math.max(1, b.level), levels.length) - 1]!;
  return { id: `tower:${b.id}`, stats: { ...stats }, element: null, skill: false, fixed: true };
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Tiles touching a side of the Balai Utama: reaching one means the raid has arrived. */
function hallSides(state: PlayerState, data: GameData): Set<number> {
  const { mapSize } = data.village.village;
  const hall = state.village.buildings.find((b) => b.type === data.townHallId);
  const sides = new Set<number>();
  if (!hall) return sides;
  const size = sizeOf(hall.type, data);
  for (let i = 0; i < size; i++) {
    for (const [x, y] of [
      [hall.x + i, hall.y - 1],
      [hall.x + i, hall.y + size],
      [hall.x - 1, hall.y + i],
      [hall.x + size, hall.y + i],
    ] as const) {
      if (x >= 0 && y >= 0 && x < mapSize && y < mapSize) sides.add(y * mapSize + x);
    }
  }
  return sides;
}

/**
 * The quickest way (in seconds) from the raid's tile to a side of the Balai Utama, as
 * the tiles to step on. Buildings and wild nodes block the way; a wall segment can be
 * broken at the cost of its break time, so raiders go round a wall when that is quicker
 * and break through when it is not. Should nothing be passable, they slip through
 * buildings. Empty when they are already there (or there is no Balai).
 */
export function raidRoute(state: PlayerState, e: WildEncounter, data: GameData = gameData): Tile[] {
  const { mapSize } = data.village.village;
  const targets = hallSides(state, data);
  const start = e.y * mapSize + e.x;
  if (targets.size === 0 || targets.has(start)) return [];
  const tiles = occupancy(state.village, data);
  const byId = new Map(state.village.buildings.map((b) => [b.id, b]));
  const step = 1 / data.rules.raids.walkTilesPerSecond;
  const dps = raidDps(e, data);
  const enterCost = (x: number, y: number, slip: boolean) => {
    const id = tiles.get(`${x},${y}`);
    if (id === undefined) return step;
    const b = byId.get(id);
    if (b && isWall(b, data)) return wallBreakSeconds(b, dps, data) + step;
    return slip ? step : Infinity;
  };
  for (const slip of [false, true]) {
    const path = cheapestPath(mapSize, start, targets, (x, y) => enterCost(x, y, slip));
    if (path) return path;
  }
  return [];
}

/** Dijkstra over the 4-way grid from `start` to the nearest of `targets`; null if none. */
function cheapestPath(
  mapSize: number,
  start: number,
  targets: ReadonlySet<number>,
  cost: (x: number, y: number) => number,
): Tile[] | null {
  const dist = new Float64Array(mapSize * mapSize).fill(Infinity);
  const prev = new Int32Array(mapSize * mapSize).fill(-1);
  dist[start] = 0;
  // Binary heap of [distance, tile]; ties broken by tile index so the route is deterministic.
  const heap: [number, number][] = [[0, start]];
  const less = (a: [number, number], b: [number, number]) =>
    a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const push = (item: [number, number]) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (!less(heap[i]!, heap[p]!)) break;
      [heap[i], heap[p]] = [heap[p]!, heap[i]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top;
  };
  while (heap.length > 0) {
    const [d, cur] = pop();
    if (d > dist[cur]!) continue;
    if (targets.has(cur)) {
      const path: Tile[] = [];
      for (let k = cur; k !== start; k = prev[k]!) {
        path.unshift({ x: k % mapSize, y: Math.floor(k / mapSize) });
      }
      return path;
    }
    const cx = cur % mapSize;
    const cy = Math.floor(cur / mapSize);
    for (const [dx, dy] of STEPS) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= mapSize || y >= mapSize) continue;
      const c = cost(x, y);
      if (c === Infinity) continue;
      const n = y * mapSize + x;
      if (d + c < dist[n]!) {
        dist[n] = d + c;
        prev[n] = cur;
        push([d + c, n]);
      }
    }
  }
  return null;
}

/**
 * Who stands in the raiders' way right now: idle monsters and soldiers within
 * `defendTiles` (nearest first, at most `battle.maxUnits`) and towers whose reach
 * covers them. Units on a mission or in the Soul Mixer do not join.
 */
export function raidDefenders(
  state: PlayerState,
  e: WildEncounter,
  now: number,
  data: GameData = gameData,
): { unitIds: string[]; towerIds: string[] } {
  const { defendTiles, tower } = data.rules.raids;
  const p = raidPoint(e);
  const cx = p.x + 0.5;
  const cy = p.y + 0.5;
  const inMixer = new Set(state.mixQueue.flatMap((q) => q.parents.map((x) => x.id)));
  const unitIds = Object.entries(state.units)
    .filter(([id]) => !inMixer.has(id) && !isOnMission(state, id))
    .map(([id, place]) => {
      const pt = unitPoint(place, now, data);
      return { id, d: Math.hypot(pt.x + 0.5 - cx, pt.y + 0.5 - cy) };
    })
    .filter((u) => u.d <= defendTiles)
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
    .slice(0, data.rules.battle.maxUnits)
    .map((u) => u.id);
  const towerIds = state.village.buildings
    .filter((b) => {
      if (!isTower(b, data)) return false;
      const half = sizeOf(b.type, data) / 2;
      return Math.hypot(b.x + half - cx, b.y + half - cy) <= tower.reachTiles;
    })
    .map((b) => b.id);
  return { unitIds, towerIds };
}

/**
 * The defence fight, simulated now: raiders attack, our units and towers defend (to the
 * end, like wild fights). A win pays the group's reward; a loss lets the raiders steal
 * `stealRatio` of each village resource when the fight ends. Mutates `next`.
 */
export function startRaidFight(
  next: PlayerState,
  e: WildEncounter,
  unitIds: readonly string[],
  towerIds: readonly string[],
  now: number,
  data: GameData = gameData,
): Mission {
  const rng = createRng(next.rngState);
  const towers = towerIds
    .map((id) => next.village.buildings.find((b) => b.id === id))
    .filter((b): b is Building => b !== undefined)
    .map((b) => towerFighter(b, data));
  const defenders = [...teamFighters(next, unitIds, data), ...towers];
  const raiders = encounterFighters(e, data);
  const battle = simulateBattle(raiders, defenders, rng.int(0, 0x7fffffff), data, {
    untilDefeat: true,
  });
  const won = battle.winner === 'defenders';
  const group = encounterGroup(e, data);
  const reward: VillageAmount = { gold: 0, food: 0, wood: 0, stone: 0 };
  let soulCrystal = 0;
  let stolen: VillageAmount | null = null;
  if (won) {
    for (const r of VILLAGE_RESOURCES) reward[r] = group.reward[r];
    soulCrystal = rng.chance(group.reward.soulCrystalChance) ? 1 : 0;
  } else {
    const { stealRatio } = data.rules.raids;
    stolen = { gold: 0, food: 0, wood: 0, stone: 0 };
    for (const r of VILLAGE_RESOURCES) stolen[r] = Math.floor(next.resources[r] * stealRatio);
  }
  next.rngState = rng.getState();
  const m: Mission = {
    id: `t${next.nextId}`,
    encounterId: e.id,
    monsterIds: [...unitIds],
    arriveAt: now,
    fight: {
      startsAt: now,
      endsAt: now + Math.ceil(battle.ticks / data.rules.battle.ticksPerSecond),
      won,
      dead: unitIds.filter((id) => (battle.hp[id] ?? 0) <= 0),
      hpLeft: Object.fromEntries(defenders.map((f) => [f.id, battle.hp[f.id]! / f.stats.hp])),
      enemyHpLeft: raiders.map((f) => battle.hp[f.id]! / f.stats.hp),
      reward,
      soulCrystal,
      stolen,
    },
  };
  next.nextId += 1;
  next.missions.push(m);
  return m;
}

/**
 * Where raiders gather: a free tile on locked land right next to the village (or on the
 * map edge once everything is open), picked with the state's RNG.
 */
function raidSpawnTile(state: PlayerState, data: GameData): Tile | null {
  const { mapSize } = data.village.village;
  const { village } = state;
  const taken = new Set(village.encounters.map((e) => `${e.x},${e.y}`));
  // One occupancy map for the whole scan (building it per tile is far too slow).
  const tiles = occupancy(village, data);
  const free = (x: number, y: number) => !taken.has(`${x},${y}`) && !tiles.has(`${x},${y}`);
  const outside: Tile[] = [];
  const edge: Tile[] = [];
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      if (!free(x, y)) continue;
      if (x === 0 || y === 0 || x === mapSize - 1 || y === mapSize - 1) edge.push({ x, y });
      if (isTileUnlocked(village, x, y, data)) continue;
      const bordersVillage = STEPS.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return (
          nx >= 0 &&
          ny >= 0 &&
          nx < mapSize &&
          ny < mapSize &&
          isTileUnlocked(village, nx, ny, data)
        );
      });
      if (bordersVillage) outside.push({ x, y });
    }
  }
  const pool = outside.length > 0 ? outside : edge;
  if (pool.length === 0) return null;
  const rng = createRng(state.rngState);
  const tile = rng.pick(pool);
  state.rngState = rng.getState();
  return tile;
}

/** A raid group from the Balai's encounter table, waiting just outside the village. */
function spawnRaid(next: PlayerState, data: GameData): WildEncounter | null {
  const tile = raidSpawnTile(next, data);
  if (!tile) return null;
  const rng = createRng(next.rngState);
  const rolled = rollEncounter(encounterLevelIndex(townHallLevel(next, data), data), rng, data);
  next.rngState = rng.getState();
  const e: WildEncounter = {
    ...rolled,
    id: `e${next.nextId}`,
    ...tile,
    raid: {
      warnLeft: data.rules.raids.warnSeconds,
      next: null,
      stepLeft: 0,
      stepSeconds: 0,
      breaking: null,
    },
  };
  next.nextId += 1;
  next.village.encounters.push(e);
  return e;
}

/** Starts the defence fight when someone is in the way (or the raid has arrived). */
function defend(
  next: PlayerState,
  e: WildEncounter,
  now: number,
  arrived: boolean,
  events: RaidEvent[],
  data: GameData,
): boolean {
  const { unitIds, towerIds } = raidDefenders(next, e, now, data);
  if (!arrived && unitIds.length === 0 && towerIds.length === 0) return false;
  const m = startRaidFight(next, e, unitIds, towerIds, now, data);
  events.push({
    kind: 'defence',
    encounterId: e.id,
    missionId: m.id,
    defenders: unitIds.length,
    towers: towerIds.length,
  });
  return true;
}

const EPS = 1e-9;

/** Moves a raid on by `seconds` (warning, steps, wall breaking) until a fight starts. */
function marchRaid(
  next: PlayerState,
  e: WildEncounter,
  seconds: number,
  now: number,
  events: RaidEvent[],
  data: GameData,
): void {
  const march = e.raid!;
  const step = 1 / data.rules.raids.walkTilesPerSecond;
  let left = seconds;
  for (;;) {
    if (defend(next, e, now, false, events, data)) return;
    if (left <= EPS) return;
    if (march.warnLeft > 0) {
      const use = Math.min(left, march.warnLeft);
      march.warnLeft -= use;
      left -= use;
      continue;
    }
    if (!march.next) {
      const route = raidRoute(next, e, data);
      if (route.length === 0) {
        defend(next, e, now, true, events, data);
        return;
      }
      const to = route[0]!;
      const wall = next.village.buildings.find(
        (b) => isWall(b, data) && b.x === to.x && b.y === to.y,
      );
      march.next = to;
      march.breaking = wall?.id ?? null;
      march.stepSeconds = wall ? wallBreakSeconds(wall, raidDps(e, data), data) : step;
      march.stepLeft = march.stepSeconds;
    }
    const use = Math.min(left, march.stepLeft);
    march.stepLeft -= use;
    left -= use;
    if (march.stepLeft > EPS) continue;
    if (march.breaking) {
      // The segment is broken through; then they step onto its tile.
      const wall = next.village.buildings.find((b) => b.id === march.breaking);
      if (wall) {
        next.village.buildings = next.village.buildings.filter((b) => b.id !== wall.id);
        events.push({ kind: 'wallBroken', buildingId: wall.id, x: wall.x, y: wall.y });
      }
      march.breaking = null;
      march.stepSeconds = step;
      march.stepLeft = step;
    } else {
      e.x = march.next!.x;
      e.y = march.next!.y;
      march.next = null;
      march.stepLeft = 0;
      march.stepSeconds = 0;
    }
  }
}

/**
 * Advances raids by `seconds` of active play (the client calls this only while the game
 * is open). With no raid, the raid clock runs from Balai `minTownHall`; when it reaches
 * `intervalSeconds` a group appears just outside the village with a warning. A raid
 * waits out its warning, then walks to the Balai Utama, breaking walls in its way, until
 * defenders are near, a tower reaches it, or it arrives. While a team fights it (sent by
 * the player or defending) it stands still. Same object when nothing changed.
 */
export function advanceRaids(
  state: PlayerState,
  seconds: number,
  now: number,
  data: GameData = gameData,
): { state: PlayerState; events: RaidEvent[] } {
  const { raids } = data.rules;
  if (seconds <= 0) return { state, events: [] };
  const events: RaidEvent[] = [];
  const raid = currentRaid(state);
  if (!raid) {
    if (townHallLevel(state, data) < raids.minTownHall) return { state, events };
    const raidClock = state.village.raidClock + seconds;
    // Just the clock: a shallow copy is enough (nothing else changes).
    if (raidClock < raids.intervalSeconds) {
      return { state: { ...state, village: { ...state.village, raidClock } }, events };
    }
    const next = deepClone(state);
    next.village.raidClock = 0;
    const e = spawnRaid(next, data);
    if (e) events.push({ kind: 'warning', encounterId: e.id, x: e.x, y: e.y });
    return { state: next, events };
  }
  if (missionFor(state, raid.id)) return { state, events };
  const next = deepClone(state);
  const e = next.village.encounters.find((x) => x.id === raid.id)!;
  marchRaid(next, e, seconds, now, events, data);
  return { state: next, events };
}
