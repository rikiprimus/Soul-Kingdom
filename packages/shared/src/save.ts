import { z } from 'zod';
import { gameData, raritySchema } from './data';
import { monsterKey } from './monster';
import { createRng } from './rng';
import type { Mission } from './missions';
import { noActions, type PlayerState } from './state';
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
export const SAVE_SCHEMA_VERSION = 33;

const int = z.number().int();
const villageAmountSchema = z.object({
  gold: int.min(0),
  food: int.min(0),
  wood: int.min(0),
  stone: int.min(0),
});
const actionCountsSchema = z.object({
  build: int.min(0),
  harvest: int.min(0),
  collect: int.min(0),
  gather: int.min(0),
  defeatEnemy: int.min(0),
  hatch: int.min(0),
  help: int.min(0),
});
const monsterSchema = z.object({
  id: z.string(),
  form: z.string(),
  element: z.string(),
  stage: z.string(),
  food: int.min(0),
});

const villageSchema = z.object({
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
      flipped: z.boolean().optional(),
      closed: z.boolean().optional(),
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
      raid: z
        .object({
          warnLeft: z.number().min(0),
          next: z.object({ x: int, y: int }).nullable(),
          stepLeft: z.number().min(0),
          stepSeconds: z.number().min(0),
          breaking: z.string().nullable(),
        })
        .nullable()
        .optional(),
    }),
  ),
  encountersAt: z.number(),
  raidClock: z.number().min(0),
});

import type { SerbuResult } from './serbu';

const pvpDefenseCellSchema = z.object({
  id: z.string(),
  x: int.min(0),
  y: int.min(0),
});

const pvpDefenseLogEntrySchema = z.object({
  id: z.string(),
  attackerId: z.string(),
  attackerName: z.string(),
  attackerLevel: int.min(1),
  attackerPower: int.min(0),
  won: z.boolean(),
  trophyChange: int,
  stolen: z.object({
    gold: int.min(0),
    food: int.min(0),
    wood: int.min(0),
    stone: int.min(0),
    soulCrystal: int.min(0),
    gems: int.min(0),
  }),
  timestamp: z.number(),
  replay: z.custom<SerbuResult>((val) => val !== undefined),
});

