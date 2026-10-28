import type { SoundId } from '../audio/synth';
import {
  type ActionName,
  type ActionOutput,
  type ActionParams,
  gatherWorkers,
  constructionRemaining,
  connectedGroup,
  cropStatus,
  gameData,
  levelDef,
  obstacleDef,
  pendingProduction,
  productionOf,
  staffWorkers,
  encounterGroup,
  encounterPower,
  missionFor,
  teamPower,
  teamUnits,
  previewWinChance,
  hasFeature,
  eggInNest,
  soulEggStatus,
  rarityOf,
  monsterName,
  soldierKindOf,
  barracksQueue,
  barracksRemaining,
  serbuPowerCap,
  maxFormTier,
  animalType,
  animalWorkers,
  freeRanchSlots,
  jobSeconds,
  ranchAnimalsIn,
  ranchSlots,
  type AnimalJob,
  isStorable,
  sellValue,
  speedUpCost,
  idleWorkers,
  constructionTime,
  constructionWorkers,
  maxConstructionWorkers,
  populationCap,
  populationUsed,
  decorationPopulation,
  marketDrawStatus,
  huntersOf,
  isOnMission,
  unitTile,
  machineName,
  workshopLevel,
  workshopQueue,
  workshopQueueMax,
  healAllGems,
  healCost,
  healPercentPerMinute,
  healSeconds,
  healableIds,
  soldierName,
  unitHp,
  unitMaxHp,
  researchRemaining,
  techDef,
  trainingRemaining,
  townHallLevel,
  towerReach,
  towerRules,
  towerStats,
  currentRaid,
  workerTrainSeconds,
  scaleAmount,
  nextPlotPrice,
  plotsPerSide,
  plotStatus,
  type Building,
  type PlayerState,
} from '@soul-monster/shared';
import type { Selection } from '../events';
import { encounterMembers, encounterTitle } from '../views/enemyText';
import { rewardLabel } from '../views/TeamView';
import { costLabel, prizeLabel } from '../ui/cost';
import { formatDuration, formatNumber, t } from '../text';
import { COLORS } from '../ui/theme';
import type { PanelKind } from './UIScene';

export interface InfoButton {
  label: string;
  color?: number;
  disabled?: boolean;
  onClick: () => void;
}

/** What the selection card shows: header, description, a live status line and actions. */
export interface InfoContent {
  title: string;
  iconType: string;
  iconLevel: number;
  lines: string[];
  /** Re-evaluated every second (timers, stored production). */
  status?: () => string;
  /** Worker count picker shown above the buttons (upgrade / join a construction). */
  workers?: { label: string; value: number; min: number; max: number; set: (n: number) => void };
  buttons: InfoButton[];
}

/** Side effects the card's buttons need from the UI scene. */
export interface InfoActions {
  now(): number;
  run<N extends ActionName>(
    name: N,
    params: ActionParams<N>,
  ): Extract<ActionOutput<N>, { ok: true }> | null;
  openPanel(kind: PanelKind, targetId?: string): void;
  /** Opens the Serbu screen (Guild) or the Petualangan map (Gerbang Petualangan). */
  openBattles(source: 'serbu' | 'adventure'): void;
  toast(message: string, color?: number, sound?: SoundId | null): void;
  deselect(): void;
  startMove(buildingId: string, group?: boolean): void;
  confirm(message: string, onYes: () => void): void;
  /** Monsters picked for the next wild fight. */
  team(): string[];
  clearTeam(): void;
  /** Remembered worker choice for a card control, or `fallback`. */
  workerCount(key: string, fallback: number): number;
  setWorkerCount(key: string, n: number): void;
}

export function infoContent(
  state: PlayerState,
  selection: Selection,
  actions: InfoActions,
): InfoContent | null {
  if (!selection) return null;
  if (selection.kind === 'obstacle') return obstacleInfo(state, selection.id, actions);
  if (selection.kind === 'plot') return plotInfo(state, selection.id, actions);
  if (selection.kind === 'animal') return animalInfo(state, selection.id, actions);
  if (selection.kind === 'encounter') return encounterInfo(state, selection.id, actions);
  const b = state.village.buildings.find((x) => x.id === selection.id);
  return b ? buildingInfo(state, b, actions) : null;
}

