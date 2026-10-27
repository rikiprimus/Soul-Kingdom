import { gameData, XP_ACTIONS, type GameData } from './data';
import {
  isParentConsumed,
  mixCost,
  rollMix,
  validateParents,
  type MixCost,
  type MixResult,
  type ParentError,
} from './mixer';
import {
  firstStage,
  foodToNextStage,
  formTierOf,
  getForm,
  getStage,
  isFinalStage,
  monsterKey,
  type Monster,
  type MonsterKind,
} from './monster';
import { animalRespawnSeconds, spawnAnimals } from './animals';
import { rollEgg, type BarracksTraining, type Egg, type Soldier } from './barracks';
import { encounterRespawnSeconds, spawnEncounters } from './encounters';
import { isOnMission, type Mission } from './missions';
import { deepClone } from './clone';
import { recordAction, type XpAction } from './player';
import { dayNumber } from './quests';
import { canBorrow, type SocialDay } from './social';
import { createRng, type RngState } from './rng';
import type { AdventureProgress } from './adventure';
import type { SerbuProgress } from './serbu';
import type { DailyBonus, QuestProgress } from './quests';
import type { MarketDraw } from './market';
import type { SoulEgg } from './nest';
import type { StoredItem } from './storage';
import { settleUnits, type UnitPlace } from './units';
import { createVillage, hasFeature, townHallLevel, type Village } from './village';
import { createWorkers, hasRoomFor, type Worker, type WorkerTraining } from './workers';

export interface Resources {
  gold: number;
  food: number;
  wood: number;
  stone: number;
  soulCrystal: number;
  gems: number;
}

/** `prepared`: paid and result locked, timer not started (waiting for Ramalan Jiwa). */
export type MixStatus = 'prepared' | 'mixing';

export interface MixEntry {
  id: string;
  /** Snapshots of both parents at the time of mixing. */
  parents: [Monster, Monster];
  /** Parents removed from the collection (restored on cancel). */
  consumedParentIds: string[];
  /** Locked when the mix is prepared; `collectMix` only reveals it. */
  result: MixResult;
  cost: MixCost;
  status: MixStatus;
  endsAt: number | null;
  prophesied: boolean;
}

export interface Monsterpedia {
  /** "form:element" keys of every monster ever owned. */
  monsters: string[];
  /** Ids of discovered monster recipes. */
  recipes: string[];
}

export interface PlayerState {
  resources: Resources;
  /** The island being played. */
  village: Village;
  /** Id of that island (islands.json). */
  island: string;
  /** The other opened islands, by id; they keep their buildings while the player is away. */
  islands: Record<string, Village>;
  /** Workers (also the builders); each needs a population slot. */
  workers: Worker[];
  workerTraining: WorkerTraining[];
  /** Soldiers in training at the barracks; they hold their population slot already. */
  barracksQueue: BarracksTraining[];
  /** Human soldiers from the barracks; they fight beside monsters but never breed. */
  soldiers: Soldier[];
  /** Unhatched monster eggs (the first monster comes from one). */
  eggs: Egg[];
  /** Telur Jiwa from quest rewards, cared for in the Sarang Telur Jiwa. */
  soulEggs: SoulEgg[];
  /** Monsterpedia sets whose prize was claimed. */
  collections: string[];
  /** Gudang: decorations and Keajaiban off the map (won ones arrive here). Never monsters. */
  storage: StoredItem[];
  /** Where each monster and soldier stands or walks in the village, by id. */
  units: Record<string, UnitPlace>;
  /** Teams out fighting wild encounters. */
  missions: Mission[];
  /** Fallen monsters, waiting in the Kuburan to be revived (they take no population). */
  graveyard: Monster[];
  bossesDefeated: number;
  /** Total player XP; the level is derived from it (`playerLevel`). */
  xp: number;
  /** Lifetime count of each XP action (quest goals count from `quest.start`). */
  actions: Record<XpAction, number>;
  quest: QuestProgress;
  daily: DailyBonus;
  /** Undian Harian at the Pasar (Tugas 1C.5). */
  marketDraw: MarketDraw;
  /** Help given and monster borrowed today (Tugas 2.1). */
  social: SocialDay;
  monsters: Monster[];
  mixQueue: MixEntry[];
  mixerSlots: number;
  pedia: Monsterpedia;
  pityStreak: number;
  /** Serbu against NPC bases: which ones have been beaten. */
  serbu: SerbuProgress;
  /** Petualangan: nodes beaten, and when taken resource nodes come back. */
  adventure: AdventureProgress;
  rngState: RngState;
  nextId: number;
}

