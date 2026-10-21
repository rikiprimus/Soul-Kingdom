import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { obstacleDef, plotOf, settleVillage } from './village';
import {
  advanceWilds,
  gatherRemaining,
  gatherWorkers,
  recallWorkers,
  regrowWilds,
  sendWorkers,
} from './wilds';
import { createWorkers, idleWorkers } from './workers';

const T0 = 1_000_000;
const { nodes, regrow } = gameData.wilds;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

/** A village with one node of `type` and plenty of idle workers. */
function withNode(type: string, workers = 6): PlayerState {
  const s = createInitialState(T0, 21);
  s.village.obstacles = [{ id: 'n1', type, x: 0, y: 0, work: 0 }];
  s.workers = s.workers.slice(0, workers);
  createWorkers(s, workers - s.workers.length);
  return s;
}

describe('gathering wild nodes', () => {
  it('pays out the node yield and frees the workers', () => {
    for (const def of nodes) {
      let s = withNode(def.id);
      s = ok(sendWorkers(s, 'n1', 1)).state;
      expect(gatherWorkers(s, 'n1')).toBe(1);
      const r = advanceWilds(s, def.work.workSeconds, T0);
      expect(r.gathered).toHaveLength(1);
      expect(r.state.village.obstacles).toHaveLength(0);
      for (const res of ['gold', 'food', 'wood', 'stone'] as const) {
        expect(r.state.resources[res]).toBe(s.resources[res] + def.yield[res]);
      }
      expect(r.state.resources.soulCrystal).toBe(
        s.resources.soulCrystal + r.gathered[0]!.soulCrystal,
      );
      expect(idleWorkers(r.state)).toHaveLength(r.state.workers.length);
    }
    expect(obstacleDef('pohon').yield.wood).toBeGreaterThan(0);
    expect(obstacleDef('batu').yield.stone).toBeGreaterThan(0);
    expect(obstacleDef('semak').yield.food).toBeGreaterThan(0);
  });

  it('goes faster with more workers, up to the node capacity', () => {
    const def = obstacleDef('pohon');
    for (let n = 1; n <= def.work.maxWorkers; n++) {
      const s = ok(sendWorkers(withNode('pohon'), 'n1', n)).state;
      const node = s.village.obstacles[0]!;
      expect(gatherRemaining(s, node)).toBeCloseTo(def.work.workSeconds / n);
      const almost = advanceWilds(s, def.work.workSeconds / n - 1, T0);
      expect(almost.gathered).toHaveLength(0);
      expect(almost.state.village.obstacles[0]!.work).toBeCloseTo(def.work.workSeconds - n);
      expect(advanceWilds(almost.state, 1, T0).gathered).toHaveLength(1);
    }
    const s = withNode('pohon');
    expect(sendWorkers(s, 'n1', def.work.maxWorkers + 1)).toEqual({
      ok: false,
      error: 'tooManyWorkers',
    });
    expect(sendWorkers(s, 'n1', 0)).toEqual({ ok: false, error: 'invalidAmount' });
    expect(sendWorkers(s, 'nope', 1)).toEqual({ ok: false, error: 'obstacleNotFound' });
    expect(sendWorkers(withNode('pohon', 1), 'n1', 2)).toEqual({
      ok: false,
      error: 'buildersBusy',
    });
  });

  it('keeps the work done when workers are called back', () => {
    let s = ok(sendWorkers(withNode('batu'), 'n1', 2)).state;
    s = advanceWilds(s, 10, T0).state;
    expect(s.village.obstacles[0]!.work).toBe(20);
    s = ok(recallWorkers(s, 'n1')).state;
    expect(gatherWorkers(s, 'n1')).toBe(0);
    expect(gatherRemaining(s, s.village.obstacles[0]!)).toBeNull();
    expect(advanceWilds(s, 100, T0).state.village.obstacles[0]!.work).toBe(20);
    expect(recallWorkers(s, 'n1')).toEqual({ ok: false, error: 'notGathering' });
  });

  it('does not progress while the game is closed', () => {
    const s = ok(sendWorkers(withNode('pohon'), 'n1', 1)).state;
    // Coming back hours later: settling the village never adds gathering work.
    const later = settleVillage(s, T0 + 10 * 3600);
    expect(later.village.obstacles[0]!.work).toBe(0);
    expect(advanceWilds(s, 0, T0).state).toBe(s);
    expect(advanceWilds(withNode('pohon'), 60, T0).state.village.obstacles[0]!.work).toBe(0);
  });

  it('drops soul crystals at the configured chance (Monte Carlo)', () => {
    const def = [...nodes].sort((a, b) => b.soulCrystalChance - a.soulCrystalChance)[0]!;
    let s = withNode(def.id, def.work.maxWorkers);
    let crystals = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      s.village.obstacles = [{ id: 'n1', type: def.id, x: 0, y: 0, work: 0 }];
      s.workers[0]!.task = { kind: 'gathering', targetId: 'n1' };
      const r = advanceWilds(s, def.work.workSeconds, T0);
      crystals += r.gathered[0]!.soulCrystal;
      s = r.state;
    }
    expect(Math.abs(crystals / n - def.soulCrystalChance)).toBeLessThan(0.01);
  });
});

describe('regrowing wild nodes', () => {
  function perPlot(s: PlayerState) {
    const counts = new Map<string, number>();
    for (const o of s.village.obstacles) {
      const { px, py } = plotOf(o.x, o.y);
      const k = [px, py, o.type].join(',');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }

  it('grows nodes back step by step without passing the plot limit', () => {
    const s = createInitialState(T0, 5);
    s.village.obstacles = [];
    expect(regrowWilds(s, T0 + regrow.stepSeconds - 1)).toBe(s);
    const one = regrowWilds(s, T0 + regrow.stepSeconds);
    expect(one.village.obstacles.length).toBeGreaterThan(0);
    expect(one.village.regrowAt).toBe(T0 + regrow.stepSeconds);
    const long = regrowWilds(s, T0 + regrow.stepSeconds * regrow.maxSteps * 10);
    for (const [k, count] of perPlot(long)) {
      const type = k.split(',')[2]!;
      expect(count).toBeLessThanOrEqual(obstacleDef(type).regrow.maxPerPlot);
    }
    for (const o of long.village.obstacles) expect(o.work).toBe(0);
    const ids = long.village.obstacles.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never grows on buildings and is deterministic', () => {
    const s = createInitialState(T0, 9);
    const at = T0 + regrow.stepSeconds * 30;
    const a = regrowWilds(s, at);
    expect(regrowWilds(deepClone(s), at)).toEqual(a);
    const taken = new Set<string>();
    for (const b of a.village.buildings) {
      const size = gameData.buildingById.get(b.type)!.size;
      for (let dx = 0; dx < size; dx++) {
        for (let dy = 0; dy < size; dy++) taken.add([b.x + dx, b.y + dy].join(','));
      }
    }
    for (const o of a.village.obstacles) expect(taken.has([o.x, o.y].join(','))).toBe(false);
  });
});

describe('save migration v6', () => {
  it('adds gathered work to nodes and a regrowth clock', () => {
    const s = createInitialState(T0, 4);
    const v6 = deepClone(s) as unknown as {
      village: { obstacles: Record<string, unknown>[]; regrowAt?: number };
    };
    for (const o of v6.village.obstacles) delete o.work;
    delete v6.village.regrowAt;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 6, state: v6 }));
    expect(loaded.village.obstacles.every((o) => o.work === 0)).toBe(true);
    expect(loaded.village.regrowAt).toBe(T0);
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});
