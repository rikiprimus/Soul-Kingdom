import { describe, expect, it } from 'vitest';
import {
  PEAK,
  RECIPES,
  SOUND_IDS,
  canReplay,
  leadingSilence,
  levelGain,
  loudnessGain,
  villagePlaylist,
  parseAudioManifest,
  parseSoundOn,
  renderSound,
} from './synth';

describe('renderSound', () => {
  it.each(SOUND_IDS)('%s renders a short, audible, clipped-free sound', (id) => {
    const rate = 44100;
    const samples = renderSound(id, rate);
    const seconds = samples.length / rate;
    expect(seconds).toBeGreaterThan(0.04);
    expect(seconds).toBeLessThan(1.2);
    let peak = 0;
    for (const s of samples) {
      expect(Number.isFinite(s)).toBe(true);
      peak = Math.max(peak, Math.abs(s));
    }
    expect(peak).toBeCloseTo(PEAK, 5);
  });

  it('lasts as long as its last note, at any sample rate', () => {
    for (const rate of [22050, 48000]) {
      const end = Math.max(...RECIPES['build-done'].map((n) => n.at + n.dur));
      expect(renderSound('build-done', rate).length).toBe(Math.ceil(end * rate) + 1);
    }
  });

  it('is deterministic, noise included', () => {
    expect(renderSound('gather', 44100)).toEqual(renderSound('gather', 44100));
  });

  it('fades out instead of ending with a click', () => {
    const samples = renderSound('coin', 44100);
    const tail = samples.subarray(samples.length - 40);
    for (const s of tail) expect(Math.abs(s)).toBeLessThan(0.05);
  });
});

describe('levelGain', () => {
  it('brings a file to the synthesised peak, within limits', () => {
    expect(levelGain(PEAK)).toBe(1);
    expect(levelGain(0.4)).toBeCloseTo(2, 5);
    expect(levelGain(0.1)).toBe(4);
    expect(levelGain(1)).toBeCloseTo(0.8, 5);
    expect(levelGain(0)).toBe(1);
  });
});

describe('leadingSilence', () => {
  it('finds the first audible sample', () => {
    expect(leadingSilence([0, 0.001, -0.002, 0.5, 0.2], 0.01)).toBe(3);
    expect(leadingSilence([0.3, 0], 0.01)).toBe(0);
    expect(leadingSilence([0, 0, 0], 0.01)).toBe(0);
  });
});

describe('loudnessGain', () => {
  it('moves a track towards the target loudness, within limits', () => {
    expect(loudnessGain(0.1, 0.1)).toBe(1);
    expect(loudnessGain(0.2, 0.1)).toBeCloseTo(0.5, 5);
    expect(loudnessGain(1, 0.1)).toBe(0.25);
    expect(loudnessGain(0.01, 0.1)).toBe(2);
    expect(loudnessGain(0, 0.1)).toBe(1);
  });
});

describe('villagePlaylist', () => {
  it('orders the village tracks and leaves other loops out', () => {
    expect(villagePlaylist(['ambience', 'village-3', 'village', 'village-2', 'villagex'])).toEqual([
      'village',
      'village-2',
      'village-3',
    ]);
    expect(villagePlaylist(['ambience'])).toEqual([]);
  });
});

describe('canReplay', () => {
  it('allows the first play and plays spaced at least the gap apart', () => {
    expect(canReplay(undefined, 0, 60)).toBe(true);
    expect(canReplay(1000, 1059, 60)).toBe(false);
    expect(canReplay(1000, 1060, 60)).toBe(true);
  });
});

describe('parseSoundOn', () => {
  it('is on unless the player turned it off', () => {
    expect(parseSoundOn(null)).toBe(true);
    expect(parseSoundOn('1')).toBe(true);
    expect(parseSoundOn('0')).toBe(false);
  });
});

describe('parseAudioManifest', () => {
  it('keeps known effects and any music track with a file name', () => {
    const m = parseAudioManifest(
      JSON.stringify({
        sfx: { coin: 'coin.mp3', unknown: 'x.mp3', click: '', tap: 3 },
        music: { village: 'village.ogg', bad: null },
      }),
    );
    expect(m).toEqual({ sfx: { coin: 'coin.mp3' }, music: { village: 'village.ogg' } });
  });

  it('treats a missing or broken file (an HTML page) as no recorded sounds', () => {
    expect(parseAudioManifest('<!doctype html>')).toEqual({ sfx: {}, music: {} });
    expect(parseAudioManifest('[]')).toEqual({ sfx: {}, music: {} });
    expect(parseAudioManifest('null')).toEqual({ sfx: {}, music: {} });
  });
});
