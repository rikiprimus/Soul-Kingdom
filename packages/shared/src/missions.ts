import { estimateWinChance, simulateBattle, type Fighter } from './battle';
import { soldierPower, soldierStats } from './barracks';
import { deepClone } from './clone';
import {
  gameData,
  VILLAGE_RESOURCES,
  type ElementId,
  type GameData,
  type VillageAmount,
} from './data';
import { elementAdvantage } from './elements';
import { getStage, monsterStats, powerPointsOf, type Monster, type MonsterKind } from './monster';
import { recordAction } from './player';
import { createRng } from './rng';
import type { RaidMarch } from './raids';
import type { ActionError, ActionResult, PlayerState } from './state';
import { hasRoomFor } from './workers';
import { hasFeature } from './village';

/** A group of wild enemies waiting on the map (see encounters.ts for spawning). */
export interface WildEncounter {
  id: string;
  /** Index into `wilds.encounters.levels` and into that level's `groups`. */
  level: number;
  group: number;
  /** Tile it stands on. */
  x: number;
  y: number;
  /** Ambush spawns leave by themselves at this time unless they are fighting. */
  leavesAt?: number | null;
  /** Set on a group raiding the village: how its march is going (raids.ts). */
  raid?: RaidMarch | null;
  /** Bandits: how many. Monster groups: one kind per enemy. */
  count: number;
  enemies: (MonsterKind & { stage: string })[];
}

/** A fight that has been simulated: when it runs and what it left behind. */
export interface MissionFight {
  startsAt: number;
  endsAt: number;
  won: boolean;
  /** Team members that fall (winners can lose members too). */
  dead: string[];
  /** HP left after the fight, 0–1: per team member id, and per enemy (same order as shown). */
  hpLeft: Record<string, number>;
  enemyHpLeft: number[];
  reward: VillageAmount;
  soulCrystal: number;
  /** Raid defence lost: what the raiders carry off when the fight ends (at most what is left). */
  stolen?: VillageAmount | null;
}

/**
 * A team sent against an encounter. It marches until `arriveAt`; the fight is simulated
 * when it gets there (no time limit: it lasts until one side has fallen) and its outcome
 * is applied when the fight ends.
 */
