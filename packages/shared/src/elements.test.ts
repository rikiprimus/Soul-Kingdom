import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import { elementAdvantage, elementAdvantageScore, elementUnits } from './elements';
import { monsterStats, powerPointsOf, rarityOf } from './monster';

describe('13-element cycle & advantage', () => {
  it('implements 8-element natural cycle (Api -> Nature -> Tanah -> Lightning -> Air -> Magma -> Ice -> Angin -> Api)', () => {
    const cycle = [
      ['api', 'nature'],
      ['nature', 'tanah'],
      ['tanah', 'lightning'],
      ['lightning', 'air'],
      ['air', 'magma'],
      ['magma', 'ice'],
      ['ice', 'angin'],
      ['angin', 'api'],
    ] as const;

    for (const [attacker, defender] of cycle) {
      expect(elementAdvantageScore(attacker, defender)).toBe(1);
      expect(elementAdvantage(attacker, defender)).toBe(1 + gameData.rules.battle.advantageStep);

      // Reverse is disadvantaged
      expect(elementAdvantageScore(defender, attacker)).toBe(-1);
      expect(elementAdvantage(defender, attacker)).toBe(1 - gameData.rules.battle.advantageStep);
    }
  });

  it('implements 4-element cosmic cycle (Light -> Dark -> Arcane -> Void -> Light)', () => {
    const cycle = [
      ['light', 'dark'],
      ['dark', 'arcane'],
      ['arcane', 'void'],
      ['void', 'light'],
    ] as const;

    for (const [attacker, defender] of cycle) {
      expect(elementAdvantageScore(attacker, defender)).toBe(1);
      expect(elementAdvantage(attacker, defender)).toBe(1 + gameData.rules.battle.advantageStep);

      // Reverse is disadvantaged
      expect(elementAdvantageScore(defender, attacker)).toBe(-1);
      expect(elementAdvantage(defender, attacker)).toBe(1 - gameData.rules.battle.advantageStep);
    }
  });

  it('normal is neutral against every element', () => {
    const all = gameData.elements.elements.map((e) => e.id);
    for (const el of all) {
      expect(elementAdvantageScore('normal', el)).toBe(0);
      expect(elementAdvantageScore(el, 'normal')).toBe(0);
      expect(elementAdvantage('normal', el)).toBe(1);
      expect(elementAdvantage(el, 'normal')).toBe(1);
    }
  });

  it('cross-cycle encounters and mirror matches are neutral', () => {
    expect(elementAdvantageScore('api', 'light')).toBe(0);
    expect(elementAdvantageScore('void', 'tanah')).toBe(0);
    expect(elementAdvantageScore('ice', 'ice')).toBe(0);
    expect(elementAdvantage('magma', 'magma')).toBe(1);
  });

  it('respects the damage multiplier bounds [advantageMin, advantageMax]', () => {
    const { advantageMin, advantageMax } = gameData.rules.battle;
    const ids = gameData.elements.elements.map((e) => e.id);
    let max = -Infinity;
    let min = Infinity;
    for (const a of ids) {
      for (const d of ids) {
        const m = elementAdvantage(a, d);
        max = Math.max(max, m);
        min = Math.min(min, m);
      }
    }
    expect(max).toBeLessThanOrEqual(advantageMax);
    expect(min).toBeGreaterThanOrEqual(advantageMin);
  });

  it('elementUnits returns [id] for atomic elements', () => {
    expect(elementUnits('api')).toEqual(['api']);
    expect(elementUnits('light')).toEqual(['light']);
  });
});

describe('monster logic: rarity, stats, powerPoints', () => {
  it('rarityOf follows species tier (1..8)', () => {
    // Tier 1-2: biasa
    expect(rarityOf({ species: 'baby-slime' })).toBe('biasa'); // tier 1
    // Tier 3-4: langka
    expect(rarityOf({ species: 'orc-berserker' })).toBe('langka'); // tier 3
    // Tier 5-6: epik
    expect(rarityOf({ species: 'wyvern' })).toBe('epik'); // tier 5
    // Tier 7-8: legenda
    expect(rarityOf({ species: 'bahamut' })).toBe('legenda'); // tier 7
  });

  it('powerPointsOf matches rules.json for tier 1..8 (1, 2, 3, 5, 8, 12, 18, 25)', () => {
    expect(powerPointsOf({ species: 'baby-slime' })).toBe(1); // T1
    expect(powerPointsOf({ species: 'orc-berserker' })).toBe(3); // T3
    expect(powerPointsOf({ species: 'wyvern' })).toBe(8); // T5
    expect(powerPointsOf({ species: 'bahamut' })).toBe(18); // T7
  });

  it('monsterStats scales with species tier, role, and stage', () => {
    // baby-slime: T1, role: penahan (base hp 160, atk 12, def 14, spd 8, range 1)
    const baby = monsterStats({ species: 'baby-slime', stage: 'bayi' });
    expect(baby.spd).toBe(8);
    expect(baby.range).toBe(1);
    expect(baby.hp).toBe(Math.round(160 * 1 * 0.4)); // 64
    expect(baby.atk).toBe(Math.round(12 * 1 * 0.4)); // 5

    const adult = monsterStats({ species: 'baby-slime', stage: 'dewasa' });
    expect(adult.hp).toBe(160);
    expect(adult.atk).toBe(12);
    expect(adult.def).toBe(14);
  });
});
