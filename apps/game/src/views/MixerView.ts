import Phaser from 'phaser';
import {
  buyMixerSlot,
  cancelMix,
  collectMix,
  confirmMix,
  eligibleParents,
  gameData,
  getForm,
  isMixerUnlocked,
  isParentConsumed,
  mixCost,
  mixOddsTable,
  mixRemaining,
  monsterName,
  nextMixerSlotGems,
  prophesy,
  rarityOf,
  rarityRank,
  speedUp,
  speedUpCost,
  startMix,
  type Monster,
  type MixEntry,
  type MixResult,
} from '@soul-monster/shared';
import { MonsterView } from '../art/MonsterView';
import { playSfx } from '../audio/sound';
import { ART_RES, eggTexture } from '../art/monsterArt';
import { elementColor } from '../art/palette';
import { errorText, formatDuration, formatNumber, percent, t } from '../text';
import { MINI_CARD_HEIGHT, drawCardFrame, miniCard, rarityName } from '../ui/MonsterCard';
import { COLORS, RARITY_COLORS, textStyle } from '../ui/theme';
import {
  Button,
  Modal,
  ScrollArea,
  deferClick,
  icons,
  pointerState,
  roundedPanel,
  toast,
} from '../ui/widgets';
import { GAP, gridColumns } from './CollectionView';
import { View } from './View';

const selection: { a?: string; b?: string } = {};

function resultTags(result: MixResult): string[] {
  const tags: string[] = [];
  if (result.recipeId) tags.push(t('mixer.tagRecipe'));
  if (result.mutation) tags.push(t('mixer.tagMutation'));
  if (result.secretElement) tags.push(t('mixer.tagSecret'));
  return tags;
}

interface Timer {
  entryId: string;
  text: Phaser.GameObjects.Text;
  speed?: Button;
}

export class MixerView extends View {
  private timers: Timer[] = [];

  protected build(content: Phaser.GameObjects.Container): number {
    this.timers = [];
    const { scene } = this;
    const pad = 12;
    const width = Math.min(this.width - pad * 2, 640);
    const left = Math.round((this.ctx.rect.width - width) / 2);
    const { pity } = gameData.rules.mixer;

    let y = 12;
    content.add(
      scene.add
        .text(
          left + width,
          y,
          t('mixer.pity', { streak: this.state.pityStreak, target: pity.streak }),
          textStyle(11, COLORS.textDim),
        )
        .setOrigin(1, 0),
    );
    y += 24;

    const unlocked = isMixerUnlocked(this.state) || this.ctx.dev.skipMixerUnlock;
    if (!unlocked) {
      const panel = roundedPanel(scene, left, y, width, 120, COLORS.panelDark);
      content.add(panel);
      content.add(
        scene.add
          .image(left + width / 2, y + 44, eggTexture(scene, 56, COLORS.disabled))
          .setScale(1 / ART_RES),
      );
      content.add(
        scene.add
          .text(
            left + width / 2,
            y + 92,
            t('mixer.locked', { level: gameData.rules.mixer.unlockTownHallLevel }),
            textStyle(14, COLORS.warn, {
              fontStyle: 'bold',
              align: 'center',
              wordWrap: { width: width - 20 },
            }),
          )
          .setOrigin(0.5),
      );
      return y + 140;
    }

    y = this.buildQueue(content, left, y, width);
    y = this.buildSelection(content, left, y + 16, width);
    return y + 24;
  }

  // ---------- Queue ----------

