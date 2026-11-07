import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
const args = chromium.args.filter(a => a !== '--single-process').concat([
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox',
  '--autoplay-policy=no-user-gesture-required',
]);
const browser = await pw.launch({ executablePath: await chromium.executablePath(), args, headless: true, env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.local/lib/chromium-deps' } });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
await page.click('.car-card[data-car="mustang"]');
await page.click('#btn-start');
await page.keyboard.down('ArrowUp');
await page.waitForFunction(() => Number(document.getElementById('hud-rpm')?.textContent || 0) > 1200, undefined, { timeout: 60000 });
await page.waitForTimeout(1500);
const state = await page.evaluate(() => ({
  rpm: document.getElementById('hud-rpm')?.textContent,
  gear: document.getElementById('hud-gear')?.textContent,
  speed: document.getElementById('hud-speed')?.textContent,
  mode: window.__overtake.mode,
}));
await page.keyboard.up('ArrowUp');
console.log(JSON.stringify({ state, errors }, null, 2));
await browser.close();
if (errors.length || !state.rpm || Number(state.rpm) < 800) process.exit(1);
