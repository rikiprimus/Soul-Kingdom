import { describe, expect, it } from 'vitest';
import { attackNode } from './adventure';
import { simulateBattle, type Fighter } from './battle';
import { gameData } from './data';
import {
  healAllGems,
  healAllWithGems,
  healCost,
  healPercentPerMinute,
  healSeconds,
  healWithFood,
  healingTreeLevel,
  settleHealing,
  setWounds,
  unitHp,
  unitMaxHp,
  woundOf,
} from './healing';
import { settleMissions, teamFighters, type WildEncounter } from './missions';
import { startRaidFight } from './raids';
import { deserializeState, serializeState } from './save';
import { attackBase } from './serbu';
import { runAction } from './server/actions';
import { createInitialState, speedUpCost, type PlayerState } from './state';
import { buildingDef, type Building } from './village';

const T0 = 1_000_000;
const MIN = 60;
const { healing } = gameData.rules;
const adult = gameData.rules.growth.stages.at(-1)!.id;
const tree = buildingDef('pohon-jiwa');

/** A new game with an adult dragon m1 and a soldier s1, no wild enemies. */
function setup(): PlayerState {
  const s = createInitialState(T0, 3);
  s.village.encounters = [];
  s.xp = gameData.rules.player.levels.at(-1)!.xp;
  s.monsters.push({ id: 'm1', form: 'naga', element: 'api', stage: adult, food: 0 });
  s.soldiers.push({ id: 's1', kind: gameData.rules.barracks.soldiers[0]!.id, rank: 0 });
  s.resources = { ...s.resources, gold: 1e7, food: 1e7, gems: 10_000 };
  return s;
}

/** Sets wounds (share of max HP lost) directly, healing from T0. */
function hurt(s: PlayerState, wounds: Record<string, number>): PlayerState {
  s.healing = { at: T0, wounds: { ...wounds } };
  return s;
}

function withTree(s: PlayerState, level: number): PlayerState {
  const b: Building = {
    id: 'tree',
    type: 'pohon-jiwa',
    x: 0,
    y: 0,
    level,
    construction: null,
    lastCollectAt: T0,
    crop: null,
  };
  s.village.buildings.push(b);
  return s;
}

const bandits = (count: number): WildEncounter => ({
  id: 'e1',
  level: 0,
  group: 0,
  x: 30,
  y: 30,
  count,
  enemies: [],
});

describe('Pohon Jiwa data', () => {
  it('is a 5-level Militer 2×2 building from Balai 2, one per village', () => {
    expect(tree).toMatchObject({ category: 'militer', feature: 'healing', size: 2 });
    expect(tree.maxCount).toEqual([0, 1, 1, 1, 1, 1, 1, 1]);
    expect(tree.levels.map((l) => l.requiresTownHall)).toEqual([2, 3, 4, 5, 6]);
    expect(tree.levels[0]!.cost).toEqual({ gold: 2000, food: 0, wood: 800, stone: 500 });
  });

  it('heals 2–6 % per minute by level, the base rate without one', () => {
    const s = setup();
    expect(healingTreeLevel(s)).toBe(0);
    expect(healPercentPerMinute(s)).toBe(healing.basePercentPerMinute);
    const rates = [1, 2, 3, 4, 5].map((lv) => healPercentPerMinute(withTree(setup(), lv)));
    expect(rates).toEqual([2, 3, 4, 5, 6]);
    // Still being built (level 0): the base rate.
    expect(healPercentPerMinute(withTree(setup(), 0))).toBe(healing.basePercentPerMinute);
  });
});

