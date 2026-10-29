import {
  advanceRaids,
  advanceWilds,
  type RaidEvent,
  regrowWilds,
  spawnAnimals,
  spawnEncounters,
  type AnimalDone,
  settleVillage,
  type Gathered,
  createInitialState,
  deserializeState,
  gameData,
  loadWithBackup,
  runAction,
  serializeState,
  type ActionName,
  type ActionOutput,
  type ActionParams,
  type ActionResult,
  type Building,
  type PlayerState,
} from '@soul-monster/shared';
import { serverConfig, ServerLink } from './server';

const SAVE_KEY = 'soul-monster:save';
const CLOCK_KEY = 'soul-monster:clock-offset';
/** Last save that loaded fine, used when the main save turns out corrupt. */
const BACKUP_KEY = 'soul-monster:save:backup';

type Listener = (state: PlayerState) => void;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode); the game keeps running in memory.
  }
}

function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}

/**
 * Holds the player state on the client, applies pure actions from
 * @soul-monster/shared and persists every change to localStorage.
 */
export class GameStore {
  private listeners = new Set<Listener>();
  private _state: PlayerState;
  /** Debug "skip time" offset in seconds, added to the real clock. */
  private clockOffset: number;
  /** Set when an unreadable save was replaced by a new game. */
  readonly loadError: string | null = null;
  /** Set when the main save was unusable: 'restored' from the backup, or 'reset' to a new game. */
  readonly loadNotice: 'restored' | 'reset' | null = null;
  /** The Supabase server when configured (Tugas 1.6); null plays offline. */
  private link: ServerLink | null = null;
  /** Play seconds not yet reported to the server. */
  private beatSeconds = 0;
  /** Shows a server error (set by the UI). */
  onServerError: ((error: string) => void) | null = null;

  constructor() {
    this.clockOffset = Number(readStorage(CLOCK_KEY) ?? 0) || 0;
    const saved = readStorage(SAVE_KEY);
    const loaded = loadWithBackup(saved, readStorage(BACKUP_KEY));
    if (loaded.error && saved) {
      console.error(loaded.error);
      this.loadError = loaded.error;
      this.loadNotice = loaded.from === 'backup' ? 'restored' : 'reset';
      writeStorage(`${SAVE_KEY}:broken`, saved);
    }
    // The copy that just loaded is known good: keep it as the backup for next time.
    if (loaded.from === 'main' && saved) writeStorage(BACKUP_KEY, saved);
    this._state = loaded.state ?? createInitialState(this.now(), randomSeed());
    this.save();
    const config = serverConfig();
    if (config) {
      this.link = new ServerLink(
        config,
        (save, now) => this.fromServer(save, now),
        (error) => this.onServerError?.(error),
      );
    }
  }

  private syncStarted = false;

  startServerSync(): void {
    if (!this.link || this.syncStarted) return;
    this.syncStarted = true;
    this.link.send({ kind: 'load' }, serializeState(this._state));
    setInterval(() => this.sendBeat(), gameData.rules.server.beatEverySeconds * 1000);
  }

  /** Plays offline for this run (dev login bypass): no server requests at all. */
  goOffline(): void {
    if (!this.syncStarted) this.link = null;
  }

  get online(): boolean {
    return this.link !== null;
  }

  /** Checks auth status from server link (or returns authenticated if offline). */
  async checkAuth(): Promise<{ state: 'authenticated' | 'anonymous' | 'none'; email?: string }> {
    if (!this.link) return { state: 'authenticated' };
    return this.link.checkAuthStatus();
  }

