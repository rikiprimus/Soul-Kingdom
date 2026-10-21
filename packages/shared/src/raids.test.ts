import { describe, expect, it } from 'vitest';
import { aggroEncounters } from './aggro';
import { deepClone } from './clone';
import { gameData, VILLAGE_RESOURCES } from './data';
import { spawnEncounters, encounterRespawnSeconds } from './encounters';
import { sendTeam, settleMissions, type WildEncounter } from './missions';
import {
  advanceRaids,
  currentRaid,
  raidDefenders,
  raidDps,
  raidRoute,
  wallBreakSeconds,
} from './raids';
import { deserializeState, serializeState } from './save';
import { createInitialState, type PlayerState } from './state';
import { isTileUnlocked, settleVillage, type Building } from './village';

const T0 = 1_000_000;
const { raids } = gameData.rules;
const adult = gameData.rules.growth.stages.at(-1)!.id;
const baby = gameData.rules.growth.stages[0]!.id;
const step = 1 / raids.walkTilesPerSecond;

/** Only a Balai Utama at the raid level (tiles 22–25) on open land 16–31, no wilds, enemies or units. */
function village(): PlayerState {
  const s = createInitialState(T0, 5);
  s.village.obstacles = [];
  s.village.encounters = [];
  s.village.animals = [];
  const hall = s.village.buildings.find((b) => b.type === gameData.townHallId)!;
  hall.level = raids.minTownHall;
  s.village.buildings = [hall];
  s.units = {};
  return s;
}

/** Bandits (Balai 1 row) raiding from (x, y), already done with their warning. */
const raider = (x: number, y: number, count = 2): WildEncounter => ({
  id: 'r1',
  level: 0,
  group: 0,
  x,
  y,
  count,
  enemies: [],
  raid: { warnLeft: 0, next: null, stepLeft: 0, stepSeconds: 0, breaking: null },
});

let nextBuilding = 0;
const building = (type: string, x: number, y: number, level = 1): Building => ({
  id: `b${nextBuilding++}`,
  type,
  x,
  y,
  level,
  construction: null,
  lastCollectAt: T0,
  crop: null,
});

/** A closed ring of wall segments two tiles around the Balai (x, y from 19 to 28). */
function ring(level = 1, gaps: [number, number][] = []): Building[] {
  const out: Building[] = [];
  for (let x = 19; x <= 28; x++) {
    for (let y = 19; y <= 28; y++) {
      const edge = x === 19 || x === 28 || y === 19 || y === 28;
      if (!edge || gaps.some(([gx, gy]) => gx === x && gy === y)) continue;
      out.push(building(raids.wall.building, x, y, level));
    }
  }
  return out;
}

const place = (x: number, y: number) => ({ x, y, path: [], departAt: T0, guard: null });
const isWallAt = (s: PlayerState, t: { x: number; y: number }) =>
  s.village.buildings.some((b) => b.type === raids.wall.building && b.x === t.x && b.y === t.y);

describe('raid schedule (active play only)', () => {
  it('does not start below minTownHall', () => {
    const s = village();
    s.village.buildings[0]!.level = raids.minTownHall - 1;
    expect(advanceRaids(s, raids.intervalSeconds * 3, T0).state).toBe(s);
  });

  it('counts play seconds, then sends one group just outside the village with a warning', () => {
    const s = village();
    const almost = advanceRaids(s, raids.intervalSeconds - 1, T0);
    expect(almost.events).toEqual([]);
    expect(almost.state.village.raidClock).toBe(raids.intervalSeconds - 1);
    expect(currentRaid(almost.state)).toBeUndefined();
    const r = advanceRaids(almost.state, 1, T0);
    const e = currentRaid(r.state)!;
    expect(r.events).toEqual([{ kind: 'warning', encounterId: e.id, x: e.x, y: e.y }]);
    expect(r.state.village.raidClock).toBe(0);
    expect(e.raid!.warnLeft).toBe(raids.warnSeconds);
    // Locked land with open land right next to it.
    expect(isTileUnlocked(r.state.village, e.x, e.y)).toBe(false);
    const borders = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => isTileUnlocked(r.state.village, e.x + dx!, e.y + dy!));
    expect(borders).toBe(true);
    // One raid at a time: the clock waits while it is on.
    const more = advanceRaids(r.state, 1, T0);
    expect(more.state.village.raidClock).toBe(0);
    expect(more.state.village.encounters.filter((x) => x.raid)).toHaveLength(1);
  });

  it('stands still while the game is closed: time on the clock alone does nothing', () => {
    const s = village();
    s.village.encounters = [{ ...raider(14, 23), raid: { ...raider(0, 0).raid!, warnLeft: 30 } }];
    const later = settleVillage(s, T0 + 86_400);
    expect(currentRaid(later)).toEqual(currentRaid(s));
    expect(later.missions).toEqual([]);
  });

  it('waits out the warning on its tile, then walks a tile per step', () => {
    const s = village();
    s.village.encounters = [{ ...raider(14, 23), raid: { ...raider(0, 0).raid!, warnLeft: 10 } }];
    const waiting = advanceRaids(s, 9, T0).state;
    expect(currentRaid(waiting)).toMatchObject({ x: 14, y: 23 });
    const walked = advanceRaids(waiting, 1 + 2 * step, T0).state;
    expect(currentRaid(walked)).toMatchObject({ x: 16, y: 23 });
  });

  it('is not a waiting group: aggro and the daily spawns leave it alone', () => {
    const s = village();
    s.village.encounters = [raider(14, 23)];
    s.monsters.push({ id: 'm1', form: 'kucing', element: 'api', stage: adult, food: 0 });
    s.units = { m1: place(15, 23) };
    expect(aggroEncounters(s, T0)).toBe(s);
    s.village.encountersAt = T0 - encounterRespawnSeconds();
    const spawned = spawnEncounters(s, T0);
    const waiting = spawned.village.encounters.filter((e) => !e.raid);
    expect(waiting.length).toBe(gameData.wilds.encounters.groupsByTownHall[raids.minTownHall - 1]);
  });
});

