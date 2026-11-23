// Playwright checks of the Mini App against the built bundle in mock mode (?mock=1).
// Usage: node scripts/e2e-miniapp.mjs <home|checkout|game|all>
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn, execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const scenario = process.argv[2] ?? 'all';
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;

execSync('npx vite build --logLevel error', { cwd: 'apps/miniapp', stdio: 'inherit' });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: 'apps/miniapp', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch();
const results = [];
async function page(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => results.push(`pageerror: ${e.message}`));
  await p.route('**/telegram-web-app.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await p.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto(BASE + url);
  return p;
}
async function check(name, fn) {
  try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); }
}
const text = (p, sel) => p.locator(sel).first().innerText();

if (scenario === 'home' || scenario === 'all') {
  await check('home: 8 product cards and 4 banners', async () => {
    const p = await page('?mock=1#/');
    await p.waitForSelector('[data-test=product-card]');
    assert.equal(await p.locator('[data-test=product-card]').count(), 8);
    assert.equal(await p.locator('[data-test=banner]').count(), 4);
  });
  await check('home: category chip «Для неё» leaves 2 cards', async () => {
    const p = await page('?mock=1#/');
    await p.getByRole('button', { name: 'Для неё' }).click();
    assert.equal(await p.locator('[data-test=product-card]').count(), 2);
  });
  await check('product: Элеганс base/full price toggle', async () => {
    const p = await page('?mock=1#/p/nafosat');
    await p.waitForSelector('[data-test=variant-price]');
    assert.equal(await text(p, '[data-test=variant-price]'), '1 990 000 сум');
    await p.getByRole('button', { name: /Полный/ }).click();
    assert.equal(await text(p, '[data-test=variant-price]'), '2 490 000 сум');
  });
  await check('lang: UZ/RU switch changes the heading', async () => {
    const p = await page('?mock=1#/');
    await p.waitForSelector('h1');
    assert.match(await text(p, 'h1'), /НОВОГОДНИЕ БОКСЫ/);
    await p.getByRole('button', { name: 'UZ' }).click();
    assert.match(await text(p, 'h1'), /YANGI YIL QUTILARI/);
  });
  await check('outside Telegram shows «Откройте в Telegram»', async () => {
    const p = await page('#/');
    await p.waitForSelector('[data-test=open-in-telegram]');
    assert.match(await text(p, '[data-test=open-in-telegram]'), /Telegram/);
  });
}

if (scenario === 'checkout' || scenario === 'all') {
  const add = async (p, slug) => { await p.goto(BASE + `?mock=1#/p/${slug}`); await p.locator('[data-test=add-to-cart]').click(); };
  await check('cart: Старт base costs 490 000, pickup + promo gives 416 000', async () => {
    const p = await page('?mock=1&promo=1#/');
    await p.waitForSelector('[data-test=product-card]');
    await add(p, 'start');
    await p.goto(BASE + '?mock=1&promo=1#/cart');
    assert.equal(await text(p, '[data-test=subtotal]'), '490 000 сум');
    await p.locator('[data-test=fulfillment-pickup]').click();
    assert.equal(await text(p, '[data-test=total]'), '416 000 сум');
  });
  await check('checkout: delivery needs a pin; manual pin works without geolocation; double tap → one order', async () => {
    const p = await page('?mock=1#/', { permissions: [] });
    await p.waitForSelector('[data-test=product-card]');
    await add(p, 'start');
    await p.goto(BASE + '?mock=1#/checkout');
    await p.locator('[data-test=fulfillment-delivery]').click();
    await p.fill('[data-test=phone]', '90 123 45 67');
    await p.fill('[data-test=address]', 'Юнусабад 4, кв 12');
    await p.locator('[data-test=date-chip]').first().click();
    await p.locator('[data-test=slot-chip]').first().click();
    await p.locator('[data-test=submit]').click();
    await p.waitForSelector('[data-test=error-location]');
    await p.locator('[data-test=locate]').click();
    await p.waitForSelector('[data-test=map] .leaflet-container');
    const box = await p.locator('[data-test=map]').boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await p.waitForSelector('[data-test=pin-set]');
    await p.locator('[data-test=submit]').dblclick();
    await p.waitForSelector('[data-test=done-number]');
    assert.equal(await text(p, '[data-test=done-number]'), 'AV-1001');
    const calls = await p.evaluate(() => window.__mockCalls.filter((c) => c.action === 'create_order').length);
    assert.equal(calls, 1);
  });
  await check('checkout: UNAVAILABLE refreshes the catalog with a clear message', async () => {
    const p = await page('?mock=1&fail=UNAVAILABLE#/');
    await p.waitForSelector('[data-test=product-card]');
    await add(p, 'start');
    await p.goto(BASE + '?mock=1&fail=UNAVAILABLE#/checkout');
    await p.locator('[data-test=fulfillment-pickup]').click();
    await p.fill('[data-test=phone]', '90 123 45 67');
    await p.locator('[data-test=date-chip]').first().click();
    await p.locator('[data-test=submit]').click();
    await p.waitForSelector('[data-test=form-error]');
    assert.match(await text(p, '[data-test=form-error]'), /больше недоступен/);
  });
  await check('checkout: BAD_DATE asks for another date', async () => {
    const p = await page('?mock=1&fail=BAD_DATE#/');
    await p.waitForSelector('[data-test=product-card]');
    await add(p, 'start');
    await p.goto(BASE + '?mock=1&fail=BAD_DATE#/checkout');
    await p.locator('[data-test=fulfillment-pickup]').click();
    await p.fill('[data-test=phone]', '90 123 45 67');
    await p.locator('[data-test=date-chip]').first().click();
    await p.locator('[data-test=submit]').click();
    await p.waitForSelector('[data-test=form-error]');
    assert.match(await text(p, '[data-test=form-error]'), /другую дату/);
  });
  await check('orders: new order listed as «Новая», cancel → «Отменена»', async () => {
    const p = await page('?mock=1&seedorder=1#/orders');
    await p.waitForSelector('[data-test=order-row]');
    assert.match(await text(p, '[data-test=order-status]'), /Новая/);
    await p.locator('[data-test=order-row]').first().click();
    await p.locator('[data-test=cancel-order]').click();
    await p.waitForSelector('[data-test=order-status-current]');
    assert.match(await text(p, '[data-test=order-status-current]'), /Отменена/);
  });
}

if (scenario === 'game' || scenario === 'all') {
  await check('game: scripted round ends with a promo code', async () => {
    const p = await page('?mock=1#/game');
    await p.waitForSelector('[data-test=game-start]');
    await p.locator('[data-test=game-start]').click();
    await p.evaluate(() => window.__game.autoplay(60000));
    await p.waitForSelector('[data-test=game-promo]', { timeout: 15000 });
    assert.match(await text(p, '[data-test=game-promo]'), /ELF-/);
  });
}

await browser.close();
server.kill();
console.log(results.join('\n'));
process.exit(results.some((r) => !r.startsWith('ok')) ? 1 : 0);
