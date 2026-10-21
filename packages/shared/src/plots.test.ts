import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { gameData } from './data';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import {
  buildBuilding,
  buildLine,
  buyPlot,
  canPlaceBuilding,
  isTileUnlocked,
  moveBuilding,
  nextPlotPrice,
  plotOf,
  plotStatus,
} from './village';

const T0 = 1_000_000;
const { plotSize, initialPlots, plotCostGold, plotRequiresTownHall } = gameData.village.village;

function ok<T extends object>(result: ActionResult<T>) {
  if (!result.ok) throw new Error(`Aksi gagal: ${result.error}`);
  return result;
}

function rich(hall = 1): PlayerState {
  const s = createInitialState(T0, 42);
  s.village.obstacles = [];
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) s.resources[r] = 10_000_000;
  s.village.buildings.find((b) => b.type === gameData.townHallId)!.level = hall;
  return s;
}

/** A locked plot next to the starting land, and one far away. */
const [ix, iy] = initialPlots[0]!;
const next = { px: ix - 1, py: iy };
const far = { px: 0, py: 0 };

describe('plots', () => {
  it('starts with only the initial plots open', () => {
    const s = createInitialState(T0, 1);
    expect(s.village.unlockedPlots.sort()).toEqual(
      initialPlots.map(([x, y]) => `${x},${y}`).sort(),
    );
    expect(isTileUnlocked(s.village, ix * plotSize, iy * plotSize)).toBe(true);
    expect(isTileUnlocked(s.village, 0, 0)).toBe(false);
    expect(plotOf(plotSize * 2 + 3, plotSize - 1)).toEqual({ px: 2, py: 0 });
  });

  it('refuses buildings, walls and moves on locked land', () => {
    const s = rich(2);
    const x = next.px * plotSize + 2;
    const y = next.py * plotSize + 2;
    expect(canPlaceBuilding(s.village, 1, x, y)).toBe(false);
    expect(buildBuilding(s, { type: 'bunga', x, y }, T0)).toEqual({
      ok: false,
      error: 'plotLocked',
    });
    expect(buildLine(s, { type: 'tembok', from: { x, y }, to: { x, y: y + 2 } }, T0)).toEqual({
      ok: false,
      error: 'plotLocked',
    });
    const flowers = s.village.buildings.find((b) => b.type === 'bunga')!;
    expect(moveBuilding(s, { buildingId: flowers.id, x, y })).toEqual({
      ok: false,
      error: 'plotLocked',
    });
  });

  it('buys adjacent plots in order, at rising prices, then allows building there', () => {
    let s = rich(5);
    const gold = s.resources.gold;
    expect(nextPlotPrice(s.village)).toEqual({
      gold: plotCostGold[0],
      requiresTownHall: plotRequiresTownHall[0],
    });
    const r = ok(buyPlot(s, next));
    expect(r.state.resources.gold).toBe(gold - plotCostGold[0]!);
    expect(nextPlotPrice(r.state.village)!.gold).toBe(plotCostGold[1]);
    s = r.state;
    const x = next.px * plotSize + 2;
    const y = next.py * plotSize + 2;
    expect(buildBuilding(s, { type: 'bunga', x, y }, T0).ok).toBe(true);
  });

  it('refuses plots that are open, far away, out of the map, too early or unaffordable', () => {
    const s = rich(5);
    expect(buyPlot(s, { px: ix, py: iy })).toEqual({ ok: false, error: 'plotAlreadyOpen' });
    expect(buyPlot(s, far)).toEqual({ ok: false, error: 'plotNotAdjacent' });
    expect(buyPlot(s, { px: -1, py: 0 })).toEqual({ ok: false, error: 'plotOutOfMap' });
    const poor = deepClone(s);
    poor.resources.gold = 0;
    expect(buyPlot(poor, next)).toEqual({ ok: false, error: 'notEnoughGold' });
    // Push the purchase count past the Balai requirement of the next plot.
    const early = rich(1);
    const needed = plotRequiresTownHall.findIndex((th) => th > 1);
    for (let i = 0; i < needed; i++) early.village.unlockedPlots.push(`fake${i},0`);
    expect(plotStatus(early, next.px, next.py)).toBe('needsTownHall');
    expect(buyPlot(early, next)).toEqual({ ok: false, error: 'townHallTooLow' });
  });
});

describe('save migration v4', () => {
  it('opens the starting plots and every plot under an existing building', () => {
    const v5 = createInitialState(T0, 5);
    const outside = { ...v5.village.buildings[0]!, id: 'far', type: 'bunga', x: 1, y: 1 };
    v5.village.buildings.push(outside);
    const v4 = deepClone(v5) as unknown as { village: Record<string, unknown> };
    delete v4.village.unlockedPlots;
    const loaded = deserializeState(JSON.stringify({ schemaVersion: 4, state: v4 }));
    expect(loaded.village.unlockedPlots).toContain('0,0');
    for (const [px, py] of initialPlots)
      expect(loaded.village.unlockedPlots).toContain(`${px},${py}`);
    expect(deserializeState(serializeState(loaded))).toEqual(loaded);
  });
});
