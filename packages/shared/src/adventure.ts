import { gameData, type GameData } from './data';
import { fightPlaced, fightResult, payReward, type SerbuCell, type SerbuResult } from './serbu';
import type { ActionError, ActionResult, PlayerState } from './state';
import { allBuildings, townHallLevel } from './village';

/** A Petualangan region (`data/adventure.json`): a small map of nodes ending in a boss. */
export type AdventureRegion = GameData['adventure']['regions'][number];
export type AdventureNode = AdventureRegion['nodes'][number];

/** Petualangan progress: nodes beaten at least once, and when taken resource nodes are back. */
export interface AdventureProgress {
  cleared: string[];
  refillAt: Record<string, number>;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export function adventureRegion(id: string, data: GameData = gameData) {
  return data.adventure.regions.find((r) => r.id === id);
}

/** A node and the region it belongs to. */
export function adventureNode(
  id: string,
  data: GameData = gameData,
): { region: AdventureRegion; node: AdventureNode } | undefined {
  for (const region of data.adventure.regions) {
    const node = region.nodes.find((n) => n.id === id);
    if (node) return { region, node };
  }
  return undefined;
}

const bossOf = (region: AdventureRegion) => region.nodes.find((n) => n.kind === 'boss')!;

/**
 * A region is `locked` until the boss of the one before it is beaten, needs its Balai
 * level (`townHall`) and its Gerbang Petualangan level (`gate`), is `open`, and `done`
 * once its own boss has fallen.
 */
export type RegionStatus = 'locked' | 'townHall' | 'gate' | 'open' | 'done';

/** Highest finished Gerbang Petualangan level on any island (0 when there is none). */
export function adventureGateLevel(state: PlayerState, data: GameData = gameData): number {
  return allBuildings(state)
    .filter((b) => data.buildingById.get(b.type)?.feature === 'adventure')
    .reduce((best, b) => Math.max(best, b.level), 0);
}

export function regionStatus(
  state: PlayerState,
  regionId: string,
  data: GameData = gameData,
): RegionStatus {
  const { regions } = data.adventure;
  const i = regions.findIndex((r) => r.id === regionId);
  if (i < 0) return 'locked';
  const { cleared } = state.adventure;
  if (cleared.includes(bossOf(regions[i]!).id)) return 'done';
  if (i > 0 && !cleared.includes(bossOf(regions[i - 1]!).id)) return 'locked';
  if (townHallLevel(state, data) < regions[i]!.requiresTownHall) return 'townHall';
  if (adventureGateLevel(state, data) < regions[i]!.requiresGateLevel) return 'gate';
  return 'open';
}

/**
 * A node is `locked` while its region is (or while a node on its path is unbeaten),
 * `townHall` while the region needs a higher Balai, `open` to attack, `cleared` for a
 * beaten camp or boss, and `refilling` for a taken resource node not yet back.
 */
export type NodeStatus = 'locked' | 'townHall' | 'gate' | 'open' | 'cleared' | 'refilling';

export function nodeStatus(
  state: PlayerState,
  nodeId: string,
  now: number,
  data: GameData = gameData,
): NodeStatus {
  const found = adventureNode(nodeId, data);
  if (!found) return 'locked';
  const { region, node } = found;
  const inRegion = regionStatus(state, region.id, data);
  if (inRegion === 'locked' || inRegion === 'townHall' || inRegion === 'gate') return inRegion;
  const { cleared, refillAt } = state.adventure;
  if (!node.after.every((id) => cleared.includes(id))) return 'locked';
  if (node.kind !== 'resource') return cleared.includes(node.id) ? 'cleared' : 'open';
  return (refillAt[node.id] ?? 0) > now ? 'refilling' : 'open';
}

/**
 * Attacks an open Petualangan node with placed units (the Serbu fight). A win pays the
 * node's reward: a resource node every time it is taken (plus a gem at `gemChance`),
 * then it refills after `refillHours`; a camp or boss once. The first win against a
 * boss raises `bossesDefeated`, which opens the next Soul Mixer tier.
 */
export function attackNode(
  state: PlayerState,
  params: { nodeId: string; cells: SerbuCell[] },
  now: number,
  data: GameData = gameData,
): ActionResult<{ result: SerbuResult }> {
  const found = adventureNode(params.nodeId, data);
  if (!found) return fail('notUnlocked');
  const { node } = found;
  const status = nodeStatus(state, node.id, now, data);
  if (status === 'townHall') return fail('townHallTooLow');
  if (status === 'gate') return fail('gateTooLow');
  if (status === 'refilling') return fail('notReady');
  if (status !== 'open') return fail('notUnlocked');
  const first = !state.adventure.cleared.includes(node.id);
  const r = fightPlaced(
    state,
    params.cells,
    node.defenders,
    (next, rng) => {
      const reward = { ...node.reward };
      if (node.kind === 'resource') {
        if (rng.chance(node.gemChance)) reward.gems += 1;
        next.adventure.refillAt[node.id] = now + node.refillHours! * 3600;
      }
      if (first) next.adventure.cleared.push(node.id);
      if (first && node.kind === 'boss') next.bossesDefeated += 1;
      payReward(next, reward);
      return reward;
    },
    data,
  );
  if (!r.ok) return r;
  return { ok: true, state: r.state, result: fightResult(r, node.id, first) };
}
