import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { dayNumber } from './quests';
import { deserializeState, serializeState } from './save';
import { borrowedId, borrowFrom, canBorrow, helpFriend, parseBorrowedId } from './social';
import { createInitialState, startMix, type ActionResult, type PlayerState } from './state';

const T0 = 1_000_000;
const DAY = 86400;
const { helpSpeedUpSeconds, helpFriendGold, helpReward } = gameData.rules.social;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

const adult = (id: string, form: string, element: string) => ({
  id,
  form,
  element,
  stage: 'dewasa',
  food: 0,
});

describe('helping a friend', () => {
  it('speeds up the friend construction with the most time left and pays the helper', () => {
    const helper = createInitialState(T0, 1);
    const friend = createInitialState(T0, 2);
    const [a, b] = friend.village.buildings;
    a!.construction = { toLevel: 2, endsAt: T0 + 600 };
    b!.construction = { toLevel: 2, endsAt: T0 + 5000 };
    const r = helpFriend(helper, friend, 'f1', T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.spedUp).toBe(true);
    expect(r.friend.village.buildings[1]!.construction!.endsAt).toBe(
      T0 + 5000 - helpSpeedUpSeconds,
    );
    expect(r.friend.village.buildings[0]!.construction!.endsAt).toBe(T0 + 600);
    expect(r.helper.resources.gold).toBe(helper.resources.gold + helpReward.gold);
    expect(r.helper.actions.help).toBe(1);
    expect(r.helper.xp).toBe(gameData.rules.player.xp.help);
  });

  it('gives the friend gold when nothing is being built; never past the finish time', () => {
    const helper = createInitialState(T0, 1);
    const friend = createInitialState(T0, 2);
    const r = helpFriend(helper, friend, 'f1', T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.spedUp).toBe(false);
    expect(r.friend.resources.gold).toBe(friend.resources.gold + helpFriendGold);
    const busy = deepClone(friend);
    busy.village.buildings[0]!.construction = { toLevel: 2, endsAt: T0 + 10 };
    const fast = helpFriend(helper, busy, 'f1', T0);
    if (!fast.ok) throw new Error(fast.error);
    expect(fast.friend.village.buildings[0]!.construction!.endsAt).toBe(T0);
  });

  it('once a day per friend; other friends and the next day are fine', () => {
    const friend = createInitialState(T0, 2);
    const first = helpFriend(createInitialState(T0, 1), friend, 'f1', T0);
    if (!first.ok) throw new Error(first.error);
    expect(helpFriend(first.helper, friend, 'f1', T0 + 60)).toEqual({
      ok: false,
      error: 'alreadyClaimed',
    });
    expect(helpFriend(first.helper, friend, 'f2', T0 + 60).ok).toBe(true);
    const tomorrow = helpFriend(first.helper, friend, 'f1', T0 + DAY);
    if (!tomorrow.ok) throw new Error(tomorrow.error);
    expect(tomorrow.helper.social.helped).toEqual({ f1: dayNumber(T0 + DAY) });
  });
});

describe('borrowing a friend monster for a mix', () => {
  function mixer(): PlayerState {
    const s = createInitialState(T0, 3);
    s.monsters = [adult('m1', 'kucing', 'api')];
    s.resources.gold = 100_000;
    return s;
  }
  const friendMonster = adult(borrowedId('friend', 'm1'), 'anjing', 'air');

  it('mixes with the borrowed monster without taking it, once a day', () => {
    const s = mixer();
    const r = ok(
      startMix(
        s,
        { parentAId: 'm1', parentBId: '', borrowed: friendMonster, skipUnlock: true },
        T0,
      ),
    );
    const entry = r.state.mixQueue[0]!;
    expect(entry.parents[1]).toEqual(friendMonster);
    expect(entry.consumedParentIds).not.toContain(friendMonster.id);
    expect(canBorrow(r.state, T0)).toBe(false);
    const again = deepClone(r.state);
    again.monsters.push(adult('m2', 'landak', 'tanah'));
    again.mixerSlots = 5;
    expect(
      startMix(
        again,
        { parentAId: 'm2', parentBId: '', borrowed: friendMonster, skipUnlock: true },
        T0 + 5,
      ),
    ).toEqual({ ok: false, error: 'alreadyClaimed' });
    expect(canBorrow(r.state, T0 + DAY)).toBe(true);
  });

  it('the server copy comes from the friend state, under a borrowed id', () => {
    const friend = createInitialState(T0, 2);
    friend.monsters = [adult('m7', 'kelinci', 'angin')];
    const copy = borrowFrom(friend, 'u-1', 'm7')!;
    expect(copy).toEqual({ ...friend.monsters[0], id: 'f:u-1:m7' });
    expect(parseBorrowedId(copy.id)).toEqual({ friendId: 'u-1', monsterId: 'm7' });
    expect(borrowFrom(friend, 'u-1', 'm8')).toBeNull();
    expect(parseBorrowedId('m7')).toBeNull();
  });

  it('a borrowed monster must be adult', () => {
    const baby = { ...friendMonster, stage: 'bayi' };
    expect(
      startMix(mixer(), { parentAId: 'm1', parentBId: '', borrowed: baby, skipUnlock: true }, T0),
    ).toEqual({ ok: false, error: 'notAdult' });
  });
});

describe('save', () => {
  it('keeps the day log; old saves start clean', () => {
    const s = createInitialState(T0, 1);
    s.social = { helped: { f1: 5 }, borrowDay: 5 };
    expect(deserializeState(serializeState(s)).social).toEqual(s.social);
    const old: Partial<PlayerState> = deepClone(s);
    delete old.social;
    const actions: Partial<PlayerState['actions']> = old.actions!;
    delete actions.help;
    const v24 = deserializeState(JSON.stringify({ schemaVersion: 24, state: old }));
    expect(v24.social).toEqual({ helped: {}, borrowDay: null });
    expect(v24.actions.help).toBe(0);
  });
});
