import '../styles.css';
import { checkAdminStatus, fetchLeaderboard } from '../api';
import { getCurrentUser, signOut } from '../auth';
import { esc } from '../html';
import { errorText, t, webData } from '../text';
import { openAuthModal } from '../ui/auth-modal';
import { renderLayout } from '../ui/layout';

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const user = await getCurrentUser();
  const admin = user ? await checkAdminStatus() : { isAdmin: false };

  const { contentEl } = renderLayout(app, 'peringkat', {
    signedIn: !!user,
    isAdmin: admin.isAdmin,
    email: user?.email,
    onLogin: () => openAuthModal(() => init()),
    onLogout: () => {
      signOut();
      init();
    },
  });

  let currentTab: 'leaderboard' | 'rewards' = 'leaderboard';
  const size = webData.leaderboardSize;

  contentEl.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">${t('web.leaderboard.title')}</h1>
        <p class="page-subtitle">${t('web.leaderboard.subtitle', { count: size })}</p>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-group">
        <button class="filter-btn active" id="tab-btn-leaderboard">${t('web.leaderboard.tabTop', { count: size })}</button>
        <button class="filter-btn" id="tab-btn-rewards">${t('web.leaderboard.tabRewards')}</button>
      </div>
      <div id="my-rank-indicator" class="cell-sub"></div>
    </div>

    <div id="tab-content">
      <div class="loading-note">${t('web.leaderboard.loading')}</div>
    </div>
  `;

  const tabContent = contentEl.querySelector('#tab-content') as HTMLElement;
  const myRankIndicator = contentEl.querySelector('#my-rank-indicator') as HTMLElement;
  const tabBtnLeaderboard = contentEl.querySelector('#tab-btn-leaderboard') as HTMLElement;
  const tabBtnRewards = contentEl.querySelector('#tab-btn-rewards') as HTMLElement;

  tabBtnLeaderboard.addEventListener('click', () => {
    currentTab = 'leaderboard';
    tabBtnLeaderboard.classList.add('active');
    tabBtnRewards.classList.remove('active');
    renderTab();
  });

  tabBtnRewards.addEventListener('click', () => {
    currentTab = 'rewards';
    tabBtnRewards.classList.add('active');
    tabBtnLeaderboard.classList.remove('active');
    renderTab();
  });

  const res = await fetchLeaderboard();
  const entries = res.ok ? res.entries : [];

  if (user) {
    const myEntry = entries.find((e) => e.userId === user.id);
    myRankIndicator.innerHTML = myEntry
      ? `<span class="points">${t('web.leaderboard.myPosition', { rank: myEntry.rank, points: myEntry.arenaRating })}</span>`
      : esc(t('web.leaderboard.notRanked', { email: user.email ?? '', count: size }));
  }

  function renderTab() {
    if (currentTab === 'rewards') {
      tabContent.innerHTML = `
        <div class="table-scroll">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>${t('web.leaderboard.tier')}</th>
                <th>${t('web.leaderboard.minPoints')}</th>
                <th class="cell-right">${t('web.leaderboard.weeklyReward')}</th>
              </tr>
            </thead>
            <tbody>
              ${webData.arenaTiers
                .map(
                  (tier) => `
                <tr>
                  <td class="points">${esc(tier.name)}</td>
                  <td>${t('web.common.points', { points: tier.minPoints })}</td>
                  <td class="cell-right reward">${esc(tier.rewardLabel)}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
      return;
    }

    if (!res.ok) {
      tabContent.innerHTML = `<div class="card-panel empty-panel">${errorText(res.error ?? 'server')}</div>`;
      return;
    }
    if (entries.length === 0) {
      tabContent.innerHTML = `<div class="card-panel empty-panel">${t('web.leaderboard.empty')}</div>`;
      return;
    }

    tabContent.innerHTML = `
      <div class="table-scroll">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th class="rank-cell">#</th>
              <th>${t('web.leaderboard.player')}</th>
              <th>${t('web.leaderboard.tier')}</th>
              <th class="cell-right">${t('web.leaderboard.points')}</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .map((row) => {
                const isMe = user && row.userId === user.id;
                const badgeClass = row.rank <= 3 ? `rank-${row.rank}` : '';
                return `
                <tr class="${isMe ? 'highlight-my-rank' : ''}">
                  <td class="rank-cell"><span class="rank-badge ${badgeClass}">${row.rank}</span></td>
                  <td>
                    <div class="player-name">
                      ${esc(row.playerName)}
                      ${isMe ? `<span class="tag-badge tag-me">${t('web.leaderboard.me')}</span>` : ''}
                    </div>
                    <div class="cell-sub">${t('web.common.level', { level: row.level })}</div>
                  </td>
                  <td><span class="tag-badge tag-gold">${esc(row.arenaTier)}</span></td>
                  <td class="cell-right points">${row.arenaRating}</td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderTab();
}

init();
