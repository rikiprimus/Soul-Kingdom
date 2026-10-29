import { esc } from '../html';
import { t, type PublicMonster } from '../text';

/** Body outline per role: a tank is wide and round, a fighter has horns, a shooter is slim. */
const BODY: Record<string, string> = {
  penahan: 'M14 50 C10 30 20 18 32 18 C44 18 54 30 50 50 Z',
  petarung:
    'M16 50 C13 34 20 24 26 22 L22 10 L30 19 C31 19 33 19 34 19 L42 10 L38 22 C44 24 51 34 48 50 Z',
  penembak: 'M20 50 C18 34 24 22 32 22 C40 22 46 34 44 50 Z M31 22 L29 9 L33 9 Z',
};

/**
 * Code-drawn monster (no painted monster art on the website yet): an outline shaped by the
 * role, coloured by the element. A locked monster is a dark silhouette.
 */
export function monsterSprite(
  m: PublicMonster,
  locked: boolean,
  className = 'monster-sprite',
): string {
  const color = locked ? '#1d1736' : esc(m.elementColor);
  const body = BODY[m.role] ?? BODY.penahan!;
  const face = locked
    ? ''
    : `<ellipse cx="26" cy="36" rx="3.2" ry="4" fill="#1d1736"/><ellipse cx="38" cy="36" rx="3.2" ry="4" fill="#1d1736"/>
       <circle cx="27" cy="34.6" r="1.2" fill="#fff"/><circle cx="39" cy="34.6" r="1.2" fill="#fff"/>
       <path d="M29 43 Q32 45.5 35 43" stroke="#1d1736" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  return `<svg class="${className}${locked ? ' sprite-locked' : ''}" viewBox="0 0 64 56" role="img" aria-label="${locked ? t('web.pedia.lockedName') : esc(m.name)}">
      <ellipse cx="32" cy="51" rx="18" ry="3.5" fill="#000" opacity="0.25"/>
      <path d="${body}" fill="${color}" stroke="rgba(0,0,0,0.45)" stroke-width="1.5"/>
      <path d="${body}" fill="url(#shine)" opacity="${locked ? 0 : 0.35}"/>
      <defs><linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      ${face}
    </svg>`;
}

export function elementBadge(m: PublicMonster): string {
  return `<span class="element-badge" style="--element: ${esc(m.elementColor)}">${esc(m.elementName)}</span>`;
}

/** One monster tile, framed by its tier; a locked one hides its name and element. */
export function monsterCard(m: PublicMonster, locked: boolean, href?: string): string {
  const tag = href ? 'a' : 'div';
  return `
    <${tag} class="monster-card tier-${m.tier} ${locked ? 'locked' : ''}" data-id="${esc(m.id)}"${href ? ` href="${href}"` : ''}>
      <div class="monster-sprite-box">${monsterSprite(m, locked)}</div>
      <div class="monster-name">${locked ? t('web.pedia.lockedName') : esc(m.name)}</div>
      <div class="monster-tier">${t('web.common.tier', { tier: m.tier })} · ${esc(m.tierName)}</div>
      <div class="monster-element">${locked ? t('web.pedia.lockedElement') : elementBadge(m)}</div>
    </${tag}>
  `;
}
