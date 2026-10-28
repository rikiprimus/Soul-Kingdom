import { describe, expect, it } from 'vitest';
import { deepClone } from './clone';
import { claimSet, ownsWonder, payPrize, setProgress } from './collections';
import { gameData, type CollectionSet } from './data';
import { claimQuest } from './quests';
import { deserializeState, serializeState } from './save';
import { createInitialState, type ActionResult, type PlayerState } from './state';
import { placeStored } from './storage';
import { buildBuilding, canPlaceBuilding, pendingProduction, productionOf } from './village';

const T0 = 1_000_000;
const { sets } = gameData.collections;
const tierSet = sets.find((s) => s.kind === 'formTier' && !s.reward.wonder)!;
const wonderSet = sets.find((s) => s.reward.wonder)!;
const fireSet = sets.find((s) => s.kind === 'elementUnit' && s.unit === 'api')!;

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

/** Records every item of `set` in the Monsterpedia (with any partner form or element). */
function discoverAll(s: PlayerState, set: CollectionSet): void {
  for (const item of setProgress(s, set).items) {
    s.pedia.monsters.push(item.kind === 'form' ? `${item.id}:api` : `kucing:${item.id}`);
  }
}

describe('collection sets', () => {
  it('a form-tier set wants every form of the tier, any element', () => {
    const s = createInitialState(T0, 1);
    s.pedia.monsters = [];
    const forms = gameData.formsByTier.get(tierSet.kind === 'formTier' ? tierSet.tier : 0)!;
    expect(setProgress(s, tierSet).items.map((i) => i.id)).toEqual(forms.map((f) => f.id));
    s.pedia.monsters.push(`${forms[0]!.id}:air`, `${forms[0]!.id}:api`);
    expect(setProgress(s, tierSet)).toMatchObject({ found: 1, complete: false });
    discoverAll(s, tierSet);
    expect(setProgress(s, tierSet).complete).toBe(true);
  });

  it('an element set wants every plain element with the unit, up to maxUnits', () => {
    const s = createInitialState(T0, 1);
    if (fireSet.kind !== 'elementUnit') throw new Error('bukan set elemen');
    const items = setProgress(s, fireSet).items;
    expect(items.length).toBeGreaterThan(1);
    for (const item of items) {
      const el = gameData.elementById.get(item.id)!;
      expect(el.composition!).toContain(fireSet.unit);
      expect(el.composition!.length).toBeLessThanOrEqual(fireSet.maxUnits);
      expect(el.secret).toBeFalsy();
    }
    const all = [...gameData.elementByComposition.values()].filter(
      (e) => e.composition?.includes(fireSet.unit) && e.composition.length <= fireSet.maxUnits,
    );
    expect(items).toHaveLength(all.length);
  });

  it('pays a complete set once', () => {
    const s = createInitialState(T0, 1);
    expect(claimSet(s, tierSet.id)).toEqual({ ok: false, error: 'notReady' });
    discoverAll(s, tierSet);
    const r = ok(claimSet(s, tierSet.id));
    expect(r.state.resources.gold).toBe(s.resources.gold + tierSet.reward.gold);
    expect(r.state.soulEggs).toHaveLength(s.soulEggs.length + tierSet.reward.soulEggs);
    expect(r.state.collections).toEqual([tierSet.id]);
    expect(claimSet(r.state, tierSet.id)).toEqual({ ok: false, error: 'alreadyClaimed' });
    expect(claimSet(s, 'tidak-ada')).toEqual({ ok: false, error: 'entryNotFound' });
  });
});

describe('Keajaiban', () => {
  const wonder = wonderSet.reward.wonder!;
  const size = gameData.buildingById.get(wonder)!.size;

  const stored = (st: PlayerState) => st.storage.map((x) => x.type);
  const place = (st: PlayerState) =>
    ok(
      placeStored(
        st,
        { itemId: st.storage.find((x) => x.type === wonder)!.id, ...freeSpot(st, size) },
        T0,
      ),
    );

  it('is won from a set into the Gudang, then placed free and at once; never built', () => {
    const s = createInitialState(T0, 1);
    expect(buildBuilding(s, { type: wonder, ...freeSpot(s, size) }, T0)).toEqual({
      ok: false,
      error: 'notUnlocked',
    });
    discoverAll(s, wonderSet);
    const won = ok(claimSet(s, wonderSet.id));
    expect(won.wonder).toBe(true);
    expect(stored(won.state)).toContain(wonder);
    const placed = place(won.state);
    const b = placed.state.village.buildings.find((x) => x.id === placed.buildingId)!;
    expect(b.level).toBe(1);
    expect(placed.state.resources).toEqual(won.state.resources);
    expect(stored(placed.state)).not.toContain(wonder);
    expect(ownsWonder(placed.state, wonder)).toBe(true);
    // It produces a lot over time.
    expect(productionOf(placed.state, b)!.perHour).toBeGreaterThan(0);
    expect(pendingProduction(placed.state, b, T0 + 3600)).toBeGreaterThan(0);
  });

  it('at most one of each kind: a second prize of the same one gives nothing', () => {
    const s = createInitialState(T0, 1);
    const prize = { ...wonderSet.reward, wonder };
    expect(payPrize(s, prize)).toBe(true);
    expect(payPrize(s, prize)).toBe(false);
    expect(stored(s).filter((t) => t === wonder)).toHaveLength(1);
    const placed = place(s).state;
    expect(payPrize(placed, prize)).toBe(false);
    expect(stored(placed)).not.toContain(wonder);
  });

  it('a big quest can give one too, and prize decorations go to the Gudang', () => {
    const index = gameData.quests.chain.findIndex((q) => q.reward.wonder);
    const s = createInitialState(T0, 1);
    s.quest = { index, start: { ...s.actions } };
    for (const g of gameData.quests.chain[index]!.goals) {
      if (g.kind !== 'building') throw new Error('target bukan bangunan');
      s.village.buildings.find((b) => b.type === g.building)!.level = g.level;
    }
    const r = ok(claimQuest(s));
    expect(r.wonder).toBe(true);
    expect(stored(r.state)).toContain(gameData.quests.chain[index]!.reward.wonder);
    const deco = sets.find((x) => x.reward.decorations.length > 0)!;
    const t = createInitialState(T0, 1);
    payPrize(t, deco.reward);
    expect(stored(t)).toEqual(deco.reward.decorations);
  });
});

describe('save', () => {
  it('keeps claimed sets; old saves have none', () => {
    const s = createInitialState(T0, 1);
    s.collections = [tierSet.id];
    expect(deserializeState(serializeState(s)).collections).toEqual(s.collections);
    const old: Partial<PlayerState> = deepClone(s);
    delete old.collections;
    delete old.storage;
    const v21 = deserializeState(JSON.stringify({ schemaVersion: 21, state: old }));
    expect(v21.collections).toEqual([]);
    expect(v21.storage).toEqual([]);
  });
});
