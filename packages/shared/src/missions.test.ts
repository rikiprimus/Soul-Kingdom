import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { elementAdvantage } from './elements';
import {
  encounterLevelIndex,
  encounterRespawnSeconds,
  encounterTarget,
  rollEncounter,
  spawnEncounters,
} from './encounters';
import {
  encounterGroup,
  encounterPower,
  monsterPower,
  reviveCost,
  reviveMonster,
  sendTeam,
  teamPower,
  previewWinChance,
  type WildEncounter,
} from './missions';
import { soldierPower } from './barracks';
import type { Monster } from './monster';
import { createRng } from './rng';
import { deserializeState, serializeState } from './save';
import { createInitialState, startMix, type ActionResult, type PlayerState } from './state';
import { settleVillage } from './village';
import { populationFree, releaseMonster } from './workers';

const T0 = 1_000_000;
const { skirmish, growth } = gameData.rules;
const { encounters, graveyard } = gameData.wilds;
const ADULT = growth.stages[growth.stages.length - 1]!.id;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

const adult = (id: string, form: string, element: string): Monster => ({
  id,
  form,
  element,
  stage: ADULT,
  food: 0,
});

const bandits = (count: number): WildEncounter => ({
  id: 'e1',
  level: 0,
  group: 0,
  x: 1,
  y: 1,
  count,
  enemies: [],
});

/** A village with Balai 5, three adults (m1–m3) and one bandit group "e1". */
function setup(count = 2): PlayerState {
  const s = createInitialState(T0, 61);
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = 5;
  s.monsters = [
    adult('m1', 'kucing', 'api'),
    adult('m2', 'anjing', 'air'),
    adult('m3', 'landak', 'tanah'),
  ];
  s.village.encounters = [bandits(count)];
  return s;
}

describe('encounter spawns', () => {
  it('start with the groups for the Balai level and come back a day after the last spawn', () => {
    const s = createInitialState(T0, 7);
    expect(s.village.encounters).toHaveLength(encounterTarget(1));
    for (const e of s.village.encounters) expect(encounterGroup(e).kind).toBe('bandit');
    const day = encounterRespawnSeconds();
    const fewer = deepClone(s);
    fewer.village.encounters = fewer.village.encounters.slice(1);
    expect(spawnEncounters(fewer, T0 + day - 1)).toBe(fewer);
    const later = spawnEncounters(fewer, T0 + day + 10);
    expect(later.village.encounters).toHaveLength(encounterTarget(1));
    expect(later.village.encountersAt).toBe(T0 + day + 10);
    expect(spawnEncounters(deepClone(fewer), T0 + day + 10)).toEqual(later);
  });

  it('grow with the Balai: bandits, then small monsters, then many small or one big', () => {
    expect(encounterLevelIndex(1)).toBe(0);
    for (let hall = 1; hall <= gameData.maxTownHallLevel; hall++) {
      const row = encounters.levels[encounterLevelIndex(hall)]!;
      expect(row.townHall).toBeLessThanOrEqual(hall);
      expect(encounterTarget(hall)).toBe(encounters.groupsByTownHall[hall - 1]);
    }
    const rng = createRng(5);
    encounters.levels.forEach((row, level) => {
      const seen = new Set<number>();
      for (let i = 0; i < 400; i++) {
        const e = rollEncounter(level, rng);
        const def = row.groups[e.group]!;
        seen.add(e.group);
        expect(e.count).toBeGreaterThanOrEqual(def.count[0]);
        expect(e.count).toBeLessThanOrEqual(def.count[1]);
        if (def.kind === 'bandit') {
          expect(e.enemies).toEqual([]);
        } else {
          expect(e.enemies).toHaveLength(e.count);
          for (const x of e.enemies) {
            expect(gameData.formById.get(x.form)!.tier).toBe(def.formTier);
            expect(x.stage).toBe(def.stage);
          }
        }
      }
      expect(seen.size).toBe(row.groups.length);
    });
    expect(encounters.levels[0]!.groups.every((g) => g.kind === 'bandit')).toBe(true);
  });
});

const units = (ms: Monster[]) => ms.map((m) => ({ power: monsterPower(m), element: m.element }));

