import { gameData } from './data';

export type NewsCategory = 'update' | 'event' | 'maintenance' | 'community';
export type NewsStatus = 'draft' | 'published' | 'hidden';

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: NewsCategory;
  status: NewsStatus;
  coverUrl?: string | null;
  author: string;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface LeaderRow {
  rank: number;
  userId: string;
  playerName: string;
  level: number;
  arenaRating: number;
  arenaTier: string;
  defenseMonsterId?: string | null;
}

export interface PublicMonster {
  id: string;
  name: string;
  tier: number;
  element: string;
  spriteKey: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
}

export const VALID_NEWS_CATEGORIES: readonly NewsCategory[] = [
  'update',
  'event',
  'maintenance',
  'community',
] as const;

export const VALID_NEWS_STATUSES: readonly NewsStatus[] = ['draft', 'published', 'hidden'] as const;

export function isPublicNews(item: Pick<NewsItem, 'status' | 'publishedAt'>, now: number): boolean {
  if (item.status !== 'published') return false;
  if (item.publishedAt === null || item.publishedAt === undefined) return false;
  return item.publishedAt <= now;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A news field problem; the web shows it as text `web.newsError.<code>` with `{n}` = limit. */
export interface NewsError {
  code:
    | 'titleRequired'
    | 'titleShort'
    | 'titleLong'
    | 'slugRequired'
    | 'slugFormat'
    | 'slugLength'
    | 'badCategory'
    | 'contentRequired'
    | 'contentShort'
    | 'excerptLong'
    | 'badStatus';
  limit?: number;
}

export interface NewsValidationResult {
  valid: boolean;
  errors: NewsError[];
}

export function validateNewsInput(input: Partial<NewsItem>): NewsValidationResult {
  const limits = gameData.rules.web.news;
  const errors: NewsError[] = [];

  const title = input.title?.trim() ?? '';
  if (!title) {
    errors.push({ code: 'titleRequired' });
  } else if (title.length < limits.titleMin) {
    errors.push({ code: 'titleShort', limit: limits.titleMin });
  } else if (title.length > limits.titleMax) {
    errors.push({ code: 'titleLong', limit: limits.titleMax });
  }

  const slug = input.slug?.trim() ?? '';
  if (!slug) {
    errors.push({ code: 'slugRequired' });
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push({ code: 'slugFormat' });
  } else if (slug.length < limits.slugMin || slug.length > limits.slugMax) {
    errors.push({ code: 'slugLength', limit: limits.slugMax });
  }

  if (!input.category || !VALID_NEWS_CATEGORIES.includes(input.category)) {
    errors.push({ code: 'badCategory' });
  }

  const content = input.content?.trim() ?? '';
  if (!content) {
    errors.push({ code: 'contentRequired' });
  } else if (content.length < limits.contentMin) {
    errors.push({ code: 'contentShort', limit: limits.contentMin });
  }

  if (input.excerpt && input.excerpt.length > limits.excerptMax) {
    errors.push({ code: 'excerptLong', limit: limits.excerptMax });
  }

  if (input.status && !VALID_NEWS_STATUSES.includes(input.status)) {
    errors.push({ code: 'badStatus' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function rankLeaderboard(rows: Omit<LeaderRow, 'rank'>[]): LeaderRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.arenaRating !== a.arenaRating) {
      return b.arenaRating - a.arenaRating;
    }
    if (b.level !== a.level) {
      return b.level - a.level;
    }
    return a.playerName.localeCompare(b.playerName);
  });

  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

/** Roles from the `admins` table that may manage news (the RLS policy allows every row). */
export function canAdmin(role?: string | null): boolean {
  return role === 'admin' || role === 'editor';
}
