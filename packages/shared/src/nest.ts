import { deepClone } from './clone';
import { gameData, type GameData } from './data';
import { monsterKey, type Monster, type MonsterKind } from './monster';
import { recordAction } from './player';
import { createRng, type Rng } from './rng';
import type { ActionError, ActionResult, PlayerState } from './state';
import { hasFeature } from './village';
import { hasRoomFor } from './workers';

/**
 * A Telur Jiwa from a quest reward. `step` = care steps started; the step running ends at
 * `endsAt`. It is ready once every step has started and the last timer is over.
 */
export interface SoulEgg {
  id: string;
  step: number;
  endsAt: number | null;
}

export type SoulEggStatus = 'waiting' | 'caring' | 'nextStep' | 'ready';

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export function soulEggStatus(egg: SoulEgg, now: number, data: GameData = gameData): SoulEggStatus {
  if (egg.step === 0) return 'waiting';
  if (egg.endsAt !== null && egg.endsAt > now) return 'caring';
  return egg.step >= data.rules.nest.steps.length ? 'ready' : 'nextStep';
}

/** The egg being cared for in the nest (one at a time), if any. */
export function eggInNest(state: PlayerState): SoulEgg | undefined {
  return state.soulEggs.find((e) => e.step > 0);
}

/** Adds `count` new Telur Jiwa to a state being built (mutates it). */
export function addSoulEggs(state: PlayerState, count: number): void {
  for (let i = 0; i < count; i++) {
    state.soulEggs.push({ id: `s${state.nextId}`, step: 0, endsAt: null });
    state.nextId += 1;
  }
}

/** Pays the food of the egg's next care step and starts its timer (the first one puts it in the nest). */
export function careSoulEgg(
  state: PlayerState,
  eggId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ food: number }> {
  if (!hasFeature(state, 'nest', data)) return fail('notUnlocked');
  const egg = state.soulEggs.find((e) => e.id === eggId);
  if (!egg) return fail('entryNotFound');
  const status = soulEggStatus(egg, now, data);
  if (status === 'caring') return fail('notReady');
  if (status === 'ready') return fail('alreadyFinished');
  if (status === 'waiting' && eggInNest(state)) return fail('slotsFull');
  const step = data.rules.nest.steps[egg.step]!;
  if (state.resources.food < step.food) return fail('notEnoughFood');
  const next = deepClone(state);
  const e = next.soulEggs.find((x) => x.id === eggId)!;
  next.resources.food -= step.food;
  e.step += 1;
  e.endsAt = now + step.seconds;
  return { ok: true, state: next, food: step.food };
}

/** Rolls what a Telur Jiwa hatches into: rarity by chance, then a form and a plain element. */
export function rollSoulEgg(rng: Rng, data: GameData = gameData): MonsterKind {
  const { hatch } = data.rules.nest;
  let roll = rng.next();
  const outcome = hatch.find((h) => (roll -= h.chance) < 0) ?? hatch[hatch.length - 1]!;
  const tier = outcome.formTier;
  const eggSpecies = (data.monstersByTier.get(tier) ?? []).filter((m) =>
    m.sources.includes('telur'),
  );
  const pool = eggSpecies.length > 0 ? eggSpecies : (data.monstersByTier.get(tier) ?? []);
  if (pool.length > 0) {
    const picked = rng.pick(pool);
    return {
      species: picked.id,
      form: picked.id,
      element: picked.element,
    };
  }
  const forms = data.formsByTier.get(outcome.formTier) ?? [];
  const form = forms.length > 0 ? rng.pick(forms).id : 'kucing';
  return {
    species: form,
    form,
    element: 'air',
  };
}

/** Hatches a fully cared-for egg into a baby monster; it needs room in the population. */
export function hatchSoulEgg(
  state: PlayerState,
  eggId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ monster: Monster }> {
  const egg = state.soulEggs.find((e) => e.id === eggId);
  if (!egg) return fail('entryNotFound');
  if (soulEggStatus(egg, now, data) !== 'ready') return fail('notReady');
  const next = deepClone(state);
  const rng = createRng(next.rngState);
  const kind = rollSoulEgg(rng, data);
  if (!hasRoomFor(kind, state, data)) return fail('populationFull');
  next.rngState = rng.getState();
  const species =
    'species' in kind && kind.species
      ? kind.species
      : (('form' in kind ? kind.form : '') ?? 'baby-slime');
  const def = data.monsterById.get(species);
  const monster: Monster = {
    id: `m${next.nextId}`,
    species,
    form: 'form' in kind ? kind.form : species,
    element: 'element' in kind && kind.element ? kind.element : def?.element,
    stage: data.rules.growth.stages[0]!.id,
    food: 0,
  };
  next.nextId += 1;
  next.monsters.push(monster);
  const key = monsterKey(monster);
  if (!next.pedia.monsters.includes(key)) next.pedia.monsters.push(key);
  next.soulEggs = next.soulEggs.filter((e) => e.id !== eggId);
  recordAction(next, 'hatch', 1, data);
  return { ok: true, state: next, monster };
}
