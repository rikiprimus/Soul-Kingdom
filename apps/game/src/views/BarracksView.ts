import type Phaser from 'phaser';
import {
  barracksQueue,
  barracksRemaining,
  gameData,
  populationCap,
  populationUsed,
  soldierKindOf,
  soldierName,
  soldierPower,
  soldierStats,
  soldierTrainCost,
  trainSoldier,
  unlockedRanks,
} from '@soul-monster/shared';
import { soldierTexture } from '../art/soldierArt';
import { formatDuration, t } from '../text';
import { costLabel } from '../ui/cost';
import { drawCardFrame } from '../ui/MonsterCard';
import { COLORS, textStyle } from '../ui/theme';
import { Button, darken, toast } from '../ui/widgets';
import { GAP, gridColumns } from './CollectionView';
import { View } from './View';

const selection = { rank: 0 };

/** Training panel of one barracks: pick an opened rank of its soldier and queue one. */
export class BarracksView extends View {
  private queueText?: Phaser.GameObjects.Text;

  private get building() {
    return this.state.village.buildings.find((b) => b.id === this.ctx.targetId);
  }

  override tick(): void {
    this.queueText?.setText(this.queueLine());
  }

  private queueLine(): string {
    const b = this.building;
    if (!b) return '';
    const queue = barracksQueue(this.state, b.id);
    const left = barracksRemaining(this.state, b.id, this.ctx.store.now());
    const parts = [
      t('barracks.queue', { n: queue.length, max: gameData.rules.barracks.queueMax }),
      t('info.population', { used: populationUsed(this.state), cap: populationCap(this.state) }),
    ];
    if (left !== null) parts.push(t('barracks.next', { time: formatDuration(left) }));
    return parts.join('  ·  ');
  }

  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const b = this.building;
    const pad = 12;
    const width = Math.min(this.width - pad * 2, 520);
    const left = Math.round((this.ctx.rect.width - width) / 2);
    if (!b) return 40;
    const def = gameData.buildingById.get(b.type)!;
    const soldier = soldierKindOf(b.type);
    const opened = unlockedRanks(b.level);
    if (selection.rank >= opened) selection.rank = Math.max(0, opened - 1);

    let y = 10;
    content.add(
      scene.add.text(
        left,
        y,
        t('info.title', { name: def.name, level: b.level }),
        textStyle(15, COLORS.text, { fontStyle: 'bold' }),
      ),
    );
    y += 24;
    const sub = scene.add.text(
      left,
      y,
      t('barracks.subtitle'),
      textStyle(12, COLORS.textDim, { wordWrap: { width } }),
    );
    content.add(sub);
    y += sub.height + 6;
    this.queueText = scene.add.text(
      left,
      y,
      this.queueLine(),
      textStyle(12, COLORS.warn, { fontStyle: 'bold', wordWrap: { width } }),
    );
    content.add(this.queueText);
    y += this.queueText.height + 12;
    if (!soldier || opened === 0) return y + 20;

    // One chip per rank; ranks the barracks has not opened yet show the level they need.
    const { cols, cardW } = gridColumns(width, 100, 3);
    gameData.rules.barracks.ranks.forEach((rank, i) => {
      const x = left + (i % cols) * (cardW + GAP) + cardW / 2;
      const cy = y + Math.floor(i / cols) * 44 + 18;
      const open = i < opened;
      content.add(
        new Button(scene, x, cy, {
          width: cardW,
          height: 36,
          label: open ? rank.name : t('barracks.rankLocked', { name: rank.name, level: i + 1 }),
          fontSize: 12,
          color: i === selection.rank ? COLORS.accent : darken(COLORS.accent, 0.55),
          disabled: !open,
          onClick: () => {
            selection.rank = i;
            this.render();
          },
        }),
      );
    });
    y += Math.ceil(gameData.rules.barracks.ranks.length / cols) * 44 + 8;

    // Preview of the soldier and the train button.
    const kind = { kind: soldier.id, rank: selection.rank };
    const cardH = 220;
    const card = scene.add.container(left, y);
    const frame = scene.add.graphics();
    drawCardFrame(frame, width, cardH, 'biasa');
    card.add(frame);
    card.add(scene.add.image(width / 2, 70, soldierTexture(scene, kind)).setScale(2));
    card.add(
      scene.add
        .text(width / 2, 120, soldierName(kind), textStyle(17, COLORS.text, { fontStyle: 'bold' }))
        .setOrigin(0.5, 0),
    );
    const stats = soldierStats(kind);
    card.add(
      scene.add
        .text(
          width / 2,
          144,
          [
            `${t('monster.stats', stats)}   ${t('monster.stats2', stats)}`,
            t('barracks.power', { power: soldierPower(kind) }),
          ].join('\n'),
          textStyle(11, COLORS.text, { align: 'center' }),
        )
        .setOrigin(0.5, 0),
    );
    const cost = soldierTrainCost(kind);
    card.add(
      new Button(scene, width / 2, cardH - 28, {
        width: Math.min(300, width - 32),
        height: 38,
        label: t('barracks.train', {
          cost: costLabel({ gold: cost.gold, food: cost.food, wood: 0, stone: 0 }),
          time: formatDuration(cost.seconds),
        }),
        color: 0x3c9a5f,
        onClick: () => {
          const result = this.run((s, now) =>
            trainSoldier(s, { buildingId: b.id, rank: kind.rank }, now),
          );
          if (result) toast(scene, t('barracks.started', { name: soldierName(kind) }), COLORS.good);
        },
      }),
    );
    content.add(card);
    return y + cardH + 24;
  }
}
