import Phaser from 'phaser';
import {
  gameData,
  knownSecretClues,
  libraryLevel,
  researchQueueCapacity,
  speedUpCost,
  techDef,
  techStatus,
  type ResearchTechBranch,
} from '@soul-monster/shared';
import { playSfx } from '../audio/sound';
import { formatDuration, t } from '../text';
import { costLabel } from '../ui/cost';
import { COLORS, textStyle } from '../ui/theme';
import { Button, toast } from '../ui/widgets';
import { View } from './View';

let selectedBranch: ResearchTechBranch = 'produksi';

const BRANCHES: { id: ResearchTechBranch; labelKey: string; icon: string; color: number }[] = [
  { id: 'produksi', labelKey: 'research.branch.produksi', icon: '🌾', color: 0x2e8b57 },
  { id: 'militer', labelKey: 'research.branch.militer', icon: '⚔️', color: 0xb3392b },
  { id: 'monster', labelKey: 'research.branch.monster', icon: '✨', color: 0x6c5ce7 },
];

/** Full research tree panel: browse 3 branches × 5 tiers of tech, research and speed up. */
export class ResearchView extends View {
  private activeTimerText?: Phaser.GameObjects.Text;
  private activeBarFill?: Phaser.GameObjects.Rectangle;
  private activeTechEndsAt: number | null = null;
  private activeTechTotalSec = 0;

  override tick(): void {
    if (
      this.activeTimerText &&
      this.activeTimerText.active &&
      this.activeTimerText.scene &&
      this.activeTechEndsAt !== null
    ) {
      const now = this.ctx.store.now();
      const left = Math.max(0, this.activeTechEndsAt - now);
      this.activeTimerText.setText(formatDuration(left));

      if (
        this.activeBarFill &&
        this.activeBarFill.active &&
        this.activeBarFill.scene &&
        this.activeTechTotalSec > 0
      ) {
        const elapsed = this.activeTechTotalSec - left;
        const progress = Math.min(1, Math.max(0, elapsed / this.activeTechTotalSec));
        this.activeBarFill.width = Math.round(200 * progress);
      }

      if (left <= 0) {
        // Research finished, re-render
        this.render();
      }
    }
  }

  override destroy(): void {
    this.activeTimerText = undefined;
    this.activeBarFill = undefined;
    this.activeTechEndsAt = null;
    super.destroy();
  }

  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const pad = 12;
    const width = Math.min(this.width - pad * 2, 600);
    const left = Math.round((this.ctx.rect.width - width) / 2);
    const level = libraryLevel(this.state);
    const queueCap = researchQueueCapacity(this.state);

    let y = 14;

    // Header Title
    content.add(
      scene.add.text(
        left,
        y,
        t('research.title'),
        textStyle(17, COLORS.text, { fontStyle: 'bold' }),
      ),
    );

    // Close button
    if (this.ctx.close) {
      const closeBtn = new Button(scene, left + width - 16, y + 10, {
        width: 30,
        height: 28,
        label: '✕',
        color: 0x4a3a3a,
        onClick: () => this.ctx.close?.(),
      });
      content.add(closeBtn);
    }

    y += 26;

    // Library level & queue capacity status
    const statusLine = `Perpustakaan Lv ${level}  ·  Antrean: ${this.state.research.queue.length}/${queueCap}  ·  Riset Selesai: ${this.state.research.completed.length}/${gameData.rules.research.techs.length}`;
    content.add(
      scene.add.text(left, y, statusLine, textStyle(12, COLORS.textDim, { wordWrap: { width } })),
    );
    y += 24;

