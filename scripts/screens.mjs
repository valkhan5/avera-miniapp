// Screenshots of Mini App screens in mock mode for visual review. Usage: node scripts/screens.mjs [names...]
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.env.SHOTS ?? '/tmp/avera-shots';
mkdirSync(OUT, { recursive: true });
const PORT = 4174;
execSync('npx vite build --logLevel error', { cwd: 'apps/miniapp', stdio: 'inherit' });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: 'apps/miniapp', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
const SCREENS = {
  home: '?mock=1#/', home_uz: '?mock=1&lang=uz#/', product: '?mock=1#/p/nafosat', product_full: '?mock=1#/p/flagman',
  cart: '?mock=1&promo=1&cart=1#/cart', checkout: '?mock=1&promo=1&cart=1#/checkout', orders: '?mock=1&seedorder=1#/orders', game: '?mock=1#/game',
};
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCREENS);
for (const name of want) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.route('**/telegram-web-app.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await p.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto(`http://localhost:${PORT}/${SCREENS[name]}`);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: process.env.FULL === '1' });
  await ctx.close();
}
await browser.close(); server.kill();
console.log('shots in', OUT, want.join(','));
