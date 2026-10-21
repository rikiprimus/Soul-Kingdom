import Phaser from 'phaser';
import {
  SOUND_IDS,
  canReplay,
  leadingSilence,
  levelGain,
  loudnessGain,
  parseAudioManifest,
  parseSoundOn,
  renderSound,
  villagePlaylist,
  type SoundId,
} from './synth';

/**
 * Sound effects and music. Effects listed in public/audio/sounds.json (e.g. made with Ludo.ai,
 * see docs/SUARA.md) load with the game; every effect without a file gets a sound synthesised
 * in code, so the game always has sound and a recorded file simply replaces it. Music files
 * are large, so they load in the background once the village is on screen.
 */

const STORAGE_KEY = 'soul-monster:sound';
const MANIFEST_KEY = 'audio-index';
const sfxKey = (id: SoundId) => `sfx:${id}`;
const musicKey = (id: string) => `music:${id}`;

/** Mix levels: frequent sounds sit lower so they never tire the ear. */
const VOLUME: Record<SoundId, number> = {
  click: 0.35,
  tap: 0.3,
  collect: 0.45,
  coin: 0.35,
  pickup: 0.35,
  place: 0.6,
  'build-done': 0.55,
  gather: 0.45,
  ready: 0.5,
  error: 0.45,
  win: 0.6,
  lose: 0.55,
  mixer: 0.55,
  hatch: 0.6,
  panel: 0.3,
  'unlock-land': 0.6,
  grow: 0.55,
  march: 0.55,
  revive: 0.55,
  prophecy: 0.5,
  'rare-hatch': 0.6,
  enemy: 0.4,
};
/** Village tracks play one after another at this volume, after loudness matching. */
const MUSIC_VOLUME = 0.3;
/** Quiet ambience bed (birds, breeze) looping under the music. */
const AMBIENCE_VOLUME = 0.35;
/** Loudness (RMS) every village track is matched to before MUSIC_VOLUME. */
const MUSIC_RMS_TARGET = 0.08;
/** Below this level a recorded effect's opening counts as silence (skipped when played). */
const SILENCE = 0.02;
/** The same sound will not restart within this many ms (several coins landing at once). */
const MIN_GAP_MS = 60;

const lastPlayed = new Map<SoundId, number>();
/** Level correction per recorded file (synthesised sounds are already at `PEAK`). */
const fileGain = new Map<SoundId, number>();
/** Seconds of silence at the start of a recorded effect, skipped when it plays. */
const fileStart = new Map<SoundId, number>();
/** Music files from the manifest, loaded after the village appears. */
let musicFiles: Record<string, string> = {};
/** Loudness correction per village track. */
const musicGain = new Map<string, number>();
let soundOn = (() => {
  try {
    return parseSoundOn(localStorage.getItem(STORAGE_KEY));
  } catch {
    return true;
  }
})();

export function isSoundOn(): boolean {
  return soundOn;
}

/** Turns all sound on or off and remembers the choice in this browser. */
export function setSoundOn(game: Phaser.Game, on: boolean): void {
  soundOn = on;
  game.sound.mute = !on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Storage unavailable: the choice lasts for this session only.
  }
}

/**
 * Preload step: reads audio/sounds.json as text (a missing file is answered with HTML by
 * the dev server, which just means "no recorded sounds") and queues the files it lists.
 */
export function preloadSounds(scene: Phaser.Scene): void {
  scene.load.text(MANIFEST_KEY, 'audio/sounds.json');
  scene.load.once(
    `filecomplete-text-${MANIFEST_KEY}`,
    (_key: string, _type: string, raw: unknown) => {
      const manifest = parseAudioManifest(String(raw));
      for (const [id, file] of Object.entries(manifest.sfx)) {
        scene.load.audio(sfxKey(id as SoundId), `audio/${file}`);
      }
      musicFiles = manifest.music;
    },
  );
}

