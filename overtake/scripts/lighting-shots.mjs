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
const shot = (name) => page.screenshot({ path: out + name, timeout: 90000 });
const settle = () => page.evaluate(() => {
  const g = window.__overtake;
  for (let i = 0; i < 40; i++) g.updateWorld(0.1);
  g.updateScenery();
  g.updateCamera(0.016);
});

await page.goto('http://localhost:3000/?test=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
await page.addStyleTag({ content: '*{backdrop-filter:none!important;animation:none!important;transition:none!important}' });
await page.waitForTimeout(600);

for (const id of ['golf', 'mercedes', 'audi', 'mustang', 'ferrari']) {
  await page.click(`.car-card[data-car="${id}"]`);
  await page.waitForTimeout(250);
  await shot(`lighting-garage-${id}.png`);
}

await page.click('.car-card[data-car="ferrari"]');
await page.click('#btn-start');
await page.waitForFunction(() => window.__overtake?.mode === 'driving', undefined, { timeout: 30000 });
await page.evaluate(() => {
  const g = window.__overtake;
  g.setCycleRunning(false); g.setWeatherMode('clear'); g.setTimeOfDay(13);
  g.clearTraffic();
  g.spawnSame(g.playerS + 35, 18);
  g.spawnOncoming(g.playerS + 120, 26);
});
await settle();
await shot('lighting-road-day.png');

await page.evaluate(() => { window.__overtake.setTimeOfDay(18.4); });
await settle();
await shot('lighting-road-dusk.png');

await page.evaluate(() => { window.__overtake.setTimeOfDay(23); });
await settle();
await shot('lighting-road-night.png');

await page.evaluate(() => { window.__overtake.setTimeOfDay(14); window.__overtake.setWeatherMode('rain'); });
await settle();
await shot('lighting-road-rain.png');

const info = await page.evaluate(() => {
  const g = window.__overtake;
  const mats = [];
  g.player.traverse((o) => {
    if (o.isMesh) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m.name?.startsWith('paint__')) mats.push({ name: m.name, physical: !!m.isMeshPhysicalMaterial, clearcoat: m.clearcoat, metalness: m.metalness, roughness: m.roughness });
    }
  });
  return { paint: mats.slice(0, 3), environment: !!g.scene.environment, toneMapping: g.renderer.toneMapping };
});
console.log(JSON.stringify({ info, errors }, null, 2));
await browser.close();
if (errors.length) process.exit(1);
