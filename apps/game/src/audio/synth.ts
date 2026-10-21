/**
 * Placeholder sound effects synthesised in code (pure, no Phaser/DOM, so it can be tested).
 * Each sound is a short list of notes; `renderSound` mixes them into mono samples. A recorded
 * file with the same id in public/audio/ (see docs/SUARA.md) replaces the synthesised one.
 */

export const SOUND_IDS = [
  'click',
  'tap',
  'collect',
  'coin',
  'pickup',
  'place',
  'build-done',
  'gather',
  'ready',
  'error',
  'win',
  'lose',
  'mixer',
  'hatch',
  'panel',
  'unlock-land',
  'grow',
  'march',
  'revive',
  'prophecy',
  'rare-hatch',
  'enemy',
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

type Wave = 'sine' | 'triangle' | 'square' | 'noise';

interface Note {
  wave: Wave;
  /** Start frequency (Hz); ignored for noise. */
  freq: number;
  /** End frequency for a glide (exponential); defaults to `freq`. */
  to?: number;
  /** Start time and length, seconds. */
  at: number;
  dur: number;
  gain: number;
  /** Attack time in seconds (default 5 ms); the rest decays exponentially. */
  attack?: number;
  /** One-pole low-pass cutoff in Hz, to soften noise and square waves. */
  lowpass?: number;
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/** Note lists per sound: soft, short and bright, to suit a cosy village game. */
export const RECIPES: Record<SoundId, Note[]> = {
  click: [{ wave: 'triangle', freq: 880, to: 660, at: 0, dur: 0.05, gain: 0.5 }],
  tap: [{ wave: 'sine', freq: 520, to: 640, at: 0, dur: 0.07, gain: 0.5 }],
  collect: [
    { wave: 'sine', freq: 420, to: 980, at: 0, dur: 0.14, gain: 0.5 },
    { wave: 'noise', freq: 0, at: 0, dur: 0.1, gain: 0.12, lowpass: 2500 },
  ],
  coin: [
    { wave: 'triangle', freq: 1318.5, at: 0, dur: 0.07, gain: 0.45 },
    { wave: 'triangle', freq: 1760, at: 0.05, dur: 0.16, gain: 0.45 },
  ],
  pickup: [{ wave: 'sine', freq: 600, to: 820, at: 0, dur: 0.09, gain: 0.55 }],
  place: [
    { wave: 'sine', freq: 150, to: 70, at: 0, dur: 0.2, gain: 0.9, attack: 0.002 },
    { wave: 'noise', freq: 0, at: 0, dur: 0.09, gain: 0.35, lowpass: 900 },
  ],
  'build-done': [
    { wave: 'triangle', freq: C5, at: 0, dur: 0.14, gain: 0.45 },
    { wave: 'triangle', freq: E5, at: 0.08, dur: 0.14, gain: 0.45 },
    { wave: 'triangle', freq: G5, at: 0.16, dur: 0.14, gain: 0.45 },
    { wave: 'triangle', freq: C6, at: 0.24, dur: 0.35, gain: 0.5 },
  ],
  gather: [
    { wave: 'noise', freq: 0, at: 0, dur: 0.06, gain: 0.5, lowpass: 2200, attack: 0.001 },
    { wave: 'sine', freq: 230, to: 150, at: 0, dur: 0.1, gain: 0.6, attack: 0.001 },
  ],
  ready: [
    { wave: 'sine', freq: 880, at: 0, dur: 0.14, gain: 0.45 },
    { wave: 'sine', freq: 1174.7, at: 0.1, dur: 0.24, gain: 0.45 },
  ],
  error: [
    { wave: 'square', freq: 196, at: 0, dur: 0.1, gain: 0.25, lowpass: 1200 },
    { wave: 'square', freq: 165, at: 0.11, dur: 0.14, gain: 0.25, lowpass: 1200 },
  ],
  win: [
    { wave: 'triangle', freq: C5, at: 0, dur: 0.12, gain: 0.45 },
    { wave: 'triangle', freq: E5, at: 0.1, dur: 0.12, gain: 0.45 },
    { wave: 'triangle', freq: G5, at: 0.2, dur: 0.12, gain: 0.45 },
    { wave: 'triangle', freq: C6, at: 0.32, dur: 0.45, gain: 0.5 },
    { wave: 'sine', freq: G5, at: 0.32, dur: 0.45, gain: 0.25 },
  ],
  lose: [
    { wave: 'triangle', freq: 392, at: 0, dur: 0.16, gain: 0.45 },
    { wave: 'triangle', freq: 329.6, at: 0.15, dur: 0.16, gain: 0.45 },
    { wave: 'triangle', freq: 261.6, at: 0.3, dur: 0.45, gain: 0.45 },
  ],
  mixer: [
    { wave: 'sine', freq: 300, to: 1200, at: 0, dur: 0.7, gain: 0.35, attack: 0.15 },
    { wave: 'sine', freq: 303, to: 1212, at: 0, dur: 0.7, gain: 0.3, attack: 0.15 },
    { wave: 'triangle', freq: 1568, at: 0.55, dur: 0.3, gain: 0.25 },
  ],
  hatch: [
    { wave: 'noise', freq: 0, at: 0, dur: 0.05, gain: 0.5, lowpass: 3000, attack: 0.001 },
    { wave: 'sine', freq: C6, at: 0.06, dur: 0.12, gain: 0.35 },
    { wave: 'sine', freq: 1318.5, at: 0.12, dur: 0.12, gain: 0.35 },
    { wave: 'sine', freq: 1568, at: 0.18, dur: 0.12, gain: 0.35 },
    { wave: 'sine', freq: 2093, at: 0.24, dur: 0.3, gain: 0.35 },
  ],
  panel: [
    { wave: 'noise', freq: 0, at: 0, dur: 0.16, gain: 0.35, lowpass: 1400, attack: 0.04 },
    { wave: 'sine', freq: 330, to: 520, at: 0, dur: 0.12, gain: 0.3 },
  ],
  'unlock-land': [
    { wave: 'sine', freq: 180, to: 90, at: 0, dur: 0.18, gain: 0.7, attack: 0.002 },
    { wave: 'triangle', freq: G5, at: 0.1, dur: 0.14, gain: 0.4 },
    { wave: 'triangle', freq: C6, at: 0.2, dur: 0.14, gain: 0.4 },
    { wave: 'triangle', freq: 1318.5, at: 0.3, dur: 0.35, gain: 0.45 },
  ],
  grow: [
    { wave: 'sine', freq: 392, to: 784, at: 0, dur: 0.35, gain: 0.45, attack: 0.05 },
    { wave: 'triangle', freq: E5, at: 0.3, dur: 0.14, gain: 0.35 },
    { wave: 'triangle', freq: G5, at: 0.38, dur: 0.3, gain: 0.4 },
  ],
  march: [
    { wave: 'sine', freq: 110, to: 80, at: 0, dur: 0.14, gain: 0.8, attack: 0.002 },
    { wave: 'sine', freq: 110, to: 80, at: 0.2, dur: 0.14, gain: 0.8, attack: 0.002 },
    { wave: 'square', freq: 392, at: 0.36, dur: 0.12, gain: 0.2, lowpass: 1600 },
    { wave: 'square', freq: 523.25, at: 0.48, dur: 0.3, gain: 0.22, lowpass: 1600 },
  ],
  revive: [
    { wave: 'sine', freq: 523.25, at: 0, dur: 0.6, gain: 0.3, attack: 0.15 },
    { wave: 'sine', freq: E5, at: 0.08, dur: 0.6, gain: 0.3, attack: 0.15 },
    { wave: 'sine', freq: G5, at: 0.16, dur: 0.6, gain: 0.3, attack: 0.15 },
    { wave: 'triangle', freq: C6, at: 0.3, dur: 0.45, gain: 0.25 },
  ],
  prophecy: [
    { wave: 'sine', freq: 660, to: 990, at: 0, dur: 0.5, gain: 0.3, attack: 0.12 },
    { wave: 'sine', freq: 667, to: 1000, at: 0, dur: 0.5, gain: 0.3, attack: 0.12 },
    { wave: 'triangle', freq: 1975.5, at: 0.35, dur: 0.3, gain: 0.25 },
  ],
  'rare-hatch': [
    { wave: 'triangle', freq: C5, at: 0, dur: 0.12, gain: 0.4 },
    { wave: 'triangle', freq: E5, at: 0.08, dur: 0.12, gain: 0.4 },
    { wave: 'triangle', freq: G5, at: 0.16, dur: 0.12, gain: 0.4 },
    { wave: 'triangle', freq: C6, at: 0.24, dur: 0.12, gain: 0.4 },
    { wave: 'triangle', freq: 1318.5, at: 0.32, dur: 0.12, gain: 0.4 },
    { wave: 'sine', freq: 1568, at: 0.4, dur: 0.6, gain: 0.45 },
    { wave: 'sine', freq: C6, at: 0.4, dur: 0.6, gain: 0.3 },
  ],
  enemy: [
    { wave: 'square', freq: 220, at: 0, dur: 0.2, gain: 0.25, lowpass: 900, attack: 0.03 },
    { wave: 'square', freq: 196, at: 0.2, dur: 0.3, gain: 0.25, lowpass: 900, attack: 0.03 },
  ],
};

/** Peak level of every rendered sound, leaving headroom when several play at once. */
export const PEAK = 0.8;

/** Mixes a sound's notes into mono samples at `sampleRate`, normalised to `PEAK`. */
export function renderSound(id: SoundId, sampleRate: number): Float32Array<ArrayBuffer> {
  const notes = RECIPES[id];
  const length = Math.ceil(Math.max(...notes.map((n) => n.at + n.dur)) * sampleRate) + 1;
  const out = new Float32Array(length);
  // Deterministic noise (LCG), so the same sound always renders the same samples.
  let seed = 0x2f6e2b1;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };
  for (const n of notes) {
    const start = Math.floor(n.at * sampleRate);
    const count = Math.floor(n.dur * sampleRate);
    const attack = Math.max(1, Math.floor((n.attack ?? 0.005) * sampleRate));
    const to = n.to ?? n.freq;
    const alpha = n.lowpass ? 1 - Math.exp((-2 * Math.PI * n.lowpass) / sampleRate) : 1;
    let phase = 0;
    let filtered = 0;
    for (let i = 0; i < count && start + i < length; i++) {
      const k = i / count;
      const freq = n.freq * (to / n.freq) ** k;
      phase += freq / sampleRate;
      const p = phase % 1;
      let v: number;
      switch (n.wave) {
        case 'sine':
          v = Math.sin(2 * Math.PI * p);
          break;
        case 'triangle':
          v = 1 - 4 * Math.abs(p - 0.5);
          break;
        case 'square':
          v = p < 0.5 ? 1 : -1;
          break;
        default:
          v = noise();
      }
      filtered += alpha * (v - filtered);
      // Linear attack, then an exponential decay that reaches about -40 dB at the end.
      const env = i < attack ? i / attack : Math.exp((-4.6 * (i - attack)) / (count - attack));
      out[start + i]! += filtered * env * n.gain;
    }
  }
  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
  if (peak > 0) for (let i = 0; i < length; i++) out[i] = (out[i]! / peak) * PEAK;
  return out;
}

/**
 * Volume factor that brings a recorded file with the given peak to `PEAK`, so files from a
 * generator sit at the same level as each other. Limited to 0.5–4× so near-silent or
 * clipped files are not pushed to extremes.
 */
export function levelGain(peak: number): number {
  if (!(peak > 0)) return 1;
  return Math.min(4, Math.max(0.5, PEAK / peak));
}

/**
 * Index of the first sample louder than `threshold` (0 if none): generated files sometimes
 * start with silence, which would make a tap's sound arrive late.
 */
export function leadingSilence(samples: ArrayLike<number>, threshold: number): number {
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]!) > threshold) return i;
  return 0;
}