    // Active Research banner (if currently researching something)
    if (this.state.research.active) {
      const activeTech = techDef(this.state.research.active.techId);
      if (activeTech) {
        this.activeTechEndsAt = this.state.research.active.endsAt;
        this.activeTechTotalSec = activeTech.seconds;
        const leftSec = Math.max(0, this.activeTechEndsAt - this.ctx.store.now());
        const gems = speedUpCost(leftSec);

        const bannerH = 68;
        const bannerBg = scene.add.rectangle(
          left + width / 2,
          y + bannerH / 2,
          width,
          bannerH,
          0x1f2b38,
          0.9,
        );
        bannerBg.setStrokeStyle(1.5, 0x4a8fc2);
        content.add(bannerBg);

        // Icon & title
        content.add(
          scene.add.text(
            left + 14,
            y + 10,
            `🔬 Sedang Meneliti: ${activeTech.name}`,
            textStyle(13, 0xffffff, { fontStyle: 'bold' }),
          ),
        );

        // Progress bar
        const barX = left + 14;
        const barY = y + 36;
        const barW = 200;
        const barH = 12;
        const barBg = scene.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH, 0x11161d);
        barBg.setStrokeStyle(1, 0x3d4f63);
        content.add(barBg);

        const progress = Math.min(
          1,
          Math.max(0, (activeTech.seconds - leftSec) / activeTech.seconds),
        );
        this.activeBarFill = scene.add.rectangle(
          barX + (barW * progress) / 2,
          barY + barH / 2,
          barW * progress,
          barH - 2,
          0x38bdf8,
        );
        content.add(this.activeBarFill);

        // Timer text
        this.activeTimerText = scene.add.text(
          barX + barW + 12,
          barY - 1,
          formatDuration(leftSec),
          textStyle(12, 0x93c5fd, { fontStyle: 'bold' }),
        );
        content.add(this.activeTimerText);

        // Speedup button
        const speedBtn = new Button(scene, left + width - 75, y + bannerH / 2, {
          width: 124,
          height: 34,
          label: `⚡ ${gems} Permata`,
          color: COLORS.accentDark,
          onClick: () => {
            const r = this.run('speedUpResearch', {});
            if (r) {
              playSfx(scene, 'win');
              toast(scene, t('research.finished', { name: activeTech.name }), COLORS.good);
              this.render();
            }
          },
        });
        content.add(speedBtn);

        y += bannerH + 14;
      }
    }

    // Branch selection tabs
    const tabW = Math.floor((width - (BRANCHES.length - 1) * 8) / BRANCHES.length);
    BRANCHES.forEach((b, i) => {
      const isSel = selectedBranch === b.id;
      const tabX = left + i * (tabW + 8) + tabW / 2;
      const tabBtn = new Button(scene, tabX, y + 16, {
        width: tabW,
        height: 34,
        label: `${b.icon} ${t(b.labelKey)}`,
        color: isSel ? b.color : 0x222630,
        onClick: () => {
          if (selectedBranch !== b.id) {
            selectedBranch = b.id;
            playSfx(scene, 'click');
            this.render();
          }
        },
      });
      content.add(tabBtn);
    });

    y += 46;

    // List of tech cards for the selected branch (Tiers 1 to 5)
    const branchTechs = gameData.rules.research.techs
      .filter((t) => t.branch === selectedBranch)
      .sort((a, b) => a.tier - b.tier);

    for (const tech of branchTechs) {
      const status = techStatus(this.state, tech.id);
      const isCompleted = status === 'completed';
      const isActive = status === 'active';
      const isQueued = status === 'queued';
      const isReady = status === 'ready';

      const cardH = 96;
      const cardBgColor = isCompleted
        ? 0x14281c
        : isActive
          ? 0x182c3c
          : isQueued
            ? 0x2e2716
            : isReady
              ? 0x20242e
              : 0x16181e;
      const strokeColor = isCompleted
        ? 0x34d399
        : isActive
          ? 0x38bdf8
          : isQueued
            ? 0xfacc15
            : isReady
              ? 0x4f5b70
              : 0x282c36;

      const cardBg = scene.add.rectangle(
        left + width / 2,
        y + cardH / 2,
        width,
        cardH,
        cardBgColor,
        0.95,
      );
      cardBg.setStrokeStyle(isCompleted || isActive ? 1.5 : 1, strokeColor);
      content.add(cardBg);

      // Tier badge & Name
      const tierBadge = `T${tech.tier}`;
      content.add(
        scene.add.text(
          left + 14,
          y + 12,
          tierBadge,
          textStyle(11, 0x94a3b8, { fontStyle: 'bold' }),
        ),
      );

      const nameColor = isCompleted
        ? 0xa7f3d0
        : isActive
          ? 0xbae6fd
          : isReady
            ? 0xffffff
            : 0x64748b;
      content.add(
        scene.add.text(
          left + 42,
          y + 10,
          tech.name,
          textStyle(14, nameColor, { fontStyle: 'bold' }),
        ),
      );

      // Description
      content.add(
        scene.add.text(
          left + 14,
          y + 32,
          tech.description,
          textStyle(12, isCompleted ? 0xcce8d8 : 0xd1d5db, { wordWrap: { width: width - 150 } }),
        ),
      );

      // Cost or Requirement footnote
      let subnote = '';
      if (isCompleted) {
        subnote = '✓ Selesai';
      } else if (isActive) {
        subnote = '⏳ Sedang berjalan';
      } else if (isQueued) {
        subnote = '📋 Dalam antrean berikutnya';
      } else if (status === 'lockedLibrary') {
        subnote = `🔒 ${t('research.requiresLibrary', { level: tech.tier })}`;
      } else if (status === 'lockedPrereq' && tech.requiresTech) {
        const prereq = techDef(tech.requiresTech);
        subnote = `🔒 ${t('research.requiresTech', { name: prereq?.name ?? tech.requiresTech })}`;
      } else {
        const costStr = costLabel({ ...tech.cost, wood: 0, stone: 0, food: 0 });
        subnote = `${costStr}  ·  ⏱ ${formatDuration(tech.seconds)}`;
      }

      const subnoteColor = isCompleted
        ? 0x34d399
        : isActive
          ? 0x38bdf8
          : isQueued
            ? 0xfacc15
            : isReady
              ? 0xf59e0b
              : 0xef4444;

      content.add(
        scene.add.text(
          left + 14,
          y + cardH - 22,
          subnote,
          textStyle(11, subnoteColor, { fontStyle: isCompleted || isReady ? 'bold' : 'normal' }),
        ),
      );

      // Action button on the right
      const btnX = left + width - 65;
      const btnY = y + cardH / 2;

      if (isCompleted) {
        const okBadge = scene.add.text(
          btnX,
          btnY,
          '✓ Selesai',
          textStyle(13, 0x34d399, { fontStyle: 'bold' }),
        );
        okBadge.setOrigin(0.5);
        content.add(okBadge);
      } else if (isActive) {
        const actBadge = scene.add.text(
          btnX,
          btnY,
          '⚡ Aktif',
          textStyle(13, 0x38bdf8, { fontStyle: 'bold' }),
        );
        actBadge.setOrigin(0.5);
        content.add(actBadge);
      } else if (isQueued) {
        const qBadge = scene.add.text(
          btnX,
          btnY,
          '📋 Antre',
          textStyle(13, 0xfacc15, { fontStyle: 'bold' }),
        );
        qBadge.setOrigin(0.5);
        content.add(qBadge);
      } else if (isReady) {
        const canQueue = this.state.research.active !== null;
        const btnLabel = canQueue ? 'Antre' : 'Teliti';
        const startBtn = new Button(scene, btnX, btnY, {
          width: 96,
          height: 34,
          label: btnLabel,
          color: canQueue ? 0xd97706 : 0x2563eb,
          onClick: () => {
            const r = this.run('startResearch', { techId: tech.id });
            if (r) {
              playSfx(scene, 'ready');
              toast(
                scene,
                t(canQueue ? 'research.queued' : 'research.started', { name: tech.name }),
                COLORS.good,
              );
              this.render();
            }
          },
        });
        content.add(startBtn);
      } else {
        const lockIcon = scene.add.text(btnX, btnY, '🔒', textStyle(16, 0x64748b));
        lockIcon.setOrigin(0.5);
        content.add(lockIcon);
      }

      y += cardH + 10;
    }

    // Secret clues section if any are revealed
    const clues = knownSecretClues(this.state);
    if (clues.length > 0) {
      y += 10;
      content.add(
        scene.add.text(
          left,
          y,
          '📜 Petunjuk Resep Rahasia Altar',
          textStyle(14, 0xfcd34d, { fontStyle: 'bold' }),
        ),
      );
      y += 24;

      for (const clue of clues) {
        const clueCardH = 44;
        const clueBg = scene.add.rectangle(
          left + width / 2,
          y + clueCardH / 2,
          width,
          clueCardH,
          0x241d2e,
        );
        clueBg.setStrokeStyle(1, 0x9333ea);
        content.add(clueBg);

        const clueText = `✨ ${clue.name} (${clue.element}): Campurkan [${clue.pair[0]}] + [${clue.pair[1]}]`;
        content.add(
          scene.add.text(
            left + 14,
            y + 14,
            clueText,
            textStyle(12, 0xe9d5ff, { fontStyle: 'bold' }),
          ),
        );
        y += clueCardH + 8;
      }
    }

    return y + 24;
  }
}
