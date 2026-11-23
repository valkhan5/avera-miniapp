import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, call, customer, variantId, pickup } from './helpers';

describe('dashboard', () => {
  let db: PGlite;
  beforeAll(async () => { db = await freshDb(); });

  it('counts leads, requests, sales and revenue by tag', async () => {
    await customer(db, 111, 'ig_dm_boks'); await customer(db, 222);
    const promo = (await call(db, 'issue_promo', 111, 320, 60000)).promo;
    const o = await call(db, 'create_order', 111, pickup([{ variant_id: await variantId(db, 'start', 'base'), qty: 1 }], { promo_code: promo.code }));
    await call(db, 'set_order_status', o.id, 'done', 'test');
    await db.query(`insert into managers (email) values ('owner@avera.uz')`);
    await db.query(`select set_config('request.jwt.claims', '{"email":"owner@avera.uz"}', false)`);
    const d = await call(db, 'dashboard', '2026-12-01T00:00:00+05:00', '2027-01-01T00:00:00+05:00', 'last');
    expect(d.kpi).toMatchObject({ leads: 2, requests: 1, sales: 1, revenue: 416000, players: 1, promos_issued: 1, promos_used: 1 });
    expect(d.by_tag).toContainEqual(expect.objectContaining({ tag: 'ig_dm_boks', requests: 1, sales: 1, revenue: 416000 }));
    expect(d.by_product[0]).toMatchObject({ name: 'Старт', qty: 1 });
    expect(d.funnel.map((f: any) => f.n)).toEqual([2, 0, 1, 1, 1]);
  });
});