describe('raid routes and walls', () => {
  it('walks straight to a side of the Balai over open land', () => {
    const s = village();
    const route = raidRoute(s, raider(14, 23));
    expect(route).toHaveLength(7);
    expect(route.at(-1)).toEqual({ x: 21, y: 23 });
  });

  it('breaks through one segment of a closed wall', () => {
    const s = village();
    s.village.buildings.push(...ring());
    const route = raidRoute(s, raider(14, 23));
    expect(route.filter((t) => isWallAt(s, t))).toHaveLength(1);
  });

  it('goes round through a gap when that is quicker than breaking', () => {
    const s = village();
    s.village.buildings.push(...ring(1, [[19, 22]]));
    const route = raidRoute(s, raider(14, 23));
    expect(route.some((t) => isWallAt(s, t))).toBe(false);
    expect(route).toContainEqual({ x: 19, y: 22 });
  });

  it('takes a long way round strong walls rather than breaking them', () => {
    const s = village();
    s.village.buildings.push(...ring(3, [[28, 24]]));
    const route = raidRoute(s, raider(14, 23));
    expect(route.some((t) => isWallAt(s, t))).toBe(false);
    expect(route).toContainEqual({ x: 28, y: 24 });
  });

  it('breaks a segment in HP / damage-per-second, removing it, then steps through', () => {
    const s = village();
    s.village.buildings.push(...ring());
    const e = raider(18, 23);
    s.village.encounters = [e];
    const wall = s.village.buildings.find((b) => b.x === 19 && b.y === 23)!;
    const seconds = wallBreakSeconds(wall, raidDps(e));
    expect(seconds).toBeCloseTo(raids.wall.hpByLevel[0]! / raidDps(e));
    const breaking = advanceRaids(s, seconds - 1, T0);
    expect(currentRaid(breaking.state)!.raid!.breaking).toBe(wall.id);
    expect(isWallAt(breaking.state, wall)).toBe(true);
    const through = advanceRaids(breaking.state, 1 + step, T0);
    expect(through.events).toContainEqual({
      kind: 'wallBroken',
      buildingId: wall.id,
      x: 19,
      y: 23,
    });
    expect(isWallAt(through.state, wall)).toBe(false);
    expect(currentRaid(through.state)).toMatchObject({ x: 19, y: 23 });
  });
});

describe('who defends', () => {
  it('only units within defendTiles and towers that reach join; busy units stay out', () => {
    const s = village();
    s.monsters.push(
      { id: 'near', form: 'kucing', element: 'api', stage: adult, food: 0 },
      { id: 'far', form: 'kucing', element: 'air', stage: adult, food: 0 },
      { id: 'busy', form: 'kucing', element: 'tanah', stage: adult, food: 0 },
    );
    s.units = {
      near: place(16, 23),
      far: place(14, 23 + raids.defendTiles + 2),
      busy: place(15, 23),
    };
    const tower = building(raids.tower.building, 12, 25);
    const farTower = building(raids.tower.building, 40, 40);
    s.village.buildings.push(tower, farTower);
    s.village.encounters = [raider(14, 23), { ...raider(40, 10), id: 'other', raid: null }];
    s.missions.push({
      id: 't0',
      encounterId: 'other',
      monsterIds: ['busy'],
      arriveAt: T0 + 99,
      fight: null,
    });
    const who = raidDefenders(s, raider(14, 23), T0);
    expect(who).toEqual({ unitIds: ['near'], towerIds: [tower.id] });
    const r = advanceRaids(s, 1, T0);
    expect(r.events).toContainEqual(
      expect.objectContaining({ kind: 'defence', defenders: 1, towers: 1 }),
    );
    const m = r.state.missions.find((x) => x.encounterId === 'r1')!;
    expect(m.monsterIds).toEqual(['near']);
    expect(m.fight!.hpLeft).toHaveProperty(`tower:${tower.id}`);
  });

  it('stands still while a team the player sent fights it', () => {
    const s = village();
    s.monsters.push({ id: 'm1', form: 'kucing', element: 'api', stage: adult, food: 0 });
    s.units = { m1: place(30, 30) };
    s.village.encounters = [raider(14, 23)];
    const sent = sendTeam(s, { monsterIds: ['m1'], encounterId: 'r1' }, T0);
    if (!sent.ok) throw new Error(sent.error);
    expect(advanceRaids(sent.state, 30, T0).state).toBe(sent.state);
  });
});

