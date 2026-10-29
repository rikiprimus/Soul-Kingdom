import type Phaser from 'phaser';
import {
  canBorrow,
  canHelp,
  eligibleParents,
  monsterName,
  type Monster,
} from '@soul-monster/shared';
import { errorText, t } from '../text';
import { COLORS, textStyle } from '../ui/theme';
import { Button, confirmDialog, Modal, roundedPanel, toast, inputDialog } from '../ui/widgets';
import { View } from './View';

interface Profile {
  id: string;
  code: string;
  name: string | null;
}

interface Friends {
  me: Profile;
  friends: Profile[];
  incoming: Profile[];
  outgoing: Profile[];
}

interface Visit {
  townHall: number;
  level: number;
  island?: string;
  buildings: { type: string; level: number; building: boolean }[];
  monsters: Monster[];
}

/** A player's name, or "Pemain" + the start of their code before they pick one. */
export const playerName = (p: Profile) =>
  p.name ?? t('friends.noName', { code: p.code.slice(0, 4) });

/**
 * Friends (Tugas 2.1): your code and name, adding friends by code (they accept), and
 * visiting a friend to help once a day or borrow a monster for the Soul Mixer.
 */
export class FriendsView extends View {
  private data: Friends | null = null;
  private user: { email?: string; provider?: string } | null = null;
  private status: 'loading' | 'ready' | 'offline' = 'loading';

  override render(): void {
    super.render();
    if (this.status === 'loading' && !this.data) void this.reload();
  }

  private async reload(): Promise<void> {
    const [answer, user] = await Promise.all([
      this.ctx.store.social({ kind: 'me' }),
      this.ctx.store.getUser(),
    ]);
    this.user = user;
    if (answer.ok) {
      this.data = answer as unknown as Friends;
      this.status = 'ready';
    } else {
      this.status = 'offline';
    }
    super.render();
  }

  /** Sends a request and shows its error, if any; `onDone` runs on success. */
  private async ask(request: object, onDone?: (answer: Record<string, unknown>) => void) {
    const answer = await this.ctx.store.social(request);
    if (!answer.ok) {
      toast(this.scene, errorText(answer.error ?? 'server'));
      return;
    }
    onDone?.(answer);
    await this.reload();
  }

  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const pad = 12;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    let y = 12;
    const line = (text: string, size = 13, color: number = COLORS.text) => {
      const label = scene.add.text(left, y, text, textStyle(size, color, { wordWrap: { width } }));
      content.add(label);
      y += label.height + 8;
    };
    if (this.status !== 'ready' || !this.data) {
      line(
        this.status === 'offline' ? t('friends.offline') : t('friends.loading'),
        14,
        COLORS.textDim,
      );
      return y + 40;
    }
    const { me, friends, incoming, outgoing } = this.data;

    // Me card with profile and code
    const cardH = 86;
    content.add(roundedPanel(scene, left, y, width, cardH, COLORS.panelDark, COLORS.stroke, 10));
    content.add(
      scene.add.text(
        left + 12,
        y + 10,
        t('friends.me', { name: playerName(me), code: me.code }),
        textStyle(14, COLORS.gold, { fontStyle: 'bold' }),
      ),
    );