  private buildQueue(
    content: Phaser.GameObjects.Container,
    left: number,
    y: number,
    width: number,
  ): number {
    const { scene, state } = this;
    content.add(
      scene.add.text(
        left,
        y,
        t('mixer.queue', { used: state.mixQueue.length, slots: state.mixerSlots }),
        textStyle(15, COLORS.text, { fontStyle: 'bold' }),
      ),
    );
    const slotGems = nextMixerSlotGems(state);
    if (slotGems !== null) {
      content.add(
        new Button(scene, left + width - 75, y + 9, {
          width: 150,
          height: 28,
          fontSize: 12,
          label: t('mixer.buySlot', { gems: slotGems }),
          color: 0x2a8fb0,
          onClick: () => {
            if (this.run((s) => buyMixerSlot(s)))
              toast(scene, t('mixer.buySlot', { gems: slotGems }), COLORS.good);
          },
        }),
      );
    }
    y += 32;
    const rowH = 104;
    for (let slot = 0; slot < state.mixerSlots; slot++) {
      const entry = state.mixQueue[slot];
      if (entry) this.buildEntry(content, entry, left, y, width, rowH);
      else {
        const g = roundedPanel(scene, left, y, width, 44, COLORS.panelDark, COLORS.stroke);
        content.add(g);
        content.add(
          scene.add
            .text(left + width / 2, y + 22, t('mixer.queueEmpty'), textStyle(12, COLORS.textDim))
            .setOrigin(0.5),
        );
      }
      y += (entry ? rowH : 44) + GAP;
    }
    return y;
  }

  private buildEntry(
    content: Phaser.GameObjects.Container,
    entry: MixEntry,
    left: number,
    y: number,
    width: number,
    h: number,
  ) {
    const { scene } = this;
    const now = this.ctx.store.now();
    const remaining = mixRemaining(entry, now);
    const ready = remaining === 0;
    const row = scene.add.container(left, y);
    row.add(
      roundedPanel(
        scene,
        0,
        0,
        width,
        h,
        ready ? 0x24432f : COLORS.panel,
        ready ? COLORS.good : COLORS.stroke,
      ),
    );

    const art = 72;
    if (entry.prophesied) {
      row.add(
        new MonsterView(
          scene,
          12 + art / 2,
          h / 2,
          { ...entry.result, stage: gameData.rules.growth.stages[0]!.id },
          art,
        ),
      );
    } else {
      const egg = scene.add
        .image(12 + art / 2, h / 2, eggTexture(scene, art))
        .setScale(1 / ART_RES);
      row.add(egg);
      if (ready)
        scene.tweens.add({
          targets: egg,
          angle: { from: -8, to: 8 },
          duration: 160,
          yoyo: true,
          repeat: -1,
          repeatDelay: 700,
        });
    }

    const textX = 24 + art;
    const textW = width - textX - 132;
    const [pa, pb] = entry.parents;
    row.add(
      scene.add.text(
        textX,
        12,
        `${monsterName(pa)} + ${monsterName(pb)}`,
        textStyle(11, COLORS.textDim, { wordWrap: { width: Math.max(80, textW) } }),
      ),
    );
    let status: string;
    if (entry.status === 'prepared') {
      status = entry.prophesied
        ? `${monsterName(entry.result)} (${rarityName(entry.result.rarity)})`
        : t('mixer.prepared');
    } else
      status = ready
        ? t('mixer.ready')
        : t('mixer.mixing', { time: formatDuration(remaining ?? 0) });
    const statusText = scene.add.text(
      textX,
      h - 38,
      status,
      textStyle(13, ready ? COLORS.good : COLORS.text, {
        fontStyle: 'bold',
        wordWrap: { width: Math.max(80, textW) },
      }),
    );
    row.add(statusText);

    const bx = width - 66;
    const button = (yy: number, label: string, color: number, onClick: () => void) => {
      const b = new Button(scene, bx, yy, {
        width: 120,
        height: 32,
        label,
        fontSize: 12,
        color,
        onClick,
      });
      row.add(b);
      return b;
    };
    if (entry.status === 'prepared' && !entry.prophesied) {
      button(30, t('mixer.start'), COLORS.accent, () =>
        this.run((s, n) => confirmMix(s, entry.id, n)),
      );
      button(h - 30, t('mixer.prophecy', { gems: entry.cost.prophecyGems }), 0x2a8fb0, () =>
        this.prophesyEntry(entry.id),
      );
    } else if (entry.status === 'prepared') {
      button(30, t('mixer.continue'), COLORS.good, () => this.continueEntry(entry.id));
      button(h - 30, t('mixer.cancel'), COLORS.danger, () => this.cancelEntry(entry.id));
    } else if (ready) {
      button(h / 2, t('mixer.collect'), COLORS.good, () => this.collect(entry.id));
    } else {
      const speed = button(
        h / 2,
        t('mixer.speedUp', { gems: speedUpCost(remaining ?? 0) }),
        0x2a8fb0,
        () => {
          if (this.run((s, n) => speedUp(s, entry.id, n))) this.collect(entry.id);
        },
      );
      this.timers.push({ entryId: entry.id, text: statusText, speed });
    }
    content.add(row);
  }

