import { describe, expect, it } from 'vitest';
import {
  barracksQueue,
  barracksRemaining,
  combinedBarracksLevel,
  serbuPowerCap,
  trainSoldier,
  trainingOptions,
} from './barracks';
import { deepClone } from './clone';
import { gameData } from './data';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { buildBuilding, canPlaceBuilding, levelDef, settleVillage } from './village';
import { populationFree, populationUsed } from './workers';

const T0 = 1_000_000;
const { barracks, battle, economy, growth } = gameData.rules;
const ADULT = growth.stages[growth.stages.length - 1]!.id;
const BARRACKS = ['barak', 'petarung', 'lapangan-panah'] as const;

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

/** A rich village (Balai 5, all land open) with a finished barracks of `type` at `level`. */
function withBarracks(type: string, level = 1) {
  let s = createInitialState(T0, 51);
  s.village.obstacles = [];
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 1_000_000;
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = 5;
  const r = ok(buildBuilding(s, { type, ...freeSpot(s, 3) }, T0));
  s = settleVillage(r.state, T0 + levelDef(type, 1)!.seconds);
  s.village.buildings.find((b) => b.id === r.buildingId)!.level = level;
  return { s, id: r.buildingId, at: T0 + levelDef(type, 1)!.seconds };
}

describe('training options', () => {
  it('offers tier-1 forms of the barracks role and the unlocked base elements', () => {
    for (const type of BARRACKS) {
      const role = gameData.buildingById.get(type)!.trainsRole;
      for (let level = 1; level <= barracks.unlocksByLevel.length; level++) {
        const { forms, elements } = trainingOptions(type, level);
        expect(forms).toHaveLength(barracks.unlocksByLevel[level - 1]!.forms);
        for (const f of forms) {
          const form = gameData.formById.get(f)!;
          expect(form.tier).toBe(gameData.formTiers[0]);
          expect(form.role).toBe(role);
        }
        expect(elements).toEqual(barracks.unlocksByLevel[level - 1]!.elements);
        for (const el of elements) expect(gameData.baseUnits).toContain(el);
      }
      expect(trainingOptions(type, 0)).toEqual({ forms: [], elements: [] });
    }
    // Higher levels never take options away.
    const low = trainingOptions('barak', 1);
    const high = trainingOptions('barak', barracks.unlocksByLevel.length);
    for (const f of low.forms) expect(high.forms).toContain(f);
    for (const e of low.elements) expect(high.elements).toContain(e);
  });
});

