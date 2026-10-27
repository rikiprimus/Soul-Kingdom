import { describe, expect, it } from 'vitest';
import { simulateBattle, type Fighter } from './battle';
import { gameData } from './data';
import type { WildEncounter } from './missions';
import {
  advanceRaids,
  currentRaid,
  raidDefenders,
  raidDps,
  raidRoute,
  towerFighter,
  towerReach,
  wallBreakSeconds,
} from './raids';
import { deserializeState, serializeState } from './save';
import { runAction } from './server/actions';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { rotateBuilding } from './storage';
import { isGateOpen, moveUnits, toggleGate } from './units';
import type { Building } from './village';

// Tugas 1C.6: Menara Sihir (area damage) and Gerbang.
const T0 = 1_000_000;
const { raids } = gameData.rules;
const { magicTower, gate } = raids;
const adult = gameData.rules.growth.stages.at(-1)!.id;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** Only a Balai Utama at the raid level (tiles 22–25) on open land, no wilds or units. */
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

let nextId = 0;
const building = (type: string, x: number, y: number, level = 1): Building => ({
  id: `d${nextId++}`,
  type,
  x,
  y,
  level,
  construction: null,
  lastCollectAt: T0,
  crop: null,
});

const raider = (x: number, y: number): WildEncounter => ({
  id: 'r1',
  level: 0,
  group: 0,
  x,
  y,
  count: 2,
  enemies: [],
  raid: { warnLeft: 0, next: null, stepLeft: 0, stepSeconds: 0, breaking: null },
});

/** A wall line x = 19 (y 15–31, or the whole map when `full`) with a gate at (19, 23). */
function wallWithGate(s: PlayerState, gateLevel = 1, full = false) {
  const last = full ? gameData.village.village.mapSize - 1 : 31;
  for (let y = full ? 0 : 15; y <= last; y++) {
    if (y !== 23) s.village.buildings.push(building(raids.wall.building, 19, y));
  }
  const g = building(gate.building, 19, 23, gateLevel);
  s.village.buildings.push(g);
  return g;
}

const fighter = (id: string, extra: Partial<Fighter> = {}): Fighter => ({
  id,
  stats: { hp: 1000, atk: 50, def: 0, spd: 10, range: 1 },
  element: null,
  skill: false,
  ...extra,
});

describe('area damage in battle', () => {
  it('a splash hit also strikes enemies near the target, for its ratio of the damage', () => {
    const splash = { radius: 1.5, ratio: 0.5 };
    const tower = fighter('t', { fixed: true, splash, stats: { ...fighter('t').stats, range: 9 } });
    const cells = { t: { x: 5, y: 2 }, a: { x: 0, y: 2 }, b: { x: 0, y: 3 }, c: { x: 0, y: 0 } };
    const r = simulateBattle([fighter('a'), fighter('b'), fighter('c')], [tower], 1, gameData, {
      cells,
    });
    const first = r.events.find((e) => e.kind === 'attack' && e.id === 't')!;
    const sameTick = r.events.filter(
      (e) => e.kind === 'attack' && e.id === 't' && e.tick === first.tick,
    );
    expect(sameTick.length).toBeGreaterThan(1);
    const [main, ...others] = sameTick as Extract<(typeof r.events)[number], { damage: number }>[];
    for (const o of others) expect(o.damage).toBe(Math.round(main!.damage * splash.ratio));
  });

  it('without splash a hit strikes only its target', () => {
    const tower = fighter('t', { fixed: true, stats: { ...fighter('t').stats, range: 9 } });
    const cells = { t: { x: 5, y: 2 }, a: { x: 0, y: 2 }, b: { x: 0, y: 3 } };
    const r = simulateBattle([fighter('a'), fighter('b')], [tower], 1, gameData, { cells });
    const first = r.events.find((e) => e.kind === 'attack' && e.id === 't')!;
    expect(
      r.events.filter((e) => e.kind === 'attack' && e.id === 't' && e.tick === first.tick),
    ).toHaveLength(1);
  });
});