describe('wounds after a fight', () => {
  it('a wounded unit starts its next fight with the HP it has', () => {
    const s = setup();
    setWounds(s, { m1: 0.25 }, T0);
    const max = unitMaxHp(s, 'm1')!;
    expect(unitHp(s, 'm1')).toBe(Math.round(max * 0.25));
    const [f] = teamFighters(s, ['m1']);
    expect(f!.startHp).toBeCloseTo(max * 0.25);
    const dummy: Fighter = {
      id: 'x',
      stats: { hp: 1e9, atk: 0, def: 0, spd: 1, range: 1 },
      element: null,
      skill: false,
      fixed: true,
    };
    const battle = simulateBattle([f!], [dummy], 1, gameData, { grid: { columns: 4, rows: 1 } });
    expect(battle.hp.m1).toBeCloseTo(max * 0.25);
  });

  it('only the living keep wounds; the unhurt and the fallen have none', () => {
    const s = setup();
    setWounds(s, { m1: 0.5, s1: 1, ghost: 0.2 }, T0);
    expect(s.healing.wounds).toEqual({ m1: 0.5 });
    setWounds(s, { m1: 0 }, T0);
    expect(s.healing.wounds).toEqual({});
  });

  it('wild fights: survivors come home with the HP they had left', () => {
    // Already hurt, so whoever survives is still hurt (a fight never heals).
    const s = hurt(setup(), { m1: 0.5, s1: 0.5 });
    s.village.encounters = [bandits(2)];
    s.missions.push({
      id: 't1',
      encounterId: 'e1',
      monsterIds: ['m1', 's1'],
      arriveAt: T0,
      fight: null,
    });
    const fought = settleMissions(s, T0);
    const f = fought.missions[0]!.fight!;
    expect(fought.healing.wounds).toEqual({ m1: 0.5, s1: 0.5 });
    const done = settleMissions(fought, f.endsAt);
    const survivors = ['m1', 's1'].filter((x) => !f.dead.includes(x));
    expect(survivors.length).toBeGreaterThan(0);
    for (const id of survivors) {
      expect(f.hpLeft[id]).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(woundOf(done, id)).toBeCloseTo(1 - f.hpLeft[id]!);
    }
    for (const id of f.dead) expect(woundOf(done, id)).toBe(0);
  });

  it('village raids: defenders keep their wounds too', () => {
    const s = hurt(setup(), { m1: 0.5, s1: 0.5 });
    const e = { ...bandits(3), raid: null };
    s.village.encounters = [e];
    const m = startRaidFight(s, e, ['m1', 's1'], [], T0);
    const done = settleMissions(s, m.fight!.endsAt);
    for (const id of ['m1', 's1']) {
      const left = m.fight!.hpLeft[id]!;
      expect(left).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(woundOf(done, id)).toBeCloseTo(left > 0 ? 1 - left : 0);
    }
  });

  it('Serbu and Petualangan: attackers start with their HP and keep what is left', () => {
    const s = hurt(setup(), { m1: 0.5 });
    const max = unitMaxHp(s, 'm1')!;
    const cell = [{ id: 'm1', x: 0, y: 0 }];
    const base = gameData.rules.serbu.bases[0]!;
    const r = attackBase(s, { baseId: base.id, cells: cell }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.result.attackers[0]!.startHp).toBeCloseTo(max / 2);
    const hp = r.result.battle.hp.m1!;
    expect(hp).toBeLessThanOrEqual(max / 2);
    expect(woundOf(r.state, 'm1')).toBeCloseTo(hp > 0 ? 1 - hp / max : 0);

    const region = gameData.adventure.regions[0]!;
    s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = 8;
    const gate = [...gameData.buildingById.values()].find((b) => b.feature === 'adventure')!;
    withTree(s, 1).village.buildings.at(-1)!.type = gate.id;
    const a = attackNode(s, { nodeId: region.nodes[0]!.id, cells: cell }, T0);
    if (!a.ok) throw new Error(a.error);
    expect(a.result.attackers[0]!.startHp).toBeCloseTo(max / 2);
    const left = a.result.battle.hp.m1!;
    expect(woundOf(a.state, 'm1')).toBeCloseTo(left > 0 ? 1 - left / max : 0);
  });
});

describe('healing over time', () => {
  it('heals the rate once per whole minute from the time passed in', () => {
    const s = setup();
    hurt(s, { m1: 0.5 });
    expect(settleHealing(s, T0 + MIN - 1)).toBe(s);
    const one = settleHealing(s, T0 + MIN);
    expect(woundOf(one, 'm1')).toBeCloseTo(0.5 - healing.basePercentPerMinute / 100);
    const ten = settleHealing(s, T0 + 10 * MIN + 30);
    expect(woundOf(ten, 'm1')).toBeCloseTo(0.5 - (10 * healing.basePercentPerMinute) / 100);
    expect(ten.healing.at).toBe(T0 + 10 * MIN);
    // Stepwise and in one go agree.
    expect(settleHealing(settleHealing(s, T0 + 4 * MIN), T0 + 10 * MIN).healing).toEqual(
      settleHealing(s, T0 + 10 * MIN).healing,
    );
    // Fully healed: the wound is gone.
    expect(settleHealing(s, T0 + 1000 * MIN).healing.wounds).toEqual({});
  });

  it('each Pohon Jiwa level heals faster', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const s = withTree(setup(), level);
      hurt(s, { m1: 0.9, s1: 0.5 });
      const rate = tree.levels[level - 1]!.healPercentPerMinute! / 100;
      const later = settleHealing(s, T0 + 5 * MIN);
      expect(woundOf(later, 'm1')).toBeCloseTo(0.9 - 5 * rate);
      expect(woundOf(later, 's1')).toBeCloseTo(0.5 - 5 * rate);
      expect(healSeconds(s, 's1', T0)).toBe(Math.ceil(50 / (rate * 100)) * MIN);
    }
  });

  it('stops while the village is raided and for units out fighting', () => {
    const raided = setup();
    hurt(raided, { m1: 0.5 });
    raided.village.encounters = [
      {
        ...bandits(2),
        raid: { warnLeft: 0, next: null, stepLeft: 0, stepSeconds: 0, breaking: null },
      },
    ];
    const paused = settleHealing(raided, T0 + 10 * MIN);
    expect(woundOf(paused, 'm1')).toBe(0.5);
    expect(paused.healing.at).toBe(T0 + 10 * MIN);

    const away = setup();
    hurt(away, { m1: 0.5, s1: 0.5 });
    away.missions.push({
      id: 't1',
      encounterId: 'e9',
      monsterIds: ['s1'],
      arriveAt: T0 + 1e6,
      fight: null,
    });
    const later = settleHealing(away, T0 + 10 * MIN);
    expect(woundOf(later, 's1')).toBe(0.5);
    expect(woundOf(later, 'm1')).toBeLessThan(0.5);
  });

  it('drops the wounds of units that are gone', () => {
    const s = setup();
    hurt(s, { m1: 0.5 });
    s.monsters = [];
    expect(settleHealing(s, T0 + MIN).healing.wounds).toEqual({});
  });
});

