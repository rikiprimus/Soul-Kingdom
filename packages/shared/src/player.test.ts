import { describe, expect, it } from 'vitest';
import { hatchEgg } from './barracks';
import { deepClone } from './clone';
import { gameData } from './data';
import { settleMissions, type MissionFight } from './missions';
import { recordAction, levelProgress, playerLevel } from './player';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import {
  buildBuilding,
  canPlaceBuilding,
  collectAll,
  countBuildings,
  harvestCrop,
  levelDef,
  maxCountFor,
  settleVillage,
} from './village';
import { advanceWilds } from './wilds';

const T0 = 1_000_000;
const { xp, levels } = gameData.rules.player;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

function base(): PlayerState {
  const s = createInitialState(T0, 9);
  s.village.obstacles = [];
  s.village.encounters = [];
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 1_000_000;
  return s;
}

function freeSpot(s: PlayerState, size: number) {
  const { mapSize } = gameData.village.village;
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) if (canPlaceBuilding(s.village, size, x, y)) return { x, y };
  }
  throw new Error('peta penuh');
}

describe('player level', () => {
  it('starts at level 1 and follows the XP table up to the last level', () => {
    expect(createInitialState(T0, 1).xp).toBe(0);
    expect(playerLevel(0)).toBe(1);
    levels.forEach((l, i) => {
      expect(playerLevel(l.xp)).toBe(i + 1);
      if (i > 0) expect(playerLevel(l.xp - 1)).toBe(i);
    });
    expect(playerLevel(levels.at(-1)!.xp * 10)).toBe(levels.length);
  });

  it('reports progress inside the level, and none past the max', () => {
    expect(levelProgress(levels[1]!.xp + 3)).toEqual({
      level: 2,
      current: 3,
      needed: levels[2]!.xp - levels[1]!.xp,
    });
    expect(levelProgress(levels.at(-1)!.xp + 5).needed).toBeNull();
  });

  it('pays every level reached once, even several at a time', () => {
    const s = base();
    const before = deepClone(s.resources);
    s.xp = levels[1]!.xp - 1;
    expect(recordAction(s, 'hatch', 1)).toBe(1);
    expect(s.resources.gold).toBe(before.gold + levels[1]!.reward.gold);
    // Jump from level 2 past level 4 at once.
    const times = Math.ceil((levels[3]!.xp - s.xp) / xp.hatch);
    const gold = s.resources.gold;
    expect(recordAction(s, 'hatch', times)).toBe(playerLevel(s.xp) - 2);
    const paid = levels.slice(2, playerLevel(s.xp)).reduce((sum, l) => sum + l.reward.gold, 0);
    expect(s.resources.gold).toBe(gold + paid);
    // No more reward until the next threshold.
    const resources = deepClone(s.resources);
    s.xp = levels[5]!.xp - xp.collect - 1;
    recordAction(s, 'collect');
    expect(s.resources).toEqual(resources);
  });
});

describe('XP per action', () => {
  it('building and upgrading give build XP', () => {
    const s = base();
    const type = gameData.village.buildings.find(
      (b) =>
        !b.hidden &&
        !b.lineBuild &&
        b.levels[0]!.requiresTownHall <= 1 &&
        countBuildings(s, b.id) < maxCountFor(s, b.id),
    )!;
    const r = ok(buildBuilding(s, { type: type.id, ...freeSpot(s, type.size) }, T0));
    expect(r.state.xp).toBe(xp.build);
    const done = settleVillage(r.state, T0 + levelDef(type.id, 1)!.seconds);
    expect(done.xp).toBe(xp.build);
  });

  it('harvesting a field gives harvest XP; collect-all counts fields and producers', () => {
    const s = base();
    const farm = gameData.village.buildings.find((b) => b.levels[0]!.crop)!;
    s.village.buildings.push({
      id: 'f1',
      type: farm.id,
      x: 0,
      y: 0,
      level: 1,
      construction: null,
      lastCollectAt: T0,
      crop: { endsAt: T0, food: 10 },
    });
    expect(ok(harvestCrop(s, 'f1', T0)).state.xp).toBe(xp.harvest);
    expect(ok(collectAll(s, T0)).state.xp).toBe(xp.harvest);
  });

  it('gathering a wild node gives gather XP', () => {
    const s = base();
    const def = gameData.obstacleById.get('pohon')!;
    s.village.obstacles = [{ id: 'n1', type: 'pohon', x: 10, y: 10, work: 0 }];
    s.workers[0]!.task = { kind: 'gathering', targetId: 'n1' };
    const r = advanceWilds(s, def.work.workSeconds, T0);
    expect(r.gathered).toHaveLength(1);
    expect(r.state.xp).toBe(xp.gather);
  });

  it('beating enemies gives defeat XP; losing gives none', () => {
    const s = base();
    s.village.encounters = [{ id: 'e1', level: 0, group: 0, x: 1, y: 1, count: 1, enemies: [] }];
    const fight = (won: boolean): MissionFight => ({
      startsAt: T0,
      endsAt: T0,
      won,
      dead: [],
      hpLeft: {},
      enemyHpLeft: [0],
      reward: { gold: 0, food: 0, wood: 0, stone: 0 },
      soulCrystal: 0,
    });
    const mission = { id: 't1', encounterId: 'e1', monsterIds: [], arriveAt: T0 };
    s.missions = [{ ...mission, fight: fight(true) }];
    expect(settleMissions(s, T0).xp).toBe(xp.defeatEnemy);
    s.missions = [{ ...mission, fight: fight(false) }];
    expect(settleMissions(s, T0).xp).toBe(0);
  });

  it('hatching an egg gives hatch XP', () => {
    const s = base();
    s.village.buildings.push({
      id: 'nest',
      type: 'sarang-telur',
      x: 0,
      y: 0,
      level: 1,
      construction: null,
      lastCollectAt: T0,
      crop: null,
    });
    const egg = s.eggs[0]!;
    expect(ok(hatchEgg(s, egg.id, egg.readyAt)).state.xp).toBe(xp.hatch);
  });
});

describe('save', () => {
  it('keeps XP and gives old saves level 1', () => {
    const s = base();
    s.xp = 123;
    expect(deserializeState(serializeState(s)).xp).toBe(123);
    const old: Partial<PlayerState> = deepClone(s);
    delete old.xp;
    const v18 = JSON.stringify({ schemaVersion: 18, state: old });
    expect(deserializeState(v18).xp).toBe(0);
  });
});
