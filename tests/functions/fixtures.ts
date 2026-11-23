import { createHmac } from 'node:crypto';
export const TOKEN = '123456:TEST-token';
export function signInitData(fields: Record<string, string>, token = TOKEN): string {
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
export const sampleOrder: any = {
  id: '6f1c2c8e-1111-4a1a-9b1b-222222222222', number: 'AV-1001', status: 'new', fulfillment: 'pickup',
  items: [{ product_name_ru: 'Старт', product_name_uz: 'START', variant_name_ru: 'Базовый', variant_name_uz: 'Bazaviy', price: 490000, qty: 1, cost: 270000 }],
  subtotal: 490000, pickup_discount: 49000, promo_discount: 25000, applied_pct: 15, total: 416000, promo_code: 'ELF-ABC234',
  contact_name: 'Ali <b>', contact_phone: '+998901234567', recipient: 'mom', card_text: 'С Новым годом', address_text: null, landmark: null,
  lat: null, lng: null, out_of_city: false, delivery_date: '2026-12-02', delivery_slot: null, comment: null, tag: 'ig_dm_boks',
  customer: { tg_user_id: 111, username: 'ali', first_name: 'Ali', lang: 'ru' },
};
export const deliveryOrder: any = { ...sampleOrder, fulfillment: 'delivery', pickup_discount: 0, address_text: 'Юнусабад 4', landmark: 'метро',
  lat: 41.3111, lng: 69.2797, delivery_slot: '18:00–22:00' };
