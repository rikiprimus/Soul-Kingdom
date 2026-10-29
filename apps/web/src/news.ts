import type { NewsItem } from '@soul-monster/shared';
import { esc } from './html';
import { t, webData } from './text';

/** Player text for a news category (unknown ones show as they are). */
export function categoryLabel(category: string): string {
  return webData.newsCategories.includes(category)
    ? t(`web.news.category.${category}`)
    : esc(category);
}

/** "12 Okt 2026" (short) or "12 Oktober 2026" (long); empty when there is no date. */
export function formatDate(
  ms: number | null | undefined,
  month: 'short' | 'long' = 'short',
): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month, year: 'numeric' });
}

/** The card text: the excerpt, or the start of the body without Markdown marks. */
export function newsExcerpt(item: Pick<NewsItem, 'excerpt' | 'content'>, max: number): string {
  if (item.excerpt) return item.excerpt;
  const plain = item.content
    .replace(/[#>*`_[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}