describe('trainSoldier', () => {
  it('pays, queues one after another and hatches adults', () => {
    const { s, id, at } = withBarracks('petarung');
    const { forms, elements } = trainingOptions('petarung', 1);
    const kind = { buildingId: id, form: forms[0]!, element: elements[0]! };
    const used = populationUsed(s);
    const a = ok(trainSoldier(s, kind, at));
    expect(a.state.resources.gold).toBe(s.resources.gold - barracks.train.gold);
    expect(a.state.resources.food).toBe(s.resources.food - barracks.train.food);
    expect(a.endsAt).toBe(at + barracks.train.seconds);
    // The soldier already holds its population slot.
    expect(populationUsed(a.state)).toBe(used + battle.powerPoints['1']!);
    const b = ok(trainSoldier(a.state, kind, at));
    expect(b.endsAt).toBe(at + 2 * barracks.train.seconds);
    expect(barracksQueue(b.state, id)).toHaveLength(2);
    expect(barracksRemaining(b.state, id, at)).toBe(barracks.train.seconds);

    const one = settleVillage(b.state, at + barracks.train.seconds);
    expect(one.monsters).toHaveLength(s.monsters.length + 1);
    const soldier = one.monsters.at(-1)!;
    expect(soldier).toMatchObject({ form: kind.form, element: kind.element, stage: ADULT });
    expect(one.pedia.monsters).toContain(`${kind.form}:${kind.element}`);
    expect(populationUsed(one)).toBe(populationUsed(b.state));
    const two = settleVillage(one, at + 2 * barracks.train.seconds);
    expect(two.monsters).toHaveLength(s.monsters.length + 2);
    expect(two.barracksQueue).toHaveLength(0);
  });

  it('refuses locked choices, a full queue, a full village and missing resources', () => {
    const { s, id, at } = withBarracks('barak');
    const opts = trainingOptions('barak', 1);
    const kind = { buildingId: id, form: opts.forms[0]!, element: opts.elements[0]! };
    const otherRole = trainingOptions('lapangan-panah', 1).forms[0]!;
    expect(trainSoldier(s, { ...kind, form: otherRole }, at)).toEqual({
      ok: false,
      error: 'notUnlocked',
    });
    const locked = gameData.baseUnits.find((u) => !opts.elements.includes(u))!;
    expect(trainSoldier(s, { ...kind, element: locked }, at)).toEqual({
      ok: false,
      error: 'notUnlocked',
    });
    const hall = s.village.buildings.find((b) => b.type === gameData.townHallId)!;
    expect(trainSoldier(s, { ...kind, buildingId: hall.id }, at)).toEqual({
      ok: false,
      error: 'notBarracks',
    });

    let q = s;
    for (let i = 0; i < barracks.queueMax; i++) q = ok(trainSoldier(q, kind, at)).state;
    expect(trainSoldier(q, kind, at)).toEqual({ ok: false, error: 'trainingQueueFull' });

    const full = deepClone(s);
    while (populationFree(full) > 0) {
      full.monsters.push({
        ...economy.startingMonsters[0]!,
        id: `f${full.monsters.length}`,
        food: 0,
      });
    }
    expect(trainSoldier(full, kind, at)).toEqual({ ok: false, error: 'populationFull' });

    const poor = deepClone(s);
    poor.resources.gold = barracks.train.gold - 1;
    expect(trainSoldier(poor, kind, at)).toEqual({ ok: false, error: 'notEnoughGold' });
    poor.resources.gold = barracks.train.gold;
    poor.resources.food = barracks.train.food - 1;
    expect(trainSoldier(poor, kind, at)).toEqual({ ok: false, error: 'notEnoughFood' });
  });

  it('cannot train before the barracks is first finished', () => {
    const s = createInitialState(T0, 52);
    s.village.obstacles = [];
    for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 1_000_000;
    const r = ok(buildBuilding(s, { type: 'barak', ...freeSpot(s, 3) }, T0));
    const opts = trainingOptions('barak', 1);
    expect(
      trainSoldier(
        r.state,
        { buildingId: r.buildingId, form: opts.forms[0]!, element: opts.elements[0]! },
        T0,
      ),
    ).toEqual({ ok: false, error: 'underConstruction' });
  });
});

describe('Serbu power cap', () => {
  it('follows the combined level of all three barracks', () => {
    let { s } = withBarracks('barak', 2);
    expect(combinedBarracksLevel(s)).toBe(2);
    expect(serbuPowerCap(s)).toBe(battle.powerCapByCombinedBarracksLevel[2]);
    for (const type of ['petarung', 'lapangan-panah']) {
      const r = ok(buildBuilding(s, { type, ...freeSpot(s, 3) }, T0));
      s = settleVillage(r.state, T0 + 10_000);
      s.village.buildings.find((b) => b.id === r.buildingId)!.level = 3;
    }
    expect(combinedBarracksLevel(s)).toBe(8);
    expect(serbuPowerCap(s)).toBe(battle.powerCapByCombinedBarracksLevel[8]);
    const table = battle.powerCapByCombinedBarracksLevel;
    for (let i = 1; i < table.length; i++) expect(table[i]!).toBeGreaterThan(table[i - 1]!);
  });
});

describe('a new game', () => {
  it('starts with a single monster', () => {
    const s = createInitialState(T0, 1);
    expect(economy.startingMonsters).toHaveLength(1);
    expect(s.monsters).toHaveLength(1);
    expect(s.monsters[0]).toMatchObject(economy.startingMonsters[0]!);
    expect(s.barracksQueue).toEqual([]);
  });
});

describe('save migration v8', () => {
  it('adds an empty barracks queue', () => {
    const v8 = deepClone(createInitialState(T0, 4)) as unknown as Record<string, unknown>;
    delete v8.barracksQueue;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 8, state: v8 }));
    expect(loaded.barracksQueue).toEqual([]);
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});
