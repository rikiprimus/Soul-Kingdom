import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import {
  canAdmin,
  isPublicNews,
  rankLeaderboard,
  slugify,
  validateNewsInput,
  type NewsCategory,
  type NewsItem,
} from './web';

describe('packages/shared/web', () => {
  describe('isPublicNews', () => {
    it('returns true only for published news whose publish date is past or now', () => {
      const now = 1700000000000;
      expect(isPublicNews({ status: 'published', publishedAt: now - 1000 }, now)).toBe(true);
      expect(isPublicNews({ status: 'published', publishedAt: now }, now)).toBe(true);
      expect(isPublicNews({ status: 'published', publishedAt: now + 5000 }, now)).toBe(false);
      expect(isPublicNews({ status: 'draft', publishedAt: now - 1000 }, now)).toBe(false);
      expect(isPublicNews({ status: 'hidden', publishedAt: now - 1000 }, now)).toBe(false);
      expect(isPublicNews({ status: 'published', publishedAt: null }, now)).toBe(false);
    });
  });

  describe('slugify', () => {
    it('converts titles to url-safe kebab case', () => {
      expect(slugify('Update Patch 1.2: Arena Baru!')).toBe('update-patch-12-arena-baru');
      expect(slugify('  Selamat Datang Di Soul Monster  ')).toBe('selamat-datang-di-soul-monster');
    });
  });

  describe('validateNewsInput', () => {
    it('passes on valid complete input', () => {
      const valid: Partial<NewsItem> = {
        title: 'Patch Note 1.0',
        slug: 'patch-note-1-0',
        category: 'update',
        status: 'published',
        content: '# Selamat Datang\nFitur baru telah hadir!',
        excerpt: 'Ringkasan update terbaru.',
      };
      const res = validateNewsInput(valid);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('flags missing or invalid fields', () => {
      const invalid: Partial<NewsItem> = {
        title: 'a',
        slug: 'slug with spaces & $pecial',
        category: 'invalid-cat' as unknown as NewsCategory,
        content: '',
      };
      const res = validateNewsInput(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.map((e) => e.code)).toEqual([
        'titleShort',
        'slugFormat',
        'badCategory',
        'contentRequired',
      ]);
      expect(res.errors[0]?.limit).toBe(gameData.rules.web.news.titleMin);
    });

    it('reads length limits from rules.web.news', () => {
      const res = validateNewsInput({
        title: 'x'.repeat(gameData.rules.web.news.titleMax + 1),
        slug: 'ok-slug',
        category: 'event',
        content: 'Isi yang cukup panjang.',
        excerpt: 'y'.repeat(gameData.rules.web.news.excerptMax + 1),
      });
      expect(res.errors).toEqual([
        { code: 'titleLong', limit: gameData.rules.web.news.titleMax },
        { code: 'excerptLong', limit: gameData.rules.web.news.excerptMax },
      ]);
    });
  });

  describe('rankLeaderboard', () => {
    it('sorts by rating desc, level desc, playerName asc and assigns 1-based ranks', () => {
      const rows = [
        { userId: 'u1', playerName: 'Budi', level: 20, arenaRating: 1500, arenaTier: 'silver' },
        { userId: 'u2', playerName: 'Agus', level: 25, arenaRating: 1800, arenaTier: 'gold' },
        { userId: 'u3', playerName: 'Cici', level: 30, arenaRating: 1800, arenaTier: 'gold' },
        { userId: 'u4', playerName: 'Ani', level: 15, arenaRating: 1200, arenaTier: 'bronze' },
      ];

      const ranked = rankLeaderboard(rows);
      expect(ranked).toHaveLength(4);
      expect(ranked[0]?.playerName).toBe('Cici');
      expect(ranked[0]?.rank).toBe(1);
      expect(ranked[1]?.playerName).toBe('Agus');
      expect(ranked[1]?.rank).toBe(2);
      expect(ranked[2]?.playerName).toBe('Budi');
      expect(ranked[2]?.rank).toBe(3);
      expect(ranked[3]?.playerName).toBe('Ani');
      expect(ranked[3]?.rank).toBe(4);
    });
  });

  describe('canAdmin', () => {
    it('allows the admin and editor roles of the admins table', () => {
      expect(canAdmin('admin')).toBe(true);
      expect(canAdmin('editor')).toBe(true);
      expect(canAdmin('player')).toBe(false);
      expect(canAdmin(null)).toBe(false);
      expect(canAdmin(undefined)).toBe(false);
    });
  });
});
