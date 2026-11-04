import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';
const out = new URL('../test-results/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const args = chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required']);
const browser = await pw.launch({ executablePath: await chromium.executablePath(), args, headless: true, env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.local/lib/chromium-deps' } });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:3000/?test=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
await page.addStyleTag({ content: '*{backdrop-filter:none!important;animation:none!important;transition:none!important}' });

const golfLights = await page.evaluate(() => {
  const lib = window.__overtake.library;
  const names = [];
  lib.get('golf').scene.traverse(o => { if (o.isMesh) { const m = Array.isArray(o.material)?o.material:[o.material]; m.forEach(x=>names.push(x.name)); } });
  return names.filter(n => n.startsWith('taillight') || n.startsWith('headlight'));
});

await page.click('.car-card[data-car="golf"]');
await page.click('.paint-swatch[data-hex="#1f5fd0"]');
await page.waitForTimeout(400);
const golfPaint = await page.evaluate(() => {
  const g = window.__overtake;
  let hex = null;
  g.player.traverse(o => { if (o.isMesh) { const m = Array.isArray(o.material)?o.material:[o.material]; m.forEach(x => { if (x.name?.startsWith('paint__') || x.isMeshPhysicalMaterial) hex = '#' + x.color.getHexString(); }); } });
  return { saved: JSON.parse(localStorage.getItem('overtake-paints')||'{}'), playerHex: hex };
});
await page.screenshot({ path: out + 'golf-garage-paint.png', timeout: 90000 });
await page.click('#btn-start');
await page.keyboard.down('ArrowUp');
await page.waitForFunction(() => window.__overtake.speed > 12, { timeout: 40000 });
await page.screenshot({ path: out + 'golf-rear-lights.png', timeout: 90000 });
await page.keyboard.up('ArrowUp');
await page.evaluate(() => window.__overtake.toGarage());

await page.click('.car-card[data-car="ferrari"]');
await page.click('.paint-swatch[data-hex="#d40f1e"]');
await page.waitForTimeout(400);
await page.screenshot({ path: out + 'ferrari-garage-paint.png', timeout: 90000 });
await page.click('#btn-start');
await page.keyboard.down('ArrowUp');
await page.waitForFunction(() => window.__overtake.speed > 18, { timeout: 40000 });
await page.screenshot({ path: out + 'ferrari-aligned.png', timeout: 90000 });
const ferrari = await page.evaluate(() => {
  const g = window.__overtake;
  return { yaw: g.yaw, cam: g.getCameraSettings(), mode: g.mode, saved: JSON.parse(localStorage.getItem('overtake-paints')||'{}') };
});
await page.keyboard.up('ArrowUp');

// Persistence across reload
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('overtake-paints')||'{}'));
console.log(JSON.stringify({ golfLights, golfPaint, ferrari, persisted, errors }, null, 2));
await browser.close();
if (errors.length) process.exit(1);
