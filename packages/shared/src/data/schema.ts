import { z } from 'zod';

/** Tier keys in JSON are strings ("1".."5"); this helper parses such records. */
const tierRecord = <T extends z.ZodTypeAny>(value: T) => z.record(z.string().regex(/^\d+$/), value);

const probability = z.number().min(0).max(1);
const nonNegInt = z.number().int().min(0);

export const elementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  composition: z.array(z.string().min(1)).min(1),
  secret: z.boolean().optional(),
});

export const elementsFileSchema = z.object({
  baseElements: z.array(z.string().min(1)).min(1),
  beats: z.record(z.string(), z.array(z.string())),
  elements: z.array(elementSchema),
  secretRecipes: z.array(
    z.object({
      pair: z.tuple([z.string(), z.string()]),
      result: z.string(),
      chance: probability,
    }),
  ),
});

export const formSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tier: z.number().int().min(1),
  role: z.string().min(1),
});

export const formsFileSchema = z.object({
  roles: z.record(z.string(), z.object({ name: z.string(), preferredRow: z.string() })),
  tiers: tierRecord(z.object({ name: z.string(), visual: z.string() })),
  forms: z.array(formSchema),
});

export const recipesFileSchema = z.object({
  monsterRecipes: z.array(
    z.object({
      id: z.string().min(1),
      parents: z.tuple([z.string(), z.string()]),
      result: z.string(),
    }),
  ),
});

const rarityIds = ['biasa', 'langka', 'epik', 'legenda'] as const;
export const raritySchema = z.enum(rarityIds);
/** An object with one required entry per rarity. */
const perRarity = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ biasa: value, langka: value, epik: value, legenda: value });

const costSchema = z.object({ seconds: nonNegInt, gold: nonNegInt, soulCrystal: nonNegInt });

const resourcesSchema = z.object({
  gold: nonNegInt,
  food: nonNegInt,
  wood: nonNegInt,
  stone: nonNegInt,
  soulCrystal: nonNegInt,
  gems: nonNegInt,
});

/** A price or a yield in the four village resources; missing ones are 0. */
export const villageAmountSchema = z.object({
  gold: nonNegInt.default(0),
  food: nonNegInt.default(0),
  wood: nonNegInt.default(0),
  stone: nonNegInt.default(0),
});
export const VILLAGE_RESOURCES = ['gold', 'food', 'wood', 'stone'] as const;

const statBlockSchema = z.object({
  hp: z.number().positive(),
  atk: z.number().positive(),
  def: z.number().min(0),
  spd: z.number().positive(),
  range: z.number().int().min(1),
});

