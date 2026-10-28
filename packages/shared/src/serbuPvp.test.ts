import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import { createRng } from './rng';
import {
  attackPlayerBase,
  createDefenseSnapshot,
  defaultDefenseCells,
  matchmakeOpponents,
  setDefenseLayout,
  type PvpDefenseCell,
} from './serbuPvp';
import { createInitialState, type PlayerState } from './state';
import { deserializeState, serializeState } from './save';

const T0 = 1_000_000;

function baseState(): PlayerState {
  const s = createInitialState(T0, 42);
  s.resources.gold = 5000;
  s.resources.food = 3000;
  s.resources.wood = 2000;
  s.resources.stone = 2000;
  // Give player 2 adult monsters
  s.monsters = [
    { id: 'm1', form: 'kucing', element: 'angin', stage: 'dewasa', food: 0 },
    { id: 'm2', form: 'anjing', element: 'tanah', stage: 'dewasa', food: 0 },
    { id: 'm3', form: 'elang', element: 'cahaya', stage: 'dewasa', food: 0 },
  ];
  // Give 2 soldiers
  s.soldiers = [
    { id: 's1', kind: 'prajurit', rank: 1 },
    { id: 's2', kind: 'pemanah', rank: 1 },
  ];
  return s;
}

describe('Tugas 2.2 — Serbu markas pemain lain (PvP)', () => {
  it('creates smart default defense cells in the defending zone (x: 8..11)', () => {
    const s = baseState();
    const cells = defaultDefenseCells(s);
    expect(cells.length).toBeGreaterThan(0);
    const { grid, placeColumns } = gameData.rules.serbu;
    const minX = grid.columns - placeColumns;
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(minX);
      expect(c.x).toBeLessThan(grid.columns);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(grid.rows);
    }
  });

  it('allows customizing defense layout and rejects invalid cells', () => {
    const s = baseState();
    const validCells: PvpDefenseCell[] = [
      { id: 'm1', x: 8, y: 0 },
      { id: 'm2', x: 8, y: 1 },
      { id: 's1', x: 9, y: 0 },
    ];
    const r1 = setDefenseLayout(s, validCells);
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.state.pvp.defenseCells).toEqual(validCells);
    }

    // Invalid x (< 8 is attacker zone)
    const invalidX: PvpDefenseCell[] = [{ id: 'm1', x: 2, y: 0 }];
    const r2 = setDefenseLayout(s, invalidX);
    expect(r2.ok).toBe(false);

    // Overlapping cells
    const overlap: PvpDefenseCell[] = [
      { id: 'm1', x: 8, y: 0 },
      { id: 'm2', x: 8, y: 0 },
    ];
    const r3 = setDefenseLayout(s, overlap);
    expect(r3.ok).toBe(false);
  });

  it('creates a defense snapshot suitable for matchmaking', () => {
    const s = baseState();
    const snap = createDefenseSnapshot(s, 'player1', 'Benteng Ricky', T0);
    expect(snap.id).toBe('player1');
    expect(snap.name).toBe('Benteng Ricky');
    expect(snap.power).toBeGreaterThan(0);
    expect(snap.fighters.length).toBeGreaterThan(0);
    expect(snap.resources.gold).toBe(5000);
    expect(snap.trophies).toBe(1000);
  });

  it('matchmakes opponents matching player power, generating procedural bots if needed', () => {
    const rng = createRng(12345);
    const opponents = matchmakeOpponents(80, 1000, [], rng, 3);
    expect(opponents.length).toBe(3);
    for (const opp of opponents) {
      expect(opp.power).toBeGreaterThan(0);
      expect(opp.name.length).toBeGreaterThan(0);
      expect(opp.fighters.length).toBeGreaterThan(0);
    }
  });

  it('simulates attacking another player base and records defense log for replay', () => {
    const attacker = baseState();
    const defenderState = baseState();
    defenderState.resources.gold = 10000;
    defenderState.resources.food = 5000;
    const defenderSnap = createDefenseSnapshot(defenderState, 'def1', 'Musuh Tangguh', T0);

    const attackCells = [
      { id: 'm1', x: 0, y: 0 },
      { id: 'm2', x: 0, y: 1 },
      { id: 'm3', x: 1, y: 0 },
      { id: 's1', x: 1, y: 1 },
      { id: 's2', x: 2, y: 0 },
    ];

    const res = attackPlayerBase(attacker, { defender: defenderSnap, cells: attackCells }, T0);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(typeof res.result.won).toBe('boolean');
      expect(res.result.replay.battle.ticks).toBeGreaterThan(0);
      expect(res.result.replay.attackers.length).toBe(attackCells.length);
      expect(res.result.replay.defenders.length).toBe(defenderSnap.fighters.length);

      // Defense log entry is created with full replay for the defender
      const log = res.defenseLogEntry;
      expect(log.attackerName).toBe('Penyerang');
      expect(log.replay).toBeDefined();
      expect(log.replay.battle.events.length).toBeGreaterThan(0);

      if (res.result.won) {
        expect(res.result.trophiesWon).toBeGreaterThan(0);
        expect(res.result.stolen.gold).toBeGreaterThan(0);
        expect(res.state.resources.gold).toBeGreaterThan(attacker.resources.gold);
      } else {
        expect(res.result.trophiesWon).toBeLessThan(0);
      }
    }
  });

  it('migrates save from v32 to v33 by initializing pvp state', () => {
    const s = baseState();
    const serialized = serializeState(s);
    const parsed = JSON.parse(serialized) as {
      schemaVersion: number;
      state: Record<string, unknown>;
    };

    // Pretend it was v32 without pvp field
    parsed.schemaVersion = 32;
    delete parsed.state.pvp;

    const migrated = deserializeState(JSON.stringify(parsed));
    expect(migrated.pvp).toBeDefined();
    expect(migrated.pvp.trophies).toBe(1000);
    expect(migrated.pvp.defenseCells).toEqual([]);
    expect(migrated.pvp.history).toEqual([]);
  });
});
