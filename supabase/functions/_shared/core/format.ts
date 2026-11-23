import type { Lang } from './statuses.ts';

export function formatNumber(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatSum(n: number, lang: Lang): string {
  return `${formatNumber(n)} ${lang === 'ru' ? 'сум' : 'soʻm'}`;
}
