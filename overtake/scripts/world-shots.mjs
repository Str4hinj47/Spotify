import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';

const out = new URL('../test-results/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const args = chromium.args.filter((a) => a !== '--single-process').concat([
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
  '--autoplay-policy=no-user-gesture-required',
]);
const browser = await pw.launch({
  executablePath: await chromium.executablePath(), args, headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` },
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: out + name, timeout: 90000 });

await page.goto('http://localhost:3000/?test=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
await page.addStyleTag({ content: '*{backdrop-filter:none!important;animation:none!important;transition:none!important}' });
await page.waitForTimeout(800);
await shot('world-garage.png');

await page.click('#btn-start');
await page.waitForFunction(() => window.__overtake?.mode === 'driving', undefined, { timeout: 30000 });
// Freeze the clock and clear traffic so each world state can be inspected.
await page.evaluate(() => {
  const g = window.__overtake;
  g.setCycleRunning(false);
  g.clearTraffic();
  g.vehicle.speed = 18;
  g.input.throttle = false;
});

async function setState({ hour, weather, s, rain = 0, snow = 0, wet = 0, snowCover = 0 }) {
  await page.evaluate((st) => {
    const g = window.__overtake;
    g.setTimeOfDay(st.hour);
    g.setWeatherMode(st.weather);
    g.weather.rain = st.rain;
    g.weather.snow = st.snow;
    g.weather.wet = st.wet;
    g.weather.snowCover = st.snowCover;
    g.vehicle.s = st.s;
    g.vehicle.offset = 2.1;
    g.vehicle.heading = 0;
    g.vehicle.speed = 18;
  }, { hour, weather, s, rain, snow, wet, snowCover });
  // Settle damped atmosphere/weather without waiting on slow headless RAF.
  await page.evaluate(() => {
    const g = window.__overtake;
    g.updateCamera(0.016);
    for (let i = 0; i < 40; i++) { g.updateWorld(0.1); g.updateScenery(); g.updateCamera(0.016); }
  });
  await page.waitForTimeout(700);
}

await setState({ hour: 13, weather: 'clear', s: 4700 });
await shot('world-day-meadow.png');

await setState({ hour: 18.2, weather: 'clear', s: 1500 });
await shot('world-dusk-forest.png');

await setState({ hour: 23, weather: 'rain', s: 7800, rain: 1, wet: 1 });
await shot('world-night-rain.png');

await setState({ hour: 10, weather: 'snow', s: 14400, snow: 1, snowCover: 1 });
await shot('world-snow-alpine.png');

await setState({ hour: 15, weather: 'clear', s: 10850 });
await shot('world-biome-transition.png');

await page.evaluate(() => {
  const g = window.__overtake;
  g.setTimeOfDay(11);
  g.setWeatherMode('auto');
  g.weather.rain = 0; g.weather.snow = 0; g.weather.wet = 0; g.weather.snowCover = 0;
});
await page.click('#btn-world');
await page.waitForTimeout(500);
await shot('world-panel.png');

const state = await page.evaluate(() => window.__overtake.getWorldSettings());
console.log(JSON.stringify({ state, errors }, null, 2));
await browser.close();
if (errors.length) process.exit(1);
