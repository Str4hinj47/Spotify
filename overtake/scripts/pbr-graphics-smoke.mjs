// Verifies the open-source HDR/PBR graphics upgrade in a real browser renderer.
// Run against the local Vite server: node scripts/pbr-graphics-smoke.mjs
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.BASE_URL || 'http://localhost:3000';
const real = process.env.REAL_RENDER === '1';
const browser = await pw.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat([
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
  ]),
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` },
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(real ? base : `${base}/?test=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#topbar:not(.hidden)', { timeout: 180000 });
  await page.addStyleTag({ content: '*{backdrop-filter:none!important;animation:none!important;transition:none!important}' });

  const graphics = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const g = window.__overtake;
    const env = g.getEnvironmentStatus();
    const reflection = g.garageGroup.getObjectByName('showroom-reflection');
    const paint = [];
    g.library.get('golf').scene.traverse(o => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.name.startsWith('paint__')) paint.push({
          physical: m.isMeshPhysicalMaterial === true,
          clearcoat: m.clearcoat,
          metalness: m.metalness,
          roughness: m.roughness,
        });
      }
    });
    return {
      env,
      envMapping: g.scene.environment?.mapping,
      cubeUV: THREE.CubeUVReflectionMapping,
      noToneMapping: THREE.NoToneMapping,
      halfFloat: THREE.HalfFloatType,
      toneMapping: g.renderer.toneMapping,
      bufferType: g.composer.inputBuffer.texture.type,
      passes: g.composer.passes.length,
      reflection: !!reflection,
      reflectionTarget: reflection?.getRenderTarget?.().width || 0,
      areaLights: g.garageGroup.children.filter(o => o.isRectAreaLight).length,
      paint,
    };
  });
  assert.equal(graphics.env.loaded, true, 'HDR environments should finish loading');
  assert.equal(graphics.env.hdr, true, 'studio HDRI should replace the procedural fallback');
  assert.equal(graphics.env.active, 'studio');
  assert.equal(graphics.envMapping, graphics.cubeUV, 'scene.environment must be a prefiltered PMREM texture');
  assert.equal(graphics.toneMapping, graphics.noToneMapping, 'scene must stay linear until postprocessing');
  assert.equal(graphics.bufferType, graphics.halfFloat, 'composer needs HDR half-float buffers');
  assert.equal(graphics.reflection, true, 'showroom planar reflection should exist');
  assert.ok(graphics.reflectionTarget >= 256, 'reflection target should be a usable size');
  assert.equal(graphics.areaLights, 3, 'three RectAreaLight softboxes should light the studio');
  assert.ok(graphics.paint.length && graphics.paint.every(m => m.physical && m.clearcoat >= 0.8 && m.metalness > 0.5));
  assert.ok(graphics.passes >= 2);

  fs.mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/pbr-garage.png', timeout: 120000 });

  await page.click('#btn-start');
  await page.evaluate(() => {
    const g = window.__overtake;
    g.setCycleRunning(false);
    g.setTimeOfDay(13);
    g.setWeatherMode('clear');
    Object.assign(g.weather, { rain: 0, snow: 0, wet: 0, snowCover: 0 });
    g.vehicle.s = 4700;
    for (let i = 0; i < 20; i++) { g.updateWorld(0.1); g.updateScenery(); g.updateCamera(0.016); }
  });
  const day = await page.evaluate(() => window.__overtake.getEnvironmentStatus());
  assert.ok(['day', 'arid', 'dusk', 'aridDusk'].includes(day.active), `unexpected day environment ${day.active}`);
  assert.ok(day.intensity > 0.2, 'day IBL intensity should be visible');
  await page.screenshot({ path: 'test-results/pbr-day.png', timeout: 120000 });

  await page.evaluate(() => {
    const g = window.__overtake;
    g.setTimeOfDay(23);
    g.setWeatherMode('rain');
    Object.assign(g.weather, { rain: 1, snow: 0, wet: 1, snowCover: 0 });
    for (let i = 0; i < 30; i++) { g.updateWorld(0.1); g.updateCamera(0.016); }
  });
  const night = await page.evaluate(() => window.__overtake.getEnvironmentStatus());
  assert.equal(night.active, 'night', 'night should select the moonless HDRI');
  assert.ok(night.intensity < day.intensity, 'night IBL should dim');
  await page.screenshot({ path: 'test-results/pbr-night-rain.png', timeout: 120000 });

  assert.deepEqual(errors, [], 'browser console errors');
  console.log({ real, graphics, day, night, errors });
} finally {
  await browser.close();
}
