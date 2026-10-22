import { z } from 'zod';
import { careSoulEgg, hatchSoulEgg } from '../nest';
import { claimSet } from '../collections';
import { claimDaily, claimQuest } from '../quests';
import { sendToAnimal } from '../animals';
import { hatchEgg, trainSoldier } from '../barracks';
import { travelTo, unlockIsland } from '../islands';
import { reviveMonster, sendTeam } from '../missions';
import { attackNode } from '../adventure';
import { attackBase } from '../serbu';
import {
  buyMixerSlot,
  cancelMix,
  collectMix,
  confirmMix,
  feedMonster,
  prophesy,
  speedUp,
  speedUpCost,
  startMix,
  type ActionResult,
  type PlayerState,
} from '../state';
import { placeStored, rotateBuilding, storeBuilding } from '../storage';
import { guardNode, moveUnits, retreatUnits } from '../units';
import {
  addConstructionWorkers,
  buildBuilding,
  buildLine,
  buyPlot,
  collectAll,
  collectBuilding,
  harvestCrop,
  moveBuilding,
  moveGroup,
  plantCrop,
  sellBuilding,
  speedUpBuilding,
  staffBuilding,
  unstaffBuilding,
  upgradeBuilding,
  upgradeGroup,
} from '../village';
import { recallWorkers, sendWorkers } from '../wilds';
import { releaseMonster, trainWorker } from '../workers';

const id = z.string().min(1).max(64);
const count = z.number().int().min(1).max(1000);
const tile = z.number().int().min(0).max(1000);
const point = z.object({ x: tile, y: tile });
const ids = z.array(id).min(1).max(50);
const byId = z.object({ id });

/** One player action: its parameters (checked on the server) and the shared function it runs. */
function action<P extends z.ZodTypeAny, R extends object>(
  params: P,
  run: (state: PlayerState, params: z.infer<P>, now: number) => ActionResult<R>,
) {
  return { params, run };
}

/**
 * Every action a player can take, by name. The client runs it at once for a quick
 * answer; the server runs the same code with its own clock and keeps the result.
 */