export type ActionError =
  | ParentError
  | 'notEnoughGold'
  | 'notEnoughFood'
  | 'notEnoughGems'
  | 'notEnoughSoulCrystal'
  | 'monsterNotFound'
  | 'parentBusy'
  | 'slotsFull'
  | 'mixerLocked'
  | 'entryNotFound'
  | 'notReady'
  | 'alreadyStarted'
  | 'alreadyFinished'
  | 'notProphesied'
  | 'alreadyProphesied'
  | 'alreadyAdult'
  | 'invalidAmount'
  | 'maxSlots'
  | 'maxLevel'
  | 'populationFull'
  | 'trainingQueueFull'
  | 'tooManyWorkers'
  | 'notConstructing'
  | 'notGathering'
  | 'notStaffed'
  | 'noStaff'
  | 'animalNotFound'
  | 'animalBusy'
  | 'noRanch'
  | 'ranchFull'
  | 'notBarracks'
  | 'notUnlocked'
  | 'encounterNotFound'
  | 'encounterBusy'
  | 'monsterBusy'
  | 'noGraveyard'
  | 'noNest'
  | 'unknownBuilding'
  | 'buildingNotFound'
  | 'townHallTooLow'
  | 'maxCountReached'
  | 'buildersBusy'
  | 'blocked'
  | 'underConstruction'
  | 'nothingToCollect'
  | 'notAFarm'
  | 'alreadyPlanted'
  | 'noCrop'
  | 'obstacleNotFound'
  | 'notSellable'
  | 'notLineBuilding'
  | 'powerCapExceeded'
  | 'notEnoughWood'
  | 'notEnoughStone'
  | 'notAvailableYet'
  | 'plotLocked'
  | 'plotOutOfMap'
  | 'plotAlreadyOpen'
  | 'plotNotAdjacent'
  | 'alreadyClaimed'
  | 'noMarket'
  | 'notStorable'
  | 'cannotRotate'
  | 'teamsAway'
  | 'badRequest';

export type ActionResult<T extends object = object> =
  ({ ok: true; state: PlayerState } & T) | { ok: false; error: ActionError };

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

const clone = (state: PlayerState): PlayerState => deepClone(state);

function newId(state: PlayerState, prefix: string): string {
  const id = `${prefix}${state.nextId}`;
  state.nextId += 1;
  return id;
}

function discover(state: PlayerState, kind: MonsterKind): void {
  const key = monsterKey(kind);
  if (!state.pedia.monsters.includes(key)) state.pedia.monsters.push(key);
}

function addMonster(state: PlayerState, kind: MonsterKind & { stage: string }): Monster {
  const monster: Monster = { id: newId(state, 'm'), ...kind, food: 0 };
  state.monsters.push(monster);
  discover(state, monster);
  return monster;
}

/** Zero count for every XP action. */
export function noActions(): Record<XpAction, number> {
  return Object.fromEntries(XP_ACTIONS.map((a) => [a, 0])) as Record<XpAction, number>;
}

