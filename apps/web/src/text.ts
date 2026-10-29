import webDataRaw from './generated/web-data.json';

const textMap: Record<string, string> = webDataRaw.text ?? {};

export function t(key: string, params?: Record<string, string | number>): string {
  let str = textMap[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

export function hasText(key: string): boolean {
  return key in textMap;
}

export function errorText(code: string): string {
  return textMap[`web.error.${code}`] ?? textMap['web.error.server'] ?? code;
}

export const webData = webDataRaw;

export type PublicMonster = (typeof webDataRaw)['allMonsters'][number];
