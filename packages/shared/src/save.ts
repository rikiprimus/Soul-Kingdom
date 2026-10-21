import { z } from 'zod';
import { gameData, raritySchema } from './data';
import { monsterKey } from './monster';
import { createRng } from './rng';
import type { Mission } from './missions';
import type { PlayerState } from './state';
import { createWorkers } from './workers';
import { animalRespawnSeconds } from './animals';
import { encounterRespawnSeconds } from './encounters';
import {
  canPlace,
  createVillage,
  levelDef,
  placeGoldVeins,
  scatterObstacles,
  type Village,
} from './village';

/** Bump when `PlayerState` changes shape, and add a migration below. */
export const SAVE_SCHEMA_VERSION = 15;

const int = z.number().int();
const monsterSchema = z.object({
  id: z.string(),
  form: z.string(),
  element: z.string(),
  stage: z.string(),
  food: int.min(0),
});

const playerStateSchema = z.object({
  resources: z.object({
    gold: int.min(0),
    food: int.min(0),
    wood: int.min(0),
    stone: int.min(0),
    soulCrystal: int.min(0),
    gems: int.min(0),
  }),
  village: z.object({
    buildings: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        x: int.min(0),
        y: int.min(0),
        level: int.min(0),
        construction: z.object({ toLevel: int.min(1), endsAt: z.number() }).nullable(),
        lastCollectAt: z.number(),
        crop: z.object({ endsAt: z.number(), food: int.min(0) }).nullable(),
      }),
    ),
    obstacles: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        x: int.min(0),
        y: int.min(0),
        work: z.number().min(0),
        refillAt: z.number().nullable().optional(),
      }),
    ),
    unlockedPlots: z.array(z.string().regex(/^\d+,\d+$/)),
    regrowAt: z.number(),
    animals: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        x: int.min(0),
        y: int.min(0),
        work: z.number().min(0),
        job: z.enum(['hunt', 'capture']).nullable(),
      }),
    ),
    animalsAt: z.number(),
    ranchAnimals: z.array(z.object({ id: z.string(), type: z.string(), buildingId: z.string() })),
    encounters: z.array(
      z.object({
        id: z.string(),
        level: int.min(0),
        group: int.min(0),
        x: int.min(0),
        y: int.min(0),
        count: int.min(1),
        enemies: z.array(z.object({ form: z.string(), element: z.string(), stage: z.string() })),
        leavesAt: z.number().nullable().optional(),
      }),
    ),
    encountersAt: z.number(),
  }),
  workers: z.array(
    z.object({
      id: z.string(),
      task: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('idle') }),
        z.object({ kind: z.literal('building'), buildingId: z.string() }),
        z.object({ kind: z.literal('gathering'), targetId: z.string() }),
        z.object({ kind: z.literal('staffed'), buildingId: z.string() }),
      ]),
    }),
  ),
  workerTraining: z.array(z.object({ endsAt: z.number() })),
  barracksQueue: z.array(
    z.object({
      buildingId: z.string(),
      kind: z.string(),
      rank: int.min(0),
      endsAt: z.number(),
    }),
  ),
  soldiers: z.array(z.object({ id: z.string(), kind: z.string(), rank: int.min(0) })),
  units: z.record(
    z.string(),
    z.object({
      x: int,
      y: int,
      path: z.array(z.object({ x: int, y: int })),
      departAt: z.number(),
      guard: z.string().nullable(),
    }),
  ),
  eggs: z.array(
    z.object({ id: z.string(), form: z.string(), element: z.string(), readyAt: z.number() }),
  ),
  missions: z.array(
    z.object({
      id: z.string(),
      encounterId: z.string(),
      monsterIds: z.array(z.string()),
      arriveAt: z.number(),
      fight: z
        .object({
          startsAt: z.number(),
          endsAt: z.number(),
          won: z.boolean(),
          dead: z.array(z.string()),
          hpLeft: z.record(z.string(), z.number().min(0).max(1)),
          enemyHpLeft: z.array(z.number().min(0).max(1)),
          reward: z.object({
            gold: int.min(0),
            food: int.min(0),
            wood: int.min(0),
            stone: int.min(0),
          }),
          soulCrystal: int.min(0),
        })
        .nullable(),
    }),
  ),
  graveyard: z.array(monsterSchema),
  bossesDefeated: int.min(0),
  monsters: z.array(monsterSchema),
  mixQueue: z.array(
    z.object({
      id: z.string(),
      parents: z.tuple([monsterSchema, monsterSchema]),
      consumedParentIds: z.array(z.string()),
      result: z.object({
        form: z.string(),
        element: z.string(),
        rarity: raritySchema,
        tierOutcome: z.enum(['recipe', 'same', 'up', 'down', 'mutation']),
        elementSource: z.enum(['recipe', 'secret', 'fullUnion', 'parent', 'partial']),
        recipeId: z.string().optional(),
        mutation: z.boolean(),
        mutationUnit: z.string().optional(),
        secretElement: z.boolean(),
        nextPityStreak: int.min(0),
      }),
      cost: z.object({
        resultTier: int,
        seconds: int.min(0),
        gold: int.min(0),
        soulCrystal: int.min(0),
        prophecyGems: int.min(0),
      }),
      status: z.enum(['prepared', 'mixing']),
      endsAt: z.number().nullable(),
      prophesied: z.boolean(),
    }),
  ),
  mixerSlots: int.min(1),
  pedia: z.object({ monsters: z.array(z.string()), recipes: z.array(z.string()) }),
  pityStreak: int.min(0),
  rngState: int.min(0),
  nextId: int.min(1),
}) satisfies z.ZodType<PlayerState>;

