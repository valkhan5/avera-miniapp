import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, call, customer, variantId, pickup } from './helpers';

const asUser = async (db: PGlite, email: string) => {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ email, role: 'authenticated' })]);
  await db.exec('set role authenticated');
};

describe('manager allowlist', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDb();
    await customer(db, 111, 'ig_bio');
    await call(db, 'create_order', 111, pickup([{ variant_id: await variantId(db, 'start', 'base'), qty: 1 }]));
    await db.query(`insert into managers (email) values ('owner@avera.uz')`);
  });

  it('a signed-in stranger sees no orders, customers or settings and cannot run the dashboard', async () => {
    const catId = (await db.query<{ id: string }>('select id from categories limit 1')).rows[0].id;
    await asUser(db, 'stranger@mail.com');
    expect((await db.query('select id from orders')).rows).toHaveLength(0);
    expect((await db.query('select id from customers')).rows).toHaveLength(0);
    expect((await db.query('select id from settings')).rows).toHaveLength(0);
    await expect(db.query(`select dashboard(now() - interval '30 days', now() + interval '1 day', 'last')`)).rejects.toThrow('FORBIDDEN');
    await expect(db.query(`insert into products (category_id, slug, name_uz, name_ru) values ($1, 'x', 'x', 'x')`, [catId])).rejects.toThrow(/row-level security/);
    await db.exec('reset role');
  });

  it('a listed manager (any letter case) sees data and can run the dashboard', async () => {
    await asUser(db, 'Owner@Avera.uz');
    expect((await db.query('select id from orders')).rows).toHaveLength(1);
    expect((await db.query('select id from settings')).rows).toHaveLength(1);
    const d = (await db.query<{ d: any }>(`select dashboard('2026-12-01T00:00:00+05:00', '2027-01-01T00:00:00+05:00', 'last') as d`)).rows[0].d;
    expect(d.kpi.requests).toBe(1);
    await db.exec('reset role');
  });
});
