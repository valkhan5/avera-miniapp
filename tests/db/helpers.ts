import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const MIGRATIONS = ['0001_schema.sql', '0002_functions.sql', '0003_rls.sql', '0004_seed.sql', '0006_managers.sql'];

export async function freshDb(now = '2026-12-02T08:00:00+05:00'): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;`);
  for (const f of MIGRATIONS) await db.exec(readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8'));
  await setNow(db, now);
  return db;
}

export async function setNow(db: PGlite, iso: string) {
  await db.query(`select set_config('app.now', $1, false)`, [iso]);
}

export async function call<T = any>(db: PGlite, fn: string, ...args: unknown[]): Promise<T> {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  const r = await db.query<{ r: T }>(`select public.${fn}(${ph}) as r`, args.map((a) => (a !== null && typeof a === 'object' ? JSON.stringify(a) : a)));
  return r.rows[0].r;
}

export async function variantId(db: PGlite, slug: string, kind: 'base' | 'full'): Promise<string> {
  const r = await db.query<{ id: string }>(`select v.id from product_variants v join products p on p.id = v.product_id where p.slug = $1 and v.kind = $2`, [slug, kind]);
  return r.rows[0].id;
}

export async function customer(db: PGlite, id: number, tag: string | null = null) {
  return call(db, 'bootstrap_customer', { id, first_name: `U${id}`, language_code: 'uz' }, tag, 'app_open');
}

export function pickup(items: { variant_id: string; qty: number }[], extra: Record<string, unknown> = {}) {
  return { client_token: randomUUID(), items, fulfillment: 'pickup', contact_name: 'Ali', contact_phone: '90 123 45 67', recipient: 'mom',
    card_text: 'С Новым годом', delivery_date: '2026-12-02', comment: '', tag: 'ig_dm_boks', notify_allowed: true, ...extra };
}

export function delivery(items: { variant_id: string; qty: number }[], extra: Record<string, unknown> = {}) {
  return pickup(items, { fulfillment: 'delivery', address_text: 'Юнусабад 4, кв 12', landmark: 'метро', lat: 41.3111, lng: 69.2797, delivery_slot: '18:00–22:00', ...extra });
}
