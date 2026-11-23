// Central City smoke test.
//
//   LD_LIBRARY_PATH=/home/user/.local/lib/chromium-deps node scripts/city-smoke.mjs
//
// SwiftShader in this sandbox renders well under 1 fps, so the test does not
// drive the car: it teleports to each landmark with the ?test hook and takes a
// screenshot. It also walks the full mode flow (garage → city → pause → resume
// → garage → highway) and asserts every transition, so a regression in the
// city wiring fails the run instead of silently producing a blank shot.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { mkdirSync } from 'node:fs';

const args = chromium.args.filter(a => a !== '--single-process')
  .concat(['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']);
mkdirSync('test-results', { recursive: true });

const browser = await pw.launch({
  executablePath: await chromium.executablePath(), args, headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.local/lib/chromium-deps' },
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const failures = [];
page.on('pageerror', e => failures.push(`pageerror: ${String(e).slice(0, 300)}`));
page.on('console', m => {
  if (m.type() === 'error' && !/\[vite\]|favicon/.test(m.text())) failures.push(`console: ${m.text().slice(0, 300)}`);
});

const state = () => page.evaluate(() => ({
  mode: window.__overtake.mode,
  city: document.body.classList.contains('city-mode'),
  hud: !document.getElementById('hud').classList.contains('hidden'),
  garage: !document.getElementById('garage').classList.contains('hidden'),
  pause: !document.getElementById('pause').classList.contains('hidden'),
}));
const expect = async (label, want) => {
  const got = await state();
  const bad = Object.entries(want).filter(([k, v]) => got[k] !== v);
  console.log(bad.length ? `FAIL ${label} ${JSON.stringify(got)}` : `ok   ${label}`);
  if (bad.length) failures.push(`${label}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};
const shot = async (name, [x, z, yaw]) => {
  if (x !== undefined) await page.evaluate(([x, z, yaw]) => window.__overtake.teleportCity(x, z, yaw), [x, z, yaw]);
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `test-results/city-${name}.png`, timeout: 240000 });
};

await page.goto('http://localhost:3000/?test', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 240000 });
await expect('garage', { mode: 'garage', city: false, garage: true });

// --- Enter the city ---------------------------------------------------------
await page.click('#city-card');
await page.waitForTimeout(10000);
await expect('city mode', { mode: 'city', city: true, hud: true, garage: false });
const built = await page.evaluate(() => {
  const g = window.__overtake;
  let buildings = 0;
  g.cityWorld.group.traverse(o => { if (o.name?.startsWith('city-')) buildings++; });
  return { ready: g.cityWorld.ready, buildingDrawCalls: buildings };
});
console.log('     city ready:', built.ready, 'building draw calls:', built.buildingDrawCalls);
if (!built.ready) failures.push('city GLB never finished loading');

// --- Landmarks --------------------------------------------------------------
for (const [name, at] of [
  ['spawn', [6, -8, 0]], ['parade', [-6, -60, 0]], ['park', [-80, -170, -Math.PI / 2]],
  ['tower', [60, -120, -Math.PI / 2]], ['lot', [-75, 130, Math.PI / 2]], ['residential', [0, -200, Math.PI]],
]) await shot(name, at);

// --- Weather and time -------------------------------------------------------
await page.evaluate(() => { window.__overtake.setCycleRunning(false); window.__overtake.setTimeOfDay(22.3); });
await shot('night', [0, -40, 0]);
await page.evaluate(() => { window.__overtake.setTimeOfDay(11); window.__overtake.forceWeather('rain'); });
await shot('rain', [0, -40, 0]);
await page.evaluate(() => window.__overtake.forceWeather('snow'));
await shot('snow', [0, -40, 0]);
await page.evaluate(() => window.__overtake.forceWeather('clear'));

// --- Pause / resume / exit --------------------------------------------------
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
await expect('paused from city', { mode: 'paused', pause: true, city: false });
const note = await page.textContent('#pause-note');
if (!/Central City/.test(note)) failures.push(`pause copy did not switch to the city: "${note}"`);
await page.keyboard.press('Escape');
await page.waitForTimeout(1500);
await expect('resumed into city', { mode: 'city', city: true });
await page.click('#btn-pause');
await page.waitForTimeout(1000);
await page.click('#btn-quit');
await page.waitForTimeout(2500);
await expect('back in garage', { mode: 'garage', city: false, garage: true });

// --- The highway still works ------------------------------------------------
await page.click('#btn-start');
await page.waitForTimeout(6000);
await expect('highway run', { mode: 'driving', city: false, hud: true });
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(7000);
await page.keyboard.up('ArrowUp');
await page.screenshot({ path: 'test-results/city-highway.png', timeout: 240000 });

await browser.close();
if (failures.length) {
  console.error('\nFAILURES:\n' + failures.map(f => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('\nall city smoke checks passed');
