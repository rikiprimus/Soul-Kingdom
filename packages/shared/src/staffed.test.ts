import { describe, expect, it } from 'vitest';
import { gameData } from './data';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import {
  buildBuilding,
  canPlaceBuilding,
  collectBuilding,
  isReadyToCollect,
  levelDef,
  pendingProduction,
  settleVillage,
  staffBuilding,
  staffWorkers,
  unstaffBuilding,
} from './village';
import { createWorkers, idleWorkers } from './workers';

const T0 = 1_000_000;
const HOUR = 3600;
const mill = levelDef('penggilingan', 1)!;
const rate = mill.staffedProduction!;

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

/** A village with a finished Penggilingan (returned as `id`) and 6 workers; time = `at`. */
function withMill() {
  let s = createInitialState(T0, 31);
  s.village.obstacles = [];
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 1_000_000;
  createWorkers(s, 6 - s.workers.length);
  const r = ok(buildBuilding(s, { type: 'penggilingan', ...freeSpot(s, 2) }, T0));
  const at = T0 + mill.seconds;
  s = settleVillage(r.state, at);
  return { s, id: r.buildingId, at };
}

const mill0 = (s: PlayerState, id: string) => s.village.buildings.find((b) => b.id === id)!;

describe('staffed buildings', () => {
  it('produce per worker inside, and nothing without workers', () => {
    const { s, id, at } = withMill();
    expect(pendingProduction(s, mill0(s, id), at + HOUR)).toBe(0);
    for (let n = 1; n <= mill.workerSlots!; n++) {
      const staffed = ok(staffBuilding(s, id, n, at)).state;
      expect(staffWorkers(staffed, id)).toBe(n);
      expect(idleWorkers(staffed)).toHaveLength(s.workers.length - n);
      expect(pendingProduction(staffed, mill0(staffed, id), at + HOUR)).toBe(
        Math.min(rate.capacity, rate.perWorkerPerHour * n),
      );
    }
  });

  it('keep working while the game is closed, up to the storage capacity', () => {
    const { s, id, at } = withMill();
    const staffed = ok(staffBuilding(s, id, 2, at)).state;
    // No ticks in between: the producer is worked out from the clock on return.
    const back = at + 100 * HOUR;
    const later = settleVillage(staffed, back);
    expect(pendingProduction(later, mill0(later, id), back)).toBe(rate.capacity);
    expect(isReadyToCollect(later, mill0(later, id), back)).toBe(true);
    const r = ok(collectBuilding(later, id, back));
    expect(r.resource).toBe(rate.resource);
    expect(r.amount).toBe(rate.capacity);
    expect(r.state.resources[rate.resource]).toBe(later.resources[rate.resource] + rate.capacity);
    expect(pendingProduction(r.state, mill0(r.state, id), back)).toBe(0);
  });

  it('bank the old output when workers come or go, then use the new rate', () => {
    const { s, id, at } = withMill();
    let state = ok(staffBuilding(s, id, 1, at)).state;
    const added = ok(staffBuilding(state, id, 1, at + HOUR));
    expect(added.collected).toBe(rate.perWorkerPerHour);
    expect(added.state.resources[rate.resource]).toBe(
      state.resources[rate.resource] + rate.perWorkerPerHour,
    );
    state = added.state;
    expect(pendingProduction(state, mill0(state, id), at + 2 * HOUR)).toBe(
      2 * rate.perWorkerPerHour,
    );
    const out = ok(unstaffBuilding(state, id, 2, at + 2 * HOUR));
    expect(out.collected).toBe(2 * rate.perWorkerPerHour);
    expect(staffWorkers(out.state, id)).toBe(0);
    expect(idleWorkers(out.state)).toHaveLength(out.state.workers.length);
    expect(pendingProduction(out.state, mill0(out.state, id), at + 10 * HOUR)).toBe(0);
  });

  it('refuse wrong buildings, too many or missing workers', () => {
    const { s, id, at } = withMill();
    const pasar = s.village.buildings.find((b) => b.type === 'pasar')!;
    expect(staffBuilding(s, pasar.id, 1, at)).toEqual({ ok: false, error: 'notStaffed' });
    expect(staffBuilding(s, id, mill.workerSlots! + 1, at)).toEqual({
      ok: false,
      error: 'tooManyWorkers',
    });
    expect(staffBuilding(s, id, 0, at)).toEqual({ ok: false, error: 'invalidAmount' });
    expect(unstaffBuilding(s, id, 1, at)).toEqual({ ok: false, error: 'noStaff' });
    const busy = ok(staffBuilding(s, id, 1, at)).state;
    busy.workers.forEach((w) => {
      if (w.task.kind === 'idle') w.task = { kind: 'gathering', targetId: 'x' };
    });
    expect(staffBuilding(busy, id, 1, at)).toEqual({ ok: false, error: 'buildersBusy' });
    // A building still under its first construction cannot take workers in.
    s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = 3;
    const fresh = ok(buildBuilding(s, { type: 'penggilingan', ...freeSpot(s, 2) }, at));
    expect(staffBuilding(fresh.state, fresh.buildingId, 1, at)).toEqual({
      ok: false,
      error: 'underConstruction',
    });
  });
});
