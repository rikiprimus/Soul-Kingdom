import type Phaser from 'phaser';
import {
  countBuildings,
  currentIsland,
  gameData,
  maxCountFor,
  townHallLevel,
  type BuildingDef,
} from '@soul-monster/shared';
import { BUILDING_RES, buildingIcon } from '../art/buildingArt';
import { formatDuration, t } from '../text';
import { costLabel } from '../ui/cost';
import { COLORS, textStyle } from '../ui/theme';
import { Button, deferClick, icons, pointerState, roundedPanel } from '../ui/widgets';
import { GAP, gridColumns } from './CollectionView';
import { View, type ViewContext } from './View';

let category = Object.keys(gameData.village.categories)[0] ?? '';

/** Catalogue of buildings by category; picking one starts placement in the village. */
export class BuildMenuView extends View {
  constructor(
    ctx: ViewContext,
    private readonly onPick: (type: string) => void,
  ) {
    super(ctx);
  }

  protected build(content: Phaser.GameObjects.Container): number {
    const { scene, state } = this;
    const pad = 10;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    const categories = Object.entries(gameData.village.categories);

    let y = 8;
    const { cols: tabCols, cardW: tabW } = gridColumns(width, 90, 3);
    categories.forEach(([id, name], i) => {
      const x = left + (i % tabCols) * (tabW + GAP) + tabW / 2;
      const ty = y + Math.floor(i / tabCols) * 40 + 17;
      content.add(
        new Button(scene, x, ty, {
          width: tabW,
          height: 34,
          label: name,
          fontSize: 12,
          color: id === category ? COLORS.accent : COLORS.panelLight,
          onClick: () => {
            category = id;
            this.render();
          },
        }),
      );
    });
    y += Math.ceil(categories.length / tabCols) * 40 + 8;

    const hall = townHallLevel(state);
    // Hidden buildings have data already but belong to a later task.
    const defs = gameData.village.buildings.filter((b) => b.category === category && !b.hidden);
    const { cols, cardW } = gridColumns(width, 150, 2);
    const cardH = 230;
    defs.forEach((def, i) => {
      const card = scene.add.container(
        left + (i % cols) * (cardW + GAP),
        y + Math.floor(i / cols) * (cardH + GAP),
      );
      this.buildCard(card, def, cardW, cardH, hall);
      content.add(card);
    });
    return y + Math.ceil(defs.length / cols) * (cardH + GAP) + 16;
  }

  private buildCard(
    card: Phaser.GameObjects.Container,
    def: BuildingDef,
    w: number,
    h: number,
    hall: number,
  ) {
    const { scene, state } = this;
    const first = def.levels[0]!;
    const count = countBuildings(state, def.id);
    const max = maxCountFor(state, def.id);
    const lockedByHall = hall < first.requiresTownHall;
    const full = count >= max;
    // A Keajaiban is never built: it is won and placed from the Gudang.
    const unwonWonder = def.feature === 'wonder';
    const available = !lockedByHall && !full && !unwonWonder;
    card.add(
      roundedPanel(
        scene,
        0,
        0,
        w,
        h,
        available ? COLORS.panel : COLORS.panelDark,
        available ? COLORS.stroke : null,
      ),
    );

    const art = buildingIcon(scene, def.id);
    const img = scene.add.image(w / 2, 62, art.key, art.frame).setOrigin(0.5, 0.5);
    const fit = Math.min((w - 20) / img.width, 96 / img.height, 1 / BUILDING_RES);
    img.setScale(fit);
    if (!available) img.setTint(0x777788);
    card.add(img);

    card.add(
      scene.add
        .text(w / 2, 116, def.name, textStyle(13, COLORS.text, { fontStyle: 'bold' }))
        .setOrigin(0.5, 0),
    );
    const lines = [
      costLabel(first.cost),
      first.seconds > 0
        ? t('build.time', { time: formatDuration(first.seconds) })
        : t('build.instant'),
      t('build.count', { count, max }),
    ];
    card.add(
      scene.add
        .text(
          w / 2,
          136,
          lines.join('\n'),
          textStyle(11, COLORS.textDim, { align: 'center', lineSpacing: 2 }),
        )
        .setOrigin(0.5, 0),
    );
    if (available) {
      card.add(
        new Button(scene, w / 2, h - 22, {
          width: w - 20,
          height: 30,
          label: t('build.build'),
          fontSize: 12,
          color: 0x3c9a5f,
          icon: icons.gold,
          onClick: () => this.onPick(def.id),
        }),
      );
    } else {
      const nextHall = this.nextHallFor(def);
      const reason =
        unwonWonder && !full
          ? t('build.wonderLocked')
          : lockedByHall
            ? t('build.needsHall', { level: first.requiresTownHall })
            : nextHall !== null
              ? t('build.needsHall', { level: nextHall })
              : max === 0
                ? t('build.notOnIsland')
                : t('build.limit');
      card.add(
        scene.add
          .text(w / 2, h - 22, reason, textStyle(11, COLORS.warn, { fontStyle: 'bold' }))
          .setOrigin(0.5),
      );
    }
    const zone = scene.add
      .zone(0, 0, w, h - 40)
      .setOrigin(0)
      .setInteractive();
    zone.on('pointerup', () => {
      if (available && !pointerState.dragMoved) deferClick(scene, () => this.onPick(def.id));
    });
    card.add(zone);
  }

  /** Lowest Balai Utama level that allows one more of this building, if any. */
  private nextHallFor(def: BuildingDef): number | null {
    // Other islands have fixed limits of their own.
    if (currentIsland(this.state).maxCount) return null;
    const count = countBuildings(this.state, def.id);
    const i = def.maxCount.findIndex((m) => m > count);
    return i >= 0 ? i + 1 : null;
  }
}
