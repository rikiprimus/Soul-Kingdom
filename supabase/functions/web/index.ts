// Supabase Edge Function (Deno): Web portal API (Tugas 2C.2)
// Handles news listing, reading, admin management, public arena leaderboard, and player monster collection.
import { type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import { database, loadSlot, playerId, reply, serve } from '../_shared/db.ts';
import type { LeaderRow, NewsItem } from '../../../packages/shared/src/web.ts';
import {
  canAdmin,
  gameData,
  isPublicNews,
  rankLeaderboard,
  validateNewsInput,
} from '../_shared/game.js';

interface WebRequest {
  action: string;
  params?: Record<string, unknown>;
}

async function checkIsAdmin(db: SupabaseClient, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await db.from('admins').select('role').eq('user_id', userId).maybeSingle();
  return canAdmin(data?.role);
}

// deno-lint-ignore no-explicit-any
function toNewsItem(row: any): NewsItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? '',
    content: row.content,
    category: row.category,
    status: row.status,
    coverUrl: row.cover_url ?? null,
    author: row.author ?? 'Admin',
    publishedAt: row.published_at ? new Date(row.published_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return reply({ ok: false, error: 'badMethod' }, 405);

  const db = database();
  const userId = await playerId(db, req);
  const body = (await req.json().catch(() => null)) as WebRequest | null;
  const action = body?.action;
  const params = body?.params ?? {};

  if (!action || typeof action !== 'string') {
    return reply({ ok: false, error: 'badRequest' }, 400);
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  switch (action) {
    case 'news.list': {
      const page = Math.max(1, Number(params.page) || 1);
      const rules = gameData.rules.web;
      const limit = Math.min(
        rules.newsMaxPerPage,
        Math.max(1, Number(params.limit) || rules.newsPerPage),
      );
      const category = typeof params.category === 'string' ? params.category : null;
      const includeDrafts = params.adminView === true && (await checkIsAdmin(db, userId));

      let query = db.from('news').select('*', { count: 'exact' });

      if (!includeDrafts) {
        // Same rule as isPublicNews (news.get): published, with a date that has come.
        query = query.eq('status', 'published').lte('published_at', nowIso);
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, count, error } = await query
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) return reply({ ok: false, error: error.message }, 500);

      const items = (data ?? []).map(toNewsItem);
      const total = count ?? items.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      return reply({
        ok: true,
        items,
        total,
        page,
        totalPages,
      });
    }

    case 'news.get': {
      const slug = String(params.slug ?? '').trim();
      if (!slug) return reply({ ok: false, error: 'slugRequired' }, 400);

      const { data, error } = await db.from('news').select('*').eq('slug', slug).maybeSingle();
      if (error) return reply({ ok: false, error: error.message }, 500);
      if (!data) return reply({ ok: false, error: 'notFound' }, 404);

      const item = toNewsItem(data);
      const isAdmin = await checkIsAdmin(db, userId);

      if (!isAdmin && !isPublicNews(item, nowMs)) {
        return reply({ ok: false, error: 'notFound' }, 404);
      }

      return reply({ ok: true, item });
    }

    case 'leaderboard': {
      const size = gameData.rules.web.leaderboardSize;
      const limit = Math.min(size, Math.max(1, Number(params.limit) || size));
      const { data, error } = await db
        .from('arena_snapshots')
        .select('player_id, name, level, points, tier, team')
        .order('points', { ascending: false })
        .limit(limit);

      if (error) return reply({ ok: false, error: error.message }, 500);

      // deno-lint-ignore no-explicit-any
      const rawRows: Omit<LeaderRow, 'rank'>[] = (data ?? []).map((row: any) => {
        const team = Array.isArray(row.team) ? row.team : [];
        const defenseMonsterId = team[0]?.monsterId ?? null;
        return {
          userId: row.player_id,
          playerName: row.name,
          level: Number(row.level) || 1,
          arenaRating: Number(row.points) || 1000,
          arenaTier: String(row.tier ?? 'Perunggu'),
          defenseMonsterId,
        };
      });

      const entries = rankLeaderboard(rawRows);
      return reply({ ok: true, entries });
    }

    case 'myCollection': {
      if (!userId) return reply({ ok: false, error: 'unauthorized' }, 401);
      const slot = await loadSlot(db, userId);
      if (!slot) return reply({ ok: true, unlockedMonsterIds: [] });

      const pedia = slot.state.pedia ?? {};
      const unlockedMonsterIds = Object.keys(pedia).filter((id) => !!pedia[id]);

      return reply({
        ok: true,
        unlockedMonsterIds,
      });
    }

    case 'admin.check': {
      if (!userId) return reply({ ok: true, isAdmin: false, role: null });
      const { data } = await db.from('admins').select('role').eq('user_id', userId).maybeSingle();
      const role = data?.role ?? null;
      return reply({ ok: true, isAdmin: canAdmin(role), role });
    }

    case 'news.save': {
      if (!(await checkIsAdmin(db, userId))) {
        return reply({ ok: false, error: 'forbidden' }, 403);
      }

      const input = params.item as Partial<NewsItem>;
      if (!input) return reply({ ok: false, error: 'invalidInput' }, 400);

      const validation = validateNewsInput(input);
      if (!validation.valid) {
        return reply({ ok: false, error: 'validationFailed', details: validation.errors }, 400);
      }

      const payload = {
        title: input.title!.trim(),
        slug: input.slug!.trim(),
        excerpt: input.excerpt?.trim() ?? '',
        content: input.content!.trim(),
        category: input.category!,
        status: input.status ?? 'draft',
        cover_url: input.coverUrl ?? null,
        author: input.author?.trim() || 'Admin',
        published_at:
          input.status === 'published'
            ? input.publishedAt
              ? new Date(input.publishedAt).toISOString()
              : nowIso
            : null,
        updated_at: nowIso,
      };

      if (input.id) {
        const { data, error } = await db
          .from('news')
          .update(payload)
          .eq('id', input.id)
          .select()
          .single();
        if (error) return reply({ ok: false, error: error.message }, 500);
        return reply({ ok: true, item: toNewsItem(data) });
      } else {
        const { data, error } = await db.from('news').insert(payload).select().single();
        if (error) return reply({ ok: false, error: error.message }, 500);
        return reply({ ok: true, item: toNewsItem(data) });
      }
    }

    case 'news.publish': {
      if (!(await checkIsAdmin(db, userId))) {
        return reply({ ok: false, error: 'forbidden' }, 403);
      }
      const id = String(params.id ?? '');
      if (!id) return reply({ ok: false, error: 'idRequired' }, 400);

      const { data, error } = await db
        .from('news')
        .update({ status: 'published', published_at: nowIso, updated_at: nowIso })
        .eq('id', id)
        .select()
        .single();

      if (error) return reply({ ok: false, error: error.message }, 500);
      return reply({ ok: true, item: toNewsItem(data) });
    }

    case 'news.hide': {
      if (!(await checkIsAdmin(db, userId))) {
        return reply({ ok: false, error: 'forbidden' }, 403);
      }
      const id = String(params.id ?? '');
      if (!id) return reply({ ok: false, error: 'idRequired' }, 400);

      const { data, error } = await db
        .from('news')
        .update({ status: 'hidden', updated_at: nowIso })
        .eq('id', id)
        .select()
        .single();

      if (error) return reply({ ok: false, error: error.message }, 500);
      return reply({ ok: true, item: toNewsItem(data) });
    }

    case 'news.delete': {
      if (!(await checkIsAdmin(db, userId))) {
        return reply({ ok: false, error: 'forbidden' }, 403);
      }
      const id = String(params.id ?? '');
      if (!id) return reply({ ok: false, error: 'idRequired' }, 400);

      const { error } = await db.from('news').delete().eq('id', id);
      if (error) return reply({ ok: false, error: error.message }, 500);
      return reply({ ok: true });
    }

    default:
      return reply({ ok: false, error: 'unknownAction' }, 400);
  }
});
