// Builds the Mini App mock catalog from the real seed migrations (single source of truth).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync } from 'node:fs';

const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;`);
for (const f of ['0001_schema.sql', '0002_functions.sql', '0003_rls.sql', '0004_seed.sql']) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
const q = async (sql) => (await db.query(sql)).rows;
const out = {
  categories: await q('select * from categories order by sort'),
  products: await q('select * from products order by sort'),
  variants: await q('select id, product_id, kind, name_uz, name_ru, items_uz, items_ru, price, stock, sort, active from product_variants order by sort'),
  banners: await q('select * from banners order by sort'),
  settings: (await q('select * from settings'))[0],
};
writeFileSync('apps/miniapp/src/dev/mockCatalog.json', JSON.stringify(out, null, 1));
console.log('products', out.products.length, 'variants', out.variants.length, 'banners', out.banners.length);
