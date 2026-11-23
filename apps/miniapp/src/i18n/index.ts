import { ru, type Dict } from './ru';
import { uz } from './uz';

export type Lang = 'uz' | 'ru';
export type Key = keyof Dict;
const DICTS: Record<Lang, Dict> = { ru, uz };

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? DICTS.ru[key] ?? String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export function hasKey(key: string): key is Key {
  return key in ru;
}
