import { describe, expect, it } from 'vitest';
import { navLinks } from './layout';

describe('website layout navLinks', () => {
  it('returns default public links when not admin', () => {
    const links = navLinks({ signedIn: false, isAdmin: false });
    const hrefs = links.map((l) => l.href);
    expect(hrefs).toEqual(['/berita', '/peringkat', '/monster']);
  });

  it('includes admin.html only when isAdmin is true', () => {
    const adminLinks = navLinks({ signedIn: true, isAdmin: true });
    expect(adminLinks.map((l) => l.href)).toContain('/admin');

    const regularLinks = navLinks({ signedIn: true, isAdmin: false });
    expect(regularLinks.map((l) => l.href)).not.toContain('/admin');
  });
});
