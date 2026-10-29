import type { LeaderRow, NewsError, NewsItem } from '@soul-monster/shared';
import { getSession, getWebConfig } from './auth';

export interface WebApiResponse {
  ok: boolean;
  error?: string;
  details?: NewsError[];
  [key: string]: unknown;
}

export async function callWebFunction<T = Record<string, unknown>>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<WebApiResponse & T> {
  const cfg = getWebConfig();
  if (!cfg) {
    return { ok: false, error: 'no_config' } as WebApiResponse & T;
  }

  const session = await getSession();
  const headers: Record<string, string> = {
    apikey: cfg.key,
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  try {
    const res = await fetch(`${cfg.url}/functions/v1/web`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, params }),
    });

    const data = (await res.json().catch(() => null)) as (WebApiResponse & T) | null;
    if (!data) {
      return { ok: false, error: `HTTP ${res.status}` } as WebApiResponse & T;
    }
    return data;
  } catch (err) {
    return { ok: false, error: (err as Error).message } as WebApiResponse & T;
  }
}

export async function fetchNewsList(
  options: {
    category?: string;
    page?: number;
    limit?: number;
    adminView?: boolean;
  } = {},
): Promise<{
  ok: boolean;
  items: NewsItem[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
}> {
  const res = await callWebFunction<{
    items: NewsItem[];
    total: number;
    page: number;
    totalPages: number;
  }>('news.list', options);

  return {
    ok: res.ok,
    items: res.items ?? [],
    total: res.total ?? 0,
    page: res.page ?? 1,
    totalPages: res.totalPages ?? 1,
    error: res.error,
  };
}

export async function fetchNewsArticle(slug: string): Promise<{
  ok: boolean;
  item?: NewsItem;
  error?: string;
}> {
  const res = await callWebFunction<{ item: NewsItem }>('news.get', { slug });
  return {
    ok: res.ok,
    item: res.item,
    error: res.error,
  };
}

/** Top players; without `limit` the server sends `rules.web.leaderboardSize`. */
export async function fetchLeaderboard(limit?: number): Promise<{
  ok: boolean;
  entries: LeaderRow[];
  error?: string;
}> {
  const res = await callWebFunction<{ entries: LeaderRow[] }>('leaderboard', { limit });
  return {
    ok: res.ok,
    entries: res.entries ?? [],
    error: res.error,
  };
}

export async function fetchMyCollection(): Promise<{
  ok: boolean;
  unlockedMonsterIds: string[];
  error?: string;
}> {
  const res = await callWebFunction<{ unlockedMonsterIds: string[] }>('myCollection');
  return {
    ok: res.ok,
    unlockedMonsterIds: res.unlockedMonsterIds ?? [],
    error: res.error,
  };
}

export async function checkAdminStatus(): Promise<{
  ok: boolean;
  isAdmin: boolean;
  role: string | null;
}> {
  const res = await callWebFunction<{ isAdmin: boolean; role: string | null }>('admin.check');
  return {
    ok: res.ok,
    isAdmin: !!res.isAdmin,
    role: res.role ?? null,
  };
}

export async function saveNews(item: Partial<NewsItem>): Promise<{
  ok: boolean;
  item?: NewsItem;
  error?: string;
  details?: NewsError[];
}> {
  return await callWebFunction<{ item: NewsItem }>('news.save', { item });
}

export async function publishNews(id: string): Promise<WebApiResponse> {
  return await callWebFunction('news.publish', { id });
}

export async function hideNews(id: string): Promise<WebApiResponse> {
  return await callWebFunction('news.hide', { id });
}

export async function deleteNews(id: string): Promise<WebApiResponse> {
  return await callWebFunction('news.delete', { id });
}

export async function uploadNewsCover(
  file: File,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const cfg = getWebConfig();
  if (!cfg) return { ok: false, error: 'no_config' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'unauthorized' };

  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const res = await fetch(`${cfg.url}/storage/v1/object/news-covers/${fileName}`, {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return { ok: false, error: err?.message || `Upload failed (${res.status})` };
    }

    const publicUrl = `${cfg.url}/storage/v1/object/public/news-covers/${fileName}`;
    return { ok: true, url: publicUrl };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
