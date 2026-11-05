// Against the local Vite server: verify tinted RS6 glass, Mercedes rubber,
// sustained snowfall and composer antialiasing in the real (non-test) mode.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']);
const browser = await pw.launch({ executablePath: await chromium.executablePath(), args, headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` } });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topbar:not(.hidden)', { timeout: 180000 });
  const result = await page.evaluate(() => {
    const g = window.__overtake;
    const find = (id, prefix) => {
      const mats = [];
      g.library.get(id).scene.traverse(o => {
        if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.name.startsWith(prefix)) mats.push(m);
      });
      return mats;
    };
    const glass = find('audi', 'glass__').map(m => ({ opaque: !m.transparent && m.opacity === 1 }));
    const tires = find('mercedes', 'tire__').map(m => ({ name: m.name, color: m.color.getHexString(), metalness: m.metalness, roughness: m.roughness }));
    const p = g.precipitation;
    for (let i = 0; i < 600; i++) p.update(0.05, g.camera.position, 55, { snow: 1, rain: 0, wind: 0.5 }, i * 0.05);
    let nearEye = 0; for (let i = 1; i < p.snowPos.length; i += 3) if (p.snowPos[i] >= -4 && p.snowPos[i] <= 8) nearEye++;
    return { glass, tires, snowCount: p.snowGeo.drawRange.count, nearEye, maxSamples: g.renderer.capabilities.maxSamples,
      multisampling: g.composer.multisampling, passes: g.composer.passes.length };
  });
  assert.ok(result.glass.length && result.glass.every(m => m.opaque));
  assert.ok(result.tires.some(m => m.name.includes('W222 - Wheel') && m.color !== 'ffffff' && m.metalness === 0 && m.roughness >= 0.9));
  assert.equal(result.snowCount, 4400);
  assert.ok(result.nearEye > 600, `too few flakes remain at eye level while moving: ${result.nearEye}`);
  if (result.maxSamples > 0) assert.equal(result.multisampling, Math.min(4, result.maxSamples));
  else assert.ok(result.passes >= 3, 'FXAA fallback is present');
  fs.mkdirSync('test-results', { recursive: true });
  await page.addStyleTag({ content: '#garage, #topbar { visibility: hidden !important; }' });
  for (const id of ['audi', 'mercedes', 'r8']) {
    await page.evaluate(id => {
      const g = window.__overtake;
      g.setSelectedCar(id); g.garageAuto = false; g.garageZoom = 4.8;
      g.garageAngle = id === 'mercedes' ? Math.PI / 2 : 0;
    }, id);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/${id}-weather-fix.png`, timeout: 120000 });
  }
  assert.deepEqual(errors, []);
  console.log(result);
} finally { await browser.close(); }
