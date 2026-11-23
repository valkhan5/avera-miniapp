# Avera Mobile Mini App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Telegram Mini App for Avera Mobile New Year boxes (catalog → COD order → status tracking, mini-game with −5% promo, source tags), a manager group bot, and a web admin (orders, customers, catalog, banners, tags, settings, dashboard).

**Architecture:** npm-workspaces monorepo. Two React+Vite static sites (`apps/miniapp`, `apps/admin`) on Cloudflare Pages. Supabase: Postgres (all business rules in SQL functions: pricing, stock, promo, status transitions), Auth (managers), Storage (photos), three Deno Edge Functions (`api` for the Mini App, `bot` for the Telegram webhook, `admin` for status changes and bot setup). Pure TS domain logic lives once in `supabase/functions/_shared/core/` and is imported by functions, both apps and tests.

**Tech Stack:** TypeScript 5.6, React 18.3, Vite 5.4, Vitest 2, @supabase/supabase-js 2, Leaflet 1.9 (OpenStreetMap), Recharts 2, qrcode 1.5, PGlite 0.2 (SQL tests), Playwright (preinstalled), Supabase CLI via `npx supabase`, Wrangler 3 via `npx wrangler`.

**Spec:** `docs/superpowers/specs/2026-11-23-avera-miniapp-design.md`

## Global Constraints

- Languages: Uzbek (default, Latin script) and Russian; every customer-facing string lives in `apps/miniapp/src/i18n/{uz,ru}.ts`; Telegram `language_code` `ru` → ru, everything else → uz; user toggle persists.
- Copy: «вы», no emoji, no «!» in customer-facing text; headings uppercase; slogan `EXCELLENCE IN EVERY DETAIL` stays English.
- Brand colors (exact): night `#0F0E0C`, hazelnut `#39271D`, almond `#644E40`, beige `#B6906B`, sand `#E3D9CF`, linen `#F3ECE4`, paper `#FAF9F6`, pattern-gold `#CFA884`, white `#FFFFFF`, black `#000000`. No other hues. Text contrast ≥ 4.5:1.
- Font: Bounded variable (wght 200–900, SIL OFL), self-hosted woff2 subset (Basic Latin, Latin-1, Cyrillic, U+02BB U+02BC U+2018 U+2019, «» — – · №). Radii 0 / 4px / 8px. No shadows.
- Money: integer sum. Display `490 000 сум` (ru) / `490 000 soʻm` (uz), thousands separator U+00A0.
- Time zone: Asia/Tashkent, fixed UTC+5.
- Order number: `AV-` + sequence starting at 1001.
- Tag: `^[a-z0-9_]{1,64}$`. Link: `https://t.me/AveraMobileBot?startapp=<tag>`.
- Statuses: `new, confirmed, packing, on_the_way (delivery) | ready (pickup), done, cancelled`.
- Settings defaults: pickup 10 %, promo 5 %, stack = true, max discount 15 %, game threshold 300, promo valid until `2026-12-31T23:59:59+05:00`, slots `10:00–14:00`, `14:00–18:00`, `18:00–22:00`, same-day cutoff 16:00, last delivery date `2026-12-31`, contact promise «Менеджер свяжется с вами в течение 15 минут (с 10:00 до 21:00)» / uz equivalent.
- Limits: qty 1–20 per line, card text ≤ 200 chars, ≤ 5 orders per hour per Telegram user.
- Total = subtotal × (100 − applied %) / 100, rounded **down** to 1 000 sum.
- Tashkent bbox for «вне Ташкента» flag: lat 41.17–41.45, lng 69.12–69.47.
- Secrets never in code or chat: `TELEGRAM_BOT_TOKEN` is set by the owner in Supabase secrets.
- Performance: Mini App initial JS ≤ 250 KB gzip; Leaflet and the game load lazily.

## Review Focus

1. Double tap on «Оформить заказ» → exactly one order (client disables the button; server dedupes by `client_token`). Test in Task 2.
2. Location unavailable or denied (old Telegram, desktop) → user can still drop the pin by hand and submit. Test in Task 7.
3. Box hidden, out of stock or repriced while sitting in the cart → clear message, cart refreshed, no silent wrong total. Tests in Task 2 and Task 7.
4. Same-day order after 16:00 or a date after 31 Dec → rejected with a readable message. Test in Task 2.
5. Stale group message: manager taps a status button on an order already cancelled or moved by someone else → no invalid transition, polite callback answer. Tests in Task 2 and Task 5.

---

## File Structure

