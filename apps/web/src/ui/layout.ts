import { esc, gameUrl } from '../html';
import { t } from '../text';
import { icon, type IconName } from './icons';
import { ROUTES } from '../routes';

export type PageId = 'home' | 'berita' | 'peringkat' | 'monster' | 'admin';

export interface NavState {
  signedIn: boolean;
  isAdmin: boolean;
  name?: string;
  email?: string;
  onLogin?: () => void;
  onLogout?: () => void;
}

interface NavLink {
  href: string;
  label: string;
  id: PageId;
  icon: IconName;
}

export function navLinks(state: NavState): NavLink[] {
  const links: NavLink[] = [
    { href: ROUTES.news, label: t('web.nav.news'), id: 'berita', icon: 'scroll' },
    { href: ROUTES.leaderboard, label: t('web.nav.leaderboard'), id: 'peringkat', icon: 'trophy' },
    { href: ROUTES.pedia, label: t('web.nav.pedia'), id: 'monster', icon: 'paw' },
  ];

  if (state.isAdmin) {
    links.push({ href: ROUTES.admin, label: t('web.nav.admin'), id: 'admin', icon: 'key' });
  }

  return links;
}

export function renderLayout(
  root: HTMLElement,
  currentPage: PageId,
  state: NavState = { signedIn: false, isAdmin: false },
): { contentEl: HTMLElement } {
  const links = navLinks(state);
  const playUrl = gameUrl();

  root.innerHTML = `
    <header class="site-header">
      <div class="header-container">
        <a href="${ROUTES.home}" class="logo-brand" aria-label="${t('web.brand')}">
          <img src="/img/logo-small.webp" alt="${t('web.brand')}" width="220" height="178" />
        </a>
        <button class="mobile-toggle" aria-label="${t('web.nav.menu')}" id="mobile-toggle">☰</button>
        <nav class="nav-links" id="nav-links">
          ${links
            .map(
              (l) =>
                `<a href="${l.href}" class="nav-link ${l.id === currentPage ? 'active' : ''}">${icon(l.icon)}${l.label}</a>`,
            )
            .join('')}
        </nav>
        <div class="nav-actions">
          ${
            state.signedIn
              ? `
            <div class="user-badge">
              <span class="user-email" title="${esc(state.email)}">${esc(state.name || state.email || t('web.nav.playerFallback'))}</span>
              <button class="btn-logout" id="btn-logout">${t('web.nav.logout')}</button>
            </div>
            `
              : `
            <button class="btn-gem btn-gem-dark" id="btn-login">${t('web.nav.login')}</button>
            `
          }
          <a href="${esc(playUrl)}" class="btn-gem header-play" target="_blank" rel="noopener noreferrer">${t('web.nav.play')}</a>
        </div>
      </div>
    </header>
    <main class="site-content" id="main-content"></main>
    <footer class="site-footer">
      <div class="footer-container">
        <div class="footer-copy">${t('web.footer.copyright')}</div>
      </div>
    </footer>
  `;

  // Attach event handlers
  const toggleBtn = root.querySelector('#mobile-toggle');
  const navLinksEl = root.querySelector('#nav-links');
  toggleBtn?.addEventListener('click', () => {
    navLinksEl?.classList.toggle('open');
  });

  const loginBtn = root.querySelector('#btn-login');
  loginBtn?.addEventListener('click', () => state.onLogin?.());

  const logoutBtn = root.querySelector('#btn-logout');
  logoutBtn?.addEventListener('click', () => state.onLogout?.());

  const contentEl = root.querySelector('#main-content') as HTMLElement;
  return { contentEl };
}
