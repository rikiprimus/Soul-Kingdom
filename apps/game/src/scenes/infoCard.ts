import type { SoundId } from '../audio/synth';
import {
  gatherWorkers,
  recallWorkers,
  sendWorkers,
  collectBuilding,
  constructionRemaining,
  connectedGroup,
  cropStatus,
  gameData,
  harvestCrop,
  levelDef,
  obstacleDef,
  pendingProduction,
  productionOf,
  staffBuilding,
  staffWorkers,
  unstaffBuilding,
  encounterGroup,
  encounterPower,
  missionFor,
  sendTeam,
  teamPower,
  teamUnits,
  previewWinChance,
  hatchEgg,
  monsterName,
  soldierKindOf,
  barracksQueue,
  barracksRemaining,
  serbuPowerCap,
  animalType,
  animalWorkers,
  freeRanchSlots,
  jobSeconds,
  ranchAnimalsIn,
  ranchSlots,
  sendToAnimal,
  type AnimalJob,
  plantCrop,
  sellBuilding,
  sellValue,
  speedUpBuilding,
  speedUpCost,
  idleWorkers,
  addConstructionWorkers,
  constructionTime,
  constructionWorkers,
  maxConstructionWorkers,
  populationCap,
  populationUsed,
  trainWorker,
  trainingRemaining,
  townHallLevel,
  upgradeBuilding,
  upgradeGroup,
  scaleAmount,
  buyPlot,
  nextPlotPrice,
  plotsPerSide,
  plotStatus,
  type ActionResult,
  type Building,
  type PlayerState,
} from '@soul-monster/shared';
import type { Selection } from '../events';
import { encounterMembers, encounterTitle } from '../views/enemyText';
import { rewardLabel } from '../views/TeamView';
import { costLabel } from '../ui/cost';
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
  run<T extends object>(
    action: (s: PlayerState, now: number) => ActionResult<T>,
  ): (ActionResult<T> & { ok: true }) | null;
  openPanel(kind: PanelKind, targetId?: string): void;
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
          if (!a.run((s) => buyPlot(s, { px, py }))) return;
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
    group.kind === 'bandit' ? t('enemy.banditInfo') : encounterMembers(e),
    t('team.reward', { reward: rewardLabel(group.reward) }),
  ];
  if (e.raid) lines.unshift(t('raid.info', { n: gameData.rules.raids.defendTiles }));
  const content: InfoContent = {
    title: encounterTitle(e),
    iconType: group.kind === 'bandit' ? 'enemy-bandit' : 'enemy-monster',
    iconLevel: 1,
    lines,
    status: () => {
      if (mission) {
        // Marching to the enemy; once there they fight with no time limit.
        return mission.fight
          ? t('team.fighting', { n: mission.monsterIds.length })
          : t('team.marching', {
              n: mission.monsterIds.length,
              time: formatDuration(Math.max(0, mission.arriveAt - a.now())),
            });
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
        const r = a.run((s, n) => sendTeam(s, { monsterIds: ids, encounterId: e.id }, n));
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
  const crew = animalWorkers(state, animal.id);
  const job = animal.job;
  const left = (j: AnimalJob, n: number) =>
    Math.ceil((jobSeconds(animal.type, j) - (job === j ? animal.work : 0)) / n);
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
  const canSend = Math.min(idleWorkers(state).length, def.maxWorkers - crew);
  if (canSend > 0) {
    const { value, set } = pick(a, `animal:${animal.id}`, canSend);
    content.workers = {
      label: t('info.workersTime', {
        n: value,
        time: formatDuration(left(crew > 0 && job ? job : 'hunt', crew + value)),
      }),
      value,
      min: 1,
      max: canSend,
      set,
    };
    const send = (j: AnimalJob) => () => a.run((s) => sendToAnimal(s, animal.id, j, value));
    if (crew === 0 || job === 'hunt') {
      content.buttons.push({
        label: t('animal.hunt', { time: formatDuration(left('hunt', crew + value)) }),
        color: 0x3c9a5f,
        onClick: send('hunt'),
      });
    }
    if (crew === 0 || job === 'capture') {
      content.buttons.push({
        label: t('animal.capture', { time: formatDuration(left('capture', crew + value)) }),
        color: COLORS.goldDark,
        disabled: crew === 0 && freeRanchSlots(state) < 1,
        onClick: send('capture'),
      });
    }
  } else if (crew < def.maxWorkers) {
    content.lines.push(t('place.noWorkers'));
  }
  if (crew > 0) {
    content.buttons.push({
      label: t('info.recallWorkers'),
      color: COLORS.panelLight,
      onClick: () => a.run((s) => recallWorkers(s, animal.id)),
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
      onClick: () => a.run((s) => sendWorkers(s, o.id, value)),
    });
  } else if (crew < max) {
    content.lines.push(t('place.noWorkers'));
  }
  if (crew > 0) {
    content.buttons.push({
      label: t('info.recallWorkers'),
      color: COLORS.panelLight,
      onClick: () => a.run((s) => recallWorkers(s, o.id)),
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
        onClick: () => a.run((s, n) => addConstructionWorkers(s, b.id, value, n)),
      });
    }
    buttons.push({
      label: t('info.speedUp', { gems: speedUpCost(constructionRemaining(b, now)) }),
      color: 0x2a8fb0,
      onClick: () => a.run((s, n) => speedUpBuilding(s, b.id, n, speedUpCost)),
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
      onClick: () => a.run((s, n) => collectBuilding(s, b.id, n)),
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
        onClick: () => a.run((s, n) => plantCrop(s, b.id, n)),
      });
    } else if (status === 'ready') {
      buttons.push({
        label: t('info.harvest'),
        color: 0x3c9a5f,
        onClick: () => a.run((s, n) => harvestCrop(s, b.id, n)),
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
          label: t('info.trainWorker', { food: formatNumber(gameData.rules.workers.trainFood) }),
          color: 0x3c9a5f,
          onClick: () => {
            if (a.run((s, n) => trainWorker(s, n))) a.toast(t('info.trainingStarted'), COLORS.good);
          },
        });
        break;
      }
      case 'defense': {
        const { tower, wall } = gameData.rules.raids;
        const at = Math.max(1, b.level);
        if (b.type === tower.building) {
          const stats = tower.levels[Math.min(at, tower.levels.length) - 1]!;
          content.lines.push(
            t('tower.info', { n: tower.reachTiles, hp: stats.hp, atk: stats.atk }),
          );
        } else if (b.type === wall.building) {
          const hp = wall.hpByLevel[Math.min(at, wall.hpByLevel.length) - 1]!;
          content.lines.push(t('wall.info', { hp }));
        }
        break;
      }
      case 'house':
        content.lines.push(t('info.housePopulation', { population: level?.population ?? 0 }));
        statuses.push(() => populationLine(state));
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
              const r = a.run((st, n) => hatchEgg(st, egg.id, n));
              if (r) a.toast(t('egg.hatched', { name: monsterName(r.monster) }), COLORS.good);
            },
          });
        }
        buttons.push({ label: t('info.openCollection'), onClick: () => a.openPanel('collection') });
        break;
      case 'mixer':
        buttons.push({ label: t('info.openMixer'), onClick: () => a.openPanel('mixer') });
        break;
      case 'adventure':
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
            onClick: () => a.run((s, n) => staffBuilding(s, b.id, value, n)),
          });
        }
        if (crew > 0) {
          buttons.push({
            label: t('info.staffOut'),
            color: COLORS.panelLight,
            onClick: () => a.run((s, n) => unstaffBuilding(s, b.id, 1, n)),
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
        break;
      }
      default:
        break;
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
          const r = a.run((s, n) => upgradeGroup(s, b.id, n));
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
        const r = a.run((s, n) => upgradeBuilding(s, b.id, n, { workers }));
        if (r?.collected) a.toast(`+${formatNumber(r.collected)}`, COLORS.good);
      },
    });
  }

  buttons.push({
    label: t('info.move'),
    color: COLORS.panelLight,
    onClick: () => a.startMove(b.id),
  });
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
          if (a.run((s, n) => sellBuilding(s, b.id, n))) a.deselect();
        }),
    });
  }

  if (statuses.length > 0) content.status = () => statuses.map((s) => s()).join('\n');
  return content;
}
