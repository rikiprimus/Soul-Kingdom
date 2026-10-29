/**
 * Escapes text for HTML content and quoted attributes. Every value that comes from the
 * server or a player (names, titles, emails, URLs) goes through this before innerHTML.
 */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) links may become an image or link URL; anything else is dropped. */
export function safeUrl(url: string | null | undefined): string {
  const value = (url ?? '').trim();
  return /^https?:\/\//i.test(value) ? esc(value) : '';
}

/** Where the "play" buttons lead (the game client). */
export function gameUrl(): string {
  return (import.meta.env?.VITE_GAME_URL as string) || 'http://localhost:5173';
}
