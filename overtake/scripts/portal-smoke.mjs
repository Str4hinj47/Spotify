// Verifies the CrazyGames build layout: index.html at the root, relative assets
// loading without 404s, a playable run, and the rewarded offer on the built UI.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';

const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']),
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` },
});
try {
  const base = process.env.PORTAL_URL || 'http://localhost:4192';
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(180000);
  const failures = [], errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('sdk.crazygames.com')) failures.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', r => { if (!r.url().includes('sdk.crazygames.com')) failures.push(`failed ${r.url()}`); });
  await page.addInitScript(() => localStorage.setItem('overtake-progression-v2', JSON.stringify({ version: 2, walletVersion: 1, coins: 0, credits: 0, gems: 0, dev: false, owned: ['golf', 'challenger', 'skyline', 'mustang', 'bmw-m3'], upgrades: {}, tunes: {}, seasonPass: null })));
  await page.goto(`${base}/index.html?test=1&ads=demo`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#topbar:not(.hidden)', { timeout: 180000 });
  await page.evaluate(() => cancelAnimationFrame(window.__overtake.raf));
  assert.deepEqual(failures, [], `asset failures: ${failures.join(' | ')}`);
  assert.equal(await page.evaluate(() => !!document.querySelector('script[src*="crazygames-sdk-v3.js"]')), true, 'SDK script present');
  assert.equal(await page.evaluate(() => !!document.querySelector('#btn-account')), true, 'account element remains for UI toggling');
  assert.equal(await page.evaluate(() => document.querySelectorAll('a[href^="/"]').length), 0, 'no root-absolute links');

  await page.evaluate(() => {
    const g = window.__overtake;
    g.setRunMode('endless'); g.setSelectedCar('golf');
    if (!g.start()) throw new Error('run did not start');
    g.run.score = 900; g.run.distance = 400;
    g.endRun('crash');
  });
  await page.waitForSelector('#gameover:not(.hidden)', { timeout: 30000 });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => document.getElementById('btn-ad-double').classList.contains('hidden')), false, 'demo rewarded offer renders in the build');
  await page.screenshot({ path: 'test-results/portal-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => { const m = document.querySelector('#gameover .modal'); return m.scrollHeight - m.clientHeight; });
  assert.ok(overflow <= 2, `phone results clipped by ${overflow}px`);
  await page.screenshot({ path: 'test-results/portal-phone.png', fullPage: true });
  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  console.log('portal build smoke: OK');
} finally {
  await browser.close();
}
