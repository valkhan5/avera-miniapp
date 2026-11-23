// In-memory backend for ?mock=1 (preview, screenshots, e2e). Mirrors the api Edge Function contract.
import data from './mockCatalog.json';
import { calcTotals, normalizeUzPhone } from '@core';
import { ApiError } from '../api';

const q = new URLSearchParams(location.search);
const calls: any[] = (window.__mockCalls = []);
const orders: any[] = [];
let promo: any = q.has('promo') ? { code: 'ELF-TEST42', pct: 5, valid_until: '2026-12-31T23:59:59+05:00' } : null;
let failOnce = q.get('fail');
let seq = 1000;

const s: any = (data as any).settings;
const settings = {
  pricing: { pickupDiscountPct: s.pickup_discount_pct, promoDiscountPct: s.promo_discount_pct, stackDiscounts: s.stack_discounts, maxDiscountPct: s.max_discount_pct },
  slots: s.delivery_slots, lastDate: s.last_delivery_date, cutoffHour: s.same_day_cutoff_hour, threshold: s.game_threshold,
  promoValidUntil: s.promo_valid_until,
  pickup: { address_ru: 'Ташкент, ул. Амира Темура, 15', address_uz: 'Toshkent, Amir Temur koʻchasi, 15', hours_ru: 'Ежедневно 10:00–21:00', hours_uz: 'Har kuni 10:00–21:00', lat: 41.3111, lng: 69.2797 },
  promise: { ru: s.contact_promise_ru, uz: s.contact_promise_uz },
};

function catalog() {
  const products = (data as any).products.map((p: any) => ({
    ...p,
    variants: (data as any).variants.filter((v: any) => v.product_id === p.id).map(({ stock, ...v }: any) => ({ ...v, stock_state: 'in' })),
  }));
  if (products[3]) products[3].variants[0] = { ...products[3].variants[0], stock_state: 'low', left: 2 };
  return { categories: (data as any).categories, products };
}

const variantIndex = () => {
  const m = new Map<string, any>();
  for (const p of catalog().products) for (const v of p.variants) m.set(v.id, { v, p });
  return m;
};

function makeOrder(body: any) {
  const idx = variantIndex();
  const items = (body.items ?? []).map((l: any) => {
    const { v, p } = idx.get(l.variant_id);
    return { variant_id: v.id, product_name_ru: p.name_ru, product_name_uz: p.name_uz, variant_name_ru: v.name_ru, variant_name_uz: v.name_uz, price: v.price, qty: l.qty };
  });
  const usePromo = !!body.promo_code && promo && body.promo_code === promo.code;
  const t = calcTotals(items, body.fulfillment, usePromo, settings.pricing);
  seq += 1;
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), number: `AV-${seq}`, status: 'new', ...body, items, contact_phone: normalizeUzPhone(body.contact_phone ?? '') ?? body.contact_phone,
    subtotal: t.subtotal, pickup_discount: t.pickupDiscount, promo_discount: t.promoDiscount, total: t.total, promo_code: usePromo ? promo.code : null,
    created_at: now, history: [{ status: 'new', at: now }] };
}

if (q.has('seedorder')) {
  const v = catalog().products[0].variants[0];
  orders.push(makeOrder({ items: [{ variant_id: v.id, qty: 1 }], fulfillment: 'pickup', contact_name: 'Ali', contact_phone: '901234567', delivery_date: '2026-12-02' }));
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockCall(action: string, body: any): Promise<any> {
  calls.push({ action, ...body });
  await delay(action === 'create_order' ? 400 : 60);
  switch (action) {
    case 'bootstrap':
      return { customer: { id: 'c1', first_name: 'Ali' }, promo, settings, startParam: 'ig_dm_boks', banners: (data as any).banners, ...{ catalog: catalog() } };
    case 'track': return null;
    case 'create_order': {
      if (failOnce) { const c = failOnce; failOnce = null; throw new ApiError(c); }
      const existing = orders.find((o) => o.client_token === body.order.client_token);
      if (existing) return existing;
      const o = makeOrder(body.order);
      if (o.promo_code) promo = null;
      orders.unshift(o);
      return o;
    }
    case 'my_orders': return orders;
    case 'cancel_order': {
      const o = orders.find((x) => x.id === body.order_id);
      if (!o || o.status !== 'new') throw new ApiError('CANNOT_CANCEL');
      o.status = 'cancelled'; o.history.push({ status: 'cancelled', at: new Date().toISOString() });
      return o;
    }
    case 'game_finish': {
      if (Number(body.score) >= settings.threshold && !promo) promo = { code: 'ELF-TEST42', pct: 5, valid_until: settings.promoValidUntil, used: false };
      return { best_score: body.score, threshold: settings.threshold, promo };
    }
    default: throw new ApiError('BAD_ACTION');
  }
}
