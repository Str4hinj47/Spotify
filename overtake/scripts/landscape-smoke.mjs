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
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`);
  await page.waitForSelector('#topbar:not(.hidden)', { timeout: 180000 });
  await page.click('#btn-start');
  await page.evaluate(() => { const g=window.__overtake; cancelAnimationFrame(g.raf); g.clearTraffic(); g.trySpawn=()=>{}; g.setCycleRunning(false); g.setWeatherMode('clear'); });
  fs.mkdirSync('test-results', { recursive: true });
  for (const st of [{name:'day', s:4700, hour:13, snow:0}, {name:'forest', s:1500, hour:16, snow:0}, {name:'snow', s:14400, hour:10, snow:1}, {name:'night', s:7800, hour:23, snow:0}, {name:'rain', s:4700, hour:15, snow:0, rain:1}]) {
    const result = await page.evaluate(st => {
      const g=window.__overtake;
      g.vehicle.s=st.s; g.vehicle.speed=0; g.setTimeOfDay(st.hour);
      g.setWeatherMode(st.snow ? 'snow' : st.rain ? 'rain' : 'clear');
      Object.assign(g.weather, { rain:st.rain || 0, wet:st.rain || 0, snow:st.snow, snowCover:st.snow });
      g.updateDriving(0.01);
      for(let i=0;i<15;i++) g.updateWorld(0.1);
      g.updateScenery(); g.composer.render();
      return { ridges:g.mountains.children.length, grass:g.grass.count, trees:g.distantTrees.count,
        skyCloud:g.atmosphere.skyMat.uniforms.cloudLight.value, snow:g.weather.snowCover };
    }, st);
    assert.equal(result.ridges,2); assert.equal(result.grass,420); assert.equal(result.trees,180);
    assert.ok(Number.isFinite(result.skyCloud));
    await page.screenshot({path:`test-results/landscape-${st.name}.png`,timeout:120000});
    console.log(st.name, result);
  }
  // A slot already in view must not teleport or rotate when the instanced
  // ring buffer shifts forward by one distance interval.
  const stable = await page.evaluate(() => {
    const g=window.__overtake; g.playerS=4700; g.updateScenery();
    const before=Array.from(g.grass.instanceMatrix.array.slice(60*16,61*16));
    g.playerS=4704; g.updateScenery();
    const after=Array.from(g.grass.instanceMatrix.array.slice(58*16,59*16));
    return { before, after, distantVertices:g.distantTrees.geometry.attributes.position.count };
  });
  assert.deepEqual(stable.before, stable.after, 'grass placement changes at a slot boundary');
  assert.ok(stable.distantVertices < 500, 'middle-distance trees should stay low-poly');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
