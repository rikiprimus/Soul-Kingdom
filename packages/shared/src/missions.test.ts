import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData, type ElementId } from './data';
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
  encounterFighters,
  encounterPower,
  monsterPower,
  reviveCost,
  reviveMonster,
  settleMissions,
  teamPower,
  previewWinChance,
  type WildEncounter,
} from './missions';
import { soldierPower } from './barracks';
import type { Monster } from './monster';
import { createRng } from './rng';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { populationFree, releaseMonster } from './workers';

const T0 = 1_000_000;
const { growth } = gameData.rules;
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
    // Balai 1: packs only (bandits or goblins, Tugas 1C.9).
    for (const e of s.village.encounters) expect(encounterGroup(e).kind).not.toBe('monster');
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
        if (def.kind !== 'monster') {
          expect(e.enemies).toEqual([]);
        } else {
          expect(e.enemies).toHaveLength(e.count);
          for (const x of e.enemies) {
            expect(gameData.formById.get(x.form!)!.tier).toBe(def.formTier);
            expect(x.stage).toBe(def.stage);
          }
        }
      }
      expect(seen.size).toBe(row.groups.length);
    });
    // Balai 1: bandits and goblins only (Tugas 1C.9).
    expect(encounters.levels[0]!.groups.every((g) => g.kind !== 'monster')).toBe(true);
    expect(encounters.levels[0]!.groups.some((g) => g.kind === 'goblin')).toBe(true);
  });
});

const units = (ms: Monster[]) =>
  ms.map((m) => ({ power: monsterPower(m), element: (m.element ?? null) as ElementId | null }));

/** The team reaches its enemy: the fight is simulated now. */
const arrive = (s: PlayerState) => settleMissions(s, s.missions[0]!.arriveAt);

/** The enemy "e1" spotted these units and closes in: a fight mission reaching them at T0 + 2. */
function engaged(s: PlayerState, ids: string[]): PlayerState {
  const next = deepClone(s);
  next.missions.push({
    id: 't0',
    encounterId: 'e1',
    monsterIds: ids,
    arriveAt: T0 + 2,
    fight: null,
  });
  return next;
}

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
    // A close fight (about even odds), so both outcomes show up often.
    const base = setup(8);
    const team = ['m1', 'm2'];
    const e = base.village.encounters[0]!;
    expect(previewWinChance(base, [], e)).toBe(0);
    expect(previewWinChance(base, ['m1', 'm2', 'm3'], e)).toBeGreaterThanOrEqual(
      previewWinChance(base, ['m1'], e),
    );
    const chance = previewWinChance(base, team, e, 2000);
    expect(chance).toBeGreaterThan(0.05);
    expect(chance).toBeLessThan(0.95);
    let s = {
      ...base,
      village: { ...base.village, obstacles: [], buildings: [] },
    } as PlayerState;
    const reward = encounters.levels[0]!.groups[0]!.reward;
    let wins = 0;
    let gold = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const arrived = arrive(engaged(s, team));
      const f = arrived.missions[0]!.fight!;
      if (f.won) {
        wins++;
        expect(f.enemyHpLeft.every((hp) => hp === 0)).toBe(true);
      } else {
        // No time limit: a lost fight means the whole team has fallen.
        expect(f.dead).toEqual(team);
      }
      for (const id of team) expect(f.hpLeft[id] === 0).toBe(f.dead.includes(id));
      gold += f.reward.gold;
      s = { ...s, rngState: arrived.rngState };
    }
    expect(Math.abs(wins / n - chance)).toBeLessThan(0.04);
    expect(Math.abs(gold / n - chance * reward.gold)).toBeLessThan(0.04 * reward.gold + 1);
  });
});

