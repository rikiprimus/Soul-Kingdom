import { deepClone } from './clone';
import { gameData, type GameData, type ResearchTech } from './data';
import { speedUpCost, type ActionError, type ActionResult, type PlayerState } from './state';
import { allBuildings, levelDef } from './village';

// Perpustakaan & Riset (Tugas 1C.11).

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

/** Highest finished Perpustakaan level on any island (0 when there is none). */
export function libraryLevel(state: PlayerState, data: GameData = gameData): number {
  return allBuildings(state)
    .filter((b) => data.buildingById.get(b.type)?.feature === 'research')
    .reduce((best, b) => Math.max(best, b.level), 0);
}

/** Extra queue capacity for research beyond the active one (Perpustakaan Lv 5 gives +1). */
export function researchQueueCapacity(state: PlayerState, data: GameData = gameData): number {
  const level = libraryLevel(state, data);
  if (level <= 0) return 0;
  const bldg = allBuildings(state).find(
    (b) => b.level === level && data.buildingById.get(b.type)?.feature === 'research',
  );
  const def = bldg ? levelDef(bldg.type, level, data) : undefined;
  return (def?.queueBonus ?? 0) + (data.rules.research.queueMax ?? 0);
}

/** Whether a technology has been researched and completed. */
export function hasTech(state: PlayerState, techId: string): boolean {
  return state.research.completed.includes(techId);
}

/** Sum of bonus value for a given research effect key across all completed techs. */
export function getResearchBonus(
  state: PlayerState,
  effectKey: string,
  data: GameData = gameData,
): number {
  let bonus = 0;
  for (const techId of state.research.completed) {
    const tech = data.rules.research.techs.find((t) => t.id === techId);
    if (tech && tech.effects[effectKey] !== undefined) {
      bonus += tech.effects[effectKey]!;
    }
  }
  return bonus;
}

export type TechStatus =
  'completed' | 'active' | 'queued' | 'ready' | 'lockedPrereq' | 'lockedLibrary';

/** Status of a tech for display and validation. */
export function techStatus(
  state: PlayerState,
  techId: string,
  data: GameData = gameData,
): TechStatus {
  if (state.research.completed.includes(techId)) return 'completed';
  if (state.research.active?.techId === techId) return 'active';
  if (state.research.queue.includes(techId)) return 'queued';
  const tech = data.rules.research.techs.find((t) => t.id === techId);
  if (!tech) return 'lockedPrereq';
  const level = libraryLevel(state, data);
  if (level < tech.tier) return 'lockedLibrary';
  if (tech.requiresTech && !state.research.completed.includes(tech.requiresTech)) {
    return 'lockedPrereq';
  }
  return 'ready';
}

/**
 * Starts researching a tech. If active slot is occupied and queue has room,
 * adds it to the queue. Costs gold and soul crystals.
 */
export function startResearch(
  state: PlayerState,
  techId: string,
  now: number,
  data: GameData = gameData,
): ActionResult {
  const bldgs = allBuildings(state).filter(
    (b) => data.buildingById.get(b.type)?.feature === 'research',
  );
  if (bldgs.length === 0) return fail('noLibrary');
  const level = libraryLevel(state, data);
  if (level === 0) return fail('libraryConstructing');

  const tech = data.rules.research.techs.find((t) => t.id === techId);
  if (!tech) return fail('badRequest');

  const status = techStatus(state, techId, data);
  if (status === 'completed') return fail('techAlreadyResearched');
  if (status === 'active' || status === 'queued') return fail('techAlreadyQueued');
  if (status === 'lockedLibrary' || status === 'lockedPrereq') return fail('techLocked');

  const next = deepClone(state);

  // Check queue capacity if currently researching something
  if (next.research.active !== null) {
    const queueCap = researchQueueCapacity(next, data);
    if (next.research.queue.length >= queueCap) {
      return fail('researchSlotsFull');
    }
  }

  // Cost check
  if (next.resources.gold < tech.cost.gold) return fail('notEnoughGold');
  if (next.resources.soulCrystal < tech.cost.soulCrystal) return fail('notEnoughSoulCrystal');

  next.resources.gold -= tech.cost.gold;
  next.resources.soulCrystal -= tech.cost.soulCrystal;

  if (next.research.active === null) {
    next.research.active = { techId, endsAt: now + tech.seconds };
  } else {
    next.research.queue.push(techId);
  }

  return { ok: true, state: next };
}

/** Advances active research timers and completes research when time is up. */
export function settleResearch(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  if (!state.research.active || now < state.research.active.endsAt) {
    return state;
  }
  const next = deepClone(state);
  while (next.research.active && now >= next.research.active.endsAt) {
    const finishedId = next.research.active.techId;
    if (!next.research.completed.includes(finishedId)) {
      next.research.completed.push(finishedId);
    }

    if (next.research.queue.length > 0) {
      const nextId = next.research.queue.shift()!;
      const tech = data.rules.research.techs.find((t) => t.id === nextId);
      const seconds = tech?.seconds ?? 0;
      next.research.active = {
        techId: nextId,
        endsAt: next.research.active.endsAt + seconds,
      };
    } else {
      next.research.active = null;
    }
  }
  return next;
}

/** Instantly finishes active research with gems. */
export function speedUpResearch(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): ActionResult<{ gems: number }> {
  if (!state.research.active) return fail('notResearching');
  const remaining = Math.max(0, state.research.active.endsAt - now);
  const gems = speedUpCost(remaining, data);
  if (state.resources.gems < gems) return fail('notEnoughGems');

  const next = deepClone(state);
  next.resources.gems -= gems;
  if (next.research.active) {
    next.research.active.endsAt = now;
  }
  const settled = settleResearch(next, now, data);
  return { ok: true, state: settled, gems };
}

/** Remaining seconds for active research (or null if idle). */
export function researchRemaining(state: PlayerState, now: number): number | null {
  if (!state.research.active) return null;
  return Math.max(0, state.research.active.endsAt - now);
}

/** Looks up a tech definition from rules data. */
export function techDef(techId: string, data: GameData = gameData): ResearchTech | undefined {
  return data.rules.research.techs.find((t) => t.id === techId);
}

export interface SecretClue {
  element: string;
  name: string;
  pair: readonly [string, string];
}

/** If 'secretRecipeClues' tech is researched, returns secret recipe clues. */
export function knownSecretClues(state: PlayerState, data: GameData = gameData): SecretClue[] {
  const count = getResearchBonus(state, 'secretRecipeClues', data);
  if (count <= 0) return [];
  return data.elements.secretRecipes.slice(0, count * 2).map((r) => {
    const el = data.elementById.get(r.result);
    return {
      element: r.result,
      name: el?.name ?? r.result,
      pair: r.pair,
    };
  });
}
