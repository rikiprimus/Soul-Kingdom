/**
 * Every page address of the website, without ".html". Each page is a folder with an
 * index.html; an article lives at /berita/<slug>, which the host rewrites to the article
 * page (public/_redirects, vercel.json, and the dev server plugin in vite.config.ts).
 */
export const ROUTES = {
  home: '/',
  news: '/berita',
  leaderboard: '/peringkat',
  pedia: '/monster',
  admin: '/admin',
} as const;

export function articleUrl(slug: string): string {
  return `${ROUTES.news}/${encodeURIComponent(slug)}`;
}

export function adminEditUrl(slug: string): string {
  return `${ROUTES.admin}?edit=${encodeURIComponent(slug)}`;
}

/** The article slug from /berita/<slug>; null anywhere else. */
export function slugFromPath(pathname: string): string | null {
  const match = /^\/berita\/([^/]+)\/?$/.exec(pathname);
  return match ? decodeURIComponent(match[1]!) : null;
}
