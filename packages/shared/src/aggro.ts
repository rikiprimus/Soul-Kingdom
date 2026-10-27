import { deepClone } from './clone';
import { gameData, type GameData } from './data';
import { encounterLevelIndex, rollEncounter } from './encounters';
import {
  encounterGroup,
  isOnMission,
  startFight,
  type Mission,
  type WildEncounter,
} from './missions';
import { createRng } from './rng';
import type { PlayerState } from './state';
import { guardsOf, unitPoint } from './units';
import { canPlace, townHallLevel, type Obstacle } from './village';
import { releaseWorkers } from './workers';

/** What an ambush at a wild node did, for the client to show. */
export interface AmbushResult {
  encounterId: string;
  /** Guards were there and fought first. */
  guarded: boolean;
  guardsWon: boolean;
  workersLost: number;
}

/** Wakes this close (tiles): packs (bandits, goblins) and wild monsters differ. */
export function aggroRadius(e: WildEncounter, data: GameData = gameData): number {
  const { aggro } = data.wilds.encounters;
  return encounterGroup(e, data).kind === 'monster' ? aggro.monsterTiles : aggro.banditTiles;
}

/**
 * Starts a fight between `ids` and an enemy: a mission that reaches the enemy at
 * `arriveAt` (simulated right away when that is now).
 */
function engage(
  next: PlayerState,
  ids: string[],
  e: WildEncounter,
  arriveAt: number,
  now: number,
  data: GameData,
): Mission {
  const m: Mission = {
    id: `t${next.nextId}`,
    encounterId: e.id,
    monsterIds: ids,
    arriveAt,
    fight: null,
  };
  next.nextId += 1;
  next.missions.push(m);
  if (arriveAt <= now) startFight(next, m, e, data);
  return m;
}

/** Kills each of these workers with `workerDeathChance`; returns how many fell. */
function strikeWorkers(next: PlayerState, workerIds: string[], data: GameData): number {
  const rng = createRng(next.rngState);
  const { workerDeathChance } = data.wilds.encounters.ambush;
  const fallen = new Set(workerIds.filter(() => rng.chance(workerDeathChance)));
  next.rngState = rng.getState();
  next.workers = next.workers.filter((w) => !fallen.has(w.id));
  return fallen.size;
}

/**
 * An ambush at a node that was just gathered (Tugas: penyergapan): enemies from the
 * Balai's encounter table appear on (or next to) the node. Its guards fight at once;
 * with no guards, or if they lose, each worker who was there may die. Mutates `next`
 * and uses its RNG.
 */
export function ambushAt(
  next: PlayerState,
  node: Pick<Obstacle, 'id' | 'x' | 'y'>,
  workerIds: string[],
  now: number,
  data: GameData = gameData,
): AmbushResult {
  const rng = createRng(next.rngState);
  const rolled = rollEncounter(encounterLevelIndex(townHallLevel(next, data), data), rng, data);
  next.rngState = rng.getState();
  // On the node's tile if it is free (it was gathered away), else the nearest free one.
  let spot = { x: node.x, y: node.y };
  outer: for (let r = 0; r <= 3; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (canPlace(next.village, 1, node.x + dx, node.y + dy, data)) {
          spot = { x: node.x + dx, y: node.y + dy };
          break outer;
        }
      }
    }
  }
  const leavesAt = now + data.wilds.encounters.ambush.leaveHours * 3600;
  const e: WildEncounter = { ...rolled, id: `e${next.nextId}`, ...spot, leavesAt };
  next.nextId += 1;
  next.village.encounters.push(e);
  const { maxTeam } = data.rules.skirmish;
  const guards = guardsOf(next, node.id)
    .filter((id) => !isOnMission(next, id))
    .slice(0, maxTeam);
  let guardsWon = false;
  if (guards.length > 0) {
    guardsWon = engage(next, guards, e, now, now, data).fight?.won ?? false;
  }
  const workersLost = guardsWon ? 0 : strikeWorkers(next, workerIds, data);
  return { encounterId: e.id, guarded: guards.length > 0, guardsWon, workersLost };
}

/**
 * Enemies wake up when our units come close: every idle enemy with monsters or soldiers
 * within its aggro radius chases them (arriving after distance / chase speed) and the
 * fight starts there. With no units in reach, workers gathering a node in reach are
 * struck instead and the survivors run off. Same object when nothing woke.
 */
export function aggroEncounters(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  const { chaseTilesPerSecond } = data.wilds.encounters.aggro;
  const { maxTeam } = data.rules.skirmish;
  const busy = new Set(state.missions.map((m) => m.encounterId));
  // Ambush spawns that nobody fought wander off (so they never pile up).
  let next: PlayerState | null = null;
  const gone = state.village.encounters.filter(
    (e) => e.leavesAt != null && e.leavesAt <= now && !busy.has(e.id),
  );
  if (gone.length > 0) {
    next = deepClone(state);
    const ids = new Set(gone.map((e) => e.id));
    next.village.encounters = next.village.encounters.filter((e) => !ids.has(e.id));
  }
  const reach = (e: WildEncounter, x: number, y: number) =>
    Math.hypot(x - (e.x + 0.5), y - (e.y + 0.5));
  for (const e of (next ?? state).village.encounters) {
    // Raiders have their own defence rules (raids.ts).
    if (busy.has(e.id) || e.raid) continue;
    const s = next ?? state;
    const radius = aggroRadius(e, data);
    const near = Object.entries(s.units)
      .filter(([id]) => !isOnMission(s, id))
      .map(([id, p]) => {
        const pt = unitPoint(p, now, data);
        return { id, d: reach(e, pt.x + 0.5, pt.y + 0.5) };
      })
      .filter((u) => u.d <= radius)
      .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
      .slice(0, maxTeam);
    if (near.length > 0) {
      next ??= deepClone(state);
      const arriveAt = now + Math.ceil(near[0]!.d / chaseTilesPerSecond);
      engage(
        next,
        near.map((u) => u.id),
        e,
        arriveAt,
        now,
        data,
      );
      continue;
    }
    // Workers gathering in reach (their node's tile is where they work); during a raid on
    // the village they shelter in the Balai Utama and cannot be struck (Tugas 1C.9).
    if (s.village.encounters.some((x) => x.raid)) continue;
    for (const o of s.village.obstacles) {
      if (reach(e, o.x + 0.5, o.y + 0.5) > radius) continue;
      const crew = s.workers.filter((w) => w.task.kind === 'gathering' && w.task.targetId === o.id);
      if (crew.length === 0) continue;
      next ??= deepClone(state);
      strikeWorkers(
        next,
        crew.map((w) => w.id),
        data,
      );
      releaseWorkers(next, (t) => t.kind === 'gathering' && t.targetId === o.id);
    }
  }
  return next ?? state;
}