const saveFileSchema = z.object({
  schemaVersion: int,
  state: z.unknown(),
});

export class SaveLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveLoadError';
  }
}

/** Migrations from version N to N + 1, keyed by N. */
const migrations: Record<number, (state: unknown) => unknown> = {
  // v1 (Fase 0 prototype) had a bare town hall level and prototype income; v2 adds the village.
  1: (raw) => {
    const old = raw as Record<string, unknown> & { townHallLevel?: number; lastHarvestAt?: number };
    const state = { ...old } as unknown as PlayerState;
    const now = typeof old.lastHarvestAt === 'number' ? old.lastHarvestAt : 0;
    const rng = createRng(state.rngState);
    const nextId = () => `b${state.nextId++}`;
    state.village = createVillage(rng, now, nextId, gameData);
    state.rngState = rng.getState();
    const hall = state.village.buildings.find((b) => b.type === gameData.townHallId);
    const level = Math.min(old.townHallLevel ?? 1, gameData.maxTownHallLevel);
    if (hall) hall.level = level;
    // Keep the Soul Mixer for players who had already unlocked it.
    const mixerDef = gameData.village.buildings.find((b) => b.feature === 'mixer');
    if (mixerDef && level >= gameData.rules.mixer.unlockTownHallLevel) {
      const spot = findFreeSpot(state.village, mixerDef.size);
      if (spot) {
        state.village.buildings.push({
          id: nextId(),
          type: mixerDef.id,
          ...spot,
          level: 1,
          construction: null,
          lastCollectAt: now,
          crop: null,
        });
      }
    }
    delete (state as unknown as Record<string, unknown>).townHallLevel;
    delete (state as unknown as Record<string, unknown>).lastHarvestAt;
    return state;
  },
  // v2 crops did not remember their harvest; use the field's current level.
  2: (raw) => {
    const state = raw as PlayerState;
    for (const b of state.village?.buildings ?? []) {
      if (b.crop && b.crop.food === undefined) {
        b.crop.food = levelDef(b.type, Math.max(1, b.level))?.crop?.food ?? 0;
      }
    }
    return state;
  },
  // v3 had a 28×28 map and no wood/stone; v4 centres the village on the bigger map,
  // adds wild nodes around it and starting wood/stone.
  3: (raw) => {
    const state = raw as PlayerState;
    const start = gameData.rules.economy.startingResources;
    state.resources.wood ??= start.wood;
    state.resources.stone ??= start.stone;
    const { mapSize } = gameData.village.village;
    const oldSize = 28;
    const offset = Math.max(0, Math.floor((mapSize - oldSize) / 2));
    const items = [...state.village.buildings, ...state.village.obstacles];
    // Saves migrated from v1 were already built on the new map: leave those alone.
    if (offset === 0 || items.some((item) => item.x >= oldSize || item.y >= oldSize)) return state;
    for (const item of items) {
      item.x += offset;
      item.y += offset;
    }
    // Fill the new land around the old village with wilds, leaving the old village as it was.
    const rng = createRng(state.rngState);
    const insideOld = (x: number, y: number, size: number) =>
      x + size > offset && x < offset + oldSize && y + size > offset && y < offset + oldSize;
    scatterObstacles(
      state.village,
      state.village.obstacles.length + gameData.village.village.initialObstacles,
      rng,
      () => `b${state.nextId++}`,
      insideOld,
    );
    state.rngState = rng.getState();
    return state;
  },
  // v4 had no locked land: open the starting plots plus every plot a building stands on.
  4: (raw) => {
    const state = raw as PlayerState;
    const { plotSize, initialPlots } = gameData.village.village;
    const open = new Set(initialPlots.map(([px, py]) => `${px},${py}`));
    for (const b of state.village.buildings) {
      const size = gameData.buildingById.get(b.type)?.size ?? 1;
      for (let dx = 0; dx < size; dx++) {
        for (let dy = 0; dy < size; dy++) {
          open.add(`${Math.floor((b.x + dx) / plotSize)},${Math.floor((b.y + dy) / plotSize)}`);
        }
      }
    }
    state.village.unlockedPlots = [...open];
    return state;
  },
  // v5 had a fixed number of builders: workers replace them, one per running construction.
  5: (raw) => {
    const state = raw as PlayerState;
    const building = state.village.buildings.filter((b) => b.construction).map((b) => b.id);
    const count = Math.max(gameData.rules.workers.startingWorkers, building.length);
    state.workers = [];
    state.workerTraining = [];
    createWorkers(state, count);
    building.forEach((buildingId, i) => {
      state.workers[i]!.task = { kind: 'building', buildingId };
    });
    return state;
  },
  // v6 cleared wild nodes with gold: nodes now hold gathered work, and regrowth needs a clock.
  6: (raw) => {
    const state = raw as PlayerState;
    for (const o of state.village.obstacles) o.work = 0;
    // The last time the village was touched is the best guess for "now".
    state.village.regrowAt = Math.max(
      0,
      ...state.village.buildings.map((b) => Math.max(b.lastCollectAt, b.construction?.endsAt ?? 0)),
    );
    return state;
  },
  // v7 had no animals: start empty so the first ones spawn right away.
  7: (raw) => {
    const state = raw as PlayerState;
    state.village.animals = [];
    state.village.ranchAnimals = [];
    state.village.animalsAt = state.village.regrowAt - animalRespawnSeconds();
    return state;
  },
  // v8 had no barracks training.
  8: (raw) => {
    const state = raw as PlayerState;
    state.barracksQueue = [];
    return state;
  },
  // v9 had no wild enemies, missions or graveyard: the first groups spawn right away.
  9: (raw) => {
    const state = raw as PlayerState;
    state.missions = [];
    state.graveyard = [];
    state.village.encounters = [];
    state.village.encountersAt = state.village.animalsAt - encounterRespawnSeconds();
    return state;
  },
  // v10 trained monsters in the barracks: those still in training join now as adult
  // monsters (they already hold their slots); from v11 barracks train human soldiers.
  10: (raw) => {
    const state = raw as PlayerState;
    const old = (raw as { barracksQueue: { form: string; element: string }[] }).barracksQueue;
    const adult = gameData.rules.growth.stages[gameData.rules.growth.stages.length - 1]!.id;
    for (const e of old) {
      const monster = {
        id: `m${state.nextId}`,
        form: e.form,
        element: e.element,
        stage: adult,
        food: 0,
      };
      state.nextId += 1;
      state.monsters.push(monster);
      const key = monsterKey(monster);
      if (!state.pedia.monsters.includes(key)) state.pedia.monsters.push(key);
    }
    state.barracksQueue = [];
    state.soldiers = [];
    state.eggs = [];
    return state;
  },
  // v11 missions came from the odds formula: give them HP left for the fight display.
  11: (raw) => {
    const state = raw as { missions: OldMission[]; village: PlayerState['village'] };
    for (const m of state.missions) {
      m.hpLeft = Object.fromEntries(m.monsterIds.map((id) => [id, m.dead.includes(id) ? 0 : 0.5]));
      const e = state.village.encounters.find((x) => x.id === m.encounterId);
      m.enemyHpLeft = Array.from({ length: e?.count ?? 0 }, () => (m.won ? 0 : 0.5));
    }
    return state;
  },
  // v12 settled the whole fight at departure: those missions become fights already
  // under way that end when the old mission did (arrival = old end minus the march).
  12: (raw) => {
    const state = raw as { missions: (OldMission | Mission)[] };
    state.missions = state.missions.map((old) => {
      const m = old as OldMission;
      return {
        id: m.id,
        encounterId: m.encounterId,
        monsterIds: m.monsterIds,
        arriveAt: m.endsAt,
        fight: {
          startsAt: m.endsAt,
          endsAt: m.endsAt,
          won: m.won,
          dead: m.dead,
          hpLeft: m.hpLeft,
          enemyHpLeft: m.enemyHpLeft,
          reward: m.reward,
          soulCrystal: m.soulCrystal,
        },
      };
    });
    return state;
  },
  // v13 had no unit positions: everyone gets a spot near the Kandang on the next settle.
  13: (raw) => {
    const state = raw as PlayerState;
    state.units = {};
    return state;
  },
  // v14 had no gold veins: place them now (seeded from the saved RNG, so it is repeatable).
  14: (raw) => {
    const state = raw as PlayerState;
    const rng = createRng(state.rngState);
    placeGoldVeins(state.village, rng, () => `o${state.nextId++}`);
    state.rngState = rng.getState();
    return state;
  },
};

