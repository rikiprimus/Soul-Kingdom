import { deepClone } from './clone';
import { gameData, type GameData } from './data';
import { animalType, huntersOf } from './animals';
import { isOnMission, missionFor } from './missions';
import type { ActionError, ActionResult, PlayerState } from './state';
import { canPlace, sizeOf, type Building, type Tile } from './village';

/**
 * Where a monster or soldier stands in the village and where it is walking (Tugas 1A.15).
 * Movement is worked out from the clock: it left `x, y` at `departAt` and walks `path`
 * one tile after another at `rules.units.walkTilesPerSecond`.
 */
export interface UnitPlace {
  x: number;
  y: number;
  path: Tile[];
  departAt: number;
  /** Wild node (tree, rock, bush) this unit guards, so workers gathering there are safe. */
  guard: string | null;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

const unitIds = (state: PlayerState) => [
  ...state.monsters.map((m) => m.id),
  ...state.soldiers.map((s) => s.id),
];

/** Fractional tile the unit is at right now (between path tiles while walking). */
export function unitPoint(place: UnitPlace, now: number, data: GameData = gameData) {
  const walked = Math.max(0, now - place.departAt) * data.rules.units.walkTilesPerSecond;
  const route = [{ x: place.x, y: place.y }, ...place.path];
  const i = Math.min(Math.floor(walked), route.length - 1);
  const a = route[i]!;
  const b = route[Math.min(i + 1, route.length - 1)]!;
  const f = i === route.length - 1 ? 0 : walked - i;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/** The whole tile the unit is on (or has last reached) at `now`. */
export function unitTile(place: UnitPlace, now: number, data: GameData = gameData): Tile {
  const walked = Math.max(0, now - place.departAt) * data.rules.units.walkTilesPerSecond;
  const route = [{ x: place.x, y: place.y }, ...place.path];
  return route[Math.min(Math.floor(walked), route.length - 1)]!;
}

/**
 * Whether our units may pass a Gerbang (Tugas 1C.6): finished, not shut by the player,
 * and no raid on the village (gates close by themselves then).
 */
export function isGateOpen(state: PlayerState, b: Building, data: GameData = gameData): boolean {
  return (
    data.buildingById.get(b.type)?.feature === 'gate' &&
    b.level >= 1 &&
    !b.closed &&
    !state.village.encounters.some((e) => e.raid)
  );
}

/** Units may walk anywhere on the map that no building or wild node stands on,
 * locked land included (owner, 2026-10-21), and through open gates. */
const walkable = (state: PlayerState, t: Tile, data: GameData) =>
  canPlace(state.village, 1, t.x, t.y, data) ||
  state.village.buildings.some((b) => b.x === t.x && b.y === t.y && isGateOpen(state, b, data));

/** Opens or shuts a Gerbang. */
export function toggleGate(
  state: PlayerState,
  buildingId: string,
  data: GameData = gameData,
): ActionResult {
  const b = state.village.buildings.find((x) => x.id === buildingId);
  if (!b) return fail('buildingNotFound');
  if (data.buildingById.get(b.type)?.feature !== 'gate') return fail('notGate');
  const next = deepClone(state);
  const nb = next.village.buildings.find((x) => x.id === buildingId)!;
  if (b.closed) delete nb.closed;
  else nb.closed = true;
  return { ok: true, state: next };
}

const tileKey = (t: Tile) => `${t.x},${t.y}`;

/** Tiles other units stand on or are walking to: no two units share a tile. */
function heldTiles(state: PlayerState, except: ReadonlySet<string>): Set<string> {
  const held = new Set<string>();
  for (const [id, p] of Object.entries(state.units)) {
    if (except.has(id)) continue;
    held.add(tileKey(p.path.at(-1) ?? p));
  }
  return held;
}

/** Free open tiles in rings around `center`, nearest first (the centre itself first). */
function* ringTiles(center: Tile, maxRadius: number): Generator<Tile> {
  yield center;
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of [-r, r]) yield { x: center.x + dx, y: center.y + dy };
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      for (const dx of [-r, r]) yield { x: center.x + dx, y: center.y + dy };
    }
  }
}

