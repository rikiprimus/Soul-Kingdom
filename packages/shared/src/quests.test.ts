import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { DataValidationError, gameData, loadGameData, rawGameData } from './data';
import { recordAction } from './player';
import { activeQuest, claimDaily, claimQuest, dailyStatus, dayNumber } from './quests';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';

const T0 = 1_000_000;
const DAY = 86400;
const { chain } = gameData.quests;
const { rewards, dayOffsetSeconds } = gameData.rules.daily;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** A new game sitting on quest `index`, with that quest's action counts starting now. */
function atQuest(index: number): PlayerState {
  const s = createInitialState(T0, 3);
  s.quest = { index, start: { ...s.actions } };
  return s;
}

/** Makes every goal of the active quest done. */
function finish(s: PlayerState): void {
  for (const g of chain[s.quest.index]!.goals) {
    if (g.kind === 'action') recordAction(s, g.action, g.count);
    else if (g.kind === 'monsters') {
      for (let i = s.monsters.length; i < g.count; i++) {
        s.monsters.push({ id: `qm${i}`, form: 'kucing', element: 'api', stage: 'bayi', food: 0 });
      }
    } else {
      for (let i = 0; i < g.count; i++) {
        s.village.buildings.push({
          id: `q${s.quest.index}-${i}`,
          type: g.building,
          x: 0,
          y: 0,
          level: g.level,
          construction: null,
          lastCollectAt: T0,
          crop: null,
        });
      }
    }
  }
}

describe('quest chain', () => {
  it('starts at the first quest with nothing done', () => {
    const s = createInitialState(T0, 1);
    const q = activeQuest(s)!;
    expect(q.quest.id).toBe(chain[0]!.id);
    expect(q.complete).toBe(false);
    expect(claimQuest(s)).toEqual({ ok: false, error: 'notReady' });
  });

  it('counts action goals only from when the quest started', () => {
    const index = chain.findIndex((q) => q.goals.some((g) => g.kind === 'action' && g.count > 1));
    const goal = chain[index]!.goals.find((g) => g.kind === 'action')!;
    if (goal.kind !== 'action') throw new Error('bukan target aksi');
    const s = createInitialState(T0, 1);
    recordAction(s, goal.action, goal.count); // Done before the quest: does not count.
    s.quest = { index, start: { ...s.actions } };
    const at = (st: PlayerState) => activeQuest(st)!.goals[chain[index]!.goals.indexOf(goal)]!;
    expect(at(s).current).toBe(0);
    recordAction(s, goal.action, goal.count - 1);
    expect(at(s)).toEqual({ current: goal.count - 1, target: goal.count, done: false });
    recordAction(s, goal.action, 5);
    expect(at(s)).toEqual({ current: goal.count, target: goal.count, done: true });
  });

  it('counts finished buildings at the level (the starting Ladang too), not ones being built', () => {
    const index = chain.findIndex((q) =>
      q.goals.some((g) => g.kind === 'building' && g.building === 'ladang' && g.count === 2),
    );
    const s = atQuest(index);
    expect(activeQuest(s)!.goals[0]!.current).toBe(1);
    s.village.buildings.push({
      id: 'l2',
      type: 'ladang',
      x: 0,
      y: 0,
      level: 0,
      construction: { toLevel: 1, endsAt: T0 + 10 },
      lastCollectAt: T0,
      crop: null,
    });
    expect(activeQuest(s)!.complete).toBe(false);
    s.village.buildings.at(-1)!.level = 1;
    s.village.buildings.at(-1)!.construction = null;
    expect(activeQuest(s)!.complete).toBe(true);
  });

  it('pays every quest once and moves through the whole chain', () => {
    let s = createInitialState(T0, 2);
    for (const [i, quest] of chain.entries()) {
      expect(activeQuest(s)!.quest.id).toBe(quest.id);
      finish(s);
      const before = deepClone(s.resources);
      const r = ok(claimQuest(s));
      for (const k of ['gold', 'food', 'wood', 'stone', 'soulCrystal', 'gems'] as const) {
        expect(r.state.resources[k]).toBe(before[k] + quest.reward[k]);
      }
      expect(r.state.quest).toEqual({ index: i + 1, start: r.state.actions });
      s = r.state;
    }
    expect(activeQuest(s)).toBeNull();
    expect(claimQuest(s)).toEqual({ ok: false, error: 'entryNotFound' });
  });

  it('counts monsters owned, even ones hatched before the quest', () => {
    const index = chain.findIndex((q) => q.goals.some((g) => g.kind === 'monsters'));
    const s = createInitialState(T0, 1);
    s.monsters.push({ id: 'm1', form: 'kucing', element: 'api', stage: 'bayi', food: 0 });
    s.quest = { index, start: { ...s.actions } };
    expect(activeQuest(s)!.complete).toBe(true);
  });

  it('every action records a count', () => {
    const s = createInitialState(T0, 1);
    recordAction(s, 'gather', 3);
    recordAction(s, 'hatch');
    expect(s.actions).toMatchObject({ gather: 3, hatch: 1, build: 0 });
  });
});

