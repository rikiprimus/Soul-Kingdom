import Phaser from 'phaser';
import {
  elementUnits,
  setProgress,
  gameData,
  monsterName,
  parseMonsterKey,
  pediaProgress,
  rarityOf,
  type Element,
  type Form,
  type PediaProgress,
} from '@soul-monster/shared';
import { MonsterView } from '../art/MonsterView';
import { ART_RES, elementIconTexture } from '../art/monsterArt';
import { unitColor } from '../art/palette';
import { t } from '../text';
import { lastStageId } from '../ui/MonsterCard';
import { COLORS, RARITY_COLORS, textStyle } from '../ui/theme';
import { prizeLabel } from '../ui/cost';
import {
  Button,
  Modal,
  darken,
  deferClick,
  pointerState,
  roundedPanel,
  toast,
} from '../ui/widgets';
import { GAP, gridColumns } from './CollectionView';
import { View } from './View';

type Tab = 'elements' | 'forms' | 'recipes' | 'sets';
let tab: Tab = 'elements';

export class PediaView extends View {
  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const pad = 12;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    const d = pediaProgress(this.state.pedia);

    let y = 12;
    const ratio = d.ratio;
    content.add(
      scene.add.text(
        left,
        y,
        t('pedia.progress', { percent: Math.floor(ratio * 100), found: d.found, total: d.total }),
        textStyle(13, COLORS.textDim),
      ),
    );
    y += 22;
    const bar = scene.add.graphics();
    bar.fillStyle(COLORS.panelDark).fillRoundedRect(left, y, width, 10, 5);
    bar.fillStyle(COLORS.gold).fillRoundedRect(left, y, Math.max(10, width * ratio), 10, 5);
    content.add(bar);
    y += 24;

    const tabs: [Tab, string][] = [
      ['elements', t('pedia.tabElements', { found: d.elements.size, total: d.elementCount })],
      ['forms', t('pedia.tabForms', { found: d.forms.size, total: d.formCount })],
      ['recipes', t('pedia.tabRecipes', { found: d.recipes.size, total: d.recipeCount })],
      [
        'sets',
        t('pedia.tabSets', {
          found: this.state.collections.length,
          total: gameData.collections.sets.length,
        }),
      ],
    ];
    const tw = (width - GAP * (tabs.length - 1)) / tabs.length;
    tabs.forEach(([id, label], i) => {
      content.add(
        new Button(scene, left + i * (tw + GAP) + tw / 2, y + 17, {
          width: tw,
          height: 34,
          label,
          fontSize: 12,
          color: id === tab ? COLORS.accent : COLORS.panelLight,
          onClick: () => {
            tab = id;
            this.render();
          },
        }),
      );
    });
    y += 48;