describe('fights with wild enemies', () => {
  it('starts when the enemy reaches the team, has no time limit, then pays a win', () => {
    const s = setup(1);
    s.monsters.push(adult('m4', 'kelinci', 'angin'), adult('m5', 'tupai', 'cahaya'));
    const team = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const sent = engaged(s, team);
    // Nothing is decided while the enemy is still closing in.
    expect(settleMissions(sent, T0 + 1).missions[0]!.fight).toBeNull();
    expect(releaseMonster(sent, 'm1')).toEqual({ ok: false, error: 'monsterBusy' });
    sent.village.encounters.push({ ...bandits(1), id: 'e2' });
    // Find a seed that wins so the reward can be checked.
    let arrived = arrive(sent);
    while (!arrived.missions[0]!.fight!.won) {
      sent.rngState = arrived.rngState;
      arrived = arrive(sent);
    }
    const f = arrived.missions[0]!.fight!;
    expect(f.startsAt).toBe(T0 + 2);
    expect(f.endsAt).toBeGreaterThan(f.startsAt);
    expect(settleMissions(arrived, f.endsAt - 1).missions).toHaveLength(1);
    const done = settleMissions(arrived, f.endsAt);
    expect(done.missions).toHaveLength(0);
    expect(done.village.encounters.map((e) => e.id)).toEqual(['e2']);
    expect(done.resources.gold).toBe(
      sent.resources.gold + encounters.levels[0]!.groups[0]!.reward.gold,
    );
    expect(done.monsters).toHaveLength(5 - f.dead.length);
  });

  it('settles a long absence in one go: contact, fight and payout', () => {
    const later = settleMissions(engaged(setup(1), ['m1', 'm2', 'm3']), T0 + 100_000);
    expect(later.missions).toHaveLength(0);
  });

  it('brings the team home without a fight when the enemy is gone', () => {
    const sent = engaged(setup(1), ['m1']);
    sent.village.encounters = [];
    const back = settleMissions(sent, T0 + 2);
    expect(back.missions).toEqual([]);
    expect(back.monsters.map((m) => m.id)).toContain('m1');
  });

  it('sends the fallen of a lost fight to the graveyard and keeps the enemy', () => {
    const sent = engaged(setup(12), ['m1']);
    let arrived = arrive(sent);
    while (arrived.missions[0]!.fight!.won) {
      sent.rngState = arrived.rngState;
      arrived = arrive(sent);
    }
    const f = arrived.missions[0]!.fight!;
    expect(f.dead).toEqual(['m1']);
    const done = settleMissions(arrived, f.endsAt);
    expect(done.monsters.map((m) => m.id)).toEqual(['m2', 'm3']);
    expect(done.graveyard.map((m) => m.id)).toEqual(['m1']);
    expect(done.village.encounters.map((e) => e.id)).toEqual(['e1']);
    expect(done.resources.gold).toBe(sent.resources.gold);
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

describe('goblins (Tugas 1C.9)', () => {
  it('are a quick, frail pack on the Balai 1–2 rows, scaled like bandits', () => {
    const { goblin, bandit } = gameData.rules.battle;
    expect(goblin.stats.spd).toBeGreaterThan(bandit.stats.spd);
    expect(goblin.stats.hp).toBeLessThan(bandit.stats.hp);
    const rows = encounters.levels.filter((l) => l.groups.some((g) => g.kind === 'goblin'));
    expect(rows.map((l) => l.townHall)).toEqual([1, 2]);
    const group = rows[0]!.groups.findIndex((g) => g.kind === 'goblin');
    const def = rows[0]!.groups[group]!;
    const e = { id: 'g', level: 0, group, x: 0, y: 0, count: 3, enemies: [] };
    const fighters = encounterFighters(e);
    expect(fighters).toHaveLength(3);
    const k = def.banditPower! * goblin.powerScale;
    expect(fighters[0]!.stats).toEqual({
      ...goblin.stats,
      hp: goblin.stats.hp * k,
      atk: goblin.stats.atk * k,
      def: goblin.stats.def * k,
    });
    expect(encounterPower(e, [])).toBeCloseTo(3 * def.banditPower!);
  });
});
