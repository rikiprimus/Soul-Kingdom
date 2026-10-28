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
  private get sessionKey(): string {
    return `soul-monster:session:${this.config.url}`;
  }

  /** Redirects to Supabase Google OAuth sign-in. */
  signInWithGoogle(): void {
    const redirect = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${this.config.url}/auth/v1/authorize?provider=google&redirect_to=${redirect}`;
  }

  /** Gets user profile from Supabase auth (to check email / provider). */
  async getUser(): Promise<{ email?: string; provider?: string } | null> {
    try {
      const sess = await this.session();
      const res = await fetch(`${this.config.url}/auth/v1/user`, {
        headers: {
          apikey: this.config.key,
          Authorization: `Bearer ${sess.access_token}`,
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        email?: string;
        app_metadata?: { provider?: string };
      };
      return {
        email: data.email,
        provider: data.app_metadata?.provider ?? 'anonymous',
      };
    } catch {
      return null;
    }
  }

  /**
   * The saved anonymous session, refreshed when close to expiring (or when `renew`);
   * a new anonymous account only when there is none or it cannot be refreshed.
   */
  private async session(renew = false): Promise<Session> {
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
        try {
          localStorage.setItem(this.sessionKey, JSON.stringify(session));
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
    if (saved && !renew && saved.expires_at - 60 > Date.now() / 1000) return saved;
    const refresh = saved?.refresh_token;
    const auth = refresh
      ? await this.auth('token?grant_type=refresh_token', { refresh_token: refresh }).catch(() =>
          this.auth('signup', {}),
        )
      : await this.auth('signup', {});
    const session: Session = {
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + auth.expires_in,
    };
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(session));
    } catch {
      // Without storage the player signs in again next time (a new anonymous account).
    }
    return session;
  }

  private async auth(path: string, body: object) {
    const res = await fetch(`${this.config.url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: this.config.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`auth ${res.status}`);
    return (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  }
}
