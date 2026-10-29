import fs from 'fs';
import path from 'path';
import {
  gameData,
  monsterStats,
  VALID_NEWS_CATEGORIES,
  type BattleReward,
  type GameData,
} from '@soul-monster/shared';

export interface PublicMonster {
  no: number;
  id: string;
  name: string;
  tier: number;
  tierName: string;
  element: string;
  elementName: string;
  elementColor: string;
  role: string;
  description: string;
  sources: string[];
  spriteKey: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
}

export interface WebData {
  text: Record<string, string>;
  arenaTiers: {
    id: string;
    name: string;
    minPoints: number;
    weeklyReward: BattleReward;
    /** Reward as player text, e.g. "1000 Emas, 5 Permata". */
    rewardLabel: string;
  }[];
  seasonDays: number;
  leaderboardSize: number;
  /** News categories, so public pages need not load the whole shared package. */
  newsCategories: string[];
  /** Headline numbers for the home page (counts only; no recipe contents). */
  stats: { monsters: number; elements: number; recipes: number; tiers: number };
  /** Limits the admin editor checks before saving (the server checks them again). */
  rules: { newsMaxPerPage: number; news: GameData['rules']['web']['news'] };
  featured: PublicMonster[];
  tiers: {
    id: number;
    name: string;
    count: number;
    firstNo: number;
  }[];
  allMonsters: PublicMonster[];
}

export function buildWebData(data: GameData = gameData): WebData {
  const text: Record<string, string> = {};
  for (const [k, v] of Object.entries(data.text)) {
    if (k.startsWith('web.') || k.startsWith('time.')) {
      text[k] = v;
    }
  }

  const arenaTiers = data.rules.arena.tiers.map((t) => ({
    id: t.id,
    name: t.name,
    minPoints: t.minPoints,
    weeklyReward: t.weeklyReward,
    rewardLabel: Object.entries(t.weeklyReward)
      .filter(([, amount]) => typeof amount === 'number' && amount > 0)
      .map(([res, amount]) => `${amount} ${data.text[`res.${res}`] ?? res}`)
      .join(', '),
  }));

  const elementsById = new Map(data.elements.elements.map((e) => [e.id, e]));
  const ruleTiers = data.rules.tiers ?? {};
  const tierName = (tier: number) => ruleTiers[String(tier)]?.name ?? `Tier ${tier}`;

  const allMonsters: PublicMonster[] = data.monsters.monsters.map((m, idx) => {
    const stats = monsterStats({ species: m.id, stage: 'dewasa' }, data);
    return {
      no: idx + 1,
      id: m.id,
      name: m.name,
      tier: m.tier,
      tierName: tierName(m.tier),
      element: m.element,
      elementName: elementsById.get(m.element)?.name ?? m.element,
      elementColor: elementsById.get(m.element)?.color ?? '#a8a878',
      role: m.role,
      description: m.description,
      sources: m.sources,
      spriteKey: m.id,
      baseHp: stats.hp,
      baseAtk: stats.atk,
      baseDef: stats.def,
      baseSpd: stats.spd,
    };
  });

  const featuredIds = new Set(data.rules.web.featuredMonsters);
  const featured = allMonsters.filter((m) => featuredIds.has(m.id));

  // Grouping per tier
  const tierCounts = new Map<number, number>();
  const tierFirst = new Map<number, number>();
  allMonsters.forEach((m) => {
    tierCounts.set(m.tier, (tierCounts.get(m.tier) ?? 0) + 1);
    if (!tierFirst.has(m.tier)) tierFirst.set(m.tier, m.no);
  });

  const tierCount = Math.max(...data.monsters.monsters.map((m) => m.tier));
  const tiers = Array.from({ length: tierCount }, (_, i) => {
    const tierNum = i + 1;
    return {
      id: tierNum,
      name: tierName(tierNum),
      count: tierCounts.get(tierNum) ?? 0,
      firstNo: tierFirst.get(tierNum) ?? 1,
    };
  });

  return {
    text,
    arenaTiers,
    seasonDays: data.rules.arena.seasonDays,
    leaderboardSize: data.rules.web.leaderboardSize,
    newsCategories: [...VALID_NEWS_CATEGORIES],
    stats: {
      monsters: allMonsters.length,
      elements: data.elements.elements.length,
      recipes: data.monsters.monsters.filter((m) => m.recipe).length,
      tiers: tiers.length,
    },
    rules: { newsMaxPerPage: data.rules.web.newsMaxPerPage, news: data.rules.web.news },
    featured,
    tiers,
    allMonsters,
  };
}

if (!process.env.VITEST) {
  const webData = buildWebData(gameData);
  const outDir = path.resolve(__dirname, '../src/generated');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, 'web-data.json');
  fs.writeFileSync(outFile, JSON.stringify(webData, null, 2), 'utf-8');
  console.log(
    `[web] Generated web-data.json with ${webData.allMonsters.length} monsters (${outFile})`,
  );
}
