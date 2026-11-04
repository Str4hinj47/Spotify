import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';

const out = new URL('../test-results/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const errors = [];
const args = chromium.args.filter((a) => a !== '--single-process').concat([
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
]);
const browser = await pw.launch({
  executablePath: await chromium.executablePath(), args, headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` },
});
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: out + name, timeout: 90000 });
const g = (fn) => page.evaluate(fn);

await page.goto('http://localhost:3000/?test=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
await page.addStyleTag({ content: '*{backdrop-filter:none!important;animation:none!important;transition:none!important}' });
await page.waitForTimeout(800);
const cards = await page.locator('.car-card').count();
await shot('garage.png');

await page.click('.car-card[data-car="ferrari"]');
await page.waitForTimeout(500);
await shot('garage-ferrari.png');
await page.click('#btn-start');
await page.keyboard.down('ArrowUp');
await page.waitForFunction(() => window.__overtake.speed > 30, undefined, { timeout: 90000 });
const before = await g(() => ({ offset: window.__overtake.offset, speed: window.__overtake.speed, s: window.__overtake.playerS }));
await page.keyboard.down('ArrowLeft');
await page.waitForFunction(() => window.__overtake.offset < 0.3 || window.__overtake.mode === 'gameover', undefined, { timeout: 30000 });
await page.keyboard.up('ArrowLeft');
const afterSteer = await g(() => ({ offset: window.__overtake.offset, yaw: window.__overtake.yaw }));
await shot('driving.png');
// Hold the centre passing window (clear of both lanes) with the same
// continuous steering input the player uses, then wait for a clean pass.
await page.waitForFunction(() => {
  const g = window.__overtake;
  if (g.mode !== 'driving') return true;
  const target = 0;
  g.input.left = g.offset > target + 0.2;
  g.input.right = g.offset < target - 0.2;
  return g.overtakes > 0;
}, undefined, { timeout: 90000, polling: 100 });
await page.keyboard.up('ArrowUp');
await page.waitForFunction(() => {
  const g = window.__overtake;
  if (g.mode !== 'driving') return true;
  const target = 1.8;
  g.input.left = g.offset > target + 0.3;
  g.input.right = g.offset < target - 0.3;
  return g.offset > 1.2 && g.offset < 2.6;
}, undefined, { timeout: 60000, polling: 100 });
await g(() => { window.__overtake.input.left = false; window.__overtake.input.right = false; });
await page.waitForTimeout(300);
await shot('scored.png');
const state = await g(() => ({
  mode: window.__overtake.mode, score: window.__overtake.score, overtakes: window.__overtake.overtakes,
  traffic: window.__overtake.traffic.map((t) => t.dir), offset: window.__overtake.offset,
}));
console.log(JSON.stringify({ cards, before, afterSteer, state, errors }, null, 2));
await browser.close();
if (cards !== 7 || errors.length || state.overtakes < 1 || !state.traffic.includes(-1)) process.exit(1);
