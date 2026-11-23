import type { Lang } from './index';

const M_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const M_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const S_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const S_UZ = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const WD_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WD_UZ = ['ya', 'du', 'se', 'ch', 'pa', 'ju', 'sh'];

export function fmtDate(iso: string, lang: Lang): string {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return lang === 'ru' ? `${d} ${M_RU[m - 1]}` : `${d}-${M_UZ[m - 1]}`;
}

export function chipDate(iso: string, lang: Lang): { top: string; bottom: string } {
  const date = new Date(`${iso}T00:00:00Z`);
  const [, m, d] = iso.split('-').map(Number);
  return { top: (lang === 'ru' ? WD_RU : WD_UZ)[date.getUTCDay()], bottom: `${d} ${(lang === 'ru' ? S_RU : S_UZ)[m - 1]}` };
}
