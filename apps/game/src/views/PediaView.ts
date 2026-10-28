import Phaser from 'phaser';
import {
  elementUnits,
  gameData,
  pediaProgress,
  rarityOf,
  setProgress,
  type Element,
  type MonsterDef,
  type PediaProgress,
} from '@soul-monster/shared';
import { MonsterView } from '../art/MonsterView';
import { ART_RES, elementIconTexture } from '../art/monsterArt';
import { elementColor, unitColor } from '../art/palette';
import { t } from '../text';
import { drawCardFrame } from '../ui/MonsterCard';
import { prizeLabel } from '../ui/cost';
import { COLORS, TIER_COLORS, textStyle } from '../ui/theme';
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

type Tab = 'monsters' | 'elements' | 'recipes' | 'sets';
let tab: Tab = 'monsters';
let filterTier: number | 'all' = 'all';
let filterElement: string | 'all' = 'all';

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
      ['monsters', t('pedia.tabMonsters', { found: d.speciesCount, total: d.monsterCount })],
      ['elements', t('pedia.tabElements', { found: d.elements.size, total: d.elementCount })],
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
          fontSize: 11.5,
          color: id === tab ? COLORS.accent : COLORS.panelLight,
          onClick: () => {
            tab = id;
            this.render();
          },
        }),
      );
    });
    y += 48;

    if (tab === 'monsters') return this.buildMonsters(content, d, left, y, width);
    if (tab === 'elements') return this.buildElements(content, d, left, y, width);
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

  private buildMonsters(
    content: Phaser.GameObjects.Container,
    d: PediaProgress,
    left: number,
    y: number,
    width: number,
  ) {
    const { scene } = this;

    // 1. Filter Tier Buttons (Semua, T1..T8)
    const tierFilters: Array<number | 'all'> = ['all', 1, 2, 3, 4, 5, 6, 7, 8];
    const tfw = Math.floor((width - (tierFilters.length - 1) * 4) / tierFilters.length);
    tierFilters.forEach((tf, i) => {
      const active = filterTier === tf;
      const label = tf === 'all' ? 'Semua' : `T${tf}`;
      const btnColor = active
        ? typeof tf === 'number'
          ? (TIER_COLORS[tf] ?? COLORS.gold)
          : COLORS.accent
        : COLORS.panelDark;
      content.add(
        new Button(scene, left + i * (tfw + 4) + tfw / 2, y + 13, {
          width: tfw,
          height: 26,
          label,
          fontSize: 10,
          color: btnColor,
          onClick: () => {
            filterTier = tf;
            this.render();
          },
        }),
      );
    });
    y += 32;

    // 2. Filter Element Buttons (Semua + 13 elements in 2 rows of 7)
    const allElements = ['all', ...gameData.elements.elements.map((e) => e.id)];
    const row1 = allElements.slice(0, 7);
    const row2 = allElements.slice(7);
    const efw = Math.floor((width - 6 * 4) / 7);

    [row1, row2].forEach((rowList) => {
      rowList.forEach((elId, i) => {
        const active = filterElement === elId;
        const name = elId === 'all' ? 'Semua' : (gameData.elementById.get(elId)?.name ?? elId);
        const btnColor = active
          ? elId === 'all'
            ? COLORS.accent
            : elementColor(elId)
          : COLORS.panelDark;
        content.add(
          new Button(scene, left + i * (efw + 4) + efw / 2, y + 12, {
            width: efw,
            height: 24,
            label: name,
            fontSize: 9,
            color: btnColor,
            onClick: () => {
              filterElement = elId;
              this.render();
            },
          }),
        );
      });
      y += 28;
    });
    y += 8;

    // 3. Grid of Monsters
    let list = gameData.monsters.monsters;
    if (filterTier !== 'all') {
      list = list.filter((m) => m.tier === filterTier);
    }
    if (filterElement !== 'all') {
      list = list.filter((m) => m.element === filterElement);
    }

    const { cols, cardW } = gridColumns(width, 100, 3);
    const tileH = 146;

    list.forEach((m, i) => {
      const found = d.discoveredSpecies.has(m.id) || this.state.pedia.monsters.includes(m.id);
      const tile = scene.add.container(
        left + (i % cols) * (cardW + GAP),
        y + Math.floor(i / cols) * (tileH + GAP),
      );

      const frame = scene.add.graphics();
      drawCardFrame(frame, cardW, tileH, rarityOf({ species: m.id }), false, m.tier);
      tile.add(frame);

      const art = Math.min(76, cardW - 14);
      tile.add(
        new MonsterView(
          scene,
          cardW / 2,
          10 + art / 2,
          { species: m.id, element: m.element, stage: 'dewasa' },
          art,
          {
            effects: found,
            silhouette: !found,
          },
        ),
      );

      tile.add(
        scene.add
          .text(
            cardW / 2,
            tileH - 38,
            found ? m.name : '???',
            textStyle(11, found ? COLORS.text : COLORS.textDim, {
              fontStyle: 'bold',
              align: 'center',
              wordWrap: { width: cardW - 10 },
            }),
          )
          .setOrigin(0.5, 0),
      );

      const subText = found
        ? `T${m.tier} · ${gameData.elementById.get(m.element)?.name ?? m.element} · ${m.role}`
        : `Tingkat ${m.tier}`;
      tile.add(
        scene.add
          .text(
            cardW / 2,
            tileH - 18,
            subText,
            textStyle(9.5, COLORS.textDim, { align: 'center', wordWrap: { width: cardW - 8 } }),
          )
          .setOrigin(0.5, 0),
      );

      tile.add(this.tapZone(cardW, tileH, () => this.showMonsterModal(m, found)));
      content.add(tile);
    });

    return y + Math.ceil(list.length / cols) * (tileH + GAP) + 20;
  }

  private showMonsterModal(m: MonsterDef, found: boolean) {
    const { scene } = this;
    const { width: W, height: H } = scene.scale;
    const mw = Math.min(W - 24, 400);
    const mh = Math.min(H - 40, 520);
    const modal = new Modal(scene, {
      width: mw,
      height: mh,
      title: found ? m.name : '???',
      dismissible: true,
    });
    const p = modal.panel;

    p.add(
      new MonsterView(
        scene,
        mw / 2,
        96,
        { species: m.id, element: m.element, stage: 'dewasa' },
        110,
        { effects: found, silhouette: !found },
      ),
    );

    let my = 165;
    const tierName = gameData.rules.tiers?.[String(m.tier)]?.name ?? `Tier ${m.tier}`;
    const elName = gameData.elementById.get(m.element)?.name ?? m.element;
    const headerStr = found
      ? `Tingkat ${m.tier} (${tierName}) · ${elName} · Peran: ${m.role}`
      : `Tingkat ${m.tier} (${tierName}) · ${elName}`;

    p.add(
      scene.add
        .text(
          mw / 2,
          my,
          headerStr,
          textStyle(12, found ? (TIER_COLORS[m.tier] ?? COLORS.gold) : COLORS.textDim, {
            fontStyle: 'bold',
            align: 'center',
          }),
        )
        .setOrigin(0.5, 0),
    );
    my += 26;

    const descText = found
      ? m.description
      : 'Monster ini belum ditemukan. Jelajahi wilayah liar, selesaikan ekspedisi, atau silangkan monster di Altar untuk menemukannya!';

    const descObj = scene.add
      .text(
        mw / 2,
        my,
        descText,
        textStyle(12, COLORS.text, {
          align: 'center',
          lineSpacing: 4,
          wordWrap: { width: mw - 36 },
        }),
      )
      .setOrigin(0.5, 0);
    p.add(descObj);
    my += descObj.height + 16;

    const sourcesStr = m.sources && m.sources.length > 0 ? m.sources.join(', ') : 'Belum diketahui';
    const srcObj = scene.add
      .text(
        mw / 2,
        my,
        `Cara Mendapatkan:\n${sourcesStr}`,
        textStyle(11, COLORS.accent, {
          align: 'center',
          lineSpacing: 3,
          wordWrap: { width: mw - 36 },
        }),
      )
      .setOrigin(0.5, 0);
    p.add(srcObj);
    my += srcObj.height + 14;

    let recipeStr = 'Resep Altar: Tidak dapat disilangkan di Altar';
    let recipeColor: number = COLORS.textDim;
    if (m.recipe) {
      const recipeDiscovered = this.state.pedia.recipes.includes(m.id);
      if (recipeDiscovered) {
        const pA = gameData.monsterById.get(m.recipe.parentA)?.name ?? m.recipe.parentA;
        const pB = gameData.monsterById.get(m.recipe.parentB)?.name ?? m.recipe.parentB;
        recipeStr = `Resep Altar:\n${pA} + ${pB}`;
        recipeColor = COLORS.gold;
      } else {
        recipeStr = 'Resep Altar:\nTersedia di Altar (Resep belum ditemukan)';
        recipeColor = COLORS.warn;
      }
    }
    const recObj = scene.add
      .text(
        mw / 2,
        my,
        recipeStr,
        textStyle(11, recipeColor, {
          align: 'center',
          fontStyle: 'bold',
          lineSpacing: 3,
          wordWrap: { width: mw - 36 },
        }),
      )
      .setOrigin(0.5, 0);
    p.add(recObj);

    p.add(
      new Button(scene, mw / 2, mh - 30, {
        width: 120,
        height: 36,
        label: t('pedia.close'),
        color: COLORS.panelLight,
        onClick: () => modal.close(),
      }),
    );
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

  private buildRecipes(
    content: Phaser.GameObjects.Container,
    d: PediaProgress,
    left: number,
    y: number,
    width: number,
  ) {
    const { scene } = this;
    const rowH = 64;
    const recipes = gameData.monsters.monsters.filter((m) => m.recipe !== null);

    for (const monster of recipes) {
      const recipe = monster.recipe!;
      const found = d.recipes.has(monster.id) || this.state.pedia.recipes.includes(monster.id);
      const row = scene.add.container(left, y);
      row.add(
        roundedPanel(
          scene,
          0,
          0,
          width,
          rowH,
          found ? COLORS.panel : COLORS.panelDark,
          found ? (TIER_COLORS[monster.tier] ?? COLORS.gold) : null,
          10,
        ),
      );

      const pA = gameData.monsterById.get(recipe.parentA)?.name ?? recipe.parentA;
      const pB = gameData.monsterById.get(recipe.parentB)?.name ?? recipe.parentB;

      const line1 = found ? `${pA} + ${pB}` : `${t('pedia.unknown')} + ${t('pedia.unknown')}`;
      const line2 = found
        ? `→ ${monster.name} (Tingkat ${monster.tier} · ${gameData.elementById.get(monster.element)?.name ?? monster.element})`
        : t('pedia.recipeHidden');

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
          textStyle(13, found ? (TIER_COLORS[monster.tier] ?? COLORS.gold) : COLORS.textDim, {
            fontStyle: 'bold',
          }),
        ),
      );

      row.add(
        this.tapZone(width, rowH, () =>
          this.showMonsterModal(monster, this.state.pedia.monsters.includes(monster.id)),
        ),
      );
      content.add(row);
      y += rowH + GAP;
    }
    return y + 16;
  }

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
              ? (gameData.formById.get(i.id)?.name ?? i.id)
              : (gameData.elementById.get(i.id)?.name ?? i.id)
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
    const owners = Array.from(d.discoveredSpecies)
      .map((id) => gameData.monsterById.get(id))
      .filter((m) => m?.element === el.id)
      .map((m) => m!.name);

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
          owners.length > 0
            ? `${t('pedia.discoveredWith')} ${owners.join(', ')}`
            : 'Belum ada monster elemen ini yang ditemukan',
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
}
