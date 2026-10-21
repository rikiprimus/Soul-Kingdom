import Phaser from 'phaser';
import {
  foodToNextStage,
  gameData,
  getForm,
  getStage,
  isFinalStage,
  monsterName,
  monsterStats,
  rarityOf,
  type Monster,
  type MonsterKind,
  type Rarity,
} from '@soul-monster/shared';
import { MonsterView } from '../art/MonsterView';
import { t } from '../text';
import { COLORS, RARITY_COLORS, textStyle } from './theme';
import { Button, darken, deferClick, icons, pointerState } from './widgets';

/** Card frame coloured by rarity; legends get the gold double frame. */
export function drawCardFrame(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  rarity: Rarity,
  highlight = false,
) {
  const color = RARITY_COLORS[rarity];
  g.fillStyle(darken(color, 0.78), 1).fillRoundedRect(0, 0, w, h, 12);
  g.fillStyle(COLORS.panel, 1).fillRoundedRect(3, 3, w - 6, h - 6, 10);
  const gold = gameData.rules.rarity.visuals[rarity].goldFrame === true;
  if (gold) {
    g.lineStyle(3, 0xffcf40, 1).strokeRoundedRect(1.5, 1.5, w - 3, h - 3, 12);
    g.lineStyle(1, 0xfff1b0, 0.9).strokeRoundedRect(6, 6, w - 12, h - 12, 8);
    g.fillStyle(0xffcf40, 1);
    for (const [x, y] of [
      [6, 6],
      [w - 6, 6],
      [6, h - 6],
      [w - 6, h - 6],
    ] as const) {
      g.fillPoints(
        [
          { x, y: y - 6 },
          { x: x + 6, y },
          { x, y: y + 6 },
          { x: x - 6, y },
        ],
        true,
      );
    }
  } else {
    g.lineStyle(2, color, rarity === 'biasa' ? 0.5 : 0.95).strokeRoundedRect(
      1,
      1,
      w - 2,
      h - 2,
      12,
    );
  }
  if (highlight) g.lineStyle(3, COLORS.good, 1).strokeRoundedRect(-2, -2, w + 4, h + 4, 14);
}

export const rarityName = (rarity: Rarity) => gameData.rules.rarity.names[rarity];
export const stageName = (stage: string) => getStage(stage).stage.name;
export const lastStageId = () => gameData.rules.growth.stages.at(-1)!.id;

export interface CollectionCardOptions {
  width: number;
  monster: Monster;
  food: number;
  busy: boolean;
  onFeed: (monster: Monster) => void;
  /** Shown as a small corner button; monsters in the Soul Mixer cannot be released. */
  onRelease?: (monster: Monster) => void;
}

function releaseButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: CollectionCardOptions,
): Button | null {
  const onRelease = opts.onRelease;
  if (!onRelease || opts.busy) return null;
  return new Button(scene, x, y, {
    width: 52,
    height: 22,
    label: t('monster.release'),
    fontSize: 10,
    color: COLORS.panelLight,
    onClick: () => onRelease(opts.monster),
  });
}

export const COLLECTION_CARD_HEIGHT = 280;

/** Collection card: art, name, tier, stage, rarity, stats and feeding. */
export function collectionCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: CollectionCardOptions,
): Phaser.GameObjects.Container {
  const { width: w, monster } = opts;
  const h = COLLECTION_CARD_HEIGHT;
  const rarity = rarityOf(monster);
  const card = scene.add.container(x, y);
  const frame = scene.add.graphics();
  drawCardFrame(frame, w, h, rarity);
  card.add(frame);

  const art = Math.min(104, w - 24);
  card.add(new MonsterView(scene, w / 2, 10 + art / 2, monster, art));
  const release = releaseButton(scene, w - 32, 18, opts);
  if (release) card.add(release);

  let cy = 14 + art;
  const name = scene.add
    .text(
      w / 2,
      cy,
      monsterName(monster),
      textStyle(13, COLORS.text, {
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: w - 14 },
      }),
    )
    .setOrigin(0.5, 0);
  card.add(name);
  cy += 34;
  const tier = getForm(monster.form).tier;
  card.add(
    scene.add
      .text(
        w / 2,
        cy,
        `${t('monster.tier', { tier })} · ${stageName(monster.stage)}`,
        textStyle(11, COLORS.textDim),
      )
      .setOrigin(0.5, 0),
  );
  cy += 16;
  card.add(
    scene.add
      .text(
        w / 2,
        cy,
        rarityName(rarity),
        textStyle(11, RARITY_COLORS[rarity], { fontStyle: 'bold' }),
      )
      .setOrigin(0.5, 0),
  );
  cy += 17;
  const stats = monsterStats(monster);
  card.add(
    scene.add
      .text(
        w / 2,
        cy,
        `${t('monster.stats', stats)}\n${t('monster.stats2', stats)}`,
        textStyle(10.5, COLORS.text, { align: 'center', lineSpacing: 2 }),
      )
      .setOrigin(0.5, 0),
  );

  const bottom = h - 26;
  if (opts.busy) {
    card.add(
      scene.add.text(w / 2, bottom, t('monster.busy'), textStyle(11, COLORS.warn)).setOrigin(0.5),
    );
  } else if (isFinalStage(monster.stage)) {
    card.add(
      scene.add.text(w / 2, bottom, t('monster.adult'), textStyle(11, COLORS.good)).setOrigin(0.5),
    );
  } else {
    const needed = foodToNextStage(monster);
    const barW = w - 24;
    const bar = scene.add.graphics();
    bar.fillStyle(COLORS.panelDark).fillRoundedRect(12, bottom - 26, barW, 6, 3);
    bar
      .fillStyle(COLORS.food)
      .fillRoundedRect(12, bottom - 26, Math.max(4, (barW * monster.food) / needed), 6, 3);
    card.add(bar);
    const remaining = needed - monster.food;
    card.add(
      new Button(scene, w / 2, bottom + 2, {
        width: w - 20,
        height: 30,
        label: t('monster.feed', { food: remaining }),
        fontSize: 12,
        color: 0x3c9a5f,
        icon: icons.food,
        onClick: () => opts.onFeed(monster),
      }),
    );
  }
  return card;
}

