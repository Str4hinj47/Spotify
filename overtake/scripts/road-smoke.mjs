// Browser smoke test: starts against a running Vite server on port 3000.
// It forces each weather state, checks mesh/uniform updates, and captures the
// road for visual inspection. Uses the same Chromium setup as scripts/smoke.mjs.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const args = chromium.args.filter(a => a !== '--single-process').concat([
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
]);
const browser = await pw.launch({ executablePath: await chromium.executablePath(), args, headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` },
});
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topbar:not(.hidden)', { timeout: 180000 });
  await page.click('#menu-start');
  await page.evaluate(() => {
    const g = window.__overtake;
    g.clearTraffic(); g.setCycleRunning(false); g.setTimeOfDay(12);
    g.vehicle.speed = 0; g.input.throttle = false; g.setCameraPreset('far');
  });
  fs.mkdirSync('test-results', { recursive: true });
  for (const weather of ['clear', 'rain', 'snow']) {
    const state = await page.evaluate(weather => {
      const g = window.__overtake;
      g.setWeatherMode(weather);
      Object.assign(g.weather, { rain: weather === 'rain' ? 1 : 0, wet: weather === 'rain' ? 1 : 0,
        snow: weather === 'snow' ? 1 : 0, snowCover: weather === 'snow' ? 1 : 0 });
      g.updateWorld(0.016); g.updateRoad();
      const snow = g.snowLayer.geometry.getAttribute('position');
      const uv = g.snowLayer.geometry.getAttribute('uv');
      const y0 = snow.getY(0), yMid = snow.getY(16);
      return { visible: g.snowLayer.visible, wet: g.roadSurface.wet.value,
        rain: g.roadSurface.rain.value, cover: g.roadSurface.snow.value,
        textureLoaded: !!g.asphaltMat.map.image && !!g.asphaltMat.normalMap.image,
        firstV: uv.getY(0), bankDifference: y0 - yMid,
        posts: g.posts.count, reflectors: g.reflectors.count,
        railVertices: g.railL.geometry.getAttribute('position').count,
        railProfileHeight: g.railL.geometry.getAttribute('position').getY(10) - g.railL.geometry.getAttribute('position').getY(0),
        capCount: g.railCaps.length };
    }, weather);
    assert.equal(state.visible, weather === 'snow');
    assert.equal(state.wet > 0.9, weather === 'rain');
    assert.equal(state.rain > 0.9, weather === 'rain');
    assert.equal(state.cover > 0.9, weather === 'snow');
    assert.ok(state.textureLoaded);
    assert.ok(state.posts >= 230 && state.posts === state.reflectors, 'barrier supports and reflectors cover both sides');
    assert.equal(state.railVertices, 181 * 11);
    assert.ok(state.railProfileHeight > 0.4, 'guardrail is a vertical corrugated profile');
    assert.equal(state.capCount, 2);
    if (weather === 'snow') assert.ok(state.bankDifference > 0.04, 'snow mesh has raised shoulders');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/road-${weather}.png`, timeout: 120000 });
    console.log(weather, state);
  }
  const delta = await page.evaluate(() => {
    const g = window.__overtake;
    const uv = g.snowLayer.geometry.getAttribute('uv');
    const old = uv.getY(0); g.playerS += 32; g.updateRoad();
    return uv.getY(0) - old;
  });
  assert.ok(Math.abs(delta - 32) < 0.0001, 'snow pattern follows road distance rather than the camera');
  const continuity = await page.evaluate(() => {
    const g=window.__overtake, rail=g.railL.geometry.getAttribute('position');
    const old=[rail.getX(11),rail.getY(11),rail.getZ(11)];
    const oldUV=g.railL.geometry.getAttribute('uv').getY(11);
    g.playerS+=4; g.updateRoad();
    return {error:Math.hypot(rail.getX(0)-old[0],rail.getY(0)-old[1],rail.getZ(0)-old[2]),
      uvError:Math.abs(g.railL.geometry.getAttribute('uv').getY(0)-oldUV)};
  });
  assert.ok(continuity.error < 0.001 && continuity.uvError < 0.001, 'guardrail remains fixed to the curved road as it scrolls');
  const lamps = await page.evaluate(() => { const g=window.__overtake;g.setTimeOfDay(0);g.setWeatherMode('rain');
    Object.assign(g.weather,{rain:1,wet:1,snow:0,snowCover:0});
    for(let i=0;i<30;i++) g.updateWorld(0.1);g.updateRoad();
    const [left,right]=g.lamps;
    const pole=left.g.getObjectByName('streetlight-pole-and-arm'), lens=left.g.getObjectByName('streetlight-lens');
    return {count:g.lamps.length, children:left.g.children.length, mirrored:left.g.scale.x===-right.g.scale.x,
      poleVertices:pole.geometry.attributes.position.count, shared:pole.geometry===right.g.getObjectByName('streetlight-pole-and-arm').geometry,
      lensVisible:!!lens && lens.material.emissiveIntensity>0.4}; });
  assert.equal(lamps.count,24);assert.equal(lamps.children,4);assert.equal(lamps.mirrored,true);
  assert.ok(lamps.poleVertices>500 && lamps.shared && lamps.lensVisible, 'detailed streetlight geometry and lens should be shared and respond to night');
  await page.screenshot({path:'test-results/road-rain-night.png',timeout:120000});
  assert.deepEqual(errors, []);
  console.log('Road surfaces OK');
} finally {
  await browser.close();
}
