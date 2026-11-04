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

await page.goto('http://localhost:3000/?test=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
await page.addStyleTag({ content: '*{backdrop-filter:none!important;animation:none!important;transition:none!important}' });
await page.waitForTimeout(500);

const wheelCounts = {};
for (const id of ['golf', 'mercedes', 'audi', 'mustang', 'ferrari']) {
  await page.click(`.car-card[data-car="${id}"]`);
  await page.waitForTimeout(150);
  wheelCounts[id] = await page.evaluate(() => window.__overtake.library.wheelCount(window.__overtake.player));
}
await page.click('.car-card[data-car="golf"]');
await shot('driving-upgrade-garage.png');

await page.click('#btn-start');
await page.waitForFunction(() => window.__overtake?.mode === 'driving', undefined, { timeout: 30000 });
await page.evaluate(() => {
  const g = window.__overtake;
  g.setCycleRunning(false); g.setTimeOfDay(13); g.setWeatherMode('clear');
  g.clearTraffic();
  g.vehicle.speed = 22; g.input.throttle = true; g.input.left = true;
});
await page.waitForFunction(() => {
  const g = window.__overtake;
  const front = g.player.getObjectByName('wheel_FR');
  const spin = g.player.getObjectByName('spin_FR');
  return front && spin && Math.abs(front.rotation.y) > 0.01 && Math.abs(spin.rotation.x) > 0.01;
}, undefined, { timeout: 20000, polling: 100 });
const wheelMotion = await page.evaluate(() => {
  const g = window.__overtake;
  const front = g.player.getObjectByName('wheel_FR');
  const spin = g.player.getObjectByName('spin_FR');
  return { steer: front?.rotation.y ?? 0, spin: spin?.rotation.x ?? 0, pitch: g.player.rotation.x };
});
await page.evaluate(() => { window.__overtake.input.left = false; });

// Mirror: put a stationary car behind, verify toggle, and capture the inset.
await page.evaluate(() => {
  const g = window.__overtake;
  g.vehicle.speed = 0; g.input.throttle = false;
  g.spawnSame(g.playerS - 24, 0);
  const t = g.traffic[g.traffic.length - 1];
  t.ai.cruise = 0; t.offset = g.offset;
  g.spawnSame(g.playerS + 55, 16);
  g.spawnOncoming(g.playerS + 300, 26);
});
await page.waitForTimeout(500);
const mirrorOn = await page.evaluate(() => !document.getElementById('mirror-frame').classList.contains('hidden'));
await shot('driving-upgrade-mirror.png');
await page.keyboard.press('r');
const mirrorOff = await page.evaluate(() => document.getElementById('mirror-frame').classList.contains('hidden'));
await page.keyboard.press('r');

// Coach: approach a slower car with an oncoming gap.
await page.evaluate(() => {
  const g = window.__overtake;
  g.clearTraffic();
  g.vehicle.speed = 28; g.vehicle.offset = 2.1; g.input.throttle = false;
  g.spawnSame(g.playerS + 48, 16);
  g.spawnOncoming(g.playerS + 520, 26);
});
await page.waitForFunction(() => window.__overtake.coach.state === 'go' || window.__overtake.coach.state === 'wait', undefined, { timeout: 15000 });
const coach = await page.evaluate(() => window.__overtake.coach);
await shot('driving-upgrade-coach.png');

console.log(JSON.stringify({ wheelCounts, wheelMotion, mirrorOn, mirrorOff, coach, errors }, null, 2));
await browser.close();
if (errors.length || Object.values(wheelCounts).some((n) => n !== 4) || Math.abs(wheelMotion.steer) < 0.01 || Math.abs(wheelMotion.spin) < 0.01 || Math.abs(wheelMotion.pitch) > 1e-6 || !mirrorOn || !mirrorOff) process.exit(1);
