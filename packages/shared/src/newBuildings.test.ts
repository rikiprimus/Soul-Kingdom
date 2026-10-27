import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import {
  buildBuilding,
  canPlaceBuilding,
  collectBuilding,
  levelDef,
  maxCountFor,
  pendingProduction,
  settleVillage,
  staffBuilding,
} from './village';
import { createWorkers, decorationPopulation, populationCap } from './workers';

// Tugas 1C.3: Tambang Batu, Tukang Kayu and Rumah Bangsawan (mansion).
const T0 = 1_000_000;
const HOUR = 3600;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

function freeSpot(s: PlayerState, size: number) {
  const { mapSize } = gameData.village.village;
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) if (canPlaceBuilding(s.village, size, x, y)) return { x, y };
  }
  throw new Error('peta penuh');
}

/** A rich village at Balai `hall` with all land open, no wilds and 6 workers. */
function rich(hall: number): PlayerState {
  const s = createInitialState(T0, 41);
  s.village.obstacles = [];
  s.village.encounters = [];
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 10_000_000;
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = hall;
  const n = gameData.village.village.mapSize / gameData.village.village.plotSize;
  s.village.unlockedPlots = Array.from(
    { length: n * n },
    (_, i) => `${i % n},${Math.floor(i / n)}`,
  );
  createWorkers(s, 6 - s.workers.length);
  return s;
}

function built(s: PlayerState, type: string) {
  const r = ok(
    buildBuilding(s, { type, ...freeSpot(s, gameData.buildingById.get(type)!.size) }, T0),
  );
  const at = T0 + levelDef(type, 1)!.seconds;
  return { s: settleVillage(r.state, at), id: r.buildingId, at };
}

describe('Tambang Batu and Tukang Kayu', () => {
  for (const [type, resource, hall] of [
    ['tambang-batu', 'stone', 2],
    ['tukang-kayu', 'wood', 1],
  ] as const) {
    it(`${type} makes ${resource} with a worker inside, also while the game is closed`, () => {
      const def = gameData.buildingById.get(type)!;
      expect(def.feature).toBe('staffed');
      expect(def.levels[0]!.requiresTownHall).toBe(hall);

      const { s, id, at } = built(rich(hall), type);
      const rate = levelDef(type, 1)!.staffedProduction!;
      expect(rate.resource).toBe(resource);
      const b = () => staffed.village.buildings.find((x) => x.id === id)!;
      const staffed = ok(staffBuilding(s, id, 1, at)).state;
      expect(pendingProduction(staffed, b(), at + HOUR)).toBe(rate.perWorkerPerHour);
      const back = at + 100 * HOUR;
      const later = settleVillage(staffed, back);
      const r = ok(collectBuilding(later, id, back));
      expect(r.resource).toBe(resource);
      expect(r.amount).toBe(rate.capacity);
      expect(r.state.resources[resource]).toBe(later.resources[resource] + rate.capacity);
    });
  }

  it('follow the owner’s worker slots 1/1/2/2/3/4/5/6 over 8 levels', () => {
    for (const type of ['tambang-batu', 'tukang-kayu', 'tambang-emas', 'penggilingan']) {
      const slots = gameData.buildingById.get(type)!.levels.map((l) => l.workerSlots);
      expect(slots).toEqual([1, 1, 2, 2, 3, 4, 5, 6]);
    }
  });
});

describe('Rumah Bangsawan', () => {
  it('opens at Balai 4 and gives far more population than a Rumah', () => {
    const def = gameData.buildingById.get('mansion')!;
    expect(def.feature).toBe('house');
    expect(maxCountFor(rich(3), 'mansion')).toBe(0);
    expect(maxCountFor(rich(4), 'mansion')).toBe(1);
    const base = rich(4);
    const { s } = built(base, 'mansion');
    expect(populationCap(s)).toBe(populationCap(base) + levelDef('mansion', 1)!.population!);
    expect(levelDef('mansion', 1)!.population!).toBeGreaterThan(
      levelDef('rumah', 1)!.population! * 2,
    );
  });
});

describe('decoration population (Tugas 1C.4)', () => {
  const { decorationCategory, decorationCapByTownHall } = gameData.rules.population;
  const decorations = () =>
    gameData.village.buildings.filter((b) => b.category === decorationCategory);

  /** `type` built `count` times as finished decorations on the village. */
  function withDecorations(hall: number, type: string, count: number) {
    const s = rich(hall);
    s.village.buildings = s.village.buildings.filter(
      (b) => gameData.buildingById.get(b.type)?.category !== decorationCategory,
    );
    const base = populationCap(s);
    for (let i = 0; i < count; i++) {
      s.village.buildings.push({
        id: `deco${i}`,
        type,
        x: i % 40,
        y: 40 + Math.floor(i / 40),
        level: 1,
        construction: null,
        lastCollectAt: T0,
        crop: null,
      });
    }
    return { s, base };
  }

  it('every decoration gives population, the Monumen Keajaiban most of all', () => {
    for (const d of decorations()) expect(d.levels[0]!.population).toBeGreaterThan(0);
    const monument = gameData.buildingById.get('monumen-keajaiban')!;
    expect(monument.size).toBe(2);
    expect(monument.levels[0]!.requiresTownHall).toBe(5);
    expect(monument.maxCount).toEqual([0, 0, 0, 0, 2, 2, 2, 2]);
    expect(monument.levels[0]!.population).toBe(
      Math.max(...decorations().map((d) => d.levels[0]!.population!)),
    );
  });

  it('counts only up to the cap of the Balai Utama level', () => {
    decorationCapByTownHall.forEach((cap, i) => {
      const { s, base } = withDecorations(i + 1, 'pohon-hias', 60);
      const d = decorationPopulation(s);
      expect(d).toEqual({ raw: 120, cap, counted: Math.min(120, cap) });
      expect(populationCap(s)).toBe(base + Math.min(120, cap));
    });
    for (let i = 1; i < decorationCapByTownHall.length; i++) {
      expect(decorationCapByTownHall[i]).toBeGreaterThan(decorationCapByTownHall[i - 1]!);
    }
  });

  it('a few decorations under the cap count in full', () => {
    const { s, base } = withDecorations(1, 'bunga', 2);
    expect(decorationPopulation(s).counted).toBe(4);
    expect(populationCap(s)).toBe(base + 4);
  });
});