  override tick(): void {
    const now = this.ctx.store.now();
    for (const timer of this.timers) {
      const entry = this.state.mixQueue.find((e) => e.id === timer.entryId);
      const remaining = entry ? mixRemaining(entry, now) : null;
      if (remaining === null || remaining === 0) {
        this.render();
        return;
      }
      timer.text.setText(t('mixer.mixing', { time: formatDuration(remaining) }));
      timer.speed?.setLabel(t('mixer.speedUp', { gems: speedUpCost(remaining) }));
    }
  }

  // ---------- Parent selection ----------

  private selectedParents(): [Monster | undefined, Monster | undefined] {
    const eligible = eligibleParents(this.state);
    const find = (id?: string) => eligible.find((m) => m.id === id);
    const a = find(selection.a);
    const b = find(selection.b);
    if (!a) delete selection.a;
    if (!b) delete selection.b;
    return [a, b];
  }

  private buildSelection(
    content: Phaser.GameObjects.Container,
    left: number,
    y: number,
    width: number,
  ): number {
    const { scene } = this;
    const [a, b] = this.selectedParents();
    const boxW = (width - GAP) / 2;
    const boxH = 160;
    (
      [
        ['a', a, t('mixer.parentA')],
        ['b', b, t('mixer.parentB')],
      ] as const
    ).forEach(([key, monster, label], i) => {
      const box = scene.add.container(left + i * (boxW + GAP), y);
      const frame = scene.add.graphics();
      if (monster) drawCardFrame(frame, boxW, boxH, rarityOf(monster));
      else {
        frame.fillStyle(COLORS.panelDark).fillRoundedRect(0, 0, boxW, boxH, 12);
        frame.lineStyle(2, COLORS.accent, 0.7).strokeRoundedRect(1, 1, boxW - 2, boxH - 2, 12);
      }
      box.add(frame);
      box.add(scene.add.text(10, 8, label, textStyle(11, COLORS.textDim, { fontStyle: 'bold' })));
      if (monster) {
        box.add(new MonsterView(scene, boxW / 2, 72, monster, 92));
        box.add(
          scene.add
            .text(
              boxW / 2,
              boxH - 34,
              monsterName(monster),
              textStyle(12, COLORS.text, {
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: boxW - 12 },
              }),
            )
            .setOrigin(0.5, 0),
        );
      } else {
        box.add(
          scene.add
            .text(boxW / 2, 70, '+', textStyle(44, COLORS.accent, { fontStyle: 'bold' }))
            .setOrigin(0.5),
        );
        box.add(
          scene.add
            .text(boxW / 2, 118, t('mixer.choose'), textStyle(12, COLORS.textDim))
            .setOrigin(0.5),
        );
      }
      const zone = scene.add
        .zone(0, 0, boxW, boxH)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => {
        if (!pointerState.dragMoved) deferClick(scene, () => this.openPicker(key));
      });
      box.add(zone);
      content.add(box);
    });
    y += boxH + 12;
    if (!a || !b) return y;

    // Cost, time and the free base odds table.
    const context = {
      bossesDefeated: this.state.bossesDefeated,
      pityStreak: this.state.pityStreak,
    };
    const cost = mixCost(a, b, context);
    const odds = mixOddsTable(a, b, context);
    const lines: { text: string; color?: number; bold?: boolean }[] = [];
    lines.push({
      text: `${t('mixer.cost', { gold: formatNumber(cost.gold) })}${cost.soulCrystal ? ` ${t('mixer.costCrystal', { crystal: cost.soulCrystal })}` : ''}   ·   ${t('mixer.time', { time: formatDuration(cost.seconds) })}`,
      bold: true,
    });
    lines.push({ text: t('mixer.oddsTitle'), color: COLORS.accent, bold: true });
    const mutationTier = odds.tiers.length
      ? Math.min(odds.baseTier + 1, odds.maxTier)
      : odds.baseTier;
    for (const row of odds.tiers) {
      // The mutation share is listed separately below.
      const p =
        row.tier === mutationTier ? row.probability - odds.formTierOdds.mutation : row.probability;
      if (p > 1e-9)
        lines.push({
          text: `  ${t('mixer.oddsTier', { tier: row.tier })} — ${gameData.forms.tiers[String(row.tier)]?.name ?? ''}: ${percent(p)}`,
        });
    }
    lines.push({
      text: `  ${t('mixer.oddsMutation', { tier: mutationTier })}: ${percent(odds.formTierOdds.mutation)}`,
    });
    lines.push({ text: `  ${t('mixer.oddsCap', { tier: odds.maxTier })}`, color: COLORS.textDim });
    for (const el of odds.elements) {
      const name = el.element ? (gameData.elementById.get(el.element)?.name ?? el.element) : '';
      const label =
        el.source === 'fullUnion'
          ? t('mixer.oddsElementUnion', { element: name })
          : el.source === 'parent'
            ? t('mixer.oddsElementParent', { element: name })
            : t('mixer.oddsElementPartial');
      lines.push({ text: `  ${label}: ${percent(el.probability)}` });
    }
    lines.push({ text: t('mixer.oddsNote'), color: COLORS.textDim });
    if (!isParentConsumed(a) || !isParentConsumed(b))
      lines.push({ text: t('mixer.parentsKept'), color: COLORS.warn });

    const text = scene.add.text(
      left + 14,
      y + 12,
      '',
      textStyle(12, COLORS.text, { lineSpacing: 4, wordWrap: { width: width - 28 } }),
    );
    text.setText(lines.map((l) => l.text));
    const panelH = text.height + 24;
    content.add(roundedPanel(scene, left, y, width, panelH, COLORS.panelDark));
    content.add(text);
    y += panelH + 14;

    const bw = (width - GAP) / 2;
    content.add(
      new Button(scene, left + bw / 2, y + 22, {
        width: bw,
        height: 44,
        label: t('mixer.mix'),
        fontSize: 16,
        icon: icons.gold,
        onClick: () => this.mix(a, b, false),
      }),
    );
    content.add(
      new Button(scene, left + bw + GAP + bw / 2, y + 22, {
        width: bw,
        height: 44,
        label: t('mixer.prophecy', { gems: cost.prophecyGems }),
        fontSize: 14,
        color: 0x2a8fb0,
        icon: icons.gem,
        onClick: () => this.mix(a, b, true),
      }),
    );
    return y + 50;
  }

  private openPicker(slot: 'a' | 'b') {
    const { scene } = this;
    const other = slot === 'a' ? selection.b : selection.a;
    const candidates = eligibleParents(this.state).filter((m) => m.id !== other);
    const { width: W, height: H } = scene.scale;
    const mw = Math.min(W - 24, 560);
    const mh = Math.min(H - 60, 620);
    const modal = new Modal(scene, {
      width: mw,
      height: mh,
      title: t('mixer.chooseTitle'),
      dismissible: true,
    });
    const rect = new Phaser.Geom.Rectangle(modal.x + 12, modal.y + 48, mw - 24, mh - 110);
    const area = modal.own(new ScrollArea(scene, rect, modal.depth + 2));
    if (candidates.length === 0) {
      area.content.add(
        scene.add
          .text(rect.width / 2, 40, t('mixer.noEligible'), textStyle(14, COLORS.textDim))
          .setOrigin(0.5),
      );
    }
    const { cols, cardW } = gridColumns(rect.width, 100, 3);
    candidates
      .sort((x, y) => getForm(y.form).tier - getForm(x.form).tier)
      .forEach((m, i) => {
        const x = (i % cols) * (cardW + GAP);
        const yy = Math.floor(i / cols) * (MINI_CARD_HEIGHT + GAP);
        area.content.add(
          miniCard(scene, x, yy, cardW, m, () => {
            selection[slot] = m.id;
            modal.close();
            this.render();
          }),
        );
      });
    area.setContentHeight(Math.ceil(candidates.length / cols) * (MINI_CARD_HEIGHT + GAP));
    modal.panel.add(
      new Button(scene, mw / 2, mh - 32, {
        width: 140,
        height: 38,
        label: t('pedia.close'),
        color: COLORS.panelLight,
        onClick: () => modal.close(),
      }),
    );
  }

  // ---------- Actions ----------

  private mix(a: Monster, b: Monster, withProphecy: boolean) {
    const { scene } = this;
    const skipUnlock = this.ctx.dev.skipMixerUnlock;
    if (withProphecy) {
      const cost = mixCost(a, b, { bossesDefeated: this.state.bossesDefeated });
      if (this.state.resources.gems < cost.prophecyGems) {
        toast(scene, errorText('notEnoughGems'));
        return;
      }
    }
    const started = this.run((s, now) =>
      startMix(
        s,
        { parentAId: a.id, parentBId: b.id, awaitProphecy: withProphecy, skipUnlock },
        now,
      ),
    );
    if (!started) return;
    playSfx(scene, 'mixer');
    delete selection.a;
    delete selection.b;
    if (withProphecy) this.prophesyEntry(started.entryId);
    else toast(scene, t('mixer.started'), COLORS.good);
  }

  private prophesyEntry(entryId: string) {
    const result = this.run((s) => prophesy(s, entryId));
    if (result) this.showProphecy(entryId, result.result);
  }

  private continueEntry(entryId: string) {
    if (this.run((s, now) => confirmMix(s, entryId, now))) {
      playSfx(this.scene, 'mixer');
      toast(this.scene, t('mixer.started'), COLORS.good);
    }
  }

  private cancelEntry(entryId: string) {
    if (this.run((s) => cancelMix(s, entryId)))
      toast(this.scene, t('mixer.cancelled'), COLORS.warn);
  }

  private collect(entryId: string) {
    const result = this.run((s, now) => collectMix(s, entryId, now));
    if (result) this.showHatch(result.monster, result.result, result.newDiscovery);
  }

  // ---------- Modals ----------

  private resultModal(title: string, height: number) {
    const { width: W } = this.scene.scale;
    const mw = Math.min(W - 32, 380);
    return { modal: new Modal(this.scene, { width: mw, height, title }), mw };
  }

  private addResultInfo(
    modal: Modal,
    mw: number,
    result: MixResult,
    y: number,
    extra: string[] = [],
  ) {
    const { scene } = this;
    const kind = { form: result.form, element: result.element };
    modal.panel.add(
      scene.add
        .text(
          mw / 2,
          y,
          monsterName(kind),
          textStyle(20, COLORS.text, {
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: mw - 24 },
          }),
        )
        .setOrigin(0.5, 0),
    );
    modal.panel.add(
      scene.add
        .text(
          mw / 2,
          y + 30,
          `${rarityName(result.rarity)} · ${t('monster.tier', { tier: getForm(result.form).tier })}`,
          textStyle(13, RARITY_COLORS[result.rarity], { fontStyle: 'bold' }),
        )
        .setOrigin(0.5, 0),
    );
    const tags = [...extra, ...resultTags(result)];
    tags.forEach((tag, i) => {
      const label = scene.add
        .text(mw / 2, y + 56 + i * 24, tag, textStyle(14, COLORS.gold, { fontStyle: 'bold' }))
        .setOrigin(0.5, 0);
      modal.panel.add(label);
      scene.tweens.add({
        targets: label,
        scale: 1.12,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
    return y + 60 + tags.length * 24;
  }

  private showProphecy(entryId: string, result: MixResult) {
    const { scene } = this;
    const tags = resultTags(result).length;
    const { modal, mw } = this.resultModal(t('mixer.prophecyTitle'), 360 + tags * 24);
    playSfx(scene, 'prophecy');
    modal.panel.add(
      scene.add
        .text(mw / 2, 48, t('mixer.prophecyText'), textStyle(12, COLORS.textDim))
        .setOrigin(0.5),
    );
    const view = new MonsterView(
      scene,
      mw / 2,
      140,
      { ...result, stage: gameData.rules.growth.stages[0]!.id },
      140,
    );
    modal.panel.add(view);
    const y = this.addResultInfo(modal, mw, result, 218);
    const bw = (mw - 36) / 2;
    modal.panel.add(
      new Button(scene, 12 + bw / 2, y + 26, {
        width: bw,
        height: 40,
        label: t('mixer.continue'),
        color: COLORS.good,
        onClick: () => {
          modal.close();
          this.continueEntry(entryId);
        },
      }),
    );
    modal.panel.add(
      new Button(scene, mw - 12 - bw / 2, y + 26, {
        width: bw,
        height: 40,
        label: t('mixer.cancel'),
        color: COLORS.danger,
        onClick: () => {
          modal.close();
          this.cancelEntry(entryId);
        },
      }),
    );
  }

  /** Egg wobbles, cracks and bursts, then the baby pops out with its badges. */
  private showHatch(monster: Monster, result: MixResult, newDiscovery: boolean) {
    const { scene } = this;
    const extra = newDiscovery ? [t('mixer.newDiscovery')] : [];
    const tags = extra.length + resultTags(result).length;
    const { modal, mw } = this.resultModal(t('mixer.hatchTitle'), 350 + tags * 24);
    const cx = mw / 2;
    const cy = 140;
    const color = elementColor(result.element);
    const egg = scene.add.image(cx, cy, eggTexture(scene, 120, color)).setScale(1 / ART_RES);
    const cracks = scene.add.graphics().setAlpha(0);
    cracks.lineStyle(3, 0x3a2a10, 1);
    cracks.strokePoints([
      { x: cx - 30, y: cy - 10 },
      { x: cx - 14, y: cy + 4 },
      { x: cx - 2, y: cy - 12 },
      { x: cx + 12, y: cy + 6 },
      { x: cx + 28, y: cy - 6 },
    ]);
    modal.panel.add([egg, cracks]);
    scene.tweens.add({
      targets: egg,
      angle: { from: -10, to: 10 },
      duration: 110,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        cracks.setAlpha(1);
        scene.tweens.add({
          targets: egg,
          angle: { from: -16, to: 16 },
          duration: 70,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            playSfx(scene, 'hatch');
            // Epic and legendary babies get a fanfare on top.
            if (rarityRank(rarityOf(monster)) >= 2) {
              scene.time.delayedCall(250, () => playSfx(scene, 'rare-hatch'));
            }
            const flash = scene.add.circle(cx, cy, 40, 0xffffff, 1);
            modal.panel.add(flash);
            scene.tweens.add({
              targets: flash,
              scale: 4,
              alpha: 0,
              duration: 450,
              onComplete: () => flash.destroy(),
            });
            egg.destroy();
            cracks.destroy();
            const view = new MonsterView(scene, cx, cy, monster, 140).setScale(0);
            modal.panel.add(view);
            scene.tweens.add({ targets: view, scale: 1, duration: 520, ease: 'Back.easeOut' });
            const y = this.addResultInfo(modal, mw, result, 218, extra);
            modal.panel.add(
              new Button(scene, cx, y + 26, {
                width: 160,
                height: 40,
                label: t('mixer.ok'),
                color: COLORS.good,
                onClick: () => modal.close(),
              }),
            );
          },
        });
      },
    });
  }
}
