import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, call, variantId, customer, pickup } from './helpers';

describe('order status', () => {
  let db: PGlite; let V: string;
  beforeAll(async () => { db = await freshDb(); V = await variantId(db, 'flagman', 'base'); await customer(db, 111); await customer(db, 222); });

  it('moves along the flow and records history', async () => {
    const o = await call(db, 'create_order', 111, pickup([{ variant_id: V, qty: 1 }]));
    const c = await call(db, 'set_order_status', o.id, 'confirmed', '@manager');
    expect(c.status).toBe('confirmed');
    const h = await db.query(`select from_status, to_status, actor from order_status_history where order_id = $1 order by id`, [o.id]);
    expect(h.rows).toEqual([{ from_status: null, to_status: 'new', actor: 'customer' }, { from_status: 'new', to_status: 'confirmed', actor: '@manager' }]);
  });

  it('refuses transitions out of cancelled (stale button)', async () => {
    const o = await call(db, 'create_order', 111, pickup([{ variant_id: V, qty: 1 }]));
    await call(db, 'set_order_status', o.id, 'cancelled', 'test');
    await expect(call(db, 'set_order_status', o.id, 'packing', 'test')).rejects.toThrow('BAD_TRANSITION');
  });

  it('refuses a change when the order moved since the button was drawn', async () => {
    await customer(db, 333);
    const o = await call(db, 'create_order', 333, pickup([{ variant_id: V, qty: 1 }]));
    await call(db, 'set_order_status', o.id, 'packing', '@a', 'new');
    await expect(call(db, 'set_order_status', o.id, 'confirmed', '@b', 'new')).rejects.toThrow('BAD_TRANSITION');
    expect((await call(db, 'set_order_status', o.id, 'ready', '@b', 'packing')).status).toBe('ready');
  });

  it('refuses on_the_way for pickup orders', async () => {
    const o = await call(db, 'create_order', 111, pickup([{ variant_id: V, qty: 1 }]));
    await expect(call(db, 'set_order_status', o.id, 'on_the_way', 'test')).rejects.toThrow('BAD_TRANSITION');
  });

  it('lets only the owner cancel, only while new', async () => {
    const o = await call(db, 'create_order', 111, pickup([{ variant_id: V, qty: 1 }]));
    await expect(call(db, 'customer_cancel_order', 222, o.id)).rejects.toThrow('CANNOT_CANCEL');
    expect((await call(db, 'customer_cancel_order', 111, o.id)).status).toBe('cancelled');
    const o2 = await call(db, 'create_order', 111, pickup([{ variant_id: V, qty: 1 }]));
    await call(db, 'set_order_status', o2.id, 'confirmed', 'test');
    await expect(call(db, 'customer_cancel_order', 111, o2.id)).rejects.toThrow('CANNOT_CANCEL');
  });

  it('hides orders and cost from anon and blocks direct status edits by managers', async () => {
    await db.exec('set role anon');
    await expect(db.query('select id from orders')).rejects.toThrow(/permission denied/);
    await expect(db.query('select cost from product_variants')).rejects.toThrow(/permission denied/);
    await db.exec('reset role; set role authenticated');
    await expect(db.query(`update orders set status = 'done'`)).rejects.toThrow(/permission denied/);
    await db.query(`update orders set manager_note = 'ok'`);
    await db.exec('reset role');
  });
});
