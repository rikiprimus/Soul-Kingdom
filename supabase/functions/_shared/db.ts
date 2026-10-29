// Shared by the edge functions: the Supabase client, the calling player, and loading or
// saving a player's slot (PlayerState + revision + last beat).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import { createInitialState, deserializeState, gameData, serializeState } from './game.js';

/** Origins allowed to call the functions (comma-separated `WEB_APP_ORIGIN`); empty allows any. */
const ALLOWED_ORIGINS = (Deno.env.get('WEB_APP_ORIGIN') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const CORS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Serves one edge function: answers CORS preflights and adds the allowed origin to every
 * answer. A browser accepts only one origin per answer, so the caller's own is echoed back
 * when it is on the list.
 */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    const res =
      req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : await handler(req);
    const origin = req.headers.get('Origin');
    if (ALLOWED_ORIGINS.length === 0) {
      res.headers.set('Access-Control-Allow-Origin', '*');
    } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.headers.set('Access-Control-Allow-Origin', origin);
    }
    if (ALLOWED_ORIGINS.length > 0) res.headers.append('Vary', 'Origin');
    return res;
  });
}

export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export function database(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

/** The signed-in player's id, or null. */
export async function playerId(db: SupabaseClient, req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
}

export interface Slot {
  // deno-lint-ignore no-explicit-any
  state: any;
  beatAt: number;
  revision: number;
}

export async function loadSlot(db: SupabaseClient, id: string): Promise<Slot | null> {
  const { data, error } = await db
    .from('players')
    .select('save, revision, beat_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    state: deserializeState(JSON.stringify(data.save)),
    beatAt: Number(data.beat_at),
    revision: data.revision,
  };
}

/** Saves a slot over the revision it was loaded at; false when someone wrote in between. */
export async function saveSlot(db: SupabaseClient, id: string, slot: Slot): Promise<boolean> {
  const { data } = await db
    .from('players')
    .update({
      save: JSON.parse(serializeState(slot.state)),
      revision: slot.revision + 1,
      beat_at: slot.beatAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('revision', slot.revision)
    .select('revision')
    .maybeSingle();
  return !!data;
}

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function friendCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(gameData.rules.social.friendCodeLength));
  return [...bytes].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
}

/**
 * First visit: the browser's local save moves to the server once (checked like any load),
 * otherwise a new game. Returns null if the row could not be created.
 */
export async function createPlayer(
  db: SupabaseClient,
  id: string,
  importSave: unknown,
  now: number,
): Promise<Slot | null> {
  let state = null;
  try {
    if (typeof importSave === 'string') state = deserializeState(importSave);
  } catch {
    state = null;
  }
  state ??= createInitialState(now, crypto.getRandomValues(new Uint32Array(1))[0]!);
  // A clash of friend codes is unlikely; try a few.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await db.from('players').insert({
      id,
      save: JSON.parse(serializeState(state)),
      revision: 0,
      beat_at: now,
      friend_code: friendCode(),
    });
    if (!error) return { state, beatAt: now, revision: 0 };
    if (!error.message.includes('friend_code')) return null;
  }
  return null;
}

/** Whether the two players are friends. */
export async function areFriends(db: SupabaseClient, x: string, y: string): Promise<boolean> {
  const [a, b] = x < y ? [x, y] : [y, x];
  const { data } = await db.from('friendships').select('a').eq('a', a).eq('b', b).maybeSingle();
  return !!data;
}
