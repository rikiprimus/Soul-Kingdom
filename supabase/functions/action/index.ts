// Supabase Edge Function (Deno): the server side of every player action (Tugas 1.6).
// Game logic comes from packages/shared, bundled by `pnpm build:server` into ../_shared.
import {
  areFriends,
  CORS,
  createPlayer,
  database,
  loadSlot,
  nowSeconds,
  playerId,
  reply,
  saveSlot,
} from '../_shared/db.ts';
import { borrowFrom, handleRequest, parseBorrowedId, serializeState } from '../_shared/game.js';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = database();
  const id = await playerId(db, req);
  if (!id) return reply({ ok: false, error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  const now = nowSeconds();

  const slot = (await loadSlot(db, id)) ?? (await createPlayer(db, id, body?.importSave, now));
  if (!slot) return reply({ ok: false, error: 'conflict' }, 409);

  // A friend's monster in a mix: only from a real friend, and the server's own copy.
  const request = body?.request;
  const borrowed =
    request?.kind === 'action' && request?.name === 'startMix' && request?.params?.borrowed;
  if (borrowed) {
    const ref = parseBorrowedId(String(borrowed.id ?? ''));
    const friend =
      ref && (await areFriends(db, id, ref.friendId)) ? await loadSlot(db, ref.friendId) : null;
    const copy = friend && ref ? borrowFrom(friend.state, ref.friendId, ref.monsterId) : null;
    if (!copy)
      return reply({ ok: false, error: 'monsterNotFound', now, save: serializeState(slot.state) });
    request.params.borrowed = copy;
  }

  const result = handleRequest({ state: slot.state, beatAt: slot.beatAt }, request, now);
  const saved = await saveSlot(db, id, {
    ...slot,
    state: result.slot.state,
    beatAt: result.slot.beatAt,
  });
  if (!saved) return reply({ ok: false, error: 'conflict' }, 409);
  return reply({ ...result.reply, now, save: serializeState(result.slot.state) });
});