function plotInfo(state: PlayerState, id: string, a: InfoActions): InfoContent | null {
  const [px = -1, py = -1] = id.split(',').map(Number);
  const status = plotStatus(state, px, py);
  if (status === 'open' || status === 'outOfMap') return null;
  const total = plotsPerSide() ** 2;
  const lines = [
    t('plot.description'),
    t('plot.progress', { open: state.village.unlockedPlots.length, total }),
  ];
  const buttons: InfoButton[] = [];
  const price = nextPlotPrice(state.village);
  if (status === 'notAdjacent') {
    lines.push(t('plot.notAdjacent'));
  } else if (price) {
    const cost = costLabel({ gold: price.gold, food: 0, wood: 0, stone: 0 });
    const buyable = status === 'buyable';
    buttons.push({
      label: buyable
        ? t('plot.buy', { cost })
        : t('build.needsHall', { level: price.requiresTownHall }),
      color: COLORS.goldDark,
      disabled: !buyable,
      onClick: () =>
        a.confirm(t('plot.buyConfirm', { cost }), () => {
          if (!a.run('buyPlot', { px, py })) return;
          a.toast(t('plot.bought'), COLORS.good, 'unlock-land');
          a.deselect();
        }),
    });
  }
  return { title: t('plot.title'), iconType: 'plot-sign', iconLevel: 1, lines, buttons };
}

/** Clamped worker choice for a card control, remembered by the UI scene. */
function pick(a: InfoActions, key: string, max: number) {
  const value = Math.min(max, Math.max(1, a.workerCount(key, max)));
  return { value, set: (n: number) => a.setWorkerCount(key, n) };
}

function encounterInfo(state: PlayerState, id: string, a: InfoActions): InfoContent | null {
  const e = state.village.encounters.find((x) => x.id === id);
  if (!e) return null;
  const group = encounterGroup(e);
  const ids = a.team();
  const members = teamUnits(state, ids);
  // Simulated odds, worked out once per card (the team only changes by rebuilding it).
  const percent = members.length ? Math.round(previewWinChance(state, ids, e) * 100) : 0;
  const mission = missionFor(state, e.id);
  const lines = [
    group.kind === 'bandit'
      ? t('enemy.banditInfo')
      : group.kind === 'goblin'
        ? t('enemy.goblinInfo')
        : encounterMembers(e),
    t('team.reward', { reward: rewardLabel(group.reward) }),
  ];
  if (e.raid) lines.unshift(t('raid.info', { n: gameData.rules.raids.defendTiles }));
  const content: InfoContent = {
    title: encounterTitle(e),
    iconType: group.kind === 'monster' ? 'enemy-monster' : `enemy-${group.kind}`,
    iconLevel: 1,
    lines,
    status: () => {
      if (mission) {
        // The enemy spotted the team and closed in: they fight with no time limit.
        return t('team.fighting', { n: mission.monsterIds.length });
      }
      const power = encounterPower(e, members);
      const parts = [t('enemy.power', { power: power.toFixed(1) })];
      if (members.length > 0) {
        parts.push(
          t('team.status', {
            n: members.length,
            power: teamPower(members, e).toFixed(1),
            percent,
          }),
        );
      } else {
        parts.push(t('team.pickHint'));
      }
      return parts.join('\n');
    },
    buttons: [],
  };
  if (!mission) {
    content.buttons.push({
      label: t('team.pick'),
      color: COLORS.accentDark,
      onClick: () => a.openPanel('team', e.id),
    });
    content.buttons.push({
      label: t('team.send'),
      color: 0x3c9a5f,
      disabled: members.length === 0,
      onClick: () => {
        const r = a.run('sendTeam', { monsterIds: ids, encounterId: e.id });
        if (!r) return;
        a.toast(t('team.sent', { n: ids.length }), COLORS.good, 'march');
        a.clearTeam();
      },
    });
  }
  return content;
}

