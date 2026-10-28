import type Phaser from 'phaser';
import {
  calculateArenaTeamPower,
  claimableArenaSeason,
  gameData,
  getArenaTier,
  getSeasonWeek,
  matchmakeArenaOpponents,
  monsterElement,
  monsterName,
  monsterStats,
  seasonSecondsRemaining,
  settleArena,
  type ArenaBattleResult,
  type ArenaSnapshot,
} from '@soul-monster/shared';
import { playSfx } from '../audio/sound';
import { errorText, formatDuration, formatNumber, t } from '../text';
import { COLORS, textStyle } from '../ui/theme';
import { Button, roundedPanel, toast } from '../ui/widgets';
import { View } from './View';

type ArenaTab = 'duel' | 'team' | 'leaderboard' | 'history';
/** What the result modal shows of a duel (a fresh one or one from the history). */
type DuelOutcome = Pick<ArenaBattleResult, 'won' | 'pointsDelta' | 'reward'>;
const { teamSize: TEAM_SIZE, opponentsOffered: OFFERED } = gameData.rules.arena;

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  level: number;
  power: number;
  points: number;
  tier: string;
}

export class ArenaView extends View {
  private tab: ArenaTab = 'duel';
  private opponents: ArenaSnapshot[] = [];
  private loadingOpponents = false;
  private leaderboard: LeaderboardEntry[] = [];
  private loadingLeaderboard = false;

  // Active replay overlay
  private replayOverlay: Phaser.GameObjects.Container | null = null;
  private replayTimer: Phaser.Time.TimerEvent | null = null;

