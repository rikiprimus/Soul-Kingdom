// Supabase Edge Function (Deno): the server side of every player action (Tugas 1.6).
// Game logic comes from packages/shared, bundled by `pnpm build:server` into ../_shared.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import {
  createInitialState,
  deserializeState,
  handleRequest,
  serializeState,
} from '../_shared/game.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return reply({ ok: false, error: 'unauthorized' }, 401);
  const userId = auth.user.id;
  const body = await req.json().catch(() => null);
  const now = Math.floor(Date.now() / 1000);

  const { data: row, error } = await db
    .from('players')
    .select('save, revision, beat_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) return reply({ ok: false, error: 'server' }, 500);

  let slot;
  let revision = 0;
  if (row) {
    slot = { state: deserializeState(JSON.stringify(row.save)), beatAt: Number(row.beat_at) };
    revision = row.revision;
  } else {
    // First visit: the browser's local save moves to the server once (checked by the
    // same validation as any load), otherwise a new game.
    let state = null;
    try {
      if (typeof body?.importSave === 'string') state = deserializeState(body.importSave);
    } catch {
      state = null;
    }
    state ??= createInitialState(now, crypto.getRandomValues(new Uint32Array(1))[0]!);
    const created = await db
      .from('players')
      .insert({ id: userId, save: JSON.parse(serializeState(state)), revision: 0, beat_at: now });
    if (created.error) return reply({ ok: false, error: 'conflict' }, 409);
    slot = { state, beatAt: now };
  }

  const result = handleRequest(slot, body?.request, now);
  const saved = await db
    .from('players')
    .update({
      save: JSON.parse(serializeState(result.slot.state)),
      revision: revision + 1,
      beat_at: result.slot.beatAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .eq('revision', revision)
    .select('revision')
    .maybeSingle();
  if (!saved.data) return reply({ ok: false, error: 'conflict' }, 409);
  return reply({ ...result.reply, now, save: serializeState(result.slot.state) });
});
