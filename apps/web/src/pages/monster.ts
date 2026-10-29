import '../styles.css';
import { checkAdminStatus, fetchMyCollection } from '../api';
import { getCurrentUser, signOut } from '../auth';
import { esc, gameUrl } from '../html';
import { hasText, t, webData, type PublicMonster } from '../text';
import { openAuthModal } from '../ui/auth-modal';
import { renderLayout } from '../ui/layout';
import { elementBadge, monsterCard, monsterSprite } from '../ui/monster-card';

const allMonsters: PublicMonster[] = webData.allMonsters;

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const user = await getCurrentUser();
  const admin = user ? await checkAdminStatus() : { isAdmin: false };

  let unlockedIds: Set<string> = new Set();
  if (user) {
    const col = await fetchMyCollection();
    if (col.ok) {
      unlockedIds = new Set(col.unlockedMonsterIds);
    }
  }

  const { contentEl } = renderLayout(app, 'monster', {
    signedIn: !!user,
    isAdmin: admin.isAdmin,
    email: user?.email,
    onLogin: () => openAuthModal(() => init()),
    onLogout: () => {
      signOut();
      init();
    },
  });

  let selectedTier = 0; // 0 = all
  let searchQuery = '';
  let onlyOwned = false;
  const isLocked = (m: PublicMonster) => !!user && !unlockedIds.has(m.id);

  contentEl.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">${t('web.pedia.title')}</h1>
        <p class="page-subtitle">${t('web.pedia.subtitle', { count: allMonsters.length })}</p>
      </div>
    </div>
    ${
      user
        ? `<div class="connected-note">${esc(
            t('web.pedia.connected', {
              email: user.email ?? '',
              count: unlockedIds.size,
              total: allMonsters.length,
            }),
          )}</div>`
        : `
      <div class="card-panel login-callout">
        <div>
          <div class="login-callout-title">${t('web.pedia.loginTitle')}</div>
          <div class="cell-sub">${t('web.pedia.loginPrompt')}</div>
        </div>
        <button class="btn-primary" id="btn-sync-login">${t('web.nav.login')}</button>
      </div>`
    }

    <div class="filter-bar">
      <div class="filter-group" id="tier-filters">
        <button class="filter-btn active" data-tier="0">${t('web.pedia.filterAll')}</button>
        ${webData.tiers
          .map(
            (tier) =>
              `<button class="filter-btn" data-tier="${tier.id}" title="${esc(tier.name)}">T${tier.id}</button>`,
          )
          .join('')}
      </div>
      <div class="filter-tools">
        <input type="search" id="pedia-search" placeholder="${t('web.pedia.search')}" class="form-input search-input" />
        ${
          user
            ? `<label class="check-label"><input type="checkbox" id="toggle-owned" /> ${t('web.pedia.filterOwned')}</label>`
            : ''
        }
      </div>
    </div>

    <div class="monster-grid" id="pedia-grid"></div>
    <div id="pedia-modal-container"></div>
  `;

  const grid = contentEl.querySelector('#pedia-grid') as HTMLElement;

  /** Redraws only the grid, so the search box keeps its focus while typing. */
  function renderGrid() {
    const query = searchQuery.trim().toLowerCase();
    const filtered = allMonsters.filter((m) => {
      if (selectedTier > 0 && m.tier !== selectedTier) return false;
      if (onlyOwned && !unlockedIds.has(m.id)) return false;
      // A locked monster's name stays secret, so searching cannot reveal it.
      if (query && (isLocked(m) || !m.name.toLowerCase().includes(query))) return false;
      return true;
    });

    grid.innerHTML =
      filtered.length === 0
        ? `<div class="grid-empty">${t('web.pedia.noMatch')}</div>`
        : filtered.map((m) => monsterCard(m, isLocked(m))).join('');
  }

  contentEl.querySelector('#btn-sync-login')?.addEventListener('click', () => {
    openAuthModal(() => init());
  });

  const tierButtons = contentEl.querySelectorAll<HTMLElement>('#tier-filters .filter-btn');
  tierButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedTier = Number(btn.dataset.tier || 0);
      tierButtons.forEach((b) => b.classList.toggle('active', b === btn));
      renderGrid();
    });
  });

  contentEl.querySelector('#pedia-search')?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    renderGrid();
  });

  contentEl.querySelector('#toggle-owned')?.addEventListener('change', (e) => {
    onlyOwned = (e.target as HTMLInputElement).checked;
    renderGrid();
  });

  grid.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('.monster-card');
    const monster = allMonsters.find((m) => m.id === card?.getAttribute('data-id'));
    if (monster) showMonsterDetail(monster, !isLocked(monster));
  });

  function showMonsterDetail(m: PublicMonster, isUnlocked: boolean) {
    const modalContainer = contentEl.querySelector('#pedia-modal-container');
    if (!modalContainer) return;

    const stat = (label: string, value: number, cls: string) =>
      `<div><span class="cell-sub">${label}</span> <strong class="${cls}">${value}</strong></div>`;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="monster-modal">
        <div class="modal-card monster-modal">
          <div class="modal-header">
            <span class="monster-tier">${t('web.common.tier', { tier: m.tier })} · ${esc(m.tierName)}</span>
            <button class="modal-close" id="modal-detail-close" aria-label="${t('web.common.close')}">&times;</button>
          </div>

          <div class="monster-modal-sprite">${monsterSprite(m, !isUnlocked, 'monster-modal-img')}</div>

          <h3 class="modal-title">${isUnlocked ? esc(m.name) : t('web.pedia.lockedName')}</h3>
          ${
            isUnlocked
              ? `
            <div class="monster-modal-tags">
              ${elementBadge(m)}
              <span class="tag-badge tag-dim">${t('web.pedia.roleLabel')}: ${labelOf('role', m.role)}</span>
            </div>
            <p class="monster-desc">${esc(m.description)}</p>
            <div class="stat-grid">
              ${stat(t('web.pedia.statHp'), m.baseHp, 'stat-hp')}
              ${stat(t('web.pedia.statAtk'), m.baseAtk, 'stat-atk')}
              ${stat(t('web.pedia.statDef'), m.baseDef, 'stat-def')}
              ${stat(t('web.pedia.statSpd'), m.baseSpd, 'stat-spd')}
            </div>
            <div class="cell-sub stat-note">${t('web.pedia.statsNote')}</div>
            <div class="monster-sources">
              <span class="cell-sub">${t('web.pedia.sourceLabel')}:</span>
              ${m.sources.map((src) => `<span class="tag-badge tag-dim">${labelOf('source', src)}</span>`).join(' ')}
            </div>
          `
              : `
            <p class="cell-sub">${t('web.pedia.lockedDesc')}</p>
            <div class="locked-hint">${t('web.pedia.lockedHint')}</div>
          `
          }

          <a href="${esc(gameUrl())}" target="_blank" rel="noopener noreferrer" class="btn-primary btn-block">
            ${t('web.pedia.play')}
          </a>
        </div>
      </div>
    `;

    const modal = modalContainer.querySelector('#monster-modal') as HTMLElement;
    const closeBtn = modalContainer.querySelector('#modal-detail-close') as HTMLElement;
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  renderGrid();
}

/** Player text for a role or source id from monsters.json; an unknown id shows as it is. */
function labelOf(kind: 'role' | 'source', id: string): string {
  const key = `web.${kind}.${id}`;
  return hasText(key) ? t(key) : esc(id);
}

init();
