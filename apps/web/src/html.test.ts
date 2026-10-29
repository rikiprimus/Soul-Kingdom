import { describe, expect, it } from 'vitest';
import { esc, safeUrl } from './html';
import { newsExcerpt } from './news';

describe('esc', () => {
  it('turns a player name with HTML into plain text', () => {
    expect(esc('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
    expect(esc("O'Neil & co")).toBe('O&#39;Neil &amp; co');
    expect(esc(null)).toBe('');
  });
});

describe('safeUrl', () => {
  it('keeps http(s) links and drops script links', () => {
    expect(safeUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('https://x.com/"onload="alert(1)')).toBe(
      'https://x.com/&quot;onload=&quot;alert(1)',
    );
    expect(safeUrl(null)).toBe('');
  });
});

describe('newsExcerpt', () => {
  it('prefers the excerpt, else shortens the body without Markdown marks', () => {
    expect(newsExcerpt({ excerpt: 'Ringkas', content: 'abc' }, 10)).toBe('Ringkas');
    expect(newsExcerpt({ excerpt: '', content: '# Judul\n**Isi** penting sekali' }, 12)).toBe(
      'Judul Isi pe…',
    );
    expect(newsExcerpt({ excerpt: '', content: 'Pendek' }, 12)).toBe('Pendek');
  });
});
