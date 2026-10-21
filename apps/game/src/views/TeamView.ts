import type Phaser from 'phaser';
import {
  compareMonsters,
  encounterGroup,
  gameData,
  isMonsterBusy,
  missionFor,
  sendTeam,
  winChance,
} from '@soul-monster/shared';
import { t } from '../text';
import { MINI_CARD_HEIGHT, miniCard } from '../ui/MonsterCard';
import { COLORS, textStyle } from '../ui/theme';
import { Button, toast } from '../ui/widgets';
import { GAP, gridColumns } from './CollectionView';
import { encounterTitle } from './enemyText';
import { View } from './View';

/** Pick monsters for a team against one wild encounter, see the odds, send them. */
export class TeamView extends View {
  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const team = this.ctx.team;
    const e = this.state.village.encounters.find((x) => x.id === this.ctx.targetId);
    const pad = 8;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    if (!e || !team) {
      content.add(scene.add.text(left, 14, t('team.gone'), textStyle(13, COLORS.textDim)));
      return 60;
    }
    const ids = team.ids();
    const members = this.state.monsters.filter((m) => ids.includes(m.id));
    const chance = winChance(members, e);
    const { maxTeam } = gameData.rules.skirmish;

    let y = 10;
    content.add(
      scene.add.text(left, y, encounterTitle(e), textStyle(15, COLORS.text, { fontStyle: 'bold' })),
    );
    y += 24;
    const reward = encounterGroup(e).reward;
    const info = scene.add.text(
      left,
      y,
      [
        t('team.summary', { n: ids.length, max: maxTeam }),
        t('team.chance', { percent: Math.round(chance * 100) }),
        t('team.reward', { reward: rewardLabel(reward) }),
      ].join('  ·  '),
      textStyle(12, COLORS.warn, { fontStyle: 'bold', wordWrap: { width: width - 150 } }),
    );
    content.add(info);
    const busy = missionFor(this.state, e.id);
    content.add(
      new Button(scene, left + width - 70, y + 8, {
        width: 140,
        height: 36,
        label: t('team.send'),
        color: 0x3c9a5f,
        disabled: ids.length === 0 || !!busy,
        onClick: () => {
          const r = this.run((s, now) => sendTeam(s, { monsterIds: ids, encounterId: e.id }, now));
          if (!r) return;
          toast(scene, t('team.sent', { n: ids.length }), COLORS.good, 'march');
          team.clear();
          this.ctx.close?.();
        },
      }),
    );
    y += Math.max(info.height, 36) + 10;
    const hint = scene.add.text(
      left,
      y,
      t('team.hint'),
      textStyle(11, COLORS.textDim, { wordWrap: { width } }),
    );
    content.add(hint);
    y += hint.height + 10;

    const monsters = [...this.state.monsters].sort((a, b) => compareMonsters(a, b));
    const { cols, cardW } = gridColumns(width, 120, 3);
    monsters.forEach((m, i) => {
      const x = left + (i % cols) * (cardW + GAP);
      const cy = y + Math.floor(i / cols) * (MINI_CARD_HEIGHT + GAP);
      const unavailable = isMonsterBusy(this.state, m.id);
      const card = miniCard(scene, x, cy, cardW, m, () => {
        if (unavailable) {
          toast(scene, t('team.busy'));
          return;
        }
        team.toggle(m.id);
        this.render();
      });
      if (unavailable) card.setAlpha(0.45);
      content.add(card);
      if (ids.includes(m.id)) {
        const ring = scene.add.graphics();
        ring
          .lineStyle(3, COLORS.gold, 1)
          .strokeRoundedRect(x - 2, cy - 2, cardW + 4, MINI_CARD_HEIGHT + 4, 12);
        content.add(ring);
      }
    });
    return y + Math.ceil(monsters.length / cols) * (MINI_CARD_HEIGHT + GAP) + 16;
  }
}

function rewardLabel(reward: {
  gold: number;
  food: number;
  wood: number;
  stone: number;
  soulCrystalChance: number;
}) {
  const parts: string[] = [];
  for (const r of ['gold', 'food', 'wood', 'stone'] as const) {
    if (reward[r] > 0) parts.push(t(`cost.${r}`, { n: reward[r] }));
  }
  if (reward.soulCrystalChance > 0) {
    parts.push(t('team.crystalChance', { percent: Math.round(reward.soulCrystalChance * 100) }));
  }
  return parts.join(' + ');
}

export { rewardLabel };
