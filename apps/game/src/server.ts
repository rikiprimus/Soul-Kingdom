import type { ServerRequest } from '@soul-monster/shared';

/** What the `action` edge function answers: the request's result plus the saved state. */
export interface ServerAnswer {
  ok: boolean;
  error?: string;
  /** Server clock (s). */
  now?: number;
  /** The authoritative save (serializeState format). */
  save?: string;
  [extra: string]: unknown;
}

/** The auth server refused the session (or there is none): the player must sign in again. */
export class AuthRefused extends Error {}

interface Session {
  access_token: string;
  refresh_token: string;
  /** Unix seconds. */
  expires_at: number;
}

/** Supabase settings from apps/game/.env.local; without both the game stays offline. */
export function serverConfig(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

/**
 * Talks to the `action` edge function (Tugas 1.6) as an anonymous Supabase user.
 * Requests go one at a time, in order; when the last one answers, its save is handed
 * to `onSave` so the server's state replaces what the client guessed.
 */
export class ServerLink {
  private queue: Promise<void> = Promise.resolve();
  private waiting = 0;

  constructor(
    private readonly config: { url: string; key: string },
    private readonly onSave: (save: string, now: number) => void,
    private readonly onError: (error: string) => void,
  ) {}

  send(request: ServerRequest, importSave?: string): void {
    this.waiting += 1;
    this.queue = this.queue
      .then(() => this.post('action', { request, importSave }))
      .then((answer) => {
        this.waiting -= 1;
        if (answer.error === 'conflict') return this.send({ kind: 'load' });
        if (!answer.ok && answer.error) this.onError(answer.error);
        if (this.waiting === 0 && answer.save && answer.now) this.onSave(answer.save, answer.now);
      })
      .catch(() => {
        this.waiting -= 1;
        this.onError('offline');
      });
  }

  /**
   * Calls the `social` function (friends), after any actions still on their way. An
   * answer carrying the player's save (help) is applied like an action's.
   */
  social(request: object): Promise<ServerAnswer> {
    const run = this.queue.then(() => this.post('social', { request }));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run.then(
      (answer) => {
        if (this.waiting === 0 && answer.save && answer.now) this.onSave(answer.save, answer.now);
        return answer;
      },
      () => ({ ok: false, error: 'offline' }),
    );
  }

  /**
   * Calls the `pvp` function (player vs player base raids), after pending actions.
   * An answer carrying the player's save is applied like an action's.
   */
  pvp(request: object): Promise<ServerAnswer> {
    const run = this.queue.then(() => this.post('pvp', { request }));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run.then(
      (answer) => {
        if (this.waiting === 0 && answer.save && answer.now) this.onSave(answer.save, answer.now);
        return answer;
      },
      () => ({ ok: false, error: 'offline' }),
    );
  }

  /**
   * Calls the `arena` function (3v3 Arena duels & leaderboard), after pending actions.
   * An answer carrying the player's save is applied like an action's.
   */
  arena(request: object): Promise<ServerAnswer> {
    const run = this.queue.then(() => this.post('arena', { request }));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run.then(
      (answer) => {
        if (this.waiting === 0 && answer.save && answer.now) this.onSave(answer.save, answer.now);
        return answer;
      },
      () => ({ ok: false, error: 'offline' }),
    );
  }

  private async post(
    fn: 'action' | 'social' | 'pvp' | 'arena',
    body: object,
  ): Promise<ServerAnswer> {
    const call = async (session: Session) =>
      fetch(`${this.config.url}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          apikey: this.config.key,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    let res = await call(await this.session());
    // A token the server no longer accepts: refresh it (or sign in again) and retry once.
    if (res.status === 401) res = await call(await this.session(true));
    const answer = (await res.json().catch(() => null)) as ServerAnswer | null;
    return answer && typeof answer.ok === 'boolean' ? answer : { ok: false, error: 'server' };
  }

  /** Sessions belong to one Supabase project. */
  get sessionKey(): string {
    return `soul-monster:session:${this.config.url}`;
  }

  /** Redirects to Supabase Google OAuth sign-in. */
  signInWithGoogle(): void {
    if (typeof window === 'undefined') return;
    const redirect = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${this.config.url}/auth/v1/authorize?provider=google&redirect_to=${redirect}`;
  }

  /** Checks if a session or hash token exists in storage. */
  hasStoredSession(): boolean {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
      return true;
    }
    try {
      const saved = localStorage.getItem(this.sessionKey);
      return saved !== null && saved !== 'null';
    } catch {
      return false;
    }
  }

  /**
   * Links Google to the signed-in (anonymous) account, keeping its user id and save.
   * Needs "manual linking" on in the Supabase project (docs/SERVER.md).
   */
  async linkGoogle(): Promise<{ ok: boolean; error?: string }> {
    if (typeof window === 'undefined') return { ok: false, error: 'offline' };
    try {
      const sess = await this.session();
      const redirect = encodeURIComponent(window.location.origin + window.location.pathname);
      const res = await fetch(
        `${this.config.url}/auth/v1/user/identities/authorize?provider=google&redirect_to=${redirect}&skip_http_redirect=true`,
        { headers: { apikey: this.config.key, Authorization: `Bearer ${sess.access_token}` } },
      );
      const data = (await res.json().catch(() => null)) as { url?: string; msg?: string } | null;
      if (!res.ok || !data?.url) return { ok: false, error: data?.msg || `auth ${res.status}` };
      window.location.href = data.url;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Gets user profile from Supabase auth (to check email / provider). */
  async getUser(): Promise<{ email?: string; provider?: string; isAnonymous?: boolean } | null> {
    try {
      return await this.fetchUser();
    } catch {
      return null;
    }
  }

  /** The signed-in user; throws `AuthRefused` when the session is no longer valid. */
  private async fetchUser(): Promise<{ email?: string; provider?: string; isAnonymous?: boolean }> {
    const sess = await this.session();
    const res = await fetch(`${this.config.url}/auth/v1/user`, {
      headers: {
        apikey: this.config.key,
        Authorization: `Bearer ${sess.access_token}`,
      },
    });
    if (res.status === 401 || res.status === 403) throw new AuthRefused(`auth ${res.status}`);
    if (!res.ok) throw new Error(`auth ${res.status}`);
    const data = (await res.json()) as {
      email?: string;
      is_anonymous?: boolean;
      app_metadata?: { provider?: string };
    };
    const isAnonymous = data.is_anonymous || data.app_metadata?.provider === 'anonymous';
    return {
      email: data.email,
      provider: data.app_metadata?.provider ?? (isAnonymous ? 'anonymous' : 'email'),
      isAnonymous,
    };
  }

  /**
   * Check whether current user is authenticated, anonymous guest, or unauthenticated.
   * Only a session the server refuses is dropped; when the server cannot be reached the
   * saved session is kept and the player goes on (requests retry later).
   */
  async checkAuthStatus(): Promise<{
    state: 'authenticated' | 'anonymous' | 'none';
    email?: string;
  }> {
    if (!this.hasStoredSession()) return { state: 'none' };
    let user: { email?: string; isAnonymous?: boolean };
    try {
      user = await this.fetchUser();
    } catch (err) {
      if (!(err instanceof AuthRefused)) return { state: 'authenticated' };
      this.signOut();
      return { state: 'none' };
    }
    if (user.isAnonymous) {
      return { state: 'anonymous' };
    }
    return { state: 'authenticated', email: user.email };
  }

  /** Sign in with email and password. */
  async signInWithEmail(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const auth = await this.auth('token?grant_type=password', { email, password });
      const session: Session = {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + auth.expires_in,
      };
      this.saveSession(session);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Register new account with email and password. */
  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<{ ok: boolean; error?: string; session?: boolean }> {
    try {
      const res = await fetch(`${this.config.url}/auth/v1/signup`, {
        method: 'POST',
        headers: { apikey: this.config.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          msg?: string;
          error_description?: string;
        } | null;
        return {
          ok: false,
          error: data?.msg || data?.error_description || `auth ${res.status}`,
        };
      }
      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };
      if (data.access_token && data.refresh_token) {
        const session: Session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
        };
        this.saveSession(session);
        return { ok: true, session: true };
      }
      return { ok: true, session: false };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Request password reset recovery email. */
  async recoverPassword(email: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.config.url}/auth/v1/recover`, {
        method: 'POST',
        headers: { apikey: this.config.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return { ok: res.ok };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Clears stored session (logout). */
  signOut(): void {
    try {
      localStorage.removeItem(this.sessionKey);
    } catch {
      // ignore
    }
  }

  private saveSession(session: Session): void {
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(session));
    } catch {
      // ignore
    }
  }

  /**
   * The saved session, refreshed when close to expiring (or when `renew`).
   * No longer creates anonymous accounts automatically if missing.
   */
  async session(renew = false): Promise<Session> {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const at = hashParams.get('access_token');
      const rt = hashParams.get('refresh_token');
      const exp = Number(hashParams.get('expires_in') ?? 3600);
      if (at && rt) {
        const session: Session = {
          access_token: at,
          refresh_token: rt,
          expires_at: Math.floor(Date.now() / 1000) + exp,
        };
        this.saveSession(session);
        try {
          window.history.replaceState({}, '', window.location.pathname);
        } catch {
          // ignore
        }
        return session;
      }
    }

    let saved: Session | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(this.sessionKey) ?? 'null') as Session | null;
    } catch {
      saved = null;
    }

    if (!saved) {
      throw new AuthRefused('no_session');
    }

    if (!renew && saved.expires_at - 60 > Date.now() / 1000) return saved;

    const refresh = saved.refresh_token;
    if (!refresh) {
      this.signOut();
      throw new AuthRefused('no_session');
    }

    try {
      const auth = await this.auth('token?grant_type=refresh_token', { refresh_token: refresh });
      const session: Session = {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + auth.expires_in,
      };
      this.saveSession(session);
      return session;
    } catch (err) {
      // A refused refresh token is dead; a network error keeps it for the next try.
      if (err instanceof AuthRefused) this.signOut();
      throw err;
    }
  }

  private async auth(path: string, body: object) {
    const res = await fetch(`${this.config.url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: this.config.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // 4xx (bad or expired token, wrong password) is a refusal; 429 and 5xx are worth retrying.
      const refused = res.status >= 400 && res.status < 500 && res.status !== 429;
      throw refused ? new AuthRefused(`auth ${res.status}`) : new Error(`auth ${res.status}`);
    }
    return (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  }
}