  protected build(content: Phaser.GameObjects.Container): number {
    const { scene } = this;
    const now = this.ctx.store.now();
    const state = settleArena(this.state, now);

    const pad = 12;
    const width = this.width - pad * 2;
    const left = this.left + pad;
    let y = 10;

    // Header with current tier badge and points
    const tier = getArenaTier(state.arena.points);
    const titleText = scene.add.text(
      left,
      y,
      `⚔️ ${t('arena.title')}`,
      textStyle(20, COLORS.gold, { fontStyle: 'bold' }),
    );
    content.add(titleText);

    const badgeX = left + titleText.width + 12;
    const badgeText = scene.add.text(
      badgeX + 8,
      y + 3,
      tier.name,
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
    badgeBg.setStrokeStyle(1.5, COLORS.accent, 0.8);
    content.add([badgeBg, badgeText]);

    y += 26;

    // Subtitle & season week info
    const currentWeek = getSeasonWeek(now);
    const endsIn = seasonSecondsRemaining(now);
    const seasonInfo = `${t('arena.seasonWeek', { week: currentWeek + 1 })} · ${t('arena.seasonEndsIn', { time: formatDuration(endsIn) })}`;
    content.add(scene.add.text(left, y, seasonInfo, textStyle(12, COLORS.textDim)));

    y += 20;

    // Navigation Tabs
    const tabs: [ArenaTab, string][] = [
      ['duel', t('arena.tabDuel')],
      ['team', t('arena.tabTeam')],
      ['leaderboard', t('arena.tabLeaderboard')],
      ['history', t('arena.tabHistory')],
    ];

    const tabGap = 8;
    const tabW = Math.floor((width - (tabs.length - 1) * tabGap) / tabs.length);
    tabs.forEach(([id, label], i) => {
      const tx = left + i * (tabW + tabGap) + tabW / 2;
      const isActive = id === this.tab;
      const btn = new Button(scene, tx, y + 16, {
        width: tabW,
        height: 32,
        label,
        fontSize: 12,
        color: isActive ? COLORS.accent : COLORS.panelLight,
        onClick: () => {
          if (this.tab !== id) {
            playSfx(scene, 'click');
            this.tab = id;
            this.render();
          }
        },
      });
      content.add(btn);
    });

    y += 42;

    // Render active tab content
    switch (this.tab) {
      case 'duel':
        y = this.buildDuelTab(content, left, y, width, now);
        break;
      case 'team':
        y = this.buildTeamTab(content, left, y, width);
        break;
      case 'leaderboard':
        y = this.buildLeaderboardTab(content, left, y, width, now);
        break;
      case 'history':
        y = this.buildHistoryTab(content, left, y, width);
        break;
    }

    return y + 20;
  }

  // ==========================================
  // TAB 1: DUEL
  // ==========================================
  private buildDuelTab(
    content: Phaser.GameObjects.Container,
    left: number,
    y: number,
    width: number,
    now: number,
  ): number {
    const { scene } = this;
    const state = settleArena(this.state, now);
    const arena = state.arena;
    const tier = getArenaTier(arena.points);

    // Profile metric strip (Points, Tickets, Team Power, Claim Reward)
    const cardH = 68;
    const bg = roundedPanel(scene, left, y, width, cardH, COLORS.panelDark, COLORS.stroke);
    content.add(bg);

    // Metric 1: Rating & Tier
    const p1X = left + 14;
    content.add(scene.add.text(p1X, y + 12, t('arena.tabDuel'), textStyle(11, COLORS.textDim)));
    content.add(
      scene.add.text(
        p1X,
        y + 30,
        `${arena.points} Poin`,
        textStyle(17, COLORS.gold, { fontStyle: 'bold' }),
      ),
    );

    // Metric 2: Daily Tickets
    const p2X = left + Math.floor(width * 0.32);
    const maxTickets = gameData.rules.arena.dailyTickets;
    content.add(scene.add.text(p2X, y + 12, 'Tiket Duel Harian', textStyle(11, COLORS.textDim)));
    const ticketColor = arena.tickets > 0 ? COLORS.good : COLORS.danger;
    content.add(
      scene.add.text(
        p2X,
        y + 30,
        `🎟️ ${arena.tickets} / ${maxTickets}`,
        textStyle(17, ticketColor, { fontStyle: 'bold' }),
      ),
    );

    // Metric 3: Claim Weekly Reward Button
    const p3X = left + width - 110;
    const canClaim = claimableArenaSeason(state, now) !== null;

    if (canClaim) {
      const claimBtn = new Button(scene, p3X, y + 34, {
        width: 170,
        height: 36,
        label: `🎁 ${t('arena.claimReward')}`,
        fontSize: 12,
        color: COLORS.good,
        onClick: () => {
          const res = this.run('claimArenaSeasonReward', {});
          if (res) {
            toast(scene, t('arena.rewardClaimed'), COLORS.good);
            this.render();
          }
        },
      });
      content.add(claimBtn);
    } else {
      content.add(
        scene.add
          .text(
            left + width - 20,
            y + 34,
            tier.name,
            textStyle(13, COLORS.accentDark, { fontStyle: 'bold' }),
          )
          .setOrigin(1, 0.5),
      );
    }

    y += cardH + 16;

    // Check if team is configured
    if (arena.team.length < TEAM_SIZE) {
      const warnBox = roundedPanel(scene, left, y, width, 52, COLORS.panelDark, COLORS.warn);
      const warnText = scene.add.text(
        left + 16,
        y + 16,
        `⚠️ ${t('arena.needTeam')}`,
        textStyle(13, COLORS.warn, { fontStyle: 'bold' }),
      );
      const setTeamBtn = new Button(scene, left + width - 80, y + 26, {
        width: 120,
        height: 32,
        label: t('arena.tabTeam'),
        fontSize: 12,
        color: COLORS.accent,
        onClick: () => {
          this.tab = 'team';
          this.render();
        },
      });
      content.add([warnBox, warnText, setTeamBtn]);
      y += 66;
    }

    // Matchmaking Section Header
    const sectionTitle = scene.add.text(
      left,
      y,
      'Pilih Lawan Duel',
      textStyle(15, COLORS.text, { fontStyle: 'bold' }),
    );
    content.add(sectionTitle);

    const refreshBtn = new Button(scene, left + width - 75, y + 10, {
      width: 130,
      height: 28,
      label: `🔄 ${t('arena.findOpponents')}`,
      fontSize: 11,
      color: COLORS.panelLight,
      onClick: () => {
        this.opponents = [];
        this.fetchOpponents();
      },
    });
    content.add(refreshBtn);

    y += 32;

    // If opponents not fetched yet, fetch them
    if (this.opponents.length === 0 && !this.loadingOpponents) {
      this.fetchOpponents();
    }

    if (this.opponents.length === 0) {
      content.add(
        scene.add.text(left + 12, y + 10, 'Mencari gladiator...', textStyle(13, COLORS.textDim)),
      );
      return y + 50;
    }

    // Render 3 Opponent Cards
    const opCardH = 88;
    this.opponents.forEach((op) => {
      const cardBg = roundedPanel(scene, left, y, width, opCardH, COLORS.panelDark, COLORS.stroke);
      content.add(cardBg);

      // Left: Name, Level, Tier, Power
      content.add(
        scene.add.text(
          left + 16,
          y + 14,
          `${op.name} (Lv ${op.level})`,
          textStyle(14, COLORS.text, { fontStyle: 'bold' }),
        ),
      );

      const opTier = getArenaTier(op.points);
      content.add(
        scene.add.text(
          left + 16,
          y + 36,
          `${opTier.name} · ${op.points} Poin`,
          textStyle(12, COLORS.gold),
        ),
      );

      content.add(
        scene.add.text(
          left + 16,
          y + 56,
          t('arena.power', { power: op.power }),
          textStyle(11, COLORS.textDim),
        ),
      );

      // Middle: Monsters preview icons
      const monstersStartX = left + Math.floor(width * 0.44);
      op.team.slice(0, TEAM_SIZE).forEach((f, mi) => {
        const mx = monstersStartX + mi * 38;
        const my = y + 44;
        const circle = scene.add.circle(mx, my, 15, COLORS.panelLight, 0.7);
        circle.setStrokeStyle(1.5, COLORS.stroke);
        const elText = scene.add
          .text(mx, my, f.element?.slice(0, 1).toUpperCase() ?? '?', {
            fontSize: '12px',
            color: '#fff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
        content.add([circle, elText]);
      });

      // Right: Challenge Button
      const canFight = arena.tickets > 0 && arena.team.length >= 1;
      const fightBtn = new Button(scene, left + width - 68, y + 44, {
        width: 110,
        height: 38,
        label: `⚔️ ${t('arena.challenge')}`,
        fontSize: 12,
        color: canFight ? COLORS.danger : COLORS.panelLight,
        disabled: !canFight,
        onClick: () => {
          this.executeDuel(op);
        },
      });
      content.add(fightBtn);

      y += opCardH + 10;
    });

    return y;
  }

  // ==========================================
  // TAB 2: ATUR TIM
  // ==========================================
  private buildTeamTab(
    content: Phaser.GameObjects.Container,
    left: number,
    y: number,
    width: number,
  ): number {
    const { scene } = this;
    const state = this.state;
    const arena = state.arena;

    // Section 1: Attack Team
    content.add(
      scene.add.text(
        left,
        y,
        `⚔️ ${t('arena.attackTeam')} (${TEAM_SIZE} Monster)`,
        textStyle(15, COLORS.text, { fontStyle: 'bold' }),
      ),
    );

    const atkPower = calculateArenaTeamPower(state, arena.team);
    content.add(
      scene.add
        .text(
          left + width,
          y + 2,
          t('arena.power', { power: atkPower }),
          textStyle(13, COLORS.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(1, 0),
    );

    y += 26;

    // 3 Attack Slots
    const slotGap = 10;
    const slotW = Math.floor((width - 2 * slotGap) / 3);
    const slotH = 120;

    for (let i = 0; i < TEAM_SIZE; i++) {
      const sx = left + i * (slotW + slotGap);
      const monsterId = arena.team[i];
      const monster = monsterId ? state.monsters.find((m) => m.id === monsterId) : undefined;

      const slotBg = roundedPanel(
        scene,
        sx,
        y,
        slotW,
        slotH,
        COLORS.panelDark,
        monster ? COLORS.accent : COLORS.stroke,
      );
      content.add(slotBg);

      if (monster) {
        const name = monsterName(monster);
        const stats = monsterStats(monster);
        content.add(
          scene.add
            .text(
              sx + slotW / 2,
              y + 14,
              name,
              textStyle(12, COLORS.text, { fontStyle: 'bold', wordWrap: { width: slotW - 12 } }),
            )
            .setOrigin(0.5, 0),
        );
        content.add(
          scene.add
            .text(
              sx + slotW / 2,
              y + 36,
              `${monsterElement(monster).toUpperCase()} · ${monster.stage}`,
              textStyle(10, COLORS.accent),
            )
            .setOrigin(0.5, 0),
        );
        content.add(
          scene.add
            .text(
              sx + slotW / 2,
              y + 54,
              `HP ${stats.hp} · ATK ${stats.atk}`,
              textStyle(10, COLORS.textDim),
            )
            .setOrigin(0.5, 0),
        );

        // Remove button
        const removeBtn = new Button(scene, sx + slotW / 2, y + slotH - 20, {
          width: slotW - 20,
          height: 24,
          label: 'Lepas',
          fontSize: 10,
          color: COLORS.danger,
          onClick: () => {
            const nextTeam = arena.team.filter((id) => id !== monster.id);
            this.run('setArenaTeam', { monsterIds: nextTeam });
            this.render();
          },
        });
        content.add(removeBtn);
      } else {
        content.add(
          scene.add
            .text(sx + slotW / 2, y + slotH / 2 - 8, '+ Slot Kosong', textStyle(12, COLORS.textDim))
            .setOrigin(0.5),
        );
      }
    }

    y += slotH + 20;

    // Section 2: Defense Team
    content.add(
      scene.add.text(
        left,
        y,
        `🛡️ ${t('arena.defenseTeam')} (${TEAM_SIZE} Monster)`,
        textStyle(15, COLORS.text, { fontStyle: 'bold' }),
      ),
    );

    const defPower = calculateArenaTeamPower(state, arena.defenseTeam);
    content.add(
      scene.add
        .text(
          left + width,
          y + 2,
          t('arena.power', { power: defPower }),
          textStyle(13, COLORS.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(1, 0),
    );

    y += 26;

    // 3 Defense Slots
    for (let i = 0; i < TEAM_SIZE; i++) {
      const sx = left + i * (slotW + slotGap);
      const monsterId = arena.defenseTeam[i];
      const monster = monsterId ? state.monsters.find((m) => m.id === monsterId) : undefined;

      const slotBg = roundedPanel(
        scene,
        sx,
        y,
        slotW,
        slotH,
        COLORS.panelDark,
        monster ? COLORS.gold : COLORS.stroke,
      );
      content.add(slotBg);

      if (monster) {
        const name = monsterName(monster);
        const stats = monsterStats(monster);
        content.add(
          scene.add
            .text(
              sx + slotW / 2,
              y + 14,
              name,
              textStyle(12, COLORS.text, { fontStyle: 'bold', wordWrap: { width: slotW - 12 } }),
            )
            .setOrigin(0.5, 0),
        );
        content.add(
          scene.add
            .text(
              sx + slotW / 2,
              y + 36,
              `${monsterElement(monster).toUpperCase()} · ${monster.stage}`,
              textStyle(10, COLORS.gold),
            )
            .setOrigin(0.5, 0),
        );
        content.add(
          scene.add
            .text(
              sx + slotW / 2,
              y + 54,
              `HP ${stats.hp} · ATK ${stats.atk}`,
              textStyle(10, COLORS.textDim),
            )
            .setOrigin(0.5, 0),
        );

        // Remove button
        const removeBtn = new Button(scene, sx + slotW / 2, y + slotH - 20, {
          width: slotW - 20,
          height: 24,
          label: 'Lepas',
          fontSize: 10,
          color: COLORS.danger,
          onClick: () => {
            const nextDef = arena.defenseTeam.filter((id) => id !== monster.id);
            this.run('setArenaDefenseTeam', { monsterIds: nextDef });
            this.render();
          },
        });
        content.add(removeBtn);
      } else {
        content.add(
          scene.add
            .text(sx + slotW / 2, y + slotH / 2 - 8, '+ Slot Kosong', textStyle(12, COLORS.textDim))
            .setOrigin(0.5),
        );
      }
    }

    y += slotH + 16;

    // Button to sync defense team snapshot to server
    const saveSnapshotBtn = new Button(scene, left + width / 2, y + 16, {
      width: Math.min(width, 280),
      height: 34,
      label: `☁️ Simpan Tim Bertahan ke Server`,
      fontSize: 12,
      color: COLORS.accentDark,
      onClick: async () => {
        await this.ctx.store.arena({ kind: 'saveSnapshot' });
        toast(scene, t('arena.teamSaved'), COLORS.good);
      },
    });
    content.add(saveSnapshotBtn);

    y += 46;

    // Section 3: Monster Roster (Click to assign)
    content.add(
      scene.add.text(
        left,
        y,
        'Pilih Monster dari Desa (Ketuk untuk Pasang)',
        textStyle(14, COLORS.text, { fontStyle: 'bold' }),
      ),
    );
    y += 24;

    const roster = state.monsters;
    if (roster.length === 0) {
      content.add(
        scene.add.text(left + 12, y, 'Belum ada monster di desa.', textStyle(12, COLORS.textDim)),
      );
      return y + 30;
    }

    roster.forEach((m) => {
      const inAtk = arena.team.includes(m.id);
      const inDef = arena.defenseTeam.includes(m.id);
      const rCardH = 46;

      const rCard = roundedPanel(scene, left, y, width, rCardH, COLORS.panelDark, COLORS.stroke);
      content.add(rCard);

      const name = monsterName(m);
      const stats = monsterStats(m);
      content.add(
        scene.add.text(
          left + 12,
          y + 14,
          `${name} (${monsterElement(m).toUpperCase()}) · HP ${stats.hp} ATK ${stats.atk}`,
          textStyle(12, COLORS.text),
        ),
      );

      // + Serang button
      const atkBtn = new Button(scene, left + width - 130, y + 23, {
        width: 72,
        height: 26,
        label: inAtk ? '✓ Serang' : '+ Serang',
        fontSize: 10,
        color: inAtk ? COLORS.good : COLORS.panelLight,
        onClick: () => {
          if (inAtk) {
            this.run('setArenaTeam', { monsterIds: arena.team.filter((id) => id !== m.id) });
          } else {
            if (arena.team.length >= TEAM_SIZE) {
              toast(scene, 'Tim menyerang sudah penuh (maks 3)', COLORS.warn);
              return;
            }
            this.run('setArenaTeam', { monsterIds: [...arena.team, m.id] });
          }
          this.render();
        },
      });
      content.add(atkBtn);

      // + Bertahan button
      const defBtn = new Button(scene, left + width - 48, y + 23, {
        width: 76,
        height: 26,
        label: inDef ? '✓ Bertahan' : '+ Bertahan',
        fontSize: 10,
        color: inDef ? COLORS.good : COLORS.panelLight,
        onClick: () => {
          if (inDef) {
            this.run('setArenaDefenseTeam', {
              monsterIds: arena.defenseTeam.filter((id) => id !== m.id),
            });
          } else {
            if (arena.defenseTeam.length >= TEAM_SIZE) {
              toast(scene, 'Tim bertahan sudah penuh (maks 3)', COLORS.warn);
              return;
            }
            this.run('setArenaDefenseTeam', { monsterIds: [...arena.defenseTeam, m.id] });
          }
          this.render();
        },
      });
      content.add(defBtn);

      y += rCardH + 6;
    });

    return y;
  }

  // ==========================================
  // TAB 3: LEADERBOARD
  // ==========================================
  private buildLeaderboardTab(
    content: Phaser.GameObjects.Container,
    left: number,
    y: number,
    width: number,
    now: number,
  ): number {
    const { scene } = this;
    content.add(
      scene.add.text(
        left,
        y,
        '🏆 Papan Peringkat Mingguan',
        textStyle(15, COLORS.text, { fontStyle: 'bold' }),
      ),
    );
    const endsIn = seasonSecondsRemaining(now);
    content.add(
      scene.add
        .text(
          left + width,
          y + 2,
          `Reset dlm ${formatDuration(endsIn)}`,
          textStyle(12, COLORS.textDim),
        )
        .setOrigin(1, 0),
    );

    y += 26;

    // Top Gladiators List
    if (this.leaderboard.length === 0 && !this.loadingLeaderboard) {
      this.fetchLeaderboard();
    }

    const lbCardH = 40;
    const entries = this.leaderboard.length > 0 ? this.leaderboard : this.getFallbackLeaderboard();

    entries.slice(0, 10).forEach((item) => {
      const isMe = item.name.includes('Kamu') || item.id === 'my_player_id';
      const rowBg = roundedPanel(
        scene,
        left,
        y,
        width,
        lbCardH,
        isMe ? COLORS.panelLight : COLORS.panelDark,
        isMe ? COLORS.gold : COLORS.stroke,
      );
      content.add(rowBg);

      // Rank Medal
      let rankText = `#${item.rank}`;
      if (item.rank === 1) rankText = '🥇 #1';
      else if (item.rank === 2) rankText = '🥈 #2';
      else if (item.rank === 3) rankText = '🥉 #3';

      content.add(
        scene.add.text(
          left + 12,
          y + 12,
          rankText,
          textStyle(13, item.rank <= 3 ? COLORS.gold : COLORS.textDim, { fontStyle: 'bold' }),
        ),
      );

      // Name & Tier
      content.add(
        scene.add.text(
          left + 80,
          y + 12,
          `${item.name} (${item.tier})`,
          textStyle(13, COLORS.text, { fontStyle: 'bold' }),
        ),
      );

      // Points
      content.add(
        scene.add
          .text(
            left + width - 14,
            y + 12,
            `${item.points} Poin`,
            textStyle(13, COLORS.gold, { fontStyle: 'bold' }),
          )
          .setOrigin(1, 0),
      );

      y += lbCardH + 6;
    });

    y += 16;

    // Tier Rewards Table Header
    content.add(
      scene.add.text(
        left,
        y,
        '🎁 Hadiah Peringkat Akhir Musim (7 Hari)',
        textStyle(14, COLORS.text, { fontStyle: 'bold' }),
      ),
    );
    y += 22;

    const tiers = gameData.rules.arena.tiers;
    tiers.forEach((tr) => {
      const rew = tr.weeklyReward;
      const rewText = `${formatNumber(rew.gold)} Emas · ${rew.gems} Permata · ${rew.soulCrystal} Kristal Jiwa`;
      const tCard = roundedPanel(scene, left, y, width, 36, COLORS.panelDark, COLORS.stroke);
      content.add(tCard);

      content.add(
        scene.add.text(
          left + 12,
          y + 10,
          `${tr.name} (${tr.minPoints}+ pt)`,
          textStyle(12, COLORS.gold, { fontStyle: 'bold' }),
        ),
      );

      content.add(
        scene.add
          .text(left + width - 12, y + 10, rewText, textStyle(11, COLORS.textDim))
          .setOrigin(1, 0),
      );

      y += 42;
    });

    return y;
  }

  // ==========================================
  // TAB 4: RIWAYAT
  // ==========================================
  private buildHistoryTab(
    content: Phaser.GameObjects.Container,
    left: number,
    y: number,
    width: number,
  ): number {
    const { scene } = this;
    const history = this.state.arena.history;

    content.add(
      scene.add.text(
        left,
        y,
        '📜 Riwayat Pertarungan Terakhir',
        textStyle(15, COLORS.text, { fontStyle: 'bold' }),
      ),
    );
    y += 26;

    if (history.length === 0) {
      content.add(
        scene.add.text(left + 12, y + 10, t('arena.emptyHistory'), textStyle(13, COLORS.textDim)),
      );
      return y + 60;
    }

    const hCardH = 54;
    history.slice(0, gameData.rules.arena.historyLimit).forEach((entry) => {
      const bg = roundedPanel(scene, left, y, width, hCardH, COLORS.panelDark, COLORS.stroke);
      content.add(bg);

      // Won / Loss badge
      const badgeColor = entry.won ? COLORS.good : COLORS.danger;
      const badgeLabel = entry.won ? 'MENANG' : 'KALAH';
      content.add(
        scene.add.text(
          left + 14,
          y + 18,
          badgeLabel,
          textStyle(12, badgeColor, { fontStyle: 'bold' }),
        ),
      );

      // Opponent Info
      content.add(
        scene.add.text(
          left + 88,
          y + 10,
          `vs ${entry.opponentName} (Lv ${entry.opponentLevel})`,
          textStyle(13, COLORS.text, { fontStyle: 'bold' }),
        ),
      );

      const sign = entry.pointsDelta >= 0 ? '+' : '';
      const pointsText = `${sign}${entry.pointsDelta} Poin · Daya Tempur: ${entry.opponentPower}`;
      content.add(scene.add.text(left + 88, y + 30, pointsText, textStyle(11, COLORS.textDim)));

      // Replay Watch button
      const replayBtn = new Button(scene, left + width - 56, y + 27, {
        width: 86,
        height: 28,
        label: '▶ Tonton',
        fontSize: 11,
        color: COLORS.panelLight,
        onClick: () => {
          this.showReplayModal(entry, entry.opponentName);
        },
      });
      content.add(replayBtn);

      y += hCardH + 8;
    });

    return y;
  }

  // ==========================================
  // COMBAT SIMULATION & REPLAY MODAL
  // ==========================================
  private async executeDuel(opponent: ArenaSnapshot): Promise<void> {
    const { scene } = this;
    playSfx(scene, 'click');

    // Call server edge function or simulate locally
    const res = await this.ctx.store.arena({ kind: 'fight', opponentId: opponent.id });
    if (!res.ok) {
      toast(scene, errorText(res.error ?? 'server'), COLORS.warn);
      if (res.error === 'opponentNotFound') this.fetchOpponents();
      return;
    }

    // Bots are rebuilt from the tickets left, so the offer changes after every duel.
    this.opponents = [];
    this.showReplayModal(res.result as ArenaBattleResult, opponent.name);
  }

  private showReplayModal(result: DuelOutcome, opponentName: string): void {
    const { scene } = this;
    if (this.replayOverlay) {
      this.replayOverlay.destroy();
      this.replayOverlay = null;
    }

    const L = scene.cameras.main;
    const screenW = L.width;
    const screenH = L.height;

    const overlay = scene.add.container(0, 0).setDepth((this.ctx.depth ?? 0) + 10);
    this.replayOverlay = overlay;

    // Dark dim background
    const dim = scene.add
      .rectangle(0, 0, screenW, screenH, 0x06040e, 0.75)
      .setOrigin(0)
      .setInteractive();
    overlay.add(dim);

    // Modal Card
    const modalW = Math.min(screenW - 24, 580);
    const modalH = Math.min(screenH - 40, 420);
    const modalX = (screenW - modalW) / 2;
    const modalY = (screenH - modalH) / 2;

    const modalBg = roundedPanel(
      scene,
      modalX,
      modalY,
      modalW,
      modalH,
      COLORS.background,
      COLORS.gold,
      16,
    );
    overlay.add(modalBg);

    // Modal Title
    const headerText = scene.add
      .text(
        modalX + modalW / 2,
        modalY + 24,
        `⚔️ Duel 3v3 vs ${opponentName}`,
        textStyle(17, COLORS.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);
    overlay.add(headerText);

    // Close button
    const closeBtn = new Button(scene, modalX + modalW - 24, modalY + 24, {
      width: 32,
      height: 30,
      label: 'X',
      color: COLORS.panelLight,
      onClick: () => {
        this.closeReplayModal();
      },
    });
    overlay.add(closeBtn);

    // Combat Display Area
    let cy = modalY + 60;
    const colW = (modalW - 50) / 2;

    // Left: Attackers (Our Team)
    overlay.add(
      scene.add.text(
        modalX + 20,
        cy,
        'Tim Penyerang (Kamu)',
        textStyle(13, COLORS.good, { fontStyle: 'bold' }),
      ),
    );

    // Right: Defenders (Opponent)
    overlay.add(
      scene.add
        .text(
          modalX + modalW - 20,
          cy,
          `Tim Bertahan (${opponentName})`,
          textStyle(13, COLORS.danger, { fontStyle: 'bold' }),
        )
        .setOrigin(1, 0),
    );

    cy += 24;

    // Display units
    for (let i = 0; i < TEAM_SIZE; i++) {
      const uY = cy + i * 44;

      // Attacker Unit
      const atkBarBg = roundedPanel(
        scene,
        modalX + 20,
        uY,
        colW,
        36,
        COLORS.panelDark,
        COLORS.stroke,
        6,
      );
      overlay.add(atkBarBg);
      const atkUnitText = scene.add.text(
        modalX + 28,
        uY + 10,
        `Unit #${i + 1}`,
        textStyle(12, COLORS.text),
      );
      overlay.add(atkUnitText);

      // Defender Unit
      const defBarBg = roundedPanel(
        scene,
        modalX + modalW - 20 - colW,
        uY,
        colW,
        36,
        COLORS.panelDark,
        COLORS.stroke,
        6,
      );
      overlay.add(defBarBg);
      const defUnitText = scene.add.text(
        modalX + modalW - 28 - colW,
        uY + 10,
        `Unit #${i + 1}`,
        textStyle(12, COLORS.text),
      );
      overlay.add(defUnitText);
    }

    cy += 3 * 44 + 20;

    // Result Banner Area
    const outcomeBg = roundedPanel(
      scene,
      modalX + 20,
      cy,
      modalW - 40,
      modalH - (cy - modalY) - 20,
      COLORS.panelDark,
      result.won ? COLORS.good : COLORS.danger,
      12,
    );
    overlay.add(outcomeBg);

    const outcomeText = scene.add
      .text(
        modalX + modalW / 2,
        cy + 26,
        result.won ? '🏆 KEMENANGAN!' : '💀 KEKALAHAN…',
        textStyle(20, result.won ? COLORS.good : COLORS.danger, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);
    overlay.add(outcomeText);

    const sign = result.pointsDelta >= 0 ? '+' : '';
    const pointsText = scene.add
      .text(
        modalX + modalW / 2,
        cy + 54,
        t('arena.pointsChange', { sign, n: Math.abs(result.pointsDelta) }),
        textStyle(15, result.won ? COLORS.gold : COLORS.warn, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);
    overlay.add(pointsText);

    // Done button
    const doneBtn = new Button(scene, modalX + modalW / 2, cy + 90, {
      width: 140,
      height: 36,
      label: 'Selesai',
      color: COLORS.accent,
      onClick: () => {
        this.closeReplayModal();
      },
    });
    overlay.add(doneBtn);

    playSfx(scene, result.won ? 'win' : 'lose');
  }

  private closeReplayModal(): void {
    if (this.replayOverlay) {
      this.replayOverlay.destroy();
      this.replayOverlay = null;
    }
    this.render();
  }

  // ==========================================
  // HELPERS & DATA FETCHING
  // ==========================================
  /** The player's rating with tickets and the season brought up to now. */
  private myPoints(): number {
    return settleArena(this.state, this.ctx.store.now()).arena.points;
  }

  private async fetchOpponents(): Promise<void> {
    this.loadingOpponents = true;
    try {
      const res = await this.ctx.store.arena({ kind: 'matchmake' });
      if (res.ok && Array.isArray(res.opponents)) {
        this.opponents = res.opponents as ArenaSnapshot[];
      } else {
        this.opponents = matchmakeArenaOpponents(this.myPoints(), [], 'offline', OFFERED);
      }
    } catch {
      this.opponents = matchmakeArenaOpponents(this.myPoints(), [], 'offline', OFFERED);
    } finally {
      this.loadingOpponents = false;
      this.render();
    }
  }

  private async fetchLeaderboard(): Promise<void> {
    this.loadingLeaderboard = true;
    try {
      const res = await this.ctx.store.arena({ kind: 'leaderboard' });
      if (res.ok && Array.isArray(res.entries)) {
        this.leaderboard = res.entries as LeaderboardEntry[];
      } else {
        this.leaderboard = this.getFallbackLeaderboard();
      }
    } catch {
      this.leaderboard = this.getFallbackLeaderboard();
    } finally {
      this.loadingLeaderboard = false;
      this.render();
    }
  }

  private getFallbackLeaderboard(): LeaderboardEntry[] {
    const myPoints = this.myPoints();
    const myTier = getArenaTier(myPoints);
    return [
      {
        rank: 1,
        id: 'b1',
        name: 'Ksatria Naga Emas',
        level: 12,
        power: 850,
        points: 2150,
        tier: 'Master',
      },
      {
        rank: 2,
        id: 'b2',
        name: 'Panglima Badai',
        level: 11,
        power: 780,
        points: 1980,
        tier: 'Master',
      },
      {
        rank: 3,
        id: 'b3',
        name: 'Penakluk Bayangan',
        level: 10,
        power: 720,
        points: 1850,
        tier: 'Master',
      },
      {
        rank: 4,
        id: 'b4',
        name: 'Pendekar Api Suci',
        level: 9,
        power: 650,
        points: 1720,
        tier: 'Berlian',
      },
      {
        rank: 5,
        id: 'b5',
        name: 'Gladiator Es Abadi',
        level: 8,
        power: 590,
        points: 1540,
        tier: 'Berlian',
      },
      {
        rank: 6,
        id: 'my',
        name: 'Kamu',
        level: Math.max(1, Math.floor(myPoints / 150)),
        power: 420,
        points: myPoints,
        tier: myTier.name,
      },
    ];
  }

  override destroy(): void {
    if (this.replayOverlay) {
      this.replayOverlay.destroy();
      this.replayOverlay = null;
    }
    super.destroy();
  }
}
