import type Phaser from 'phaser';
import { gameData } from '@soul-monster/shared';
import { BUILDING_RES, buildingIcon } from '../art/buildingArt';
import { t } from '../text';
import { COLORS, textStyle } from '../ui/theme';
import { Button, roundedPanel } from '../ui/widgets';
import { GAP, gridColumns } from './CollectionView';
import { View, type ViewContext } from './View';

/** Gudang: decorations and Keajaiban off the map; picking one starts placing it. */
export class StorageView extends View {
  constructor(
    ctx: ViewContext,
    private readonly onPlace: (itemId: string) => void,
  ) {
    super(ctx);
  }

  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const pad = 10;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    let y = 12;
    const head = scene.add.text(
      left,
      y,
      t('storage.subtitle'),
      textStyle(12, COLORS.textDim, { wordWrap: { width } }),
    );
    content.add(head);
    y += head.height + 12;
    const items = this.state.storage;
    if (items.length === 0) {
      content.add(scene.add.text(left, y, t('storage.empty'), textStyle(14, COLORS.textDim)));
      return y + 60;
    }
    const { cols, cardW } = gridColumns(width, 150, 2);
    const cardH = 190;
    items.forEach((item, i) => {
      const card = scene.add.container(
        left + (i % cols) * (cardW + GAP),
        y + Math.floor(i / cols) * (cardH + GAP),
      );
      card.add(roundedPanel(scene, 0, 0, cardW, cardH, COLORS.panel, COLORS.stroke));
      const art = buildingIcon(scene, item.type, item.level);
      const img = scene.add.image(cardW / 2, 62, art.key, art.frame).setFlipX(item.flipped);
      img.setScale(Math.min((cardW - 20) / img.width, 96 / img.height, 1 / BUILDING_RES));
      const def = gameData.buildingById.get(item.type)!;
      card.add([
        img,
        scene.add
          .text(
            cardW / 2,
            118,
            t('storage.item', { name: def.name, level: item.level }),
            textStyle(13, COLORS.text, {
              fontStyle: 'bold',
              align: 'center',
              wordWrap: { width: cardW - 16 },
            }),
          )
          .setOrigin(0.5, 0),
        new Button(scene, cardW / 2, cardH - 22, {
          width: cardW - 20,
          height: 30,
          label: t('storage.place'),
          fontSize: 12,
          color: 0x3c9a5f,
          onClick: () => this.onPlace(item.id),
        }),
      ]);
      content.add(card);
    });
    return y + Math.ceil(items.length / cols) * (cardH + GAP) + 16;
  }
}
