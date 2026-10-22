import type Phaser from 'phaser';
import { gameData, islandStatus } from '@soul-monster/shared';
import { ISLAND_GROUND } from '../art/palette';
import { t } from '../text';
import { costLabel } from '../ui/cost';
import { COLORS, textStyle } from '../ui/theme';
import { Button, darken, roundedPanel, toast } from '../ui/widgets';
import { GAP, gridColumns } from './CollectionView';
import { View } from './View';

/** Simple world map: every island, where the player is, and how to open or reach the rest. */
export class WorldView extends View {
  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const pad = 10;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    let y = 12;
    const head = scene.add.text(
      left,
      y,
      t('world.subtitle'),
      textStyle(12, COLORS.textDim, { wordWrap: { width } }),
    );
    content.add(head);
    y += head.height + 12;
    const islands = gameData.islands.islands;
    const { cols, cardW } = gridColumns(width, 170, 3);
    const cardH = 236;
    islands.forEach((island, i) => {
      const status = islandStatus(this.state, island.id);
      const card = scene.add.container(
        left + (i % cols) * (cardW + GAP),
        y + Math.floor(i / cols) * (cardH + GAP),
      );
      const here = status === 'current';
      card.add(
        roundedPanel(scene, 0, 0, cardW, cardH, COLORS.panel, here ? COLORS.gold : COLORS.stroke),
      );
      // The island itself: a little diamond of its ground over the sea.
      const look = ISLAND_GROUND[island.id] ?? ISLAND_GROUND.utama!;
      const g = scene.add.graphics();
      const cx = cardW / 2;
      g.fillStyle(0x2f7fb5, 1).fillRoundedRect(10, 10, cardW - 20, 76, 10);
      g.fillStyle(darken(look.edge, 0.2), 1).fillPoints(
        [
          { x: cx - 50, y: 48 },
          { x: cx, y: 73 },
          { x: cx + 50, y: 48 },
          { x: cx, y: 79 },
        ],
        true,
      );
      g.fillStyle(look.tiles[0], status === 'townHall' ? 0.5 : 1).fillPoints(
        [
          { x: cx, y: 23 },
          { x: cx + 50, y: 48 },
          { x: cx, y: 73 },
          { x: cx - 50, y: 48 },
        ],
        true,
      );
      card.add(g);
      card.add(
        scene.add
          .text(cx, 96, island.name, textStyle(14, COLORS.text, { fontStyle: 'bold' }))
          .setOrigin(0.5, 0),
      );
      card.add(
        scene.add
          .text(
            cx,
            118,
            island.description,
            textStyle(11, COLORS.textDim, { align: 'center', wordWrap: { width: cardW - 16 } }),
          )
          .setOrigin(0.5, 0),
      );
      card.add(this.action(island.id, status, cardW, cardH));
      content.add(card);
    });
    return y + Math.ceil(islands.length / cols) * (cardH + GAP) + 16;
  }

  private action(id: string, status: ReturnType<typeof islandStatus>, w: number, h: number) {
    const { scene } = this;
    const island = gameData.islands.islands.find((i) => i.id === id)!;
    const at = { x: w / 2, y: h - 22 };
    if (status === 'current' || status === 'townHall') {
      const label =
        status === 'current'
          ? t('world.here')
          : t('build.needsHall', { level: island.requiresTownHall });
      return scene.add
        .text(
          at.x,
          at.y,
          label,
          textStyle(12, status === 'current' ? COLORS.gold : COLORS.warn, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5);
    }
    const open = status === 'open';
    return new Button(scene, at.x, at.y, {
      width: w - 20,
      height: 32,
      label: open ? t('world.go') : t('world.unlock', { cost: costLabel(island.cost) }),
      fontSize: 12,
      color: open ? COLORS.accent : 0x3c9a5f,
      onClick: () => {
        if (open) {
          if (!this.run('travelTo', { id })) return;
          toast(scene, t('world.arrived', { name: island.name }), COLORS.good);
          this.ctx.close?.();
        } else if (this.run('unlockIsland', { id })) {
          toast(scene, t('world.unlocked', { name: island.name }), COLORS.good, 'win');
        }
      },
    });
  }
}