describe('power and odds', () => {
  it('rises with team size, growth and element edge', () => {
    const one = [adult('a', 'kucing', 'api')];
    const e = bandits(3);
    const baby = [{ ...one[0]!, stage: growth.stages[0]!.id }];
    expect(monsterPower(baby[0]!)).toBeLessThan(monsterPower(one[0]!));
    const strong = {
      ...e,
      level: 1,
      group: 1,
      count: 1,
      enemies: [{ form: 'kucing', element: 'angin', stage: ADULT }],
    };
    expect(teamPower(units(one), strong)).toBeCloseTo(
      monsterPower(one[0]!) * elementAdvantage('api', 'angin'),
    );
    expect(encounterPower(bandits(4), units(one))).toBeCloseTo(
      4 * encounters.levels[0]!.groups[0]!.banditPower!,
    );
  });

  it('counts soldiers by power points with no element edge either way', () => {
    const strong = {
      ...bandits(1),
      level: 1,
      group: 1,
      count: 1,
      enemies: [{ form: 'kucing', element: 'angin', stage: ADULT }],
    };
    const soldier = { power: soldierPower({ kind: 'prajurit', rank: 1 }), element: null };
    expect(teamPower([soldier], strong)).toBeCloseTo(soldier.power);
    expect(encounterPower(strong, [soldier])).toBeCloseTo(monsterPower(strong.enemies[0]!));
  });

  it('wins and pays at the simulated chance, and the fallen have no HP (Monte Carlo)', () => {
    const base = setup(4);
    const team = ['m1', 'm2'];
    const e = base.village.encounters[0]!;
    expect(previewWinChance(base, [], e)).toBe(0);
    expect(previewWinChance(base, ['m1', 'm2', 'm3'], e)).toBeGreaterThanOrEqual(
      previewWinChance(base, ['m1'], e),
    );
    const chance = previewWinChance(base, team, e, 2000);
    expect(chance).toBeGreaterThan(0.05);
    expect(chance).toBeLessThan(0.95);
    // A bare state keeps the sends fast; sendTeam only reads these parts.
    let s = {
      ...base,
      village: { ...base.village, obstacles: [], buildings: [] },
    } as PlayerState;
    const reward = encounters.levels[0]!.groups[0]!.reward;
    let wins = 0;
    let gold = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const r = ok(sendTeam(s, { monsterIds: team, encounterId: 'e1' }, T0));
      const m = r.state.missions[0]!;
      if (m.won) {
        wins++;
        expect(m.enemyHpLeft.every((hp) => hp === 0)).toBe(true);
      }
      for (const id of team) expect(m.hpLeft[id] === 0).toBe(m.dead.includes(id));
      gold += m.reward.gold;
      s = { ...s, rngState: r.state.rngState };
    }
    expect(Math.abs(wins / n - chance)).toBeLessThan(0.04);
    expect(Math.abs(gold / n - chance * reward.gold)).toBeLessThan(0.04 * reward.gold + 1);
  });
});

describe('sending a team', () => {
  it('locks the members until the mission ends, then pays a win', () => {
    const s = setup(1);
    s.monsters.push(adult('m4', 'kelinci', 'angin'), adult('m5', 'tupai', 'cahaya'));
    // Find a seed that wins so the reward can be checked.
    let r = ok(sendTeam(s, { monsterIds: ['m1', 'm2', 'm3', 'm4', 'm5'], encounterId: 'e1' }, T0));
    while (!r.state.missions[0]!.won) {
      s.rngState = r.state.rngState;
      r = ok(sendTeam(s, { monsterIds: ['m1', 'm2', 'm3', 'm4', 'm5'], encounterId: 'e1' }, T0));
    }
    const sent = r.state;
    expect(sendTeam(sent, { monsterIds: ['m1'], encounterId: 'e1' }, T0)).toEqual({
      ok: false,
      error: 'encounterBusy',
    });
    sent.village.encounters.push({ ...bandits(1), id: 'e2' });
    expect(sendTeam(sent, { monsterIds: ['m1'], encounterId: 'e2' }, T0)).toEqual({
      ok: false,
      error: 'monsterBusy',
    });
    expect(releaseMonster(sent, 'm1')).toEqual({ ok: false, error: 'monsterBusy' });
    const half = settleVillage(sent, T0 + skirmish.missionSeconds - 1);
    expect(half.missions).toHaveLength(1);
    const done = settleVillage(sent, T0 + skirmish.missionSeconds);
    expect(done.missions).toHaveLength(0);
    expect(done.village.encounters.map((e) => e.id)).toEqual(['e2']);
    expect(done.resources.gold).toBe(
      sent.resources.gold + encounters.levels[0]!.groups[0]!.reward.gold,
    );
    expect(done.monsters).toHaveLength(5);
  });

  it('refuses empty, oversized or duplicate teams, unknown targets and mixing parents', () => {
    const s = setup();
    expect(sendTeam(s, { monsterIds: [], encounterId: 'e1' }, T0)).toEqual({
      ok: false,
      error: 'invalidAmount',
    });
    expect(sendTeam(s, { monsterIds: ['m1', 'm1'], encounterId: 'e1' }, T0)).toEqual({
      ok: false,
      error: 'invalidAmount',
    });
    const many = Array.from({ length: skirmish.maxTeam + 1 }, (_, i) => `x${i}`);
    expect(sendTeam(s, { monsterIds: many, encounterId: 'e1' }, T0)).toEqual({
      ok: false,
      error: 'invalidAmount',
    });
    expect(sendTeam(s, { monsterIds: ['m1'], encounterId: 'nope' }, T0)).toEqual({
      ok: false,
      error: 'encounterNotFound',
    });
    expect(sendTeam(s, { monsterIds: ['zz'], encounterId: 'e1' }, T0)).toEqual({
      ok: false,
      error: 'monsterNotFound',
    });
    const mixing = ok(startMix(s, { parentAId: 'm1', parentBId: 'm2', skipUnlock: true }, T0));
    expect(sendTeam(mixing.state, { monsterIds: ['m3'], encounterId: 'e1' }, T0).ok).toBe(true);
    s.mixQueue = mixing.state.mixQueue;
    s.mixQueue[0]!.consumedParentIds = [];
    expect(sendTeam(s, { monsterIds: ['m1'], encounterId: 'e1' }, T0)).toEqual({
      ok: false,
      error: 'monsterBusy',
    });
  });

  it('sends the fallen of a lost fight to the graveyard and keeps the enemy', () => {
    const s = setup(12);
    let r = ok(sendTeam(s, { monsterIds: ['m1'], encounterId: 'e1' }, T0));
    while (r.state.missions[0]!.won) {
      s.rngState = r.state.rngState;
      r = ok(sendTeam(s, { monsterIds: ['m1'], encounterId: 'e1' }, T0));
    }
    expect(r.state.missions[0]!.dead).toEqual(['m1']);
    const done = settleVillage(r.state, T0 + skirmish.missionSeconds);
    expect(done.monsters.map((m) => m.id)).toEqual(['m2', 'm3']);
    expect(done.graveyard.map((m) => m.id)).toEqual(['m1']);
    expect(done.village.encounters.map((e) => e.id)).toEqual(['e1']);
    expect(done.resources.gold).toBe(r.state.resources.gold);
  });
});