/** Shortest 4-way path over open tiles from `from` (excluded) to `to`; null if none. */
function findPath(state: PlayerState, from: Tile, to: Tile, data: GameData): Tile[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  const { mapSize } = data.village.village;
  const key = (t: Tile) => t.y * mapSize + t.x;
  const prev = new Map<number, number>([[key(from), -1]]);
  const queue: Tile[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      if (prev.has(key(n)) || !walkable(state, n, data)) continue;
      prev.set(key(n), key(cur));
      if (n.x === to.x && n.y === to.y) {
        const path: Tile[] = [];
        for (let k = key(n); k !== key(from); k = prev.get(k)!) {
          path.unshift({ x: k % mapSize, y: Math.floor(k / mapSize) });
        }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

/** Next to the Sarang, Gudang, or Balai, where new monsters and soldiers first appear. */
function homeTile(state: PlayerState, data: GameData): Tile {
  const hub =
    state.village.buildings.find((b) => data.buildingById.get(b.type)?.feature === 'nest') ??
    state.village.buildings.find((b) => data.buildingById.get(b.type)?.feature === 'storage') ??
    state.village.buildings.find((b) => data.buildingById.get(b.type)?.feature === 'townHall');
  if (!hub) return { x: Math.floor(data.village.village.mapSize / 2), y: 0 };
  const size = sizeOf(hub.type, data);
  return { x: hub.x + Math.floor(size / 2), y: hub.y + size };
}

/**
 * Keeps `state.units` in step with the monsters and soldiers: newcomers get a free tile
 * near the Kandang, the gone are dropped, finished walks are folded into the standing
 * tile and guards of vanished nodes stand down. Same object when nothing changed.
 */
export function settleUnits(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  const ids = unitIds(state);
  const speed = data.rules.units.walkTilesPerSecond;
  const nodes = new Set(state.village.obstacles.map((o) => o.id));
  const stale = (id: string) => {
    const p = state.units[id];
    if (!p) return true;
    if (p.path.length > 0 && (now - p.departAt) * speed >= p.path.length) return true;
    return p.guard !== null && !nodes.has(p.guard);
  };
  const gone = Object.keys(state.units).some((id) => !ids.includes(id));
  if (!gone && !ids.some(stale)) return state;
  const next = deepClone(state);
  const units: Record<string, UnitPlace> = {};
  const taken = new Set<string>();
  for (const id of ids) {
    const p = next.units[id];
    if (!p) continue;
    const t = unitTile(p, now, data);
    const arrived = p.path.length > 0 && (now - p.departAt) * speed >= p.path.length;
    units[id] = arrived ? { x: t.x, y: t.y, path: [], departAt: now, guard: p.guard } : p;
    if (units[id]!.guard !== null && !nodes.has(units[id]!.guard!)) units[id]!.guard = null;
    taken.add(tileKey(units[id]!.path.at(-1) ?? units[id]!));
  }
  const home = homeTile(next, data);
  for (const id of ids) {
    if (units[id]) continue;
    let spot: Tile = home;
    for (const t of ringTiles(home, 12)) {
      if (walkable(next, t, data) && !taken.has(tileKey(t))) {
        spot = t;
        break;
      }
    }
    taken.add(`${spot.x},${spot.y}`);
    units[id] = { x: spot.x, y: spot.y, path: [], departAt: now, guard: null };
  }
  next.units = units;
  return next;
}

/**
 * Sends the chosen units to a tile, spread over free tiles around it (nearest first), each
 * on its own shortest path. `guard` marks them as guarding a wild node once there.
 */
function sendUnits(
  state: PlayerState,
  ids: readonly string[],
  center: Tile,
  guard: string | null,
  now: number,
  data: GameData,
): ActionResult<{ moved: string[] }> {
  if (ids.length === 0 || new Set(ids).size !== ids.length) return fail('invalidAmount');
  const s = settleUnits(state, now, data);
  for (const id of ids) {
    if (!s.units[id]) return fail('monsterNotFound');
    if (isOnMission(s, id)) return fail('monsterBusy');
  }
  const next = s === state ? deepClone(s) : s;
  // Collision: a spot taken (or about to be) by any other unit is skipped.
  const used = heldTiles(next, new Set(ids));
  const moved: string[] = [];
  const spots = ringTiles(center, 8);
  for (const id of ids) {
    const from = unitTile(next.units[id]!, now, data);
    for (let it = spots.next(); !it.done; it = spots.next()) {
      const t = it.value;
      if (used.has(tileKey(t)) || !walkable(next, t, data)) continue;
      const path = findPath(next, from, t, data);
      if (!path) continue;
      used.add(tileKey(t));
      next.units[id] = { x: from.x, y: from.y, path, departAt: now, guard };
      moved.push(id);
      break;
    }
  }
  if (moved.length === 0) return fail('blocked');
  return { ok: true, state: next, moved };
}

/** "Ketuk tanah": the selected units walk to that tile in a tight group and stay there. */
export function moveUnits(
  state: PlayerState,
  params: { ids: string[]; x: number; y: number },
  now: number,
  data: GameData = gameData,
): ActionResult<{ moved: string[] }> {
  const { mapSize } = data.village.village;
  const { x, y } = params;
  if (x < 0 || y < 0 || x >= mapSize || y >= mapSize) return fail('blocked');
  return sendUnits(state, params.ids, { x, y }, null, now, data);
}

/**
 * "Ketuk musuh" / Kirim tim: the team walks up to the enemy, no countdown. The fight
 * starts by itself once they come within its aggro radius (aggro.ts: it closes in too).
 */
export function sendTeam(
  state: PlayerState,
  params: { monsterIds: string[]; encounterId: string },
  now: number,
  data: GameData = gameData,
): ActionResult<{ moved: string[] }> {
  const e = state.village.encounters.find((x) => x.id === params.encounterId);
  if (!e) return fail('encounterNotFound');
  if (missionFor(state, e.id)) return fail('encounterBusy');
  const ids = params.monsterIds;
  if (ids.length > data.rules.skirmish.maxTeam) return fail('invalidAmount');
  for (const id of ids) {
    if (!unitIds(state).includes(id)) return fail('monsterNotFound');
    if (state.mixQueue.some((q) => q.parents.some((p) => p.id === id))) return fail('monsterBusy');
  }
  return sendUnits(state, ids, { x: e.x, y: e.y }, null, now, data);
}

/** "Menjauh": the selected units fall back to the Kandang, away from the wild enemies. */
export function retreatUnits(
  state: PlayerState,
  params: { ids: string[] },
  now: number,
  data: GameData = gameData,
): ActionResult<{ moved: string[] }> {
  return sendUnits(state, params.ids, homeTile(state, data), null, now, data);
}

/** "Ketuk pohon/batu": the selected units stand guard around a wild node. */
export function guardNode(
  state: PlayerState,
  params: { ids: string[]; obstacleId: string },
  now: number,
  data: GameData = gameData,
): ActionResult<{ moved: string[] }> {
  const node = state.village.obstacles.find((o) => o.id === params.obstacleId);
  if (!node) return fail('obstacleNotFound');
  return sendUnits(state, params.ids, { x: node.x, y: node.y }, node.id, now, data);
}

/**
 * "Buru" (Tugas 1C.9): soldiers walk to an animal and hunt it there, up to its
 * `maxWorkers`. They count as its guard; the hunt runs on active play like gathering.
 */
export function huntAnimal(
  state: PlayerState,
  params: { ids: string[]; animalId: string },
  now: number,
  data: GameData = gameData,
): ActionResult<{ moved: string[] }> {
  const animal = state.village.animals.find((a) => a.id === params.animalId);
  if (!animal) return fail('animalNotFound');
  for (const id of params.ids) {
    if (!state.soldiers.some((s) => s.id === id)) return fail('huntNeedsSoldiers');
  }
  if (state.workers.some((w) => w.task.kind === 'gathering' && w.task.targetId === animal.id)) {
    return fail('animalBusy');
  }
  const hunting = huntersOf(state, animal.id).filter((id) => !params.ids.includes(id));
  if (hunting.length + params.ids.length > animalType(animal.type, data).maxWorkers) {
    return fail('tooManyWorkers');
  }
  const r = sendUnits(state, params.ids, { x: animal.x, y: animal.y }, animal.id, now, data);
  if (!r.ok) return r;
  const a = r.state.village.animals.find((x) => x.id === animal.id)!;
  // Switching from capturing to hunting starts the work over.
  if (a.job !== 'hunt') {
    a.job = 'hunt';
    a.work = 0;
  }
  return r;
}

/** Units guarding a wild node (for the coming ambushes while gathering). */
export function guardsOf(state: PlayerState, obstacleId: string): string[] {
  return Object.entries(state.units)
    .filter(([, p]) => p.guard === obstacleId)
    .map(([id]) => id);
}