export function createInitialState(
  now: number,
  seed: RngState,
  data: GameData = gameData,
): PlayerState {
  const { economy, mixer } = data.rules;
  const state: PlayerState = {
    resources: { ...economy.startingResources },
    village: {
      buildings: [],
      obstacles: [],
      unlockedPlots: [],
      regrowAt: now,
      animals: [],
      ranchAnimals: [],
      animalsAt: now,
      encounters: [],
      encountersAt: now,
      raidClock: 0,
    },
    island: data.islands.islands[0]!.id,
    islands: {},
    workers: [],
    workerTraining: [],
    barracksQueue: [],
    soldiers: [],
    eggs: [],
    soulEggs: [],
    collections: [],
    storage: [],
    units: {},
    missions: [],
    graveyard: [],
    bossesDefeated: 0,
    xp: 0,
    actions: noActions(),
    quest: { index: 0, start: noActions() },
    daily: { next: 0, lastDay: null },
    marketDraw: { lastDay: null },
    social: { helped: {}, borrowDay: null },
    monsters: [],
    mixQueue: [],
    mixerSlots: mixer.initialSlots,
    pedia: { monsters: [], recipes: [] },
    pityStreak: 0,
    serbu: { cleared: [] },
    adventure: { cleared: [], refillAt: {} },
    rngState: seed >>> 0,
    nextId: 1,
  };
  const rng = createRng(state.rngState);
  state.village = createVillage(rng, now, () => newId(state, 'b'), data);
  // No monster at the start: the first one hatches from this egg.
  state.eggs.push(rollEgg(rng, newId(state, 'e'), now + economy.startingEgg.hatchSeconds, data));
  state.rngState = rng.getState();
  createWorkers(state, data.rules.workers.startingWorkers);
  // The first animals are there from the start.
  state.village.animalsAt = now - animalRespawnSeconds(data);
  state.village.encountersAt = now - encounterRespawnSeconds(data);
  return settleUnits(spawnEncounters(spawnAnimals(state, now, data), now, data), now, data);
}

/** The mixer needs a finished Altar building and a high enough Balai Utama. */
export function isMixerUnlocked(state: PlayerState, data: GameData = gameData): boolean {
  return (
    townHallLevel(state, data) >= data.rules.mixer.unlockTownHallLevel &&
    (hasFeature(state, 'altar', data) || hasFeature(state, 'mixer', data))
  );
}

export const isAltarUnlocked = isMixerUnlocked;

/** A monster in a running mix or out on a mission. */
export function isMonsterBusy(state: PlayerState, monsterId: string): boolean {
  return (
    state.mixQueue.some((e) => e.parents.some((p) => p.id === monsterId)) ||
    isOnMission(state, monsterId)
  );
}

export interface StartMixParams {
  parentAId: string;
  parentBId: string;
  /** Keep the mix `prepared` so the player can buy a Ramalan Jiwa before it starts. */
  awaitProphecy?: boolean;
  /** Development-only: ignore the Town Hall unlock level. */
  skipUnlock?: boolean;
  /**
   * A friend's adult monster as the second parent (once a day; its id from `borrowedId`).
   * It is never used up; `parentBId` is then ignored. The server checks the friendship and
   * puts in its own copy of the monster.
   */
  borrowed?: Monster;
}

function beginMixing(state: PlayerState, entry: MixEntry, now: number): void {
  entry.status = 'mixing';
  entry.endsAt = now + entry.cost.seconds;
  state.pityStreak = entry.result.nextPityStreak;
}

