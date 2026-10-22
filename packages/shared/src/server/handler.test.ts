import { describe, expect, it } from 'vitest';
import { deepClone } from '../clone';
import { gameData } from '../data';
import { createInitialState, type PlayerState } from '../state';
import { canPlaceBuilding, levelDef } from '../village';
import { ACTIONS, runAction } from './actions';
import { allowedBeat, handleRequest, settleAll, type ServerSlot } from './handler';

const T0 = 1_000_000;
const { beatSlackSeconds, maxBeatSeconds } = gameData.rules.server;

function slot(state: PlayerState = createInitialState(T0, 3)): ServerSlot {
  return { state, beatAt: T0 };
}

function freeSpot(s: PlayerState, size: number) {
  const { mapSize } = gameData.village.village;
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) if (canPlaceBuilding(s.village, size, x, y)) return { x, y };
  }
  throw new Error('peta penuh');
}

describe('server actions', () => {
  it('runs a named action with the server clock, same as the client would', () => {
    const s = slot();
    const params = { type: 'ladang', ...freeSpot(s.state, 2) };
    const r = handleRequest(s, { kind: 'action', name: 'buildBuilding', params }, T0 + 5);
    if (!r.reply.ok) throw new Error(r.reply.error);
    const buildingId = r.reply.buildingId as string;
    expect(buildingId).toBeDefined();
    const local = runAction(settleAll(s.state, T0 + 5), 'buildBuilding', params, T0 + 5);
    expect(r.slot.state).toEqual(local.ok && local.state);
    const b = r.slot.state.village.buildings.find((x) => x.id === buildingId)!;
    expect(b.construction!.endsAt).toBe(T0 + 5 + levelDef('ladang', 1)!.seconds);
  });

  it('passes game errors through and keeps the state', () => {
    const s = slot();
    const r = handleRequest(
      s,
      { kind: 'action', name: 'hatchEgg', params: { id: 'tidak-ada' } },
      T0,
    );
    expect(r.reply).toEqual({ ok: false, error: 'entryNotFound' });
    expect(r.slot.state).toEqual(settleAll(s.state, T0));
  });

  it('rejects bad requests: unknown kinds and names, wrong parameters', () => {
    const s = slot();
    for (const raw of [
      null,
      { kind: 'cheat' },
      { kind: 'action', name: 'giveGems', params: {} },
      { kind: 'action', name: 'sendWorkers', params: { id: 'o1', count: -3 } },
      { kind: 'action', name: 'buildBuilding', params: { type: 'ladang', x: 'a', y: 0 } },
    ]) {
      expect(handleRequest(s, raw, T0).reply).toEqual({ ok: false, error: 'badRequest' });
    }
  });

  it('never lets the client skip the Soul Mixer unlock', () => {
    const s = slot();
    s.state.monsters = [
      { id: 'm1', form: 'kucing', element: 'api', stage: 'dewasa', food: 0 },
      { id: 'm2', form: 'anjing', element: 'air', stage: 'dewasa', food: 0 },
    ];
    const params = { parentAId: 'm1', parentBId: 'm2', skipUnlock: true };
    expect(runAction(s.state, 'startMix', params, T0).ok).toBe(true);
    const r = handleRequest(s, { kind: 'action', name: 'startMix', params }, T0);
    expect(r.reply).toEqual({ ok: false, error: 'mixerLocked' });
  });

  it('has a parameter check for every action', () => {
    for (const def of Object.values(ACTIONS))
      expect(def.params.safeParse(undefined).success).toBe(false);
  });
});

describe('server clock and beats', () => {
  it('settles timers on load', () => {
    const s = slot();
    s.state.village.buildings[0]!.construction = { toLevel: 2, endsAt: T0 + 10 };
    const r = handleRequest(s, { kind: 'load' }, T0 + 10);
    expect(r.reply).toEqual({ ok: true });
    expect(r.slot.state.village.buildings[0]!.construction).toBeNull();
  });

  it('accepts no more play time than has really passed (plus slack), and caps each beat', () => {
    expect(allowedBeat(5, T0, T0 + 5)).toBe(5);
    expect(allowedBeat(60, T0, T0 + 5)).toBe(5 + beatSlackSeconds);
    expect(allowedBeat(10_000, T0, T0 + 10_000)).toBe(maxBeatSeconds);
    expect(allowedBeat(5, T0, T0 - 100)).toBe(0);
  });

  it('a beat moves gathering on by the allowed seconds and records the time', () => {
    const s = slot();
    const o = s.state.village.obstacles.find((x) => x.type === 'pohon')!;
    s.state.workers[0]!.task = { kind: 'gathering', targetId: o.id };
    const r = handleRequest(s, { kind: 'beat', seconds: 600 }, T0 + 4);
    expect(r.reply).toMatchObject({ ok: true, seconds: 4 + beatSlackSeconds });
    const after = r.slot.state.village.obstacles.find((x) => x.id === o.id)!;
    expect(after.work).toBe(4 + beatSlackSeconds);
    expect(r.slot.beatAt).toBe(T0 + 4);
    // An immediate second beat gets only the slack.
    const again = handleRequest(r.slot, { kind: 'beat', seconds: 600 }, T0 + 4);
    expect(again.reply).toMatchObject({ seconds: beatSlackSeconds });
  });

  it('is deterministic for the same slot, request and time', () => {
    const s = slot();
    const req = { kind: 'action', name: 'collectAll', params: {} };
    expect(handleRequest(deepClone(s), req, T0 + 999)).toEqual(
      handleRequest(deepClone(s), req, T0 + 999),
    );
  });
});