describe('daily bonus', () => {
  /** Time at `hour`:00 local (the data's offset) on day `day`. */
  const at = (day: number, hour = 12) => day * DAY - dayOffsetSeconds + hour * 3600;
  const D = 20_000;

  it('cuts days at local midnight', () => {
    expect(dayNumber(at(D, 0))).toBe(D);
    expect(dayNumber(at(D, 0) - 1)).toBe(D - 1);
    expect(dayNumber(at(D, 23))).toBe(D);
  });

  it('pays once a day, in order, and wraps around', () => {
    let s = createInitialState(at(D), 1);
    for (let i = 0; i < rewards.length + 2; i++) {
      const now = at(D + i);
      expect(dailyStatus(s, now).available).toBe(true);
      const before = s.resources.gold;
      const r = ok(claimDaily(s, now));
      expect(r.index).toBe(i % rewards.length);
      expect(r.state.resources.gold).toBe(before + rewards[i % rewards.length]!.gold);
      expect(claimDaily(r.state, at(D + i, 23))).toEqual({ ok: false, error: 'alreadyClaimed' });
      s = r.state;
    }
  });

  it('missed days neither reset nor skip ahead: the next reward is next', () => {
    const s = createInitialState(at(D), 1);
    const first = ok(claimDaily(s, at(D))).state;
    const second = ok(claimDaily(first, at(D + 1))).state;
    const later = ok(claimDaily(second, at(D + 9)));
    expect(later.index).toBe(2);
    expect(later.state.daily).toEqual({ next: 3, lastDay: D + 9 });
  });

  it('is deterministic for the same state and time', () => {
    const s = createInitialState(at(D), 1);
    expect(claimDaily(s, at(D))).toEqual(claimDaily(deepClone(s), at(D)));
  });
});

describe('save and data', () => {
  it('keeps quest and daily progress; old saves start the chain', () => {
    const s = atQuest(3);
    recordAction(s, 'harvest', 2);
    s.daily = { next: 4, lastDay: 123 };
    const back = deserializeState(serializeState(s));
    expect(back.quest).toEqual(s.quest);
    expect(back.actions).toEqual(s.actions);
    expect(back.daily).toEqual(s.daily);
    const old: Partial<PlayerState> = deepClone(s);
    delete old.actions;
    delete old.quest;
    delete old.daily;
    const v19 = deserializeState(JSON.stringify({ schemaVersion: 19, state: old }));
    expect(v19.quest.index).toBe(0);
    expect(v19.daily).toEqual({ next: 0, lastDay: null });
  });

  it('rejects a quest naming an unknown building', () => {
    const raw = deepClone(rawGameData) as unknown as { quests: typeof gameData.quests };
    raw.quests.chain[0]!.goals = [{ kind: 'building', building: 'tidak-ada', level: 1, count: 1 }];
    expect(() => loadGameData(raw as unknown as typeof rawGameData)).toThrow(DataValidationError);
  });
});
