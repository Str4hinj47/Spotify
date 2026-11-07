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

await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
await page.addStyleTag({ content: '*{backdrop-filter:none!important;animation:none!important;transition:none!important}' });
await page.waitForTimeout(600);
await page.click('.mode-card[data-mode="rush"]');
await shot('upgrade-garage-rush.png');

await page.click('#menu-start');
await page.waitForFunction(() => window.__overtake?.mode === 'driving', undefined, { timeout: 30000 });
const rushStart = await page.evaluate(() => ({ mode: window.__overtake.getRunMode(), timeLeft: window.__overtake.run.timeLeft, contracts: window.__overtake.run.contracts.length }));
await page.evaluate(() => {
  const g = window.__overtake;
  g.setCycleRunning(false); g.setTimeOfDay(13); g.setWeatherMode('clear');
  g.clearTraffic();
  g.vehicle.speed = 26; g.input.throttle = true;
});
await page.waitForTimeout(400);
const driving = await page.evaluate(() => ({ pitch: window.__overtake.player.rotation.x, speed: window.__overtake.speed,
  noNitro: !document.getElementById('boost-meter') }));
await shot('upgrade-driving.png');

// Force a contract completion through the real pass pipeline by placing a
// slow car just behind the player after it has been passed.
await page.evaluate(() => {
  const g = window.__overtake;
  g.spawnSame(g.playerS - 12, 10);
  const t = g.traffic[g.traffic.length - 1];
  t.offset = g.offset + 1.4;
});
await page.waitForFunction(() => window.__overtake.run.overtakes >= 1, undefined, { timeout: 15000 });
await shot('upgrade-contract.png');

// Finish the Rush clock and verify results + local records.
await page.evaluate(() => { window.__overtake.run.timeLeft = 0.15; });
await page.waitForFunction(() => window.__overtake.mode === 'gameover', undefined, { timeout: 15000 });
await page.waitForTimeout(400);
await shot('upgrade-results.png');
const results = await page.evaluate(() => ({
  reason: window.__overtake.run.reason,
  score: window.__overtake.score,
  records: window.__overtake.getRecords().modes.rush,
  finalTitle: document.getElementById('final-title').textContent,
}));
await page.click('#btn-result-menu');
await page.waitForFunction(() => window.__overtake.mode === 'garage', undefined, { timeout: 15000 });
const garage = await page.evaluate(() => ({
  mode: window.__overtake.getRunMode(),
  recentVisible: !document.getElementById('recent-runs').classList.contains('hidden'),
  best: document.getElementById('mode-best-rush').textContent,
}));
console.log(JSON.stringify({ rushStart, driving, results, garage, errors }, null, 2));
await browser.close();
if (errors.length || rushStart.mode !== 'rush' || !driving.noNitro || Math.abs(driving.pitch) > 1e-6 || results.reason !== 'time' || !garage.recentVisible) process.exit(1);
