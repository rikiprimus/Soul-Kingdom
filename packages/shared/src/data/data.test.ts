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
  it('loads 66 elements with the expected unit counts', () => {
    const all = gameData.elements.elements;
    expect(all).toHaveLength(66);
    const normal = all.filter((e) => !e.secret);
    const byUnits = (n: number) => normal.filter((e) => e.composition.length === n).length;
    expect([1, 2, 3, 4, 5, 6].map(byUnits)).toEqual([6, 15, 20, 15, 6, 1]);
    expect(all.filter((e) => e.secret)).toHaveLength(3);
  });

  it('loads 23 forms across 5 tiers', () => {
    expect(gameData.forms.forms).toHaveLength(23);
    expect(gameData.formTiers).toEqual([1, 2, 3, 4, 5]);
  });

  it('indexes non-secret elements by composition', () => {
    expect(gameData.elementByComposition.size).toBe(63);
  });

  it('rejects a composition with a non-base unit', () => {
    expectRejected(
      corrupt((raw) => {
        raw.elements.elements[6].composition = ['api', 'logam'];
      }),
      /unsur bukan dasar "logam"/,
    );
  });

  it('rejects two non-secret elements with the same composition', () => {
    expectRejected(
      corrupt((raw) => {
        raw.elements.elements[7].composition = ['air', 'api'];
      }),
      /punya komposisi sama/,
    );
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

  it('rejects recipe or starting monsters above the element cap of their form', () => {
    expectRejected(
      corrupt((raw) => {
        raw.recipes.monsterRecipes[0].result = 'naga:waktu';
      }),
      /batas tingkat 4/,
    );
    expectRejected(
      corrupt((raw) => {
        raw.rules.economy.startingMonsters[0].element = 'uap';
      }),
      /startingMonsters\[0\].*batas tingkat 1/,
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
    expect(gameData.maxTownHallLevel).toBe(6);
    expect(gameData.buildingById.get('soul-mixer')!.levels[0]!.requiresTownHall).toBe(
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

  it('rejects maxCount tables that do not match the town hall levels', () => {
    expectRejected(
      corrupt((raw) => {
        raw.buildings.buildings[1].maxCount = [1, 2];
      }),
      /maxCount harus berisi 6 angka/,
    );
  });

  it('rejects a Soul Mixer that unlocks at a different level than rules.mixer', () => {
    expectRejected(
      corrupt((raw) => {
        const mixer = raw.buildings.buildings.find((b: { id: string }) => b.id === 'soul-mixer');
        mixer.levels[0].requiresTownHall = 2;
      }),
      /rules\.mixer\.unlockTownHallLevel/,
    );
  });

  it('loads wilds.json and the bigger map with plots', () => {
    expect(gameData.wilds.nodes.map((n) => n.id)).toEqual(['pohon', 'batu', 'semak']);
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
});