export const COMPACT_CARD_HEIGHT = 150;

/**
 * Wide, short collection card for landscape phones: art on the left, details and
 * the feed button on the right, so a whole card fits in a 360 px tall screen.
 */
export function compactCollectionCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: CollectionCardOptions,
): Phaser.GameObjects.Container {
  const { width: w, monster } = opts;
  const h = COMPACT_CARD_HEIGHT;
  const rarity = rarityOf(monster);
  const card = scene.add.container(x, y);
  const frame = scene.add.graphics();
  drawCardFrame(frame, w, h, rarity);
  card.add(frame);

  const art = 96;
  card.add(new MonsterView(scene, 10 + art / 2, h / 2, monster, art));
  const tx = art + 18;
  const tw = w - tx - 10;
  const tier = getForm(monster.form).tier;
  const stats = monsterStats(monster);
  const name = scene.add.text(
    tx,
    10,
    monsterName(monster),
    textStyle(13, COLORS.text, { fontStyle: 'bold', wordWrap: { width: tw - 58 } }),
  );
  const release = releaseButton(scene, w - 34, 20, opts);
  if (release) card.add(release);
  const info = scene.add.text(
    tx,
    10 + name.height + 2,
    `${t('monster.tier', { tier })} · ${stageName(monster.stage)}`,
    textStyle(11, COLORS.textDim),
  );
  const rare = scene.add.text(
    tx,
    info.y + 15,
    rarityName(rarity),
    textStyle(11, RARITY_COLORS[rarity], { fontStyle: 'bold' }),
  );
  const statText = scene.add.text(
    tx,
    rare.y + 16,
    `${t('monster.stats', stats)}\n${t('monster.stats2', stats)}`,
    textStyle(10.5, COLORS.text, { lineSpacing: 1 }),
  );
  card.add([name, info, rare, statText]);

  const bottom = h - 20;
  if (opts.busy) {
    card.add(
      scene.add.text(tx, bottom, t('monster.busy'), textStyle(11, COLORS.warn)).setOrigin(0, 0.5),
    );
  } else if (isFinalStage(monster.stage)) {
    card.add(
      scene.add.text(tx, bottom, t('monster.adult'), textStyle(11, COLORS.good)).setOrigin(0, 0.5),
    );
  } else {
    const needed = foodToNextStage(monster);
    const bar = scene.add.graphics();
    bar.fillStyle(COLORS.panelDark).fillRoundedRect(10, h - 10, art, 5, 2);
    bar
      .fillStyle(COLORS.food)
      .fillRoundedRect(10, h - 10, Math.max(4, (art * monster.food) / needed), 5, 2);
    card.add(bar);
    card.add(
      new Button(scene, tx + tw / 2, bottom, {
        width: tw,
        height: 28,
        label: t('monster.feed', { food: needed - monster.food }),
        fontSize: 12,
        color: 0x3c9a5f,
        icon: icons.food,
        onClick: () => opts.onFeed(monster),
      }),
    );
  }
  return card;
}

export const MINI_CARD_HEIGHT = 128;

/** Small card for pickers: art, name and tier. */
export function miniCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  kind: MonsterKind & { stage?: string },
  onClick: () => void,
): Phaser.GameObjects.Container {
  const h = MINI_CARD_HEIGHT;
  const rarity = rarityOf(kind);
  const card = scene.add.container(x, y);
  const frame = scene.add.graphics();
  drawCardFrame(frame, w, h, rarity);
  card.add(frame);
  const art = Math.min(70, w - 16);
  card.add(
    new MonsterView(
      scene,
      w / 2,
      6 + art / 2,
      { ...kind, stage: kind.stage ?? lastStageId() },
      art,
      { effects: false },
    ),
  );
  card.add(
    scene.add
      .text(
        w / 2,
        10 + art,
        monsterName(kind),
        textStyle(11, COLORS.text, {
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: w - 10 },
        }),
      )
      .setOrigin(0.5, 0),
  );
  card.add(
    scene.add
      .text(
        w / 2,
        h - 12,
        `${t('monster.tier', { tier: getForm(kind.form).tier })} · ${rarityName(rarity)}`,
        textStyle(10, RARITY_COLORS[rarity]),
      )
      .setOrigin(0.5),
  );
  const zone = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.on('pointerup', () => {
    if (!pointerState.dragMoved) deferClick(scene, onClick);
  });
  card.add(zone);
  return card;
}
