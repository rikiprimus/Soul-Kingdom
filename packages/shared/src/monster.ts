import {
  gameData,
  RARITY_ORDER,
  type ElementId,
  type Form,
  type FormId,
  type GameData,
  type MonsterDef,
  type Rarity,
  type StageId,
} from './data';

/** A monster owned by the player. */
export interface Monster {
  id: string;
  species?: string;
  stage: StageId;
  /** Food fed towards the next growth stage. */
  food: number;
  /** @deprecated legacy fields during migration */
  form?: FormId;
  /** @deprecated legacy fields during migration */
  element?: ElementId;
}

export type MonsterKind =
  | { species: string; form?: FormId; element?: ElementId }
  | { form: FormId; element?: ElementId; species?: string }
  | Monster;

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

export function getSpecies(id: string, data: GameData = gameData): MonsterDef {
  const def = data.monsterById.get(id);
  if (!def) throw new Error(`Jenis monster tidak dikenal: "${id}"`);
  return def;
}

export function tierOf(kind: MonsterKind, data: GameData = gameData): number {
  if ('species' in kind && kind.species) {
    const def = data.monsterById.get(kind.species);
    if (def) return def.tier;
  }
  if ('form' in kind && kind.form) {
    const form = data.formById.get(kind.form);
    if (form) return form.tier;
  }
  return 1;
}

export const formTierOf = tierOf;

/** Monster key: species ID (or legacy "form:element"). */
export function monsterKey(kind: MonsterKind): string {
  if ('species' in kind && kind.species) {
    return kind.species;
  }
  if ('form' in kind && 'element' in kind && kind.form && kind.element) {
    return `${kind.form}:${kind.element}`;
  }
  return 'unknown';
}

export function parseMonsterKey(key: string, data: GameData = gameData): MonsterKind {
  if (key.includes(':')) {
    const [form = '', element = ''] = key.split(':');
    return { form, element, species: form };
  }
  const def = data.monsterById.get(key);
  return {
    species: key,
    form: key,
    element: def?.element ?? 'normal',
  };
}

/** Player-facing name: species name (or fallback legacy form + element). */
export function monsterName(kind: MonsterKind, data: GameData = gameData): string {
  if ('species' in kind && kind.species) {
    const def = data.monsterById.get(kind.species);
    if (def) return def.name;
  }
  if ('form' in kind && kind.form) {
    const form = data.formById.get(kind.form);
    const element =
      'element' in kind && kind.element ? data.elementById.get(kind.element) : undefined;
    return `${form?.name ?? kind.form} ${element?.name ?? ('element' in kind ? kind.element : '') ?? ''}`.trim();
  }
  return 'Monster';
}

export function monsterElement(kind: MonsterKind, data: GameData = gameData): ElementId {
  if ('species' in kind && kind.species) {
    const def = data.monsterById.get(kind.species);
    if (def?.element) return def.element;
  }
  if ('element' in kind && kind.element) return kind.element;
  return 'normal';
}

export function monsterRole(kind: MonsterKind, data: GameData = gameData): string {
  if ('species' in kind && kind.species) {
    const def = data.monsterById.get(kind.species);
    if (def?.role) return def.role;
  }
  if ('form' in kind && kind.form) {
    const form = data.formById.get(kind.form);
    if (form?.role) return form.role;
  }
  return 'striker';
}

export function rarityRank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

/**
 * Monster rarity based on species tier (1..8):
 * 1-2: biasa (Common/Uncommon)
 * 3-4: langka (Veteran/Elite)
 * 5-6: epik (Rare/Epic)
 * 7-8: legenda (Legendary/Mythical)
 */
export function rarityOf(kind: MonsterKind, data: GameData = gameData): Rarity {
  const tier = tierOf(kind, data);
  const byTier = data.rules.rarity.byTier?.[String(tier)];
  if (byTier) return byTier as Rarity;
  if (tier <= 2) return 'biasa';
  if (tier <= 4) return 'langka';
  if (tier <= 6) return 'epik';
  return 'legenda';
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
  const tier = tierOf(kind, data);
  return data.rules.battle.powerPoints[String(tier)] ?? 1;
}

/** Food needed to grow from the current stage to the next; 0 at the final stage. */
export function foodToNextStage(
  monster: Monster | (MonsterKind & { stage: StageId }),
  data: GameData = gameData,
  feedCostReduction = 0,
): number {
  const { stage } = getStage(monster.stage, data);
  if (stage.foodToNextPerPowerPoint === undefined || isFinalStage(monster.stage, data)) return 0;
  const base = stage.foodToNextPerPowerPoint * powerPointsOf(monster, data);
  const eff = Math.max(0.1, 1 - feedCostReduction);
  return Math.max(1, Math.round(base * eff));
}

/** hp/atk/def scale with species tier and growth stage; spd and range do not. */
export function monsterStats(
  monster: { species?: string; form?: FormId; stage: StageId },
  data: GameData = gameData,
  statsBonus = 0,
): MonsterStats {
  const speciesId = monster.species ?? monster.form;
  const def = speciesId ? data.monsterById.get(speciesId) : undefined;
  const role =
    def?.role ?? (monster.form ? data.formById.get(monster.form)?.role : undefined) ?? 'penahan';
  const base = data.rules.stats.roleBase[role];
  if (!base) throw new Error(`Statistik peran "${role}" tidak ada`);
  const tier = def?.tier ?? (monster.form ? (data.formById.get(monster.form)?.tier ?? 1) : 1);
  const tierMult = data.rules.stats.tierMultiplier[String(tier)] ?? 1;
  const stageMult = getStage(monster.stage, data).stage.statMultiplier;
  const scale = tierMult * stageMult;
  const mult = 1 + statsBonus;
  return {
    hp: Math.round(base.hp * scale * mult),
    atk: Math.round(base.atk * scale * mult),
    def: Math.round(base.def * scale),
    spd: base.spd,
    range: base.range,
  };
}