export function startMix(
  state: PlayerState,
  params: StartMixParams,
  now: number,
  data: GameData = gameData,
): ActionResult<{ entryId: string }> {
  if (!params.skipUnlock && !isMixerUnlocked(state, data)) return fail('mixerLocked');
  if (state.mixQueue.length >= state.mixerSlots) return fail('slotsFull');
  const a = state.monsters.find((m) => m.id === params.parentAId);
  const b = params.borrowed ?? state.monsters.find((m) => m.id === params.parentBId);
  if (!a || !b) return fail('monsterNotFound');
  if (params.borrowed && !canBorrow(state, now, data)) return fail('alreadyClaimed');
  const valid = validateParents(a, b, data);
  if (!valid.ok) return fail(valid.error);
  if (isMonsterBusy(state, a.id) || isMonsterBusy(state, b.id)) return fail('parentBusy');

  const context = { bossesDefeated: state.bossesDefeated, pityStreak: state.pityStreak };
  const cost = mixCost(a, b, context, data);
  if (state.resources.gold < cost.gold) return fail('notEnoughGold');
  if (state.resources.soulCrystal < cost.soulCrystal) return fail('notEnoughSoulCrystal');

  const next = clone(state);
  const rng = createRng(next.rngState);
  const result = rollMix(a, b, context, rng, data);
  next.rngState = rng.getState();
  next.resources.gold -= cost.gold;
  next.resources.soulCrystal -= cost.soulCrystal;

  // A borrowed monster goes back to its owner.
  const own = params.borrowed ? [a] : [a, b];
  const consumedParentIds = own.filter((p) => isParentConsumed(p, data)).map((p) => p.id);
  if (params.borrowed) next.social.borrowDay = dayNumber(now, data);
  next.monsters = next.monsters.filter((m) => !consumedParentIds.includes(m.id));
  const entry: MixEntry = {
    id: newId(next, 'x'),
    parents: [deepClone(a), deepClone(b)],
    consumedParentIds,
    result,
    cost,
    status: 'prepared',
    endsAt: null,
    prophesied: false,
  };
  if (!params.awaitProphecy) beginMixing(next, entry, now);
  next.mixQueue.push(entry);
  return { ok: true, state: next, entryId: entry.id };
}

function findEntry(state: PlayerState, entryId: string) {
  const index = state.mixQueue.findIndex((e) => e.id === entryId);
  return { index, entry: index >= 0 ? state.mixQueue[index] : undefined };
}

/** Pay gems to reveal the locked result of a prepared mix. */
export function prophesy(state: PlayerState, entryId: string): ActionResult<{ result: MixResult }> {
  const { entry } = findEntry(state, entryId);
  if (!entry) return fail('entryNotFound');
  if (entry.status !== 'prepared') return fail('alreadyStarted');
  if (entry.prophesied) return fail('alreadyProphesied');
  if (state.resources.gems < entry.cost.prophecyGems) return fail('notEnoughGems');
  const next = clone(state);
  const e = findEntry(next, entryId).entry!;
  next.resources.gems -= e.cost.prophecyGems;
  e.prophesied = true;
  return { ok: true, state: next, result: e.result };
}

/** Start the timer of a prepared mix ("Lanjutkan"). */
export function confirmMix(state: PlayerState, entryId: string, now: number): ActionResult {
  const { entry } = findEntry(state, entryId);
  if (!entry) return fail('entryNotFound');
  if (entry.status !== 'prepared') return fail('alreadyStarted');
  const next = clone(state);
  beginMixing(next, findEntry(next, entryId).entry!, now);
  return { ok: true, state: next };
}

/** Cancel a prepared mix after a Ramalan Jiwa: parents, gold and crystals come back. */
export function cancelMix(state: PlayerState, entryId: string): ActionResult {
  const { entry, index } = findEntry(state, entryId);
  if (!entry) return fail('entryNotFound');
  if (entry.status !== 'prepared') return fail('alreadyStarted');
  if (!entry.prophesied) return fail('notProphesied');
  const next = clone(state);
  next.mixQueue.splice(index, 1);
  next.resources.gold += entry.cost.gold;
  next.resources.soulCrystal += entry.cost.soulCrystal;
  for (const parent of entry.parents) {
    if (entry.consumedParentIds.includes(parent.id)) next.monsters.push(deepClone(parent));
  }
  return { ok: true, state: next };
}

/** Seconds left on a running mix (0 when done; null when not started). */
export function mixRemaining(entry: MixEntry, now: number): number | null {
  if (entry.status !== 'mixing' || entry.endsAt === null) return null;
  return Math.max(0, entry.endsAt - now);
}

export function speedUpCost(seconds: number, data: GameData = gameData): number {
  if (seconds <= 0) return 0;
  const { speedUpGemsPerMinute, speedUpMinimumGems } = data.rules.premium;
  return Math.max(speedUpMinimumGems, Math.ceil((seconds / 60) * speedUpGemsPerMinute));
}

