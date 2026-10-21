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
  if (!elements || !forms || !recipes || !rules || !text || !village || !wilds) {
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
  // Barracks: each trains a known soldier kind; soldiers have unique ids and real roles.
  const soldierIds = new Set<string>();
  for (const sd of rules.barracks.soldiers) {
    if (soldierIds.has(sd.id)) issues.push(`rules.json: prajurit "${sd.id}" ganda`);
    soldierIds.add(sd.id);
    if (!forms.roles[sd.role]) {
      issues.push(`rules.json: prajurit "${sd.id}" peran "${sd.role}" tidak ada`);
    }
  }
  for (const b of buildingInfo.buildingById.values()) {
    if (b.feature === 'barracks' && !(b.trainsSoldier && soldierIds.has(b.trainsSoldier))) {
      issues.push(
        `buildings.json: "${b.id}" (barracks) butuh trainsSoldier yang ada di rules.barracks.soldiers`,
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
  for (const b of village.buildings) {
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
      b.feature === 'mixer' &&
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
      if (g.kind === 'bandit' && g.banditPower === undefined)
        issues.push(`${gat}: bandit butuh banditPower`);
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
