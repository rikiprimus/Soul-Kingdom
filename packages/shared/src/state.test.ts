import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { townHallLevel } from './village';
import { gameData } from './data';
import { foodToNextStage } from './monster';
import {
  deserializeState,
  loadWithBackup,
  SaveLoadError,
  serializeState,
  SAVE_SCHEMA_VERSION,
} from './save';
import {
  buyMixerSlot,
  cancelMix,
  collectMix,
  confirmMix,
  createInitialState,
  eligibleParents,
  feedMonster,
  prophesy,
  speedUp,
  speedUpCost,
  startMix,
  type ActionResult,
  type PlayerState,
} from './state';

const { rules } = gameData;
const T0 = 1_000_000;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** Gives a state a finished Soul Mixer and a Balai Utama high enough to use it. */
export function withMixer(s: PlayerState): PlayerState {
  const hall = s.village.buildings.find((b) => b.type === gameData.townHallId)!;
  hall.level = rules.mixer.unlockTownHallLevel;
  s.village.buildings.push({
    id: 'mixer',
    type: 'altar',
    x: 0,
    y: 0,
    level: 1,
    construction: null,
    lastCollectAt: T0,
    crop: null,
  });
  return s;
}

/** Fresh state with the mixer unlocked and four adults (m1–m4) to mix. */
function unlocked(): PlayerState {
  const s = createInitialState(T0, 123);
  const adult = rules.growth.stages[rules.growth.stages.length - 1]!.id;
  for (const [id, form, element] of [
    ['m1', 'kucing', 'api'],
    ['m2', 'anjing', 'air'],
    ['m3', 'landak', 'tanah'],
    ['m4', 'kelinci', 'angin'],
  ] as const) {
    s.monsters.push({ id, form, element, stage: adult, food: 0 });
  }
  return withMixer(s);
}

const [m1, m2, m3] = ['m1', 'm2', 'm3'];

describe('createInitialState', () => {
  it('starts from rules.economy', () => {
    const s = createInitialState(T0, 1);
    expect(s.resources).toEqual(rules.economy.startingResources);
    expect(townHallLevel(s)).toBe(rules.economy.startingTownHallLevel);
    expect(s.village.buildings.map((b) => b.type)).toEqual(
      gameData.village.village.startingBuildings.map((b) => b.type),
    );
    // Gold veins come on top of the scattered wilds.
    expect(s.village.obstacles.filter((o) => o.type !== gameData.wilds.goldVeins.node).length).toBe(
      gameData.village.village.initialObstacles,
    );
    // The first monster hatches from the starting egg (Tugas 1A.13).
    expect(s.monsters).toEqual([]);
    expect(s.eggs).toHaveLength(1);
    expect(s.mixerSlots).toBe(rules.mixer.initialSlots);
    expect(s.pedia.monsters).toEqual([]);
  });
});

describe('startMix', () => {
  it('locks the result, pays, consumes parents and starts the timer', () => {
    const s = unlocked();
    const r = ok(startMix(s, { parentAId: m1, parentBId: m2 }, T0));
    const entry = r.state.mixQueue[0]!;
    expect(entry.status).toBe('mixing');
    expect(entry.endsAt).toBe(T0 + entry.cost.seconds);
    expect(r.state.resources.gold).toBe(s.resources.gold - entry.cost.gold);
    expect(r.state.monsters.map((m) => m.id)).toEqual([m3, 'm4']);
    expect(r.state.rngState).not.toBe(s.rngState);
    // The input state is never mutated.
    expect(s.mixQueue).toHaveLength(0);
  });

  it('fails while the mixer is locked (unless skipped in dev)', () => {
    const s = unlocked();
    s.village.buildings = s.village.buildings.filter((b) => b.id !== 'mixer');
    expect(startMix(s, { parentAId: m1, parentBId: m2 }, T0)).toEqual({
      ok: false,
      error: 'mixerLocked',
    });
    expect(startMix(s, { parentAId: m1, parentBId: m2, skipUnlock: true }, T0).ok).toBe(true);
  });

  it('fails without enough gold', () => {
    const s = unlocked();
    s.resources.gold = 0;
    expect(startMix(s, { parentAId: m1, parentBId: m2 }, T0)).toEqual({
      ok: false,
      error: 'notEnoughGold',
    });
  });

  it('fails when a parent is not adult or the same monster', () => {
    const s = unlocked();
    s.monsters[1]!.stage = 'remaja';
    expect(startMix(s, { parentAId: m1, parentBId: m2 }, T0)).toEqual({
      ok: false,
      error: 'notAdult',
    });
    expect(startMix(s, { parentAId: m1, parentBId: m1 }, T0)).toEqual({
      ok: false,
      error: 'sameMonster',
    });
    expect(startMix(s, { parentAId: m1, parentBId: 'nope' }, T0)).toEqual({
      ok: false,
      error: 'monsterNotFound',
    });
  });

  it('fails when all slots are full', () => {
    const s = ok(startMix(unlocked(), { parentAId: m1, parentBId: m2 }, T0)).state;
    expect(startMix(s, { parentAId: m3, parentBId: 'm4' }, T0)).toEqual({
      ok: false,
      error: 'slotsFull',
    });
  });

  it('keeps legendary parents but marks them busy', () => {
    const s = unlocked();
    s.monsters.push(
      { id: 'L1', form: 'naga', element: 'badai', stage: 'dewasa', food: 0 },
      { id: 'L2', form: 'burung-agung', element: 'petir', stage: 'dewasa', food: 0 },
    );
    s.resources.gold = 1_000_000;
    s.resources.soulCrystal = 100;
    s.bossesDefeated = 3;
    const r = ok(startMix(s, { parentAId: 'L1', parentBId: 'L2' }, T0));
    const ids = r.state.monsters.map((m) => m.id);
    expect(ids).toContain('L1');
    expect(ids).not.toContain('L2');
    expect(eligibleParents(r.state).map((m) => m.id)).not.toContain('L1');
    expect(r.state.mixQueue[0]!.result).toMatchObject({ form: 'naga-purba', element: 'langit' });
  });
});

