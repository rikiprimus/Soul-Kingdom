/**
 * Lightweight and XSS-safe Markdown to HTML renderer.
 * All raw HTML is escaped first, then markdown patterns are converted.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^javascript:/i.test(trimmed)) return false;
  if (/^data:/i.test(trimmed) && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(trimmed)) {
    return false;
  }
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('./')
  );
}

export function renderMarkdown(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];

  const closeList = () => {
    if (inList) {
      output.push('</ul>');
      inList = false;
    }
  };

  const parseInline = (line: string): string => {
    let str = line;

    // Images: ![alt](url)
    str = str.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
      if (!isSafeUrl(url)) return '';
      return `<img src="${url}" alt="${alt}" loading="lazy" />`;
    });

    // Links: [text](url)
    str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      if (!isSafeUrl(url)) return text;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // Bold + Italic: ***text***
    str = str.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Bold: **text**
    str = str.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    str = str.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Inline code: `code`
    str = str.replace(/`([^`]+)`/g, '<code>$1</code>');

    return str;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';

    // Fenced code blocks
    if (rawLine.trim().startsWith('```')) {
      if (inCodeBlock) {
        output.push(`<pre><code>${codeBlockBuffer.map(escapeHtml).join('\n')}</code></pre>`);
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(rawLine);
      continue;
    }

    const trimmed = rawLine.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    // Headings
    const h3Match = trimmed.match(/^###\s+(.*)$/);
    if (h3Match) {
      closeList();
      const content = parseInline(escapeHtml(h3Match[1] ?? ''));
      output.push(`<h3>${content}</h3>`);
      continue;
    }

    const h2Match = trimmed.match(/^##\s+(.*)$/);
    if (h2Match) {
      closeList();
      const content = parseInline(escapeHtml(h2Match[1] ?? ''));
      output.push(`<h2>${content}</h2>`);
      continue;
    }

    const h1Match = trimmed.match(/^#\s+(.*)$/);
    if (h1Match) {
      closeList();
      const content = parseInline(escapeHtml(h1Match[1] ?? ''));
      output.push(`<h1>${content}</h1>`);
      continue;
    }

    // Blockquote
    const quoteMatch = trimmed.match(/^>\s+(.*)$/);
    if (quoteMatch) {
      closeList();
      const content = parseInline(escapeHtml(quoteMatch[1] ?? ''));
      output.push(`<blockquote><p>${content}</p></blockquote>`);
      continue;
    }

    // Unordered lists
    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      const itemContent = parseInline(escapeHtml(listMatch[1] ?? ''));
      output.push(`<li>${itemContent}</li>`);
      continue;
    }

    // Regular paragraph
    closeList();
    const content = parseInline(escapeHtml(trimmed));
    output.push(`<p>${content}</p>`);
  }

  closeList();
  if (inCodeBlock) {
    output.push(`<pre><code>${codeBlockBuffer.map(escapeHtml).join('\n')}</code></pre>`);
  }

  return output.join('\n');
}