function animalInfo(state: PlayerState, id: string, a: InfoActions): InfoContent | null {
  const animal = state.village.animals.find((x) => x.id === id);
  if (!animal) return null;
  const def = animalType(animal.type);
  // Tugas 1C.9: soldiers hunt, workers capture.
  const hunters = huntersOf(state, animal.id);
  const workers = animalWorkers(state, animal.id);
  const job = animal.job;
  const crew = job === 'hunt' ? hunters.length : workers;
  const left = (j: AnimalJob, n: number) =>
    Math.ceil((jobSeconds(animal.type, j) - (job === j ? animal.work : 0)) / Math.max(1, n));
  const content: InfoContent = {
    title: def.name,
    iconType: animal.type,
    iconLevel: 1,
    lines: [
      t('animal.huntInfo', { food: def.hunt.food }),
      t('animal.captureInfo', { perHour: def.ranchFoodPerHour }),
    ],
    status: () => {
      if (crew > 0 && job) {
        const percent = Math.floor((animal.work / jobSeconds(animal.type, job)) * 100);
        return t('animal.working', {
          job: t(`animal.job.${job}`),
          who: t(`animal.who.${job}`),
          n: crew,
          max: def.maxWorkers,
          percent,
          time: formatDuration(left(job, crew)),
        });
      }
      return t('animal.ranchSlots', { free: Math.max(0, freeRanchSlots(state)) });
    },
    buttons: [],
  };
  if (workers === 0) {
    // Free soldiers (not fighting, not guarding or hunting elsewhere), nearest first.
    const free = state.soldiers
      .map((sd) => sd.id)
      .filter((sid) => state.units[sid] && !state.units[sid]!.guard && !isOnMission(state, sid))
      .map((sid) => {
        const p = unitTile(state.units[sid]!, a.now());
        return { sid, d: Math.hypot(p.x - animal.x, p.y - animal.y) };
      })
      .sort((x, y) => x.d - y.d)
      .slice(0, def.maxWorkers - hunters.length)
      .map((u) => u.sid);
    if (free.length > 0) {
      content.buttons.push({
        label: t('animal.huntSoldiers', {
          n: free.length,
          time: formatDuration(left('hunt', hunters.length + free.length)),
        }),
        color: 0x3c9a5f,
        onClick: () => a.run('huntAnimal', { ids: free, animalId: animal.id }),
      });
    } else if (hunters.length < def.maxWorkers) {
      content.lines.push(t('animal.noSoldiers'));
    }
  }
  const canSend =
    hunters.length > 0 ? 0 : Math.min(idleWorkers(state).length, def.maxWorkers - workers);
  if (canSend > 0) {
    const { value, set } = pick(a, `animal:${animal.id}`, canSend);
    content.workers = {
      label: t('info.workersTime', {
        n: value,
        time: formatDuration(left('capture', workers + value)),
      }),
      value,
      min: 1,
      max: canSend,
      set,
    };
    content.buttons.push({
      label: t('animal.capture', { time: formatDuration(left('capture', workers + value)) }),
      color: COLORS.goldDark,
      disabled: workers === 0 && freeRanchSlots(state) < 1,
      onClick: () => a.run('sendToAnimal', { id: animal.id, job: 'capture', count: value }),
    });
  } else if (hunters.length === 0 && workers < def.maxWorkers) {
    content.lines.push(t('place.noWorkers'));
  }
  if (crew > 0) {
    content.buttons.push({
      label: t(job === 'hunt' ? 'animal.recallHunters' : 'info.recallWorkers'),
      color: COLORS.panelLight,
      onClick: () => a.run('recallWorkers', { id: animal.id }),
    });
  }
  return content;
}

function obstacleInfo(state: PlayerState, id: string, a: InfoActions): InfoContent | null {
  const o = state.village.obstacles.find((x) => x.id === id);
  if (!o) return null;
  const def = obstacleDef(o.type);
  const total = def.work.workSeconds;
  const crew = gatherWorkers(state, o.id);
  const max = def.work.maxWorkers;
  const percent = Math.floor((o.work / total) * 100);
  const content: InfoContent = {
    title: def.name,
    iconType: o.type,
    iconLevel: 1,
    lines: [t('info.wildYield', { yield: costLabel(def.yield) }), t('info.wildHint')],
    status: () =>
      crew > 0
        ? t('info.gathering', {
            n: crew,
            max,
            percent,
            time: formatDuration(Math.ceil((total - o.work) / crew)),
          })
        : t('info.wildProgress', { percent, max }),
    buttons: [],
  };
  // An empty gold vein: nothing to gather until it fills up again.
  if (o.refillAt != null) {
    const refillAt = o.refillAt;
    content.lines = [t('info.veinEmpty')];
    content.status = () =>
      t('info.veinRefill', { time: formatDuration(Math.max(0, refillAt - a.now())) });
    return content;
  }
  const canSend = Math.min(idleWorkers(state).length, max - crew);
  if (canSend > 0) {
    const { value, set } = pick(a, `gather:${o.id}`, canSend);
    content.workers = {
      label: t('info.workersTime', {
        n: value,
        time: formatDuration(Math.ceil((total - o.work) / (crew + value))),
      }),
      value,
      min: 1,
      max: canSend,
      set,
    };
    content.buttons.push({
      label: t('info.sendWorkers'),
      color: 0x3c9a5f,
      onClick: () => a.run('sendWorkers', { id: o.id, count: value }),
    });
  } else if (crew < max) {
    content.lines.push(t('place.noWorkers'));
  }
  if (crew > 0) {
    content.buttons.push({
      label: t('info.recallWorkers'),
      color: COLORS.panelLight,
      onClick: () => a.run('recallWorkers', { id: o.id }),
    });
  }
  return content;
}

const populationLine = (state: PlayerState) =>
  t('info.population', { used: populationUsed(state), cap: populationCap(state) });

