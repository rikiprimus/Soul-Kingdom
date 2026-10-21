import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { sendTeam } from './missions';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { guardNode, guardsOf, moveUnits, settleUnits, unitPoint, unitTile } from './units';
import { canPlaceBuilding, isTileUnlocked } from './village';

const T0 = 1_000_000;
const speed = gameData.rules.units.walkTilesPerSecond;
const adult = gameData.rules.growth.stages.at(-1)!.id;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** A village with two monsters and a soldier, all placed near the Kandang. */
function village(): PlayerState {
  const s = createInitialState(T0, 31);
  s.monsters.push(
    { id: 'm1', form: 'kucing', element: 'api', stage: adult, food: 0 },
    { id: 'm2', form: 'anjing', element: 'air', stage: adult, food: 0 },
  );
  s.soldiers.push({ id: 's1', kind: 'prajurit', rank: 0 });
  return settleUnits(s, T0);
}

/** A free open tile some distance away from where the units start. */
function farTile(s: PlayerState) {
  const home = s.units.m1!;
  const { mapSize } = gameData.village.village;
  for (let r = 6; r < mapSize; r++) {
    for (const [x, y] of [
      [home.x + r, home.y],
      [home.x - r, home.y],
      [home.x, home.y + r],
      [home.x, home.y - r],
    ] as const) {
      if (canPlaceBuilding(s.village, 1, x, y)) return { x, y };
    }
  }
  throw new Error('tidak ada petak bebas');
}

describe('unit places', () => {
  it('gives every monster and soldier its own free tile near the Kandang', () => {
    const s = village();
    expect(Object.keys(s.units).sort()).toEqual(['m1', 'm2', 's1']);
    const spots = new Set(Object.values(s.units).map((p) => `${p.x},${p.y}`));
    expect(spots.size).toBe(3);
    for (const p of Object.values(s.units)) {
      expect(canPlaceBuilding(s.village, 1, p.x, p.y)).toBe(true);
      expect(p.path).toEqual([]);
    }
    // Nothing to do: the same object comes back.
    expect(settleUnits(s, T0 + 5)).toBe(s);
    // Gone units are dropped.
    const fewer = deepClone(s);
    fewer.soldiers = [];
    expect(Object.keys(settleUnits(fewer, T0).units).sort()).toEqual(['m1', 'm2']);
  });
});

describe('moveUnits', () => {
  it('walks the group to free tiles around the target along open paths, then stands', () => {
    const s = village();
    const to = farTile(s);
    const r = ok(moveUnits(s, { ids: ['m1', 'm2', 's1'], ...to }, T0));
    expect(r.moved).toEqual(['m1', 'm2', 's1']);
    const ends = r.moved.map((id) => r.state.units[id]!.path.at(-1)!);
    expect(new Set(ends.map((t) => `${t.x},${t.y}`)).size).toBe(3);
    expect(ends[0]).toEqual(to);
    for (const id of r.moved) {
      const p = r.state.units[id]!;
      // Every step is one tile over open land.
      let prev = { x: p.x, y: p.y };
      for (const t of p.path) {
        expect(Math.abs(t.x - prev.x) + Math.abs(t.y - prev.y)).toBe(1);
        expect(canPlaceBuilding(r.state.village, 1, t.x, t.y)).toBe(true);
        prev = t;
      }
      const end = p.path.at(-1)!;
      expect(unitTile(p, T0 + p.path.length / speed)).toEqual(end);
      const half = unitPoint(p, T0 + 0.5 / speed);
      expect(Math.abs(half.x - p.x) + Math.abs(half.y - p.y)).toBeCloseTo(0.5);
    }
    // Once there, settling folds the walk into the standing tile.
    const longest = Math.max(...r.moved.map((id) => r.state.units[id]!.path.length));
    const later = settleUnits(r.state, T0 + Math.ceil(longest / speed) + 1);
    expect(later.units.m1).toMatchObject({ x: to.x, y: to.y, path: [] });
  });

  it('refuses locked land, blocked or off-map tiles, busy units and bad teams', () => {
    const s = village();
    const { mapSize } = gameData.village.village;
    let locked = { x: -1, y: -1 };
    for (let y = 0; y < mapSize && locked.x < 0; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (!isTileUnlocked(s.village, x, y)) {
          locked = { x, y };
          break;
        }
      }
    }
    expect(moveUnits(s, { ids: ['m1'], ...locked }, T0)).toEqual({
      ok: false,
      error: 'plotLocked',
    });
    expect(moveUnits(s, { ids: ['m1'], x: -1, y: 0 }, T0)).toEqual({ ok: false, error: 'blocked' });
    expect(moveUnits(s, { ids: [], ...farTile(s) }, T0)).toEqual({
      ok: false,
      error: 'invalidAmount',
    });
    expect(moveUnits(s, { ids: ['zz'], ...farTile(s) }, T0)).toEqual({
      ok: false,
      error: 'monsterNotFound',
    });
    const away = ok(
      sendTeam(s, { monsterIds: ['m1'], encounterId: s.village.encounters[0]!.id }, T0),
    );
    expect(moveUnits(away.state, { ids: ['m1'], ...farTile(s) }, T0)).toEqual({
      ok: false,
      error: 'monsterBusy',
    });
  });

  it('keeps where everyone stands and walks through save and load', () => {
    const s = village();
    const r = ok(moveUnits(s, { ids: ['m1', 's1'], ...farTile(s) }, T0));
    expect(deserializeState(serializeState(r.state))).toEqual(r.state);
  });
});

describe('guardNode', () => {
  it('posts the units around a wild node and stands them down when it is gone', () => {
    const s = village();
    const node = s.village.obstacles.find((o) => isTileUnlocked(s.village, o.x, o.y))!;
    const r = ok(guardNode(s, { ids: ['m2', 's1'], obstacleId: node.id }, T0));
    expect(guardsOf(r.state, node.id).sort()).toEqual(['m2', 's1']);
    for (const id of ['m2', 's1']) {
      const end = r.state.units[id]!.path.at(-1) ?? r.state.units[id]!;
      expect(Math.max(Math.abs(end.x - node.x), Math.abs(end.y - node.y))).toBeLessThanOrEqual(3);
    }
    expect(guardNode(s, { ids: ['m2'], obstacleId: 'nope' }, T0)).toEqual({
      ok: false,
      error: 'obstacleNotFound',
    });
    const cleared = deepClone(r.state);
    cleared.village.obstacles = cleared.village.obstacles.filter((o) => o.id !== node.id);
    expect(guardsOf(settleUnits(cleared, T0 + 1), node.id)).toEqual([]);
  });
});

describe('save migration v13', () => {
  it('places every unit near the Kandang on load', () => {
    const v13 = deepClone(village()) as unknown as Record<string, unknown>;
    delete v13.units;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 13, state: v13 }));
    expect(loaded.units).toEqual({});
    expect(Object.keys(settleUnits(loaded, T0).units).sort()).toEqual(['m1', 'm2', 's1']);
  });
});