describe('Ramalan Jiwa flow', () => {
  const prepared = () => {
    const s = unlocked();
    const r = ok(startMix(s, { parentAId: m1, parentBId: m2, awaitProphecy: true }, T0));
    return { before: s, state: r.state, id: r.entryId };
  };

  it('reveals the locked result for gems, then continues', () => {
    const { state, id } = prepared();
    const entry = state.mixQueue[0]!;
    expect(entry.status).toBe('prepared');
    const p = ok(prophesy(state, id));
    expect(p.result).toEqual(entry.result);
    expect(p.state.resources.gems).toBe(state.resources.gems - entry.cost.prophecyGems);
    expect(prophesy(p.state, id)).toEqual({ ok: false, error: 'alreadyProphesied' });
    const c = ok(confirmMix(p.state, id, T0 + 10));
    expect(c.state.mixQueue[0]).toMatchObject({
      status: 'mixing',
      endsAt: T0 + 10 + entry.cost.seconds,
    });
    expect(cancelMix(c.state, id)).toEqual({ ok: false, error: 'alreadyStarted' });
  });

  it('cancels after a prophecy: parents and gold come back, gems do not', () => {
    const { before, state, id } = prepared();
    expect(cancelMix(state, id)).toEqual({ ok: false, error: 'notProphesied' });
    const p = ok(prophesy(state, id));
    const c = ok(cancelMix(p.state, id));
    expect(c.state.mixQueue).toHaveLength(0);
    expect(c.state.resources.gold).toBe(before.resources.gold);
    expect(c.state.resources.gems).toBe(p.state.resources.gems);
    expect(c.state.monsters.map((m) => m.id).sort()).toEqual(
      before.monsters.map((m) => m.id).sort(),
    );
  });

  it('fails a prophecy without enough gems', () => {
    const { state, id } = prepared();
    state.resources.gems = 0;
    expect(prophesy(state, id)).toEqual({ ok: false, error: 'notEnoughGems' });
  });
});

