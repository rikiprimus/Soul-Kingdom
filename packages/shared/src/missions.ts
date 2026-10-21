import { soldierPower } from './barracks';
import { deepClone } from './clone';
import {
  gameData,
  VILLAGE_RESOURCES,
  type ElementId,
  type GameData,
  type VillageAmount,
} from './data';
import { elementAdvantage } from './elements';
import { getStage, powerPointsOf, type Monster, type MonsterKind } from './monster';
import { createRng } from './rng';
import type { ActionError, ActionResult, PlayerState } from './state';
import { hasRoomFor } from './workers';

/** A group of wild enemies waiting on the map (see encounters.ts for spawning). */
export interface WildEncounter {
  id: string;
  /** Index into `wilds.encounters.levels` and into that level's `groups`. */
  level: number;
  group: number;
  /** Tile it stands on. */
  x: number;
  y: number;
  /** Bandits: how many. Monster groups: one kind per enemy. */
  count: number;
  enemies: (MonsterKind & { stage: string })[];
}

/** A team sent against an encounter; the outcome is rolled at departure and applied at `endsAt`. */
export interface Mission {
  id: string;
  encounterId: string;
  /** Monster and soldier ids (the field name predates soldiers). */
  monsterIds: string[];
  endsAt: number;
  won: boolean;
  /** Team members that die (only when the fight is lost). */
  dead: string[];
  reward: VillageAmount;
  soulCrystal: number;
}

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export type EncounterGroup = GameData['wilds']['encounters']['levels'][number]['groups'][number];

export function encounterGroup(e: WildEncounter, data: GameData = gameData): EncounterGroup {
  const group = data.wilds.encounters.levels[e.level]?.groups[e.group];
  if (!group) throw new Error(`Kelompok musuh tidak dikenal: ${e.level}/${e.group}`);
  return group;
}

/** A monster or soldier in a running mission cannot be used anywhere else. */
export function isOnMission(state: PlayerState, monsterId: string): boolean {
  return state.missions.some((m) => m.monsterIds.includes(monsterId));
}

export function missionFor(state: PlayerState, encounterId: string): Mission | undefined {
  return state.missions.find((m) => m.encounterId === encounterId);
}

// ---------- Power and odds ----------

const stageMultiplier = (stage: string, data: GameData) =>
  getStage(stage, data).stage.statMultiplier;

/** Raw strength of one monster: power points × growth stage. */
export function monsterPower(m: MonsterKind & { stage: string }, data: GameData = gameData) {
  return powerPointsOf(m, data) * stageMultiplier(m.stage, data);
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1);

/** One team member's strength and element; soldiers have no element (no edge either way). */
export interface TeamUnit {
  power: number;
  element: ElementId | null;
}

/** The team members behind these ids (monsters and soldiers), unknown ids skipped. */
export function teamUnits(
  state: PlayerState,
  ids: readonly string[],
  data: GameData = gameData,
): TeamUnit[] {
  const units: TeamUnit[] = [];
  for (const id of ids) {
    const m = state.monsters.find((x) => x.id === id);
    if (m) units.push({ power: monsterPower(m, data), element: m.element });
    const s = state.soldiers.find((x) => x.id === id);
    if (s) units.push({ power: soldierPower(s, data), element: null });
  }
  return units;
}

/** Team strength against an encounter, with each member's average element edge over the enemies. */
export function teamPower(team: TeamUnit[], e: WildEncounter, data: GameData = gameData): number {
  return team.reduce((sum, u) => {
    const edge =
      u.element === null
        ? 1
        : average(e.enemies.map((x) => elementAdvantage(u.element!, x.element, data)));
    return sum + u.power * edge;
  }, 0);
}

/** Enemy strength: bandits by head count, monsters with their element edge over the team. */
export function encounterPower(
  e: WildEncounter,
  team: TeamUnit[],
  data: GameData = gameData,
): number {
  const group = encounterGroup(e, data);
  if (group.kind === 'bandit') return e.count * (group.banditPower ?? 0);
  return e.enemies.reduce((sum, x) => {
    const edge = average(
      team.map((u) => (u.element === null ? 1 : elementAdvantage(x.element, u.element, data))),
    );
    return sum + monsterPower(x, data) * edge;
  }, 0);
}

/** Chance that a team beats an encounter: t^k / (t^k + e^k). */
export function winChance(team: TeamUnit[], e: WildEncounter, data: GameData = gameData): number {
  if (team.length === 0) return 0;
  const k = data.rules.skirmish.sharpness;
  const t = teamPower(team, e, data) ** k;
  const f = encounterPower(e, team, data) ** k;
  return t + f === 0 ? 0 : t / (t + f);
}

// ---------- Sending a team ----------

