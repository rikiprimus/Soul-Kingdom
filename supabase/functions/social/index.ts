// Supabase Edge Function (Deno): friends (Tugas 2.1) — friend codes and names, friend
// requests, visiting a friend's base, and helping it once a day.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import {
  areFriends,
  CORS,
  database,
  loadSlot,
  nowSeconds,
  playerId,
  reply,
  saveSlot,
} from '../_shared/db.ts';
import {
  borrowedId,
  gameData,
  helpFriend,
  playerLevel,
  serializeState,
  settleAll,
  townHallLevel,
} from '../_shared/game.js';

interface Profile {
  id: string;
  code: string;
  name: string | null;
}

async function profiles(db: SupabaseClient, ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data } = await db.from('players').select('id, friend_code, display_name').in('id', ids);
  return (data ?? []).map((p) => ({ id: p.id, code: p.friend_code, name: p.display_name }));
}

async function friendIds(db: SupabaseClient, id: string): Promise<string[]> {
  const { data } = await db.from('friendships').select('a, b').or(`a.eq.${id},b.eq.${id}`);
  return (data ?? []).map((f) => (f.a === id ? f.b : f.a));
}

async function befriend(db: SupabaseClient, x: string, y: string) {
  const [a, b] = x < y ? [x, y] : [y, x];
  await db.from('friendships').upsert({ a, b });
  await db
    .from('friend_requests')
    .delete()
    .or(`and(from_id.eq.${x},to_id.eq.${y}),and(from_id.eq.${y},to_id.eq.${x})`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = database();
  const id = await playerId(db, req);
  if (!id) return reply({ ok: false, error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  const r = body?.request ?? {};
  const { nameMin, nameMax, maxFriends } = gameData.rules.social;
  const now = nowSeconds();

  switch (r.kind) {
    case 'me': {
      const [me] = await profiles(db, [id]);
      if (!me) return reply({ ok: false, error: 'entryNotFound' });
      const { data: incoming } = await db.from('friend_requests').select('from_id').eq('to_id', id);
      const { data: outgoing } = await db.from('friend_requests').select('to_id').eq('from_id', id);
      return reply({
        ok: true,
        me,
        friends: await profiles(db, await friendIds(db, id)),
        incoming: await profiles(
          db,
          (incoming ?? []).map((x) => x.from_id),
        ),
        outgoing: await profiles(
          db,
          (outgoing ?? []).map((x) => x.to_id),
        ),
      });
    }
    case 'setName': {
      const name = String(r.name ?? '')
        .trim()
        .replace(/\s+/g, ' ');
      if (name.length < nameMin || name.length > nameMax)
        return reply({ ok: false, error: 'badName' });
      await db.from('players').update({ display_name: name }).eq('id', id);
      return reply({ ok: true, name });
    }
    case 'request': {
      const code = String(r.code ?? '')
        .trim()
        .toUpperCase();
      const { data: other } = await db
        .from('players')
        .select('id')
        .eq('friend_code', code)
        .maybeSingle();
      if (!other) return reply({ ok: false, error: 'codeNotFound' });
      if (other.id === id) return reply({ ok: false, error: 'ownCode' });
      if (await areFriends(db, id, other.id)) return reply({ ok: false, error: 'alreadyFriends' });
      if ((await friendIds(db, id)).length >= maxFriends)
        return reply({ ok: false, error: 'tooManyFriends' });
      // They already asked us: asking back is accepting.
      const { data: theirs } = await db
        .from('friend_requests')
        .select('from_id')
        .eq('from_id', other.id)
        .eq('to_id', id)
        .maybeSingle();
      if (theirs) {
        await befriend(db, id, other.id);
        return reply({ ok: true, befriended: true });
      }
      await db.from('friend_requests').upsert({ from_id: id, to_id: other.id });
      return reply({ ok: true, befriended: false });
    }
    case 'respond': {
      const from = String(r.fromId ?? '');
      const { data: ask } = await db
        .from('friend_requests')
        .select('from_id')
        .eq('from_id', from)
        .eq('to_id', id)
        .maybeSingle();
      if (!ask) return reply({ ok: false, error: 'entryNotFound' });
      if (r.accept) {
        if ((await friendIds(db, id)).length >= maxFriends)
          return reply({ ok: false, error: 'tooManyFriends' });
        await befriend(db, id, from);
      } else {
        await db.from('friend_requests').delete().eq('from_id', from).eq('to_id', id);
      }
      return reply({ ok: true });
    }
    case 'visit': {
      const friendId = String(r.friendId ?? '');
      if (!(await areFriends(db, id, friendId))) return reply({ ok: false, error: 'notFriends' });
      const slot = await loadSlot(db, friendId);
      if (!slot) return reply({ ok: false, error: 'entryNotFound' });
      const state = settleAll(slot.state, now);
      const adult = gameData.rules.mixer.parentStage;
      return reply({
        ok: true,
        townHall: townHallLevel(state),
        level: playerLevel(state.xp),
        island: state.island,
        buildings: state.village.buildings.map(
          (b: { type: string; level: number; construction: unknown }) => ({
            type: b.type,
            level: b.level,
            building: !!b.construction,
          }),
        ),
        monsters: state.monsters
          .filter((m: { stage: string }) => m.stage === adult)
          .map((m: { id: string; form: string; element: string; stage: string; food: number }) => ({
            ...m,
            id: borrowedId(friendId, m.id),
          })),
      });
    }
    case 'help': {
      const friendId = String(r.friendId ?? '');
      if (!(await areFriends(db, id, friendId))) return reply({ ok: false, error: 'notFriends' });
      const mine = await loadSlot(db, id);
      const theirs = await loadSlot(db, friendId);
      if (!mine || !theirs) return reply({ ok: false, error: 'entryNotFound' });
      const result = helpFriend(
        settleAll(mine.state, now),
        settleAll(theirs.state, now),
        friendId,
        now,
      );
      if (!result.ok) return reply({ ...result, now, save: serializeState(mine.state) });
      // Friend first: if either save loses a race the help is simply not given.
      if (!(await saveSlot(db, friendId, { ...theirs, state: result.friend }))) {
        return reply({ ok: false, error: 'conflict' }, 409);
      }
      if (!(await saveSlot(db, id, { ...mine, state: result.helper }))) {
        return reply({ ok: false, error: 'conflict' }, 409);
      }
      return reply({ ok: true, spedUp: result.spedUp, now, save: serializeState(result.helper) });
    }
    default:
      return reply({ ok: false, error: 'badRequest' });
  }
});
