import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { isPlotUnlocked, obstacleDef, plotOf, settleVillage } from './village';
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
      // Gold veins stay as an empty rock; everything else is gone.
      expect(r.state.village.obstacles).toHaveLength(def.refillHours ? 1 : 0);
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

  it('never grows back on open land, only on locked plots', () => {
    const s = createInitialState(T0, 5);
    s.village.obstacles = [];
    const later = regrowWilds(s, T0 + regrow.stepSeconds * regrow.maxSteps);
    expect(later.village.obstacles.length).toBeGreaterThan(0);
    for (const o of later.village.obstacles) {
      const { px, py } = plotOf(o.x, o.y);
      expect(isPlotUnlocked(later.village, px, py)).toBe(false);
    }
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

describe('gold veins (Tugas 1A.14)', () => {
  const veins = gameData.wilds.goldVeins;
  const gold = obstacleDef(veins.node);

  it('places 1-3 clusters of side × side gold nodes in a new village', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = createInitialState(T0, seed);
      const nodes = s.village.obstacles.filter((o) => o.type === veins.node);
      const per = veins.side * veins.side;
      expect(nodes.length % per).toBe(0);
      const clusters = nodes.length / per;
      expect(clusters).toBeGreaterThanOrEqual(veins.clusters[0]);
      expect(clusters).toBeLessThanOrEqual(veins.clusters[1]);
      counts.add(clusters);
      // Each cluster is a full block: every node has neighbours from its own vein.
      for (let i = 0; i < nodes.length; i += per) {
        const block = nodes.slice(i, i + per);
        const xs = block.map((o) => o.x);
        const ys = block.map((o) => o.y);
        expect(Math.max(...xs) - Math.min(...xs)).toBe(veins.side - 1);
        expect(Math.max(...ys) - Math.min(...ys)).toBe(veins.side - 1);
      }
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it('mines gold, turns empty, refuses workers while empty, then fills up again', () => {
    let s = withNode(veins.node);
    s = ok(sendWorkers(s, 'n1', 1)).state;
    const r = advanceWilds(s, gold.work.workSeconds, T0);
    expect(r.gathered[0]!.amount.gold).toBe(gold.yield.gold);
    expect(r.state.resources.gold).toBe(s.resources.gold + gold.yield.gold);
    const empty = r.state.village.obstacles[0]!;
    expect(empty.refillAt).toBe(T0 + gold.refillHours! * 3600);
    expect(empty.work).toBe(0);
    expect(sendWorkers(r.state, 'n1', 1)).toEqual({ ok: false, error: 'notAvailableYet' });
    // Still empty a second before, full again at refill time (also after a long absence).
    expect(regrowWilds(r.state, empty.refillAt! - 1).village.obstacles[0]!.refillAt).toBe(
      empty.refillAt,
    );
    const full = regrowWilds(r.state, empty.refillAt! + 10 * 24 * 3600);
    expect(full.village.obstacles.find((o) => o.id === 'n1')!.refillAt).toBeNull();
    expect(sendWorkers(full, 'n1', 1).ok).toBe(true);
  });

  it('is never scattered or regrown at random', () => {
    expect(gold.weight).toBe(0);
    expect(gold.regrow.maxPerPlot).toBe(0);
    const s = createInitialState(T0, 5);
    const before = s.village.obstacles.filter((o) => o.type === veins.node).length;
    const later = regrowWilds(s, T0 + 48 * 3600);
    expect(later.village.obstacles.filter((o) => o.type === veins.node).length).toBe(before);
  });

  it('adds gold veins to old saves (migration v14)', () => {
    const v14 = deepClone(createInitialState(T0, 9)) as unknown as {
      village: { obstacles: { type: string }[] };
    };
    v14.village.obstacles = v14.village.obstacles.filter((o) => o.type !== veins.node);
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 14, state: v14 }));
    const n = loaded.village.obstacles.filter((o) => o.type === veins.node).length;
    expect(n).toBeGreaterThanOrEqual(veins.clusters[0] * veins.side * veins.side);
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});