/** Mission shape up to save v12 (outcome rolled at departure). */
interface OldMission {
  id: string;
  encounterId: string;
  monsterIds: string[];
  endsAt: number;
  won: boolean;
  dead: string[];
  hpLeft: Record<string, number>;
  enemyHpLeft: number[];
  reward: { gold: number; food: number; wood: number; stone: number };
  soulCrystal: number;
}

function findFreeSpot(village: Village, size: number) {
  const { mapSize } = gameData.village.village;
  for (let y = 0; y + size <= mapSize; y++) {
    for (let x = 0; x + size <= mapSize; x++) {
      if (canPlace(village, size, x, y)) return { x, y };
    }
  }
  return null;
}

export function serializeState(state: PlayerState): string {
  return JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, state });
}

/** Parses, migrates and validates a save. Throws `SaveLoadError` if it is unusable. */
export function deserializeState(json: string): PlayerState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SaveLoadError('Simpanan rusak: bukan JSON');
  }
  const file = saveFileSchema.safeParse(raw);
  if (!file.success) throw new SaveLoadError('Simpanan rusak: format tidak dikenal');
  let { schemaVersion, state } = file.data;
  if (schemaVersion > SAVE_SCHEMA_VERSION) {
    throw new SaveLoadError(`Simpanan versi ${schemaVersion} lebih baru dari game ini`);
  }
  while (schemaVersion < SAVE_SCHEMA_VERSION) {
    const migrate = migrations[schemaVersion];
    if (!migrate) throw new SaveLoadError(`Tidak ada migrasi dari versi ${schemaVersion}`);
    try {
      state = migrate(state);
    } catch {
      throw new SaveLoadError(`Simpanan rusak: gagal memigrasi dari versi ${schemaVersion}`);
    }
    schemaVersion += 1;
  }
  const parsed = playerStateSchema.safeParse(state);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SaveLoadError(`Simpanan rusak: ${issue?.path.join('.')} — ${issue?.message}`);
  }
  return parsed.data as PlayerState;
}

export interface LoadedSave {
  state: PlayerState | null;
  /** Which copy was used: the main save, the last good backup, or neither (new game). */
  from: 'main' | 'backup' | null;
  /** Why the main save could not be used, when it existed but failed. */
  error: string | null;
}

/**
 * Loads the main save and falls back to the last known-good backup when the main one is
 * corrupt or from an incompatible build, so a bad write does not cost the whole village.
 */
export function loadWithBackup(main: string | null, backup: string | null): LoadedSave {
  let error: string | null = null;
  if (main) {
    try {
      return { state: deserializeState(main), from: 'main', error: null };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  if (backup) {
    try {
      return { state: deserializeState(backup), from: 'backup', error };
    } catch {
      // The backup is unusable too: start over.
    }
  }
  return { state: null, from: null, error };
}