```
avera-miniapp/
  package.json                     workspaces, scripts: test, build:miniapp, build:admin
  vitest.config.ts                 tests/**/*.test.ts(x)
  tsconfig.base.json               strict, allowImportingTsExtensions, noEmit
  supabase/
    config.toml
    migrations/0001_schema.sql     tables, enums, sequence, indexes
    migrations/0002_functions.sql  create_order, set_order_status, customer_cancel_order,
                                   bootstrap_customer, track_event, issue_promo, dashboard
    migrations/0003_rls.sql        RLS + grants
    migrations/0004_seed.sql       settings row, 3 categories, 8 boxes × 2 variants, 4 banners
    migrations/0005_storage.sql    bucket product-images (Supabase only, skipped in tests)
    functions/_shared/core/        pricing.ts tags.ts statuses.ts phone.ts format.ts geo.ts dates.ts
    functions/_shared/initdata.ts  Telegram initData HMAC validation
    functions/_shared/telegram.ts  Bot API client
    functions/_shared/messages.ts  group / customer / welcome texts + keyboards
    functions/_shared/db.ts        service-role client factory
    functions/api/index.ts         Mini App actions
    functions/bot/index.ts         webhook
    functions/admin/index.ts       set_status, setup_bot, test_group
  packages/brand/                  tokens.css, fonts.css, fonts/bounded.woff2, logos/*.svg, pattern.svg
  apps/miniapp/src/                main.tsx App.tsx router.ts telegram.ts api.ts store.tsx
                                   i18n/ screens/ components/ game/ styles/
  apps/admin/src/                  main.tsx App.tsx supabase.ts adminApi.ts lib/ pages/ components/
  tests/core/ tests/db/ tests/functions/ tests/game/
  scripts/apply-migrations.mjs     Management API SQL runner
  scripts/e2e-miniapp.mjs          Playwright flow with mocked Telegram + mocked API
  scripts/screens.mjs              screenshots of every screen for visual review
```

---

