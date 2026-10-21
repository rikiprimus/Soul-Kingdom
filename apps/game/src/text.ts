import { gameData, type ActionError } from '@soul-monster/shared';

/** Player-facing text from data/text.json, with `{name}` placeholders. */
export function t(key: string, params: object = {}): string {
  const template = gameData.text[key];
  if (template === undefined) {
    if (import.meta.env.DEV) console.warn(`Teks tidak ada di text.json: ${key}`);
    return key;
  }
  const values = params as Record<string, unknown>;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}

export function errorText(error: ActionError | string): string {
  return t(`error.${error}`);
}

export function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString('id-ID');
}

/** Seconds → "1j 5m 3d" / "5m 3d" / "3d". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return t('time.hms', { h, m, s: sec });
  if (m > 0) return t('time.ms', { m, s: sec });
  return t('time.s', { s: sec });
}

export function percent(p: number): string {
  const value = p * 100;
  return `${value < 1 && value > 0 ? value.toFixed(1) : Math.round(value * 10) / 10}%`;
}
