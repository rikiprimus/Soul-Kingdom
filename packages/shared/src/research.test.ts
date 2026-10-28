import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  gameData,
  getResearchBonus,
  knownSecretClues,
  libraryLevel,
  researchQueueCapacity,
  researchRemaining,
  runAction,
  settleResearch,
  settleVillage,
  speedUpResearch,
  startResearch,
  techDef,
  techStatus,
  type PlayerState,
} from './index';
import { constructionTime } from './village';
import { soldierStats, serbuPowerCap } from './barracks';
import { foodToNextStage } from './monster';
import { healPercentPerMinute } from './healing';
import { deserializeState, serializeState } from './save';

const T0 = 1_700_000_000;

function withLibrary(level = 1, underConstruction = false): PlayerState {
  const s = createInitialState(T0, 10);
  s.resources.gold = 50_000;
  s.resources.soulCrystal = 500;
  s.resources.gems = 100;
  s.village.buildings.push({
    id: 'b_lib',
    type: 'perpustakaan',
    x: 4,
    y: 4,
    level: underConstruction ? 0 : level,
    construction: underConstruction ? { toLevel: level, endsAt: T0 + 1000 } : null,
    lastCollectAt: T0,
    crop: null,
  });
  return s;
}

describe('Tugas 1C.11: Perpustakaan & Riset', () => {
  it('detects library level and queue capacity correctly', () => {
    const s0 = createInitialState(T0, 10);
    expect(libraryLevel(s0)).toBe(0);
    expect(researchQueueCapacity(s0)).toBe(0);

    const sConstructing = withLibrary(1, true);
    expect(libraryLevel(sConstructing)).toBe(0);
    expect(researchQueueCapacity(sConstructing)).toBe(0);

    const s1 = withLibrary(1);
    expect(libraryLevel(s1)).toBe(1);
    expect(researchQueueCapacity(s1)).toBe(0);

    const s4 = withLibrary(4);
    expect(libraryLevel(s4)).toBe(4);
    expect(researchQueueCapacity(s4)).toBe(0);

    const s5 = withLibrary(5);
    expect(libraryLevel(s5)).toBe(5);
    expect(researchQueueCapacity(s5)).toBe(1);
  });

  it('determines tech status and unlock prerequisites', () => {
    const s1 = withLibrary(1);
    expect(techStatus(s1, 'manajemen-lumbung')).toBe('ready');
    // Tier 2 tech needs library Lv 2
    expect(techStatus(s1, 'efisiensi-tambang')).toBe('lockedLibrary');

    const s2 = withLibrary(2);
    // Tier 2 tech needs prerequisite tier 1 tech
    expect(techStatus(s2, 'efisiensi-tambang')).toBe('lockedPrereq');

    s2.research.completed.push('manajemen-lumbung');
    expect(techStatus(s2, 'manajemen-lumbung')).toBe('completed');
    expect(techStatus(s2, 'efisiensi-tambang')).toBe('ready');
  });

  it('starts active research and deducts cost', () => {
    const s1 = withLibrary(1);
    const def = techDef('manajemen-lumbung')!;
    expect(def).toBeDefined();
    const cost = def.cost;
    const initialGold = s1.resources.gold;
    const initialCrystal = s1.resources.soulCrystal;

    const res = startResearch(s1, 'manajemen-lumbung', T0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const next = res.state;
    expect(next.resources.gold).toBe(initialGold - cost.gold);
    expect(next.resources.soulCrystal).toBe(initialCrystal - cost.soulCrystal);
    expect(next.research.active).toEqual({
      techId: 'manajemen-lumbung',
      endsAt: T0 + def.seconds,
    });
    expect(next.research.queue).toEqual([]);
    expect(techStatus(next, 'manajemen-lumbung')).toBe('active');
    expect(researchRemaining(next, T0)).toBe(def.seconds);
  });

  it('prevents starting research when resources are insufficient', () => {
    const s1 = withLibrary(1);
    s1.resources.gold = 10;
    expect(startResearch(s1, 'manajemen-lumbung', T0)).toEqual({
      ok: false,
      error: 'notEnoughGold',
    });

    s1.resources.gold = 10_000;
    s1.resources.soulCrystal = 0;
    expect(startResearch(s1, 'manajemen-lumbung', T0)).toEqual({
      ok: false,
      error: 'notEnoughSoulCrystal',
    });
  });

  it('manages research queue with Perpustakaan level 5', () => {
    const s5 = withLibrary(5);

    // Start 1st active research (tier 1)
    const r1 = startResearch(s5, 'formasi-ketat', T0);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // Queue 2nd research (tier 1)
    const r2 = startResearch(r1.state, 'nutrisi-jiwa', T0);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    expect(r2.state.research.active?.techId).toBe('formasi-ketat');
    expect(r2.state.research.queue).toEqual(['nutrisi-jiwa']);
    expect(techStatus(r2.state, 'nutrisi-jiwa')).toBe('queued');

    // 3rd research fails because queue capacity is 1
    const r3 = startResearch(r2.state, 'manajemen-lumbung', T0);
    expect(r3).toEqual({ ok: false, error: 'researchSlotsFull' });
  });

  it('settles research progress and advances queue over time', () => {
    const s5 = withLibrary(5);
    const t1Sec = techDef('formasi-ketat')!.seconds;
    const t2Sec = techDef('nutrisi-jiwa')!.seconds;

    const r1 = startResearch(s5, 'formasi-ketat', T0);
    if (!r1.ok) return;
    const r2 = startResearch(r1.state, 'nutrisi-jiwa', T0);
    if (!r2.ok) return;

    const s = r2.state;
    // Before active finishes: no change
    expect(settleResearch(s, T0 + t1Sec - 1)).toBe(s);

    // When active finishes: 'formasi-ketat' completes and 'nutrisi-jiwa' advances to active
    const sAfter1 = settleResearch(s, T0 + t1Sec);
    expect(sAfter1.research.completed).toContain('formasi-ketat');
    expect(sAfter1.research.queue).toEqual([]);
    expect(sAfter1.research.active).toEqual({
      techId: 'nutrisi-jiwa',
      endsAt: T0 + t1Sec + t2Sec,
    });

    // When queued tech finishes: queue is empty and active is null
    const sAfterAll = settleResearch(sAfter1, T0 + t1Sec + t2Sec);
    expect(sAfterAll.research.completed).toContain('formasi-ketat');
    expect(sAfterAll.research.completed).toContain('nutrisi-jiwa');
    expect(sAfterAll.research.active).toBeNull();
  });

  it('speeds up active research using gems', () => {
    const s1 = withLibrary(1);
    const r1 = startResearch(s1, 'manajemen-lumbung', T0);
    if (!r1.ok) return;

    const initialGems = r1.state.resources.gems;
    const speedRes = speedUpResearch(r1.state, T0);
    expect(speedRes.ok).toBe(true);
    if (!speedRes.ok) return;

    expect(speedRes.state.research.completed).toContain('manajemen-lumbung');
    expect(speedRes.state.research.active).toBeNull();
    expect(speedRes.state.resources.gems).toBe(initialGems - speedRes.gems);
  });

  it('chains settleResearch seamlessly through settleVillage', () => {
    const s1 = withLibrary(1);
    const t1Sec = techDef('manajemen-lumbung')!.seconds;
    const r1 = startResearch(s1, 'manajemen-lumbung', T0);
    if (!r1.ok) return;

    const settled = settleVillage(r1.state, T0 + t1Sec);
    expect(settled.research.completed).toContain('manajemen-lumbung');
    expect(settled.research.active).toBeNull();
  });

  it('applies passive bonuses across game systems', () => {
    const s = withLibrary(5);
    s.research.completed.push(
      'manajemen-lumbung', // farmYieldBonus: 0.1, ranchYieldBonus: 0.1
      'efisiensi-tambang', // staffedYieldBonus: 0.1
      'keahlian-tukang', // buildTimeReduction: 0.1
      'kemakmuran-raya', // allProductionBonus: 0.15, marketGoldBonus: 0.2
      'formasi-ketat', // soldierHpBonus: 0.1
      'senjata-tempa', // soldierAtkBonus: 0.1, machineAtkBonus: 0.1
      'disiplin-militer', // militaryTrainTimeReduction: 0.15
      'panglima-perang', // serbuPowerCapBonus: 3, raidDefenseBonus: 0.1
      'nutrisi-jiwa', // feedCostReduction: 0.1
      'harmoni-jiwa', // monsterStatsBonus: 0.1, healingRateBonus: 1
    );

    // Research bonus calculations
    expect(getResearchBonus(s, 'farmYieldBonus')).toBeCloseTo(0.1);
    expect(getResearchBonus(s, 'ranchYieldBonus')).toBeCloseTo(0.1);
    expect(getResearchBonus(s, 'staffedYieldBonus')).toBeCloseTo(0.1);
    expect(getResearchBonus(s, 'allProductionBonus')).toBeCloseTo(0.15);
    expect(getResearchBonus(s, 'marketGoldBonus')).toBeCloseTo(0.2);
    expect(getResearchBonus(s, 'buildTimeReduction')).toBeCloseTo(0.1);
    expect(getResearchBonus(s, 'soldierHpBonus')).toBeCloseTo(0.1);
    expect(getResearchBonus(s, 'soldierAtkBonus')).toBeCloseTo(0.1);
    expect(getResearchBonus(s, 'militaryTrainTimeReduction')).toBeCloseTo(0.15);
    expect(getResearchBonus(s, 'serbuPowerCapBonus')).toBe(3);
    expect(getResearchBonus(s, 'feedCostReduction')).toBeCloseTo(0.1);
    expect(getResearchBonus(s, 'healingRateBonus')).toBeCloseTo(1);
    expect(getResearchBonus(s, 'monsterStatsBonus')).toBeCloseTo(0.1);

    // Build time reduction
    const baseTime = 100;
    const reducedTime = constructionTime(baseTime, 1, getResearchBonus(s, 'buildTimeReduction'));
    expect(reducedTime).toBe(90);

    // Soldier stats
    const sKind = { kind: 'pemanah', rank: 0 };
    const baseStats = soldierStats(sKind);
    const boostedStats = soldierStats(sKind, gameData, {
      hpBonus: getResearchBonus(s, 'soldierHpBonus'),
      atkBonus: getResearchBonus(s, 'soldierAtkBonus'),
    });
    expect(boostedStats.hp).toBeGreaterThan(baseStats.hp);
    expect(boostedStats.atk).toBeGreaterThan(baseStats.atk);

    // Serbu power cap
    const cap = serbuPowerCap(s);
    expect(cap).toBeGreaterThanOrEqual(13);

    // Feed cost reduction
    const babyMonster = { id: 'm1', form: 'kucing', element: 'api', stage: 'bayi', food: 0 };
    const baseFood = foodToNextStage(babyMonster);
    const discountedFood = foodToNextStage(
      babyMonster,
      gameData,
      getResearchBonus(s, 'feedCostReduction'),
    );
    expect(discountedFood).toBeLessThan(baseFood);

    // Healing rate
    const healRate = healPercentPerMinute(s);
    expect(healRate).toBeGreaterThan(gameData.rules.healing.basePercentPerMinute);
  });

  it('reveals secret altar recipe clues when rahasia-kuno-1 is researched', () => {
    const s = withLibrary(3);
    expect(knownSecretClues(s)).toEqual([]);

    s.research.completed.push('rahasia-kuno-1');
    const clues = knownSecretClues(s);
    expect(clues.length).toBeGreaterThan(0);
    expect(clues[0]).toHaveProperty('element');
    expect(clues[0]).toHaveProperty('pair');
  });

  it('migrates save data from v31 to v32', () => {
    const s = createInitialState(T0, 10);
    const serialized = serializeState(s);
    const raw = JSON.parse(serialized);
    delete raw.state.research;
    raw.schemaVersion = 31;

    const migrated = deserializeState(JSON.stringify(raw));
    expect(migrated.research).toEqual({
      active: null,
      queue: [],
      completed: [],
    });
  });

  it('supports server actions startResearch and speedUpResearch', () => {
    const s1 = withLibrary(1);
    const rStart = runAction(s1, 'startResearch', { techId: 'manajemen-lumbung' }, T0);
    expect(rStart.ok).toBe(true);
    if (!rStart.ok) return;

    expect(rStart.state.research.active?.techId).toBe('manajemen-lumbung');

    const rSpeed = runAction(rStart.state, 'speedUpResearch', {}, T0);
    expect(rSpeed.ok).toBe(true);
    if (!rSpeed.ok) return;
    expect(rSpeed.state.research.completed).toContain('manajemen-lumbung');
  });
});
