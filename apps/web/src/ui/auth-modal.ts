import { signInWithEmail, signInWithGoogle } from '../auth';
import { t } from '../text';

export function openAuthModal(onSuccess?: () => void): void {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'modal-backdrop';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">${t('web.auth.title')}</h3>
        <button class="modal-close" id="modal-close" aria-label="${t('web.common.close')}">&times;</button>
      </div>
      <div class="modal-body">
        <p class="modal-desc">${t('web.auth.desc')}</p>
        
        <button class="btn-google" id="modal-btn-google">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          ${t('web.auth.google')}
        </button>

        <div class="modal-divider"><span>${t('web.auth.or')}</span></div>

        <form id="modal-auth-form" class="auth-form">
          <div class="form-group">
            <label for="modal-email">${t('web.auth.email')}</label>
            <input type="email" id="modal-email" required placeholder="nama@email.com" class="form-input" />
          </div>
          <div class="form-group">
            <label for="modal-password">${t('web.auth.password')}</label>
            <input type="password" id="modal-password" required placeholder="••••••••" class="form-input" />
          </div>
          <div id="modal-auth-error" class="form-error" style="display: none;"></div>
          <button type="submit" class="btn-primary btn-block" id="modal-submit-btn">${t('web.auth.submit')}</button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#modal-close')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector('#modal-btn-google')?.addEventListener('click', () => {
    signInWithGoogle();
  });

  const form = modal.querySelector('#modal-auth-form') as HTMLFormElement;
  const errorEl = modal.querySelector('#modal-auth-error') as HTMLElement;
  const submitBtn = modal.querySelector('#modal-submit-btn') as HTMLButtonElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = t('web.auth.loading');

    const email = (modal.querySelector('#modal-email') as HTMLInputElement).value;
    const password = (modal.querySelector('#modal-password') as HTMLInputElement).value;

    const res = await signInWithEmail(email, password);
    if (!res.ok) {
      errorEl.textContent = res.error || t('web.auth.failed');
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = t('web.auth.submit');
      return;
    }

    close();
    onSuccess?.();
  });
}
