import { describe, expect, it } from 'vitest';
import { deepClone } from '../clone';
import { DataValidationError, gameData, loadGameData, rawGameData, type RawGameData } from '.';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Deep-copies the real data and lets a test break one part of it. */
function corrupt(mutate: (raw: Record<string, any>) => void): RawGameData {
  const copy = deepClone(rawGameData) as unknown as Record<string, any>;
  mutate(copy);
  return copy as unknown as RawGameData;
}

function expectRejected(raw: RawGameData, message: RegExp) {
  expect(() => loadGameData(raw)).toThrow(DataValidationError);
  expect(() => loadGameData(raw)).toThrow(message);
}

describe('game data', () => {
  it('loads 13 elements with approved cycle beats table', () => {
    const all = gameData.elements.elements;
    expect(all).toHaveLength(13);
    const ids = all.map((e) => e.id);
    expect(ids).toEqual([
      'normal',
      'api',
      'air',
      'angin',
      'tanah',
      'lightning',
      'ice',
      'nature',
      'dark',
      'magma',
      'light',
      'arcane',
      'void',
    ]);
    for (const el of all) {
      expect(el.name).toBeTruthy();
      expect(el.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    // Verify 8-element natural cycle: Api -> Nature -> Tanah -> Lightning -> Air -> Magma -> Ice -> Angin -> Api
    expect(gameData.elements.beats['api']).toContain('nature');
    expect(gameData.elements.beats['nature']).toContain('tanah');
    expect(gameData.elements.beats['tanah']).toContain('lightning');
    expect(gameData.elements.beats['lightning']).toContain('air');
    expect(gameData.elements.beats['air']).toContain('magma');
    expect(gameData.elements.beats['magma']).toContain('ice');
    expect(gameData.elements.beats['ice']).toContain('angin');
    expect(gameData.elements.beats['angin']).toContain('api');

    // Verify 4-element cosmic cycle: Light -> Dark -> Arcane -> Void -> Light
    expect(gameData.elements.beats['light']).toContain('dark');
    expect(gameData.elements.beats['dark']).toContain('arcane');
    expect(gameData.elements.beats['arcane']).toContain('void');
    expect(gameData.elements.beats['void']).toContain('light');

    // Normal is neutral (beats none)
    expect(gameData.elements.beats['normal'] ?? []).toHaveLength(0);
  });

  it('loads 100 monster species across 8 tiers with 65 Altar recipes', () => {
    const monsters = gameData.monsters.monsters;
    expect(monsters).toHaveLength(100);

    const tierCounts = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (t) => monsters.filter((m) => m.tier === t).length,
    );
    expect(tierCounts).toEqual([13, 13, 13, 13, 12, 12, 12, 12]);

    const withRecipe = monsters.filter((m) => m.recipe !== null);
    expect(withRecipe).toHaveLength(65);

    for (const m of monsters) {
      expect(m.name).toBeTruthy();
      expect(m.description).toBeTruthy();
      expect(m.sources.length).toBeGreaterThan(0);
      expect(gameData.elementById.has(m.element)).toBe(true);
      expect(gameData.forms.roles[m.role]).toBeDefined();
    }
  });

  it('configures 8 tiers with Serbu power points and Altar times in rules.json', () => {
    const power = gameData.rules.battle.powerPoints;
    expect(power['1']).toBe(1);
    expect(power['2']).toBe(2);
    expect(power['3']).toBe(3);
    expect(power['4']).toBe(5);
    expect(power['5']).toBe(8);
    expect(power['6']).toBe(12);
    expect(power['7']).toBe(18);
    expect(power['8']).toBe(25);

    const cost = gameData.rules.mixer.costByResultTier;
    expect(cost['1']!.seconds).toBe(600); // 10 min
    expect(cost['2']!.seconds).toBe(1800); // 30 min
    expect(cost['3']!.seconds).toBe(7200); // 2 hours
    expect(cost['4']!.seconds).toBe(21600); // 6 hours
    expect(cost['5']!.seconds).toBe(43200); // 12 hours
    expect(cost['6']!.seconds).toBe(86400); // 24 hours
    expect(cost['7']!.seconds).toBe(172800); // 48 hours
    expect(cost['8']!.seconds).toBe(259200); // 72 hours
  });

  it('rejects duplicate monster IDs', () => {
    expectRejected(
      corrupt((raw) => {
        raw.monsters.monsters[1].id = raw.monsters.monsters[0].id;
      }),
      /ID monster ganda/,
    );
  });

  it('rejects recipe when parent does not exist', () => {
    expectRejected(
      corrupt((raw) => {
        const recipeMonster = raw.monsters.monsters.find((m: any) => m.recipe);
        recipeMonster.recipe.parentA = 'monster-tidak-ada';
      }),
      /memakai induk A yang tidak ada/,
    );
  });

  it('rejects recipe when parent tier is not strictly lower than child tier', () => {
    expectRejected(
      corrupt((raw) => {
        // Find a tier 2 monster with recipe, set parentA to a tier 3 monster
        const recipeMonster = raw.monsters.monsters.find((m: any) => m.tier === 2 && m.recipe);
        recipeMonster.recipe.parentA = 'orc-berserker'; // Tier 3
      }),
      /harus memiliki tingkatan lebih rendah/,
    );
    expectRejected(
      corrupt((raw) => {
        // Set parentA to a monster of the same tier
        const recipeMonster = raw.monsters.monsters.find((m: any) => m.tier === 2 && m.recipe);
        recipeMonster.recipe.parentA = 'goblin-archer'; // Tier 2
      }),
      /harus memiliki tingkatan lebih rendah/,
    );
  });

  it('rejects duplicate parent pairs used across two recipes', () => {
    expectRejected(
      corrupt((raw) => {
        // Set two different monsters to use the exact same parent pair
        const recipes = raw.monsters.monsters.filter((m: any) => m.recipe);
        recipes[1].recipe.parentA = recipes[0].recipe.parentB;
        recipes[1].recipe.parentB = recipes[0].recipe.parentA;
      }),
      /sudah dipakai oleh monster/,
    );
  });

  it('rejects monsters with no sources', () => {
    expectRejected(
      corrupt((raw) => {
        raw.monsters.monsters[0].sources = [];
      }),
      /tidak memiliki sumber|Monster harus memiliki minimal satu sumber/,
    );
  });

  it('loads 23 forms across 5 tiers', () => {
    expect(gameData.forms.forms).toHaveLength(23);
    expect(gameData.formTiers).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects recipes that reference unknown forms or elements', () => {
    expectRejected(
      corrupt((raw) => {
        raw.recipes.monsterRecipes[0].parents[0] = 'unicorn:api';
      }),
      /wujud "unicorn" tidak ada/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.recipes.monsterRecipes[0].result = 'naga:plasmaa';
      }),
      /elemen "plasmaa" tidak ada/,
    );
  });

  it('rejects recipe results above the element cap of their form', () => {
    expectRejected(
      corrupt((raw) => {
        raw.recipes.monsterRecipes[0].result = 'naga:waktu';
      }),
      /batas tingkat 4/,
    );
  });

  it('rejects barracks without a known soldier and soldiers with an unknown role', () => {
    expectRejected(
      corrupt((raw) => {
        raw.buildings.buildings.find((b: { id: string }) => b.id === 'barak').trainsSoldier =
          'ksatria';
      }),
      /"barak" \(barracks\) butuh trainsSoldier/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.rules.barracks.soldiers[0].role = 'penyihir';
      }),
      /prajurit "prajurit" peran "penyihir"/,
    );
  });

  it('rejects odds that do not sum to 1', () => {
    expectRejected(
      corrupt((raw) => {
        raw.rules.mixer.formTierOdds.same = 0.7;
      }),
      /formTierOdds/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.rules.mixer.elementOdds.partial = 0.2;
      }),
      /elementOdds/,
    );
  });

  it('rejects malformed files with a clear schema message', () => {
    expectRejected(
      corrupt((raw) => {
        delete raw.rules.mixer.pity;
      }),
      /rules\.json: mixer\.pity/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.forms.forms[0].tier = 'satu';
      }),
      /forms\.json: forms\.0\.tier/,
    );
  });

  it('loads buildings.json with one town hall', () => {
    expect(gameData.townHallId).toBe('balai-utama');
    expect(gameData.maxTownHallLevel).toBe(8);
    expect(gameData.buildingById.get('altar')!.levels[0]!.requiresTownHall).toBe(
      gameData.rules.mixer.unlockTownHallLevel,
    );
  });

  it('rejects overlapping starting buildings', () => {
    expectRejected(
      corrupt((raw) => {
        raw.buildings.village.startingBuildings[1].x = 22;
      }),
      /bertumpuk/,
    );
  });

  it('rejects an Undian Harian table with a non-decoration or out-of-order levels', () => {
    expectRejected(
      corrupt((raw) => {
        raw.rules.marketDraw.tables[0].prizes[0].prize.decorations = ['balai-utama'];
      }),
      /bukan dekorasi/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.rules.marketDraw.tables[1].minLevel = 1;
      }),
      /minLevel harus naik berurutan/,
    );
  });

  it('rejects maxCount tables that do not match the town hall levels', () => {
    expectRejected(
      corrupt((raw) => {
        raw.buildings.buildings[1].maxCount = [1, 2];
      }),
      /maxCount harus berisi 8 angka/,
    );
  });

  it('rejects an Altar that unlocks at a different level than rules.mixer', () => {
    expectRejected(
      corrupt((raw) => {
        const mixer = raw.buildings.buildings.find((b: { id: string }) => b.id === 'altar');
        mixer.levels[0].requiresTownHall = 2;
      }),
      /rules\.mixer\.unlockTownHallLevel/,
    );
  });

  it('loads wilds.json and the bigger map with plots', () => {
    expect(gameData.wilds.nodes.map((n) => n.id)).toEqual([
      'pohon',
      'batu',
      'semak',
      'batu-emas',
      'kaktus',
      'batu-pasir',
      'cemara',
      'batu-es',
    ]);
    const { mapSize, plotSize, initialPlots, plotCostGold } = gameData.village.village;
    expect(mapSize % plotSize).toBe(0);
    expect(plotCostGold.length).toBe((mapSize / plotSize) ** 2 - initialPlots.length);
    expect(gameData.rules.economy.startingResources.wood).toBeGreaterThan(0);
  });

  it('rejects starting buildings outside the initial plots', () => {
    expectRejected(
      corrupt((raw) => {
        raw.buildings.village.startingBuildings[1].x = 2;
      }),
      /plot awal yang terbuka/,
    );
  });

  it('rejects a starting population too small for workers and monsters', () => {
    expectRejected(
      corrupt((raw) => {
        raw.rules.workers.startingWorkers = 50;
      }),
      /populasi awal/,
    );
  });

  it('rejects wild encounters that point at missing forms or stages', () => {
    expectRejected(
      corrupt((raw) => {
        raw.wilds.encounters.levels[1].groups[1].formTier = 9;
      }),
      /formTier 9/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.wilds.encounters.levels[1].groups[1].stage = 'raksasa';
      }),
      /tahap "raksasa"/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.wilds.encounters.groupsByTownHall = [1, 2];
      }),
      /groupsByTownHall/,
    );
  });

  it('rejects staffed buildings without worker slots', () => {
    expectRejected(
      corrupt((raw) => {
        const mine = raw.buildings.buildings.find((b: { id: string }) => b.id === 'tambang-emas');
        delete mine.levels[0].workerSlots;
      }),
      /staffed/,
    );
  });

  it('rejects a Pohon Jiwa level without a heal rate, and a heal rate elsewhere', () => {
    const find = (raw: Record<string, any>, id: string) =>
      raw.buildings.buildings.find((b: { id: string }) => b.id === id);
    expectRejected(
      corrupt((raw) => delete find(raw, 'pohon-jiwa').levels[2].healPercentPerMinute),
      /healPercentPerMinute/,
    );
    expectRejected(
      corrupt((raw) => (find(raw, 'kuburan').levels[0].healPercentPerMinute = 5)),
      /healPercentPerMinute/,
    );
  });

  it('validates rules.guild configuration against guild building levels', () => {
    expectRejected(
      corrupt((raw) => {
        raw.rules.guild.building = 'unknown-guild';
      }),
      /guild\.building.*tidak ada/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.rules.guild.maxMembersByLevel = [10, 20];
      }),
      /guild\.maxMembersByLevel/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.rules.guild.serbuRewardBonusByLevel = [0, 0.05];
      }),
      /guild\.serbuRewardBonusByLevel/,
    );
  });
});
