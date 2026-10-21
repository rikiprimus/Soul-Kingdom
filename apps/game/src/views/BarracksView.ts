import type Phaser from 'phaser';
import {
  barracksQueue,
  barracksRemaining,
  gameData,
  monsterName,
  monsterStats,
  populationCap,
  populationUsed,
  rarityOf,
  trainSoldier,
  trainingOptions,
} from '@soul-monster/shared';
import { elementIconTexture, ART_RES } from '../art/monsterArt';
import { MonsterView } from '../art/MonsterView';
import { unitColor } from '../art/palette';
import { formatDuration, t } from '../text';
import { costLabel } from '../ui/cost';
import { drawCardFrame, rarityName, stageName } from '../ui/MonsterCard';
import { COLORS, RARITY_COLORS, textStyle } from '../ui/theme';
import { Button, darken, toast } from '../ui/widgets';
import { GAP, gridColumns } from './CollectionView';
import { View } from './View';

const selection = { form: '', element: '' };
const adultStage = () => gameData.rules.growth.stages[gameData.rules.growth.stages.length - 1]!.id;

/** Training panel of one barracks: pick an unlocked form and element, queue an adult soldier. */
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
    const { forms, elements } = trainingOptions(b.type, b.level);
    if (!forms.includes(selection.form)) selection.form = forms[0] ?? '';
    if (!elements.includes(selection.element)) selection.element = elements[0] ?? '';

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
    if (forms.length === 0) return y + 20;

    const chipGrid = (
      items: { id: string; label: string; color: number }[],
      selected: string,
      onPick: (id: string) => void,
    ) => {
      const { cols, cardW } = gridColumns(width, 100, 3);
      items.forEach((item, i) => {
        const x = left + (i % cols) * (cardW + GAP) + cardW / 2;
        const cy = y + Math.floor(i / cols) * 44 + 18;
        content.add(
          new Button(scene, x, cy, {
            width: cardW,
            height: 36,
            label: item.label,
            fontSize: 13,
            color: item.id === selected ? item.color : darken(item.color, 0.55),
            onClick: () => onPick(item.id),
          }),
        );
      });
      y += Math.ceil(items.length / cols) * 44 + 8;
    };
    chipGrid(
      forms.map((id) => ({ id, label: gameData.formById.get(id)!.name, color: COLORS.accent })),
      selection.form,
      (id) => {
        selection.form = id;
        this.render();
      },
    );
    chipGrid(
      elements.map((id) => ({
        id,
        label: gameData.elementById.get(id)!.name,
        color: unitColor(id),
      })),
      selection.element,
      (id) => {
        selection.element = id;
        this.render();
      },
    );

    // Preview of the adult soldier and the train button.
    const kind = { form: selection.form, element: selection.element, stage: adultStage() };
    const cardH = 250;
    const card = scene.add.container(left, y);
    const frame = scene.add.graphics();
    const rarity = rarityOf(kind);
    drawCardFrame(frame, width, cardH, rarity);
    card.add(frame);
    card.add(new MonsterView(scene, width / 2, 76, kind, 120));
    card.add(
      scene.add
        .image(width - 26, 26, elementIconTexture(scene, kind.element, 28))
        .setScale(1 / ART_RES),
    );
    card.add(
      scene.add
        .text(width / 2, 144, monsterName(kind), textStyle(17, COLORS.text, { fontStyle: 'bold' }))
        .setOrigin(0.5, 0),
    );
    card.add(
      scene.add
        .text(
          width / 2,
          168,
          `${rarityName(rarity)} · ${stageName(kind.stage)}`,
          textStyle(12, RARITY_COLORS[rarity], { fontStyle: 'bold' }),
        )
        .setOrigin(0.5, 0),
    );
    const stats = monsterStats(kind);
    card.add(
      scene.add
        .text(
          width / 2,
          186,
          `${t('monster.stats', stats)}   ${t('monster.stats2', stats)}`,
          textStyle(11),
        )
        .setOrigin(0.5, 0),
    );
    const { train } = gameData.rules.barracks;
    card.add(
      new Button(scene, width / 2, cardH - 28, {
        width: Math.min(300, width - 32),
        height: 38,
        label: t('barracks.train', {
          cost: costLabel({ gold: train.gold, food: train.food, wood: 0, stone: 0 }),
          time: formatDuration(train.seconds),
        }),
        color: 0x3c9a5f,
        onClick: () => {
          const result = this.run((s, now) =>
            trainSoldier(s, { buildingId: b.id, form: kind.form, element: kind.element }, now),
          );
          if (result) toast(scene, t('barracks.started', { name: monsterName(kind) }), COLORS.good);
        },
      }),
    );
    content.add(card);
    return y + cardH + 24;
  }
}
