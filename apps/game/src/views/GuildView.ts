import type Phaser from 'phaser';
import { guildLevel, guildMaxMembers, guildSerbuRewardBonus } from '@soul-monster/shared';
import { playSfx } from '../audio/sound';
import { t } from '../text';
import { COLORS, textStyle } from '../ui/theme';
import { Button, roundedPanel } from '../ui/widgets';
import { View } from './View';

/** Guild panel view: building stats, Serbu bonus, level breakdown, and community preview. */
export class GuildView extends View {
  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const s = this.state;
    const gLevel = guildLevel(s);
    const maxMembers = guildMaxMembers(gLevel);
    const bonusPct = Math.round(guildSerbuRewardBonus(gLevel) * 100);

    const pad = 12;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    let y = 14;

    // Header title and level badge
    const titleText = scene.add.text(
      left,
      y,
      t('guild.title'),
      textStyle(20, COLORS.gold, { fontStyle: 'bold' }),
    );
    content.add(titleText);

    const badgeX = left + titleText.width + 12;
    const badgeText = scene.add.text(
      badgeX + 8,
      y + 3,
      `Lv ${gLevel}`,
      textStyle(12, COLORS.accent, { fontStyle: 'bold' }),
    );
    const badgeBg = scene.add.rectangle(
      badgeX + (badgeText.width + 16) / 2,
      y + 10,
      badgeText.width + 16,
      20,
      COLORS.panelDark,
      0.9,
    );
    badgeBg.setStrokeStyle(1, COLORS.accent, 0.7);
    content.add([badgeBg, badgeText]);

    y += 28;

    // Current level description
    const descKey = `guild.desc${Math.max(1, Math.min(5, gLevel))}`;
    const descText = scene.add.text(left, y, t(descKey), textStyle(13, COLORS.textDim));
    content.add(descText);

    y += 24;

    // Two perk metric cards side by side
    const cardGap = 10;
    const cardW = (width - cardGap) / 2;
    const cardH = 64;

    // Card 1: Max Members
    const c1Bg = roundedPanel(scene, left, y, cardW, cardH, COLORS.panelDark, COLORS.stroke);
    const c1Label = scene.add.text(
      left + 12,
      y + 10,
      t('guild.maxMembers'),
      textStyle(11, COLORS.textDim),
    );
    const c1Val = scene.add.text(
      left + 12,
      y + 28,
      t('guild.maxMembersValue', { n: maxMembers }),
      textStyle(16, COLORS.text, { fontStyle: 'bold' }),
    );
    const c1Icon = scene.add.text(left + cardW - 32, y + 16, '👥', { fontSize: '22px' });
    content.add([c1Bg, c1Label, c1Val, c1Icon]);

    // Card 2: Serbu & Mission Reward Bonus
    const c2X = left + cardW + cardGap;
    const c2Bg = roundedPanel(scene, c2X, y, cardW, cardH, COLORS.panelDark, COLORS.stroke);
    const c2Label = scene.add.text(
      c2X + 12,
      y + 10,
      t('guild.serbuBonus'),
      textStyle(11, COLORS.textDim),
    );
    const c2Val = scene.add.text(
      c2X + 12,
      y + 28,
      t('guild.serbuBonusValue', { pct: bonusPct }),
      textStyle(16, COLORS.good, { fontStyle: 'bold' }),
    );
    const c2Icon = scene.add.text(c2X + cardW - 32, y + 16, '⚔️', { fontSize: '22px' });
    content.add([c2Bg, c2Label, c2Val, c2Icon]);

    y += cardH + 12;

    // Action button to jump directly to Serbu
    const serbuBtn = new Button(scene, left + width / 2, y + 18, {
      width,
      height: 36,
      label: `⚔️ ${t('guild.openSerbuBtn')}`,
      color: COLORS.danger,
      onClick: () => {
        playSfx(scene, 'click');
        this.ctx.close?.();
        scene.scene.launch('serbu', { source: 'serbu' });
      },
    });
    content.add(serbuBtn);

    y += 48;

    // Levels breakdown table
    const levelsTitle = scene.add.text(
      left,
      y,
      t('guild.level', { level: `${gLevel} / 5` }),
      textStyle(13, COLORS.accent, { fontStyle: 'bold' }),
    );
    content.add(levelsTitle);

    y += 20;

    const levelsData = [
      { lvl: 1, members: 10, bonus: 0, hall: 3 },
      { lvl: 2, members: 15, bonus: 5, hall: 3 },
      { lvl: 3, members: 20, bonus: 10, hall: 4 },
      { lvl: 4, members: 25, bonus: 15, hall: 5 },
      { lvl: 5, members: 30, bonus: 20, hall: 6 },
    ];

    const rowH = 26;
    levelsData.forEach((row) => {
      const isCurrent = row.lvl === gLevel;
      const isUnlocked = row.lvl <= gLevel;

      const rowBg = roundedPanel(
        scene,
        left,
        y,
        width,
        rowH,
        isCurrent ? COLORS.panelLight : COLORS.panelDark,
        isCurrent ? COLORS.accent : COLORS.stroke,
      );

      const lvlBadge = scene.add.text(
        left + 10,
        y + 5,
        `Lv ${row.lvl}`,
        textStyle(11, isCurrent ? COLORS.gold : isUnlocked ? COLORS.text : COLORS.textDim, {
          fontStyle: 'bold',
        }),
      );

      const perkText = scene.add.text(
        left + 54,
        y + 5,
        `${row.members} pejuang  ·  Hadiah Serbu +${row.bonus}%`,
        textStyle(11, isCurrent ? COLORS.text : isUnlocked ? COLORS.text : COLORS.textDim),
      );

      const hallReq = scene.add.text(
        left + width - 10,
        y + 5,
        `Balai ${row.hall}`,
        textStyle(10, COLORS.textDim),
      );
      hallReq.setOrigin(1, 0);

      content.add([rowBg, lvlBadge, perkText, hallReq]);
      y += rowH + 4;
    });

    y += 8;

    // Community Phase 2 Preview card at bottom
    const commH = 56;
    const commBg = roundedPanel(scene, left, y, width, commH, COLORS.panelDark, COLORS.accent);
    const commTitle = scene.add.text(
      left + 12,
      y + 8,
      `🛡️ ${t('guild.communityTitle')}`,
      textStyle(11, COLORS.accent, { fontStyle: 'bold' }),
    );
    const commDesc = scene.add.text(
      left + 12,
      y + 24,
      t('guild.communityNote'),
      textStyle(10, COLORS.textDim, { wordWrap: { width: width - 24 } }),
    );
    content.add([commBg, commTitle, commDesc]);

    y += commH + 16;
    return y;
  }
}
