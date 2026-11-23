export type OrderStatus = 'new' | 'confirmed' | 'packing' | 'on_the_way' | 'ready' | 'done' | 'cancelled';
export type Fulfillment = 'delivery' | 'pickup';
export type Lang = 'uz' | 'ru';

export function statusFlow(f: Fulfillment): OrderStatus[] {
  return ['new', 'confirmed', 'packing', f === 'pickup' ? 'ready' : 'on_the_way', 'done'];
}

export function canTransition(from: OrderStatus, to: OrderStatus, f: Fulfillment): boolean {
  if (from === 'done' || from === 'cancelled' || from === to) return false;
  if (to === 'cancelled') return true;
  return statusFlow(f).includes(to);
}

export const STATUS_LABELS: Record<Lang, Record<Fulfillment, Record<OrderStatus, string>>> = {
  ru: {
    delivery: { new: 'Новая', confirmed: 'Подтверждена', packing: 'Собираем', on_the_way: 'В пути', ready: 'Готов к выдаче', done: 'Доставлена', cancelled: 'Отменена' },
    pickup: { new: 'Новая', confirmed: 'Подтверждена', packing: 'Собираем', on_the_way: 'В пути', ready: 'Готов к выдаче', done: 'Выдан', cancelled: 'Отменена' },
  },
  uz: {
    delivery: { new: 'Yangi', confirmed: 'Tasdiqlandi', packing: 'Yigʻilmoqda', on_the_way: 'Yoʻlda', ready: 'Olib ketishga tayyor', done: 'Yetkazildi', cancelled: 'Bekor qilindi' },
    pickup: { new: 'Yangi', confirmed: 'Tasdiqlandi', packing: 'Yigʻilmoqda', on_the_way: 'Yoʻlda', ready: 'Olib ketishga tayyor', done: 'Topshirildi', cancelled: 'Bekor qilindi' },
  },
};
