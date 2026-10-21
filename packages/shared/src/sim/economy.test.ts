import { describe, expect, it } from 'vitest';
import { DEFAULT_SIM_PLAYER, formatSimTime, simulateEconomy } from './economy';

const short = { ...DEFAULT_SIM_PLAYER, days: 4 };

describe('economy simulation', () => {
  const report = simulateEconomy(short);

  // Owner (2026-10-21): with chasing enemies and ambushes the pace is about four days.
  it('reaches the Soul Mixer level (Balai Lv 4) within about four days of normal play', () => {
    const hall4 = report.milestones.find((m) => m.label === 'Balai Utama Lv 4');
    expect(hall4).toBeDefined();
    expect(hall4!.at).toBeLessThanOrEqual(4 * 86_400);
    // …but not on the very first day.
    expect(hall4!.at).toBeGreaterThan(86_400);
  });

  it('reports every day with sane numbers', () => {
    expect(report.days).toHaveLength(short.days);
    for (const d of report.days) {
      expect(d.workers).toBeGreaterThan(0);
      expect(d.monsterSlots + d.workers).toBeLessThanOrEqual(d.populationCap);
      for (const v of Object.values(d.earned)) expect(v).toBeGreaterThanOrEqual(0);
    }
    for (const v of Object.values(report.final.resources)) expect(v).toBeGreaterThanOrEqual(0);
    const times = report.milestones.map((m) => m.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('is deterministic for a seed', () => {
    const again = simulateEconomy(short);
    expect(again.milestones).toEqual(report.milestones);
    expect(again.days).toEqual(report.days);
  });

  it('formats times as day and clock', () => {
    expect(formatSimTime(0)).toBe('hari 1, 00:00');
    expect(formatSimTime(86_400 + 18 * 3600 + 5 * 60)).toBe('hari 2, 18:05');
  });
});
