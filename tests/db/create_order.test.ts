import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, call, variantId, customer, pickup, delivery, setNow } from './helpers';

describe('create_order', () => {
  let db: PGlite; let START_BASE: string; let START_FULL: string;
  beforeAll(async () => {
    db = await freshDb();
    START_BASE = await variantId(db, 'start', 'base'); START_FULL = await variantId(db, 'start', 'full');
    await customer(db, 111, 'ig_dm_boks'); await customer(db, 222); await customer(db, 333);
  });

  it('creates AV-1001 with stacked pickup and promo discount', async () => {
    const promo = (await call(db, 'issue_promo', 111, 320, 60000)).promo;
    const o = await call(db, 'create_order', 111, pickup([{ variant_id: START_BASE, qty: 1 }], { promo_code: promo.code }));
    expect(o).toMatchObject({ number: 'AV-1001', subtotal: 490000, total: 416000, pickup_discount: 49000, promo_discount: 25000, status: 'new', fulfillment: 'pickup', tag: 'ig_dm_boks', contact_phone: '+998901234567' });
    expect(o.customer.tg_user_id).toBe(111);
  });

  it('returns the same order for a repeated client_token (double tap)', async () => {
    const body = pickup([{ variant_id: START_BASE, qty: 1 }]);
    const a = await call(db, 'create_order', 222, body);
    const b = await call(db, 'create_order', 222, body);
    expect(b.id).toBe(a.id);
  });

  it('refuses when the price changed after the customer saw the total', async () => {
    await expect(call(db, 'create_order', 222, pickup([{ variant_id: START_BASE, qty: 1 }], { expected_subtotal: 450000 }))).rejects.toThrow('PRICE_CHANGED');
    const o = await call(db, 'create_order', 222, pickup([{ variant_id: START_BASE, qty: 2 }], { expected_subtotal: 980000 }));
    expect(o.subtotal).toBe(980000);
  });

  it('requires a map point for delivery', async () => {
    await expect(call(db, 'create_order', 222, delivery([{ variant_id: START_BASE, qty: 1 }], { lat: null }))).rejects.toThrow('NEED_LOCATION');
  });

  it('rejects dates after the last delivery date', async () => {
    await expect(call(db, 'create_order', 222, delivery([{ variant_id: START_BASE, qty: 1 }], { delivery_date: '2027-01-02' }))).rejects.toThrow('BAD_DATE');
  });

  it('rejects same-day orders after the cutoff', async () => {
    await setNow(db, '2026-12-02T17:00:00+05:00');
    await expect(call(db, 'create_order', 222, delivery([{ variant_id: START_BASE, qty: 1 }], { delivery_date: '2026-12-02' }))).rejects.toThrow('BAD_DATE');
    await setNow(db, '2026-12-02T08:00:00+05:00');
  });

  it('rejects an unknown slot, a bad phone, a long card and a bad promo', async () => {
    await expect(call(db, 'create_order', 222, delivery([{ variant_id: START_BASE, qty: 1 }], { delivery_slot: '01:00–02:00' }))).rejects.toThrow('BAD_SLOT');
    await expect(call(db, 'create_order', 222, pickup([{ variant_id: START_BASE, qty: 1 }], { contact_phone: '123' }))).rejects.toThrow('BAD_PHONE');
    await expect(call(db, 'create_order', 222, pickup([{ variant_id: START_BASE, qty: 1 }], { card_text: 'x'.repeat(201) }))).rejects.toThrow('CARD_TOO_LONG');
    const p111 = (await call(db, 'issue_promo', 111, 320, 60000)).promo;
    await expect(call(db, 'create_order', 222, pickup([{ variant_id: START_BASE, qty: 1 }], { promo_code: p111.code }))).rejects.toThrow('BAD_PROMO');
    await expect(call(db, 'create_order', 111, pickup([{ variant_id: START_BASE, qty: 1 }], { promo_code: p111.code }))).rejects.toThrow('BAD_PROMO');
  });

  it('rejects empty carts and quantities above 20', async () => {
    await expect(call(db, 'create_order', 222, pickup([]))).rejects.toThrow('EMPTY_CART');
    await expect(call(db, 'create_order', 222, pickup([{ variant_id: START_BASE, qty: 21 }]))).rejects.toThrow('BAD_QTY');
  });

  it('flags delivery outside Tashkent', async () => {
    const o = await call(db, 'create_order', 222, delivery([{ variant_id: START_BASE, qty: 1 }], { lat: 41.47, lng: 69.58 }));
    expect(o.out_of_city).toBe(true);
  });

  it('enforces stock and restores it on cancel', async () => {
    await db.query(`update product_variants set stock = 1 where id = $1`, [START_FULL]);
    await expect(call(db, 'create_order', 222, pickup([{ variant_id: START_FULL, qty: 2 }]))).rejects.toThrow('OUT_OF_STOCK');
    const o = await call(db, 'create_order', 222, pickup([{ variant_id: START_FULL, qty: 1 }]));
    expect((await db.query<{ stock: number }>(`select stock from product_variants where id = $1`, [START_FULL])).rows[0].stock).toBe(0);
    await call(db, 'set_order_status', o.id, 'cancelled', 'test');
    expect((await db.query<{ stock: number }>(`select stock from product_variants where id = $1`, [START_FULL])).rows[0].stock).toBe(1);
  });

  it('rejects hidden boxes', async () => {
    await db.query(`update product_variants set active = false where id = $1`, [START_BASE]);
    await expect(call(db, 'create_order', 222, pickup([{ variant_id: START_BASE, qty: 1 }]))).rejects.toThrow('UNAVAILABLE');
    await db.query(`update product_variants set active = true where id = $1`, [START_BASE]);
  });

  it('rate-limits to 5 orders per hour', async () => {
    for (let i = 0; i < 5; i++) await call(db, 'create_order', 333, pickup([{ variant_id: START_BASE, qty: 1 }]));
    await expect(call(db, 'create_order', 333, pickup([{ variant_id: START_BASE, qty: 1 }]))).rejects.toThrow('RATE_LIMIT');
  });
});