export function sendTeam(
  state: PlayerState,
  params: { monsterIds: string[]; encounterId: string },
  now: number,
  data: GameData = gameData,
): ActionResult<{ missionId: string; chance: number }> {
  const e = state.village.encounters.find((x) => x.id === params.encounterId);
  if (!e) return fail('encounterNotFound');
  if (missionFor(state, e.id)) return fail('encounterBusy');
  const ids = params.monsterIds;
  const { maxTeam, deathChanceOnLoss, missionSeconds } = data.rules.skirmish;
  if (ids.length < 1 || ids.length > maxTeam || new Set(ids).size !== ids.length) {
    return fail('invalidAmount');
  }
  for (const id of ids) {
    const known =
      state.monsters.some((x) => x.id === id) || state.soldiers.some((x) => x.id === id);
    if (!known) return fail('monsterNotFound');
    const inMixer = state.mixQueue.some((q) => q.parents.some((p) => p.id === id));
    if (inMixer || isOnMission(state, id)) return fail('monsterBusy');
  }
  const chance = winChance(teamUnits(state, ids, data), e, data);
  const next = deepClone(state);
  const rng = createRng(next.rngState);
  const won = rng.chance(chance);
  let dead: string[] = [];
  if (!won) {
    dead = ids.filter(() => rng.chance(deathChanceOnLoss));
    // A lost fight always costs at least one member.
    if (dead.length === 0) dead = [ids[rng.int(0, ids.length - 1)]!];
  }
  const group = encounterGroup(e, data);
  const reward: VillageAmount = { gold: 0, food: 0, wood: 0, stone: 0 };
  let soulCrystal = 0;
  if (won) {
    for (const r of VILLAGE_RESOURCES) reward[r] = group.reward[r];
    soulCrystal = rng.chance(group.reward.soulCrystalChance) ? 1 : 0;
  }
  next.rngState = rng.getState();
  const missionId = `t${next.nextId}`;
  next.nextId += 1;
  next.missions.push({
    id: missionId,
    encounterId: e.id,
    monsterIds: [...ids],
    endsAt: now + missionSeconds,
    won,
    dead,
    reward,
    soulCrystal,
  });
  return { ok: true, state: next, missionId, chance };
}

/** What finished missions did, for the client to show. */
export interface MissionDone {
  mission: Mission;
  encounter: WildEncounter | undefined;
}

/**
 * Applies finished missions: a win pays the reward and clears the encounter; a loss
 * moves the fallen monsters to the graveyard. Same object when nothing finished.
 */
export function settleMissions(state: PlayerState, now: number): PlayerState {
  if (!state.missions.some((m) => m.endsAt <= now)) return state;
  const next = deepClone(state);
  for (const m of next.missions.filter((x) => x.endsAt <= now)) {
    if (m.won) {
      for (const r of VILLAGE_RESOURCES) next.resources[r] += m.reward[r];
      next.resources.soulCrystal += m.soulCrystal;
      next.village.encounters = next.village.encounters.filter((e) => e.id !== m.encounterId);
    } else {
      for (const id of m.dead) {
        // Fallen soldiers are gone; fallen monsters wait in the Kuburan.
        next.soldiers = next.soldiers.filter((x) => x.id !== id);
        const fallen = next.monsters.find((x) => x.id === id);
        if (!fallen) continue;
        next.monsters = next.monsters.filter((x) => x.id !== id);
        next.graveyard.push(fallen);
      }
    }
  }
  next.missions = next.missions.filter((x) => x.endsAt > now);
  return next;
}

// ---------- Graveyard ----------

export type ReviveMethod = 'resources' | 'gems';

/** Price of bringing a fallen monster back: per power point of its form tier. */
export function reviveCost(kind: MonsterKind, data: GameData = gameData) {
  const pp = powerPointsOf(kind, data);
  const { goldPerPowerPoint, foodPerPowerPoint, gemsPerPowerPoint } = data.wilds.graveyard;
  return {
    gold: goldPerPowerPoint * pp,
    food: foodPerPowerPoint * pp,
    gems: gemsPerPowerPoint * pp,
  };
}

export function hasGraveyard(state: PlayerState, data: GameData = gameData): boolean {
  return state.village.buildings.some(
    (b) => b.level >= 1 && data.buildingById.get(b.type)?.feature === 'graveyard',
  );
}

/** Revives a monster from the Kuburan with gold and food, or with gems. */
export function reviveMonster(
  state: PlayerState,
  monsterId: string,
  method: ReviveMethod,
  data: GameData = gameData,
): ActionResult<{ monster: Monster }> {
  const fallen = state.graveyard.find((m) => m.id === monsterId);
  if (!fallen) return fail('monsterNotFound');
  if (!hasGraveyard(state, data)) return fail('noGraveyard');
  if (!hasRoomFor(fallen, state, data)) return fail('populationFull');
  const cost = reviveCost(fallen, data);
  if (method === 'gems') {
    if (state.resources.gems < cost.gems) return fail('notEnoughGems');
  } else {
    if (state.resources.gold < cost.gold) return fail('notEnoughGold');
    if (state.resources.food < cost.food) return fail('notEnoughFood');
  }
  const next = deepClone(state);
  if (method === 'gems') {
    next.resources.gems -= cost.gems;
  } else {
    next.resources.gold -= cost.gold;
    next.resources.food -= cost.food;
  }
  next.graveyard = next.graveyard.filter((m) => m.id !== monsterId);
  next.monsters.push(deepClone(fallen));
  return { ok: true, state: next, monster: fallen };
}
