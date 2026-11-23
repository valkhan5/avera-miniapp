import { STATUS_LABELS, statusFlow, type Lang, type OrderStatus, type Fulfillment } from './core/statuses.ts';
import { formatSum } from './core/format.ts';
import { formatPhone } from './core/phone.ts';
import { RECIPIENT_LABELS, type Recipient } from './core/recipients.ts';

export interface OrderLine { product_name_ru: string; product_name_uz: string; variant_name_ru: string; variant_name_uz: string; price: number; qty: number }
export interface OrderMsg {
  id: string; number: string; status: OrderStatus; fulfillment: Fulfillment; items: OrderLine[];
  subtotal: number; pickup_discount: number; promo_discount: number; total: number; promo_code: string | null;
  contact_name: string; contact_phone: string; recipient: string | null; card_text: string | null;
  address_text: string | null; landmark: string | null; lat: number | null; lng: number | null; out_of_city: boolean;
  delivery_date: string; delivery_slot: string | null; comment: string | null; tag: string | null;
  customer?: { tg_user_id: number; username: string | null; first_name: string | null; lang: Lang };
}

const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

export function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function humanDate(iso: string, lang: Lang): string {
  const [, m, d] = iso.split('-').map(Number);
  return lang === 'ru' ? `${d} ${MONTHS_RU[m - 1]}` : `${d}-${MONTHS_UZ[m - 1]}`;
}

export function mapLink(lat: number, lng: number): string {
  return `https://yandex.uz/maps/?pt=${lng},${lat}&z=17&l=map`;
}

export function groupOrderText(o: OrderMsg): string {
  const st = STATUS_LABELS.ru[o.fulfillment][o.status];
  const lines = [`<b>Заявка ${o.number}</b> · ${st}`, ''];
  for (const it of o.items) lines.push(`• ${esc(it.product_name_ru)} · ${esc(it.variant_name_ru)} × ${it.qty} — ${formatSum(it.price * it.qty, 'ru')}`);
  if (o.pickup_discount || o.promo_discount) {
    lines.push(`Сумма: ${formatSum(o.subtotal, 'ru')}`);
    if (o.pickup_discount) lines.push(`Скидка за самовывоз: −${formatSum(o.pickup_discount, 'ru')}`);
    if (o.promo_discount) lines.push(`Промокод ${esc(o.promo_code)}: −${formatSum(o.promo_discount, 'ru')}`);
  }
  lines.push(`<b>Итого: ${formatSum(o.total, 'ru')}</b> · оплата при получении`, '');
  if (o.fulfillment === 'pickup') {
    lines.push(`Самовывоз · ${humanDate(o.delivery_date, 'ru')}`);
  } else {
    lines.push(`Доставка · ${humanDate(o.delivery_date, 'ru')}, ${esc(o.delivery_slot)}`);
    lines.push(`Адрес: ${esc(o.address_text)}${o.landmark ? ` (ориентир: ${esc(o.landmark)})` : ''}`);
    if (o.lat != null && o.lng != null) lines.push(`Карта: ${mapLink(o.lat, o.lng)}`);
    if (o.out_of_city) lines.push('<b>ВНЕ ТАШКЕНТА</b> — уточните условия доставки');
  }
  const rec = o.recipient && (RECIPIENT_LABELS.ru as Record<string, string>)[o.recipient];
  if (rec) lines.push(`Кому: ${rec}`);
  if (o.card_text) lines.push(`Открытка: «${esc(o.card_text)}»`);
  lines.push(`Клиент: ${esc(o.contact_name)}, ${formatPhone(o.contact_phone)}${o.customer?.username ? `, @${esc(o.customer.username)}` : ''}`);
  if (o.comment) lines.push(`Комментарий: ${esc(o.comment)}`);
  lines.push(`Метка: ${esc(o.tag) || '—'}`);
  return lines.join('\n');
}

const BUTTON_RU: Record<OrderStatus, string> = {
  new: 'Новая', confirmed: 'Подтвердить', packing: 'Собираем', on_the_way: 'В пути', ready: 'Готов к выдаче', done: 'Доставлена', cancelled: 'Отменить',
};

export function groupOrderKeyboard(o: Pick<OrderMsg, 'id' | 'status' | 'fulfillment'>): { inline_keyboard: { text: string; callback_data: string }[][] } {
  if (o.status === 'done' || o.status === 'cancelled') return { inline_keyboard: [] };
  const flow = statusFlow(o.fulfillment);
  const next = flow.slice(flow.indexOf(o.status) + 1);
  const buttons = [...next, 'cancelled' as OrderStatus].map((s) => ({
    text: s === 'done' && o.fulfillment === 'pickup' ? 'Выдан' : BUTTON_RU[s],
    callback_data: `st:${o.id}:${s}`,
  }));
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: rows };
}

const STATUS_NOTE: Record<Lang, Partial<Record<OrderStatus, string>>> = {
  ru: { confirmed: 'Мы подтвердили заказ.', packing: 'Собираем ваш бокс.', on_the_way: 'Курьер уже в пути.', ready: 'Бокс готов, ждём вас в шоуруме.',
    done: 'Спасибо, что выбрали Avera Mobile.', cancelled: 'Если это ошибка, напишите нам.' },
  uz: { confirmed: 'Buyurtmangiz tasdiqlandi.', packing: 'Qutingizni yigʻyapmiz.', on_the_way: 'Kuryer yoʻlda.', ready: 'Quti tayyor, sizni shourumda kutamiz.',
    done: 'Avera Mobile’ni tanlaganingiz uchun rahmat.', cancelled: 'Agar bu xato boʻlsa, bizga yozing.' },
};

export function customerStatusText(o: Pick<OrderMsg, 'number' | 'status' | 'fulfillment'>, lang: Lang): string {
  return `<b>${o.number}</b> · ${STATUS_LABELS[lang][o.fulfillment][o.status]}\n${STATUS_NOTE[lang][o.status] ?? ''}`.trim();
}

export function welcomeText(): string {
  return [
    '<b>Avera Mobile</b> — yangi yil qutilari. Tanlang va buyurtma bering: Toshkent boʻylab bepul yetkazib berish yoki olib ketishda −10%.',
    '',
    '<b>Avera Mobile</b> — новогодние боксы. Выберите и оформите заказ: бесплатная доставка по Ташкенту или −10% при самовывозе.',
  ].join('\n');
}

export function orderAcceptedText(o: Pick<OrderMsg, 'number' | 'total'>, lang: Lang, promise: string): string {
  return lang === 'ru'
    ? `<b>Заказ ${o.number} принят.</b>\nИтого: ${formatSum(o.total, 'ru')}, оплата при получении.\n${esc(promise)}`
    : `<b>${o.number} buyurtmasi qabul qilindi.</b>\nJami: ${formatSum(o.total, 'uz')}, qabul qilganda toʻlov.\n${esc(promise)}`;
}
