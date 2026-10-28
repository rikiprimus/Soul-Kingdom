import type { z } from 'zod';
import {
  elementsFileSchema,
  formsFileSchema,
  recipesFileSchema,
  rulesFileSchema,
  textFileSchema,
  type ElementsFile,
  type FormsFile,
  type RecipesFile,
  type RulesFile,
  type TextFile,
  buildingsFileSchema,
  wildsFileSchema,
  adventureFileSchema,
  questsFileSchema,
  type QuestsFile,
  type Prize,
  collectionsFileSchema,
  type CollectionsFile,
  islandsFileSchema,
  type IslandsFile,
  type AdventureFile,
  type Defender,
  type BuildingDef,
  type BuildingsFile,
  type ObstacleDef,
  type WildsFile,
} from './schema';

export type ElementId = string;
export type FormId = string;
export type BaseUnit = string;
export type StageId = string;
export type RoleId = string;

export type Element = ElementsFile['elements'][number];
export type Form = FormsFile['forms'][number];
export type MonsterRecipe = RecipesFile['monsterRecipes'][number];
export type SecretElementRecipe = ElementsFile['secretRecipes'][number];
export type Rules = RulesFile;
export type Stage = RulesFile['growth']['stages'][number];

export interface RawGameData {
  elements: unknown;
  forms: unknown;
  recipes: unknown;
  rules: unknown;
  text: unknown;
  buildings: unknown;
  wilds: unknown;
  adventure: unknown;
  quests: unknown;
  collections: unknown;
  islands: unknown;
}

export interface GameData {
  readonly elements: ElementsFile;
  readonly forms: FormsFile;
  readonly recipes: RecipesFile;
  readonly rules: Rules;
  readonly text: TextFile;
  readonly baseUnits: readonly BaseUnit[];
  readonly elementById: ReadonlyMap<ElementId, Element>;
  readonly formById: ReadonlyMap<FormId, Form>;
  /** Non-secret elements only, keyed by `compositionKey`. */
  readonly elementByComposition: ReadonlyMap<string, Element>;
  readonly formsByTier: ReadonlyMap<number, readonly Form[]>;
  readonly formTiers: readonly number[];
  readonly stageIndex: ReadonlyMap<StageId, number>;
  readonly village: BuildingsFile;
  readonly wilds: WildsFile;
  readonly adventure: AdventureFile;
  readonly quests: QuestsFile;
  readonly collections: CollectionsFile;
  readonly islands: IslandsFile;
  readonly buildingById: ReadonlyMap<string, BuildingDef>;
  readonly obstacleById: ReadonlyMap<string, ObstacleDef>;
  /** Id of the building with feature "townHall". */
  readonly townHallId: string;
  readonly maxTownHallLevel: number;
}