  /** A friends request to the server (Tugas 2.1); offline it answers `offline`. */
  social(request: object): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
    return this.link?.social(request) ?? Promise.resolve({ ok: false, error: 'offline' });
  }

  /** A PvP request to the server (Tugas 2.2); offline it answers `offline`. */
  pvp(request: object): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
    return this.link?.pvp(request) ?? Promise.resolve({ ok: false, error: 'offline' });
  }

  /** An Arena request to the server (Tugas 2.3); offline it answers `offline`. */
  arena(request: object): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
    return this.link?.arena(request) ?? Promise.resolve({ ok: false, error: 'offline' });
  }

  signInWithGoogle(): void {
    this.link?.signInWithGoogle();
  }

  signInWithEmail(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    return this.link?.signInWithEmail(email, password) ?? Promise.resolve({ ok: true });
  }

  signUpWithEmail(
    email: string,
    password: string,
  ): Promise<{ ok: boolean; error?: string; session?: boolean }> {
    return (
      this.link?.signUpWithEmail(email, password) ?? Promise.resolve({ ok: true, session: true })
    );
  }

  recoverPassword(email: string): Promise<{ ok: boolean; error?: string }> {
    return this.link?.recoverPassword(email) ?? Promise.resolve({ ok: true });
  }

  /** Links Google to the guest account so its progress stays (redirects on success). */
  linkGoogle(): Promise<{ ok: boolean; error?: string }> {
    return this.link?.linkGoogle() ?? Promise.resolve({ ok: false, error: 'offline' });
  }

  signOut(): void {
    this.link?.signOut();
    writeStorage(SAVE_KEY, null);
    window.location.reload();
  }

  getUser(): Promise<{ email?: string; provider?: string; isAnonymous?: boolean } | null> {
    return this.link?.getUser() ?? Promise.resolve(null);
  }

  get state(): PlayerState {
    return this._state;
  }

  /** Game clock with fractions of a second (smooth walking between whole seconds). */
  nowExact(): number {
    return Date.now() / 1000 + this.clockOffset;
  }

  /** Game clock in whole seconds. */
  now(): number {
    return Math.floor(Date.now() / 1000) + this.clockOffset;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Runs a named action from @soul-monster/shared at once; online it also goes to the
   * server, whose answer then replaces the local state.
   */
  act<N extends ActionName>(name: N, params: ActionParams<N>): ActionOutput<N> {
    const result = runAction(this._state, name, params, this.now()) as ActionResult;
    if (result.ok) {
      this.set(result.state);
      this.link?.send({ kind: 'action', name, params });
    }
    return result as ActionOutput<N>;
  }

  /** The server's state and clock win over the local guess. */
  private fromServer(save: string, serverNow: number): void {
    try {
      const state = deserializeState(save);
      this.clockOffset = serverNow - Math.floor(Date.now() / 1000);
      this.set(state);
    } catch (err) {
      console.error(err);
      this.onServerError?.('badSave');
    }
  }

  private sendBeat(): void {
    if (this.beatSeconds <= 0) return;
    this.link?.send({ kind: 'beat', seconds: this.beatSeconds });
    this.beatSeconds = 0;
  }

  set(state: PlayerState): void {
    this._state = state;
    this.save();
    for (const listener of this.listeners) listener(state);
  }

  /** Finishes constructions whose timers ran out; returns the buildings that just finished. */
  settle(): Building[] {
    const now = this.now();
    // Wild nodes regrow on the clock too (also after time away).
    const settled = spawnEncounters(
      spawnAnimals(regrowWilds(settleVillage(this._state, now), now), now),
      now,
    );
    if (settled === this._state) return [];
    const before = new Map(this._state.village.buildings.map((b) => [b.id, b.level]));
    this.set(settled);
    return settled.village.buildings.filter((b) => (before.get(b.id) ?? -1) !== b.level);
  }

  /** Adds `seconds` of active play to gathering and hunting; returns what was finished. */
  gather(seconds: number): { gathered: Gathered[]; animals: AnimalDone[] } {
    const r = advanceWilds(this._state, seconds, this.now());
    if (r.state !== this._state) this.set(r.state);
    return r;
  }

  /** Adds `seconds` of active play to the raid clock and any raid on its way. */
  raid(seconds: number): RaidEvent[] {
    // Raids get play time continuously, so this is where the server's beat is counted.
    this.beatSeconds += seconds;
    const r = advanceRaids(this._state, seconds, this.now());
    if (r.state !== this._state) this.set(r.state);
    return r.events;
  }

  skipTime(seconds: number): void {
    this.clockOffset += seconds;
    writeStorage(CLOCK_KEY, String(this.clockOffset));
    this.set(this._state);
  }

  reset(): void {
    this.clockOffset = 0;
    writeStorage(CLOCK_KEY, null);
    this.set(createInitialState(this.now(), randomSeed()));
  }

  save(): void {
    writeStorage(SAVE_KEY, serializeState(this._state));
  }
}
