import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';

const out = new URL('../test-results/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const errors = [];
const args = chromium.args.filter((a) => a !== '--single-process').concat([
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
  '--autoplay-policy=no-user-gesture-required',
]);
const browser = await pw.launch({
  executablePath: await chromium.executablePath(), args, headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` },
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:3000/?test=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
await page.addStyleTag({ content: '*{backdrop-filter:none!important;animation:none!important;transition:none!important}' });
await page.click('.car-card[data-car="mercedes"]');
await page.waitForTimeout(400);
const tires = await page.evaluate(() => {
  const g = window.__overtake;
  const found = [];
  g.player.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (/w222 - wheel$/i.test(m.name || '')) found.push({ name: m.name, color: m.color.getHexString(), roughness: m.roughness, metalness: m.metalness });
    }
  });
  return found;
});
await page.screenshot({ path: out + 'bugfix-mercedes-tires.png', timeout: 90000 });
console.log(JSON.stringify({ tires, errors }, null, 2));
await browser.close();
if (errors.length || !tires.length || tires.some((t) => t.color !== '0b0b0c' || t.metalness !== 0)) process.exit(1);