export const rulesFileSchema = z.object({
  rarity: z.object({
    byElementUnits: tierRecord(raritySchema),
    legendaryIfFormTier: z.number().int(),
    legendaryIfSecretElement: z.boolean(),
    names: perRarity(z.string()),
    visuals: perRarity(
      z.object({
        animation: z.boolean(),
        aura: z.enum(['none', 'element', 'gold']),
        elementEffect: z.boolean(),
        goldFrame: z.boolean().optional(),
      }),
    ),
  }),
  growth: z.object({
    stages: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          statMultiplier: z.number().positive(),
          foodToNextPerPowerPoint: nonNegInt.optional(),
        }),
      )
      .min(2),
  }),
  stats: z.object({
    roleBase: z.record(z.string(), statBlockSchema),
    tierMultiplier: tierRecord(z.number().positive()),
  }),
  mixer: z.object({
    unlockTownHallLevel: z.number().int().min(1),
    parentStage: z.string(),
    consumeParents: z.boolean(),
    protectLegendaryParents: z.boolean(),
    initialSlots: z.number().int().min(1),
    maxSlots: z.number().int().min(1),
    maxElementUnitsByFormTier: tierRecord(z.number().int().min(1)),
    secretElementMinFormTier: z.number().int().min(1),
    maxFormTierByBossesDefeated: z.array(z.number().int().min(1)).min(1),
    formTierOdds: z.object({
      same: probability,
      up: probability,
      down: probability,
      mutation: probability,
    }),
    elementOdds: z.object({ fullUnion: probability, parent: probability, partial: probability }),
    pity: z.object({
      streak: z.number().int().min(1),
      mutationBonusPerStreak: probability,
      resetOnRarity: raritySchema,
    }),
    costByResultTier: tierRecord(costSchema),
  }),
  premium: z.object({
    currencyName: z.string(),
    speedUpGemsPerMinute: z.number().positive(),
    speedUpMinimumGems: nonNegInt,
    extraMixerSlotGems: z.array(nonNegInt),
    soulProphecyGemsByResultTier: tierRecord(nonNegInt),
  }),
  battle: z.object({
    maxUnits: z.number().int().positive(),
    powerPoints: tierRecord(z.number().int().positive()),
    /** Index = sum of the levels of the three barracks (0 = none built). */
    powerCapByCombinedBarracksLevel: z.array(z.number().int().positive()).min(1),
    grid: z.object({ columns: z.number().int().positive(), rows: z.number().int().positive() }),
    advantageStep: z.number(),
    advantageMin: z.number().positive(),
    advantageMax: z.number().positive(),
    maxTicks: z.number().int().positive(),
    ticksPerSecond: z.number().int().positive(),
    arenaTeamSize: z.number().int().positive(),
    /** Battle simulator (battle.ts). */
    sim: z.object({
      moveTilesPerSpd: z.number().positive(),
      attackSecondsAtSpd10: z.number().positive(),
      defenseK: z.number().positive(),
      damageVariance: z.number().min(0).max(1),
      minDamage: z.number().int().min(1),
      skillEvery: z.number().int().min(1),
      skillMultiplier: z.number().positive(),
      previewRuns: z.number().int().min(1),
    }),
    /** One bandit's stats, scaled by its group's banditPower × powerScale. */
    bandit: z.object({
      stats: z.object({
        hp: z.number().positive(),
        atk: z.number().positive(),
        def: z.number().nonnegative(),
        spd: z.number().positive(),
        range: z.number().int().min(1),
      }),
      powerScale: z.number().positive(),
    }),
  }),
  /** Monsters and soldiers standing on village tiles (units.ts). */
  units: z.object({ walkTilesPerSecond: z.number().positive() }),
  population: z.object({ workerSlots: z.number().int().min(1) }),
  skirmish: z.object({
    maxTeam: z.number().int().min(1),
    /** Walk to the enemy; the fight itself has no time limit. */
    marchSeconds: z.number().positive(),
  }),
  barracks: z.object({
    queueMax: z.number().int().min(1),
    /** Human soldiers, one kind per barracks (buildings.json → trainsSoldier). */
    soldiers: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          role: z.string().min(1),
          stats: z.object({
            hp: z.number().positive(),
            atk: z.number().positive(),
            def: z.number().nonnegative(),
            spd: z.number().positive(),
            range: z.number().int().min(1),
          }),
          powerPoints: z.number().int().min(1),
          /** Cost and time of one Rekrut; higher ranks multiply them. */
          train: z.object({ gold: nonNegInt, food: nonNegInt, seconds: z.number().positive() }),
        }),
      )
      .min(1),
    /** Rank n (1-based) opens at barracks level n. */
    ranks: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          statMultiplier: z.number().positive(),
          powerBonus: nonNegInt,
          costMultiplier: z.number().positive(),
          timeMultiplier: z.number().positive(),
        }),
      )
      .min(1),
  }),
  workers: z.object({
    trainFood: nonNegInt,
    trainSeconds: nonNegInt,
    startingWorkers: nonNegInt,
    /** Workers that can wait in the Balai Utama training queue at once. */
    trainQueueMax: z.number().int().min(1),
    constructionMaxBySize: tierRecord(z.number().int().min(1)),
  }),
  economy: z.object({
    startingResources: resourcesSchema,
    startingTownHallLevel: z.number().int().min(1),
    /** The first monster hatches from this egg (random tier-1 form, base element). */
    startingEgg: z.object({ hatchSeconds: nonNegInt }),
  }),
  debug: z.object({ enabledInDev: z.boolean(), skipMixerUnlock: z.boolean() }),
});

export const buildingFeatures = [
  'townHall',
  'house',
  'stable',
  'mixer',
  'barracks',
  'staffed',
  'ranch',
  'graveyard',
  'adventure',
  'arena',
  'defense',
] as const;

export const buildingLevelSchema = z.object({
  cost: villageAmountSchema,
  seconds: nonNegInt,
  requiresTownHall: nonNegInt,
  production: z
    .object({
      resource: z.enum(['gold', 'food']),
      perHour: z.number().positive(),
      capacity: z.number().int().positive(),
    })
    .optional(),
  crop: z
    .object({ plantGold: nonNegInt, seconds: z.number().int().positive(), food: nonNegInt })
    .optional(),
  /** Population this building gives (Balai Utama, Rumah). */
  population: z.number().int().positive().optional(),
  /** Workers that can live and work inside (Tambang Emas, Penggilingan). */
  workerSlots: z.number().int().positive().optional(),
  staffedProduction: z
    .object({
      resource: z.enum(VILLAGE_RESOURCES),
      perWorkerPerHour: z.number().positive(),
      capacity: z.number().int().positive(),
    })
    .optional(),
  animalSlots: z.number().int().positive().optional(),
  /** Food a Peternakan can hold before it must be collected. */
  ranchCapacity: z.number().int().positive().optional(),
});