/** Music tracks are matched by loudness (RMS), not peak: factor towards `target`, 0.25–2×. */
export function loudnessGain(rms: number, target: number): number {
  if (!(rms > 0)) return 1;
  return Math.min(2, Math.max(0.25, target / rms));
}

/** Village tracks in play order: "village", "village-2", "village-3", … */
export function villagePlaylist(ids: readonly string[]): string[] {
  const n = (id: string) => (id === 'village' ? 1 : Number(id.slice('village-'.length)));
  return ids
    .filter((id) => id === 'village' || /^village-\d+$/.test(id))
    .sort((a, b) => n(a) - n(b));
}

/**
 * Whether a sound may play again: the same sound restarting within `minGapMs` (e.g. six
 * coins landing at once) would only sound louder and harsher.
 */
export function canReplay(lastAt: number | undefined, now: number, minGapMs: number): boolean {
  return lastAt === undefined || now - lastAt >= minGapMs;
}

/** Stored mute setting: "0" means muted; anything else (or nothing) means sound on. */
export function parseSoundOn(raw: string | null): boolean {
  return raw !== '0';
}

export interface AudioManifest {
  sfx: Partial<Record<SoundId, string>>;
  music: Record<string, string>;
}

/** Reads public/audio/sounds.json defensively: unknown ids and non-string files are dropped. */
export function parseAudioManifest(raw: string): AudioManifest {
  const empty: AudioManifest = { sfx: {}, music: {} };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!data || typeof data !== 'object') return empty;
  const pick = (v: unknown, keep: (k: string) => boolean) =>
    Object.fromEntries(
      Object.entries(v && typeof v === 'object' ? v : {}).filter(
        ([k, f]) => keep(k) && typeof f === 'string' && f.length > 0,
      ),
    ) as Record<string, string>;
  const obj = data as { sfx?: unknown; music?: unknown };
  return {
    sfx: pick(obj.sfx, (k) => (SOUND_IDS as readonly string[]).includes(k)),
    music: pick(obj.music, () => true),
  };
}
