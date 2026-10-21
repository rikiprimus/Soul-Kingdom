import { deepClone } from './clone';
import { gameData, type GameData } from './data';
import type { WildEncounter } from './missions';
import { createRng, type Rng } from './rng';
import type { PlayerState } from './state';
import { canPlace, isTileUnlocked, townHallLevel } from './village';

/** Seconds between encounter spawns. */
export const encounterRespawnSeconds = (data: GameData = gameData) =>
  data.wilds.encounters.respawnHours * 3600;

/** The encounter table row for a Balai level: the highest row it has reached. */
export function encounterLevelIndex(hall: number, data: GameData = gameData): number {
  const levels = data.wilds.encounters.levels;
  let index = 0;
  levels.forEach((l, i) => {
    if (l.townHall <= hall) index = i;
  });
  return index;
}

/** How many groups wait on the map at once for this Balai level. */
export function encounterTarget(hall: number, data: GameData = gameData): number {
  const table = data.wilds.encounters.groupsByTownHall;
  return table[Math.min(Math.max(1, hall), table.length) - 1] ?? 0;
}

/** Rolls one group from a table row: kind by weight, size in its range, enemy kinds. */
export function rollEncounter(
  levelIndex: number,
  rng: Rng,
  data: GameData = gameData,
): Omit<WildEncounter, 'id' | 'x' | 'y'> {
  const groups = data.wilds.encounters.levels[levelIndex]!.groups;
  const total = groups.reduce((sum, g) => sum + g.weight, 0);
  let r = rng.next() * total;
  let group = groups.findIndex((g) => (r -= g.weight) < 0);
  if (group < 0) group = 0;
  const def = groups[group]!;
  const count = rng.int(def.count[0], def.count[1]);
  const enemies: WildEncounter['enemies'] = [];
  if (def.kind === 'monster') {
    const forms = data.formsByTier.get(def.formTier!) ?? [];
    for (let i = 0; i < count; i++) {
      enemies.push({
        form: rng.pick(forms).id,
        element: rng.pick(data.baseUnits),
        stage: def.stage!,
      });
    }
  }
  return { level: levelIndex, group, count, enemies };
}

/** A free tile for an encounter: outside the village (locked land) when there is any. */
function encounterTile(state: PlayerState, rng: Rng, data: GameData) {
  const { mapSize } = data.village.village;
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = rng.int(0, mapSize - 1);
    const y = rng.int(0, mapSize - 1);
    const outside = attempt < 150 ? !isTileUnlocked(state.village, x, y, data) : true;
    const taken = state.village.encounters.some((e) => e.x === x && e.y === y);
    if (outside && !taken && canPlace(state.village, 1, x, y, data)) return { x, y };
  }
  return null;
}

/**
 * Once `respawnHours` have passed since the last spawn, groups come back up to the
 * number for the current Balai level, rolled from that level's table (bandits first,
 * then small monsters, then many small or one big). The timer restarts from `now`.
 * Deterministic from the saved RNG.
 */
export function spawnEncounters(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  if (now - state.village.encountersAt < encounterRespawnSeconds(data)) return state;
  const next = deepClone(state);
  const rng = createRng(next.rngState);
  const hall = townHallLevel(next, data);
  const target = encounterTarget(hall, data);
  const level = encounterLevelIndex(hall, data);
  // A raid on the village is not one of the waiting groups.
  const waiting = () => next.village.encounters.filter((e) => !e.raid).length;
  while (waiting() < target) {
    const tile = encounterTile(next, rng, data);
    if (!tile) break;
    next.village.encounters.push({
      id: `e${next.nextId}`,
      ...tile,
      ...rollEncounter(level, rng, data),
    });
    next.nextId += 1;
  }
  next.village.encountersAt = now;
  next.rngState = rng.getState();
  return next;
}
