// End-to-end progression, persistence, reversible bypass, lifecycle and compact layout.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL || 'http://localhost:3000';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:960,height:700}});
  page.on('pageerror',e=>errors.push(String(e)));
  async function load() { await page.goto(`${base}/?test=1`,{waitUntil:'domcontentloaded',timeout:180000}); await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000}); await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf)); }
  const state=()=>page.evaluate(()=>window.__overtake.getProgression());
  await load();
  assert.equal((await state()).xp,0);
  assert.equal(await page.locator('#dev-toggle').getAttribute('aria-pressed'),'false');
  await page.click('[data-car=mustang]');
  assert.equal(await page.locator('#btn-start').isDisabled(),true);
  assert.match(await page.locator('#car-requirement').innerText(),/150 XP/);
  assert.equal(await page.evaluate(()=>window.__overtake.start()),false);
  assert.equal(await page.evaluate(()=>window.__overtake.mode),'garage');
  await page.click('#dev-toggle');
  assert.equal(await page.locator('#btn-start').isEnabled(),true);
  await load();
  assert.equal((await state()).dev,true);
  assert.equal(await page.locator('#btn-start').isEnabled(),true);
  await page.click('#dev-toggle');
  assert.equal(await page.locator('#btn-start').isDisabled(),true);
  await page.click('[data-car=golf]');
  await page.click('#btn-start');
  await page.evaluate(()=>{const g=window.__overtake; cancelAnimationFrame(g.raf); g.run.score=1400; g.run.distance=500; g.endRun('crash');});
  assert.equal((await state()).xp,150);
  assert.match(await page.locator('#final-progress').innerText(),/\+150 XP.*Unlocked: Mustang/i);
  await page.click('#btn-garage');
  assert.equal((await state()).xp,150);
  await page.click('[data-car=mustang]');
  assert.equal(await page.locator('#btn-start').isEnabled(),true);
  await page.click('#btn-start');
  await page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);g.run.score=100;g.run.distance=100;g.pause();g.toGarage();g.toGarage();});
  assert.equal((await state()).xp,162);
  await load();
  assert.equal((await state()).xp,162);
  assert.equal((await state()).dev,false);
  for (const viewport of [{width:390,height:844},{width:667,height:375}]) {
    await page.setViewportSize(viewport);
    await page.locator('#dev-toggle').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#dev-toggle').isVisible(),true);
    await page.click('#dev-toggle'); assert.equal((await state()).dev,true);
    await page.click('#dev-toggle'); assert.equal((await state()).dev,false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
  }
  // Isolated legacy storage: previously selected car and historical bests survive migration.
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('overtake-car','ferrari');localStorage.setItem('overtake-best','1000');});
  await load();
  assert.deepEqual(await state(),{version:1,xp:100,dev:false,legacyCar:'ferrari'});
  assert.equal(await page.locator('#btn-start').isEnabled(),true);
  await page.evaluate(()=>localStorage.setItem('overtake-progression-v1','{broken'));
  await load();
  assert.deepEqual(await state(),{version:1,xp:0,dev:false,legacyCar:null});
  assert.equal(await page.locator('#btn-start').isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('Progression smoke passed: locks, override, reload, settlements, migration and mobile.');
} finally { await browser.close(); }
