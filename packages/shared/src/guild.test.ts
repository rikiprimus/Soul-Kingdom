import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import { guildLevel, guildMaxMembers, guildSerbuRewardBonus } from './guild';
import { attackBase, type SerbuCell } from './serbu';
import { createInitialState, type PlayerState } from './state';
import { buildBuilding } from './village';

const T0 = 1_000_000;
const [firstBase] = gameData.rules.serbu.bases;
const adult = gameData.rules.growth.stages.at(-1)!.id;

function createTestState(guildLvl = 0, construction = false): PlayerState {
  const s = createInitialState(T0, 9);
  // Set high XP so level-up doesn't affect resource rewards
  s.xp = gameData.rules.player.levels.at(-1)!.xp;
  // Add a strong monster to win Serbu fights easily
  s.monsters.push({ id: 'm1', form: 'naga', element: 'api', stage: adult, food: 0 });

  if (guildLvl > 0) {
    s.village.buildings.push({
      id: 'g1',
      type: 'guild',
      x: 10,
      y: 10,
      level: guildLvl,
      construction: construction ? { toLevel: guildLvl + 1, endsAt: T0 + 1000 } : null,
      lastCollectAt: T0,
      crop: null,
    });
  }
  return s;
}

const at = (id: string, x = 0, y = 0): SerbuCell => ({ id, x, y });

describe('guild building & levels (Tugas 1C.12)', () => {
  it('detects guild level from village buildings', () => {
    const s0 = createTestState(0);
    expect(guildLevel(s0)).toBe(0);

    const s1 = createTestState(1);
    expect(guildLevel(s1)).toBe(1);

    const s3 = createTestState(3);
    expect(guildLevel(s3)).toBe(3);

    const sUnderConstruction = createTestState(2, true);
    expect(guildLevel(sUnderConstruction)).toBe(0);
  });

  it('provides max members by level (10 to 30)', () => {
    expect(guildMaxMembers(0)).toBe(0);
    expect(guildMaxMembers(1)).toBe(10);
    expect(guildMaxMembers(2)).toBe(15);
    expect(guildMaxMembers(3)).toBe(20);
    expect(guildMaxMembers(4)).toBe(25);
    expect(guildMaxMembers(5)).toBe(30);
    expect(guildMaxMembers(6)).toBe(30);
  });

  it('provides Serbu reward bonus by level (+0% to +20%)', () => {
    expect(guildSerbuRewardBonus(0)).toBe(0);
    expect(guildSerbuRewardBonus(1)).toBe(0);
    expect(guildSerbuRewardBonus(2)).toBe(0.05);
    expect(guildSerbuRewardBonus(3)).toBe(0.1);
    expect(guildSerbuRewardBonus(4)).toBe(0.15);
    expect(guildSerbuRewardBonus(5)).toBe(0.2);
    expect(guildSerbuRewardBonus(6)).toBe(0.2);
  });

  it('applies reward bonus to Serbu victory rewards', () => {
    const baseReward = firstBase!.firstReward;

    // Without guild: base reward
    const sNoGuild = createTestState(0);
    const r0 = attackBase(sNoGuild, { baseId: firstBase!.id, cells: [at('m1', 2, 3)] }, T0);
    expect(r0.ok).toBe(true);
    if (!r0.ok) return;
    expect(r0.result.won).toBe(true);
    expect(r0.result.reward.gold).toBe(baseReward.gold);
    expect(r0.result.reward.food).toBe(baseReward.food);

    // With Guild Lv 1: 0% bonus (same as base)
    const sGuild1 = createTestState(1);
    const r1 = attackBase(sGuild1, { baseId: firstBase!.id, cells: [at('m1', 2, 3)] }, T0);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.result.reward.gold).toBe(baseReward.gold);

    // With Guild Lv 2: +5% bonus
    const sGuild2 = createTestState(2);
    const r2 = attackBase(sGuild2, { baseId: firstBase!.id, cells: [at('m1', 2, 3)] }, T0);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.result.reward.gold).toBe(Math.round(baseReward.gold * 1.05));
    expect(r2.result.reward.food).toBe(Math.round(baseReward.food * 1.05));

    // With Guild Lv 5: +20% bonus
    const sGuild5 = createTestState(5);
    const r5 = attackBase(sGuild5, { baseId: firstBase!.id, cells: [at('m1', 2, 3)] }, T0);
    expect(r5.ok).toBe(true);
    if (!r5.ok) return;
    expect(r5.result.reward.gold).toBe(Math.round(baseReward.gold * 1.2));
    expect(r5.result.reward.food).toBe(Math.round(baseReward.food * 1.2));
  });

  it('requires Balai Utama level 3 to build Guild', () => {
    const sBalai1 = createInitialState(T0, 1);
    sBalai1.resources.gold = 100_000;
    sBalai1.resources.wood = 100_000;

    // At Balai 1, maxCount is 0 -> cannot build
    const res1 = buildBuilding(sBalai1, { type: 'guild', x: 18, y: 18, workers: 1 }, T0);
    expect(res1.ok).toBe(false);

    // Set Balai to 3 -> can build
    const hall = sBalai1.village.buildings.find((b) => b.type === gameData.townHallId)!;
    hall.level = 3;
    const res3 = buildBuilding(sBalai1, { type: 'guild', x: 18, y: 18, workers: 1 }, T0);
    expect(res3.ok).toBe(true);
  });
});