describe('raid outcomes', () => {
  it('steals stealRatio of each resource when nobody stops it at the Balai, then leaves', () => {
    const s = village();
    s.village.encounters = [raider(21, 23)];
    const r = advanceRaids(s, 1, T0);
    const m = r.state.missions[0]!;
    expect(m.fight!.won).toBe(false);
    for (const res of VILLAGE_RESOURCES) {
      expect(m.fight!.stolen![res]).toBe(Math.floor(s.resources[res] * raids.stealRatio));
    }
    const after = settleMissions(r.state, m.fight!.endsAt);
    for (const res of VILLAGE_RESOURCES) {
      expect(after.resources[res]).toBe(s.resources[res] - m.fight!.stolen![res]);
    }
    expect(currentRaid(after)).toBeUndefined();
  });

  it('pays the group reward when the defence wins', () => {
    const s = village();
    s.monsters.push({ id: 'm1', form: 'naga', element: 'api', stage: adult, food: 0 });
    s.units = { m1: place(16, 23) };
    s.village.encounters = [raider(14, 23, 1)];
    const r = advanceRaids(s, 1, T0);
    const m = r.state.missions[0]!;
    expect(m.fight!.won).toBe(true);
    expect(m.fight!.stolen ?? null).toBeNull();
    const after = settleMissions(r.state, m.fight!.endsAt);
    const reward = gameData.wilds.encounters.levels[0]!.groups[0]!.reward;
    expect(after.resources.gold).toBe(s.resources.gold + reward.gold);
    expect(currentRaid(after)).toBeUndefined();
    expect(after.monsters.map((x) => x.id)).toEqual(['m1']);
  });

  it('sends fallen defenders to the Kuburan', () => {
    const s = village();
    s.monsters.push({ id: 'm1', form: 'kucing', element: 'api', stage: baby, food: 0 });
    s.units = { m1: place(16, 23) };
    s.village.encounters = [raider(14, 23, 8)];
    const r = advanceRaids(s, 1, T0);
    const m = r.state.missions[0]!;
    expect(m.fight!.won).toBe(false);
    expect(m.fight!.dead).toEqual(['m1']);
    const after = settleVillage(r.state, m.fight!.endsAt);
    expect(after.monsters).toEqual([]);
    expect(after.graveyard.map((x) => x.id)).toEqual(['m1']);
    expect(after.units.m1).toBeUndefined();
  });

  it('is deterministic for the same state and play time', () => {
    const s = village();
    s.village.buildings.push(...ring(), building(raids.tower.building, 30, 22));
    s.monsters.push({ id: 'm1', form: 'kucing', element: 'api', stage: adult, food: 0 });
    s.soldiers.push({ id: 's1', kind: 'pemanah', rank: 0 });
    s.units = { m1: place(26, 23), s1: place(27, 24) };
    s.village.encounters = [{ ...raider(14, 23, 3), raid: { ...raider(0, 0).raid!, warnLeft: 5 } }];
    const a = advanceRaids(deepClone(s), 120, T0);
    const b = advanceRaids(deepClone(s), 120, T0);
    expect(a).toEqual(b);
    expect(a.state.missions.length).toBe(1);
  });
});

describe('raid saves', () => {
  it('round-trips a raid on its way and a lost defence', () => {
    const s = village();
    s.village.encounters = [raider(21, 23)];
    const fought = advanceRaids(s, 1, T0).state;
    expect(deserializeState(serializeState(fought))).toEqual(fought);
    const marching = village();
    marching.village.encounters = [raider(14, 23)];
    const halfway = advanceRaids(marching, 0.5 * step, T0).state;
    expect(deserializeState(serializeState(halfway))).toEqual(halfway);
  });

  it('migrates v15 saves with the raid clock at zero', () => {
    const s = village();
    const v15 = JSON.parse(serializeState(s)).state;
    delete v15.village.raidClock;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 15, state: v15 }));
    expect(loaded.village.raidClock).toBe(0);
  });
});