describe('collectMix and speedUp', () => {
  it('only hatches when the timer is done, as a baby', () => {
    const r = ok(startMix(unlocked(), { parentAId: m1, parentBId: m2 }, T0));
    const entry = r.state.mixQueue[0]!;
    expect(collectMix(r.state, r.entryId, T0 + 1)).toEqual({ ok: false, error: 'notReady' });
    const c = ok(collectMix(r.state, r.entryId, entry.endsAt!));
    expect(c.monster).toMatchObject({
      form: entry.result.form,
      element: entry.result.element,
      stage: rules.growth.stages[0]!.id,
    });
    expect(c.state.mixQueue).toHaveLength(0);
    expect(c.state.pedia.monsters).toContain(`${entry.result.form}:${entry.result.element}`);
    expect(c.state.pityStreak).toBe(entry.result.nextPityStreak);
  });

  it('records discovered recipes', () => {
    const s = unlocked();
    s.bossesDefeated = 2;
    s.resources.gold = 100_000;
    s.resources.soulCrystal = 10;
    s.monsters.push(
      { id: 'a', form: 'harimau', element: 'api', stage: 'dewasa', food: 0 },
      { id: 'b', form: 'buaya', element: 'air', stage: 'dewasa', food: 0 },
    );
    const r = ok(startMix(s, { parentAId: 'a', parentBId: 'b' }, T0));
    const c = ok(collectMix(r.state, r.entryId, T0 + 10 ** 6));
    expect(c.result.recipeId).toBe('naga-uap');
    expect(c.state.pedia.recipes).toEqual(['naga-uap']);
  });

  it('speeds up with gems', () => {
    const r = ok(startMix(unlocked(), { parentAId: m1, parentBId: m2 }, T0));
    const entry = r.state.mixQueue[0]!;
    const cost = speedUpCost(entry.cost.seconds);
    const s = ok(speedUp(r.state, r.entryId, T0));
    expect(s.gems).toBe(cost);
    expect(s.state.resources.gems).toBe(r.state.resources.gems - cost);
    expect(ok(collectMix(s.state, r.entryId, T0)).monster).toBeDefined();
    expect(speedUp(s.state, r.entryId, T0)).toEqual({ ok: false, error: 'alreadyFinished' });
    const poor = deepClone(r.state);
    poor.resources.gems = 0;
    expect(speedUp(poor, r.entryId, T0)).toEqual({ ok: false, error: 'notEnoughGems' });
  });

  it('prices speed-ups per minute with a minimum', () => {
    const { speedUpGemsPerMinute, speedUpMinimumGems } = rules.premium;
    expect(speedUpCost(1)).toBe(Math.max(speedUpMinimumGems, Math.ceil(speedUpGemsPerMinute / 60)));
    expect(speedUpCost(600)).toBe(Math.max(speedUpMinimumGems, 10 * speedUpGemsPerMinute));
    expect(speedUpCost(0)).toBe(0);
  });
});

/** A new village with a baby squirrel of `element` as its last monster. */
function withBaby(element: string) {
  const s = createInitialState(T0, 1);
  s.monsters.push({
    id: 'baby',
    form: 'tupai',
    element,
    stage: rules.growth.stages[0]!.id,
    food: 0,
  });
  return s;
}

describe('feedMonster', () => {
  it('grows a baby to teen to adult', () => {
    let s = withBaby('cahaya');
    s.resources.food = 100_000;
    const id = s.monsters.at(-1)!.id;
    for (const expected of ['remaja', 'dewasa']) {
      const monster = s.monsters.find((m) => m.id === id)!;
      const r = ok(feedMonster(s, { monsterId: id, amount: foodToNextStage(monster) }));
      expect(r.grew).toBe(true);
      s = r.state;
      expect(s.monsters.find((m) => m.id === id)!.stage).toBe(expected);
    }
    expect(feedMonster(s, { monsterId: id, amount: 1 })).toEqual({
      ok: false,
      error: 'alreadyAdult',
    });
  });

  it('accumulates partial feeding', () => {
    const s = withBaby('api');
    const id = s.monsters.at(-1)!.id;
    const r = ok(feedMonster(s, { monsterId: id, amount: 10 }));
    expect(r.grew).toBe(false);
    expect(r.state.monsters.at(-1)!.food).toBe(10);
    expect(r.state.resources.food).toBe(s.resources.food - 10);
  });

  it('fails without enough food or with a bad amount', () => {
    const s = withBaby('api');
    const id = s.monsters.at(-1)!.id;
    s.resources.food = 0;
    expect(feedMonster(s, { monsterId: id, amount: 10 })).toEqual({
      ok: false,
      error: 'notEnoughFood',
    });
    expect(feedMonster(s, { monsterId: id, amount: 0 })).toEqual({
      ok: false,
      error: 'invalidAmount',
    });
    expect(feedMonster(s, { monsterId: 'x', amount: 1 })).toEqual({
      ok: false,
      error: 'monsterNotFound',
    });
  });
});

describe('mixer slots', () => {
  it('buys mixer slots up to the maximum', () => {
    let s = createInitialState(T0, 1);
    s.resources.gems = 10_000;
    for (let i = rules.mixer.initialSlots; i < rules.mixer.maxSlots; i++)
      s = ok(buyMixerSlot(s)).state;
    expect(s.mixerSlots).toBe(rules.mixer.maxSlots);
    expect(buyMixerSlot(s)).toEqual({ ok: false, error: 'maxSlots' });
    const poor = createInitialState(T0, 1);
    poor.resources.gems = 0;
    expect(buyMixerSlot(poor)).toEqual({ ok: false, error: 'notEnoughGems' });
  });
});