export function speedUp(
  state: PlayerState,
  entryId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ gems: number }> {
  const { entry } = findEntry(state, entryId);
  if (!entry) return fail('entryNotFound');
  const remaining = mixRemaining(entry, now);
  if (remaining === null) return fail('notReady');
  if (remaining === 0) return fail('alreadyFinished');
  const gems = speedUpCost(remaining, data);
  if (state.resources.gems < gems) return fail('notEnoughGems');
  const next = clone(state);
  next.resources.gems -= gems;
  findEntry(next, entryId).entry!.endsAt = now;
  return { ok: true, state: next, gems };
}

/** Hatch a finished mix: the locked result joins the collection as a baby. */
export function collectMix(
  state: PlayerState,
  entryId: string,
  now: number,
  data: GameData = gameData,
): ActionResult<{ monster: Monster; result: MixResult; newDiscovery: boolean }> {
  const { entry, index } = findEntry(state, entryId);
  if (!entry) return fail('entryNotFound');
  if (mixRemaining(entry, now) !== 0) return fail('notReady');
  if (!hasRoomFor(entry.result, state, data)) return fail('populationFull');
  const next = clone(state);
  next.mixQueue.splice(index, 1);
  const newDiscovery = !next.pedia.monsters.includes(monsterKey(entry.result));
  const monster = addMonster(next, {
    form: entry.result.form,
    element: entry.result.element,
    stage: firstStage(data),
  });
  recordAction(next, 'hatch', 1, data);
  if (entry.result.recipeId && !next.pedia.recipes.includes(entry.result.recipeId)) {
    next.pedia.recipes.push(entry.result.recipeId);
  }
  return { ok: true, state: next, monster, result: entry.result, newDiscovery };
}

export function feedMonster(
  state: PlayerState,
  params: { monsterId: string; amount: number },
  data: GameData = gameData,
): ActionResult<{ grew: boolean }> {
  const monster = state.monsters.find((m) => m.id === params.monsterId);
  if (!monster) return fail('monsterNotFound');
  if (isFinalStage(monster.stage, data)) return fail('alreadyAdult');
  const needed = foodToNextStage(monster, data) - monster.food;
  const amount = Math.min(params.amount, needed);
  if (!Number.isInteger(params.amount) || amount <= 0) return fail('invalidAmount');
  if (state.resources.food < amount) return fail('notEnoughFood');
  const next = clone(state);
  const m = next.monsters.find((x) => x.id === params.monsterId)!;
  next.resources.food -= amount;
  m.food += amount;
  const grew = m.food >= foodToNextStage(m, data);
  if (grew) {
    m.stage = data.rules.growth.stages[getStage(m.stage, data).index + 1]!.id;
    m.food = 0;
  }
  return { ok: true, state: next, grew };
}

export function nextMixerSlotGems(state: PlayerState, data: GameData = gameData): number | null {
  const { initialSlots, maxSlots } = data.rules.mixer;
  if (state.mixerSlots >= maxSlots) return null;
  return data.rules.premium.extraMixerSlotGems[state.mixerSlots - initialSlots] ?? null;
}

export function buyMixerSlot(state: PlayerState, data: GameData = gameData): ActionResult {
  const gems = nextMixerSlotGems(state, data);
  if (gems === null) return fail('maxSlots');
  if (state.resources.gems < gems) return fail('notEnoughGems');
  const next = clone(state);
  next.resources.gems -= gems;
  next.mixerSlots += 1;
  return { ok: true, state: next };
}

/** Monsters that can be chosen as mix parents right now. */
export function eligibleParents(state: PlayerState, data: GameData = gameData): Monster[] {
  const required = getStage(data.rules.mixer.parentStage, data).index;
  return state.monsters.filter(
    (m) => getStage(m.stage, data).index >= required && !isMonsterBusy(state, m.id),
  );
}

/** Sort helper: highest tier first, then by form name. */
export function compareMonsters(a: Monster, b: Monster, data: GameData = gameData): number {
  return (
    formTierOf(b, data) - formTierOf(a, data) ||
    getForm(a.form, data).name.localeCompare(getForm(b.form, data).name)
  );
}
