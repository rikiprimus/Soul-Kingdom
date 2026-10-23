/**
 * Economy simulation (pnpm sim:economy): a simple bot plays the village with the real
 * game actions, a few sessions a day, and we record when it reaches each milestone.
 * Pure and deterministic, so it can be tested and compared between data changes.
 */
import { spawnAnimals } from '../animals';
import {
  hatchEgg,
  soldierKindOf,
  soldierTrainCost,
  trainSoldier,
  unlockedRanks,
} from '../barracks';
import { gameData, VILLAGE_RESOURCES, type GameData, type VillageAmount } from '../data';
import { spawnEncounters } from '../encounters';
import { aggroRadius } from '../aggro';
import { encounterPower, isOnMission, previewWinChance, teamPower, teamUnits } from '../missions';
import { formTierOf, foodToNextStage, isFinalStage } from '../monster';
import { advanceRaids, currentRaid, raidRoute } from '../raids';
import { moveUnits, sendTeam } from '../units';
import {
  collectMix,
  createInitialState,
  eligibleParents,
  feedMonster,
  isMixerUnlocked,
  mixRemaining,
  startMix,
  type ActionResult,
  type PlayerState,
} from '../state';
import {
  buildBuilding,
  buyPlot,
  isTileUnlocked,
  occupancy,
  collectAll,
  countBuildings,
  cropStatus,
  harvestCrop,
  levelDef,
  maxConstructionWorkers,
  maxCountFor,
  nextPlotPrice,
  plantCrop,
  plotsPerSide,
  plotStatus,
  settleVillage,
  staffBuilding,
  staffWorkers,
  townHallLevel,
  upgradeBuilding,
} from '../village';
import { advanceWilds, gatherWorkers, regrowWilds, sendWorkers } from '../wilds';
import { idleWorkers, monsterSlots, populationCap, populationFree, trainWorker } from '../workers';

/** How the simulated player plays. Behaviour assumptions, not game balance. */
export interface SimPlayer {
  days: number;
  /** Start of each play session, in hours after midnight. */
  sessionStarts: number[];
  sessionMinutes: number;
  /** Seconds between two decisions while playing. */
  stepSeconds: number;
  seed: number;
  /** Buildings the bot builds (and upgrades) besides the Balai, in order of preference. */
  buildOrder: string[];
  /** Buildings saved for as soon as the Balai allows them, before any upgrade. */
  mustHave: string[];
  /** Share of the population the bot keeps for workers; the rest goes to monsters. */
  workerShare: number;
  /** The bot starts saving for the next Balai once it holds this share of every cost. */
  saveFrom: number;
  /** Only fights with at least this chance to win are taken. */
  minWinChance: number;
  /** During a raid's warning the free army stands on its route this many tiles before the Balai. */
  raidRallyTiles: number;
}

export const DEFAULT_SIM_PLAYER: SimPlayer = {
  days: 14,
  sessionStarts: [8, 12.5, 18, 21.5],
  sessionMinutes: 20,
  stepSeconds: 15,
  seed: 1,
  // With raids on the village (Tugas 1.7) a sensible player builds soldiers and a tower early.
  buildOrder: [
    'rumah',
    'petarung',
    'menara',
    'lapangan-panah',
    'soul-mixer',
    'pasar',
    'ladang',
    'penggilingan',
    'tambang-emas',
    'barak',
    'kandang',
    'peternakan',
  ],
  mustHave: ['soul-mixer'],
  workerShare: 0.6,
  saveFrom: 0.5,
  minWinChance: 0.75,
  raidRallyTiles: 3,
};

export interface Milestone {
  /** Seconds since the start. */
  at: number;
  label: string;
}

export interface DayReport {
  day: number;
  /** Resources earned that day (not counting spending). */
  earned: VillageAmount & { soulCrystal: number };
  townHall: number;
  plots: number;
  workers: number;
  /** Population used by monsters (their slots) and the cap. */
  monsterSlots: number;
  populationCap: number;
  monsters: number;
  maxFormTier: number;
  fightsWon: number;
  fightsLost: number;
  /** Raids on the village the defence beat or lost, and what the raiders carried off. */
  raidsWon: number;
  raidsLost: number;
  stolen: VillageAmount;
}

export interface SimReport {
  milestones: Milestone[];
  days: DayReport[];
  final: PlayerState;
}

