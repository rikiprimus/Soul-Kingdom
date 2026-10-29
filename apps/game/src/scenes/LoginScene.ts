import Phaser from 'phaser';
import type { GameStore } from '../store';
import { t } from '../text';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'legacy';

export class LoginScene extends Phaser.Scene {
  private mode: AuthMode = 'signin';
  private overlayEl?: HTMLElement;
  private bgGraphics?: Phaser.GameObjects.Graphics;
  private glowGraphics?: Phaser.GameObjects.Graphics;

  constructor(private readonly store: GameStore) {
    super('login');
  }

  create(): void {
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanUpDom());
    this.createBackdrop();

    const onResize = () => {
      this.createBackdrop();
    };
    this.scale.on('resize', onResize);

    void this.checkInitialSession();
  }

  private async checkInitialSession(): Promise<void> {
    this.renderDomOverlay('loading');

    // Offline mode: proceed immediately without login.
    if (!this.store.online) {
      this.enterGame();
      return;
    }

    const auth = await this.store.checkAuth();
    if (auth.state === 'authenticated') {
      this.enterGame();
      return;
    }

    if (auth.state === 'anonymous') {
      this.mode = 'legacy';
    } else {
      this.mode = 'signin';
    }

    this.renderDomOverlay('form');
  }

  private enterGame(): void {
    this.cleanUpDom();
    this.store.startServerSync();
    // The village launches the UI scene itself.
    this.scene.start('village');
  }

  private createBackdrop(): void {
    if (this.bgGraphics) this.bgGraphics.destroy();
    if (this.glowGraphics) this.glowGraphics.destroy();

    const width = this.scale.width;
    const height = this.scale.height;

    this.bgGraphics = this.add.graphics();
    this.bgGraphics.fillStyle(0x0f0b1d, 1);
    this.bgGraphics.fillRect(0, 0, width, height);

    // Glowing atmospheric ambient shapes
    this.glowGraphics = this.add.graphics();
    this.glowGraphics.fillStyle(0x351d66, 0.4);
    this.glowGraphics.fillCircle(width * 0.5, height * 0.45, Math.min(width, height) * 0.65);
    this.glowGraphics.fillStyle(0xffb703, 0.08);
    this.glowGraphics.fillCircle(width * 0.5, height * 0.35, Math.min(width, height) * 0.4);
  }

  private renderDomOverlay(view: 'loading' | 'form'): void {
    this.cleanUpDom();

    const overlay = document.createElement('div');
    overlay.id = 'login-scene-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
      pointer-events: auto;
      font-family: Fredoka, system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: #f4f0ff;
    `;

    if (view === 'loading') {
      overlay.innerHTML = `
        <div style="
          background: rgba(22, 17, 42, 0.95);
          border: 1px solid #4b3f7d;
          border-radius: 16px;
          padding: 32px 40px;
          text-align: center;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
        ">
          <div style="font-size: 24px; font-weight: 700; color: #ffc83d; margin-bottom: 8px; letter-spacing: 0.5px;">
            ✦ SOUL KINGDOM ✦
          </div>
          <div style="font-size: 14px; color: #b4aad6;">
            ${t('auth.connecting')}
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      this.overlayEl = overlay;
      return;
    }

    const isLegacy = this.mode === 'legacy';
    const isForgot = this.mode === 'forgot';
    const isSignIn = this.mode === 'signin';

    overlay.innerHTML = `
      <div style="
        background: rgba(22, 17, 42, 0.96);
        border: 1.5px solid #4b3f7d;
        border-radius: 18px;
        padding: 28px 32px;
        max-width: 420px;
        width: 100%;
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(12px);
        box-sizing: border-box;
      ">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 22px; font-weight: 700; color: #ffc83d; letter-spacing: 0.5px; margin-bottom: 4px;">
            ✦ SOUL KINGDOM ✦
          </div>
          ${
            isLegacy
              ? `
            <div style="font-size: 16px; font-weight: 600; color: #ffffff; margin-top: 8px;">
              ${t('auth.legacyNotice')}
            </div>
            <div style="font-size: 13px; color: #b4aad6; margin-top: 6px; line-height: 1.5;">
              ${t('auth.legacyDesc')}
            </div>
          `
              : ''
          }
        </div>

        ${
          isLegacy
            ? `
          <button id="btn-link-google" style="
            width: 100%;
            background: #4285f4;
            color: #ffffff;
            font-family: inherit;
            font-size: 14px;
            font-weight: 600;
            padding: 12px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 14px;
            box-shadow: 0 4px 14px rgba(66, 133, 244, 0.35);
          ">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            ${t('auth.linkGoogle')}
          </button>

          <button id="btn-skip-guest" style="
            width: 100%;
            background: #2a2148;
            color: #b4aad6;
            font-family: inherit;
            font-size: 13px;
            font-weight: 500;
            padding: 10px;
            border: 1px solid #4b3f7d;
            border-radius: 10px;
            cursor: pointer;
          ">
            ${t('auth.continueGuest')}
          </button>
          <div id="link-status" style="font-size: 12px; margin-top: 12px; display: none; text-align: center; color: #ff5c7a;"></div>
        `
            : `
          ${
            !isForgot
              ? `
            <div style="display: flex; gap: 8px; margin-bottom: 18px;">
              <button id="tab-signin" style="
                flex: 1;
                background: ${isSignIn ? '#ffc83d' : '#2a2148'};
                color: ${isSignIn ? '#1a1200' : '#b4aad6'};
                font-family: inherit;
                font-size: 13px;
                font-weight: 600;
                padding: 8px;
                border: 1px solid ${isSignIn ? '#ffc83d' : '#4b3f7d'};
                border-radius: 8px;
                cursor: pointer;
              ">${t('auth.signIn')}</button>
              <button id="tab-signup" style="
                flex: 1;
                background: ${!isSignIn ? '#ffc83d' : '#2a2148'};
                color: ${!isSignIn ? '#1a1200' : '#b4aad6'};
                font-family: inherit;
                font-size: 13px;
                font-weight: 600;
                padding: 8px;
                border: 1px solid ${!isSignIn ? '#ffc83d' : '#4b3f7d'};
                border-radius: 8px;
                cursor: pointer;
              ">${t('auth.signUp')}</button>
            </div>

            <button id="btn-google" style="
              width: 100%;
              background: #ffffff;
              color: #222222;
              font-family: inherit;
              font-size: 14px;
              font-weight: 500;
              padding: 11px;
              border: none;
              border-radius: 10px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              margin-bottom: 16px;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              ${t('auth.google')}
            </button>

            <div style="display: flex; align-items: center; margin-bottom: 16px; font-size: 12px; color: #b4aad6;">
              <span style="flex: 1; border-bottom: 1px solid #4b3f7d;"></span>
              <span style="padding: 0 10px;">${t('auth.or')}</span>
              <span style="flex: 1; border-bottom: 1px solid #4b3f7d;"></span>
            </div>
          `
              : `
            <div style="margin-bottom: 16px; text-align: center;">
              <div style="font-size: 15px; font-weight: 600; color: #ffc83d;">${t('auth.recoverTitle')}</div>
              <div style="font-size: 12px; color: #b4aad6; margin-top: 4px;">${t('auth.recoverDesc')}</div>
            </div>
          `
          }

          <form id="auth-form">
            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 12px; color: #b4aad6; margin-bottom: 6px;">${t('auth.email')}</label>
              <input type="email" id="input-email" required placeholder="${t('auth.enterEmail')}" style="
                width: 100%;
                background: #1d1736;
                border: 1.5px solid #4b3f7d;
                border-radius: 8px;
                padding: 10px 12px;
                color: #f4f0ff;
                font-family: inherit;
                font-size: 14px;
                box-sizing: border-box;
                outline: none;
              " />
            </div>

            ${
              !isForgot
                ? `
              <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: #b4aad6; margin-bottom: 6px;">${t('auth.password')}</label>
                <input type="password" id="input-password" required placeholder="${t('auth.enterPassword')}" style="
                  width: 100%;
                  background: #1d1736;
                  border: 1.5px solid #4b3f7d;
                  border-radius: 8px;
                  padding: 10px 12px;
                  color: #f4f0ff;
                  font-family: inherit;
                  font-size: 14px;
                  box-sizing: border-box;
                  outline: none;
                " />
              </div>
            `
                : ''
            }

            <div id="form-status" style="font-size: 12px; margin-bottom: 14px; display: none; text-align: center;"></div>

            <button type="submit" id="btn-submit" style="
              width: 100%;
              background: linear-gradient(135deg, #ffd866 0%, #e0a21a 100%);
              color: #1a1200;
              font-family: inherit;
              font-size: 14px;
              font-weight: 700;
              padding: 12px;
              border: none;
              border-radius: 10px;
              cursor: pointer;
              margin-bottom: 12px;
              box-shadow: 0 4px 14px rgba(224, 162, 26, 0.35);
            ">
              ${isForgot ? t('auth.resetPassword') : isSignIn ? t('auth.signIn') : t('auth.signUp')}
            </button>
          </form>

          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #b4aad6; margin-top: 6px;">
            <button id="toggle-forgot" style="background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; padding: 0; font-family: inherit;">
              ${isForgot ? t('auth.backToSignIn') : t('auth.forgotPassword')}
            </button>
            ${
              import.meta.env.DEV
                ? `<button id="btn-bypass-dev" style="background: none; border: none; color: #7ed957; cursor: pointer; padding: 0; font-family: inherit; font-size: 11px;">
              ${t('auth.skipDev')} &rarr;
            </button>`
                : ''
            }
          </div>
        `
        }
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlayEl = overlay;

    // Attach event listeners
    if (isLegacy) {
      overlay.querySelector('#btn-link-google')?.addEventListener('click', async () => {
        // Linking keeps the guest's user id (and save); a plain Google sign-in would not.
        const res = await this.store.linkGoogle();
        if (res.ok) return;
        const status = overlay.querySelector('#link-status') as HTMLElement;
        status.textContent = res.error || t('error.server');
        status.style.display = 'block';
      });
      overlay.querySelector('#btn-skip-guest')?.addEventListener('click', () => {
        this.enterGame();
      });
      return;
    }

    overlay.querySelector('#tab-signin')?.addEventListener('click', () => {
      this.mode = 'signin';
      this.renderDomOverlay('form');
    });

    overlay.querySelector('#tab-signup')?.addEventListener('click', () => {
      this.mode = 'signup';
      this.renderDomOverlay('form');
    });

    overlay.querySelector('#btn-google')?.addEventListener('click', () => {
      this.store.signInWithGoogle();
    });

    overlay.querySelector('#toggle-forgot')?.addEventListener('click', () => {
      this.mode = isForgot ? 'signin' : 'forgot';
      this.renderDomOverlay('form');
    });

    overlay.querySelector('#btn-bypass-dev')?.addEventListener('click', () => {
      this.store.goOffline();
      this.enterGame();
    });

    const form = overlay.querySelector('#auth-form') as HTMLFormElement;
    const statusEl = overlay.querySelector('#form-status') as HTMLElement;
    const submitBtn = overlay.querySelector('#btn-submit') as HTMLButtonElement;

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.style.display = 'none';

      const email = (overlay.querySelector('#input-email') as HTMLInputElement)?.value.trim() ?? '';
      const password = (overlay.querySelector('#input-password') as HTMLInputElement)?.value ?? '';

      if (!email || !email.includes('@')) {
        statusEl.textContent = t('auth.invalidEmail');
        statusEl.style.color = '#ff5c7a';
        statusEl.style.display = 'block';
        return;
      }

      if (this.mode === 'forgot') {
        submitBtn.disabled = true;
        submitBtn.textContent = t('auth.loading');
        const res = await this.store.recoverPassword(email);
        submitBtn.disabled = false;
        submitBtn.textContent = t('auth.resetPassword');

        if (res.ok) {
          statusEl.textContent = t('auth.resetSent');
          statusEl.style.color = '#7ed957';
          statusEl.style.display = 'block';
        } else {
          statusEl.textContent = res.error || t('error.server');
          statusEl.style.color = '#ff5c7a';
          statusEl.style.display = 'block';
        }
        return;
      }

      if (!password || password.length < 6) {
        statusEl.textContent = t('auth.shortPassword');
        statusEl.style.color = '#ff5c7a';
        statusEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = t('auth.loading');

      if (this.mode === 'signup') {
        const res = await this.store.signUpWithEmail(email, password);
        submitBtn.disabled = false;
        submitBtn.textContent = t('auth.signUp');

        if (!res.ok) {
          statusEl.textContent = res.error || t('error.server');
          statusEl.style.color = '#ff5c7a';
          statusEl.style.display = 'block';
        } else if (res.session) {
          this.enterGame();
        } else {
          statusEl.textContent = t('auth.signUpSuccess');
          statusEl.style.color = '#7ed957';
          statusEl.style.display = 'block';
          this.mode = 'signin';
          setTimeout(() => this.renderDomOverlay('form'), 1500);
        }
        return;
      }

      // Sign in mode
      const res = await this.store.signInWithEmail(email, password);
      submitBtn.disabled = false;
      submitBtn.textContent = t('auth.signIn');

      if (res.ok) {
        this.enterGame();
      } else {
        statusEl.textContent = t('auth.loginFailed');
        statusEl.style.color = '#ff5c7a';
        statusEl.style.display = 'block';
      }
    });
  }

  private cleanUpDom(): void {
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = undefined;
    }
  }
}
