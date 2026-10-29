// Supabase Edge Function (Deno): Serbu markas pemain lain (Tugas 2.2).
// Defense snapshots, matchmaking by power, server-computed battle results,
// and defense replays.
import { database, loadSlot, nowSeconds, playerId, reply, saveSlot, serve } from '../_shared/db.ts';
import {
  attackPlayerBase,
  createDefenseSnapshot,
  matchmakeOpponents,
  serializeState,
  settleAll,
  type PvpDefenseSnapshot,
  type SerbuCell,
} from '../_shared/game.js';

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
      const state = settleAll(slot.state, now);

      const { data: player } = await db
        .from('players')
        .select('display_name, friend_code')
        .eq('id', id)
        .maybeSingle();

      const name = player?.display_name ?? `Pemain ${player?.friend_code?.slice(0, 4) ?? ''}`;
      const snap = createDefenseSnapshot(state, id, name, now);

      await db.from('pvp_snapshots').upsert({
        player_id: id,
        name: snap.name,
        town_hall: snap.townHall,
        level: snap.level,
        power: snap.power,
        trophies: snap.trophies,
        snapshot: snap,
        updated_at: new Date(now * 1000).toISOString(),
      });

      return reply({ ok: true, snapshot: snap });
    }

    case 'matchmake': {
      const power = Number(r.power ?? 50);
      const trophies = Number(r.trophies ?? 1000);

      const { data: candidates } = await db
        .from('pvp_snapshots')
        .select('snapshot')
        .neq('player_id', id)
        .gte('power', Math.max(1, Math.round(power * 0.6)))
        .lte('power', Math.round(power * 1.5))
        .limit(10);

      const pool: PvpDefenseSnapshot[] = (candidates ?? []).map(
        (c: { snapshot: unknown }) => c.snapshot as PvpDefenseSnapshot,
      );
      const rng = {
        next: () => Math.random(),
        int: (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1)),
        pick: <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]!,
      };

      const opponents = matchmakeOpponents(power, trophies, pool, rng as any, 3);
      return reply({ ok: true, opponents });
    }

    case 'attack': {
      const defender = r.defender as PvpDefenseSnapshot | undefined;
      const cells = r.cells as SerbuCell[] | undefined;
      if (!defender || !Array.isArray(cells)) return reply({ ok: false, error: 'badRequest' });

      const slot = await loadSlot(db, id);
      if (!slot) return reply({ ok: false, error: 'noSave' });
      const attackerState = settleAll(slot.state, now);

      const res = attackPlayerBase(attackerState, { defender, cells }, now);
      if (!res.ok) return reply(res);

      await saveSlot(db, id, { ...slot, state: res.state });

      // If defending player is a real player, save battle record into pvp_battles
      if (!defender.id.startsWith('bot_')) {
        const { data: p } = await db
          .from('players')
          .select('display_name, friend_code')
          .eq('id', id)
          .maybeSingle();
        const attackerName = p?.display_name ?? `Pemain ${p?.friend_code?.slice(0, 4) ?? ''}`;

        await db.from('pvp_battles').insert({
          defender_id: defender.id,
          attacker_id: id,
          attacker_name: attackerName,
          attacker_level: Math.floor(attackerState.xp / 100) + 1,
          attacker_power: res.defenseLogEntry.attackerPower,
          won: res.result.won,
          trophy_change: res.defenseLogEntry.trophyChange,
          stolen: res.result.stolen,
          replay: res.result.replay,
        });
      }

      return reply({
        ok: true,
        save: serializeState(res.state),
        now,
        result: res.result,
      });
    }

    case 'history': {
      const { data: battles } = await db
        .from('pvp_battles')
        .select('*')
        .eq('defender_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

      const history = (battles ?? []).map((b: any) => ({
        id: b.id,
        attackerId: b.attacker_id,
        attackerName: b.attacker_name,
        attackerLevel: b.attacker_level,
        attackerPower: b.attacker_power,
        won: !b.won,
        trophyChange: b.trophy_change,
        stolen: b.stolen,
        timestamp: Math.floor(new Date(b.created_at).getTime() / 1000),
        replay: b.replay,
      }));

      return reply({ ok: true, history });
    }

    default:
      return reply({ ok: false, error: 'badRequest' });
  }
});