describe('Menara Sihir', () => {
  it('is a short-range, slow, strong tower with area damage', () => {
    const def = gameData.buildingById.get(magicTower.building)!;
    expect(def.levels[0]!.requiresTownHall).toBe(3);
    expect(magicTower.levels).toHaveLength(def.levels.length);
    const b = building(magicTower.building, 0, 0, 1);
    const f = towerFighter(b);
    expect(f.fixed).toBe(true);
    expect(f.splash).toEqual({
      radius: magicTower.splash.radiusTiles,
      ratio: magicTower.splash.ratio,
    });
    expect(towerReach(b)).toBe(Math.max(magicTower.reachTiles, magicTower.levels[0]!.range));
    const jaga = raids.tower.levels[0]!;
    expect(magicTower.levels[0]!.spd).toBeLessThan(jaga.spd);
    expect(magicTower.levels[0]!.atk).toBeGreaterThan(jaga.atk);
    expect(towerReach(b)).toBeLessThan(raids.tower.reachTiles);
    for (let i = 1; i < magicTower.levels.length; i++) {
      expect(magicTower.levels[i]!.atk).toBeGreaterThan(magicTower.levels[i - 1]!.atk);
    }
    // A Menara Jaga does not splash.
    expect(towerFighter(building(raids.tower.building, 0, 0)).splash).toBeUndefined();
  });

  it('joins a raid defence when the raiders come within its reach', () => {
    const s = village();
    const near = building(magicTower.building, 15, 21);
    const far = building(magicTower.building, 40, 40);
    s.village.buildings.push(near, far);
    s.village.encounters = [raider(14, 23)];
    expect(raidDefenders(s, raider(14, 23), T0).towerIds).toEqual([near.id]);
    const r = advanceRaids(s, 1, T0);
    const m = r.state.missions.find((x) => x.encounterId === 'r1')!;
    expect(m.fight!.hpLeft).toHaveProperty(`tower:${near.id}`);
  });
});

describe('Gerbang', () => {
  it('raiders break a gate like a wall, with the gate HP of its level', () => {
    const s = village();
    const g = wallWithGate(s, 2, true);
    // Walls sturdier than the gate, so breaking the gate is the quickest way in.
    for (const b of s.village.buildings) if (b.type === raids.wall.building) b.level = 4;
    const e = raider(14, 23);
    expect(raidRoute(s, e)).toContainEqual({ x: 19, y: 23 });
    expect(wallBreakSeconds(g, raidDps(e))).toBeCloseTo(gate.hpByLevel[1]! / raidDps(e));
    // During a raid the gate is shut, even if the player left it open.
    s.village.encounters = [raider(18, 23)];
    expect(isGateOpen(s, g)).toBe(false);
    const r = advanceRaids(s, wallBreakSeconds(g, raidDps(e)) + 2, T0);
    expect(r.events).toContainEqual(
      expect.objectContaining({ kind: 'wallBroken', buildingId: g.id }),
    );
    expect(r.state.village.buildings.some((b) => b.id === g.id)).toBe(false);
  });

  it('every gate level is sturdier than the wall of the same level', () => {
    for (let i = 0; i < raids.wall.hpByLevel.length; i++) {
      expect(gate.hpByLevel[i]).toBeGreaterThan(raids.wall.hpByLevel[i]!);
    }
  });

  it('our units walk through an open gate, not a shut one, and not during a raid', () => {
    const s = village();
    const g = wallWithGate(s);
    s.monsters.push({ id: 'm', form: 'kucing', element: 'api', stage: adult, food: 0 });
    s.units = { m: { x: 17, y: 23, path: [], departAt: T0, guard: null } };
    expect(isGateOpen(s, g)).toBe(true);
    const through = ok(moveUnits(s, { ids: ['m'], x: 21, y: 23 }, T0)).state;
    expect(through.units.m!.path).toContainEqual({ x: 19, y: 23 });
    expect(through.units.m!.path.length).toBe(4);

    const shut = ok(toggleGate(s, g.id)).state;
    expect(
      isGateOpen(
        shut,
        shut.village.buildings.find((b) => b.id === g.id)!,
      ),
    ).toBe(false);
    const around = ok(moveUnits(shut, { ids: ['m'], x: 21, y: 23 }, T0)).state;
    expect(around.units.m!.path).not.toContainEqual({ x: 19, y: 23 });
    expect(
      ok(toggleGate(shut, g.id)).state.village.buildings.find((b) => b.id === g.id)!.closed,
    ).toBeUndefined();

    const raided = { ...s, village: { ...s.village, encounters: [raider(5, 5)] } };
    expect(isGateOpen(raided, g)).toBe(false);
    expect(currentRaid(raided)).toBeDefined();
  });

  it('only gates can be toggled; gates cannot be rotated; it is a server action', () => {
    const s = village();
    const g = wallWithGate(s);
    const wall = s.village.buildings.find((b) => b.type === raids.wall.building)!;
    expect(toggleGate(s, wall.id)).toEqual({ ok: false, error: 'notGate' });
    expect(toggleGate(s, 'nope')).toEqual({ ok: false, error: 'buildingNotFound' });
    expect(rotateBuilding(s, g.id)).toEqual({ ok: false, error: 'cannotRotate' });
    const r = runAction(s, 'toggleGate', { id: g.id }, T0);
    expect(r.ok && r.state.village.buildings.find((b) => b.id === g.id)!.closed).toBe(true);
  });

  it('keeps a shut gate across save and load', () => {
    const s = village();
    const g = wallWithGate(s);
    const shut = ok(toggleGate(s, g.id)).state;
    const loaded = deserializeState(serializeState(shut));
    expect(loaded.village.buildings.find((b) => b.id === g.id)!.closed).toBe(true);
  });
});
