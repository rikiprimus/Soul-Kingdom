import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings, bold, italic, and lists', () => {
    const md = [
      '# Judul Besar',
      '## Sub Judul',
      'Ini adalah **teks tebal** dan *teks miring*.',
      '- Butir satu',
      '- Butir dua',
    ].join('\n');

    const html = renderMarkdown(md);
    expect(html).toContain('<h1>Judul Besar</h1>');
    expect(html).toContain('<h2>Sub Judul</h2>');
    expect(html).toContain('<strong>teks tebal</strong>');
    expect(html).toContain('<em>teks miring</em>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Butir satu</li>');
    expect(html).toContain('<li>Butir dua</li>');
    expect(html).toContain('</ul>');
  });

  it('renders safe links with rel noopener and blocks javascript: schemes', () => {
    const md = ['[Kunjungi](https://example.com)', '[Bahaya](javascript:alert(1))'].join('\n');

    const html = renderMarkdown(md);
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Kunjungi</a>',
    );
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('Bahaya');
  });

  it('escapes raw HTML and prevents XSS injection', () => {
    const malicious = [
      '<script>alert("hacked")</script>',
      '<img src="x" onerror="alert(1)">',
      'Normal paragraph with <bold>fake</bold>',
    ].join('\n');

    const html = renderMarkdown(malicious);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('renders code blocks and blockquotes', () => {
    const md = ['> Catatan penting', '```', 'const x = 10 < 20;', '```'].join('\n');

    const html = renderMarkdown(md);
    expect(html).toContain('<blockquote><p>Catatan penting</p></blockquote>');
    expect(html).toContain('<pre><code>const x = 10 &lt; 20;</code></pre>');
  });
});
