import { z } from 'zod';
import { spawnAnimals } from '../animals';
import { gameData, type GameData } from '../data';
import { spawnEncounters } from '../encounters';
import { advanceRaids } from '../raids';
import type { ActionError, PlayerState } from '../state';
import { settleVillage } from '../village';
import { advanceWilds, regrowWilds } from '../wilds';
import { ACTIONS, runAction, type ActionName } from './actions';

/** What the client asks the server. */
export const requestSchema = z.discriminatedUnion('kind', [
  /** The current state (the server settles timers first). */
  z.object({ kind: z.literal('load') }),
  /** Seconds of active play since the last beat: gathering and raids move on. */
  z.object({ kind: z.literal('beat'), seconds: z.number().min(0).max(3600) }),
  z.object({
    kind: z.literal('action'),
    name: z.enum(Object.keys(ACTIONS) as [ActionName, ...ActionName[]]),
    params: z.unknown(),
  }),
]);
export type ServerRequest = z.infer<typeof requestSchema>;

/** A player's saved slot on the server: the state and when the last beat was taken. */
export interface ServerSlot {
  state: PlayerState;
  beatAt: number;
}

export type ServerReply =
  ({ ok: true } & Record<string, unknown>) | { ok: false; error: ActionError };

/** Timers that run on the clock: constructions, training, missions, regrowth, spawns. */
export function settleAll(state: PlayerState, now: number, data: GameData = gameData) {
  return spawnEncounters(
    spawnAnimals(regrowWilds(settleVillage(state, now), now, data), now, data),
    now,
    data,
  );
}

/** Play seconds a beat may add: no more than real time since the last beat, plus slack. */
export function allowedBeat(
  asked: number,
  beatAt: number,
  now: number,
  data: GameData = gameData,
): number {
  const { beatSlackSeconds, maxBeatSeconds } = data.rules.server;
  return Math.max(0, Math.min(asked, now - beatAt + beatSlackSeconds, maxBeatSeconds));
}

/**
 * Runs one request with the server clock. Pure: the edge function only loads the slot,
 * calls this and saves the slot it returns.
 */
export function handleRequest(
  slot: ServerSlot,
  raw: unknown,
  now: number,
  data: GameData = gameData,
): { slot: ServerSlot; reply: ServerReply } {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return { slot, reply: { ok: false, error: 'badRequest' } };
  const req = parsed.data;
  const state = settleAll(slot.state, now, data);
  if (req.kind === 'load') return { slot: { ...slot, state }, reply: { ok: true } };
  if (req.kind === 'beat') {
    const seconds = allowedBeat(req.seconds, slot.beatAt, now, data);
    const wilds = advanceWilds(state, seconds, now, data);
    const raids = advanceRaids(wilds.state, seconds, now, data);
    return {
      slot: { state: raids.state, beatAt: now },
      reply: {
        ok: true,
        seconds,
        gathered: wilds.gathered,
        animals: wilds.animals,
        events: raids.events,
      },
    };
  }
  const params = ACTIONS[req.name].params.safeParse(req.params);
  if (!params.success)
    return { slot: { ...slot, state }, reply: { ok: false, error: 'badRequest' } };
  const checked = params.data as Record<string, unknown>;
  // Development switches never reach the server.
  delete checked.skipUnlock;
  const result = runAction(state, req.name, checked as never, now);
  if (!result.ok) return { slot: { ...slot, state }, reply: result };
  const { state: next, ...extras } = result;
  return { slot: { ...slot, state: next }, reply: { ...extras, ok: true } };
}
