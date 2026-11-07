// Score economy, one-time reset, purchases, dev preview, persistence and mobile.
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
  await page.addInitScript(()=>{
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('overtake-progression-v1',JSON.stringify({version:1,xp:9000,dev:true,legacyCar:'ferrari'}));
      localStorage.setItem('overtake-car','ferrari');
      localStorage.setItem('overtake-customization-v1',JSON.stringify({golf:{front:'track'}}));
      localStorage.setItem('overtake-paints',JSON.stringify({golf:'#ff0000'}));
      localStorage.setItem('overtake-best','5000'); sessionStorage.setItem('seeded','1');
    }
  });
  async function load(){await page.goto(`${base}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.click('#menu-garage');await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));}
  const state=()=>page.evaluate(()=>window.__overtake.getProgression());
  await load();
  assert.deepEqual(await state(),{version:2,money:0,dev:false,owned:['golf'],upgrades:{},tunes:{}});
  assert.equal(await page.locator('.car-card.active').getAttribute('data-car'),'golf');
  assert.equal(await page.evaluate(()=>localStorage.getItem('overtake-best')),'5000');
  assert.ok(await page.evaluate(()=>localStorage.getItem('overtake-customization-v1-before-economy')));
  await page.click('[data-car=mustang]');
  assert.equal(await page.locator('#btn-start').isDisabled(),true);assert.equal(await page.locator('#buy-car').isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.__overtake.start()),false);
  await page.click('#dev-toggle');assert.equal(await page.locator('#btn-start').isEnabled(),true);
  await load();assert.equal((await state()).dev,true);assert.equal((await state()).money,0);
  await page.click('#dev-toggle');assert.equal(await page.locator('#btn-start').isDisabled(),true);
  await page.click('[data-car=golf]');
  await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
  await page.click('[data-part-panel=front] .workshop-choices button[data-value=street]');
  assert.equal(await page.locator('#custom-front').inputValue(),'stock');
  assert.match(await page.locator('#tune-message').innerText(),/not enough/i);
  await page.click('#custom-done');await page.click('#btn-start');
  await page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);g.run.score=5000;g.endRun('crash');});
  assert.equal((await state()).money,11250);assert.match(await page.locator('#final-progress').innerText(),/\+\$11,250/);
  await page.click('#btn-garage');assert.equal((await state()).money,11250);
  const baseSpeed=await page.evaluate(()=>window.__overtake.getMaxSpeed());
  await page.click('[data-garage-tab=upgrades]');await page.click('[data-upgrade=engine]');assert.equal((await state()).money,10550);
  assert.ok(await page.evaluate(base=>window.__overtake.getMaxSpeed()>base,baseSpeed));
  await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-part-panel=front] .workshop-choices button[data-value=street]');
  assert.equal((await state()).money,10300);assert.equal(await page.locator('#custom-front').inputValue(),'street');
  await page.click('[data-part-panel=front] .workshop-choices button[data-value=stock]');
  await page.click('[data-part-panel=front] .workshop-choices button[data-value=street]');assert.equal((await state()).money,10300);
  await page.click('#custom-done');await page.click('[data-car=mustang]');await page.click('#buy-car');
  assert.equal((await state()).money,7300);assert.ok((await state()).owned.includes('mustang'));
  await page.click('#btn-start');
  await page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);g.run.score=2000;g.pause();g.toGarage();g.toGarage();});
  assert.equal((await state()).money,10300);
  await load();assert.equal((await state()).money,10300);assert.ok((await state()).owned.includes('mustang'));assert.equal((await state()).upgrades.golf.engine,1);
  await page.click('[data-car=golf]');await page.click('#dev-toggle');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
  await page.click('[data-part-panel=front] .workshop-choices button[data-value=track]');
  assert.equal(await page.locator('#custom-front').inputValue(),'track');assert.equal((await state()).money,10300);
  await page.click('#custom-done');await page.click('#dev-toggle');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
  assert.equal(await page.locator('#custom-front').inputValue(),'street','dev tuning must not persist as a free purchase');
  await page.click('#custom-done');
  for(const viewport of [{width:390,height:844},{width:667,height:375}]){
    await page.setViewportSize(viewport);await page.locator('#dev-toggle').scrollIntoViewIfNeeded();await page.click('#dev-toggle');await page.click('#dev-toggle');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  assert.deepEqual(errors,[]);console.log('Economy smoke passed: reset, payouts, purchases, upgrades, dev preview and mobile.');
}finally{await browser.close();}