const pvpStateSchema = z.object({
  defenseCells: z.array(pvpDefenseCellSchema),
  trophies: int.min(0),
  history: z.array(pvpDefenseLogEntrySchema),
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
  village: villageSchema,
  island: z.string(),
  islands: z.record(z.string(), villageSchema),
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
  machines: z.array(z.object({ id: z.string(), kind: z.string() })),
  workshopQueue: z.array(
    z.object({ kind: z.string(), buildingId: z.string(), endsAt: z.number() }),
  ),
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
  collections: z.array(z.string()),
  storage: z.array(
    z.object({ id: z.string(), type: z.string(), level: int.min(1), flipped: z.boolean() }),
  ),
  soulEggs: z.array(z.object({ id: z.string(), step: int.min(0), endsAt: z.number().nullable() })),
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
          reward: villageAmountSchema,
          soulCrystal: int.min(0),
          stolen: villageAmountSchema.nullable().optional(),
        })
        .nullable(),
    }),
  ),
  healing: z.object({
    at: z.number(),
    wounds: z.record(z.string(), z.number().gt(0).max(1)),
  }),
  research: z.object({
    completed: z.array(z.string()),
    active: z.object({ techId: z.string(), endsAt: z.number() }).nullable(),
    queue: z.array(z.string()),
  }),
  graveyard: z.array(monsterSchema),
  bossesDefeated: int.min(0),
  xp: int.min(0),
  actions: actionCountsSchema,
  quest: z.object({ index: int.min(0), start: actionCountsSchema }),
  daily: z.object({ next: int.min(0), lastDay: int.nullable() }),
  marketDraw: z.object({ lastDay: int.nullable() }),
  social: z.object({
    helped: z.record(z.string(), int),
    borrowDay: int.nullable(),
  }),
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
  serbu: z.object({ cleared: z.array(z.string()) }),
  pvp: pvpStateSchema,
  adventure: z.object({
    cleared: z.array(z.string()),
    refillAt: z.record(z.string(), z.number()),
  }),
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
    // Keep the Soul Mixer / Altar for players who had already unlocked it.
    const mixerDef = gameData.village.buildings.find(
      (b) => b.feature === 'altar' || b.feature === 'mixer',
    );
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
  // v15 had no raids: the clock towards the first one starts now.
  15: (raw) => {
    const state = raw as PlayerState;
    state.village.raidClock = 0;
    return state;
  },
  // v16 had no Serbu: no NPC base beaten yet.
  16: (raw) => {
    const state = raw as PlayerState;
    state.serbu = { cleared: [] };
    return state;
  },
  // v17 had no Petualangan: nothing explored yet (bosses beaten in debug stay counted).
  17: (raw) => {
    const state = raw as PlayerState;
    state.adventure = { cleared: [], refillAt: {} };
    return state;
  },
  // v18 had no player level: everyone starts at level 1.
  18: (raw) => {
    const state = raw as PlayerState;
    state.xp = 0;
    return state;
  },
  // v19 had no quests or daily bonus: the chain starts at the first quest.
  19: (raw) => {
    const state = raw as PlayerState;
    state.actions = noActions();
    state.quest = { index: 0, start: noActions() };
    state.daily = { next: 0, lastDay: null };
    return state;
  },
  // v20 had no Telur Jiwa.
  20: (raw) => {
    const state = raw as PlayerState;
    state.soulEggs = [];
    return state;
  },
  // v21 had no collection sets (and no Keajaiban, see v22).
  21: (raw) => {
    const state = raw as PlayerState;
    state.collections = [];
    return state;
  },
  // v22 kept won Keajaiban as a list of ids; v23 has the Gudang, where they wait now.
  22: (raw) => {
    const state = raw as PlayerState & { wonders?: string[] };
    state.storage = (state.wonders ?? []).map((type) => ({
      id: `g${state.nextId++}`,
      type,
      level: 1,
      flipped: false,
    }));
    delete state.wonders;
    return state;
  },
  // v23 had one island: it becomes the main one.
  23: (raw) => {
    const state = raw as PlayerState;
    state.island = gameData.islands.islands[0]!.id;
    state.islands = {};
    return state;
  },
  // v24 had no friends: no help given, nothing borrowed, no help counted yet.
  24: (raw) => {
    const state = raw as PlayerState;
    state.social = { helped: {}, borrowDay: null };
    state.actions.help = 0;
    state.quest.start.help = 0;
    return state;
  },
  // v25 (Tugas 1C.1): remap building types: soul-mixer -> altar, kandang -> gudang,
  // barak (old Guild) -> guild, petarung (Barak Prajurit) -> barak, barak-berkuda -> kandang-kuda.
  25: (raw) => {
    const state = raw as PlayerState;
    const remap = (b: { type: string; level: number }) => {
      if (b.type === 'barak') {
        b.type = 'guild';
      } else if (b.type === 'petarung') {
        b.type = 'barak';
      } else if (b.type === 'barak-berkuda') {
        b.type = 'kandang-kuda';
      } else if (b.type === 'soul-mixer') {
        b.type = 'altar';
      }
    };
    const processBuildings = (buildings: typeof state.village.buildings) => {
      let hasGudang = buildings.some((b) => b.type === 'gudang');
      const keep: typeof buildings = [];
      for (const b of buildings) {
        if (b.type === 'kandang') {
          if (!hasGudang) {
            b.type = 'gudang';
            b.level = 1;
            hasGudang = true;
            keep.push(b);
          } else {
            state.resources.gold += 300;
            state.resources.wood += 200;
          }
        } else {
          remap(b);
          keep.push(b);
        }
      }
      return keep;
    };
    state.village.buildings = processBuildings(state.village.buildings);
    for (const island of Object.values(state.islands ?? {})) {
      island.buildings = processBuildings(island.buildings);
    }
    if (state.storage) {
      for (const item of state.storage) {
        if (item.type === 'barak') item.type = 'guild';
        else if (item.type === 'petarung') item.type = 'barak';
        else if (item.type === 'barak-berkuda') item.type = 'kandang-kuda';
        else if (item.type === 'soul-mixer') item.type = 'altar';
        else if (item.type === 'kandang') item.type = 'gudang';
      }
    }
    return state;
  },
  // v26 (Tugas 1C.2): Tambang Emas / Penggilingan Lv 1-2 now hold fewer workers; the extra
  // ones step out and become idle.
  26: (raw) => {
    const state = raw as PlayerState;
    const buildings = [state.village, ...Object.values(state.islands ?? {})].flatMap(
      (v) => v.buildings,
    );
    for (const b of buildings) {
      const slots = levelDef(b.type, Math.max(1, b.level))?.workerSlots;
      if (slots === undefined) continue;
      state.workers
        .filter((w) => w.task.kind === 'staffed' && w.task.buildingId === b.id)
        .slice(slots)
        .forEach((w) => (w.task = { kind: 'idle' }));
    }
    return state;
  },
  // v27 had no Undian Harian (Tugas 1C.5): today's draw is still free.
  27: (raw) => {
    const state = raw as PlayerState;
    state.marketDraw = { lastDay: null };
    return state;
  },
  // v28 had no Bengkel (Tugas 1C.7): no war machines yet.
  28: (raw) => {
    const state = raw as PlayerState;
    state.machines = [];
    state.workshopQueue = [];
    return state;
  },
  // v29 (Tugas 1C.9): hunting now takes soldiers. Workers out hunting come back idle and
  // the hunt starts over.
  29: (raw) => {
    const state = raw as PlayerState;
    for (const island of [state.village, ...Object.values(state.islands ?? {})]) {
      for (const a of island.animals) {
        if (a.job !== 'hunt') continue;
        for (const w of state.workers) {
          if (w.task.kind === 'gathering' && w.task.targetId === a.id) w.task = { kind: 'idle' };
        }
        a.job = null;
        a.work = 0;
      }
    }
    return state;
  },
  // v30 (Tugas 1C.10) kept no HP after fights: everyone starts unhurt.
  30: (raw) => {
    const state = raw as PlayerState;
    state.healing = { at: 0, wounds: {} };
    return state;
  },
  // v31 (Tugas 1C.11) added Perpustakaan & riset.
  31: (raw) => {
    const state = raw as PlayerState;
    state.research = { completed: [], active: null, queue: [] };
    return state;
  },
  // v32 (Tugas 2.2) added Serbu PvP markas pemain lain & log pertahanan.
  32: (raw) => {
    const state = raw as PlayerState;
    state.pvp = { defenseCells: [], trophies: 1000, history: [] };
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
