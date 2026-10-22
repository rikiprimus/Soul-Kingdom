import type Phaser from 'phaser';
import { hasGraveyard, monsterName, reviveCost, type ReviveMethod } from '@soul-monster/shared';
import { formatNumber, t } from '../text';
import { costLabel } from '../ui/cost';
import { MINI_CARD_HEIGHT, miniCard } from '../ui/MonsterCard';
import { COLORS, textStyle } from '../ui/theme';
import { Button, icons, toast } from '../ui/widgets';
import { GAP, gridColumns } from './CollectionView';
import { View } from './View';

/** Fallen monsters, each with a revive button for gold and food and one for gems. */
export class GraveyardView extends View {
  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const pad = 8;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    const fallen = this.state.graveyard;
    let y = 12;
    const head = scene.add.text(
      left,
      y,
      hasGraveyard(this.state) ? t('graveyard.subtitle') : t('graveyard.needBuilding'),
      textStyle(12, COLORS.textDim, { wordWrap: { width } }),
    );
    content.add(head);
    y += head.height + 12;
    if (fallen.length === 0) {
      content.add(scene.add.text(left, y, t('graveyard.empty'), textStyle(14, COLORS.textDim)));
      return y + 60;
    }
    const rowH = MINI_CARD_HEIGHT + 84;
    const { cols, cardW } = gridColumns(width, 150, 2);
    fallen.forEach((m, i) => {
      const x = left + (i % cols) * (cardW + GAP);
      const cy = y + Math.floor(i / cols) * (rowH + GAP);
      content.add(miniCard(scene, x, cy, cardW, m, () => undefined).setAlpha(0.75));
      const cost = reviveCost(m);
      const revive = (method: ReviveMethod) => () => {
        if (this.run('reviveMonster', { id: m.id, method })) {
          toast(scene, t('graveyard.revived', { name: monsterName(m) }), COLORS.good, 'revive');
        }
      };
      content.add(
        new Button(scene, x + cardW / 2, cy + MINI_CARD_HEIGHT + 20, {
          width: cardW,
          height: 34,
          label: t('graveyard.revive', {
            cost: costLabel({ gold: cost.gold, food: cost.food, wood: 0, stone: 0 }),
          }),
          fontSize: 12,
          color: 0x3c9a5f,
          onClick: revive('resources'),
        }),
      );
      content.add(
        new Button(scene, x + cardW / 2, cy + MINI_CARD_HEIGHT + 60, {
          width: cardW,
          height: 34,
          label: t('graveyard.reviveGems', { gems: formatNumber(cost.gems) }),
          fontSize: 12,
          color: 0x2a8fb0,
          icon: icons.gem,
          onClick: revive('gems'),
        }),
      );
    });
    return y + Math.ceil(fallen.length / cols) * (rowH + GAP) + 16;
  }
}