export class DataValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Data game tidak valid:\n- ${issues.join('\n- ')}`);
    this.name = 'DataValidationError';
  }
}

/** Order-independent key of a set of base units, ordered like `baseElements`. */
export function compositionKey(units: readonly BaseUnit[], baseUnits: readonly BaseUnit[]): string {
  return [...new Set(units)].sort((a, b) => baseUnits.indexOf(a) - baseUnits.indexOf(b)).join('+');
}

function parseFile<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
  file: string,
  issues: string[],
): z.infer<T> | undefined {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  for (const issue of parsed.error.issues) {
    issues.push(`${file}: ${issue.path.join('.') || '(akar)'} — ${issue.message}`);
  }
  return undefined;
}

const PROBABILITY_EPSILON = 1e-9;

/**
 * Parses and cross-validates all game data. Throws `DataValidationError` listing
 * every problem found, so broken data fails loudly at load time.
 */
export function loadGameData(raw: RawGameData): GameData {
  const issues: string[] = [];
  const elements = parseFile(elementsFileSchema, raw.elements, 'elements.json', issues);
  const forms = parseFile(formsFileSchema, raw.forms, 'forms.json', issues);
  const recipes = parseFile(recipesFileSchema, raw.recipes, 'recipes.json', issues);
  const rules = parseFile(rulesFileSchema, raw.rules, 'rules.json', issues);
  const text = parseFile(textFileSchema, raw.text, 'text.json', issues);
  const village = parseFile(buildingsFileSchema, raw.buildings, 'buildings.json', issues);
  const wilds = parseFile(wildsFileSchema, raw.wilds, 'wilds.json', issues);
  const adventure = parseFile(adventureFileSchema, raw.adventure, 'adventure.json', issues);
  const quests = parseFile(questsFileSchema, raw.quests, 'quests.json', issues);
  const collections = parseFile(collectionsFileSchema, raw.collections, 'collections.json', issues);
  const islands = parseFile(islandsFileSchema, raw.islands, 'islands.json', issues);
  if (
    !elements ||
    !forms ||
    !recipes ||
    !rules ||
    !text ||
    !village ||
    !wilds ||
    !adventure ||
    !quests ||
    !collections ||
    !islands
  ) {
    throw new DataValidationError(issues);
  }

  const baseUnits = elements.baseElements;
  const baseSet = new Set(baseUnits);
  if (baseSet.size !== baseUnits.length) issues.push('elements.json: baseElements berisi duplikat');

  for (const [unit, beaten] of Object.entries(elements.beats)) {
    if (!baseSet.has(unit)) issues.push(`elements.json: beats memakai unsur tak dikenal "${unit}"`);
    for (const b of beaten) {
      if (!baseSet.has(b)) issues.push(`elements.json: beats.${unit} memakai unsur "${b}"`);
    }
  }

  const elementById = new Map<ElementId, Element>();
  const elementByComposition = new Map<string, Element>();
  for (const el of elements.elements) {
    if (elementById.has(el.id)) issues.push(`elements.json: id elemen ganda "${el.id}"`);
    elementById.set(el.id, el);
    for (const unit of el.composition) {
      if (!baseSet.has(unit)) {
        issues.push(`elements.json: elemen "${el.id}" memakai unsur bukan dasar "${unit}"`);
      }
    }
    if (new Set(el.composition).size !== el.composition.length) {
      issues.push(`elements.json: elemen "${el.id}" berisi unsur ganda`);
    }
    if (!el.secret) {
      const key = compositionKey(el.composition, baseUnits);
      const existing = elementByComposition.get(key);
      if (existing) {
        issues.push(
          `elements.json: elemen "${el.id}" dan "${existing.id}" punya komposisi sama (${key})`,
        );
      }
      elementByComposition.set(key, el);
    }
  }
  for (const unit of baseUnits) {
    const el = elementById.get(unit);
    if (!el || el.composition.length !== 1 || el.composition[0] !== unit) {
      issues.push(`elements.json: unsur dasar "${unit}" harus punya elemen dengan id yang sama`);
    }
  }
  for (const recipe of elements.secretRecipes) {
    for (const id of recipe.pair) {
      if (!elementById.has(id)) issues.push(`elements.json: secretRecipes memakai elemen "${id}"`);
    }
    const result = elementById.get(recipe.result);
    if (!result) issues.push(`elements.json: hasil secretRecipes "${recipe.result}" tidak ada`);
    else if (!result.secret) {
      issues.push(`elements.json: hasil secretRecipes "${recipe.result}" bukan elemen rahasia`);
    }
  }

  const formById = new Map<FormId, Form>();
  const formsByTier = new Map<number, Form[]>();
  for (const form of forms.forms) {
    if (formById.has(form.id)) issues.push(`forms.json: id wujud ganda "${form.id}"`);
    formById.set(form.id, form);
    if (!forms.tiers[String(form.tier)]) {
      issues.push(`forms.json: wujud "${form.id}" memakai tingkat ${form.tier} yang tidak ada`);
    }
    if (!forms.roles[form.role]) {
      issues.push(`forms.json: wujud "${form.id}" memakai peran "${form.role}" yang tidak ada`);
    }
    const list = formsByTier.get(form.tier) ?? [];
    list.push(form);
    formsByTier.set(form.tier, list);
  }
  const formTiers = [...formsByTier.keys()].sort((a, b) => a - b);

  const { mixer } = rules;
  for (const tier of formTiers) {
    const t = String(tier);
    if (mixer.maxElementUnitsByFormTier[t] === undefined) {
      issues.push(`rules.json: mixer.maxElementUnitsByFormTier tidak punya tingkat ${t}`);
    }
    if (!mixer.costByResultTier[t]) issues.push(`rules.json: mixer.costByResultTier tingkat ${t}`);
    if (rules.premium.soulProphecyGemsByResultTier[t] === undefined) {
      issues.push(`rules.json: premium.soulProphecyGemsByResultTier tidak punya tingkat ${t}`);
    }
    if (rules.stats.tierMultiplier[t] === undefined) {
      issues.push(`rules.json: stats.tierMultiplier tidak punya tingkat ${t}`);
    }
    if (rules.battle.powerPoints[t] === undefined) {
      issues.push(`rules.json: battle.powerPoints tidak punya tingkat ${t}`);
    }
  }
  for (let units = 1; units <= baseUnits.length; units++) {
    if (!rules.rarity.byElementUnits[String(units)]) {
      issues.push(`rules.json: rarity.byElementUnits tidak punya ${units} unsur`);
    }
  }
  for (const role of Object.keys(forms.roles)) {
    if (!rules.stats.roleBase[role])
      issues.push(`rules.json: stats.roleBase tidak punya "${role}"`);
  }

  const stageIndex = new Map<StageId, number>();
  rules.growth.stages.forEach((stage, i) => {
    stageIndex.set(stage.id, i);
    const isLast = i === rules.growth.stages.length - 1;
    if (!isLast && stage.foodToNextPerPowerPoint === undefined) {
      issues.push(`rules.json: tahap "${stage.id}" butuh foodToNextPerPowerPoint`);
    }
  });
  if (!stageIndex.has(mixer.parentStage)) {
    issues.push(`rules.json: mixer.parentStage "${mixer.parentStage}" bukan tahap tumbuh`);
  }

  const sumOf = (record: Record<string, number>) =>
    Object.values(record).reduce((sum, v) => sum + v, 0);
  if (Math.abs(sumOf(mixer.formTierOdds) - 1) > PROBABILITY_EPSILON) {
    issues.push(`rules.json: jumlah mixer.formTierOdds = ${sumOf(mixer.formTierOdds)}, harus 1`);
  }
  if (Math.abs(sumOf(mixer.elementOdds) - 1) > PROBABILITY_EPSILON) {
    issues.push(`rules.json: jumlah mixer.elementOdds = ${sumOf(mixer.elementOdds)}, harus 1`);
  }
  if (mixer.initialSlots > mixer.maxSlots) {
    issues.push('rules.json: mixer.initialSlots melebihi maxSlots');
  }
  if (rules.premium.extraMixerSlotGems.length < mixer.maxSlots - mixer.initialSlots) {
    issues.push('rules.json: premium.extraMixerSlotGems kurang untuk semua slot tambahan');
  }

  /** Checks a "form:element" monster spec against forms, elements and tier caps. */
  const checkMonster = (form: string, element: string, where: string) => {
    const f = formById.get(form);
    const el = elementById.get(element);
    if (!f) issues.push(`${where}: wujud "${form}" tidak ada`);
    if (!el) issues.push(`${where}: elemen "${element}" tidak ada`);
    if (!f || !el) return;
    const cap = mixer.maxElementUnitsByFormTier[String(f.tier)];
    if (cap !== undefined && el.composition.length > cap) {
      issues.push(
        `${where}: ${form}:${element} punya ${el.composition.length} unsur, batas tingkat ${f.tier} = ${cap}`,
      );
    }
    if (el.secret && f.tier < mixer.secretElementMinFormTier) {
      issues.push(
        `${where}: elemen rahasia "${element}" hanya untuk wujud tingkat ${mixer.secretElementMinFormTier}+`,
      );
    }
  };
  const splitSpec = (spec: string, where: string): [string, string] | undefined => {
    const parts = spec.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      issues.push(`${where}: format "${spec}" harus "<wujud>:<elemen>"`);
      return undefined;
    }
    return [parts[0], parts[1]];
  };
  const recipeIds = new Set<string>();
  for (const recipe of recipes.monsterRecipes) {
    const where = `recipes.json (${recipe.id})`;
    if (recipeIds.has(recipe.id)) issues.push(`${where}: id resep ganda`);
    recipeIds.add(recipe.id);
    for (const spec of [...recipe.parents, recipe.result]) {
      const parts = splitSpec(spec, where);
      if (parts) checkMonster(parts[0], parts[1], where);
    }
  }

  const buildingInfo = validateVillage(village, wilds, rules, issues);
  validateWilds(wilds, buildingInfo, formsByTier, stageIndex, issues);
  const vein = wilds.nodes.find((n) => n.id === wilds.goldVeins.node);
  if (!vein?.refillHours) {
    issues.push(
      `wilds.json: goldVeins.node "${wilds.goldVeins.node}" harus node dengan refillHours`,
    );
  }
  // Barracks: each trains a known soldier kind; soldiers have unique ids and real roles.
  const soldierIds = new Set<string>();
  for (const sd of rules.barracks.soldiers) {
    if (soldierIds.has(sd.id)) issues.push(`rules.json: prajurit "${sd.id}" ganda`);
    soldierIds.add(sd.id);
    if (!forms.roles[sd.role]) {
      issues.push(`rules.json: prajurit "${sd.id}" peran "${sd.role}" tidak ada`);
    }
  }
  // Serbu bases: unique ids, real forms/elements/stages/soldiers/tower levels, a field
  // wide enough for both sides, and room for every defender.
  const { serbu } = rules;
  if (serbu.placeColumns * 2 > serbu.grid.columns) {
    issues.push('rules.json: serbu.placeColumns x 2 lebih lebar dari medan');
  }
  /** Checks one list of defenders against the other data; returns how many there are. */
  const checkDefenders = (where: string, defenders: readonly Defender[]): number => {
    let count = 0;
    for (const d of defenders) {
      count += d.count;
      if (d.kind === 'monster' || d.kind === 'boss') {
        if (!formById.has(d.form)) issues.push(`${where}: wujud "${d.form}" tidak ada`);
        if (!elementById.has(d.element)) issues.push(`${where}: elemen "${d.element}" tidak ada`);
        if (!stageIndex.has(d.stage)) issues.push(`${where}: tahap "${d.stage}" tidak ada`);
      } else if (d.kind === 'soldier') {
        const kind = rules.barracks.soldiers.find((x) => x.id === d.soldier);
        if (!kind) issues.push(`${where}: prajurit "${d.soldier}" tidak ada`);
        if (d.rank >= rules.barracks.ranks.length) {
          issues.push(`${where}: pangkat ${d.rank} tidak ada`);
        }
      } else if (d.kind === 'tower' && d.level > rules.raids.tower.levels.length) {
        issues.push(`${where}: Menara level ${d.level} tidak punya statistik`);
      }
    }
    return count;
  };
  const baseIds = new Set<string>();
  for (const base of serbu.bases) {
    const where = `rules.json: serbu.bases "${base.id}"`;
    if (baseIds.has(base.id)) issues.push(`${where} ganda`);
    baseIds.add(base.id);
    const count = checkDefenders(where, base.defenders);
    if (count > serbu.placeColumns * serbu.grid.rows) {
      issues.push(`${where}: ${count} pertahanan tidak muat di medan`);
    }
  }
  // Petualangan: unique ids, a path through earlier nodes of the same region, one boss
  // per region, refill hours on resource nodes only, defenders that fit the field.
  const nodeIds = new Set<string>();
  const regionIds = new Set<string>();
  const gateLevels =
    [...buildingInfo.buildingById.values()].find((b) => b.feature === 'adventure')?.levels.length ??
    0;
  if (rules.mixer.maxFormTierByBossesDefeated.length !== adventure.regions.length + 1) {
    issues.push(
      `rules.json: mixer.maxFormTierByBossesDefeated harus berisi ${adventure.regions.length + 1} angka (0 sampai ${adventure.regions.length} bos)`,
    );
  }
  adventure.regions.forEach((region, i) => {
    const prev = adventure.regions[i - 1]?.requiresGateLevel ?? 0;
    if (region.requiresGateLevel < prev || region.requiresGateLevel > gateLevels) {
      issues.push(
        `adventure.json: wilayah "${region.id}" requiresGateLevel ${region.requiresGateLevel} harus naik dan ada di Gerbang Petualangan (${gateLevels} level)`,
      );
    }
  });
  for (const region of adventure.regions) {
    const where = `adventure.json: wilayah "${region.id}"`;
    if (regionIds.has(region.id)) issues.push(`${where} ganda`);
    regionIds.add(region.id);
    const seen = new Set<string>();
    for (const node of region.nodes) {
      const at = `${where} titik "${node.id}"`;
      if (nodeIds.has(node.id)) issues.push(`${at}: id ganda`);
      nodeIds.add(node.id);
      for (const id of node.after) {
        if (!seen.has(id))
          issues.push(`${at}: "after" harus titik sebelumnya di wilayah ini ("${id}")`);
      }
      seen.add(node.id);
      if ((node.kind === 'resource') !== (node.refillHours !== undefined)) {
        issues.push(`${at}: refillHours hanya (dan wajib) untuk titik sumber daya`);
      }
      if (checkDefenders(at, node.defenders) > serbu.placeColumns * serbu.grid.rows) {
        issues.push(`${at}: pertahanan tidak muat di medan`);
      }
    }
    if (region.nodes.filter((n) => n.kind === 'boss').length !== 1) {
      issues.push(`${where}: harus punya tepat satu bos`);
    }
  }
  if (rules.battle.maxUnits > serbu.placeColumns * serbu.grid.rows) {
    issues.push('rules.json: battle.maxUnits tidak muat di petak penempatan Serbu');
  }
  // Raids: the tower and wall buildings exist and have stats for every level they can reach.
  for (const key of ['tower', 'magicTower'] as const) {
    const cfg = rules.raids[key];
    const def = buildingInfo.buildingById.get(cfg.building);
    if (!def) issues.push(`rules.json: raids.${key}.building "${cfg.building}" tidak ada`);
    else if (cfg.levels.length < def.levels.length) {
      issues.push(`rules.json: raids.${key}.levels kurang untuk ${def.levels.length} level`);
    }
  }
  for (const key of ['wall', 'gate'] as const) {
    const cfg = rules.raids[key];
    const def = buildingInfo.buildingById.get(cfg.building);
    if (!def) issues.push(`rules.json: raids.${key}.building "${cfg.building}" tidak ada`);
    else if (cfg.hpByLevel.length < def.levels.length) {
      issues.push(`rules.json: raids.${key}.hpByLevel kurang untuk ${def.levels.length} level`);
    }
  }
  const gateDef = buildingInfo.buildingById.get(rules.raids.gate.building);
  if (gateDef && (gateDef.size !== 1 || gateDef.levels.some((l) => l.seconds !== 0))) {
    issues.push(`buildings.json: "${gateDef.id}" (gerbang) harus berukuran 1 dan langsung jadi`);
  }
  for (const b of buildingInfo.buildingById.values()) {
    if (b.feature === 'barracks' && !(b.trainsSoldier && soldierIds.has(b.trainsSoldier))) {
      issues.push(
        `buildings.json: "${b.id}" (barracks) butuh trainsSoldier yang ada di rules.barracks.soldiers`,
      );
    }
  }

  // Quests: unique ids; building goals name a real building and a level it has.
  const questIds = new Set<string>();
  for (const q of quests.chain) {
    const where = `quests.json: misi "${q.id}"`;
    if (questIds.has(q.id)) issues.push(`${where} ganda`);
    questIds.add(q.id);
    for (const g of q.goals) {
      if (g.kind !== 'building') continue;
      const def = buildingInfo.buildingById.get(g.building);
      if (!def) issues.push(`${where}: bangunan "${g.building}" tidak ada`);
      else if (g.level > def.levels.length) {
        issues.push(`${where}: "${g.building}" tidak punya level ${g.level}`);
      }
    }
  }

  // Rewards: a Keajaiban must be a building with feature "wonder".
  const checkWonder = (where: string, prize: Prize) => {
    if (prize.wonder && buildingInfo.buildingById.get(prize.wonder)?.feature !== 'wonder') {
      issues.push(`${where}: "${prize.wonder}" bukan Keajaiban`);
    }
    for (const d of prize.decorations) {
      if (buildingInfo.buildingById.get(d)?.category !== 'dekorasi') {
        issues.push(`${where}: "${d}" bukan dekorasi`);
      }
    }
  };
  for (const q of quests.chain) checkWonder(`quests.json: misi "${q.id}"`, q.reward);
  // Collection sets: unique ids, a tier with forms or a base unit with elements.
  const setIds = new Set<string>();
  for (const set of collections.sets) {
    const where = `collections.json: set "${set.id}"`;
    if (setIds.has(set.id)) issues.push(`${where} ganda`);
    setIds.add(set.id);
    checkWonder(where, set.reward);
    if (set.kind === 'formTier' && !formsByTier.get(set.tier)?.length) {
      issues.push(`${where}: tidak ada wujud tingkat ${set.tier}`);
    }
    if (set.kind === 'elementUnit' && !baseSet.has(set.unit)) {
      issues.push(`${where}: unsur "${set.unit}" tidak dikenal`);
    }
  }
  for (const b of buildingInfo.buildingById.values()) {
    if (b.feature === 'wonder' && b.maxCount.some((m) => m > 1)) {
      issues.push(`buildings.json: Keajaiban "${b.id}" maksimal 1`);
    }
  }

  // Islands: unique ids; the first is the main village (open from the start, normal limits).
  const islandIds = new Set<string>();
  islands.islands.forEach((island, i) => {
    const where = `islands.json: pulau "${island.id}"`;
    if (islandIds.has(island.id)) issues.push(`${where} ganda`);
    islandIds.add(island.id);
    if (i === 0 && (island.maxCount || island.requiresTownHall > 1)) {
      issues.push(`${where}: pulau utama tidak boleh punya maxCount atau syarat Balai > 1`);
    }
    for (const n of island.nodes) {
      if (!buildingInfo.obstacleById.has(n)) issues.push(`${where}: rintangan "${n}" tidak ada`);
    }
    for (const b of Object.keys(island.maxCount ?? {})) {
      if (!buildingInfo.buildingById.has(b)) issues.push(`${where}: bangunan "${b}" tidak ada`);
      if (buildingInfo.buildingById.get(b)?.feature === 'townHall') {
        issues.push(`${where}: Balai Utama hanya di pulau utama`);
      }
    }
  });

  // Sarang Telur Jiwa: odds sum to 1; each outcome has forms and plain elements that fit.
  const { nest } = rules;
  if (Math.abs(nest.hatch.reduce((s, h) => s + h.chance, 0) - 1) > PROBABILITY_EPSILON) {
    issues.push('rules.json: peluang nest.hatch harus berjumlah 1');
  }
  for (const h of nest.hatch) {
    const where = `rules.json: nest.hatch "${h.rarity}"`;
    if (!formsByTier.get(h.formTier)?.length)
      issues.push(`${where}: tidak ada wujud tingkat ${h.formTier}`);
    if (h.units > (rules.mixer.maxElementUnitsByFormTier[String(h.formTier)] ?? 0)) {
      issues.push(`${where}: ${h.units} unsur melebihi batas wujud tingkat ${h.formTier}`);
    }
    if (![...elementByComposition.values()].some((e) => e.composition.length === h.units)) {
      issues.push(`${where}: tidak ada elemen biasa dengan ${h.units} unsur`);
    }
  }
  if (![...buildingInfo.buildingById.values()].some((b) => b.feature === 'nest')) {
    issues.push('buildings.json: butuh satu bangunan dengan feature "nest"');
  }

  const researchBldg = buildingInfo.buildingById.get(rules.research.building);
  if (!researchBldg) {
    issues.push(
      `rules.json: research.building "${rules.research.building}" tidak ada di buildings.json`,
    );
  } else if (researchBldg.feature !== 'research') {
    issues.push(
      `rules.json: research.building "${rules.research.building}" harus punya feature "research"`,
    );
  }
  const techIds = new Set<string>();
  for (const tech of rules.research.techs) {
    if (techIds.has(tech.id)) issues.push(`rules.json: riset "${tech.id}" ganda`);
    techIds.add(tech.id);
  }
  for (const tech of rules.research.techs) {
    if (tech.requiresTech && !techIds.has(tech.requiresTech)) {
      issues.push(`rules.json: riset "${tech.id}" butuh "${tech.requiresTech}" yang tidak ada`);
    }
  }

  const guildBldg = buildingInfo.buildingById.get(rules.guild.building);
  if (!guildBldg) {
    issues.push(`rules.json: guild.building "${rules.guild.building}" tidak ada di buildings.json`);
  } else if (guildBldg.feature !== 'serbu') {
    issues.push(`rules.json: guild.building "${rules.guild.building}" harus punya feature "serbu"`);
  } else {
    if (rules.guild.maxMembersByLevel.length !== guildBldg.levels.length) {
      issues.push(
        `rules.json: guild.maxMembersByLevel harus berisi ${guildBldg.levels.length} angka (satu per level Guild)`,
      );
    }
    if (rules.guild.serbuRewardBonusByLevel.length !== guildBldg.levels.length) {
      issues.push(
        `rules.json: guild.serbuRewardBonusByLevel harus berisi ${guildBldg.levels.length} angka (satu per level Guild)`,
      );
    }
  }

  if (issues.length > 0) throw new DataValidationError(issues);

  return {
    elements,
    forms,
    recipes,
    rules,
    text,
    baseUnits,
    elementById,
    formById,
    elementByComposition,
    formsByTier,
    formTiers,
    stageIndex,
    village,
    wilds,
    adventure,
    quests,
    collections,
    islands,
    ...buildingInfo,
  };
}

/** Cross-checks buildings.json: ids, levels, town hall, mixer unlock and the starting village. */
function validateVillage(
  village: BuildingsFile,
  wilds: WildsFile,
  rules: RulesFile,
  issues: string[],
) {
  const where = 'buildings.json';
  const buildingById = new Map<string, BuildingDef>();
  const obstacleById = new Map<string, ObstacleDef>();
  for (const b of village.buildings) {
    if (buildingById.has(b.id)) issues.push(`${where}: id bangunan ganda "${b.id}"`);
    buildingById.set(b.id, b);
    if (!village.categories[b.category]) {
      issues.push(`${where}: bangunan "${b.id}" memakai kategori "${b.category}" yang tidak ada`);
    }
  }
  for (const o of wilds.nodes) {
    if (obstacleById.has(o.id) || buildingById.has(o.id)) {
      issues.push(`wilds.json: id node ganda atau sama dengan bangunan "${o.id}"`);
    }
    obstacleById.set(o.id, o);
  }
  const townHalls = village.buildings.filter((b) => b.feature === 'townHall');
  if (townHalls.length !== 1)
    issues.push(`${where}: harus ada tepat satu bangunan feature "townHall"`);
  const townHall = townHalls[0];
  const maxTownHallLevel = townHall?.levels.length ?? 1;
  if (rules.population.decorationCapByTownHall.length !== maxTownHallLevel) {
    issues.push(
      `rules.json: population.decorationCapByTownHall harus berisi ${maxTownHallLevel} angka (satu per level Balai Utama)`,
    );
  }
  if (!village.categories[rules.population.decorationCategory]) {
    issues.push(
      `rules.json: population.decorationCategory "${rules.population.decorationCategory}" bukan kategori di buildings.json`,
    );
  }
  const { workshop } = rules;
  const shop = buildingById.get(workshop.building);
  if (!shop || shop.feature !== 'workshop') {
    issues.push(
      `rules.json: workshop.building "${workshop.building}" harus bangunan feature "workshop"`,
    );
  } else {
    if (workshop.versionMultiplier.length !== shop.levels.length) {
      issues.push(
        `rules.json: workshop.versionMultiplier harus berisi ${shop.levels.length} angka (satu per level Bengkel)`,
      );
    }
    for (const m of workshop.machines) {
      if (m.names.length !== shop.levels.length) {
        issues.push(
          `rules.json: workshop mesin "${m.id}" butuh ${shop.levels.length} nama (satu per level Bengkel)`,
        );
      }
    }
  }
  const draw = rules.marketDraw;
  const drawBuilding = buildingById.get(draw.building);
  if (!drawBuilding) issues.push(`rules.json: marketDraw.building "${draw.building}" tidak ada`);
  if (draw.tables[0]?.minLevel !== 1) {
    issues.push('rules.json: marketDraw.tables harus dimulai dari minLevel 1');
  }
  draw.tables.forEach((table, i) => {
    const at = `rules.json: marketDraw.tables[${i}]`;
    if (i > 0 && table.minLevel <= draw.tables[i - 1]!.minLevel) {
      issues.push(`${at}: minLevel harus naik berurutan`);
    }
    if (drawBuilding && table.minLevel > drawBuilding.levels.length) {
      issues.push(`${at}: "${draw.building}" tidak punya level ${table.minLevel}`);
    }
    table.prizes.forEach(({ prize }, j) => {
      if (prize.wonder) issues.push(`${at}.prizes[${j}]: undian tidak boleh memberi Keajaiban`);
      for (const d of prize.decorations) {
        if (buildingById.get(d)?.category !== rules.population.decorationCategory) {
          issues.push(`${at}.prizes[${j}]: "${d}" bukan dekorasi`);
        }
      }
    });
  });
  if (rules.workers.trainSecondsByTownHall.length !== maxTownHallLevel) {
    issues.push(
      `rules.json: workers.trainSecondsByTownHall harus berisi ${maxTownHallLevel} angka (satu per level Balai Utama)`,
    );
  }
  for (const b of village.buildings) {
    if (
      b.feature !== 'barracks' &&
      b.feature !== 'workshop' &&
      b.feature !== 'research' &&
      b.levels.some((l) => l.queueBonus !== undefined)
    ) {
      issues.push(
        `${where}: "${b.id}" bukan barak/bengkel/perpustakaan, tidak boleh punya queueBonus`,
      );
    }
    if (b.maxCount.length !== maxTownHallLevel) {
      issues.push(
        `${where}: "${b.id}".maxCount harus berisi ${maxTownHallLevel} angka (satu per level Balai Utama)`,
      );
    }
    b.levels.forEach((level, i) => {
      if (level.requiresTownHall > maxTownHallLevel) {
        issues.push(
          `${where}: "${b.id}" level ${i + 1} butuh Balai Utama level ${level.requiresTownHall} yang tidak ada`,
        );
      }
    });
    if (rules.workers.constructionMaxBySize[String(b.size)] === undefined) {
      issues.push(
        `rules.json: workers.constructionMaxBySize tidak punya ukuran ${b.size} ("${b.id}")`,
      );
    }
    const heals = b.levels.map((l) => l.healPercentPerMinute !== undefined);
    if (b.feature === 'healing' ? heals.includes(false) : heals.includes(true)) {
      issues.push(
        `${where}: "${b.id}" healPercentPerMinute harus ada di setiap level bangunan feature "healing" dan hanya di sana`,
      );
    }
    if (b.feature === 'house' && b.levels.some((l) => l.population === undefined)) {
      issues.push(`${where}: "${b.id}" (house) butuh population di setiap level`);
    }
    if (b.feature === 'staffed' && b.levels.some((l) => !l.workerSlots || !l.staffedProduction)) {
      issues.push(
        `${where}: "${b.id}" (staffed) butuh workerSlots dan staffedProduction di setiap level`,
      );
    }
    if (
      b.feature === 'ranch' &&
      b.levels.some((l) => l.animalSlots === undefined || l.ranchCapacity === undefined)
    ) {
      issues.push(
        `${where}: "${b.id}" (ranch) butuh animalSlots dan ranchCapacity di setiap level`,
      );
    }
    if (b.lineBuild && (b.size !== 1 || b.levels.some((l) => l.seconds !== 0))) {
      issues.push(`${where}: "${b.id}" lineBuild harus berukuran 1 dan semua levelnya seconds 0`);
    }
    if (
      (b.feature === 'mixer' || b.feature === 'altar') &&
      b.levels[0]!.requiresTownHall !== rules.mixer.unlockTownHallLevel
    ) {
      issues.push(
        `${where}: "${b.id}" level 1 harus butuh Balai Utama level ${rules.mixer.unlockTownHallLevel} (rules.mixer.unlockTownHallLevel)`,
      );
    }
  }
  const { mapSize, startingBuildings, plotSize, initialPlots } = village.village;
  const plotsPerSide = Math.floor(mapSize / plotSize);
  if (mapSize % plotSize !== 0) issues.push(`${where}: mapSize harus kelipatan plotSize`);
  const openPlots = new Set<string>();
  for (const [px, py] of initialPlots) {
    if (px >= plotsPerSide || py >= plotsPerSide) {
      issues.push(`${where}: initialPlots [${px}, ${py}] di luar peta`);
    }
    openPlots.add(`${px},${py}`);
  }
  const buyable = plotsPerSide * plotsPerSide - openPlots.size;
  if (village.village.plotCostGold.length < buyable) {
    issues.push(`${where}: plotCostGold butuh ${buyable} harga (satu per plot yang bisa dibeli)`);
  }
  if (village.village.plotRequiresTownHall.length !== village.village.plotCostGold.length) {
    issues.push(`${where}: plotRequiresTownHall harus sepanjang plotCostGold`);
  }
  const occupied = new Set<string>();
  let population = 0;
  startingBuildings.forEach((sb, i) => {
    const def = buildingById.get(sb.type);
    const at = `${where}: village.startingBuildings[${i}]`;
    if (!def) {
      issues.push(`${at}: bangunan "${sb.type}" tidak ada`);
      return;
    }
    if (sb.level > def.levels.length)
      issues.push(`${at}: level ${sb.level} melebihi level maksimum`);
    if (sb.x + def.size > mapSize || sb.y + def.size > mapSize)
      issues.push(`${at}: keluar dari peta`);
    const corners = [
      [sb.x, sb.y],
      [sb.x + def.size - 1, sb.y + def.size - 1],
    ];
    if (
      corners.some(
        ([cx, cy]) => !openPlots.has(`${Math.floor(cx! / plotSize)},${Math.floor(cy! / plotSize)}`),
      )
    ) {
      issues.push(`${at}: harus berada di plot awal yang terbuka`);
    }
    population += def.levels[sb.level - 1]?.population ?? 0;
    for (let dx = 0; dx < def.size; dx++) {
      for (let dy = 0; dy < def.size; dy++) {
        const key = `${sb.x + dx},${sb.y + dy}`;
        if (occupied.has(key)) issues.push(`${at}: bertumpuk dengan bangunan lain di ${key}`);
        occupied.add(key);
      }
    }
  });
  const startingHall = startingBuildings.find((sb) => sb.type === townHall?.id);
  if (!startingHall) issues.push(`${where}: desa awal harus punya Balai Utama`);
  else if (startingHall.level !== rules.economy.startingTownHallLevel) {
    issues.push(
      `${where}: level Balai Utama awal harus sama dengan rules.economy.startingTownHallLevel`,
    );
  }
  // Starting population must hold the starting workers and monsters.
  // The starting egg hatches into a tier-1 monster that needs its slots too.
  const monsterSlots = rules.battle.powerPoints['1'] ?? 1;
  const needed = monsterSlots + rules.workers.startingWorkers * rules.population.workerSlots;
  if (population < needed) {
    issues.push(
      `${where}: populasi awal (${population}) kurang untuk pekerja dan monster awal (${needed})`,
    );
  }
  return { buildingById, obstacleById, townHallId: townHall?.id ?? '', maxTownHallLevel };
}

/** Cross-checks wilds.json against buildings, forms and growth stages. */
function validateWilds(
  wilds: WildsFile,
  info: { buildingById: ReadonlyMap<string, BuildingDef>; maxTownHallLevel: number },
  formsByTier: ReadonlyMap<number, readonly Form[]>,
  stageIndex: ReadonlyMap<StageId, number>,
  issues: string[],
) {
  const where = 'wilds.json';
  const animalIds = new Set<string>();
  for (const a of wilds.animals.types) {
    if (animalIds.has(a.id)) issues.push(`${where}: id hewan ganda "${a.id}"`);
    animalIds.add(a.id);
  }
  const { encounters } = wilds;
  if (encounters.groupsByTownHall.length !== info.maxTownHallLevel) {
    issues.push(
      `${where}: encounters.groupsByTownHall harus berisi ${info.maxTownHallLevel} angka`,
    );
  }
  if (encounters.levels[0]?.townHall !== 1) {
    issues.push(`${where}: encounters.levels harus dimulai dari Balai level 1`);
  }
  let previous = 0;
  encounters.levels.forEach((level, i) => {
    const at = `${where}: encounters.levels[${i}]`;
    if (level.townHall <= previous) issues.push(`${at}: townHall harus naik berurutan`);
    if (level.townHall > info.maxTownHallLevel)
      issues.push(`${at}: Balai level ${level.townHall} tidak ada`);
    previous = level.townHall;
    level.groups.forEach((g, j) => {
      const gat = `${at}.groups[${j}]`;
      if (g.count[0] > g.count[1]) issues.push(`${gat}: count [min, max] terbalik`);
      if ((g.kind === 'bandit' || g.kind === 'goblin') && g.banditPower === undefined)
        issues.push(`${gat}: ${g.kind} butuh banditPower`);
      if (g.kind === 'monster') {
        if (g.formTier === undefined || !formsByTier.get(g.formTier)?.length) {
          issues.push(`${gat}: formTier ${g.formTier} tidak punya wujud`);
        }
        if (!g.stage || !stageIndex.has(g.stage))
          issues.push(`${gat}: tahap "${g.stage}" tidak ada`);
      }
    });
  });
}
