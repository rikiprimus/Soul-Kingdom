import { describe, expect, it } from 'vitest';
import { adminEditUrl, articleUrl, ROUTES, slugFromPath } from './routes';

describe('routes', () => {
  it('has no .html in any address', () => {
    for (const path of Object.values(ROUTES)) expect(path).not.toMatch(/\.html/);
    expect(articleUrl('patch-1-0')).toBe('/berita/patch-1-0');
    expect(adminEditUrl('patch-1-0')).toBe('/admin?edit=patch-1-0');
  });

  it('reads the article slug from /berita/<slug>', () => {
    expect(slugFromPath('/berita/patch-1-0')).toBe('patch-1-0');
    expect(slugFromPath('/berita/patch-1-0/')).toBe('patch-1-0');
    expect(slugFromPath('/berita/event%20natal')).toBe('event natal');
    expect(slugFromPath('/berita')).toBeNull();
    expect(slugFromPath('/berita/')).toBeNull();
    expect(slugFromPath('/artikel/')).toBeNull();
  });
});
