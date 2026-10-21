import {
  gameData,
  RARITY_ORDER,
  type ElementId,
  type Form,
  type FormId,
  type GameData,
  type Rarity,
  type StageId,
} from './data';
import { elementUnits, isSecretElement } from './elements';

/** A monster owned by the player. */
export interface Monster {
  id: string;
  form: FormId;
  element: ElementId;
  stage: StageId;
  /** Food fed towards the next growth stage. */
  food: number;
}

export interface MonsterKind {
  form: FormId;
  element: ElementId;
}

export interface MonsterStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  range: number;
}

export function getForm(id: FormId, data: GameData = gameData): Form {
  const form = data.formById.get(id);
  if (!form) throw new Error(`Wujud tidak dikenal: "${id}"`);
  return form;
}

export function formTierOf(kind: MonsterKind, data: GameData = gameData): number {
  return getForm(kind.form, data).tier;
}

/** "form:element", the key used by recipes and the Monsterpedia. */
export function monsterKey(kind: MonsterKind): string {
  return `${kind.form}:${kind.element}`;
}

export function parseMonsterKey(key: string): MonsterKind {
  const [form = '', element = ''] = key.split(':');
  return { form, element };
}

/** Player-facing name: form name + element name, e.g. "Kucing Api". */
export function monsterName(kind: MonsterKind, data: GameData = gameData): string {
  const element = data.elementById.get(kind.element);
  return `${getForm(kind.form, data).name} ${element?.name ?? kind.element}`;
}

export function rarityRank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function rarityOf(kind: MonsterKind, data: GameData = gameData): Rarity {
  const { rarity } = data.rules;
  if (formTierOf(kind, data) >= rarity.legendaryIfFormTier) return 'legenda';
  if (rarity.legendaryIfSecretElement && isSecretElement(kind.element, data)) return 'legenda';
  const units = elementUnits(kind.element, data).length;
  const byUnits = rarity.byElementUnits[String(units)];
  if (!byUnits) throw new Error(`Kelangkaan untuk ${units} unsur tidak ada di rules.json`);
  return byUnits;
}

export function getStage(stage: StageId, data: GameData = gameData) {
  const index = data.stageIndex.get(stage);
  if (index === undefined) throw new Error(`Tahap tumbuh tidak dikenal: "${stage}"`);
  return { index, stage: data.rules.growth.stages[index]! };
}

export function isFinalStage(stage: StageId, data: GameData = gameData): boolean {
  return getStage(stage, data).index === data.rules.growth.stages.length - 1;
}

export function firstStage(data: GameData = gameData): StageId {
  return data.rules.growth.stages[0]!.id;
}

export function powerPointsOf(kind: MonsterKind, data: GameData = gameData): number {
  return data.rules.battle.powerPoints[String(formTierOf(kind, data))]!;
}

/** Food needed to grow from the current stage to the next; 0 at the final stage. */
export function foodToNextStage(monster: Monster, data: GameData = gameData): number {
  const { stage } = getStage(monster.stage, data);
  if (stage.foodToNextPerPowerPoint === undefined || isFinalStage(monster.stage, data)) return 0;
  return stage.foodToNextPerPowerPoint * powerPointsOf(monster, data);
}

/** hp/atk/def scale with form tier and growth stage; spd and range do not. */
export function monsterStats(
  monster: Pick<Monster, 'form' | 'stage'>,
  data: GameData = gameData,
): MonsterStats {
  const form = getForm(monster.form, data);
  const base = data.rules.stats.roleBase[form.role];
  if (!base) throw new Error(`Statistik peran "${form.role}" tidak ada`);
  const scale =
    data.rules.stats.tierMultiplier[String(form.tier)]! *
    getStage(monster.stage, data).stage.statMultiplier;
  return {
    hp: Math.round(base.hp * scale),
    atk: Math.round(base.atk * scale),
    def: Math.round(base.def * scale),
    spd: base.spd,
    range: base.range,
  };
}
