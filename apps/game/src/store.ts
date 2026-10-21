import {
  advanceWilds,
  regrowWilds,
  spawnAnimals,
  spawnEncounters,
  type AnimalDone,
  settleVillage,
  type Gathered,
  createInitialState,
  loadWithBackup,
  serializeState,
  type ActionResult,
  type Building,
  type PlayerState,
} from '@soul-monster/shared';

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
  }

  get state(): PlayerState {
    return this._state;
  }

  /** Game clock in whole seconds. */
  now(): number {
    return Math.floor(Date.now() / 1000) + this.clockOffset;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Runs a pure action; on success the new state is stored and broadcast. */
  apply<T extends object>(action: (state: PlayerState, now: number) => ActionResult<T>) {
    const result = action(this._state, this.now());
    if (result.ok) this.set(result.state);
    return result;
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
