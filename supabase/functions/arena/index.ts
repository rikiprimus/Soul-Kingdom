// Supabase Edge Function (Deno): Arena dan peringkat mingguan (Tugas 2.3).
// Arena snapshots, 3v3 duel simulation, weekly leaderboard, and rating updates.
// The client only names an opponent; the server rebuilds it from its own records.
import { type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import { database, loadSlot, nowSeconds, playerId, reply, saveSlot, serve } from '../_shared/db.ts';
import {
  arenaBotSeed,
  createArenaSnapshot,
  fightArena,
  gameData,
  isArenaBotId,
  isArenaOpponentInRange,
  matchmakeArenaOpponents,
  resolveArenaBot,
  serializeState,
  settleAll,
  seasonStart,
  settleArena,
  type ArenaSnapshot,
  type PlayerState,
} from '../_shared/game.js';

/** Real snapshots looked at per matchmaking. */
const POOL_SIZE = 10;

// deno-lint-ignore no-explicit-any
const toSnapshot = (c: any): ArenaSnapshot => ({
  id: c.player_id,
  name: c.name,
  level: c.level,
  power: c.power,
  points: c.points,
  tier: c.tier,
  team: c.team,
  updatedAt: Math.floor(new Date(c.updated_at).getTime() / 1000),
});

async function displayName(db: SupabaseClient, id: string): Promise<string> {
  const { data: player } = await db
    .from('players')
    .select('display_name, friend_code')
    .eq('id', id)
    .maybeSingle();
  return player?.display_name ?? `Gladiator ${player?.friend_code?.slice(0, 4) ?? ''}`;
}

async function storeSnapshot(db: SupabaseClient, id: string, state: PlayerState, now: number) {
  const snap = createArenaSnapshot(state, id, await displayName(db, id), now);
  await db.from('arena_snapshots').upsert({
    player_id: id,
    name: snap.name,
    level: snap.level,
    power: snap.power,
    points: snap.points,
    tier: snap.tier,
    team: snap.team,
    updated_at: new Date(now * 1000).toISOString(),
  });
  return snap;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return reply({ ok: false, error: 'badMethod' }, 405);

  const db = database();
  const id = await playerId(db, req);
  if (!id) return reply({ ok: false, error: 'badAuth' }, 401);

  const body = (await req.json().catch(() => null)) as { request?: Record<string, unknown> } | null;
  const r = body?.request;
  if (!r || typeof r.kind !== 'string') return reply({ ok: false, error: 'badRequest' });

  const now = nowSeconds();

  switch (r.kind) {
    case 'saveSnapshot': {
      const slot = await loadSlot(db, id);
      if (!slot) return reply({ ok: false, error: 'noSave' });
      const snap = await storeSnapshot(db, id, settleArena(settleAll(slot.state, now), now), now);
      return reply({ ok: true, snapshot: snap });
    }

    case 'matchmake': {
      const slot = await loadSlot(db, id);
      if (!slot) return reply({ ok: false, error: 'noSave' });
      const state = settleArena(settleAll(slot.state, now), now);
      const points = state.arena.points;
      const range = gameData.rules.arena.matchRange;

      const { data: candidates } = await db
        .from('arena_snapshots')
        .select('*')
        .neq('player_id', id)
        .gte('points', Math.max(0, points - range))
        .lte('points', points + range)
        .order('updated_at', { ascending: false })
        .limit(POOL_SIZE);

      const opponents = matchmakeArenaOpponents(
        points,
        (candidates ?? []).map(toSnapshot),
        arenaBotSeed(state, id, now),
        gameData.rules.arena.opponentsOffered,
      );
      return reply({ ok: true, opponents });
    }

    case 'fight': {
      const opponentId = r.opponentId;
      if (typeof opponentId !== 'string' || opponentId === id) {
        return reply({ ok: false, error: 'badRequest' });
      }

      const slot = await loadSlot(db, id);
      if (!slot) return reply({ ok: false, error: 'noSave' });
      const attackerState = settleArena(settleAll(slot.state, now), now);
      const points = attackerState.arena.points;

      let opponent: ArenaSnapshot | null = null;
      if (isArenaBotId(opponentId)) {
        const seed = arenaBotSeed(attackerState, id, now);
        opponent = resolveArenaBot(opponentId, points, seed, gameData.rules.arena.opponentsOffered);
      } else {
        const { data: row } = await db
          .from('arena_snapshots')
          .select('*')
          .eq('player_id', opponentId)
          .maybeSingle();
        const snap = row ? toSnapshot(row) : null;
        if (snap && isArenaOpponentInRange(points, snap.points)) opponent = snap;
      }
      if (!opponent) return reply({ ok: false, error: 'opponentNotFound' });

      const res = fightArena(attackerState, opponent, now);
      if (!res.ok) return reply(res);

      if (!(await saveSlot(db, id, { ...slot, state: res.state }))) {
        return reply({ ok: false, error: 'conflict' }, 409);
      }
      await storeSnapshot(db, id, res.state, now);

      return reply({
        ok: true,
        save: serializeState(res.state),
        now,
        result: res.result,
      });
    }

    case 'leaderboard': {
      const { data: topRows } = await db
        .from('arena_snapshots')
        .select('player_id, name, level, power, points, tier')
        .gte('updated_at', new Date(seasonStart(now) * 1000).toISOString())
        .order('points', { ascending: false })
        .limit(50);

      // deno-lint-ignore no-explicit-any
      const entries = (topRows ?? []).map((row: any, idx: number) => ({
        rank: idx + 1,
        id: row.player_id,
        name: row.name,
        level: row.level,
        power: row.power,
        points: row.points,
        tier: row.tier,
      }));

      return reply({ ok: true, entries });
    }

    default:
      return reply({ ok: false, error: 'unknownKind' });
  }
});