    if (tab === 'elements') return this.buildElements(content, d, left, y, width);
    if (tab === 'forms') return this.buildForms(content, d, left, y, width);
    if (tab === 'sets') return this.buildSets(content, left, y, width);
    return this.buildRecipes(content, d, left, y, width);
  }

  private tapZone(w: number, h: number, onClick: () => void) {
    const zone = this.scene.add
      .zone(0, 0, w, h)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      if (!pointerState.dragMoved) deferClick(this.scene, onClick);
    });
    return zone;
  }

  private buildElements(
    content: Phaser.GameObjects.Container,
    d: PediaProgress,
    left: number,
    y: number,
    width: number,
  ) {
    const { scene } = this;
    const { cols, cardW } = gridColumns(width, 76, 4);
    const tileH = 88;
    gameData.elements.elements.forEach((el, i) => {
      const found = d.elements.has(el.id);
      const tile = scene.add.container(
        left + (i % cols) * (cardW + GAP),
        y + Math.floor(i / cols) * (tileH + GAP),
      );
      tile.add(
        roundedPanel(
          scene,
          0,
          0,
          cardW,
          tileH,
          found ? COLORS.panel : COLORS.panelDark,
          found ? COLORS.stroke : null,
          10,
        ),
      );
      if (found) {
        tile.add(
          scene.add
            .image(cardW / 2, 34, elementIconTexture(scene, el.id, 44))
            .setScale(1 / ART_RES),
        );
        tile.add(
          scene.add
            .text(cardW / 2, 70, el.name, textStyle(11, COLORS.text, { fontStyle: 'bold' }))
            .setOrigin(0.5),
        );
        tile.add(this.tapZone(cardW, tileH, () => this.showElement(el, d)));
      } else {
        tile.add(scene.add.circle(cardW / 2, 34, 18, 0x0c0818).setStrokeStyle(2, COLORS.stroke));
        tile.add(
          scene.add
            .text(cardW / 2, 34, '?', textStyle(16, COLORS.textDim, { fontStyle: 'bold' }))
            .setOrigin(0.5),
        );
        tile.add(
          scene.add
            .text(cardW / 2, 70, t('pedia.unknown'), textStyle(11, COLORS.textDim))
            .setOrigin(0.5),
        );
      }
      content.add(tile);
    });
    return y + Math.ceil(gameData.elements.elements.length / cols) * (tileH + GAP) + 16;
  }

  private buildForms(
    content: Phaser.GameObjects.Container,
    d: PediaProgress,
    left: number,
    y: number,
    width: number,
  ) {
    const { scene } = this;
    const { cols, cardW } = gridColumns(width, 100, 3);
    const tileH = 128;
    gameData.forms.forms.forEach((form, i) => {
      const found = d.forms.has(form.id);
      const tile = scene.add.container(
        left + (i % cols) * (cardW + GAP),
        y + Math.floor(i / cols) * (tileH + GAP),
      );
      tile.add(
        roundedPanel(
          scene,
          0,
          0,
          cardW,
          tileH,
          found ? COLORS.panel : COLORS.panelDark,
          found ? COLORS.stroke : null,
          10,
        ),
      );
      // Show the form in the first element it was found with; silhouettes use a neutral one.
      const element = d.kinds.find((k) => k.form === form.id)?.element ?? gameData.baseUnits[0]!;
      const art = Math.min(76, cardW - 16);
      tile.add(
        new MonsterView(
          scene,
          cardW / 2,
          8 + art / 2,
          { form: form.id, element, stage: lastStageId() },
          art,
          {
            effects: false,
            silhouette: !found,
          },
        ),
      );
      tile.add(
        scene.add
          .text(
            cardW / 2,
            tileH - 30,
            found ? form.name : t('pedia.unknown'),
            textStyle(12, found ? COLORS.text : COLORS.textDim, { fontStyle: 'bold' }),
          )
          .setOrigin(0.5),
      );
      tile.add(
        scene.add
          .text(
            cardW / 2,
            tileH - 13,
            t('monster.tier', { tier: form.tier }),
            textStyle(10, COLORS.textDim),
          )
          .setOrigin(0.5),
      );
      if (found) tile.add(this.tapZone(cardW, tileH, () => this.showForm(form, d)));
      content.add(tile);
    });
    return y + Math.ceil(gameData.forms.forms.length / cols) * (tileH + GAP) + 16;
  }

  private buildRecipes(
    content: Phaser.GameObjects.Container,
    d: PediaProgress,
    left: number,
    y: number,
    width: number,
  ) {
    const { scene } = this;
    const rowH = 64;
    const name = (spec: string) => monsterName(parseMonsterKey(spec));
    for (const recipe of gameData.recipes.monsterRecipes) {
      const found = d.recipes.has(recipe.id);
      const row = scene.add.container(left, y);
      row.add(
        roundedPanel(
          scene,
          0,
          0,
          width,
          rowH,
          found ? COLORS.panel : COLORS.panelDark,
          found ? COLORS.gold : null,
          10,
        ),
      );
      const line1 = found
        ? `${name(recipe.parents[0])} + ${name(recipe.parents[1])}`
        : `${t('pedia.unknown')} + ${t('pedia.unknown')}`;
      const line2 = found ? `→ ${name(recipe.result)}` : t('pedia.recipeHidden');
      const resultKind = parseMonsterKey(recipe.result);
      row.add(
        scene.add.text(
          14,
          12,
          line1,
          textStyle(12, COLORS.textDim, { wordWrap: { width: width - 28 } }),
        ),
      );
      row.add(
        scene.add.text(
          14,
          36,
          line2,
          textStyle(14, found ? RARITY_COLORS[rarityOf(resultKind)] : COLORS.textDim, {
            fontStyle: 'bold',
          }),
        ),
      );
      content.add(row);
      y += rowH + GAP;
    }
    return y + 16;
  }

  /** Collection sets: what each needs, found so far, and its prize (claimed once). */
  private buildSets(content: Phaser.GameObjects.Container, left: number, y: number, width: number) {
    const { scene } = this;
    for (const set of gameData.collections.sets) {
      const p = setProgress(this.state, set);
      const ready = p.complete && !p.claimed;
      const row = scene.add.container(left, y);
      const items = p.items
        .map((i) =>
          i.found
            ? i.kind === 'form'
              ? gameData.formById.get(i.id)!.name
              : gameData.elementById.get(i.id)!.name
            : t('pedia.unknown'),
        )
        .join(' · ');
      const texts = [
        scene.add.text(
          14,
          10,
          t('set.title', { name: set.name, found: p.found, total: p.items.length }),
          textStyle(14, p.claimed ? COLORS.good : COLORS.text, { fontStyle: 'bold' }),
        ),
        scene.add.text(
          14,
          32,
          items,
          textStyle(11, COLORS.textDim, { wordWrap: { width: width - 150 } }),
        ),
      ];
      const itemsBottom = 32 + texts[1]!.height;
      texts.push(
        scene.add.text(
          14,
          itemsBottom + 6,
          t('set.reward', { reward: prizeLabel(set.reward) }),
          textStyle(11, COLORS.gold, { wordWrap: { width: width - 150 } }),
        ),
      );
      const rowH = Math.max(72, itemsBottom + 6 + texts[2]!.height + 10);
      row.add(
        roundedPanel(
          scene,
          0,
          0,
          width,
          rowH,
          ready ? COLORS.panel : COLORS.panelDark,
          ready ? COLORS.gold : null,
          10,
        ),
      );
      row.add(texts);
      if (p.claimed) {
        row.add(
          scene.add
            .text(
              width - 70,
              rowH / 2,
              t('set.claimed'),
              textStyle(12, COLORS.good, { fontStyle: 'bold' }),
            )
            .setOrigin(0.5),
        );
      } else {
        row.add(
          new Button(scene, width - 70, rowH / 2, {
            width: 120,
            height: 34,
            label: t('set.claim'),
            fontSize: 12,
            color: ready ? COLORS.good : COLORS.disabled,
            onClick: () => {
              const r = this.run('claimSet', { id: set.id });
              if (!r) return;
              toast(
                scene,
                t('set.claimedToast', { name: set.name, reward: prizeLabel(r.reward) }),
                COLORS.good,
                'win',
              );
              if (r.reward.wonder && !r.wonder)
                toast(scene, t('set.wonderOwned'), COLORS.warn, null, 48);
            },
          }),
        );
      }
      content.add(row);
      y += rowH + GAP;
    }
    return y + 16;
  }

  private showElement(el: Element, d: PediaProgress) {
    const { scene } = this;
    const { width: W } = scene.scale;
    const mw = Math.min(W - 32, 360);
    const owners = d.kinds
      .filter((k) => k.element === el.id)
      .map((k) => gameData.formById.get(k.form)?.name ?? k.form);
    const modal = new Modal(scene, { width: mw, height: 440, title: el.name, dismissible: true });
    const p = modal.panel;
    p.add(scene.add.image(mw / 2, 82, elementIconTexture(scene, el.id, 64)).setScale(1 / ART_RES));
    const units = elementUnits(el.id);
    p.add(
      scene.add
        .text(
          mw / 2,
          124,
          `${t('pedia.units', { count: units.length })}${el.secret ? ` · ${t('pedia.secret')}` : ''}`,
          textStyle(13, el.secret ? COLORS.gold : COLORS.textDim, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5),
    );
    p.add(
      scene.add
        .text(mw / 2, 152, t('pedia.composition'), textStyle(12, COLORS.textDim))
        .setOrigin(0.5),
    );
    // Six unit dots in a hexagon; lit for the units in the composition.
    const cx = mw / 2;
    const cy = 240;
    gameData.baseUnits.forEach((unit, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / gameData.baseUnits.length;
      const x = cx + Math.cos(angle) * 54;
      const y = cy + Math.sin(angle) * 54;
      const lit = units.includes(unit);
      const color = unitColor(unit);
      p.add(
        scene.add
          .circle(x, y, 15, lit ? color : darken(color, 0.8))
          .setStrokeStyle(2, lit ? 0xffffff : COLORS.stroke),
      );
      p.add(
        scene.add
          .text(
            x,
            y + 23,
            gameData.elementById.get(unit)?.name ?? unit,
            textStyle(10, lit ? COLORS.text : COLORS.textDim),
          )
          .setOrigin(0.5),
      );
    });
    p.add(
      scene.add
        .text(
          mw / 2,
          336,
          `${t('pedia.discoveredWith')} ${owners.join(', ')}`,
          textStyle(11, COLORS.textDim, { align: 'center', wordWrap: { width: mw - 32 } }),
        )
        .setOrigin(0.5, 0),
    );
    p.add(
      new Button(scene, mw / 2, 406, {
        width: 130,
        height: 36,
        label: t('pedia.close'),
        color: COLORS.panelLight,
        onClick: () => modal.close(),
      }),
    );
  }

  private showForm(form: Form, d: PediaProgress) {
    const { scene } = this;
    const { width: W } = scene.scale;
    const mw = Math.min(W - 32, 360);
    const kinds = d.kinds.filter((k) => k.form === form.id);
    const modal = new Modal(scene, { width: mw, height: 360, title: form.name, dismissible: true });
    const p = modal.panel;
    const element = kinds[0]?.element ?? gameData.baseUnits[0]!;
    p.add(
      new MonsterView(scene, mw / 2, 120, { form: form.id, element, stage: lastStageId() }, 130),
    );
    const tier = gameData.forms.tiers[String(form.tier)];
    const role = gameData.forms.roles[form.role];
    p.add(
      scene.add
        .text(
          mw / 2,
          196,
          `${t('monster.tier', { tier: form.tier })} · ${tier?.name ?? ''} · ${role?.name ?? form.role}`,
          textStyle(12, COLORS.textDim, { align: 'center', wordWrap: { width: mw - 24 } }),
        )
        .setOrigin(0.5, 0),
    );
    const names = kinds
      .map((k) => gameData.elementById.get(k.element)?.name ?? k.element)
      .join(', ');
    p.add(
      scene.add
        .text(
          mw / 2,
          236,
          `${t('pedia.discoveredWith')} ${names}`,
          textStyle(11, COLORS.text, { align: 'center', wordWrap: { width: mw - 32 } }),
        )
        .setOrigin(0.5, 0),
    );
    p.add(
      new Button(scene, mw / 2, 328, {
        width: 130,
        height: 36,
        label: t('pedia.close'),
        color: COLORS.panelLight,
        onClick: () => modal.close(),
      }),
    );
  }
}
