import '../styles.css';
import { checkAdminStatus, fetchNewsArticle } from '../api';
import { getCurrentUser, signOut } from '../auth';
import { esc, safeUrl } from '../html';
import { renderMarkdown } from '../markdown';
import { categoryLabel, formatDate } from '../news';
import { t } from '../text';
import { openAuthModal } from '../ui/auth-modal';
import { renderLayout } from '../ui/layout';
import { adminEditUrl, ROUTES, slugFromPath } from '../routes';

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

  const slug = slugFromPath(window.location.pathname);
  if (!slug) {
    window.location.replace(ROUTES.news);
    return;
  }

  contentEl.innerHTML = `<div class="loading-note">${t('web.news.loadingArticle')}</div>`;

  const res = await fetchNewsArticle(slug);
  if (!res.ok || !res.item) {
    contentEl.innerHTML = `
      <div class="card-panel notice-panel">
        <h2 class="notice-title danger">${t('web.news.notFoundTitle')}</h2>
        <p class="page-subtitle">${t('web.news.notFoundDesc')}</p>
        <a href="${ROUTES.news}" class="btn-primary">${t('web.news.backToList')}</a>
      </div>
    `;
    return;
  }

  const item = res.item;
  const cover = safeUrl(item.coverUrl);
  document.title = `${item.title} — Soul Monster`;

  contentEl.innerHTML = `
    <article class="article-container">
      <div class="article-top">
        <a href="${ROUTES.news}" class="back-link">${t('web.news.back')}</a>
        ${
          admin.isAdmin
            ? `<a href="${adminEditUrl(item.slug)}" class="btn-secondary btn-small">${t('web.news.editInAdmin')}</a>`
            : ''
        }
      </div>

      <div class="news-meta article-meta">
        <span class="tag-badge tag-gold">${categoryLabel(item.category)}</span>
        <span>${item.publishedAt ? formatDate(item.publishedAt, 'long') : t('web.news.draft')}</span>
        <span>•</span>
        <span>${t('web.news.writtenBy', { author: `<strong>${esc(item.author)}</strong>` })}</span>
      </div>

      <h1 class="article-title">${esc(item.title)}</h1>

      ${cover ? `<div class="article-cover"><img src="${cover}" alt="" /></div>` : ''}

      <div class="article-content">
        ${renderMarkdown(item.content)}
      </div>
    </article>
  `;
}

init();
