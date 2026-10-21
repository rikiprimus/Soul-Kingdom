import { describe, expect, it } from 'vitest';
import { adventureNode, attackNode, nodeStatus, regionStatus } from './adventure';
import { deepClone } from './clone';
import {
  DataValidationError,
  gameData,
  loadGameData,
  rawGameData,
  VILLAGE_RESOURCES,
} from './data';
import { maxFormTier } from './mixer';
import { deserializeState, serializeState } from './save';
import type { SerbuCell } from './serbu';
import { createInitialState, type PlayerState } from './state';

const T0 = 1_000_000;
const adult = gameData.rules.growth.stages.at(-1)!.id;
const baby = gameData.rules.growth.stages[0]!.id;
const [r1, r2] = gameData.adventure.regions;
const node = (id: string) => adventureNode(id)!.node;
const first = r1!.nodes[0]!;
const camp = r1!.nodes.find((n) => n.kind === 'camp')!;
const boss1 = r1!.nodes.find((n) => n.kind === 'boss')!;

const setHall = (s: PlayerState, level: number) => {
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = level;
};

/** Balai at region 1's level, three level-5 barracks (a big cap) and a strong army. */
function army(): PlayerState {
  const s = createInitialState(T0, 4);
  setHall(s, r1!.requiresTownHall);
  for (const [i, type] of ['petarung', 'lapangan-panah', 'barak-berkuda'].entries()) {
    s.village.buildings.push({
      id: `bb${i}`,
      type,
      x: 0,
      y: i * 4,
      level: 5,
      construction: null,
      lastCollectAt: T0,
      crop: null,
    });
  }
  for (const [i, form] of ['titan', 'titan', 'naga', 'naga'].entries()) {
    s.monsters.push({ id: `m${i}`, form, element: 'api', stage: adult, food: 0 });
  }
  return s;
}

const cells = (s: PlayerState): SerbuCell[] => s.monsters.map((m, i) => ({ id: m.id, x: 3, y: i }));

function win(s: PlayerState, nodeId: string, now = T0) {
  const r = attackNode(s, { nodeId, cells: cells(s) }, now);
  if (!r.ok) throw new Error(r.error);
  expect(r.result.won).toBe(true);
  return r;
}

describe('petualangan regions and paths', () => {
  it('open regions in order, each needing its Balai level', () => {
    const s = createInitialState(T0, 1);
    expect(regionStatus(s, r1!.id)).toBe('townHall');
    setHall(s, r1!.requiresTownHall);
    expect(regionStatus(s, r1!.id)).toBe('open');
    expect(regionStatus(s, r2!.id)).toBe('locked');
    s.adventure.cleared.push(boss1.id);
    expect(regionStatus(s, r1!.id)).toBe('done');
    expect(regionStatus(s, r2!.id)).toBe('townHall');
    setHall(s, r2!.requiresTownHall);
    expect(regionStatus(s, r2!.id)).toBe('open');
  });

  it('opens nodes along the path as the ones before them fall', () => {
    const s = army();
    expect(nodeStatus(s, first.id, T0)).toBe('open');
    expect(nodeStatus(s, camp.id, T0)).toBe('locked');
    expect(attackNode(s, { nodeId: camp.id, cells: cells(s) }, T0)).toEqual({
      ok: false,
      error: 'notUnlocked',
    });
    const after = win(s, first.id).state;
    expect(nodeStatus(after, camp.id, T0)).toBe('open');
  });
});