describe('save and load', () => {
  it('round-trips to an identical state', () => {
    const s = ok(
      startMix(unlocked(), { parentAId: m1, parentBId: m2, awaitProphecy: true }, T0),
    ).state;
    const loaded = deserializeState(serializeState(s));
    expect(loaded).toEqual(s);
    expect(JSON.parse(serializeState(s)).schemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });

  it('rejects broken or newer saves', () => {
    expect(() => deserializeState('{oops')).toThrow(SaveLoadError);
    expect(() => deserializeState(JSON.stringify({ schemaVersion: 1, state: {} }))).toThrow(
      SaveLoadError,
    );
    expect(() =>
      deserializeState(JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION + 1, state: {} })),
    ).toThrow(/lebih baru/);
  });

  it('migrates v25 building ids to v26 (Tugas 1C.1)', () => {
    const s = createInitialState(T0, 10);
    s.village.buildings = s.village.buildings.filter((b) => b.type !== 'gudang');
    s.village.buildings.push(
      {
        id: 'mig1',
        type: 'barak',
        x: 0,
        y: 0,
        level: 1,
        construction: null,
        lastCollectAt: T0,
        crop: null,
      },
      {
        id: 'mig2',
        type: 'petarung',
        x: 2,
        y: 0,
        level: 1,
        construction: null,
        lastCollectAt: T0,
        crop: null,
      },
      {
        id: 'mig3',
        type: 'barak-berkuda',
        x: 4,
        y: 0,
        level: 1,
        construction: null,
        lastCollectAt: T0,
        crop: null,
      },
      {
        id: 'mig4',
        type: 'soul-mixer',
        x: 6,
        y: 0,
        level: 1,
        construction: null,
        lastCollectAt: T0,
        crop: null,
      },
      {
        id: 'mig5',
        type: 'kandang',
        x: 8,
        y: 0,
        level: 2,
        construction: null,
        lastCollectAt: T0,
        crop: null,
      },
      {
        id: 'mig6',
        type: 'kandang',
        x: 10,
        y: 0,
        level: 1,
        construction: null,
        lastCollectAt: T0,
        crop: null,
      },
    );
    s.storage.push(
      { id: 's1', type: 'barak', level: 1, flipped: false },
      { id: 's2', type: 'petarung', level: 1, flipped: false },
      { id: 's3', type: 'barak-berkuda', level: 1, flipped: false },
      { id: 's4', type: 'soul-mixer', level: 1, flipped: false },
      { id: 's5', type: 'kandang', level: 1, flipped: false },
    );
    const json = JSON.stringify({ schemaVersion: 25, state: s });
    const loaded = deserializeState(json);
    const byId = new Map(loaded.village.buildings.map((b) => [b.id, b]));
    expect(byId.get('mig1')?.type).toBe('guild');
    expect(byId.get('mig2')?.type).toBe('barak');
    expect(byId.get('mig3')?.type).toBe('kandang-kuda');
    expect(byId.get('mig4')?.type).toBe('altar');
    expect(byId.get('mig5')?.type).toBe('gudang');
    expect(byId.get('mig5')?.level).toBe(1);
    expect(byId.has('mig6')).toBe(false);
    const storageTypes = loaded.storage.map((x) => x.type);
    expect(storageTypes).toEqual(['guild', 'barak', 'kandang-kuda', 'altar', 'gudang']);
  });

  it('migrates v26: workers beyond the new staffed slots step out (Tugas 1C.2)', () => {
    const s = createInitialState(T0, 10);
    const mill = (id: string, x: number, level: number) => ({
      id,
      type: 'penggilingan',
      x,
      y: 0,
      level,
      construction: null,
      lastCollectAt: T0,
      crop: null,
    });
    s.village.buildings.push(mill('mill1', 0, 1), mill('mill3', 2, 3));
    s.workers = ['mill1', 'mill1', 'mill3', 'mill3'].map((buildingId, i) => ({
      id: `w${i}`,
      task: { kind: 'staffed', buildingId },
    }));
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 26, state: s }));
    const staffedIn = (id: string) =>
      loaded.workers.filter((w) => w.task.kind === 'staffed' && w.task.buildingId === id).length;
    expect(staffedIn('mill1')).toBe(1);
    expect(staffedIn('mill3')).toBe(2);
    expect(loaded.workers.filter((w) => w.task.kind === 'idle')).toHaveLength(1);
  });
});

describe('loadWithBackup', () => {
  const good = serializeState(createInitialState(T0, 5));
  const other = serializeState(createInitialState(T0, 6));

  it('uses the main save when it loads', () => {
    const r = loadWithBackup(good, other);
    expect(r.from).toBe('main');
    expect(r.error).toBeNull();
    expect(r.state).toEqual(deserializeState(good));
  });

  it('falls back to the last good backup when the main save is corrupt', () => {
    const r = loadWithBackup('{"schemaVersion":', other);
    expect(r.from).toBe('backup');
    expect(r.error).toMatch(/rusak/);
    expect(r.state).toEqual(deserializeState(other));
  });

  it('starts over when neither copy loads, and when there is nothing saved', () => {
    expect(loadWithBackup('nope', 'nope too')).toMatchObject({ state: null, from: null });
    expect(loadWithBackup(null, null)).toEqual({ state: null, from: null, error: null });
  });
});
