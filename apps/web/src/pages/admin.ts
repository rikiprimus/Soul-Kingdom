import '../styles.css';
import {
  checkAdminStatus,
  deleteNews,
  fetchNewsArticle,
  fetchNewsList,
  hideNews,
  publishNews,
  saveNews,
  uploadNewsCover,
} from '../api';
import { getCurrentUser, signOut } from '../auth';
import { renderMarkdown } from '../markdown';
import { esc, safeUrl } from '../html';
import { categoryLabel, formatDate } from '../news';
import { errorText, t, webData } from '../text';
import {
  slugify,
  VALID_NEWS_CATEGORIES,
  VALID_NEWS_STATUSES,
  type NewsCategory,
  type NewsItem,
  type NewsStatus,
} from '@soul-monster/shared';
import { openAuthModal } from '../ui/auth-modal';
import { renderLayout } from '../ui/layout';

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const user = await getCurrentUser();
  const admin = user ? await checkAdminStatus() : { isAdmin: false };

  const { contentEl } = renderLayout(app, 'admin', {
    signedIn: !!user,
    isAdmin: admin.isAdmin,
    email: user?.email,
    onLogin: () => openAuthModal(() => init()),
    onLogout: () => {
      signOut();
      init();
    },
  });

  if (!user || !admin.isAdmin) {
    contentEl.innerHTML = `
      <div class="card-panel notice-panel">
        <div class="notice-icon">🔒</div>
        <h2 class="notice-title">${t('web.admin.lockedTitle')}</h2>
        <p class="page-subtitle">${t(user ? 'web.admin.lockedNoRole' : 'web.admin.lockedSignIn')}</p>
        <button class="btn-primary" id="btn-admin-login">${t('web.admin.lockedLogin')}</button>
      </div>
    `;
    contentEl.querySelector('#btn-admin-login')?.addEventListener('click', () => {
      openAuthModal(() => init());
    });
    return;
  }

  // Check URL query if ?edit=<slug>
  const editSlug = new URLSearchParams(window.location.search).get('edit');
  if (editSlug) {
    const res = await fetchNewsArticle(editSlug);
    if (res.ok && res.item) {
      renderEditor(res.item);
      return;
    }
  }

  renderList();

  async function renderList() {
    contentEl.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('web.admin.title')}</h1>
          <p class="page-subtitle">${t('web.admin.subtitle')}</p>
        </div>
        <button class="btn-primary" id="btn-new-article">${t('web.admin.newArticle')}</button>
      </div>

      <div id="admin-table-container">
        <div class="loading-note">${t('web.admin.loading')}</div>
      </div>
    `;

    contentEl.querySelector('#btn-new-article')?.addEventListener('click', () => {
      renderEditor();
    });

    const res = await fetchNewsList({ adminView: true, limit: webData.rules.newsMaxPerPage });
    const container = contentEl.querySelector('#admin-table-container');
    if (!container) return;

    if (!res.ok) {
      container.innerHTML = `<div class="card-panel empty-panel">${errorText(res.error ?? 'server')}</div>`;
      return;
    }
    if (res.items.length === 0) {
      container.innerHTML = `<div class="card-panel empty-panel">${t('web.admin.empty')}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-scroll">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>${t('web.admin.colTitle')}</th>
            <th>${t('web.admin.colStatus')}</th>
            <th>${t('web.admin.colDate')}</th>
            <th class="cell-right">${t('web.admin.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          ${res.items
            .map((item) => {
              const statusColor =
                item.status === 'published'
                  ? 'var(--accent-green)'
                  : item.status === 'draft'
                    ? 'var(--accent-gold)'
                    : 'var(--text-dim)';

              return `
              <tr data-id="${esc(item.id)}">
                <td>
                  <div class="player-name">${esc(item.title)}</div>
                  <div class="cell-sub">${categoryLabel(item.category)} • /${esc(item.slug)}</div>
                </td>
                <td>
                  <span class="tag-badge tag-dim" style="color: ${statusColor};">${statusLabel(item.status)}</span>
                </td>
                <td class="cell-sub">${formatDate(item.publishedAt) || t('web.news.draft')}</td>
                <td class="cell-right">
                  <div class="row-actions">
                    <button class="btn-secondary btn-mini btn-action-edit" data-id="${esc(item.id)}">${t('web.admin.btnEdit')}</button>
                    ${
                      item.status !== 'published'
                        ? `<button class="btn-secondary btn-mini btn-action-pub good" data-id="${esc(item.id)}">${t('web.admin.btnPublish')}</button>`
                        : `<button class="btn-secondary btn-mini btn-action-hide" data-id="${esc(item.id)}">${t('web.admin.btnHide')}</button>`
                    }
                    <button class="btn-secondary btn-mini btn-action-del danger" data-id="${esc(item.id)}">${t('web.admin.btnDelete')}</button>
                  </div>
                </td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
      </div>
    `;

    // Action handlers
    container.querySelectorAll('.btn-action-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id;
        const item = res.items.find((i) => i.id === id);
        if (item) renderEditor(item);
      });
    });

    container.querySelectorAll('.btn-action-pub').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.id!;
        await publishNews(id);
        renderList();
      });
    });

    container.querySelectorAll('.btn-action-hide').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.id!;
        await hideNews(id);
        renderList();
      });
    });

    container.querySelectorAll('.btn-action-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(t('web.admin.confirmDelete'))) return;
        const id = (btn as HTMLElement).dataset.id!;
        await deleteNews(id);
        renderList();
      });
    });
  }

  function renderEditor(item?: Partial<NewsItem>) {
    const isEdit = !!item?.id;

    contentEl.innerHTML = `
      <div class="page-head">
        <h1 class="page-title">${t(isEdit ? 'web.admin.editTitle' : 'web.admin.newTitle')}</h1>
        <button class="btn-secondary" id="editor-btn-cancel">${t('web.admin.cancel')}</button>
      </div>

      <div class="card-panel">
        <form id="news-editor-form">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div class="form-group">
              <label for="ed-title">${t('web.admin.fieldTitle')}</label>
              <input type="text" id="ed-title" required class="form-input" placeholder="${t('web.admin.fieldTitleHint')}" value="${esc(item?.title)}" />
            </div>

            <div class="form-group">
              <label for="ed-slug">${t('web.admin.fieldSlug')}</label>
              <input type="text" id="ed-slug" required class="form-input" placeholder="${t('web.admin.fieldSlugHint')}" value="${esc(item?.slug)}" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div class="form-group">
              <label for="ed-cat">${t('web.admin.fieldCategory')}</label>
              <select id="ed-cat" class="form-select">
                ${VALID_NEWS_CATEGORIES.map(
                  (cat) =>
                    `<option value="${cat}" ${item?.category === cat ? 'selected' : ''}>${categoryLabel(cat)}</option>`,
                ).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="ed-status">${t('web.admin.fieldStatus')}</label>
              <select id="ed-status" class="form-select">
                ${VALID_NEWS_STATUSES.map(
                  (status) =>
                    `<option value="${status}" ${item?.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`,
                ).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="ed-author">${t('web.admin.fieldAuthor')}</label>
              <input type="text" id="ed-author" class="form-input" value="${esc(item?.author ?? t('web.admin.defaultAuthor'))}" />
            </div>
          </div>

          <div class="form-group">
            <label for="ed-cover">${t('web.admin.fieldCover')}</label>
            <div class="cover-row">
              <input type="text" id="ed-cover" class="form-input" placeholder="https://…" value="${safeUrl(item?.coverUrl)}" />
              <label class="btn-secondary file-pick">
                ${t('web.admin.pickFile')}
                <input type="file" id="ed-cover-file" accept="image/*" style="display: none;" />
              </label>
            </div>
            <div id="cover-upload-status" style="font-size: 11px; color: var(--accent-green); margin-top: 4px; display: none;"></div>
          </div>

          <div class="form-group">
            <label for="ed-excerpt">${t('web.admin.fieldExcerpt')}</label>
            <input type="text" id="ed-excerpt" class="form-input" maxlength="${webData.rules.news.excerptMax}" placeholder="${t('web.admin.fieldExcerptHint')}" value="${esc(item?.excerpt)}" />
          </div>

          <div class="form-group">
            <label for="ed-content">${t('web.admin.fieldBody')}</label>
            <div class="editor-layout">
              <textarea id="ed-content" class="form-textarea editor-textarea" placeholder="${esc(t('web.admin.fieldBodyHint'))}">${esc(item?.content)}</textarea>
              <div class="preview-box" id="ed-preview"></div>
            </div>
          </div>

          <div id="editor-error" class="form-error" style="display: none;"></div>

          <div class="editor-actions">
            <button type="button" class="btn-secondary" id="ed-btn-save-draft">${t('web.admin.btnSaveDraft')}</button>
            <button type="submit" class="btn-primary" id="ed-btn-submit">
              ${t(isEdit ? 'web.admin.btnSave' : 'web.admin.btnSubmit')}
            </button>
          </div>
        </form>
      </div>
    `;

    const cancelBtn = contentEl.querySelector('#editor-btn-cancel') as HTMLElement;
    cancelBtn.addEventListener('click', () => renderList());

    const titleInput = contentEl.querySelector('#ed-title') as HTMLInputElement;
    const slugInput = contentEl.querySelector('#ed-slug') as HTMLInputElement;
    const contentTextarea = contentEl.querySelector('#ed-content') as HTMLTextAreaElement;
    const previewBox = contentEl.querySelector('#ed-preview') as HTMLElement;
    const coverInput = contentEl.querySelector('#ed-cover') as HTMLInputElement;
    const coverFileInput = contentEl.querySelector('#ed-cover-file') as HTMLInputElement;
    const coverStatus = contentEl.querySelector('#cover-upload-status') as HTMLElement;
    const errorEl = contentEl.querySelector('#editor-error') as HTMLElement;

    // Auto slug from title if slug not manually changed
    let slugTouched = Boolean(item?.slug);
    titleInput.addEventListener('input', () => {
      if (!slugTouched) {
        slugInput.value = slugify(titleInput.value);
      }
    });
    slugInput.addEventListener('input', () => {
      slugTouched = true;
    });

    // Live markdown preview
    const updatePreview = () => {
      const md = contentTextarea.value.trim();
      previewBox.innerHTML = md
        ? renderMarkdown(md)
        : `<div class="preview-empty">${t('web.admin.previewEmpty')}</div>`;
    };
    contentTextarea.addEventListener('input', updatePreview);
    updatePreview();

    // File upload
    coverFileInput.addEventListener('change', async () => {
      const file = coverFileInput.files?.[0];
      if (!file) return;

      coverStatus.textContent = t('web.admin.uploading');
      coverStatus.style.display = 'block';

      const upload = await uploadNewsCover(file);
      if (upload.ok && upload.url) {
        coverInput.value = upload.url;
        coverStatus.textContent = t('web.admin.uploaded');
      } else {
        coverStatus.textContent = t('web.admin.uploadFailed', {
          error: upload.error || errorText('server'),
        });
      }
    });

    const form = contentEl.querySelector('#news-editor-form') as HTMLFormElement;

    const performSave = async (overrideStatus?: NewsStatus) => {
      errorEl.style.display = 'none';

      const status =
        overrideStatus ||
        ((contentEl.querySelector('#ed-status') as HTMLSelectElement).value as NewsStatus);

      const payload: Partial<NewsItem> = {
        id: item?.id,
        title: titleInput.value.trim(),
        slug: slugInput.value.trim(),
        category: (contentEl.querySelector('#ed-cat') as HTMLSelectElement).value as NewsCategory,
        status,
        author:
          (contentEl.querySelector('#ed-author') as HTMLInputElement).value.trim() ||
          t('web.admin.defaultAuthor'),
        coverUrl: coverInput.value.trim() || null,
        excerpt: (contentEl.querySelector('#ed-excerpt') as HTMLInputElement).value.trim(),
        content: contentTextarea.value.trim(),
      };

      const res = await saveNews(payload);
      if (!res.ok) {
        errorEl.textContent =
          res.details?.map((e) => t(`web.newsError.${e.code}`, { n: e.limit ?? '' })).join(' ') ||
          errorText(res.error ?? 'server');
        errorEl.style.display = 'block';
        return;
      }

      renderList();
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      performSave();
    });

    contentEl.querySelector('#ed-btn-save-draft')?.addEventListener('click', () => {
      performSave('draft');
    });
  }
}

function statusLabel(status: string): string {
  return (VALID_NEWS_STATUSES as readonly string[]).includes(status)
    ? t(`web.admin.status.${status}`)
    : esc(status);
}

init();
