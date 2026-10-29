import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerLink } from './server';

describe('ServerLink auth & session handling', () => {
  const config = {
    url: 'https://test-project.supabase.co',
    key: 'test-anon-key',
  };

  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, String(v)),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  };

  const windowMock = {
    location: {
      origin: 'http://localhost:5173',
      pathname: '/',
      href: '',
      hash: '',
    },
    history: {
      replaceState: vi.fn(),
    },
  };

  beforeEach(() => {
    storage.clear();
    windowMock.location.hash = '';
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', windowMock);
    vi.restoreAllMocks();
  });

  it('hasStoredSession returns false when storage and hash are empty', () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());
    expect(link.hasStoredSession()).toBe(false);
  });

  it('parses session from URL hash and clears window hash', async () => {
    windowMock.location.hash =
      '#access_token=fake-token&refresh_token=fake-refresh&expires_in=3600';
    const link = new ServerLink(config, vi.fn(), vi.fn());

    expect(link.hasStoredSession()).toBe(true);
    const session = await link.session();
    expect(session.access_token).toBe('fake-token');
    expect(session.refresh_token).toBe('fake-refresh');
    expect(localStorage.getItem(link.sessionKey)).toContain('fake-token');
  });

  it('throws no_session and does not auto-signup if no session exists', async () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());
    await expect(link.session()).rejects.toThrow('no_session');
  });

  it('signOut removes session from localStorage', () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());
    localStorage.setItem(link.sessionKey, JSON.stringify({ access_token: '123' }));
    expect(link.hasStoredSession()).toBe(true);

    link.signOut();
    expect(link.hasStoredSession()).toBe(false);
  });

  it('checkAuthStatus returns none when no session is stored', async () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());
    const status = await link.checkAuthStatus();
    expect(status).toEqual({ state: 'none' });
  });

  it('checkAuthStatus identifies anonymous user', async () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());
    localStorage.setItem(
      link.sessionKey,
      JSON.stringify({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_at: Math.floor(Date.now() / 1000) + 1000,
      }),
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'u1',
        is_anonymous: true,
        app_metadata: { provider: 'anonymous' },
      }),
    } as Response);

    const status = await link.checkAuthStatus();
    expect(status.state).toBe('anonymous');
  });

  it('checkAuthStatus identifies authenticated user with email', async () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());
    localStorage.setItem(
      link.sessionKey,
      JSON.stringify({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_at: Math.floor(Date.now() / 1000) + 1000,
      }),
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'u2',
        email: 'hero@kingdom.com',
        is_anonymous: false,
        app_metadata: { provider: 'email' },
      }),
    } as Response);

    const status = await link.checkAuthStatus();
    expect(status).toEqual({ state: 'authenticated', email: 'hero@kingdom.com' });
  });

  it('checkAuthStatus keeps the session when the server cannot be reached', async () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());
    localStorage.setItem(
      link.sessionKey,
      JSON.stringify({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_at: Math.floor(Date.now() / 1000) + 1000,
      }),
    );
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const status = await link.checkAuthStatus();
    expect(status.state).toBe('authenticated');
    expect(link.hasStoredSession()).toBe(true);
  });

  it('checkAuthStatus signs out when the server refuses the token', async () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());
    localStorage.setItem(
      link.sessionKey,
      JSON.stringify({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_at: Math.floor(Date.now() / 1000) + 1000,
      }),
    );
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 401 } as Response);

    const status = await link.checkAuthStatus();
    expect(status).toEqual({ state: 'none' });
    expect(link.hasStoredSession()).toBe(false);
  });

  it('session keeps the refresh token after a network error, drops it when refused', async () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());
    const expired = { access_token: 'old', refresh_token: 'ref', expires_at: 0 };
    localStorage.setItem(link.sessionKey, JSON.stringify(expired));

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(link.session()).rejects.toThrow('Failed to fetch');
    expect(link.hasStoredSession()).toBe(true);

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 400 } as Response);
    await expect(link.session()).rejects.toThrow('auth 400');
    expect(link.hasStoredSession()).toBe(false);
  });

  it('signInWithEmail calls token endpoint and saves session', async () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'jwt-123',
        refresh_token: 'rt-123',
        expires_in: 7200,
      }),
    } as Response);

    const res = await link.signInWithEmail('test@mail.com', 'password123');
    expect(res.ok).toBe(true);
    expect(localStorage.getItem(link.sessionKey)).toContain('jwt-123');
  });

  it('signUpWithEmail saves session when confirmed immediately', async () => {
    const link = new ServerLink(config, vi.fn(), vi.fn());

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'jwt-new',
        refresh_token: 'rt-new',
        expires_in: 3600,
      }),
    } as Response);

    const res = await link.signUpWithEmail('new@mail.com', 'secret123');
    expect(res.ok).toBe(true);
    expect(res.session).toBe(true);
    expect(localStorage.getItem(link.sessionKey)).toContain('jwt-new');
  });
});
