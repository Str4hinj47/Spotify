// Reads the real GPU draw stats for the city frame (renderer.info is reset
// each frame unless autoReset is off, so we sample inside a rAF).
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
const args = chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']);
const browser = await pw.launch({ executablePath: await chromium.executablePath(), args, headless: true, env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.local/lib/chromium-deps' } });
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
await page.goto('http://localhost:3000/?test', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 240000 });
const sample = () => page.evaluate(() => new Promise(res => {
  const r = window.__overtake['renderer'];
  r.info.autoReset = false; r.info.reset();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const out = { calls: r.info.render.calls, tris: r.info.render.triangles, programs: r.info.programs.length };
    r.info.autoReset = true;
    res(out);
  }));
}));
console.log('HIGHWAY ', JSON.stringify(await sample()));
await page.click('#city-card');
await page.waitForTimeout(13000);
console.log('CITY    ', JSON.stringify(await sample()));
await page.evaluate(() => window.__overtake.toGarage());
await page.waitForTimeout(2500);
console.log('GARAGE  ', JSON.stringify(await sample()));
await browser.close();