const EARN_KEYS = [...VILLAGE_RESOURCES, 'soulCrystal'] as const;
type Earned = DayReport['earned'];
const emptyEarned = (): Earned => ({ gold: 0, food: 0, wood: 0, stone: 0, soulCrystal: 0 });

export function simulateEconomy(
  player: SimPlayer = DEFAULT_SIM_PLAYER,
  data: GameData = gameData,
): SimReport {
  let s = createInitialState(0, player.seed, data);
  const milestones: Milestone[] = [];
  const days: DayReport[] = [];
  let earned = emptyEarned();
  let won = 0;
  let lost = 0;
  let raidsWon = 0;
  let raidsLost = 0;
  let stolen: VillageAmount = { gold: 0, food: 0, wood: 0, stone: 0 };
  const seen = new Set<string>();
  const mark = (now: number, key: string, label: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    milestones.push({ at: now, label });
  };

  /** Adds what an income action gave (resource increases only). */
  const earn = (before: PlayerState, after: PlayerState) => {
    for (const k of EARN_KEYS) {
      const d = after.resources[k] - before.resources[k];
      if (d > 0) earned[k] += d;
    }
  };

  /** Applies an action when it succeeds; failures are just skipped. */
  const tryDo = <T extends object>(r: ActionResult<T>, income = false): boolean => {
    if (!r.ok) return false;
    if (income) earn(s, r.state);
    s = r.state;
    return true;
  };

  /** World time passing: constructions, training, missions (with their rewards), spawns. */
  const advanceWorld = (now: number) => {
    const before = s;
    const missionsBefore = s.missions;
    s = spawnEncounters(
      spawnAnimals(regrowWilds(settleVillage(s, now), now, data), now, data),
      now,
      data,
    );
    earn(before, s);
    for (const m of missionsBefore) {
      if (s.missions.some((x) => x.id === m.id)) continue;
      // The fight may have started and ended in the same step: a win removes the enemy.
      const win = m.fight ? m.fight.won : !s.village.encounters.some((e) => e.id === m.encounterId);
      if (before.village.encounters.find((e) => e.id === m.encounterId)?.raid) {
        if (win) raidsWon++;
        else raidsLost++;
        for (const r of VILLAGE_RESOURCES) stolen[r] += m.fight?.stolen?.[r] ?? 0;
      } else if (win) won++;
      else lost++;
    }
    record(now);
  };

  const record = (now: number) => {
    const hall = townHallLevel(s, data);
    for (let l = 2; l <= hall; l++) mark(now, `hall${l}`, `Balai Utama Lv ${l}`);
    const bought = s.village.unlockedPlots.length - data.village.village.initialPlots.length;
    for (let n = 1; n <= bought; n++) mark(now, `plot${n}`, `Plot ke-${n} dibeli`);
    for (const m of s.monsters) {
      const tier = formTierOf(m, data);
      mark(now, `tier${tier}`, `Monster tingkat ${tier}`);
    }
    if (isMixerUnlocked(s, data)) mark(now, 'mixer', 'Soul Mixer bisa dipakai');
  };

  const sessionStep = (now: number) => {
    // Income first.
    tryDo(collectAll(s, now, data), true);
    for (const b of s.village.buildings) {
      const status = cropStatus(b, now, data);
      if (status === 'ready') tryDo(harvestCrop(s, b.id, now, data), true);
    }
    for (const b of s.village.buildings) {
      if (cropStatus(b, now, data) === 'empty' && !b.construction)
        tryDo(plantCrop(s, b.id, now, data));
    }
    tickMixer(now);
    build(now);
    staff(now);
    trainPeople(now);
    buyLand();
    defendRaid(now);
    fight(now);
    gather();
  };

  // ---------- Spending helpers ----------

  /** What the Balai upgrade still needs on top of what we have (for the reserve). */
  /** Full cost of the next Balai upgrade (zero when maxed). */
  const balaiNeed = (): VillageAmount => {
    const hall = s.village.buildings.find((b) => b.type === data.townHallId)!;
    const next = levelDef(hall.type, hall.level + 1, data);
    const need: VillageAmount = { gold: 0, food: 0, wood: 0, stone: 0 };
    if (!next) return need;
    for (const r of VILLAGE_RESOURCES) need[r] = next.cost[r];
    return need;
  };

  /** Once the upgrade is close (`saveFrom` of every cost in hand), the bot keeps it aside. */
  const reserve = (): VillageAmount => {
    const need = balaiNeed();
    const close = VILLAGE_RESOURCES.every(
      (r) => need[r] === 0 || s.resources[r] >= need[r] * player.saveFrom,
    );
    return close ? need : { gold: 0, food: 0, wood: 0, stone: 0 };
  };

  /** Can we pay `cost` and still keep the Balai reserve? */
  const affordable = (cost: VillageAmount, kept = reserve()) =>
    VILLAGE_RESOURCES.every(
      (r) => s.resources[r] - cost[r] >= Math.min(kept[r], s.resources[r]) || cost[r] === 0,
    );

  const canPay = (cost: VillageAmount) => VILLAGE_RESOURCES.every((r) => s.resources[r] >= cost[r]);

  const hallOf = () => s.village.buildings.find((b) => b.type === data.townHallId)!;

  /** A free spot on open land, as close to the Balai as possible. */
  /** Tiles sorted by distance to the Balai, worked out once (the Balai never moves). */
  let nearHall: { x: number; y: number }[] | null = null;
  /** A free spot on open land, as close to the Balai as possible. */
  const spotFor = (size: number) => {
    const { mapSize } = data.village.village;
    if (!nearHall) {
      const hall = hallOf();
      nearHall = [];
      for (let y = 0; y < mapSize; y++) for (let x = 0; x < mapSize; x++) nearHall.push({ x, y });
      nearHall.sort(
        (a, b) =>
          Math.abs(a.x - hall.x) +
          Math.abs(a.y - hall.y) -
          (Math.abs(b.x - hall.x) + Math.abs(b.y - hall.y)),
      );
    }
    const taken = occupancy(s.village, data);
    const fits = (x: number, y: number) => {
      if (x + size > mapSize || y + size > mapSize) return false;
      for (let dx = 0; dx < size; dx++) {
        for (let dy = 0; dy < size; dy++) {
          if (
            taken.has(`${x + dx},${y + dy}`) ||
            !isTileUnlocked(s.village, x + dx, y + dy, data)
          ) {
            return false;
          }
        }
      }
      return true;
    };
    return nearHall.find((t) => fits(t.x, t.y)) ?? null;
  };

  const workersFor = (type: string) =>
    Math.min(idleWorkers(s).length, maxConstructionWorkers(type, data));

  function build(now: number) {
    // The Balai always comes first.
    const hall = hallOf();
    const next = levelDef(hall.type, hall.level + 1, data);
    if (next && !hall.construction && canPay(next.cost) && workersFor(hall.type) > 0) {
      tryDo(upgradeBuilding(s, hall.id, now, { workers: workersFor(hall.type) }, data));
    }
    // First pass: new buildings, in order of preference.
    for (const type of player.buildOrder) {
      if (idleWorkers(s).length === 0) return;
      const def = data.buildingById.get(type);
      if (!def || countBuildings(s, type) >= maxCountFor(s, type, data)) continue;
      const first = def.levels[0]!;
      if (townHallLevel(s, data) < first.requiresTownHall || !affordable(first.cost)) continue;
      const spot = spotFor(def.size);
      if (!spot) continue;
      const workers = first.seconds > 0 ? workersFor(type) : 0;
      if (first.seconds > 0 && workers === 0) continue;
      tryDo(
        buildBuilding(s, { type, x: spot.x, y: spot.y, workers: Math.max(1, workers) }, now, data),
      );
    }
    // A must-have building we do not have yet (the Soul Mixer) is saved for first.
    const missing = player.mustHave.find((type) => {
      const def = data.buildingById.get(type);
      return (
        def !== undefined &&
        countBuildings(s, type) === 0 &&
        townHallLevel(s, data) >= def.levels[0]!.requiresTownHall
      );
    });
    const kept = reserve();
    if (missing) {
      const cost = data.buildingById.get(missing)!.levels[0]!.cost;
      for (const r of VILLAGE_RESOURCES) kept[r] += cost[r];
    }
    // Second pass: upgrades of what we have.
    for (const type of player.buildOrder) {
      for (const b of s.village.buildings.filter((x) => x.type === type)) {
        if (b.construction || idleWorkers(s).length === 0) continue;
        const up = levelDef(type, b.level + 1, data);
        if (!up || townHallLevel(s, data) < up.requiresTownHall || !affordable(up.cost, kept)) {
          continue;
        }
        tryDo(upgradeBuilding(s, b.id, now, { workers: workersFor(type) }, data), true);
      }
    }
  }

  /** Keep one worker per staffed building inside, more when there are plenty. */
  function staff(now: number) {
    for (const b of s.village.buildings) {
      if (data.buildingById.get(b.type)?.feature !== 'staffed' || b.level < 1) continue;
      const slots = levelDef(b.type, b.level, data)?.workerSlots ?? 0;
      const spare = idleWorkers(s).length - 2;
      const want = Math.min(slots - staffWorkers(s, b.id), Math.max(0, spare));
      if (want > 0) tryDo(staffBuilding(s, b.id, want, now, data), true);
    }
  }

  function trainPeople(now: number) {
    const cap = populationCap(s, data);
    const workerTarget = Math.floor(cap * player.workerShare);
    const workers = s.workers.length + s.workerTraining.length;
    if (workers < workerTarget && populationFree(s, data) > 0) {
      tryDo(trainWorker(s, now, data));
    }
    // Soldiers fill what is left (minus room for the mixes about to hatch).
    const hatching = s.mixQueue.reduce((sum, e) => sum + monsterSlots(e.result, data), 0);
    if (populationFree(s, data) > hatching && workers >= workerTarget) {
      for (const b of s.village.buildings) {
        if (data.buildingById.get(b.type)?.feature !== 'barracks' || b.level < 1) continue;
        const def = soldierKindOf(b.type, data);
        if (!def) continue;
        // The best rank this barracks has opened.
        const rank = unlockedRanks(b.level, data) - 1;
        const cost = soldierTrainCost({ kind: def.id, rank }, data);
        if (!affordable({ gold: cost.gold, food: cost.food, wood: 0, stone: 0 })) continue;
        tryDo(trainSoldier(s, { buildingId: b.id, rank }, now, data));
        break;
      }
    }
  }

  /** Buys land when the next building has nowhere to go, or when gold piles up. */
  function buyLand() {
    const price = nextPlotPrice(s.village, data);
    if (!price || !affordable({ gold: price.gold, food: 0, wood: 0, stone: 0 })) return;
    const crowded = !spotFor(3);
    const rich = s.resources.gold > price.gold * 3;
    if (!crowded && !rich) return;
    const n = plotsPerSide(data);
    for (let py = 0; py < n; py++) {
      for (let px = 0; px < n; px++) {
        if (plotStatus(s, px, py, data) === 'buyable') {
          tryDo(buyPlot(s, { px, py }, data));
          return;
        }
      }
    }
  }

  /** Raids already met: the army moves out once per raid. */
  const rallied = new Set<string>();

  /** A raid is coming: the free army stands on its way, a few tiles before the Balai. */
  function defendRaid(now: number) {
    const raid = currentRaid(s);
    if (!raid || rallied.has(raid.id) || s.missions.some((m) => m.encounterId === raid.id)) return;
    rallied.add(raid.id);
    const route = raidRoute(s, raid, data);
    const spot = route[Math.max(0, route.length - 1 - player.raidRallyTiles)];
    if (!spot) return;
    const ids = Object.keys(s.units).filter((id) => !isOnMission(s, id));
    if (ids.length > 0) tryDo(moveUnits(s, { ids, x: spot.x, y: spot.y }, now, data));
  }

  /** Takes fights it is likely to win, with the fewest monsters that get there. */
  function fight(now: number) {
    for (const e of s.village.encounters) {
      if (s.missions.some((m) => m.encounterId === e.id)) continue;
      // Soldiers go first; adult monsters not in the mixer join when needed.
      const free = [
        ...s.soldiers.map((x) => x.id),
        ...s.monsters
          .filter((m) => isFinalStage(m.stage, data))
          .filter((m) => !s.mixQueue.some((q) => q.parents.some((p) => p.id === m.id)))
          .map((m) => m.id),
      ].filter((id) => !isOnMission(s, id));
      // Power tells which teams are worth simulating; a short simulated preview of the
      // whole free army then decides (raw power alone was far too hopeful).
      const team = free.slice(0, data.rules.skirmish.maxTeam);
      if (team.length === 0) continue;
      const units = teamUnits(s, team, data);
      if (teamPower(units, e, data) < encounterPower(e, units, data)) continue;
      if (previewWinChance(s, team, e, 30, data) >= player.minWinChance) {
        // The team walks there and the enemy engages on contact; one target at a time.
        tryDo(sendTeam(s, { monsterIds: team, encounterId: e.id }, now, data));
        return;
      }
    }
  }

  function tickMixer(now: number) {
    for (const egg of [...s.eggs]) {
      if (egg.readyAt <= now) tryDo(hatchEgg(s, egg.id, now, data));
    }
    for (const entry of [...s.mixQueue]) {
      if (mixRemaining(entry, now) === 0) tryDo(collectMix(s, entry.id, now, data));
    }
    if (isMixerUnlocked(s, data) && s.mixQueue.length < s.mixerSlots) {
      const parents = eligibleParents(s, data).filter((m) => !isOnMission(s, m.id));
      if (parents.length >= 2) {
        tryDo(startMix(s, { parentAId: parents[0]!.id, parentBId: parents[1]!.id }, now, data));
      }
    }
    // Grow babies with food the Balai does not need.
    for (const m of s.monsters) {
      if (isFinalStage(m.stage, data)) continue;
      const amount = foodToNextStage(m, data) - m.food;
      if (amount > 0 && affordable({ gold: 0, food: amount, wood: 0, stone: 0 })) {
        tryDo(feedMonster(s, { monsterId: m.id, amount }, data));
      }
    }
  }

  /** Idle workers go to the wild node that gives what the Balai is shortest of. */
  function gather() {
    const need = balaiNeed();
    const shortest = [...VILLAGE_RESOURCES]
      .filter((r) => r !== 'gold')
      .sort((a, b) => s.resources[a] - need[a] - (s.resources[b] - need[b]));
    const hall = hallOf();
    // A careful player keeps workers out of the enemies' reach (they chase and strike).
    const safe = (o: { x: number; y: number }) =>
      s.village.encounters.every(
        (e) => Math.hypot(o.x - e.x, o.y - e.y) > aggroRadius(e, data) + 1,
      );
    for (const resource of shortest) {
      const nodes = s.village.obstacles
        .filter((o) => (data.obstacleById.get(o.type)?.yield[resource] ?? 0) > 0)
        .filter((o) => o.refillAt == null && safe(o))
        .sort(
          (a, b) =>
            Math.abs(a.x - hall.x) +
            Math.abs(a.y - hall.y) -
            (Math.abs(b.x - hall.x) + Math.abs(b.y - hall.y)),
        );
      for (const o of nodes) {
        const idle = idleWorkers(s).length;
        if (idle === 0) return;
        const max = data.obstacleById.get(o.type)!.work.maxWorkers - gatherWorkers(s, o.id);
        if (max > 0) tryDo(sendWorkers(s, o.id, Math.min(max, idle), data));
      }
    }
  }

  // ---------- The days ----------

  const day = 86_400;
  let now = 0;
  for (let d = 0; d < player.days; d++) {
    earned = emptyEarned();
    won = 0;
    lost = 0;
    raidsWon = 0;
    raidsLost = 0;
    stolen = { gold: 0, food: 0, wood: 0, stone: 0 };
    for (const start of player.sessionStarts) {
      const begin = d * day + start * 3600;
      advanceWorld(begin);
      now = begin;
      const end = begin + player.sessionMinutes * 60;
      while (now < end) {
        sessionStep(now);
        const before = s;
        const r = advanceWilds(s, player.stepSeconds, now + player.stepSeconds, data);
        s = r.state;
        earn(before, s);
        // Raids, like gathering, only move on while the game is open.
        s = advanceRaids(s, player.stepSeconds, now + player.stepSeconds, data).state;
        now += player.stepSeconds;
        advanceWorld(now);
      }
      // Leaving the game: gathering stops, workers stay where they are.
    }
    advanceWorld((d + 1) * day - 1);
    const monsterSlots = s.monsters.reduce(
      (sum, m) => sum + (data.rules.battle.powerPoints[String(formTierOf(m, data))] ?? 1),
      0,
    );
    days.push({
      day: d + 1,
      earned,
      townHall: townHallLevel(s, data),
      plots: s.village.unlockedPlots.length,
      workers: s.workers.length,
      monsterSlots,
      populationCap: populationCap(s, data),
      monsters: s.monsters.length,
      maxFormTier: Math.max(0, ...s.monsters.map((m) => formTierOf(m, data))),
      fightsWon: won,
      fightsLost: lost,
      raidsWon,
      raidsLost,
      stolen,
    });
  }
  return { milestones, days, final: s };
}

/** "hari 2, 18:35" for a time in seconds since the start of the simulation. */
export function formatSimTime(at: number): string {
  const day = Math.floor(at / 86_400) + 1;
  const rest = at % 86_400;
  const h = Math.floor(rest / 3600);
  const m = Math.floor((rest % 3600) / 60);
  return `hari ${day}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