    // Profile action buttons: Rename, Copy Code, Add Friend
    const btnW = Math.max(90, Math.floor((width - 32) / 3));
    content.add([
      new Button(scene, left + 12 + btnW / 2, y + 54, {
        width: btnW,
        height: 32,
        label: t('friends.rename'),
        fontSize: 12,
        color: COLORS.panelLight,
        onClick: () => {
          inputDialog(scene, {
            title: t('friends.rename'),
            placeholder: t('friends.enterName'),
            initialValue: me.name ?? '',
            maxLength: 16,
            onSubmit: (name) => {
              const trimmed = name.trim();
              if (trimmed) void this.ask({ kind: 'setName', name: trimmed });
            },
          });
        },
      }),
      new Button(scene, left + 16 + btnW + btnW / 2, y + 54, {
        width: btnW,
        height: 32,
        label: t('friends.copyCode'),
        fontSize: 12,
        color: COLORS.panelLight,
        onClick: () => {
          try {
            void navigator.clipboard?.writeText(me.code);
          } catch {
            // ignore
          }
          toast(scene, t('friends.codeCopied'), COLORS.good);
        },
      }),
      new Button(scene, left + 20 + btnW * 2 + btnW / 2, y + 54, {
        width: btnW,
        height: 32,
        label: t('friends.add'),
        fontSize: 12,
        color: 0x3c9a5f,
        onClick: () => {
          inputDialog(scene, {
            title: t('friends.add'),
            placeholder: t('friends.enterCode'),
            maxLength: 12,
            onSubmit: (rawCode) => {
              const code = rawCode.trim().toUpperCase();
              if (!code) return;
              void this.ask({ kind: 'request', code }, (a) =>
                toast(
                  scene,
                  a.befriended ? t('friends.befriended') : t('friends.sent'),
                  COLORS.good,
                ),
              );
            },
          });
        },
      }),
    ]);
    y += cardH + 10;

    // Google Account status / link card
    const accH = 46;
    content.add(roundedPanel(scene, left, y, width, accH, COLORS.panel, COLORS.stroke, 10));
    if (this.user?.email) {
      content.add(
        scene.add
          .text(
            left + 12,
            y + accH / 2,
            t('friends.googleLinked', { email: this.user.email }),
            textStyle(12, COLORS.good),
          )
          .setOrigin(0, 0.5),
      );
      const logoutBtnW = 90;
      content.add(
        new Button(scene, left + width - logoutBtnW / 2 - 8, y + accH / 2, {
          width: logoutBtnW,
          height: 30,
          label: t('auth.signOut'),
          fontSize: 11,
          color: COLORS.danger,
          onClick: () => {
            confirmDialog(scene, t('auth.logoutConfirm'), () => {
              this.ctx.store.signOut();
            });
          },
        }),
      );
    } else {
      content.add(
        scene.add
          .text(left + 12, y + accH / 2, t('friends.accountAnon'), textStyle(12, COLORS.textDim))
          .setOrigin(0, 0.5),
      );
      const googleBtnW = 140;
      content.add(
        new Button(scene, left + width - googleBtnW / 2 - 8, y + accH / 2, {
          width: googleBtnW,
          height: 30,
          label: t('friends.googleSignIn'),
          fontSize: 11,
          color: 0x4285f4,
          onClick: () => {
            this.ctx.store.signInWithGoogle();
          },
        }),
      );
    }
    y += accH + 14;

    const row = (p: Profile, buttons: [string, number, () => void][]) => {
      const h = 46;
      content.add(roundedPanel(scene, left, y, width, h, COLORS.panel, COLORS.stroke, 10));
      content.add(
        scene.add
          .text(left + 12, y + h / 2, `${playerName(p)}  ·  ${p.code}`, textStyle(13, COLORS.text))
          .setOrigin(0, 0.5),
      );
      buttons.forEach(([label, color, onClick], i) => {
        content.add(
          new Button(scene, left + width - 60 - i * 112, y + h / 2, {
            width: 104,
            height: 32,
            label,
            fontSize: 12,
            color,
            onClick,
          }),
        );
      });
      y += h + 6;
    };

