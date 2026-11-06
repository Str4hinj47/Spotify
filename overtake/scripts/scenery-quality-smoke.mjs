// Exercise the scenery modes, recycling, terrain, weather and compact UI.
// BASE_URL can point to a different Vite server.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://localhost:3000';
const browser = await pw.launch({ executablePath: await chromium.executablePath(), headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` } });
const errors=[];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  await page.goto(`${base}/?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.waitForFunction(()=>window.__overtake.detailedScenery.ready,null,{timeout:180000});
  await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
  assert.equal(await page.evaluate(()=>window.__overtake.getSceneryQuality()),'high');
  await page.click('#btn-start');
  await page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);g.clearTraffic();g.trySpawn=()=>{};g.setCycleRunning(false);g.setTimeOfDay(12);g.setWeatherMode('clear');Object.assign(g.weather,{rain:0,wet:0,snow:0,snowCover:0});g.vehicle.s=1500;g.vehicle.speed=0;g.updateDriving(.01);g.updateCamera(2);g.atmosphere.update(12,g.weather,{fog:0xbfd4e2},g.camera.position,5);});
  const snapshot = () => page.evaluate(()=>{
    const g=window.__overtake, r=g.renderer;
    const species={};
    for(const name of ['broadleaf','conifer','fern','rock']){
      const o=g.roadGroup.children.find(m=>m.name==='detailed-'+name);
      species[name]=o?.visible ? o.count : 0;
    }
    r.info.autoReset=false;r.info.reset();g.composer.render();const triangles=r.info.render.triangles;r.info.autoReset=true;
    return {quality:g.getSceneryQuality(),species,triangles,oldTrees:g.cheapBroadleaf.visible,panorama:g.mountainBackdrop.visible};
  });
  const high=await snapshot();assert.ok(high.species.conifer>30);assert.ok(high.species.broadleaf>10);assert.ok(high.species.fern>10);assert.equal(high.oldTrees,false);assert.equal(high.panorama,true);
  // Absolute slots don't jitter when the car crosses a recycling boundary.
  const stability=await page.evaluate(()=>{
    const g=window.__overtake;
    const get=()=>{const o=g.roadGroup.children.find(m=>m.name==='detailed-conifer');const a=o.instanceMatrix.array;return Array.from({length:o.count},(_,i)=>[a[i*16+12],a[i*16+14]].map(n=>n.toFixed(2)).join(','));};
    g.playerS=1504;g.updateScenery();const before=get();g.playerS=1506;g.updateScenery();const after=new Set(get());return {before:before.length,common:before.filter(x=>after.has(x)).length};
  });
  assert.ok(stability.common/stability.before>.85,JSON.stringify(stability));
  await page.click('#btn-graphics');
  await page.click('[data-scenery=medium]');assert.equal(await page.locator('[data-scenery=medium]').getAttribute('aria-pressed'),'true');
  const medium=await snapshot();assert.equal(medium.quality,'medium');assert.ok(medium.species.conifer<high.species.conifer);assert.ok(medium.species.broadleaf<high.species.broadleaf);
  await page.click('[data-scenery=low]');
  const low=await snapshot();assert.equal(low.quality,'low');assert.equal(low.species.conifer,0);assert.equal(low.oldTrees,true);assert.equal(low.panorama,false);
  assert.ok(low.triangles < high.triangles * .7, `low ${low.triangles}, high ${high.triangles}`);
  assert.equal(await page.evaluate(()=>localStorage.getItem('overtake-scenery-quality')),'low');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'btn-graphics');
  await page.click('#btn-pause');await page.click('#btn-pause-graphics');await page.click('[data-scenery=high]');
  assert.equal(await page.locator('[data-scenery=high]').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'btn-pause-graphics');
  await page.click('#btn-resume');
  // Snow and nighttime both render with the updated materials and no shader errors.
  fs.mkdirSync('test-results',{recursive:true});
  await page.evaluate(()=>{const g=window.__overtake;Object.assign(g.weather,{snow:1,snowCover:1,rain:0,wet:0});g.roadSurface.snow.value=1;g.updateRoad();g.atmosphere.update(16,g.weather,{fog:0xcfdbe6},g.camera.position,5);g.composer.render();});
  await page.screenshot({path:'test-results/scenery-snow.png',timeout:120000});
  await page.evaluate(()=>{const g=window.__overtake;Object.assign(g.weather,{snow:0,snowCover:0,rain:0,wet:0});g.roadSurface.snow.value=0;g.updateRoad();g.atmosphere.update(0,g.weather,{fog:0xbfd4e2},g.camera.position,5);g.composer.render();});
  await page.screenshot({path:'test-results/scenery-night.png',timeout:120000});
  await page.setViewportSize({width:568,height:320});await page.click('#btn-graphics');
  const mobile=await page.evaluate(()=>{const p=document.querySelector('#graphics-panel'),r=p.getBoundingClientRect();return {inside:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,scrollable:p.scrollHeight>p.clientHeight};});
  assert.deepEqual(mobile,{inside:true,scrollable:true});
  await page.locator('[data-scenery=low]').click();
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  assert.equal(await page.evaluate(()=>window.__overtake.getSceneryQuality()),'low');
  assert.equal(await page.evaluate(()=>window.__overtake.detailedScenery.ready),false, 'low quality avoids loading detailed models');
  assert.equal(await page.evaluate(()=>window.__overtake.cheapBroadleaf.visible),true);
  await page.click('#btn-graphics');await page.click('[data-scenery=high]');
  await page.waitForFunction(()=>window.__overtake.detailedScenery.ready,null,{timeout:180000});
  assert.equal(await page.evaluate(()=>window.__overtake.cheapBroadleaf.visible),false);
  assert.deepEqual(errors,[]);console.log({high,medium,low,stability,mobile,errors});
} finally {await browser.close();}