const workersLine = (state: PlayerState) =>
  t('info.workers', { idle: idleWorkers(state).length, total: state.workers.length });

function buildingInfo(state: PlayerState, b: Building, a: InfoActions): InfoContent {
  const def = gameData.buildingById.get(b.type)!;
  const now = a.now();
  const content: InfoContent = {
    title: b.level > 0 ? t('info.title', { name: def.name, level: b.level }) : def.name,
    iconType: b.type,
    iconLevel: Math.max(1, b.level),
    lines: [def.description],
    buttons: [],
  };
  const { buttons } = content;
  const statuses: (() => string)[] = [];

  const maxWorkers = maxConstructionWorkers(b.type);
  const idle = idleWorkers(state).length;

  if (b.construction) {
    const toLevel = b.construction.toLevel;
    const current = constructionWorkers(state, b.id);
    statuses.push(() =>
      [
        t('info.building', {
          level: toLevel,
          time: formatDuration(constructionRemaining(b, a.now())),
        }),
        t('info.constructionWorkers', { n: current, max: maxWorkers }),
      ].join('\n'),
    );
    const canAdd = Math.min(idle, maxWorkers - current);
    if (canAdd > 0) {
      const { value, set } = pick(a, `add:${b.id}`, canAdd);
      const left = constructionRemaining(b, now);
      const after = Math.ceil((left * Math.max(1, current)) / (current + value));
      content.workers = {
        label: t('info.addWorkersLabel', { n: value, time: formatDuration(after) }),
        value,
        min: 1,
        max: canAdd,
        set,
      };
      buttons.push({
        label: t('info.addWorkers'),
        color: 0x3c9a5f,
        onClick: () => a.run('addConstructionWorkers', { id: b.id, count: value }),
      });
    }
    buttons.push({
      label: t('info.speedUp', { gems: speedUpCost(constructionRemaining(b, now)) }),
      color: 0x2a8fb0,
      onClick: () => a.run('speedUpBuilding', { id: b.id }),
    });
  }

  const level = b.level >= 1 ? levelDef(b.type, b.level) : undefined;
  const production = productionOf(state, b);
  if (production && !b.construction) {
    statuses.push(() =>
      t('info.stored', {
        amount: formatNumber(pendingProduction(state, b, a.now())),
        capacity: formatNumber(production.capacity),
        perHour: formatNumber(production.perHour),
        resource: t(`res.${production.resource}`),
      }),
    );
    buttons.push({
      label: t('info.collect'),
      color: 0x3c9a5f,
      disabled: pendingProduction(state, b, now) <= 0,
      onClick: () => a.run('collectBuilding', { id: b.id }),
    });
  }

  const crop = level?.crop;
  if (crop) {
    statuses.push(() => {
      const status = cropStatus(b, a.now());
      if (status === 'ready') return t('info.cropReady', { food: b.crop?.food ?? crop.food });
      if (status === 'growing') {
        return t('info.cropGrowing', {
          time: formatDuration(Math.max(0, (b.crop?.endsAt ?? 0) - a.now())),
        });
      }
      return b.construction
        ? t('info.cropWaitUpgrade')
        : t('info.cropEmpty', { food: crop.food, time: formatDuration(crop.seconds) });
    });
    const status = cropStatus(b, now);
    if (status === 'empty' && !b.construction) {
      buttons.push({
        label: t('info.plant', { gold: crop.plantGold }),
        color: 0x3c9a5f,
        onClick: () => a.run('plantCrop', { id: b.id }),
      });
    } else if (status === 'ready') {
      buttons.push({
        label: t('info.harvest'),
        color: 0x3c9a5f,
        onClick: () => a.run('harvestCrop', { id: b.id }),
      });
    }
  }

  if (b.level >= 1) {
    switch (def.feature) {
      case 'townHall': {
        statuses.push(() => {
          const lines = [populationLine(state), workersLine(state)];
          const left = trainingRemaining(state, a.now());
          if (left !== null) {
            lines.push(
              t('info.training', {
                count: state.workerTraining.length,
                time: formatDuration(left),
              }),
            );
          }
          return lines.join('\n');
        });
        buttons.push({
          label: t('info.trainWorker', {
            food: formatNumber(gameData.rules.workers.trainFood),
            time: formatDuration(workerTrainSeconds(state)),
          }),
          color: 0x3c9a5f,
          onClick: () => {
            if (a.run('trainWorker', {})) a.toast(t('info.trainingStarted'), COLORS.good);
          },
        });
        break;
      }
      case 'defense': {
        const { wall, magicTower } = gameData.rules.raids;
        const at = Math.max(1, b.level);
        if (towerRules(b.type)) {
          const stats = towerStats(b);
          content.lines.push(t('tower.info', { n: towerReach(b), hp: stats.hp, atk: stats.atk }));
          if (b.type === magicTower.building) {
            content.lines.push(
              t('tower.splash', {
                percent: Math.round(magicTower.splash.ratio * 100),
                radius: magicTower.splash.radiusTiles,
              }),
            );
          }
        } else if (b.type === wall.building) {
          const hp = wall.hpByLevel[Math.min(at, wall.hpByLevel.length) - 1]!;
          content.lines.push(t('wall.info', { hp }));
        }
        break;
      }
      case 'gate': {
        const { gate } = gameData.rules.raids;
        const hp = gate.hpByLevel[Math.min(Math.max(1, b.level), gate.hpByLevel.length) - 1]!;
        content.lines.push(t('gate.info', { hp }));
        statuses.push(() =>
          currentRaid(state) ? t('gate.raidClosed') : t(b.closed ? 'gate.closed' : 'gate.open'),
        );
        buttons.push({
          label: t(b.closed ? 'gate.doOpen' : 'gate.doClose'),
          onClick: () => a.run('toggleGate', { id: b.id }),
        });
        break;
      }
      case 'house':
        content.lines.push(t('info.housePopulation', { population: level?.population ?? 0 }));
        statuses.push(() => populationLine(state));
        break;
      case 'storage':
        content.lines.push(t('info.gudangItems', { n: state.storage.length }));
        if (state.eggs.length > 0 && !hasFeature(state, 'nest', gameData)) {
          content.lines.push(t('info.eggWaitingInGudang'));
        }
        buttons.push({ label: t('info.openGudang'), onClick: () => a.openPanel('storage') });
        break;
      case 'stable':
        statuses.push(() => populationLine(state));
        // Eggs wait here until they hatch (the first monster comes from one).
        for (const egg of state.eggs) {
          const ready = egg.readyAt <= a.now();
          statuses.push(() =>
            egg.readyAt <= a.now()
              ? t('egg.ready')
              : t('egg.waiting', { time: formatDuration(egg.readyAt - a.now()) }),
          );
          buttons.push({
            label: t('egg.hatch'),
            color: 0x3c9a5f,
            disabled: !ready,
            onClick: () => {
              const r = a.run('hatchEgg', { id: egg.id });
              if (r) a.toast(t('egg.hatched', { name: monsterName(r.monster) }), COLORS.good);
            },
          });
        }
        buttons.push({ label: t('info.openCollection'), onClick: () => a.openPanel('collection') });
        break;
      case 'mixer':
      case 'altar':
        buttons.push({ label: t('info.openMixer'), onClick: () => a.openPanel('mixer') });
        break;
      case 'nest': {
        buttons.push({ label: t('info.openCollection'), onClick: () => a.openPanel('collection') });
        // Monster eggs (starting egg or other eggs) ready to hatch
        for (const egg of state.eggs) {
          const ready = egg.readyAt <= a.now();
          statuses.push(() =>
            egg.readyAt <= a.now()
              ? t('egg.ready')
              : t('egg.waiting', { time: formatDuration(egg.readyAt - a.now()) }),
          );
          buttons.push({
            label: t('egg.hatch'),
            color: 0x3c9a5f,
            disabled: !ready,
            onClick: () => {
              const r = a.run('hatchEgg', { id: egg.id });
              if (r) a.toast(t('egg.hatched', { name: monsterName(r.monster) }), COLORS.good);
            },
          });
        }
        if (b.level < 1) break;
        const { steps } = gameData.rules.nest;
        content.lines.push(t('nest.count', { n: state.soulEggs.length }));
        const egg = eggInNest(state) ?? state.soulEggs[0];
        if (!egg) {
          content.lines.push(t('nest.none'));
          break;
        }
        statuses.push(() => {
          const e = state.soulEggs.find((x) => x.id === egg.id)!;
          const status = soulEggStatus(e, a.now());
          if (status === 'waiting') return t('nest.waiting');
          if (status === 'ready') return t('nest.ready');
          if (status === 'nextStep')
            return t('nest.stepDone', { step: e.step, total: steps.length });
          return t('nest.caring', {
            step: e.step,
            total: steps.length,
            time: formatDuration(e.endsAt! - a.now()),
          });
        });
        const status = soulEggStatus(egg, a.now());
        if (status === 'ready') {
          buttons.push({
            label: t('nest.hatch'),
            color: 0x3c9a5f,
            onClick: () => {
              const r = a.run('hatchSoulEgg', { id: egg.id });
              if (r) {
                const rarity = gameData.rules.rarity.names[rarityOf(r.monster)];
                a.toast(t('nest.hatched', { name: monsterName(r.monster), rarity }), COLORS.good);
              }
            },
          });
        } else {
          const food = steps[egg.step]?.food ?? 0;
          buttons.push({
            label: t(egg.step === 0 ? 'nest.start' : 'nest.care', { food }),
            color: 0x3c9a5f,
            disabled: status === 'caring',
            onClick: () => {
              if (a.run('careSoulEgg', { id: egg.id })) a.toast(t('nest.cared'), COLORS.good);
            },
          });
        }
        break;
      }
      case 'serbu':
        content.lines.push(t('info.powerCap', { cap: serbuPowerCap(state) }));
        if (b.level >= 1) {
          buttons.push({
            label: t('info.openSerbu'),
            color: COLORS.danger,
            onClick: () => a.openBattles('serbu'),
          });
        }
        break;
      case 'adventure':
        content.lines.push(
          t('info.adventureProgress', {
            n: state.bossesDefeated,
            tier: maxFormTier(state.bossesDefeated),
          }),
        );
        {
          // Tugas 1C.8: each gate level opens one more region.
          const { regions } = gameData.adventure;
          const opened = regions.filter((r) => r.requiresGateLevel <= b.level);
          content.lines.push(
            t('info.adventureRegions', {
              n: opened.length,
              total: regions.length,
              next: regions.find((r) => r.requiresGateLevel > b.level)?.name ?? '-',
            }),
          );
        }
        if (b.level >= 1) {
          buttons.push({
            label: t('info.openAdventure'),
            color: COLORS.accentDark,
            onClick: () => a.openBattles('adventure'),
          });
        }
        break;
      case 'arena':
        content.lines.push(t('info.comingSoon'));
        break;
      case 'staffed': {
        const slots = level?.workerSlots ?? 0;
        const per = level?.staffedProduction?.perWorkerPerHour ?? 0;
        const crew = staffWorkers(state, b.id);
        const resource = t(`res.${level?.staffedProduction?.resource ?? 'gold'}`);
        content.lines.push(t('info.staffedRate', { per: formatNumber(per), resource }));
        statuses.push(() => t('info.staff', { n: crew, max: slots }));
        const canAdd = Math.min(idle, slots - crew);
        if (canAdd > 0) {
          const { value, set } = pick(a, `staff:${b.id}`, canAdd);
          content.workers = {
            label: t('info.staffAdd', {
              n: value,
              perHour: formatNumber((crew + value) * per),
              resource,
            }),
            value,
            min: 1,
            max: canAdd,
            set,
          };
          buttons.push({
            label: t('info.staffIn'),
            color: 0x3c9a5f,
            onClick: () => a.run('staffBuilding', { id: b.id, count: value }),
          });
        }
        if (crew > 0) {
          buttons.push({
            label: t('info.staffOut'),
            color: COLORS.panelLight,
            onClick: () => a.run('unstaffBuilding', { id: b.id, count: 1 }),
          });
        }
        break;
      }
      case 'graveyard': {
        content.lines.push(t('graveyard.count', { n: state.graveyard.length }));
        buttons.push({
          label: t('graveyard.open'),
          color: COLORS.accentDark,
          onClick: () => a.openPanel('graveyard'),
        });
        break;
      }
      case 'ranch': {
        const living = ranchAnimalsIn(state, b.id);
        content.lines.push(t('info.ranchAnimals', { n: living.length, max: ranchSlots(b) }));
        if (living.length === 0) {
          content.lines.push(t('info.ranchEmpty'));
        } else {
          const counts = new Map<string, number>();
          for (const r of living) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
          content.lines.push(
            [...counts].map(([type, n]) => `${animalType(type).name} ×${n}`).join(', '),
          );
        }
        break;
      }
      case 'barracks': {
        content.lines.push(t('info.powerCap', { cap: serbuPowerCap(state) }));
        const kind = soldierKindOf(b.type)?.id;
        content.lines.push(
          t('barracks.army', { n: state.soldiers.filter((x) => x.kind === kind).length }),
        );
        statuses.push(() => {
          const left = barracksRemaining(state, b.id, a.now());
          const queued = barracksQueue(state, b.id).length;
          return left === null
            ? t('barracks.idle')
            : t('barracks.training', { n: queued, time: formatDuration(left) });
        });
        buttons.push({
          label: t('barracks.open'),
          color: 0x3c9a5f,
          onClick: () => a.openPanel('barracks', b.id),
        });
        // Wounded soldiers of this barracks can be healed here, Pohon Jiwa or not.
        const wounded = healableIds(state).filter((id) =>
          state.soldiers.some((x) => x.id === id && x.kind === kind),
        );
        if (wounded.length > 0) {
          content.lines.push(t('barracks.wounded', { n: wounded.length }));
          const cost = healCost(state, wounded);
          buttons.push({
            label: t('healing.healFood', { cost: costLabel({ ...cost, wood: 0, stone: 0 }) }),
            color: 0x2f9e8f,
            onClick: () => {
              const r = a.run('healWithFood', { ids: wounded });
              if (r) a.toast(t('healing.healed', { n: r.healed.length }), COLORS.good);
            },
          });
        }
        break;
      }
      case 'healing': {
        // Pohon Jiwa: how fast wounds heal, who is healing, and healing at once.
        content.lines.push(t('healing.rate', { percent: healPercentPerMinute(state) }));
        const wounded = healableIds(state);
        const shown = wounded.slice(0, 4).map((id) => {
          const m = state.monsters.find((x) => x.id === id);
          const s = state.soldiers.find((x) => x.id === id);
          const name = m ? monsterName(m) : s ? soldierName(s) : id;
          return t('healing.unit', { name, hp: unitHp(state, id), max: unitMaxHp(state, id) ?? 0 });
        });
        content.lines.push(...shown);
        if (wounded.length > shown.length) {
          content.lines.push(t('healing.more', { n: wounded.length - shown.length }));
        }
        statuses.push(() => {
          if (currentRaid(state)) return t('healing.paused');
          if (wounded.length === 0) return t('healing.none');
          const longest = Math.max(...wounded.map((id) => healSeconds(state, id, a.now())));
          return t('healing.healing', { n: wounded.length, time: formatDuration(longest) });
        });
        if (wounded.length > 0 && b.level >= 1) {
          const cost = healCost(state, wounded);
          buttons.push({
            label: t('healing.healFood', { cost: costLabel({ ...cost, wood: 0, stone: 0 }) }),
            color: 0x2f9e8f,
            onClick: () => {
              const r = a.run('healWithFood', {});
              if (r) a.toast(t('healing.healed', { n: r.healed.length }), COLORS.good);
            },
          });
          const gems = healAllGems(state, a.now());
          buttons.push({
            label: t('healing.healGems', { gems }),
            color: COLORS.accentDark,
            onClick: () =>
              a.confirm(t('healing.healGemsConfirm', { gems }), () => {
                const r = a.run('healAllWithGems', {});
                if (r) a.toast(t('healing.healed', { n: r.healed.length }), COLORS.good);
              }),
          });
        }
        break;
      }
      case 'research': {
        // Perpustakaan: Riset teknologi, antrean, dan status aktif.
        const doneCount = state.research.completed.length;
        const totalCount = gameData.rules.research.techs.length;
        content.lines.push(t('research.completedCount', { n: doneCount, total: totalCount }));

        if (state.research.active) {
          const activeTech = techDef(state.research.active.techId);
          if (activeTech) {
            content.lines.push(activeTech.name);
          }
        }

        statuses.push(() => {
          if (!state.research.active) return t('research.idle');
          const left = researchRemaining(state, a.now());
          const activeTech = techDef(state.research.active.techId);
          return t('research.active', {
            name: activeTech?.name ?? '',
            time: formatDuration(left ?? 0),
          });
        });

        if (b.level >= 1) {
          buttons.push({
            label: t('research.open'),
            color: 0x3f6fb8,
            onClick: () => a.openPanel('research'),
          });

          if (state.research.active) {
            const left = researchRemaining(state, a.now()) ?? 0;
            const gems = speedUpCost(left);
            const activeTech = techDef(state.research.active.techId);
            const techName = activeTech?.name ?? '';
            buttons.push({
              label: t('research.speedUp', { gems }),
              color: COLORS.accentDark,
              onClick: () =>
                a.confirm(t('research.speedUpConfirm', { name: techName, gems }), () => {
                  const r = a.run('speedUpResearch', {});
                  if (r) a.toast(t('research.finished', { name: techName }), COLORS.good);
                }),
            });
          }
        }
        break;
      }
      case 'workshop': {
        // Bengkel: both machines follow its level; build them straight from the card.
        content.lines.push(t('info.powerCap', { cap: serbuPowerCap(state) }));
        content.lines.push(t('workshop.army', { n: state.machines.length }));
        statuses.push(() => {
          const queue = workshopQueue(state, b.id);
          const next = queue[0];
          return next
            ? t('workshop.building', {
                n: queue.length,
                max: workshopQueueMax(b.level),
                time: formatDuration(Math.max(0, next.endsAt - a.now())),
              })
            : t('workshop.idle');
        });
        const version = workshopLevel(state);
        for (const m of gameData.rules.workshop.machines) {
          const name = machineName(m.id, version);
          buttons.push({
            label: t('workshop.build', { name, cost: costLabel(m.build) }),
            color: 0x3c9a5f,
            onClick: () => {
              if (a.run('buildMachine', { buildingId: b.id, kind: m.id })) {
                a.toast(t('workshop.started', { name }), COLORS.good);
              }
            },
          });
        }
        break;
      }
      default:
        break;
    }
    if (b.type === gameData.rules.marketDraw.building) {
      // Undian Harian: one free draw a day per account, rolled on the server.
      statuses.push(() => {
        const draw = marketDrawStatus(state, a.now());
        return draw.available
          ? t('market.drawReady')
          : t('market.drawNext', { time: formatDuration(draw.nextIn) });
      });
      if (marketDrawStatus(state, a.now()).available) {
        buttons.push({
          label: t('market.draw'),
          color: 0xc98a1a,
          onClick: () => {
            const r = a.run('drawMarket', {});
            if (r) {
              const key = r.prize.soulEggs > 0 ? 'market.drawnEgg' : 'market.drawn';
              a.toast(t(key, { prize: prizeLabel(r.prize) }), COLORS.good, 'win');
            }
          },
        });
      }
    }
    if (def.category === gameData.rules.population.decorationCategory && level?.population) {
      content.lines.push(t('info.decorationPopulation', { population: level.population }));
      statuses.push(() => t('info.decorationTotal', decorationPopulation(state)));
    }
  }

  const next = levelDef(b.type, b.level + 1);
  if (next && !b.construction && def.lineBuild) {
    // Walls: upgrade the whole connected stretch in one go.
    const group = connectedGroup(state, b.id);
    if (group.length > 1 && townHallLevel(state) >= next.requiresTownHall) {
      buttons.push({
        label: t('info.upgradeGroup', {
          count: group.length,
          cost: costLabel(scaleAmount(next.cost, group.length)),
        }),
        color: COLORS.accentDark,
        onClick: () => {
          const r = a.run('upgradeGroup', { id: b.id });
          if (r) a.toast(t('info.upgradedGroup', { count: r.count }), COLORS.good);
        },
      });
    }
  }
  if (next && !b.construction) {
    const hallOk = townHallLevel(state) >= next.requiresTownHall;
    let workers: number | undefined;
    const avail = Math.min(idle, maxWorkers);
    if (hallOk && next.seconds > 0 && avail > 0) {
      const { value, set } = pick(a, `upgrade:${b.id}`, avail);
      workers = value;
      // One picker per card: a mine's own worker picker wins over the upgrade one.
      content.workers ??= {
        label: t('info.workersTime', {
          n: value,
          time: formatDuration(constructionTime(next.seconds, value)),
        }),
        value,
        min: 1,
        max: avail,
        set,
      };
    }
    buttons.push({
      label: hallOk
        ? t('info.upgrade', { cost: costLabel(next.cost) })
        : t('build.needsHall', { level: next.requiresTownHall }),
      color: COLORS.accentDark,
      disabled: !hallOk,
      onClick: () => {
        const r = a.run('upgradeBuilding', { id: b.id, workers });
        if (r?.collected) a.toast(`+${formatNumber(r.collected)}`, COLORS.good);
      },
    });
  }

  buttons.push({
    label: t('info.move'),
    color: COLORS.panelLight,
    onClick: () => a.startMove(b.id),
  });
  if (!def.lineBuild) {
    buttons.push({
      label: t('info.rotate'),
      color: COLORS.panelLight,
      onClick: () => a.run('rotateBuilding', { id: b.id }),
    });
  }
  if (isStorable(b.type) && !b.construction) {
    buttons.push({
      label: t('info.store'),
      color: COLORS.panelLight,
      onClick: () => {
        const r = a.run('storeBuilding', { id: b.id });
        if (!r) return;
        a.toast(t('info.storedAway', { name: def.name }), COLORS.good);
        a.deselect();
      },
    });
  }
  if (def.lineBuild && !b.construction) {
    const count = connectedGroup(state, b.id).length;
    if (count > 1) {
      buttons.push({
        label: t('info.moveGroup', { count }),
        color: COLORS.panelLight,
        onClick: () => a.startMove(b.id, true),
      });
    }
  }

  if (def.sellable && !b.construction) {
    const refund = sellValue(b);
    buttons.push({
      label: t('info.sell', { cost: costLabel(refund) }),
      color: COLORS.danger,
      onClick: () =>
        a.confirm(t('info.sellConfirm', { name: def.name, cost: costLabel(refund) }), () => {
          if (a.run('sellBuilding', { id: b.id })) a.deselect();
        }),
    });
  }

  if (statuses.length > 0) content.status = () => statuses.map((s) => s()).join('\n');
  return content;
}
