// End-to-end flow: garage → city → pause → resume → quit → garage → highway run.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
const args = chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']);
const browser = await pw.launch({ executablePath: await chromium.executablePath(), args, headless: true, env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.local/lib/chromium-deps' } });
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error' && !/\[vite\]|favicon/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 300)); });
const state = () => page.evaluate(() => ({
  mode: window.__overtake.mode,
  city: document.body.classList.contains('city-mode'),
  hud: !document.getElementById('hud').classList.contains('hidden'),
  garage: !document.getElementById('garage').classList.contains('hidden'),
  pause: !document.getElementById('pause').classList.contains('hidden'),
  pauseNote: document.getElementById('pause-note').textContent,
}));
await page.goto('http://localhost:3000/?test', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 240000 });
console.log('1 garage      ', JSON.stringify(await state()));
await page.click('#city-card');
await page.waitForTimeout(9000);
console.log('2 city        ', JSON.stringify(await state()));
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
console.log('3 paused      ', JSON.stringify(await state()));
await page.screenshot({ path: 'test-results/flow-pause-city.png', timeout: 180000 });
await page.keyboard.press('Escape');
await page.waitForTimeout(1500);
console.log('4 resumed     ', JSON.stringify(await state()));
await page.click('#btn-pause');
await page.waitForTimeout(1200);
await page.click('#btn-quit');
await page.waitForTimeout(2500);
console.log('5 back garage ', JSON.stringify(await state()));
await page.screenshot({ path: 'test-results/flow-garage.png', timeout: 180000 });
// Highway run still works after the city.
await page.click('#btn-start');
await page.waitForTimeout(6000);
console.log('6 highway     ', JSON.stringify(await state()), 'speed', await page.textContent('#hud-speed'));
await page.screenshot({ path: 'test-results/flow-highway.png', timeout: 180000 });
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(8000);
await page.keyboard.up('ArrowUp');
console.log('7 driving speed', await page.textContent('#hud-speed'));
await page.screenshot({ path: 'test-results/flow-highway2.png', timeout: 180000 });
await browser.close();