describe('the Kuburan', () => {
  function withFallen() {
    const s = setup();
    s.graveyard = [adult('dead', 'naga', 'api')];
    s.resources.gold = 1_000_000;
    s.resources.food = 1_000_000;
    s.resources.gems = 10_000;
    s.village.buildings.push({
      id: 'grave',
      type: 'kuburan',
      x: 0,
      y: 0,
      level: 1,
      construction: null,
      lastCollectAt: T0,
      crop: null,
    });
    return s;
  }

  it('revives with gold and food, or with gems, priced by power points', () => {
    const s = withFallen();
    const cost = reviveCost(s.graveyard[0]!);
    const pp = gameData.rules.battle.powerPoints[String(gameData.formById.get('naga')!.tier)]!;
    expect(cost).toEqual({
      gold: graveyard.goldPerPowerPoint * pp,
      food: graveyard.foodPerPowerPoint * pp,
      gems: graveyard.gemsPerPowerPoint * pp,
    });
    const paid = ok(reviveMonster(s, 'dead', 'resources'));
    expect(paid.state.monsters.at(-1)!.id).toBe('dead');
    expect(paid.state.graveyard).toEqual([]);
    expect(paid.state.resources.gold).toBe(s.resources.gold - cost.gold);
    expect(paid.state.resources.food).toBe(s.resources.food - cost.food);
    const gems = ok(reviveMonster(s, 'dead', 'gems'));
    expect(gems.state.resources.gems).toBe(s.resources.gems - cost.gems);
    expect(gems.state.resources.gold).toBe(s.resources.gold);
  });

  it('needs a Kuburan, room in the village and enough to pay', () => {
    const s = withFallen();
    const noGrave = deepClone(s);
    noGrave.village.buildings = noGrave.village.buildings.filter((b) => b.id !== 'grave');
    expect(reviveMonster(noGrave, 'dead', 'gems')).toEqual({ ok: false, error: 'noGraveyard' });
    expect(reviveMonster(s, 'nope', 'gems')).toEqual({ ok: false, error: 'monsterNotFound' });
    const poor = deepClone(s);
    poor.resources.gems = 0;
    poor.resources.gold = 0;
    expect(reviveMonster(poor, 'dead', 'gems')).toEqual({ ok: false, error: 'notEnoughGems' });
    expect(reviveMonster(poor, 'dead', 'resources')).toEqual({ ok: false, error: 'notEnoughGold' });
    const full = deepClone(s);
    while (populationFree(full) > 0)
      full.monsters.push(adult(`f${full.monsters.length}`, 'kucing', 'api'));
    expect(reviveMonster(full, 'dead', 'gems')).toEqual({ ok: false, error: 'populationFull' });
  });
});

describe('save migration v9', () => {
  it('adds missions, the graveyard and wild enemies', () => {
    const s = createInitialState(T0, 4);
    const v9 = deepClone(s) as unknown as Record<string, unknown> & {
      village: Record<string, unknown>;
    };
    delete v9.missions;
    delete v9.graveyard;
    delete v9.village.encounters;
    delete v9.village.encountersAt;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 9, state: v9 }));
    expect(loaded.missions).toEqual([]);
    expect(loaded.graveyard).toEqual([]);
    expect(spawnEncounters(loaded, s.village.animalsAt).village.encounters).toHaveLength(
      encounterTarget(1),
    );
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});