export interface Mission {
  id: string;
  encounterId: string;
  /** Monster and soldier ids (the field name predates soldiers). */
  monsterIds: string[];
  arriveAt: number;
  fight: MissionFight | null;
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

// ---------- Battle fighters ----------

/** The fighters behind team ids (monsters with their element and skills, soldiers without). */
export function teamFighters(
  state: PlayerState,
  ids: readonly string[],
  data: GameData = gameData,
): Fighter[] {
  const out: Fighter[] = [];
  for (const id of ids) {
    const m = state.monsters.find((x) => x.id === id);
    if (m) out.push({ id, stats: monsterStats(m, data), element: m.element, skill: true });
    const s = state.soldiers.find((x) => x.id === id);
    if (s) out.push({ id, stats: soldierStats(s, data), element: null, skill: false });
  }
  return out;
}

/** The enemies of an encounter as fighters: bandits by head count, or its monsters. */
export function encounterFighters(e: WildEncounter, data: GameData = gameData): Fighter[] {
  const group = encounterGroup(e, data);
  if (group.kind === 'bandit') {
    const { stats, powerScale } = data.rules.battle.bandit;
    const k = (group.banditPower ?? 0) * powerScale;
    const scaled = { ...stats, hp: stats.hp * k, atk: stats.atk * k, def: stats.def * k };
    return Array.from({ length: e.count }, (_, i) => ({
      id: `x${i}`,
      stats: scaled,
      element: null,
      skill: false,
    }));
  }
  return e.enemies.map((x, i) => ({
    id: `x${i}`,
    stats: monsterStats(x, data),
    element: x.element,
    skill: true,
  }));
}

/** Preview of the odds: the share of fixed-seed fights to the end this team wins. */
export function previewWinChance(
  state: PlayerState,
  ids: readonly string[],
  e: WildEncounter,
  runs: number = gameData.rules.battle.sim.previewRuns,
  data: GameData = gameData,
): number {
  return estimateWinChance(teamFighters(state, ids, data), encounterFighters(e, data), runs, data, {
    untilDefeat: true,
  });
}

// ---------- Sending a team ----------

export function sendTeam(
  state: PlayerState,
  params: { monsterIds: string[]; encounterId: string },
  now: number,
  data: GameData = gameData,
): ActionResult<{ missionId: string }> {
  const e = state.village.encounters.find((x) => x.id === params.encounterId);
  if (!e) return fail('encounterNotFound');
  if (missionFor(state, e.id)) return fail('encounterBusy');
  const ids = params.monsterIds;
  const { maxTeam, marchSeconds } = data.rules.skirmish;
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
  const next = deepClone(state);
  const missionId = `t${next.nextId}`;
  next.nextId += 1;
  next.missions.push({
    id: missionId,
    encounterId: e.id,
    monsterIds: [...ids],
    arriveAt: now + marchSeconds,
    fight: null,
  });
  return { ok: true, state: next, missionId };
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
/** Simulates the fight of a team that has arrived (seeded from the state's RNG). */
export function startFight(
  next: PlayerState,
  m: Mission,
  e: WildEncounter,
  data: GameData = gameData,
): void {
  const rng = createRng(next.rngState);
  const team = teamFighters(next, m.monsterIds, data);
  const enemies = encounterFighters(e, data);
  const battle = simulateBattle(team, enemies, rng.int(0, 0x7fffffff), data, {
    untilDefeat: true,
  });
  const won = battle.winner === 'attackers';
  const group = encounterGroup(e, data);
  const reward: VillageAmount = { gold: 0, food: 0, wood: 0, stone: 0 };
  let soulCrystal = 0;
  if (won) {
    for (const r of VILLAGE_RESOURCES) reward[r] = group.reward[r];
    soulCrystal = rng.chance(group.reward.soulCrystalChance) ? 1 : 0;
  }
  next.rngState = rng.getState();
  m.fight = {
    startsAt: m.arriveAt,
    endsAt: m.arriveAt + Math.ceil(battle.ticks / data.rules.battle.ticksPerSecond),
    won,
    dead: m.monsterIds.filter((id) => (battle.hp[id] ?? 0) <= 0),
    hpLeft: Object.fromEntries(team.map((f) => [f.id, battle.hp[f.id]! / f.stats.hp])),
    enemyHpLeft: enemies.map((f) => battle.hp[f.id]! / f.stats.hp),
    reward,
    soulCrystal,
  };
}

/**
 * Teams that have arrived start fighting (simulated now, in mission order); fights that
 * are over pay out or bury their fallen. A team whose enemy is gone just comes home.
 */
export function settleMissions(
  state: PlayerState,
  now: number,
  data: GameData = gameData,
): PlayerState {
  const done = (m: Mission) => (m.fight ? m.fight.endsAt <= now : m.arriveAt <= now);
  if (!state.missions.some(done)) return state;
  const next = deepClone(state);
  for (const m of next.missions) {
    if (m.fight || m.arriveAt > now) continue;
    const e = next.village.encounters.find((x) => x.id === m.encounterId);
    if (e) startFight(next, m, e, data);
  }
  for (const m of next.missions.filter(done)) {
    const f = m.fight;
    if (!f) continue;
    if (f.won) {
      for (const r of VILLAGE_RESOURCES) next.resources[r] += f.reward[r];
      next.resources.soulCrystal += f.soulCrystal;
      next.village.encounters = next.village.encounters.filter((e) => e.id !== m.encounterId);
      recordAction(next, 'defeatEnemy', 1, data);
    } else if (f.stolen) {
      // Raiders who beat the defence take their loot and leave.
      for (const r of VILLAGE_RESOURCES) {
        next.resources[r] -= Math.min(next.resources[r], f.stolen[r]);
      }
      next.village.encounters = next.village.encounters.filter((e) => e.id !== m.encounterId);
    }
    // Members who fell (on either outcome): soldiers are gone, monsters go to the Kuburan.
    for (const id of f.dead) {
      next.soldiers = next.soldiers.filter((x) => x.id !== id);
      const fallen = next.monsters.find((x) => x.id === id);
      if (!fallen) continue;
      next.monsters = next.monsters.filter((x) => x.id !== id);
      next.graveyard.push(fallen);
    }
  }
  next.missions = next.missions.filter((m) => !done(m));
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
  return hasFeature(state, 'graveyard', data);
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
