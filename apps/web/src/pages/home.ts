import '../styles.css';
import { checkAdminStatus, fetchLeaderboard, fetchNewsList } from '../api';
import { getCurrentUser, signOut } from '../auth';
import { esc, gameUrl } from '../html';
import { categoryLabel, formatDate, newsExcerpt } from '../news';
import { t, webData } from '../text';
import { openAuthModal } from '../ui/auth-modal';
import { icon, type IconName } from '../ui/icons';
import { renderLayout } from '../ui/layout';
import { monsterCard } from '../ui/monster-card';
import { articleUrl, ROUTES } from '../routes';

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const user = await getCurrentUser();
  const admin = user ? await checkAdminStatus() : { isAdmin: false };

  const { contentEl } = renderLayout(app, 'home', {
    signedIn: !!user,
    isAdmin: admin.isAdmin,
    email: user?.email,
    onLogin: () => openAuthModal(() => init()),
    onLogout: () => {
      signOut();
      init();
    },
  });

  const stats: { icon: IconName; text: string }[] = [
    { icon: 'paw', text: t('web.home.stats.monsters', { n: webData.stats.monsters }) },
    { icon: 'orb', text: t('web.home.stats.elements', { n: webData.stats.elements }) },
    { icon: 'altar', text: t('web.home.stats.recipes', { n: webData.stats.recipes }) },
    { icon: 'star', text: t('web.home.stats.tiers', { n: webData.stats.tiers }) },
    { icon: 'swords', text: t('web.home.stats.arena') },
  ];
  const features = [
    ['build', 'Village'],
    ['breed', 'Altar'],
    ['battle', 'Arena'],
  ];

  contentEl.innerHTML = `
    <section class="hero">
      <img class="leaves leaves-left" src="/img/leaves.webp" alt="" aria-hidden="true" />
      <img class="leaves leaves-right" src="/img/leaves.webp" alt="" aria-hidden="true" />

      <div class="hero-grid">
        <div class="hero-text">
          <h1 class="hero-title">
            <span>${t('web.home.heroTitle1')}</span>
            <span>${t('web.home.heroTitle2')}</span>
          </h1>
          <div class="gem-divider" aria-hidden="true"><i></i></div>
          <p class="hero-tagline">${t('web.home.heroTagline')}</p>
          <a href="${esc(gameUrl())}" class="btn-gem btn-cta" target="_blank" rel="noopener noreferrer">
            ${t('web.home.heroCta')} <span aria-hidden="true">›</span>
          </a>
          <div class="hero-badges">
            <span class="pill-badge">${icon('feather')}${t('web.home.badgeFree')}</span>
            <span class="pill-badge">${icon('globe')}${t('web.home.badgeGenre')}</span>
          </div>
        </div>
        <div class="hero-art">
          <img
            src="/img/island.webp"
            srcset="/img/island-640.webp 640w, /img/island.webp 973w"
            sizes="(max-width: 900px) 92vw, 640px"
            alt="${t('web.home.heroAlt')}"
            width="973"
            height="833"
          />
        </div>
      </div>

      <div class="feature-row">
        ${features
          .map(
            ([img, key]) => `
        <div class="ornate-card">
          <img class="ornate-art" src="/img/feature-${img}.webp" alt="" loading="lazy" />
          <h3>${t(`web.home.feature${key}Title`)}</h3>
          <p>${t(`web.home.feature${key}Desc`)}</p>
          <div class="gem-divider small" aria-hidden="true"><i></i></div>
        </div>`,
          )
          .join('')}
      </div>

      <div class="stats-bar">
        ${stats.map((s) => `<span class="stat">${icon(s.icon)}${s.text}</span>`).join('')}
      </div>

      <a href="#more" class="scroll-hint">
        <span class="mouse" aria-hidden="true"></span>
        ${t('web.home.scrollDown')}
      </a>
    </section>

    <div id="more"></div>

    <section class="home-section">
      <h2 class="section-title">${t('web.home.galleryTitle')}</h2>
      <p class="section-subtitle">${t('web.home.gallerySubtitle')}</p>
      <div class="gallery-grid">
        ${['desa', 'pedia', 'peta']
          .map(
            (shot) => `
        <figure class="gallery-item game-frame">
          <img src="/img/shot-${shot}.webp" alt="${t(`web.home.shot.${shot}`)}" loading="lazy" width="800" height="450" />
          <figcaption>${t(`web.home.shot.${shot}`)}</figcaption>
        </figure>`,
          )
          .join('')}
      </div>
    </section>

    <section class="home-section">
      <h2 class="section-title">${t('web.home.featuredTitle')}</h2>
      <p class="section-subtitle">${t('web.home.featuredSubtitle')}</p>
      <div class="monster-grid featured-grid">
        ${webData.featured.map((m) => monsterCard(m, false, ROUTES.pedia)).join('')}
      </div>
      <div class="section-more"><a href="${ROUTES.pedia}">${t('web.home.viewAllMonsters')}</a></div>
    </section>

    <div class="home-columns">
      <div>
        <div class="column-head">
          <h3>${t('web.home.latestNewsTitle')}</h3>
          <a href="${ROUTES.news}">${t('web.home.viewAllNews')}</a>
        </div>
        <div id="home-news-container">
          <div class="muted-note">${t('web.home.loadingNews')}</div>
        </div>
      </div>

      <div>
        <div class="column-head">
          <h3>${t('web.home.topLeaderboardTitle')}</h3>
          <a href="${ROUTES.leaderboard}">${t('web.home.viewAllLeaderboard')}</a>
        </div>
        <div id="home-leaderboard-container">
          <div class="muted-note">${t('web.home.loadingLeaderboard')}</div>
        </div>
      </div>
    </div>
  `;

  const newsContainer = contentEl.querySelector('#home-news-container') as HTMLElement;
  fetchNewsList({ limit: 3 })
    .then((res) => {
      if (!res.ok) {
        newsContainer.innerHTML = `<div class="muted-note">${t('web.home.newsFailed')}</div>`;
        return;
      }
      if (res.items.length === 0) {
        newsContainer.innerHTML = `<div class="card-panel empty-panel">${t('web.home.noNews')}</div>`;
        return;
      }
      newsContainer.innerHTML = res.items
        .map(
          (item) => `
        <a class="card-panel home-news-item" href="${articleUrl(item.slug)}">
          <div class="news-meta">
            <span class="tag-badge tag-gold">${categoryLabel(item.category)}</span>
            <span>${formatDate(item.publishedAt)}</span>
          </div>
          <h4>${esc(item.title)}</h4>
          <p>${esc(newsExcerpt(item, 90))}</p>
        </a>
      `,
        )
        .join('');
    })
    .catch(() => {
      newsContainer.innerHTML = `<div class="muted-note">${t('web.home.newsFailed')}</div>`;
    });

  const boardContainer = contentEl.querySelector('#home-leaderboard-container') as HTMLElement;
  fetchLeaderboard(3)
    .then((res) => {
      if (!res.ok) {
        boardContainer.innerHTML = `<div class="muted-note">${t('web.home.leaderboardFailed')}</div>`;
        return;
      }
      if (res.entries.length === 0) {
        boardContainer.innerHTML = `<div class="card-panel empty-panel">${t('web.home.noLeaderboard')}</div>`;
        return;
      }
      boardContainer.innerHTML = `
        <div class="table-scroll">
          <table class="leaderboard-table">
            <tbody>
              ${res.entries
                .map(
                  (row) => `
                <tr>
                  <td class="rank-cell"><span class="rank-badge rank-${row.rank}">${row.rank}</span></td>
                  <td>
                    <div class="player-name">${esc(row.playerName)}</div>
                    <div class="cell-sub">${t('web.common.level', { level: row.level })}</div>
                  </td>
                  <td class="cell-right">
                    <div class="points">${t('web.common.points', { points: row.arenaRating })}</div>
                    <div class="cell-sub">${esc(row.arenaTier)}</div>
                  </td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    })
    .catch(() => {
      boardContainer.innerHTML = `<div class="muted-note">${t('web.home.leaderboardFailed')}</div>`;
    });
}

init();
