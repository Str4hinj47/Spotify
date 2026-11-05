import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await pw.launch({ executablePath: await chromium.executablePath(), headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']),
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` } });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:3000/?test=1');
  await page.waitForSelector('#topbar:not(.hidden)', { timeout: 180000 });
  await page.click('.car-card[data-car="audi"]');
  await page.click('#btn-start');
  await page.evaluate(() => {
    const g = window.__overtake;
    g.clearTraffic(); g.trySpawn = () => {};
    g.setCycleRunning(false); g.setTimeOfDay(12); g.setWeatherMode('clear');
    Object.assign(g.weather, {rain: 0, wet: 0, snow: 0, snowCover: 0});
    g.vehicle.s = 1500; g.vehicle.speed = 0; g.input.throttle = false;
    g.updateDriving(0.01);
  });
  assert.equal(await page.locator('#boost-meter').count(), 0);
  assert.equal(await page.locator('#t-boost').count(), 0);
  await page.keyboard.press('e');
  assert.equal(await page.locator('#signal-left').getAttribute('aria-pressed'), 'true');
  let state = await page.evaluate(() => {
    const g = window.__overtake; g.signalElapsed = 0; g.updatePlayerLights(0);
    return { signal: g.signal, left: g.indicators.filter(x => x.side === 'left').map(x => x.sprite.material.opacity),
      right: g.indicators.filter(x => x.side === 'right').map(x => x.sprite.material.opacity) };
  });
  assert.equal(state.signal, 'left'); assert.deepEqual(state.left, [1, 1]); assert.deepEqual(state.right, [0, 0]);
  state = await page.evaluate(() => { const g = window.__overtake; g.signalElapsed = 0.6; g.updatePlayerLights(0); return g.indicators.map(x => x.sprite.material.opacity); });
  assert.deepEqual(state, [0, 0, 0, 0]);
  await page.keyboard.press('q');
  assert.equal(await page.locator('#signal-right').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#signal-left').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('q');
  assert.equal(await page.locator('#signal-right').getAttribute('aria-pressed'), 'false');
  const brakes = await page.evaluate(() => {
    const g = window.__overtake; const npc = g.library.create('audi');
    const own = g.player.userData.brakeMaterials, other = npc.userData.brakeMaterials;
    g.setInput('brake', true); g.updatePlayerLights(0);
    const on = own.map(m => m.emissiveIntensity), untouched = other.map(m => m.emissiveIntensity);
    const glow = g.playerBrakes.map(s => s.material.opacity);
    g.setInput('brake', false); g.updatePlayerLights(0);
    return { on, untouched, glow, off: own.map(m => m.emissiveIntensity),
      trunkVertices: g.broadTrunks.geometry.attributes.position.count, crownVertices: g.broadleaf.geometry.attributes.position.count,
      pineVertices: g.conifers.geometry.attributes.position.count };
  });
  assert.ok(brakes.on.length && brakes.on.every(x => x > 2));
  assert.ok(brakes.untouched.every(x => x < 1) && brakes.off.every(x => x < 1));
  assert.ok(brakes.glow.every(x => x === 0), 'real tail lenses need no floating fallback glow');
  assert.ok(brakes.trunkVertices > 100 && brakes.crownVertices > 1000 && brakes.pineVertices > 100);
  fs.mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/forest-new.png', timeout: 120000 });
  await page.evaluate(() => { const g = window.__overtake; g.setInput('brake', true); g.signal = 'left'; g.signalElapsed = 0; g.updatePlayerLights(0); });
  await page.screenshot({ path: 'test-results/brake-indicator.png', timeout: 120000 });
  await page.evaluate(() => { const g = window.__overtake; g.setInput('brake', false); g.signal = null; g.updatePlayerLights(0); });
  const variety = await page.evaluate(() => {
    const g = window.__overtake; g.clearTraffic();
    for (let i = 0; i < 6; i++) {
      if (i % 2) g.spawnOncoming(g.playerS + 40 + i * 24, 20);
      else g.spawnSame(g.playerS + 40 + i * 24, 15);
    }
    return g.traffic.map(t => ({ id: t.id, paint: t.paint, s: t.s }));
  });
  assert.equal(new Set(variety.map(t => t.id)).size, 6, 'six nearby cars have six different models');
  for (let i = 1; i < variety.length; i++) assert.notEqual(variety[i].paint, variety[i - 1].paint);
  const gapCrash = await page.evaluate(() => {
    const g = window.__overtake; g.clearTraffic();
    g.vehicle.offset = 0; g.vehicle.speed = 0;
    const s = g.vehicle.s;
    g.spawnSame(s, 0); g.spawnOncoming(s, 0);
    let message = ''; const old = g.cb.onEvent;
    g.cb.onEvent = event => { if (event.kind === 'crash') message = event.text; old(event); };
    g.updateDriving(0.01);
    g.cb.onEvent = old;
    return { mode: g.mode, message };
  });
  assert.equal(gapCrash.mode, 'gameover');
  assert.equal(gapCrash.message, 'NOT ENOUGH ROOM BETWEEN CARS');
  await page.evaluate(() => { const g = window.__overtake; g.start(); g.clearTraffic(); g.vehicle.offset = 4.1; g.updateDriving(0.01); });
  assert.equal(await page.evaluate(() => window.__overtake.mode), 'gameover', 'guardrail stops driving outside');
  assert.deepEqual(errors, []);
  console.log({ brakes, variety, errors });
} finally { await browser.close(); }
