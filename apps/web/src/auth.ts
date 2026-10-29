import { t } from './text';

export interface WebSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface WebUser {
  id: string;
  email?: string;
}

export function getWebConfig(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

export function getSessionKey(url: string): string {
  return `soul-monster:session:${url}`;
}

const authListeners: Array<(user: WebUser | null) => void> = [];

export function onAuthStateChange(listener: (user: WebUser | null) => void): () => void {
  authListeners.push(listener);
  return () => {
    const idx = authListeners.indexOf(listener);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
}

function notifyAuthChange(user: WebUser | null) {
  for (const listener of authListeners) {
    try {
      listener(user);
    } catch {
      // ignore listener error
    }
  }
}

export function saveSession(session: WebSession): void {
  const cfg = getWebConfig();
  if (!cfg || typeof window === 'undefined') return;
  try {
    localStorage.setItem(getSessionKey(cfg.url), JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  const cfg = getWebConfig();
  if (!cfg || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getSessionKey(cfg.url));
  } catch {
    // ignore
  }
  notifyAuthChange(null);
}

export async function getSession(renew = false): Promise<WebSession | null> {
  const cfg = getWebConfig();
  if (!cfg || typeof window === 'undefined') return null;

  // Check URL hash for OAuth redirect token
  if (window.location.hash.includes('access_token=')) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const at = hashParams.get('access_token');
    const rt = hashParams.get('refresh_token');
    const exp = Number(hashParams.get('expires_in') ?? 3600);
    if (at && rt) {
      const session: WebSession = {
        access_token: at,
        refresh_token: rt,
        expires_at: Math.floor(Date.now() / 1000) + exp,
      };
      saveSession(session);
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        // ignore
      }
      return session;
    }
  }

  let saved: WebSession | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(getSessionKey(cfg.url)) ?? 'null');
  } catch {
    saved = null;
  }

  if (!saved) return null;

  if (!renew && saved.expires_at - 60 > Date.now() / 1000) {
    return saved;
  }

  if (!saved.refresh_token) {
    clearSession();
    return null;
  }

  try {
    const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: saved.refresh_token }),
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const data = await res.json();
    const session: WebSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    };
    saveSession(session);
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export async function getCurrentUser(): Promise<WebUser | null> {
  const cfg = getWebConfig();
  if (!cfg) return null;
  const sess = await getSession();
  if (!sess) return null;

  try {
    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${sess.access_token}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      email: data.email,
    };
  } catch {
    return null;
  }
}

export async function signInWithEmail(
  email: string,
  pass: string,
): Promise<{ ok: boolean; error?: string }> {
  const cfg = getWebConfig();
  if (!cfg) return { ok: false, error: t('web.auth.noConfig') };

  try {
    const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return {
        ok: false,
        error: err?.error_description || err?.msg || t('web.auth.failed'),
      };
    }

    const data = await res.json();
    const session: WebSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    };
    saveSession(session);
    const user = await getCurrentUser();
    notifyAuthChange(user);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function signInWithGoogle(): void {
  const cfg = getWebConfig();
  if (!cfg || typeof window === 'undefined') return;
  const redirect = encodeURIComponent(window.location.origin + window.location.pathname);
  window.location.href = `${cfg.url}/auth/v1/authorize?provider=google&redirect_to=${redirect}`;
}

export function signOut(): void {
  clearSession();
}
