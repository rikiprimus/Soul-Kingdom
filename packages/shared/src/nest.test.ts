import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { formTierOf, rarityOf } from './monster';
import {
  addSoulEggs,
  careSoulEgg,
  hatchSoulEgg,
  rollSoulEgg,
  soulEggStatus,
  type SoulEgg,
} from './nest';
import { claimQuest } from './quests';
import { createRng } from './rng';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { populationFree } from './workers';

const T0 = 1_000_000;
const { steps, hatch } = gameData.rules.nest;
const NEST = [...gameData.buildingById.values()].find((b) => b.feature === 'nest')!.id;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** A new game with a finished nest, plenty of food and two Telur Jiwa. */
function withNest(): PlayerState {
  const s = createInitialState(T0, 5);
  s.village.buildings.push({
    id: 'nest',
    type: NEST,
    x: 0,
    y: 0,
    level: 1,
    construction: null,
    lastCollectAt: T0,
    crop: null,
  });
  s.resources.food = 1_000_000;
  addSoulEggs(s, 2);
  return s;
}

/** Runs every care step of egg `id`, each right when the last one ends; returns the time it is ready. */
function careAll(s: PlayerState, id: string): { state: PlayerState; at: number } {
  let at = T0;
  for (const step of steps) {
    s = ok(careSoulEgg(s, id, at)).state;
    at += step.seconds;
  }
  return { state: s, at };
}

describe('caring for a Telur Jiwa', () => {
  it('needs a finished nest', () => {
    const s = withNest();
    s.village.buildings = s.village.buildings.filter((b) => b.id !== 'nest');
    expect(careSoulEgg(s, s.soulEggs[0]!.id, T0)).toEqual({ ok: false, error: 'notUnlocked' });
  });

  it('goes through every step: pay food, wait, next step, then ready', () => {
    let s = withNest();
    const id = s.soulEggs[0]!.id;
    const egg = () => s.soulEggs.find((e) => e.id === id)!;
    expect(soulEggStatus(egg(), T0)).toBe('waiting');
    let at = T0;
    for (const [i, step] of steps.entries()) {
      const food = s.resources.food;
      s = ok(careSoulEgg(s, id, at)).state;
      expect(s.resources.food).toBe(food - step.food);
      expect(egg()).toEqual({ id, step: i + 1, endsAt: at + step.seconds });
      expect(soulEggStatus(egg(), at + step.seconds - 1)).toBe('caring');
      expect(careSoulEgg(s, id, at + step.seconds - 1)).toEqual({ ok: false, error: 'notReady' });
      at += step.seconds;
      expect(soulEggStatus(egg(), at)).toBe(i === steps.length - 1 ? 'ready' : 'nextStep');
    }
    expect(careSoulEgg(s, id, at)).toEqual({ ok: false, error: 'alreadyFinished' });
  });

  it('cares for one egg at a time and needs the food', () => {
    const s = withNest();
    const [a, b] = s.soulEggs;
    const started = ok(careSoulEgg(s, a!.id, T0)).state;
    expect(careSoulEgg(started, b!.id, T0)).toEqual({ ok: false, error: 'slotsFull' });
    const poor = deepClone(s);
    poor.resources.food = steps[0]!.food - 1;
    expect(careSoulEgg(poor, a!.id, T0)).toEqual({ ok: false, error: 'notEnoughFood' });
  });
});

describe('hatching a Telur Jiwa', () => {
  it('only when ready; then a baby joins, the nest is free and it counts as hatching', () => {
    const s = withNest();
    const id = s.soulEggs[0]!.id;
    expect(hatchSoulEgg(s, id, T0)).toEqual({ ok: false, error: 'notReady' });
    const { state, at } = careAll(s, id);
    expect(hatchSoulEgg(state, id, at - 1)).toEqual({ ok: false, error: 'notReady' });
    const r = ok(hatchSoulEgg(state, id, at));
    expect(r.monster.stage).toBe(gameData.rules.growth.stages[0]!.id);
    expect(r.state.monsters).toContainEqual(r.monster);
    expect(r.state.pedia.monsters).toContain(
      r.monster.species ?? `${r.monster.form}:${r.monster.element}`,
    );
    expect(r.state.soulEggs.map((e) => e.id)).not.toContain(id);
    expect(r.state.actions.hatch).toBe(state.actions.hatch + 1);
    expect(['langka', 'epik']).toContain(rarityOf(r.monster));
    // The nest is free for the next egg.
    expect(careSoulEgg(r.state, r.state.soulEggs[0]!.id, at).ok).toBe(true);
    // Same state and time, same monster.
    expect(hatchSoulEgg(deepClone(state), id, at)).toEqual(r);
  });

  it('needs room in the population', () => {
    const s = withNest();
    const id = s.soulEggs[0]!.id;
    const { state, at } = careAll(s, id);
    while (populationFree(state) > 0)
      state.workers.push({ id: `w${state.workers.length + 100}`, task: { kind: 'idle' } });
    expect(hatchSoulEgg(state, id, at)).toEqual({ ok: false, error: 'populationFull' });
  });

  it('is at least langka, sometimes epik, at the data odds (Monte Carlo)', () => {
    const rng = createRng(77);
    const n = 100_000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const kind = rollSoulEgg(rng);
      const rarity = rarityOf(kind);
      counts[rarity] = (counts[rarity] ?? 0) + 1;
      const outcome = hatch.find((h) => h.rarity === rarity)!;
      expect(formTierOf(kind)).toBe(outcome.formTier);
      expect(gameData.elementById.has(kind.element!)).toBe(true);
    }
    expect(counts.biasa ?? 0).toBe(0);
    for (const h of hatch)
      expect(Math.abs((counts[h.rarity] ?? 0) / n - h.chance)).toBeLessThan(0.006);
  });
});

describe('eggs from quests and saves', () => {
  it('a quest with a Telur Jiwa reward adds it', () => {
    const index = gameData.quests.chain.findIndex((q) => q.reward.soulEggs > 0);
    const quest = gameData.quests.chain[index]!;
    const s = withNest();
    s.soulEggs = [];
    s.quest = { index, start: { ...s.actions } };
    // Every goal of this quest is a building one: the nest is already built.
    expect(quest.goals.every((g) => g.kind === 'building' && g.building === NEST)).toBe(true);
    const r = ok(claimQuest(s));
    expect(r.state.soulEggs).toHaveLength(quest.reward.soulEggs);
    expect(r.state.soulEggs[0]).toMatchObject({ step: 0, endsAt: null } satisfies Partial<SoulEgg>);
  });

  it('keeps eggs in a save; old saves have none', () => {
    const s = withNest();
    const started = ok(careSoulEgg(s, s.soulEggs[0]!.id, T0)).state;
    expect(deserializeState(serializeState(started)).soulEggs).toEqual(started.soulEggs);
    const old: Partial<PlayerState> = deepClone(started);
    delete old.soulEggs;
    const v20 = deserializeState(JSON.stringify({ schemaVersion: 20, state: old }));
    expect(v20.soulEggs).toEqual([]);
  });
});