export const buildingDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.string().min(1),
  feature: z.enum(buildingFeatures).optional(),
  sellable: z.boolean().optional(),
  lineBuild: z.boolean().optional(),
  /** Data exists but the building cannot be built yet (its feature is still to come). */
  hidden: z.boolean().optional(),
  /** Barracks: the soldier kind this building trains (rules.barracks.soldiers). */
  trainsSoldier: z.string().optional(),
  size: z.number().int().min(1),
  maxCount: z.array(nonNegInt).min(1),
  levels: z.array(buildingLevelSchema).min(1),
});

/** A tree, rock or bush in the wilds (wilds.json → nodes). */
export const obstacleDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().min(1),
  /** Share of random scattering; 0 = never scattered (gold veins are placed on their own). */
  weight: z.number().min(0),
  yield: villageAmountSchema,
  soulCrystalChance: probability,
  work: z.object({ workSeconds: z.number().positive(), maxWorkers: z.number().int().min(1) }),
  regrow: z.object({ chancePerStep: probability, maxPerPlot: nonNegInt }),
  /** Set: gathering leaves an empty node that fills up again after this many hours. */
  refillHours: z.number().positive().optional(),
});

const encounterGroupSchema = z.object({
  kind: z.enum(['bandit', 'monster']),
  weight: z.number().positive(),
  count: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  banditPower: z.number().positive().optional(),
  formTier: z.number().int().min(1).optional(),
  stage: z.string().optional(),
  reward: villageAmountSchema.extend({ soulCrystalChance: probability.default(0) }),
});

export const wildsFileSchema = z.object({
  nodes: z.array(obstacleDefSchema).min(1),
  /** Gold veins: `clusters` [min, max] groups of side × side gold nodes per map. */
  goldVeins: z.object({
    node: z.string().min(1),
    clusters: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    side: z.number().int().min(1),
  }),
  /** Regrowth runs in steps of `stepSeconds`; at most `maxSteps` are caught up at once. */
  regrow: z.object({ stepSeconds: z.number().positive(), maxSteps: z.number().int().min(1) }),
  animals: z.object({
    respawnHours: z.number().positive(),
    count: nonNegInt,
    types: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          weight: z.number().positive(),
          hunt: z.object({ workSeconds: z.number().positive(), food: nonNegInt }),
          capture: z.object({ workSeconds: z.number().positive() }),
          /** Workers that can hunt or capture one animal at once. */
          maxWorkers: z.number().int().min(1),
          ranchFoodPerHour: z.number().min(0),
        }),
      )
      .min(1),
  }),
  encounters: z.object({
    respawnHours: z.number().positive(),
    groupsByTownHall: z.array(nonNegInt).min(1),
    levels: z
      .array(
        z.object({
          townHall: z.number().int().min(1),
          groups: z.array(encounterGroupSchema).min(1),
        }),
      )
      .min(1),
  }),
  graveyard: z.object({
    goldPerPowerPoint: nonNegInt,
    foodPerPowerPoint: nonNegInt,
    gemsPerPowerPoint: nonNegInt,
  }),
});

export const buildingsFileSchema = z.object({
  village: z.object({
    mapSize: z.number().int().min(8),
    plotSize: z.number().int().min(1),
    initialPlots: z.array(z.tuple([nonNegInt, nonNegInt])).min(1),
    plotCostGold: z.array(nonNegInt),
    plotRequiresTownHall: z.array(nonNegInt),
    initialObstacles: nonNegInt,
    keepClearRadius: nonNegInt,
    sellRefundRatio: probability,
    collectReadyRatio: probability,
    startingBuildings: z.array(
      z.object({ type: z.string(), x: nonNegInt, y: nonNegInt, level: z.number().int().min(1) }),
    ),
  }),
  categories: z.record(z.string(), z.string()),
  buildings: z.array(buildingDefSchema).min(1),
});

/** Player-facing UI text, flat key → string (Indonesian). */
export const textFileSchema = z.record(z.string(), z.string());

export type ElementsFile = z.infer<typeof elementsFileSchema>;
export type FormsFile = z.infer<typeof formsFileSchema>;
export type RecipesFile = z.infer<typeof recipesFileSchema>;
export type RulesFile = z.infer<typeof rulesFileSchema>;
export type TextFile = z.infer<typeof textFileSchema>;
export type BuildingsFile = z.infer<typeof buildingsFileSchema>;
export type BuildingDef = z.infer<typeof buildingDefSchema>;
export type BuildingLevel = z.infer<typeof buildingLevelSchema>;
export type ObstacleDef = z.infer<typeof obstacleDefSchema>;
export type WildsFile = z.infer<typeof wildsFileSchema>;
export type VillageAmount = z.infer<typeof villageAmountSchema>;
export type VillageResource = (typeof VILLAGE_RESOURCES)[number];
export type BuildingFeature = (typeof buildingFeatures)[number];
export type Rarity = z.infer<typeof raritySchema>;
export const RARITY_ORDER: readonly Rarity[] = rarityIds;
