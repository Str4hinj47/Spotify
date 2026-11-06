import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())}); page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://localhost:3000/?test=1'); await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.evaluate(()=>{localStorage.removeItem('overtake-customization-v1')});
  await page.click('#dev-toggle');
  await page.click('.car-card[data-car="golf"]'); await page.click('#btn-customize');
  assert.ok(await page.locator('#custom-panel').isVisible());
  for (const part of ['front','rear','skirts','spoiler','exhaust']) { await page.click(`[data-workshop-part="${part}"]`); await page.click(`[data-part-panel="${part}"] .workshop-choices button[data-value="track"]`); }
  await page.click('[data-workshop-tab="lighting"]');
  await page.check('#custom-glow-enabled'); await page.locator('#custom-glow-color').fill('#ff32bc');
  await page.click('[data-custom-view="rear"]');
  const custom = await page.evaluate(() => {
    const g=window.__overtake, kit=g.player.getObjectByName('custom-body-kit');
    return {names:kit.children.map(c=>c.name), color:kit.getObjectByName('underglow-pool').material.color.getHexString(),
      saved:JSON.parse(localStorage.getItem('overtake-customization-v1')).golf, angle:g.garageAngle};
  });
  for(const part of ['front','rear','skirts','spoiler','exhaust','underglow']) assert.ok(custom.names.includes(`custom-${part}`));
  assert.equal(custom.color,'ff32bc'); assert.equal(custom.saved.glowColor,'#ff32bc'); assert.equal(custom.angle,0);
  fs.mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/custom-workshop.png',timeout:120000});
  // Another model starts stock and can have a different setup.
  await page.click('.car-card[data-car="audi"]'); assert.equal(await page.locator('#custom-front').inputValue(),'stock');
  await page.click('[data-workshop-tab="body"]'); await page.click('[data-workshop-part="front"]'); await page.click('[data-part-panel="front"] .workshop-choices button[data-value="street"]');
  await page.click('.car-card[data-car="golf"]'); assert.equal(await page.locator('#custom-front').inputValue(),'track');
  assert.equal(await page.locator('#custom-glow-enabled').isChecked(),true);
  await page.click('#custom-done'); await page.click('#btn-start');
  assert.equal(await page.evaluate(()=>!!window.__overtake.player.getObjectByName('underglow-pool')),true);
  const traffic=await page.evaluate(()=>window.__overtake.traffic.map(t=>!!t.group.getObjectByName('custom-body-kit')));
  assert.ok(traffic.every(x=>!x));
  await page.evaluate(()=>{const g=window.__overtake;g.clearTraffic();g.trySpawn=()=>{};g.setTimeOfDay(23);g.setCycleRunning(false);for(let i=0;i<20;i++)g.updateWorld(.1);g.composer.render()});
  await page.screenshot({path:'test-results/custom-driving.png',timeout:120000});
  // Reload and verify per-car persistence, then reset only the current car.
  await page.reload({timeout:180000,waitUntil:'domcontentloaded'}); await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.click('.car-card[data-car="golf"]');await page.click('#btn-customize');
  assert.equal(await page.locator('#custom-exhaust').inputValue(),'track');
  assert.equal(await page.locator('#custom-glow-color').inputValue(),'#ff32bc');
  await page.click('#custom-reset');assert.equal(await page.locator('#custom-exhaust').inputValue(),'stock');assert.equal(await page.locator('#custom-glow-enabled').isChecked(),false);
  await page.click('.car-card[data-car="audi"]');assert.equal(await page.locator('#custom-front').inputValue(),'street');
  const fits=await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js');const g=window.__overtake;let out=[];for(const id of ['golf','mercedes','audi','mustang','ferrari','r8','challenger']){g.library.setCustomization(id,{front:'track',rear:'track',skirts:'track',spoiler:'track',exhaust:'track',underglow:true,glowColor:'#00ffff'});const c=g.library.create(id,{player:true});c.updateMatrixWorld(true);const kit=c.getObjectByName('custom-body-kit'), box=new T.Box3().setFromObject(kit), base=g.library.get(id);out.push({id,names:kit.children.map(x=>x.name),min:box.min.toArray(),max:box.max.toArray(),length:base.length,height:base.height,wingHidden:id==='r8'?c.getObjectByName('trim_1').visible:null});}return out});
  for(const fit of fits) { assert.equal(fit.names.length,6); assert.ok(fit.min.every(Number.isFinite)&&fit.max.every(Number.isFinite)); assert.ok(fit.max[2]-fit.min[2]<fit.length*1.5); }
  assert.equal(fits.find(f=>f.id==='r8').wingHidden,false);
  await page.setViewportSize({width:390,height:844});
  const compact = await page.evaluate(() => { const g=window.__overtake;g.updateCamera(0);g.composer.render();return {view:g.camera.view?.enabled, list:getComputedStyle(document.querySelector('.car-list')).display}; });
  assert.equal(compact.view,true); assert.equal(compact.list,'none');
  await page.click('#custom-done'); await page.click('#btn-start');
  assert.equal(await page.evaluate(()=>{const g=window.__overtake;g.updateCamera(0);return !!g.camera.view?.enabled}),false,'workshop camera offset must not leak into driving');
  assert.deepEqual(errors,[]);console.log({custom, fits, errors});
} finally {await browser.close();}