describe('petualangan nodes', () => {
  it('pays a resource node every time it is taken, then it refills after refillHours', () => {
    const s = army();
    const r = win(s, first.id);
    for (const res of VILLAGE_RESOURCES) {
      expect(r.state.resources[res]).toBe(s.resources[res] + first.reward[res]);
    }
    const back = T0 + first.refillHours! * 3600;
    expect(r.state.adventure.refillAt[first.id]).toBe(back);
    expect(nodeStatus(r.state, first.id, back - 1)).toBe('refilling');
    expect(attackNode(r.state, { nodeId: first.id, cells: cells(r.state) }, back - 1)).toEqual({
      ok: false,
      error: 'notReady',
    });
    expect(nodeStatus(r.state, first.id, back)).toBe('open');
    const again = win(r.state, first.id, back);
    expect(again.result.first).toBe(false);
    expect(again.state.resources.wood).toBe(r.state.resources.wood + first.reward.wood);
  });

  it('drops a gem from resource nodes at gemChance (Monte Carlo)', () => {
    let s = army();
    let gems = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const now = T0 + i * first.refillHours! * 3600;
      const r = win(s, first.id, now);
      gems += r.result.reward.gems;
      s = { ...s, rngState: r.state.rngState };
    }
    expect(Math.abs(gems / n - first.gemChance)).toBeLessThan(0.03);
  });

  it('pays a camp once and keeps it beaten', () => {
    const s = win(army(), first.id).state;
    const r = win(s, camp.id);
    expect(r.result.first).toBe(true);
    expect(r.state.resources.gold).toBe(s.resources.gold + camp.reward.gold);
    expect(nodeStatus(r.state, camp.id, T0)).toBe('cleared');
    expect(attackNode(r.state, { nodeId: camp.id, cells: cells(r.state) }, T0)).toEqual({
      ok: false,
      error: 'notUnlocked',
    });
  });

  it('a boss raises bossesDefeated once, pays gems and opens the next Soul Mixer tier', () => {
    let s = army();
    for (const n of r1!.nodes.filter((x) => x.kind !== 'boss')) s = win(s, n.id).state;
    const before = maxFormTier(s.bossesDefeated);
    const r = win(s, boss1.id);
    expect(r.state.bossesDefeated).toBe(s.bossesDefeated + 1);
    expect(maxFormTier(r.state.bossesDefeated)).toBe(before + 1);
    expect(r.state.resources.gems).toBe(s.resources.gems + boss1.reward.gems);
    expect(regionStatus(r.state, r1!.id)).toBe('done');
    expect(nodeStatus(r.state, boss1.id, T0)).toBe('cleared');
  });

  it('pays nothing and records nothing on a loss; the fallen go to the Kuburan', () => {
    const s = createInitialState(T0, 2);
    setHall(s, r1!.requiresTownHall);
    s.monsters.push({ id: 'b1', form: 'kucing', element: 'api', stage: baby, food: 0 });
    const r = attackNode(s, { nodeId: first.id, cells: [{ id: 'b1', x: 0, y: 0 }] }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.result.won).toBe(false);
    expect(r.state.adventure).toEqual(s.adventure);
    expect(r.state.resources).toEqual(s.resources);
    expect(r.state.graveyard.map((m) => m.id)).toEqual(['b1']);
  });

  it('every node can be beaten by a strong army (the data has no impossible fights)', () => {
    let s = army();
    setHall(s, gameData.maxTownHallLevel);
    for (const region of gameData.adventure.regions) {
      for (const n of region.nodes) s = win(s, n.id).state;
    }
    expect(s.bossesDefeated).toBe(gameData.adventure.regions.length);
    expect(node(boss1.id).kind).toBe('boss');
  });
});

describe('petualangan data and saves', () => {
  it('rejects paths to later nodes and regions without exactly one boss', () => {
    const later = deepClone(rawGameData) as unknown as { adventure: typeof gameData.adventure };
    later.adventure.regions[0]!.nodes[0]!.after = [later.adventure.regions[0]!.nodes[1]!.id];
    expect(() => loadGameData(later as never)).toThrow(DataValidationError);
    const twoBosses = deepClone(rawGameData) as unknown as { adventure: typeof gameData.adventure };
    twoBosses.adventure.regions[0]!.nodes[0]!.kind = 'boss';
    delete twoBosses.adventure.regions[0]!.nodes[0]!.refillHours;
    expect(() => loadGameData(twoBosses as never)).toThrow(/tepat satu bos/);
  });

  it('round-trips progress and migrates v17 saves with nothing explored', () => {
    const s = win(army(), first.id).state;
    expect(deserializeState(serializeState(s))).toEqual(s);
    const v17 = JSON.parse(serializeState(s)).state;
    delete v17.adventure;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 17, state: v17 }));
    expect(loaded.adventure).toEqual({ cleared: [], refillAt: {} });
  });
});
