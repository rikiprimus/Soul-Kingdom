import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { encounterLevelIndex, spawnEncounters } from './encounters';
import { islandStatus, travelTo, unlockIsland } from './islands';
import { advanceRaids } from './raids';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import {
  buildBuilding,
  canPlaceBuilding,
  maxCountFor,
  settleVillage,
  townHallLevel,
  levelDef,
} from './village';
import { populationCap } from './workers';

const T0 = 1_000_000;
const [MAIN, ISLAND] = gameData.islands.islands;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

function freeSpot(s: PlayerState, size: number) {
  const { mapSize } = gameData.village.village;
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) if (canPlaceBuilding(s.village, size, x, y)) return { x, y };
  }
  throw new Error('peta penuh');
}

/** A rich game whose Balai Utama is high enough for the second island. */
function rich(): PlayerState {
  const s = createInitialState(T0, 4);
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = ISLAND!.requiresTownHall;
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 1_000_000;
  return s;
}

/** `rich()` standing on the opened second island. */
function onIsland(): PlayerState {
  return ok(travelTo(ok(unlockIsland(rich(), ISLAND!.id, T0)).state, ISLAND!.id)).state;
}

describe('opening islands', () => {
  it('starts on the main island; others need the Balai level and their price', () => {
    const s = createInitialState(T0, 4);
    expect(s.island).toBe(MAIN!.id);
    expect(islandStatus(s, MAIN!.id)).toBe('current');
    expect(islandStatus(s, ISLAND!.id)).toBe('townHall');
    expect(unlockIsland(s, ISLAND!.id, T0)).toEqual({ ok: false, error: 'townHallTooLow' });
    const r = rich();
    expect(islandStatus(r, ISLAND!.id)).toBe('buyable');
    const poor = deepClone(r);
    poor.resources.gold = 0;
    expect(unlockIsland(poor, ISLAND!.id, T0).ok).toBe(false);
  });

  it('opens as an empty village with its own wild nodes, paid once', () => {
    const r = rich();
    const opened = ok(unlockIsland(r, ISLAND!.id, T0)).state;
    for (const res of ['gold', 'food', 'wood', 'stone'] as const) {
      expect(opened.resources[res]).toBe(r.resources[res] - ISLAND!.cost[res]);
    }
    const island = opened.islands[ISLAND!.id]!;
    expect(island.buildings).toEqual([]);
    expect(island.obstacles.length).toBeGreaterThan(0);
    for (const o of island.obstacles) expect(ISLAND!.nodes).toContain(o.type);
    expect(islandStatus(opened, ISLAND!.id)).toBe('open');
    expect(unlockIsland(opened, ISLAND!.id, T0)).toEqual({ ok: false, error: 'alreadyFinished' });
    // The main village is untouched.
    expect(opened.village).toEqual(r.village);
  });
});

describe('travelling', () => {
  it('swaps the village and keeps the main one; resources and the Balai level are shared', () => {
    const r = rich();
    const there = onIsland();
    expect(there.island).toBe(ISLAND!.id);
    expect(there.islands[MAIN!.id]!.buildings).toEqual(r.village.buildings);
    expect(townHallLevel(there)).toBe(townHallLevel(r));
    expect(there.units).toEqual({});
    const back = ok(travelTo(there, MAIN!.id)).state;
    expect(back.island).toBe(MAIN!.id);
    expect(back.village.buildings).toEqual(r.village.buildings);
    expect(Object.keys(back.islands)).toEqual([ISLAND!.id]);
    expect(travelTo(back, MAIN!.id)).toEqual({ ok: false, error: 'alreadyFinished' });
  });

  it('only to opened islands, and not while teams are out', () => {
    const r = rich();
    expect(travelTo(r, ISLAND!.id)).toEqual({ ok: false, error: 'notUnlocked' });
    const opened = ok(unlockIsland(r, ISLAND!.id, T0)).state;
    opened.missions.push({
      id: 't1',
      encounterId: 'e1',
      monsterIds: [],
      arriveAt: T0,
      fight: null,
    });
    expect(travelTo(opened, ISLAND!.id)).toEqual({ ok: false, error: 'teamsAway' });
  });
});

describe('island rules', () => {
  it('has its own building limits; the Balai Utama stays on the main island', () => {
    const s = onIsland();
    for (const [type, max] of Object.entries(ISLAND!.maxCount!)) {
      expect(maxCountFor(s, type)).toBe(max);
    }
    expect(maxCountFor(s, gameData.townHallId)).toBe(0);
    expect(buildBuilding(s, { type: gameData.townHallId, ...freeSpot(s, 4) }, T0)).toEqual({
      ok: false,
      error: 'maxCountReached',
    });
  });

  it('houses there add to the shared population; constructions finish while away', () => {
    const s = onIsland();
    const cap = populationCap(s);
    const house = ok(buildBuilding(s, { type: 'rumah', ...freeSpot(s, 2) }, T0));
    const away = ok(travelTo(house.state, MAIN!.id)).state;
    const done = settleVillage(away, T0 + levelDef('rumah', 1)!.seconds);
    const built = done.islands[ISLAND!.id]!.buildings.find((b) => b.id === house.buildingId)!;
    expect(built.level).toBe(1);
    expect(done.workers.every((w) => w.task.kind === 'idle')).toBe(true);
    expect(populationCap(done)).toBe(cap + levelDef('rumah', 1)!.population!);
  });

  it('wild enemies there are stronger, and raids only come to the main island', () => {
    const s = onIsland();
    s.village.encounters = [];
    const spawned = spawnEncounters(s, T0 + gameData.wilds.encounters.respawnHours * 3600);
    const base = encounterLevelIndex(townHallLevel(s));
    const want = Math.min(
      base + ISLAND!.encounterLevelBonus,
      gameData.wilds.encounters.levels.length - 1,
    );
    expect(spawned.village.encounters.length).toBeGreaterThan(0);
    for (const e of spawned.village.encounters) expect(e.level).toBe(want);
    const raid = advanceRaids(s, gameData.rules.raids.intervalSeconds * 2, T0);
    expect(raid.state).toBe(s);
    expect(raid.events).toEqual([]);
  });
});

describe('save', () => {
  it('keeps every island; old saves are the main island', () => {
    const s = onIsland();
    const back = deserializeState(serializeState(s));
    expect(back.island).toBe(s.island);
    expect(back.islands).toEqual(s.islands);
    const old: Partial<PlayerState> = deepClone(createInitialState(T0, 1));
    delete old.island;
    delete old.islands;
    const v23 = deserializeState(JSON.stringify({ schemaVersion: 23, state: old }));
    expect(v23.island).toBe(MAIN!.id);
    expect(v23.islands).toEqual({});
  });
});