    if (incoming.length > 0) {
      line(t('friends.incoming'), 13, COLORS.textDim);
      for (const p of incoming) {
        row(p, [
          [
            t('friends.accept'),
            0x3c9a5f,
            () => void this.ask({ kind: 'respond', fromId: p.id, accept: true }),
          ],
          [
            t('friends.decline'),
            COLORS.panelLight,
            () => void this.ask({ kind: 'respond', fromId: p.id, accept: false }),
          ],
        ]);
      }
      y += 6;
    }
    line(t('friends.list', { n: friends.length }), 13, COLORS.textDim);
    if (friends.length === 0) line(t('friends.none'), 12, COLORS.textDim);
    for (const p of friends)
      row(p, [[t('friends.visit'), COLORS.accent, () => void this.visit(p)]]);
    if (outgoing.length > 0) {
      y += 6;
      line(t('friends.outgoing'), 13, COLORS.textDim);
      for (const p of outgoing) row(p, []);
    }
    return y + 16;
  }

  /** A friend's base: what they have, help once a day, and adults to borrow for a mix. */
  private async visit(friend: Profile): Promise<void> {
    const answer = await this.ctx.store.social({ kind: 'visit', friendId: friend.id });
    if (!answer.ok) {
      toast(this.scene, errorText(answer.error ?? 'server'));
      return;
    }
    const v = answer as unknown as Visit;
    const { scene } = this;
    const store = this.ctx.store;
    const mw = Math.min(scene.scale.width - 32, 460);
    const modal = new Modal(scene, {
      width: mw,
      height: 340,
      title: playerName(friend),
      dismissible: true,
    });
    const building = v.buildings.filter((b) => b.building).length;
    modal.panel.add(
      scene.add
        .text(
          mw / 2,
          50,
          t('friends.visitInfo', {
            hall: v.townHall,
            level: v.level,
            count: v.buildings.length,
            building,
          }),
          textStyle(13, COLORS.textDim, { align: 'center', wordWrap: { width: mw - 32 } }),
        )
        .setOrigin(0.5, 0),
    );
    const helped = !canHelp(store.state, friend.id, store.now());
    modal.panel.add(
      new Button(scene, mw / 2, 104, {
        width: mw - 40,
        height: 38,
        label: helped ? t('friends.helped') : t('friends.help'),
        color: helped ? COLORS.disabled : 0x3c9a5f,
        onClick: () => {
          if (helped) return;
          modal.close();
          void this.ask({ kind: 'help', friendId: friend.id }, (a) =>
            toast(
              scene,
              a.spedUp ? t('friends.helpBuild') : t('friends.helpGold'),
              COLORS.good,
              'coin',
            ),
          );
        },
      }),
    );
    const borrowLeft = canBorrow(store.state, store.now());
    modal.panel.add(
      scene.add
        .text(
          mw / 2,
          136,
          v.monsters.length === 0
            ? t('friends.noAdults')
            : borrowLeft
              ? t('friends.borrowHint')
              : t('friends.borrowUsed'),
          textStyle(12, COLORS.textDim, { align: 'center', wordWrap: { width: mw - 32 } }),
        )
        .setOrigin(0.5, 0),
    );
    v.monsters.slice(0, 4).forEach((m, i) => {
      const bw = (mw - 40 - 8) / 2;
      modal.panel.add(
        new Button(scene, 20 + bw / 2 + (i % 2) * (bw + 8), 186 + Math.floor(i / 2) * 44, {
          width: bw,
          height: 36,
          label: monsterName(m),
          fontSize: 12,
          color: borrowLeft ? COLORS.accent : COLORS.disabled,
          onClick: () => {
            if (!borrowLeft) return;
            modal.close();
            this.pickPartner(m);
          },
        }),
      );
    });
  }

  /** Chooses one of your adults to mix with the borrowed monster, then starts the mix. */
  private pickPartner(borrowed: Monster): void {
    const { scene } = this;
    const mine = eligibleParents(this.state);
    if (mine.length === 0) {
      toast(scene, t('friends.noOwnAdult'));
      return;
    }
    const mw = Math.min(scene.scale.width - 32, 420);
    const shown = mine.slice(0, 6);
    const modal = new Modal(scene, {
      width: mw,
      height: 90 + Math.ceil(shown.length / 2) * 44,
      title: t('friends.mixWith', { name: monsterName(borrowed) }),
      dismissible: true,
    });
    const bw = (mw - 40 - 8) / 2;
    shown.forEach((m, i) => {
      modal.panel.add(
        new Button(scene, 20 + bw / 2 + (i % 2) * (bw + 8), 70 + Math.floor(i / 2) * 44, {
          width: bw,
          height: 36,
          label: monsterName(m),
          fontSize: 12,
          color: COLORS.accent,
          onClick: () => {
            modal.close();
            const r = this.run('startMix', { parentAId: m.id, parentBId: '', borrowed });
            if (r) toast(scene, t('mixer.started'), COLORS.good, 'mixer');
          },
        }),
      );
    });
  }
}
