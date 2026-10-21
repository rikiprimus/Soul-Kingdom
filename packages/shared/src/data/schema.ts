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

/**
 * One group of NPC defenders (Serbu bases, Petualangan nodes): bandits, monsters,
 * soldiers, watchtowers, or a boss (a named monster with its stats multiplied).
 */
export const defenderSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('bandit'),
    power: z.number().positive(),
    count: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('monster'),
    form: z.string().min(1),
    element: z.string().min(1),
    stage: z.string().min(1),
    count: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('soldier'),
    soldier: z.string().min(1),
    rank: nonNegInt,
    count: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('tower'),
    level: z.number().int().min(1),
    count: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('boss'),
    name: z.string().min(1),
    form: z.string().min(1),
    element: z.string().min(1),
    stage: z.string().min(1),
    /** hp, atk and def of the monster are multiplied by this. */
    statMultiplier: z.number().positive(),
    count: z.number().int().min(1),
  }),
]);
export type Defender = z.infer<typeof defenderSchema>;

/** What winning a fight pays: village resources, Soul Crystals and (rarely) gems. */
export const battleRewardSchema = villageAmountSchema.extend({
  soulCrystal: nonNegInt.default(0),
  gems: nonNegInt.default(0),
});
export type BattleReward = z.infer<typeof battleRewardSchema>;

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
  /** Serbu against NPC bases (serbu.ts). */
  serbu: z.object({
    grid: z.object({ columns: z.number().int().min(4), rows: z.number().int().min(1) }),
    /** Columns each side may start in, from its own edge. */
    placeColumns: z.number().int().min(1),
    trackEveryTicks: z.number().int().min(1),
    bases: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          requiresTownHall: z.number().int().min(1),
          defenders: z.array(defenderSchema).min(1),
          firstReward: battleRewardSchema,
          repeatReward: battleRewardSchema,
        }),
      )
      .min(1),
  }),
  /** Raids on the village and its defence (raids.ts). */
  raids: z.object({
    minTownHall: z.number().int().min(1),
    /** Seconds of active play between raids. */
    intervalSeconds: z.number().positive(),
    warnSeconds: z.number().min(0),
    walkTilesPerSecond: z.number().positive(),
    defendTiles: z.number().positive(),
    stealRatio: probability,
    tower: z.object({
      building: z.string().min(1),
      reachTiles: z.number().positive(),
      /** Battle stats per tower level (index 0 = level 1); it never moves. */
      levels: z
        .array(
          z.object({
            hp: z.number().positive(),
            atk: z.number().positive(),
            def: z.number().nonnegative(),
            spd: z.number().positive(),
            range: z.number().positive(),
          }),
        )
        .min(1),
    }),
    /** HP of one wall segment per level (index 0 = level 1): how long breaking it takes. */
    wall: z.object({
      building: z.string().min(1),
      hpByLevel: z.array(z.number().positive()).min(1),
    }),
  }),
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
  'serbu',
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
  /** Chance that finishing this node calls out an ambush (wilds.encounters.ambush). */
  ambushChance: probability.default(0),
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
    /** Enemies wake when our units come this close (tiles), then chase at this speed. */
    aggro: z.object({
      banditTiles: z.number().positive(),
      monsterTiles: z.number().positive(),
      chaseTilesPerSecond: z.number().positive(),
    }),
    ambush: z.object({ workerDeathChance: probability, leaveHours: z.number().positive() }),
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

/** Petualangan (Tugas 1.5): regions, each a small map of nodes ending in a boss. */
export const adventureFileSchema = z.object({
  _notes: z.array(z.string()).optional(),
  regions: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string(),
        requiresTownHall: z.number().int().min(1),
        nodes: z
          .array(
            z.object({
              id: z.string().min(1),
              kind: z.enum(['resource', 'camp', 'boss']),
              name: z.string().min(1),
              /** Place on the region map, 0..1 across and down. */
              x: z.number().min(0).max(1),
              y: z.number().min(0).max(1),
              /** Nodes that must be beaten first (the path). */
              after: z.array(z.string()),
              defenders: z.array(defenderSchema).min(1),
              /** Camps and bosses: paid once. Resource nodes: paid every time they are taken. */
              reward: battleRewardSchema,
              /** Resource nodes: hours until the node (and its guards) are back. */
              refillHours: z.number().positive().optional(),
              /** Resource nodes: chance of one gem each time they are taken. */
              gemChance: probability.default(0),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});
export type AdventureFile = z.infer<typeof adventureFileSchema>;