/** After loading: synthesises every effect that has no recorded file, and applies mute. */
export function prepareSounds(scene: Phaser.Scene): void {
  const manager = scene.sound;
  manager.mute = !soundOn;
  // Synthesis needs Web Audio; without it (very old browsers) only recorded files play.
  if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) return;
  const ctx = manager.context;
  for (const id of SOUND_IDS) {
    const key = sfxKey(id);
    const recorded: unknown = scene.cache.audio.get(key);
    if (recorded instanceof AudioBuffer) {
      // Recorded files come at different levels: bring each to the synthesised peak.
      let peak = 0;
      for (let c = 0; c < recorded.numberOfChannels; c++) {
        for (const s of recorded.getChannelData(c)) peak = Math.max(peak, Math.abs(s));
      }
      fileGain.set(id, levelGain(peak));
      const lead = leadingSilence(recorded.getChannelData(0), SILENCE);
      // Keep 10 ms before the first sound so its attack is not cut.
      const start = lead / recorded.sampleRate - 0.01;
      if (start > 0.03) fileStart.set(id, start);
      continue;
    }
    if (recorded) continue;
    const samples = renderSound(id, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    scene.cache.audio.add(key, buffer);
  }
}

/** Plays an effect (quietly skipped if audio is unavailable or the same sound just played). */
export function playSfx(scene: Phaser.Scene, id: SoundId): void {
  if (!soundOn) return;
  const key = sfxKey(id);
  if (!scene.cache.audio.exists(key)) return;
  const now = performance.now();
  if (!canReplay(lastPlayed.get(id), now, MIN_GAP_MS)) return;
  lastPlayed.set(id, now);
  scene.sound.play(key, {
    volume: VOLUME[id] * (fileGain.get(id) ?? 1),
    seek: fileStart.get(id) ?? 0,
  });
}

/**
 * Loads the music listed in the manifest in the background (the village is already
 * playable), then starts it. Safe to call again: loaded tracks are not fetched twice.
 */
export function loadMusic(scene: Phaser.Scene): void {
  const missing = Object.entries(musicFiles).filter(
    ([id]) => !scene.cache.audio.exists(musicKey(id)),
  );
  if (missing.length === 0) {
    startMusic(scene);
    return;
  }
  for (const [id, file] of missing) scene.load.audio(musicKey(id), `audio/${file}`);
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => startMusic(scene));
  scene.load.start();
}

/** Root-mean-square level of a decoded track (first channel). */
function rmsOf(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  // Every 16th sample is plenty for a level estimate of a two-minute track.
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    sum += data[i]! * data[i]!;
    n++;
  }
  return n > 0 ? Math.sqrt(sum / n) : 0;
}

/**
 * Starts the ambience loop and the village playlist (tracks in turn, starting from a random
 * one, each matched in loudness). Does nothing for parts that are already playing.
 */
export function startMusic(scene: Phaser.Scene): void {
  const manager = scene.sound;
  const playing = (key: string) => manager.getAll(key).some((s) => s.isPlaying);
  const ambience = musicKey('ambience');
  if (scene.cache.audio.exists(ambience) && !playing(ambience)) {
    manager.play(ambience, { loop: true, volume: AMBIENCE_VOLUME });
  }
  const tracks = villagePlaylist(Object.keys(musicFiles)).filter((id) =>
    scene.cache.audio.exists(musicKey(id)),
  );
  if (tracks.length === 0 || tracks.some((id) => playing(musicKey(id)))) return;
  for (const id of tracks) {
    if (musicGain.has(id)) continue;
    const buffer: unknown = scene.cache.audio.get(musicKey(id));
    musicGain.set(
      id,
      buffer instanceof AudioBuffer ? loudnessGain(rmsOf(buffer), MUSIC_RMS_TARGET) : 1,
    );
  }
  const playTrack = (i: number) => {
    const id = tracks[i % tracks.length]!;
    const sound = manager.add(musicKey(id), { volume: MUSIC_VOLUME * (musicGain.get(id) ?? 1) });
    sound.once(Phaser.Sound.Events.COMPLETE, () => {
      sound.destroy();
      playTrack(i + 1);
    });
    sound.play();
  };
  playTrack(Math.floor(Math.random() * tracks.length));
}
