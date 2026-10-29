import '../styles.css';
import { checkAdminStatus, fetchNewsList } from '../api';
import { getCurrentUser, signOut } from '../auth';
import { esc, safeUrl } from '../html';
import { categoryLabel, formatDate, newsExcerpt } from '../news';
import { errorText, t, webData } from '../text';
import { openAuthModal } from '../ui/auth-modal';
import { renderLayout } from '../ui/layout';
import { articleUrl, ROUTES } from '../routes';

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const user = await getCurrentUser();
  const admin = user ? await checkAdminStatus() : { isAdmin: false };

  const { contentEl } = renderLayout(app, 'berita', {
    signedIn: !!user,
    isAdmin: admin.isAdmin,
    email: user?.email,
    onLogin: () => openAuthModal(() => init()),
    onLogout: () => {
      signOut();
      init();
    },
  });

  let selectedCategory = 'all';
  let currentPage = 1;
  const categories = ['all', ...webData.newsCategories];

  async function loadNews() {
    contentEl.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('web.news.title')}</h1>
          <p class="page-subtitle">${t('web.news.subtitle')}</p>
        </div>
        ${admin.isAdmin ? `<a href="${ROUTES.admin}" class="btn-primary btn-small">${t('web.news.write')}</a>` : ''}
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          ${categories
            .map(
              (cat) => `
            <button class="filter-btn ${selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">
              ${cat === 'all' ? t('web.news.all') : categoryLabel(cat)}
            </button>`,
            )
            .join('')}
        </div>
      </div>

      <div id="news-list-container">
        <div class="loading-note">${t('web.news.loading')}</div>
      </div>
    `;

    contentEl.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        selectedCategory = (e.currentTarget as HTMLElement).dataset.cat || 'all';
        currentPage = 1;
        loadNews();
      });
    });

    const res = await fetchNewsList({
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      page: currentPage,
    });

    const container = contentEl.querySelector('#news-list-container');
    if (!container) return;

    if (!res.ok) {
      container.innerHTML = `<div class="card-panel empty-panel">${errorText(res.error ?? 'server')}</div>`;
      return;
    }
    if (res.items.length === 0) {
      container.innerHTML = `<div class="card-panel empty-panel">${t('web.news.empty')}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="news-grid">
        ${res.items
          .map((item) => {
            const cover = safeUrl(item.coverUrl);
            return `
            <a class="news-card" href="${articleUrl(item.slug)}">
              ${
                cover
                  ? `<img src="${cover}" alt="" class="news-cover" loading="lazy" />`
                  : `<div class="news-cover news-cover-empty">📰</div>`
              }
              <div class="news-body">
                <div class="news-meta">
                  <span class="tag-badge tag-gold">${categoryLabel(item.category)}</span>
                  <span>${formatDate(item.publishedAt)}</span>
                  <span>•</span>
                  <span>${esc(item.author)}</span>
                </div>
                <h2 class="news-title">${esc(item.title)}</h2>
                <p class="news-excerpt">${esc(newsExcerpt(item, 120))}</p>
                <div class="news-more">${t('web.news.readMore')}</div>
              </div>
            </a>
          `;
          })
          .join('')}
      </div>

      ${
        res.totalPages > 1
          ? `
        <div class="pagination">
          ${Array.from({ length: res.totalPages }, (_, i) => i + 1)
            .map(
              (p) =>
                `<button class="filter-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`,
            )
            .join('')}
        </div>
      `
          : ''
      }
    `;

    container.querySelectorAll('button[data-page]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        currentPage = Number((e.currentTarget as HTMLElement).dataset.page);
        loadNews();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  loadNews();
}

init();