### Task 1: Monorepo, brand package and core domain logic

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`, `supabase/functions/_shared/core/{pricing,tags,statuses,phone,format,geo,dates,index}.ts`, `packages/brand/{tokens.css,fonts.css,fonts/bounded.woff2,logos/*.svg,pattern.svg}`
- Test: `tests/core/{pricing,tags,statuses,phone,format,geo,dates}.test.ts`

**Interfaces:**
- Produces:
  - `calcTotals(lines: {price:number; qty:number}[], fulfillment: Fulfillment, hasPromo: boolean, s: PricingSettings): {subtotal; pickupDiscount; promoDiscount; appliedPct; total}` where `PricingSettings = {pickupDiscountPct; promoDiscountPct; stackDiscounts: boolean; maxDiscountPct}`
  - `normalizeTag(raw?: string|null): string|null`, `buildTag(parts: string[]): string`, `miniAppLink(bot: string, tag?: string|null): string`
  - `type OrderStatus`, `type Fulfillment = 'delivery'|'pickup'`, `statusFlow(f): OrderStatus[]`, `canTransition(from, to, f): boolean`, `STATUS_LABELS[lang][f][status]`
  - `normalizeUzPhone(raw: string): string|null` (→ `+998XXXXXXXXX`), `formatPhone(e164): string`
  - `formatSum(n: number, lang: 'uz'|'ru'): string`
  - `isInTashkent(lat, lng): boolean`
  - `availableDates(now: Date, lastDate: string, cutoffHour: number): string[]` (YYYY-MM-DD, Tashkent time)

- [ ] **Step 1: Scaffold** root workspaces (`apps/*`, `packages/*`), pinned dev deps (typescript 5.6.x, vitest 2.1.x), `git init`, `.gitignore` (node_modules, dist, .env*, supabase/.temp).
- [ ] **Step 2: Write failing tests**

```ts
// pricing.test.ts  (defaults S = {10, 5, true, 15})
expect(calcTotals([{price:490000,qty:1}],'pickup',true,S)).toEqual({subtotal:490000,pickupDiscount:49000,promoDiscount:25000,appliedPct:15,total:416000})
expect(calcTotals([{price:490000,qty:1}],'delivery',false,S).total).toBe(490000)
expect(calcTotals([{price:1190000,qty:2}],'delivery',true,S)).toMatchObject({subtotal:2380000,promoDiscount:119000,total:2261000})
expect(calcTotals([{price:490000,qty:1}],'pickup',true,{...S,stackDiscounts:false})).toMatchObject({appliedPct:10,promoDiscount:0,total:441000})
expect(calcTotals([{price:1000000,qty:1}],'pickup',true,{...S,promoDiscountPct:10}).appliedPct).toBe(15)
// tags.test.ts
expect(normalizeTag('IG_DM_BOKS')).toBe('ig_dm_boks'); expect(normalizeTag('ig dm')).toBeNull()
expect(normalizeTag('ig-dm')).toBeNull(); expect(normalizeTag('a'.repeat(65))).toBeNull(); expect(normalizeTag('')).toBeNull()
expect(buildTag(['ig','dm','Бокс'])).toBe('ig_dm_boks'); expect(buildTag(['IG','Story','12.07'])).toBe('ig_story_1207')
expect(miniAppLink('AveraMobileBot','ig_bio')).toBe('https://t.me/AveraMobileBot?startapp=ig_bio')
// statuses.test.ts
expect(statusFlow('pickup')).toEqual(['new','confirmed','packing','ready','done'])
expect(canTransition('new','cancelled','delivery')).toBe(true); expect(canTransition('cancelled','new','delivery')).toBe(false)
expect(canTransition('done','packing','delivery')).toBe(false); expect(canTransition('packing','ready','delivery')).toBe(false)
expect(STATUS_LABELS.ru.pickup.done).toBe('Выдан'); expect(STATUS_LABELS.ru.delivery.on_the_way).toBe('В пути')
// phone.test.ts
for (const r of ['90 123 45 67','+998 90 123-45-67','998901234567','901234567']) expect(normalizeUzPhone(r)).toBe('+998901234567')
expect(normalizeUzPhone('12345')).toBeNull(); expect(formatPhone('+998901234567')).toBe('+998 90 123 45 67')
// format.test.ts
expect(formatSum(490000,'ru')).toBe('490 000 сум'); expect(formatSum(4490000,'uz')).toBe('4 490 000 soʻm')
// geo.test.ts
expect(isInTashkent(41.3111,69.2797)).toBe(true); expect(isInTashkent(41.47,69.58)).toBe(false); expect(isInTashkent(39.65,66.96)).toBe(false)
// dates.test.ts
expect(availableDates(new Date('2026-11-30T10:00:00Z'),'2026-12-31',16)[0]).toBe('2026-11-30')
expect(availableDates(new Date('2026-11-30T12:00:00Z'),'2026-12-31',16)[0]).toBe('2026-12-01')
expect(availableDates(new Date('2026-11-30T10:00:00Z'),'2026-12-31',16).at(-1)).toBe('2026-12-31')
expect(availableDates(new Date('2027-01-01T05:00:00Z'),'2026-12-31',16)).toEqual([])
```

- [ ] **Step 3: Run** `npx vitest run tests/core` → FAIL (modules missing).
- [ ] **Step 4: Implement** the core modules (no imports outside the folder, `.ts` import extensions so Deno and Vite both load them). `canTransition`: from `done`/`cancelled` → false; to `cancelled` → true; otherwise target must be in `statusFlow(f)` and differ from `from`. Transliteration in `buildTag`: Russian → Latin (б→b, к→k, с→s, ш→sh, ч→ch, ж→zh, х→kh, ц→ts, щ→sch, ю→yu, я→ya, ё/е→e, й→y, ы→y, ь/ъ→''), then drop chars outside `[a-z0-9]`.
- [ ] **Step 5: Run** `npx vitest run tests/core` → PASS.
- [ ] **Step 6: Brand package.** `tokens.css` with the Global Constraints colors as CSS variables (`--night`, `--hazelnut`, … plus semantic `--bg`, `--surface`, `--ink`, `--ink-muted`, `--accent`, `--line`); `fonts.css` with `@font-face` (`font-display: swap`); subset font via `pyftsubset Bounded-Variable.ttf --unicodes=… --flavor=woff2`; logos `avera-icon.svg`, `avera-logo-horizontal(-reverse).svg`, `avera-logo-stacked(-reverse).svg` copied from the AVERA design system assets; `pattern.svg` = light tile built from the arch icon in `#CFA884`.
- [ ] **Step 7: Commit** `feat: monorepo, brand package, core domain logic`.

---

### Task 2: Database schema, business functions, RLS, seed

**Files:**
- Create: `supabase/migrations/0001…0005_*.sql`, `supabase/config.toml`
- Test: `tests/db/helpers.ts` (PGlite boot: stub `auth` schema + roles `anon`, `authenticated`, `service_role`; run 0001–0004), `tests/db/{create_order,status,promo,dashboard}.test.ts`

**Interfaces:**
- Consumes: pricing / status rules from Task 1 (re-expressed in SQL with identical numbers).
- Produces (all `SECURITY DEFINER`, `search_path = public`):
  - `bootstrap_customer(p_user jsonb, p_tag text) returns jsonb` → `{customer, promo}`; sets `first_tag` once, `last_tag` when tag non-null, inserts `events(type='app_open', tag)`.
  - `track_event(p_tg_user_id bigint, p_type text, p_payload jsonb) returns void`; allowed types `product_view, add_to_cart, checkout_open, game_start, game_finish`.
  - `create_order(p_tg_user_id bigint, p jsonb) returns jsonb` (order row incl. `number`). `p` keys: `client_token uuid, items [{variant_id, qty}], fulfillment, contact_name, contact_phone, recipient, card_text, address_text, landmark, lat, lng, delivery_date, delivery_slot, comment, promo_code, tag, notify_allowed`; `promo_code` must be the caller's own unused, unexpired code. Errors raised as `EMPTY_CART, BAD_QTY, UNAVAILABLE, OUT_OF_STOCK, BAD_PHONE, NEED_LOCATION, NEED_ADDRESS, BAD_DATE, BAD_SLOT, CARD_TOO_LONG, BAD_PROMO, RATE_LIMIT`.
  - `set_order_status(p_order_id uuid, p_status text, p_actor text) returns jsonb`; error `BAD_TRANSITION`; cancel restores stock.
  - `customer_cancel_order(p_tg_user_id bigint, p_order_id uuid) returns jsonb`; only owner, only from `new`, else `CANNOT_CANCEL`.
  - `issue_promo(p_tg_user_id bigint, p_score int, p_duration_ms int) returns jsonb` → `{best_score, promo|null, threshold}`; rejects `duration_ms ∉ [55000, 75000]` or `score > duration_ms/1000*80` with `BAD_SCORE`; one code per customer, code `ELF-` + 6 chars `[A-HJ-NP-Z2-9]`.
  - `dashboard(p_from timestamptz, p_to timestamptz, p_attr text) returns jsonb` → `{kpi:{leads, warm_leads, requests, orders, sales, revenue, avg_check, gross_profit, players, promos_issued, promos_used}, by_day[], by_status[], by_product[], by_tag[], funnel[]}`; `p_attr` = `'last'|'first'`; callable by `authenticated` only.
- Tables: `settings (id=1, …all Global Constraints defaults…, bind_code, manager_chat_id, pickup_address_uz/ru, pickup_hours_uz/ru, pickup_lat, pickup_lng)`, `categories`, `products`, `product_variants (… cost int null, stock int null …)`, `banners`, `customers (tg_user_id unique …)`, `events`, `orders (client_token uuid unique, number text unique, out_of_city bool, group_message_id bigint, …)`, `order_status_history`, `promo_codes`.

- [ ] **Step 1: Write failing tests**

```ts
// create_order.test.ts (seeded catalog; customer 111 bootstrapped; clock fixed via set_config('app.now','2026-12-02T08:00:00+05:00') read by fn now_tk())
const o = await createOrder(111, {...pickupBase, items:[{variant_id: START_BASE, qty:1}], promo_code: promo.code}) // after issuing promo
expect(o).toMatchObject({number:'AV-1001', subtotal:490000, total:416000, status:'new', fulfillment:'pickup'})
expect((await createOrder(111, {...same, client_token: o.client_token})).id).toBe(o.id)          // Review Focus 1
await expect(createOrder(111,{...deliveryBase, lat:null})).rejects.toThrow('NEED_LOCATION')
await expect(createOrder(111,{...deliveryBase, delivery_date:'2027-01-02'})).rejects.toThrow('BAD_DATE') // Review Focus 4
await expect(createOrder(111,{...deliveryBase, delivery_date:'2026-12-02'}, '2026-12-02T17:00:00+05:00')).rejects.toThrow('BAD_DATE')
await hideVariant(START_BASE); await expect(createOrder(111, base)).rejects.toThrow('UNAVAILABLE')     // Review Focus 3
await setStock(START_FULL, 1); await expect(createOrder(111,{...base, items:[{variant_id:START_FULL, qty:2}]})).rejects.toThrow('OUT_OF_STOCK')
expect((await createOrder(111,{...deliveryBase, lat:41.47, lng:69.58})).out_of_city).toBe(true)
// 6th order within an hour → RATE_LIMIT ; phone '123' → BAD_PHONE ; card_text 201 chars → CARD_TOO_LONG
// customer 222 using 111's code → BAD_PROMO ; reusing a used code → BAD_PROMO
// status.test.ts
await setStatus(o.id,'confirmed','test'); await setStatus(o.id,'cancelled','test')
await expect(setStatus(o.id,'packing','test')).rejects.toThrow('BAD_TRANSITION')                     // Review Focus 5
expect(await stockOf(START_FULL)).toBe(1)  // restored after cancel
await expect(customerCancel(222, o2.id)).rejects.toThrow('CANNOT_CANCEL')                           // not owner
// promo.test.ts
expect((await issuePromo(111, 250, 60000)).promo).toBeNull()
const p = await issuePromo(111, 320, 60000); expect(p.promo.code).toMatch(/^ELF-[A-HJ-NP-Z2-9]{6}$/)
expect((await issuePromo(111, 900, 60000)).promo.code).toBe(p.promo.code)
await expect(issuePromo(111, 9000, 60000)).rejects.toThrow('BAD_SCORE')
// dashboard.test.ts: 2 customers open, 1 order created, 1 done → kpi {leads:2, requests:1, sales:1, revenue:416000}; by_tag row 'ig_dm_boks'
// rls: as role anon → select from orders fails; as anon → select cost from product_variants fails
```

- [ ] **Step 2: Run** `npx vitest run tests/db` → FAIL.
- [ ] **Step 3: Implement migrations.** Seed = spec section 10 table (names ru/uz, «для кого» lines from the partner deck, compositions and costs from the partner deck, `sort` 1–8; categories `vzroslym`, `detyam`, `dlya-neyo`); banners: pickup −10 %, free delivery, handwritten card, game. RLS: enable on every table; `anon` gets nothing; `authenticated` full CRUD on catalog/banners/settings, select/update on orders/customers, select on events/history/promo; functions `create_order…issue_promo` executable by `service_role` only, `dashboard` by `authenticated`. `now_tk()` reads `current_setting('app.now', true)` falling back to `now()`.
- [ ] **Step 4: Run** `npx vitest run tests/db` → PASS.
- [ ] **Step 5: Commit** `feat(db): schema, order/promo/status functions, RLS, seed`.

---

### Task 3: Edge Function shared modules

**Files:**
- Create: `supabase/functions/_shared/{initdata,telegram,messages,db}.ts`
- Test: `tests/functions/{initdata,messages}.test.ts`

**Interfaces:**
- Produces:
  - `validateInitData(initData: string, botToken: string, nowSec: number, maxAgeSec = 86400): Promise<{user: TgUser; startParam: string|null; authDate: number}|null>` — WebCrypto; secret = HMAC_SHA256(key `"WebAppData"`, botToken); data-check-string = all fields except `hash`, sorted, `k=v` joined by `\n`.
  - `tg(method: string, payload: object): Promise<any>` (reads `TELEGRAM_BOT_TOKEN`).
  - `groupOrderText(order): string` (HTML, Russian), `groupOrderKeyboard(order): InlineKeyboardMarkup` (callback `st:<uuid>:<status>`, only valid next statuses + «Отменить»), `customerStatusText(order, lang): string`, `welcomeText(lang): string`, `orderAcceptedText(order, lang, promise): string`.
  - `serviceClient(): SupabaseClient`.

- [ ] **Step 1: Write failing tests**

```ts
const init = signWithNodeCrypto({auth_date:'1764900000', query_id:'q', start_param:'ig_dm_boks', user: JSON.stringify({id:111,first_name:'Ali',language_code:'uz'})}, TOKEN)
expect(await validateInitData(init, TOKEN, 1764900100)).toMatchObject({user:{id:111}, startParam:'ig_dm_boks'})
expect(await validateInitData(init.replace('Ali','Bob'), TOKEN, 1764900100)).toBeNull()
expect(await validateInitData(init, TOKEN, 1764900000 + 86401)).toBeNull()
expect(await validateInitData('user=%7B%7D', TOKEN, 1)).toBeNull()
expect(groupOrderText(sampleOrder)).toContain('AV-1001'); expect(groupOrderText(sampleOrder)).toContain('ig_dm_boks')
expect(groupOrderText(deliveryOrder)).toContain('https://yandex.uz/maps/?pt=69.2797,41.3111&z=17')
expect(groupOrderKeyboard({...sampleOrder,status:'new'}).inline_keyboard.flat().map(b=>b.callback_data)).toContain(`st:${sampleOrder.id}:confirmed`)
expect(customerStatusText({...sampleOrder,status:'on_the_way',fulfillment:'delivery'},'ru')).toContain('В пути')
```

- [ ] **Step 2: Run** `npx vitest run tests/functions` → FAIL.
- [ ] **Step 3: Implement** the four modules (`npm:@supabase/supabase-js@2` import in `db.ts` only; the tested modules have no Deno-only APIs).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(functions): initData validation, Telegram client, message templates`.

---

### Task 4: Edge Function `api` (Mini App backend)

**Files:**
- Create: `supabase/functions/api/index.ts`, `supabase/functions/api/handlers.ts`
- Test: `tests/functions/api.test.ts` (handlers with a fake `rpc`/`tg`)

**Interfaces:**
- Consumes: Task 2 RPCs, Task 3 modules.
- Produces: `POST /functions/v1/api` body `{action, initData, ...}` → `200 {ok:true, data}` | `400 {ok:false, code}` | `401 {ok:false, code:'AUTH'}`. CORS for the Mini App origin. Actions:
  - `bootstrap` → `{customer, promo, catalog:{categories, products:[{…, variants:[{id,name_uz,name_ru,items_uz,items_ru,price,stock_state:'in'|'low'|'out', left?}]}]}, banners, settings:{pricing, slots, lastDate, cutoffHour, pickup, promise, threshold}}` (never `cost`, never raw `stock` above 3).
  - `track {type, payload}`; `create_order {order}` → order, then group message (store `group_message_id`) and «принят» message to the customer if `notify_allowed`; `my_orders` → list with `history`; `cancel_order {order_id}` → order, then group message edited with «Отменён клиентом»; `game_finish {score, duration_ms}` → issue_promo result.
- Group/customer notification failures are logged and never fail the order.

- [ ] **Step 1: Failing tests:** bad initData → 401; `create_order` RPC error `OUT_OF_STOCK` → `400 {code:'OUT_OF_STOCK'}`; successful order calls `tg('sendMessage', {chat_id: managerChatId, …})` once and `update group_message_id`; `tg` throwing still returns 200; `bootstrap` payload has no `cost` key anywhere (`JSON.stringify(data).includes('"cost"') === false`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (`handlers.ts` takes `{rpc, tg, db, now}` deps; `index.ts` wires real ones). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(functions): Mini App api`.

---

### Task 5: Edge Functions `bot` and `admin`

**Files:**
- Create: `supabase/functions/bot/{index,handlers}.ts`, `supabase/functions/admin/{index,handlers}.ts`
- Test: `tests/functions/{bot,admin}.test.ts`

**Interfaces:**
- `bot`: rejects requests without header `X-Telegram-Bot-Api-Secret-Token == TELEGRAM_WEBHOOK_SECRET`. Handles: private `/start [tag]` → `bootstrap_customer` + `welcomeText(lang)` with `web_app` button (`MINIAPP_URL`); group `/bind <code>` → if code == `settings.bind_code` set `manager_chat_id`; `callback_query st:<id>:<status>` from the manager chat → `set_order_status(actor='@username')`, edit group message, notify customer, `answerCallbackQuery`; on `BAD_TRANSITION` → `answerCallbackQuery('Статус уже изменён')` and refresh the message.
- `admin` (JWT required, user must exist): `set_status {order_id, status}` (same side effects as the callback), `setup_bot` → `setWebhook(url=<project>/functions/v1/bot, secret_token, allowed_updates:['message','callback_query'])`, `setChatMenuButton(web_app 'Открыть магазин')`, `setMyCommands([start])`; `test_group` → test message to the manager chat.

- [ ] **Step 1: Failing tests:** missing secret → 401; `/bind wrong` → no settings update; `/bind <code>` → settings updated with chat id; callback on cancelled order → `answerCallbackQuery` text `Статус уже изменён` and no customer message (Review Focus 5); callback from a non-manager chat → ignored; `admin set_status` without JWT user → 401.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(functions): bot webhook and admin actions`.

---

### Task 6: Mini App shell, home and product screens

**Files:**
- Create: `apps/miniapp/{package.json,vite.config.ts,index.html}`, `src/{main.tsx,App.tsx,router.ts,telegram.ts,api.ts,store.tsx}`, `src/i18n/{index,uz,ru}.ts`, `src/screens/{Home,Product,OpenInTelegram}.tsx`, `src/components/{Header,BannerCarousel,CategoryChips,ProductCard,VariantToggle,Snow,Price}.tsx`, `src/styles/app.css`
- Create: `scripts/e2e-miniapp.mjs`, `scripts/screens.mjs`, `apps/miniapp/src/dev/mockApi.ts` (enabled by `?mock=1`)

**Interfaces:**
- `telegram.ts`: `tgWebApp()`, `initData(): string`, `startParam(): string|null`, `useMainButton(text, onClick, {enabled, loading})`, `useBackButton(onBack)`, `haptic(kind)`, `requestContact(): Promise<string|null>`, `requestWriteAccess(): Promise<boolean>`, `getLocation(): Promise<{lat,lng}|null>` (Telegram LocationManager → `navigator.geolocation` → null).
- `api.ts`: `call<T>(action: string, body?: object): Promise<T>`; throws `ApiError {code}`.
- `store.tsx`: `useStore()` → `{lang, setLang, t, catalog, settings, customer, promo, cart, addToCart(variantId, qty), setQty, removeLine, clearCart, refresh()}`; cart persisted under `avera_cart_v1` (try/catch).
- Routes (hash): `#/`, `#/p/<slug>`, `#/cart`, `#/checkout`, `#/done/<id>`, `#/orders`, `#/orders/<id>`, `#/game`.

- [ ] **Step 1: Failing check:** `scripts/e2e-miniapp.mjs` (Playwright, mocked `window.Telegram.WebApp` + `?mock=1`) asserts: home shows 8 cards and 4 banners; chip «Для неё» leaves 2 cards; product page toggles Базовый/Полный and price changes `1 990 000 → 2 490 000` for Элеганс; UZ/RU switch changes heading; opening without Telegram shows «Откройте в Telegram».
- [ ] **Step 2: Run** `node scripts/e2e-miniapp.mjs home` → FAIL.
- [ ] **Step 3: Implement** per spec sections 5 and 12 (dark New Year theme, light product cards, pattern-gold arch pattern in header, gentle snow canvas only in header).
- [ ] **Step 4: Run** → PASS; `node scripts/screens.mjs` and review screenshots at 390×844 against the brand rules.
- [ ] **Step 5: Commit** `feat(miniapp): shell, home, product`.

---

### Task 7: Cart, checkout, success, my orders

**Files:**
- Create: `src/screens/{Cart,Checkout,Done,Orders,OrderDetail}.tsx`, `src/components/{MapPicker,StatusTimeline,DateSlotPicker,RecipientPicker,PhoneField}.tsx`
- Modify: `scripts/e2e-miniapp.mjs` (add `checkout` scenario)

**Interfaces:**
- Consumes: `calcTotals`, `availableDates`, `normalizeUzPhone`, `isInTashkent`, `STATUS_LABELS` (Task 1); `call('create_order'|'my_orders'|'cancel_order')` (Task 4).
- `MapPicker` (Leaflet, lazy chunk): props `{value:{lat,lng}|null, onChange}`; «Моё местоположение» button; tap/drag to place pin; shows «вне Ташкента» warning.
- Checkout sends `client_token` generated once per checkout visit; MainButton shows spinner and is disabled while pending.

- [ ] **Step 1: Failing e2e scenario `checkout`:** add Старт (base) → cart shows `490 000 сум`; choose «Самовывоз» with promo present → total `416 000 сум`; switch to delivery → submit blocked with «Укажите точку на карте»; geolocation denied → tap on map places pin → submit → Done screen shows `AV-1001` (Review Focus 2); double click on submit → mock API received exactly 1 `create_order` (Review Focus 1); mock returns `UNAVAILABLE` → message «Этот бокс больше недоступен, корзина обновлена» and catalog refetched (Review Focus 3); mock `BAD_DATE` → «Выберите другую дату» (Review Focus 4); Orders list shows status «Новая», cancel → «Отменена».
- [ ] **Step 2: Run** `node scripts/e2e-miniapp.mjs checkout` → FAIL.
- [ ] **Step 3: Implement** per spec section 5 (promo from game prefilled, manual code field, «Корпоративный заказ» hint at qty ≥ 10, «Осталось N» badge, recipient chips, card text counter 200, date chips from `availableDates`, slot chips, pickup block with address/hours, write-access prompt before submit).
- [ ] **Step 4: Run** → PASS; screenshots reviewed.
- [ ] **Step 5: Commit** `feat(miniapp): cart, checkout with map, order tracking`.

---

### Task 8: Game «Эльфы Avera»

**Files:**
- Create: `apps/miniapp/src/game/{engine,render,sprites,input}.ts`, `src/screens/Game.tsx`
- Test: `tests/game/engine.test.ts`

**Interfaces:**
- `createGame(boxes: {name:string; category:'dlya-neyo'|'detyam'|'vzroslym'; golden?:boolean}[], rng: () => number): Game`; `Game.step(dtMs)`, `Game.dispatch(target)`, `Game.state` → `{timeLeftMs, score, streak, multiplier, current:{name,category,golden,ttlMs}|null, finished}`.
- Rules: round 60 000 ms; correct = 10 × multiplier (× 2 if golden); `multiplier = min(1 + floor(streak/5), 3)`; wrong or expired → streak 0; box TTL starts 3 000 ms, −40 ms per delivered box, floor 1 200 ms; golden chance 8 %, only for `vzroslym` boxes named «Флагман».
- End screen calls `call('game_finish', {score, duration_ms})`; shows promo code and «В каталог» / «Ещё раз».

- [ ] **Step 1: Failing tests:** 5 correct deliveries → score 50, multiplier becomes 2 on the 6th (score 70 after 6); wrong dispatch resets streak; expired box resets streak and spawns next; after 60 000 ms `finished === true` and `dispatch` is a no-op; golden correct at multiplier 3 → +60; TTL never below 1 200.
- [ ] **Step 2: Run** `npx vitest run tests/game` → FAIL. **Step 3: Implement** engine, then canvas renderer with own SVG sprites (showroom with arch logo, elf, 3 houses, boxes, snow), swipe/tap input, haptics, DPR scaling, pause on `visibilitychange`, first-run hint.
- [ ] **Step 4: Run** tests → PASS; e2e `game` scenario (mock): play via scripted dispatches → end screen shows promo; FPS check on 4× CPU throttle ≥ 50.
- [ ] **Step 5: Commit** `feat(miniapp): elves mini-game and promo`.

---

### Task 9: Admin — auth, orders, customers

**Files:**
- Create: `apps/admin/{package.json,vite.config.ts,index.html}`, `src/{main.tsx,App.tsx,supabase.ts,adminApi.ts}`, `src/components/{Layout,Sidebar,StatusBadge,Drawer,Table}.tsx`, `src/pages/{Login,Orders,OrderDrawer,Customers}.tsx`, `src/lib/csv.ts`
- Test: `tests/admin/csv.test.ts`

**Interfaces:**
- `adminApi.setStatus(orderId, status)`, `adminApi.setupBot()`, `adminApi.testGroup()` → `admin` function.
- `toCsv(rows: object[], columns: {key, title}[]): string` — `;` separator, UTF-8 BOM, quotes escaped.

- [ ] **Step 1: Failing test:** `toCsv([{a:'x;y', b:'"q"'}], …)` → `'﻿A;B\r\n"x;y";"""q"""\r\n'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** login (email + password), orders table with filters (status, fulfillment, date, tag) and live refresh (Supabase realtime on `orders`), order drawer per spec section 7 (call link `tel:`, Telegram link, Yandex map link, status buttons via `adminApi.setStatus`, manager note autosave), customers table, CSV export.
- [ ] **Step 4: Run** test → PASS; screenshot review in light admin theme.
- [ ] **Step 5: Commit** `feat(admin): auth, orders, customers`.

---

### Task 10: Admin — catalog, banners, tags, settings

**Files:**
- Create: `src/pages/{Catalog,ProductEditor,Banners,Tags,Settings}.tsx`, `src/lib/image.ts`
- Test: `tests/admin/image.test.ts`

**Interfaces:**
- `fitSize(w, h, max = 1200): {w, h}`; `resizeToWebp(file: File, max = 1200, quality = 0.85): Promise<Blob>` (canvas).
- Storage path `product-images/<product_id>/<timestamp>.webp`; public URL saved in `products.images[]`.
- Tags page: generator (source select: `ig`, `tg`, `qr`, `other`; channel: `dm`, `bio`, `story`, `ret`, `ad`, `channel`, `store`, `box`; free detail) → `buildTag` → `miniAppLink` + QR (`qrcode` → PNG download); stats table from `dashboard().by_tag`.
- Settings page: all `settings` fields; «Подключить бота» → `adminApi.setupBot()`; shows `bind_code` with copy button and the manager chat status; «Тестовое сообщение в группу».

- [ ] **Step 1: Failing test:** `fitSize(4000,3000)` → `{w:1200,h:900}`; `fitSize(800,600)` → `{w:800,h:600}`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** pages (hide instead of delete for products/variants that have orders).
- [ ] **Step 4: Run** → PASS; manual pass: create category, product with 2 variants and photo, banner; values appear in Mini App mock bootstrap.
- [ ] **Step 5: Commit** `feat(admin): catalog, banners, tags, settings`.

---

### Task 11: Admin — dashboard

**Files:**
- Create: `src/pages/Dashboard.tsx`, `src/components/{KpiCard,PeriodPicker,charts/*}.tsx`

**Interfaces:**
- Consumes: `rpc('dashboard', {p_from, p_to, p_attr})` (Task 2).
- Periods: today, 7 days, December (`2026-12-01`–`2026-12-31`), custom; attribution toggle first/last tag.
- Charts (Recharts, brand colors only): requests per day (line), funnel (bars), by status, sales by box, by tag table with leads / requests / sales / revenue.

- [ ] **Step 1: Failing check:** screenshot script with seeded local data renders 11 KPI cards and 4 charts without console errors.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(admin): dashboard`.

---

### Task 12: Deploy and connect

**Files:**
- Create: `scripts/apply-migrations.mjs`, `docs/deploy.md`

Steps (each verified by its command output):
- [ ] **Step 1: GitHub** — create private repo `avera-miniapp` under the owner account, push `main`.
- [ ] **Step 2: Supabase** — owner's access token via secure form (host `api.supabase.com`); create or reuse project `avera` in `eu-central-1`; apply migrations 0001–0005 via `POST /v1/projects/{ref}/database/query`; auth config `disable_signup: true`, `site_url` = admin URL; secrets `TELEGRAM_WEBHOOK_SECRET` (random 32 chars), `MINIAPP_URL`, `BOT_USERNAME=AveraMobileBot`; deploy functions: `api` and `bot` with `--no-verify-jwt`, `admin` with JWT; verify `curl …/functions/v1/api` with empty body → `401 {code:'AUTH'}`.
- [ ] **Step 3: Cloudflare Pages** — owner's API token via secure form (host `api.cloudflare.com`); projects `avera-miniapp`, `avera-admin`; `wrangler pages deploy`; verify both URLs return 200.
- [ ] **Step 4: Owner actions** (written step by step in `docs/deploy.md`): paste `TELEGRAM_BOT_TOKEN` into Supabase secrets; BotFather → Bot Settings → Configure Mini App → URL; create own admin user and invite managers in Supabase Auth; admin → Settings → «Подключить бота»; add bot to the group as admin, send `/bind <code>`; reset the group invite link.
- [ ] **Step 5: Live smoke test** in Telegram: open `t.me/AveraMobileBot?startapp=test_smoke`, place a pickup order, see it in the group with buttons, move it to «Выдан», receive customer messages, see it in admin dashboard under tag `test_smoke`; then cancel/delete test data.
- [ ] **Step 6: Commit** `chore: deploy scripts and runbook`.

---

### Task 13: Team guide and roadmap

**Files:**
- Create: team document (published, not in repo) + `docs/guide-outline.md` (source text)

- [ ] **Step 1:** Write the guide per spec section 18: admin and group workflow (statuses, who presses what, response time), tag table with ready links for every code word and placement, Instagram «Быстрые ответы» setup, Instagram targeting link-up (carousel on engagement + lead gen → Direct → app; retarget → app with `ig_ret_*` tags; weekly Monday report by tags), December roadmap by week aligned with the SMM content plan (1–6 launch, 7–13 warm-up, 14–27 peak, 28–31 finish) and January steps (Click/Payme, Meta Pixel + Conversions API events «Заявка»/«Продажа», corporate form).
- [ ] **Step 2:** Publish as a shareable document and send the link.
