import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import {
  buildLine,
  connectedGroup,
  countBuildings,
  levelDef,
  lineTiles,
  maxCountFor,
  upgradeGroup,
  upgradeBuilding,
} from './village';

const T0 = 1_000_000;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** Rich player, Balai high enough for walls, on a map without obstacles. */
function ready(hall = 2): PlayerState {
  const s = createInitialState(T0, 42);
  s.village.obstacles = [];
  s.resources.gold = 1_000_000;
  s.resources.wood = 1_000_000;
  s.resources.stone = 1_000_000;
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = hall;
  const n = gameData.village.village.mapSize / gameData.village.village.plotSize;
  s.village.unlockedPlots = Array.from(
    { length: n * n },
    (_, i) => `${i % n},${Math.floor(i / n)}`,
  );
  return s;
}

const wallsOf = (s: PlayerState) => s.village.buildings.filter((b) => b.type === 'tembok');

describe('lineTiles', () => {
  it('follows the longer axis and includes both ends', () => {
    expect(lineTiles({ x: 2, y: 2 }, { x: 5, y: 3 })).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ]);
    expect(lineTiles({ x: 2, y: 5 }, { x: 3, y: 2 })).toEqual([
      { x: 2, y: 5 },
      { x: 2, y: 4 },
      { x: 2, y: 3 },
      { x: 2, y: 2 },
    ]);
    expect(lineTiles({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
  });
});

describe('buildLine', () => {
  it('builds a whole line of walls at once, finished, for the per-segment price', () => {
    const s = ready();
    const price = levelDef('tembok', 1)!.cost;
    const r = ok(buildLine(s, { type: 'tembok', from: { x: 0, y: 0 }, to: { x: 4, y: 0 } }, T0));
    expect(r.buildingIds).toHaveLength(5);
    expect(wallsOf(r.state).every((w) => w.level === 1 && w.construction === null)).toBe(true);
    for (const res of ['gold', 'food', 'wood', 'stone'] as const) {
      expect(r.state.resources[res]).toBe(s.resources[res] - price[res] * 5);
    }
  });

  it('refuses blocked lines, too many walls, a low Balai and non-line buildings', () => {
    const s = ready();
    const hall = s.village.buildings.find((b) => b.type === gameData.townHallId)!;
    expect(
      buildLine(
        s,
        { type: 'tembok', from: { x: hall.x, y: hall.y - 1 }, to: { x: hall.x, y: hall.y + 1 } },
        T0,
      ),
    ).toEqual({ ok: false, error: 'blocked' });
    const max = maxCountFor(s, 'tembok');
    expect(
      buildLine(s, { type: 'tembok', from: { x: 0, y: 0 }, to: { x: 0, y: max } }, T0),
    ).toEqual({ ok: false, error: 'maxCountReached' });
    expect(
      buildLine(ready(1), { type: 'tembok', from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }, T0),
    ).toEqual({
      ok: false,
      error: 'townHallTooLow',
    });
    expect(buildLine(s, { type: 'bunga', from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }, T0)).toEqual({
      ok: false,
      error: 'notLineBuilding',
    });
    const poor = ready();
    poor.resources.wood = 0;
    expect(
      buildLine(poor, { type: 'tembok', from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }, T0),
    ).toEqual({ ok: false, error: 'notEnoughWood' });
    expect(countBuildings(s, 'tembok')).toBe(0);
  });
});

describe('connected wall upgrades', () => {
  it('finds a connected stretch of same-level walls', () => {
    let s = ready(3);
    s = ok(buildLine(s, { type: 'tembok', from: { x: 0, y: 0 }, to: { x: 3, y: 0 } }, T0)).state;
    s = ok(buildLine(s, { type: 'tembok', from: { x: 3, y: 1 }, to: { x: 3, y: 2 } }, T0)).state;
    s = ok(buildLine(s, { type: 'tembok', from: { x: 6, y: 0 }, to: { x: 7, y: 0 } }, T0)).state;
    const first = wallsOf(s)[0]!;
    expect(connectedGroup(s, first.id)).toHaveLength(6);
    // A wall upgraded on its own splits off from the same-level group.
    s = ok(upgradeBuilding(s, wallsOf(s)[1]!.id, T0)).state;
    expect(connectedGroup(s, first.id)).toHaveLength(1);
  });

  it('upgrades the whole stretch for the per-segment price', () => {
    let s = ready(3);
    s = ok(buildLine(s, { type: 'tembok', from: { x: 0, y: 0 }, to: { x: 4, y: 0 } }, T0)).state;
    const price = levelDef('tembok', 2)!.cost;
    const before = { ...s.resources };
    const r = ok(upgradeGroup(s, wallsOf(s)[2]!.id, T0));
    expect(r.count).toBe(5);
    expect(wallsOf(r.state).every((w) => w.level === 2)).toBe(true);
    for (const res of ['gold', 'food', 'wood', 'stone'] as const) {
      expect(r.state.resources[res]).toBe(before[res] - price[res] * 5);
    }
  });

  it('refuses group upgrades past the Balai level or for other buildings', () => {
    let s = ready(2);
    s = ok(buildLine(s, { type: 'tembok', from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }, T0)).state;
    expect(upgradeGroup(s, wallsOf(s)[0]!.id, T0)).toEqual({ ok: false, error: 'townHallTooLow' });
    const pasar = s.village.buildings.find((b) => b.type === 'pasar')!;
    expect(upgradeGroup(s, pasar.id, T0)).toEqual({ ok: false, error: 'notLineBuilding' });
  });
});
