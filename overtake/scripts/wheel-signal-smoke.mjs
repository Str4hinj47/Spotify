// Exercise the actual model library, driving loop and overtake scoring.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://localhost:3000';
const browser = await pw.launch({ executablePath: await chromium.executablePath(), headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` } });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${base}/play.html?test=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#topbar:not(.hidden)', { timeout: 180000 });
  const rigs = await page.evaluate(async () => {
    const { spinWheels } = await import('/src/wheels.ts');
    const g = window.__overtake;
    cancelAnimationFrame(g.raf);
    return ['golf','mercedes','audi','mustang','ferrari','r8','challenger','semi','kraz'].map(id => {
      const car = g.library.create(id), other = g.library.create(id), wheels = car.userData.wheels;
      const stationaryNames = { golf: 'golf_mesh_9', audi: 'audi_mesh_20', mustang: 'mustang_mesh_20', ferrari: 'ferrari_mesh_8', r8: 'metal_1', challenger: 'mesh_40_2' };
      const brake = stationaryNames[id] ? car.getObjectByName(stationaryNames[id]) : null;
      car.updateMatrixWorld(true);
      const brakeBefore = brake?.matrixWorld.toArray();
      const before = wheels.map(w => w.rotation.x);
      spinWheels(car, .2);
      car.updateMatrixWorld(true);
      const brakeStill = !brake || (brake.geometry.index?.count > 0 && brake.matrixWorld.toArray().every((v,i) => v === brakeBefore[i]));
      const after = wheels.map(w => w.rotation.x);
      const unchanged = other.userData.wheels.every(w => w.rotation.x === 0);
      const shared = wheels.every((w,i) => w.children.length > 0 && w.children[0].geometry === other.userData.wheels[i].children[0].geometry);
      const radii = wheels.map(w => w.userData.wheelRadius);
      const parts = wheels.map(w => w.children.length);
      const mixedName = { audi: 'audi_mesh', semi: 'Cube007_4', kraz: 'body001_7' }[id];
      const mixed = mixedName ? car.getObjectByName(mixedName) : null;
      const mixedParts = mixedName ? wheels.flatMap(w => w.children).filter(c => c.name.startsWith(`${mixedName}_rotating_`)) : [];
      const attributesPreserved = !mixed || (mixed.geometry.index.count > 0 && mixedParts.length > 0 &&
        Object.keys(mixedParts[0].geometry.attributes).every(key => mixed.geometry.getAttribute(key) === mixedParts[0].geometry.getAttribute(key)));
      spinWheels(car, 0);
      return { id, before, after, unchanged, shared, brakeStill, attributesPreserved, radii, parts, stopped: wheels.every((w,i) => w.rotation.x === after[i]) };
    });
  });
  for (const r of rigs) {
    assert.equal(r.before.length, r.id === 'semi' ? 10 : r.id === 'kraz' ? 6 : 4, r.id);
    assert.ok(r.after.every((a,i) => a < r.before[i] && Math.abs(a + .2 / r.radii[i]) < 1e-6), r.id);
    assert.ok(r.radii.every(a => a > .2 && a < .8) && r.parts.every(n => n > 0), r.id);
    assert.ok(r.shared && r.unchanged && r.brakeStill && r.attributesPreserved && r.stopped, r.id);
  }
  await page.click('#menu-start');
  const gameplay = await page.evaluate(async () => {
    const g = window.__overtake;
    cancelAnimationFrame(g.raf); g.clearTraffic(); g.trySpawn = () => {};
    const events = []; g.cb.onEvent = e => events.push(e);
    const pass = (signal, side, kind='same') => {
      g.clearTraffic(); if (g.signal) g.toggleSignal(g.signal); if (signal) g.toggleSignal(signal);
      if (kind === 'same') g.spawnSame(g.playerS - 20, 0); else g.spawnOncoming(g.playerS - 20, 0);
      const t = g.traffic[g.traffic.length - 1]; t.offset = g.offset + (side === 'left' ? 3 : -3);
      t.s = g.playerS - (g.playerMeta.length / 2 + t.length / 2 + 1.1);
      const score = g.run.score, count = events.length; g.updateDriving(0);
      const event = events.slice(count).find(e => ['overtake','near','oncoming'].includes(e.kind));
      const result = { points: event?.points, text: event?.text, delta: g.run.score - score, signal: g.signal };
      g.updateDriving(0); result.secondDelta = g.run.score - score; return result;
    };
    const left = pass('left','left'), wrong = pass('right','left'), right = pass('right','right'), none = pass(null,'left'), oncoming = pass('left','left','oncoming');
    g.clearTraffic(); if (g.signal) g.toggleSignal(g.signal);
    g.vehicle.speed = 20; g.speed = 20;
    g.spawnOncoming(g.playerS + 100, 15);
    const t = g.traffic[g.traffic.length - 1], p = g.player.userData.wheels[0], w = t.group.userData.wheels[0];
    const p0 = p.rotation.x, w0 = w.rotation.x; g.updateDriving(.05);
    const moving = { player: p.rotation.x - p0, oncoming: w.rotation.x - w0 };
    g.vehicle.speed = 0; g.speed = 0; t.speed = 0;
    const p1 = p.rotation.x, w1 = w.rotation.x; g.updateDriving(.05);
    const stopped = { player: p.rotation.x - p1, traffic: w.rotation.x - w1 };
    g.pause(); const p2 = p.rotation.x, w2 = w.rotation.x; g.loop(); cancelAnimationFrame(g.raf);
    return { left, wrong, right, none, oncoming, moving, stopped, paused: g.mode === 'paused' && p.rotation.x === p2 && w.rotation.x === w2 };
  });
  assert.equal(gameplay.left.points, 150); assert.match(gameplay.left.text, /SIGNAL \+50/); assert.equal(gameplay.left.signal,null);
  assert.equal(gameplay.wrong.points, 100); assert.doesNotMatch(gameplay.wrong.text, /SIGNAL/);
  assert.equal(gameplay.right.points, 150); assert.equal(gameplay.none.points,100);
  assert.equal(gameplay.oncoming.points,250); assert.equal(gameplay.oncoming.signal,'left');
  for (const result of [gameplay.left,gameplay.wrong,gameplay.right,gameplay.none,gameplay.oncoming]) assert.equal(result.secondDelta,result.delta);
  assert.ok(gameplay.moving.player < 0 && gameplay.moving.oncoming < 0);
  assert.ok(Math.abs(gameplay.stopped.player) < 1e-9 && Math.abs(gameplay.stopped.traffic) < 1e-9 && gameplay.paused);
  assert.deepEqual(errors, []);
  console.log({ rigs, gameplay });
} finally { await browser.close(); }
