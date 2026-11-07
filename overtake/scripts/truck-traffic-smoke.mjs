// Run against the Vite server. Exercises the real game loop, spawned model
// choices, and the passing-lane reservation rather than just isolated rules.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser = await pw.launch({ executablePath: await chromium.executablePath(), headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` } });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3000/?test=1');
  await page.waitForSelector('#topbar:not(.hidden)', {timeout: 180000});
  assert.equal(await page.locator('.car-card').count(), 7, 'trucks are NPC-only');
  const result = await page.evaluate(async () => {
    const g = window.__overtake;
    const ai = await import('/src/traffic-ai.mjs');
    cancelAnimationFrame(g.raf);
    const models = ['semi','kraz'].map(id => {
      const m = g.library.get(id); return { id, length: m.length, width: m.width, height: m.height };
    });
    g.start(); g.clearTraffic();
    const oldRandom = Math.random;
    Math.random = () => 0;
    g.run.score = 1499; g.spawnSame(100, 20); const before = g.traffic[0].id;
    g.clearTraffic(); g.run.score = 1500; g.spawnSame(100, 20); const after = g.traffic[0].id;
    Math.random = oldRandom; g.clearTraffic();
    const make = (id, s, speed, dir = 1) => {
      const group = g.library.create(id), meta = g.library.get(id); g.scene.add(group);
      return {id, group, s, speed, dir, offset: dir === 1 ? 2.1 : -2.1,
        length: meta.length, width: meta.width, paint: 0, passed: false, braking: false,
        ai: ai.createTrafficAI(ai.TRAFFIC_CRUISE[id])};
    };
    const truck = make('semi', 140, 11.5), car = make('r8', 100, 11.5);
    const follower = make('golf', 65, 15), incoming = make('audi', 600, 23, -1);
    g.traffic = [truck, car, follower, incoming];
    g.vehicle.s = -3000; g.vehicle.offset = 2.1; g.vehicle.speed = 0;
    g.updateRoad = () => {}; g.updateWorld = () => {}; g.updateCamera = () => {};
    const spawn = g.trySpawn.bind(g); g.trySpawn = () => {};
    g.updateDriving(.05);
    const blocked = !car.ai.pass;
    g.scene.remove(incoming.group); g.traffic = g.traffic.filter(t => t !== incoming);
    g.updateDriving(.05);
    const started = !!car.ai.pass;
    g.trySpawn = spawn; g.sameTimer = 0; g.oncomingTimer = 0;
    const beforeReservation = g.traffic.length; g.trySpawn(.01);
    const reserved = g.traffic.length === beforeReservation;
    g.trySpawn = () => {};
    let out = false, returned = false, minGap = Infinity;
    for (let i = 0; i < 1600 && g.mode === 'driving'; i++) {
      g.updateDriving(.05);
      minGap = Math.min(minGap, truck.s - follower.s - (truck.length + follower.length) / 2);
      if (car.offset < -2) out = true;
      if (out && !car.ai.pass) { returned = true; break; }
    }
    return { models, before, after, blocked, started, reserved, out, returned, minGap, mode: g.mode };
  });
  assert.equal(result.before === 'semi' || result.before === 'kraz', false);
  assert.equal(result.after, 'semi');
  assert.ok(result.blocked && result.started && result.reserved && result.out && result.returned, JSON.stringify(result));
  assert.ok(result.minGap >= 1.8, `queue overlapped truck: ${result.minGap}`);
  assert.equal(result.mode, 'driving');
  for (const m of result.models) { assert.ok(m.length > 7 && m.width < 2.7 && m.height > 2, JSON.stringify(m)); }
  assert.deepEqual(errors, []);
  console.log(result);
} finally { await browser.close(); }
