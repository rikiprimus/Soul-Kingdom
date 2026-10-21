import type Phaser from 'phaser';
import {
  compareMonsters,
  feedMonster,
  foodToNextStage,
  isMonsterBusy,
  monsterName,
  populationCap,
  populationUsed,
  releaseMonster,
  type Monster,
} from '@soul-monster/shared';
import { errorText, t } from '../text';
import {
  COLLECTION_CARD_HEIGHT,
  COMPACT_CARD_HEIGHT,
  collectionCard,
  compactCollectionCard,
  stageName,
} from '../ui/MonsterCard';
import { COLORS, textStyle } from '../ui/theme';
import { confirmDialog, toast } from '../ui/widgets';
import { View } from './View';

export const GAP = 8;

export function gridColumns(width: number, minCard: number, minCols = 2) {
  const cols = Math.max(minCols, Math.floor((width + GAP) / (minCard + GAP)));
  return { cols, cardW: Math.floor((width - (cols - 1) * GAP) / cols) };
}

export class CollectionView extends View {
  protected build(content: Phaser.GameObjects.Container): number {
    const pad = 8;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    const monsters = [...this.state.monsters].sort((a, b) => compareMonsters(a, b));
    content.add(
      this.scene.add.text(
        left,
        14,
        t('collection.count', {
          count: monsters.length,
          used: populationUsed(this.state),
          cap: populationCap(this.state),
        }),
        textStyle(13, COLORS.textDim, { fontStyle: 'bold' }),
      ),
    );
    if (monsters.length === 0) {
      content.add(
        this.scene.add.text(left, 56, t('collection.empty'), textStyle(14, COLORS.textDim)),
      );
      return 120;
    }
    // Short screens (landscape phones) get wide, short cards that fit whole.
    const compact = this.ctx.rect.height < COLLECTION_CARD_HEIGHT + 60;
    const cardH = compact ? COMPACT_CARD_HEIGHT : COLLECTION_CARD_HEIGHT;
    const makeCard = compact ? compactCollectionCard : collectionCard;
    const { cols, cardW } = gridColumns(width, compact ? 230 : 150, compact ? 1 : 2);
    const top = 40;
    monsters.forEach((monster, i) => {
      const x = left + (i % cols) * (cardW + GAP);
      const y = top + Math.floor(i / cols) * (cardH + GAP);
      content.add(
        makeCard(this.scene, x, y, {
          width: cardW,
          monster,
          food: this.state.resources.food,
          busy: isMonsterBusy(this.state, monster.id),
          onFeed: (m) => this.feed(m),
          onRelease: (m) => this.release(m),
        }),
      );
    });
    const rows = Math.ceil(monsters.length / cols);
    return top + rows * (cardH + GAP) + 16;
  }

  private release(monster: Monster) {
    confirmDialog(this.scene, t('monster.releaseConfirm', { name: monsterName(monster) }), () => {
      if (this.run((s) => releaseMonster(s, monster.id))) {
        toast(this.scene, t('monster.released', { name: monsterName(monster) }), COLORS.good);
      }
    });
  }

  private feed(monster: Monster) {
    const food = this.state.resources.food;
    if (food <= 0) {
      toast(this.scene, errorText('notEnoughFood'));
      return;
    }
    const amount = Math.min(food, foodToNextStage(monster) - monster.food);
    const result = this.run((s) => feedMonster(s, { monsterId: monster.id, amount }));
    if (result?.grew) {
      const grown = result.state.monsters.find((m) => m.id === monster.id);
      if (grown) {
        toast(
          this.scene,
          t('monster.grew', { name: monsterName(grown), stage: stageName(grown.stage) }),
          COLORS.good,
          'grow',
        );
      }
    }
  }
}