export const ACTIONS = {
  buyPlot: action(z.object({ px: tile, py: tile }), (s, p) => buyPlot(s, p)),
  buildBuilding: action(point.extend({ type: id, workers: count.optional() }), (s, p, now) =>
    buildBuilding(s, p, now),
  ),
  buildLine: action(z.object({ type: id, from: point, to: point }), (s, p, now) =>
    buildLine(s, p, now),
  ),
  upgradeBuilding: action(byId.extend({ workers: count.optional() }), (s, p, now) =>
    upgradeBuilding(s, p.id, now, { workers: p.workers }),
  ),
  upgradeGroup: action(byId, (s, p, now) => upgradeGroup(s, p.id, now)),
  addConstructionWorkers: action(byId.extend({ count }), (s, p, now) =>
    addConstructionWorkers(s, p.id, p.count, now),
  ),
  speedUpBuilding: action(byId, (s, p, now) => speedUpBuilding(s, p.id, now, speedUpCost)),
  moveBuilding: action(point.extend({ buildingId: id }), (s, p) => moveBuilding(s, p)),
  moveGroup: action(point.extend({ buildingId: id }), (s, p) => moveGroup(s, p)),
  rotateBuilding: action(byId, (s, p) => rotateBuilding(s, p.id)),
  storeBuilding: action(byId, (s, p, now) => storeBuilding(s, p.id, now)),
  placeStored: action(point.extend({ itemId: id }), (s, p, now) => placeStored(s, p, now)),
  sellBuilding: action(byId, (s, p, now) => sellBuilding(s, p.id, now)),
  collectBuilding: action(byId, (s, p, now) => collectBuilding(s, p.id, now)),
  collectAll: action(z.object({}), (s, _p, now) => collectAll(s, now)),
  plantCrop: action(byId, (s, p, now) => plantCrop(s, p.id, now)),
  harvestCrop: action(byId, (s, p, now) => harvestCrop(s, p.id, now)),
  staffBuilding: action(byId.extend({ count }), (s, p, now) =>
    staffBuilding(s, p.id, p.count, now),
  ),
  unstaffBuilding: action(byId.extend({ count }), (s, p, now) =>
    unstaffBuilding(s, p.id, p.count, now),
  ),
  trainWorker: action(z.object({}), (s, _p, now) => trainWorker(s, now)),
  releaseMonster: action(byId, (s, p) => releaseMonster(s, p.id)),
  sendWorkers: action(byId.extend({ count }), (s, p) => sendWorkers(s, p.id, p.count)),
  recallWorkers: action(byId, (s, p) => recallWorkers(s, p.id)),
  sendToAnimal: action(byId.extend({ job: z.enum(['hunt', 'capture']), count }), (s, p) =>
    sendToAnimal(s, p.id, p.job, p.count),
  ),
  sendTeam: action(z.object({ monsterIds: ids, encounterId: id }), (s, p, now) =>
    sendTeam(s, p, now),
  ),
  moveUnits: action(point.extend({ ids }), (s, p, now) => moveUnits(s, p, now)),
  guardNode: action(z.object({ ids, obstacleId: id }), (s, p, now) => guardNode(s, p, now)),
  retreatUnits: action(z.object({ ids }), (s, p, now) => retreatUnits(s, p, now)),
  reviveMonster: action(byId.extend({ method: z.enum(['resources', 'gems']) }), (s, p) =>
    reviveMonster(s, p.id, p.method),
  ),
  hatchEgg: action(byId, (s, p, now) => hatchEgg(s, p.id, now)),
  careSoulEgg: action(byId, (s, p, now) => careSoulEgg(s, p.id, now)),
  hatchSoulEgg: action(byId, (s, p, now) => hatchSoulEgg(s, p.id, now)),
  trainSoldier: action(z.object({ buildingId: id, rank: z.number().int().min(0) }), (s, p, now) =>
    trainSoldier(s, p, now),
  ),
  feedMonster: action(z.object({ monsterId: id, amount: count.max(1_000_000) }), (s, p) =>
    feedMonster(s, p),
  ),
  startMix: action(
    z.object({
      parentAId: id,
      parentBId: id,
      awaitProphecy: z.boolean().optional(),
      /** Development only; the server always drops it. */
      skipUnlock: z.boolean().optional(),
      /** A friend's monster; the edge function swaps in its own checked copy. */
      borrowed: z
        .object({ id, form: id, element: id, stage: id, food: z.number().int().min(0) })
        .optional(),
    }),
    (s, p, now) => startMix(s, p, now),
  ),
  prophesy: action(byId, (s, p) => prophesy(s, p.id)),
  confirmMix: action(byId, (s, p, now) => confirmMix(s, p.id, now)),
  cancelMix: action(byId, (s, p) => cancelMix(s, p.id)),
  speedUpMix: action(byId, (s, p, now) => speedUp(s, p.id, now)),
  collectMix: action(byId, (s, p, now) => collectMix(s, p.id, now)),
  buyMixerSlot: action(z.object({}), (s) => buyMixerSlot(s)),
  attackBase: action(z.object({ baseId: id, cells: z.array(byId.merge(point)).max(50) }), (s, p) =>
    attackBase(s, p),
  ),
  attackNode: action(
    z.object({ nodeId: id, cells: z.array(byId.merge(point)).max(50) }),
    (s, p, now) => attackNode(s, p, now),
  ),
  claimQuest: action(z.object({}), (s) => claimQuest(s)),
  claimDaily: action(z.object({}), (s, _p, now) => claimDaily(s, now)),
  claimSet: action(byId, (s, p) => claimSet(s, p.id)),
  unlockIsland: action(byId, (s, p, now) => unlockIsland(s, p.id, now)),
  travelTo: action(byId, (s, p) => travelTo(s, p.id)),
};

export type ActionName = keyof typeof ACTIONS;
export type ActionParams<N extends ActionName> = z.input<(typeof ACTIONS)[N]['params']>;
export type ActionOutput<N extends ActionName> = ReturnType<(typeof ACTIONS)[N]['run']>;

/** Runs a named action with already-checked parameters. */
export function runAction<N extends ActionName>(
  state: PlayerState,
  name: N,
  params: ActionParams<N>,
  now: number,
): ActionOutput<N> {
  // Indexing the registry loses the link between name and types; it is restored here.
  const def = ACTIONS[name] as unknown as {
    run: (s: PlayerState, p: ActionParams<N>, now: number) => ActionOutput<N>;
  };
  return def.run(state, params, now);
}
