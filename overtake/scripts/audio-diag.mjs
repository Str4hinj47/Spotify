import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
const args = chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required']);
const browser = await pw.launch({ executablePath: await chromium.executablePath(), args, headless: true, env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.local/lib/chromium-deps' } });
const page = await browser.newPage();
page.on('console', m => console.log('CON', m.type(), m.text()));
page.on('pageerror', e => console.log('ERR', String(e)));
await page.goto('http://localhost:3000/?test=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
await page.click('.car-card[data-car="mustang"]');
await page.click('#btn-start');
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(6000);
const state = await page.evaluate(() => {
  const a = window.__audio;
  return {
    hudRpm: document.getElementById('hud-rpm')?.textContent,
    hudGear: document.getElementById('hud-gear')?.textContent,
    mode: window.__overtake.mode,
    hasSim: !!a.sim, running: a.sim?.running, ctx: a.ctx?.state,
    active: a.active, muted: a.muted,
    simState: a.sim?.getState?.() ? { rpm: a.sim.getState().rpm, gear: a.sim.getState().gear, speed: a.sim.getState().speed } : null,
  };
});
console.log(JSON.stringify(state, null, 2));
await browser.close();