describe('healing at once', () => {
  it('with food and gold, per HP lost, one unit or all', () => {
    const s = setup();
    hurt(s, { m1: 0.5, s1: 0.2 });
    const lost = unitMaxHp(s, 'm1')! * 0.5;
    expect(healCost(s, ['m1'])).toEqual({
      food: Math.ceil(lost * healing.foodPerHp),
      gold: Math.ceil(lost * healing.goldPerHp),
    });
    const one = healWithFood(s, { ids: ['m1'] });
    if (!one.ok) throw new Error(one.error);
    expect(one.state.healing.wounds).toEqual({ s1: 0.2 });
    expect(one.state.resources.food).toBe(s.resources.food - one.food);
    expect(one.state.resources.gold).toBe(s.resources.gold - one.gold);
    const all = healWithFood(s, {});
    if (!all.ok) throw new Error(all.error);
    expect(all.healed.sort()).toEqual(['m1', 's1']);
    expect(all.state.healing.wounds).toEqual({});
  });

  it('works without a Pohon Jiwa, but not when broke, unhurt, away or raided', () => {
    const s = setup();
    expect(healWithFood(s, {})).toEqual({ ok: false, error: 'notWounded' });
    hurt(s, { m1: 0.5 });
    expect(healWithFood({ ...s, resources: { ...s.resources, food: 0 } }, {})).toEqual({
      ok: false,
      error: 'notEnoughFood',
    });
    expect(healWithFood({ ...s, resources: { ...s.resources, gold: 0 } }, {})).toEqual({
      ok: false,
      error: 'notEnoughGold',
    });
    const away = {
      ...s,
      missions: [{ id: 't', encounterId: 'e', monsterIds: ['m1'], arriveAt: T0, fight: null }],
    };
    expect(healWithFood(away, { ids: ['m1'] })).toEqual({ ok: false, error: 'monsterBusy' });
    const raided = {
      ...s,
      village: {
        ...s.village,
        encounters: [
          {
            ...bandits(1),
            raid: { warnLeft: 1, next: null, stepLeft: 0, stepSeconds: 0, breaking: null },
          },
        ],
      },
    };
    expect(healWithFood(raided, {})).toEqual({ ok: false, error: 'underAttack' });
  });

  it('"Sembuhkan semua" with gems costs the speed-up of the longest wait, at the Pohon Jiwa', () => {
    const s = setup();
    hurt(s, { m1: 0.5, s1: 0.1 });
    expect(healAllWithGems(s, T0)).toEqual({ ok: false, error: 'noHealingTree' });
    withTree(s, 2);
    const gems = healAllGems(s, T0);
    expect(gems).toBe(speedUpCost(healSeconds(s, 'm1', T0)));
    expect(gems).toBe(Math.ceil(50 / 3));
    const r = healAllWithGems(s, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.gems).toBe(gems);
    expect(r.state.resources.gems).toBe(s.resources.gems - gems);
    expect(r.state.healing.wounds).toEqual({});
    expect(healAllWithGems({ ...s, resources: { ...s.resources, gems: 0 } }, T0)).toEqual({
      ok: false,
      error: 'notEnoughGems',
    });
  });

  it('runs as server actions', () => {
    const s = withTree(setup(), 1);
    hurt(s, { m1: 0.5 });
    expect(runAction(s, 'healWithFood', { ids: ['m1'] }, T0).ok).toBe(true);
    expect(runAction(s, 'healAllWithGems', {}, T0).ok).toBe(true);
  });
});

describe('saving', () => {
  it('keeps wounds and migrates v30 saves unhurt', () => {
    const s = setup();
    hurt(s, { m1: 0.4 });
    expect(deserializeState(serializeState(s)).healing).toEqual(s.healing);
    const old: Partial<PlayerState> = createInitialState(T0, 1);
    delete old.healing;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 30, state: old }));
    expect(loaded.healing).toEqual({ at: 0, wounds: {} });
  });
});
