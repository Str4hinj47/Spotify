// Exercise the scenery modes, recycling, terrain, weather and compact UI.
// BASE_URL can point to a different Vite server.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://localhost:3000';
const realRender = process.env.REAL_RENDER === '1';
const browser = await pw.launch({ executablePath: await chromium.executablePath(), headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` } });
const errors=[];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  await page.goto(realRender ? `${base}/play.html` : `${base}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
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
    return {quality:g.getSceneryQuality(),species,triangles,oldTrees:g.cheapBroadleaf.visible,panorama:g.mountainBackdrop.visible, grass:g.roadsideGrass.mesh.count, flowers:g.roadsideGrass.wildflowers.count, scrub:g.roadsideGrass.desertScrub.count, treeline:g.midgroundTreeline.mesh.count, photoDetail:g.atmosphere.skyMat.uniforms.photoDetail.value};
  });
  const high=await snapshot();assert.ok(high.species.conifer>30);assert.ok(high.species.broadleaf>10);assert.ok(high.species.fern>10);assert.equal(high.oldTrees,false);assert.equal(high.panorama,true);assert.ok(high.grass>50);assert.ok(high.treeline>5);assert.equal(high.photoDetail,1);
  const biomes=await page.evaluate(()=>{
    const g=window.__overtake, out=[];
    for(const distance of [500,1750,5250,8250,14750]) {
      g.playerS=distance;g.updateRoad();
      const pos=g.terrain.geometry.getAttribute('position').array;
      out.push({distance,desert:g.desertPanoramaBlend.value,buildings:g.detailedBuildings.count, brick:g.brickBuildings.count, treeline:g.midgroundTreeline.mesh.count,
        finite:Array.from(pos).every(Number.isFinite),visible:g.mountainBackdrop.visible, grass:g.roadsideGrass.mesh.count, flowers:g.roadsideGrass.wildflowers.count, scrub:g.roadsideGrass.desertScrub.count, dry:g.groundMat.userData.groundDetail.dry.value});
    }
    g.playerS=1500;g.updateRoad();return out;
  });
  assert.ok(biomes[0].desert > .9 && biomes[1].desert < .1);
  assert.equal(biomes[0].buildings,0);assert.equal(biomes[0].brick,0);
  assert.ok(biomes[1].treeline > biomes[0].treeline);
  assert.ok(biomes[0].scrub > 40 && biomes[0].grass === 0 && biomes[0].flowers === 0 && biomes[0].dry > .9);
  assert.ok(biomes[2].flowers > 10 && biomes[2].scrub === 0 && biomes[2].dry < .1);
  assert.ok(biomes[3].buildings > 0 && biomes[3].brick > 0);
  assert.ok(biomes.every(b=>b.finite&&b.visible));
  const offRoad=await page.evaluate(()=>{
    const g=window.__overtake; let min=Infinity;
    const centerX=s=>16*Math.sin(s*.004)+8*Math.sin(s*.009+1.7)+4*Math.sin(s*.017+.4);
    for(const distance of [500,1750,5250,8250,14750]) {
      g.playerS=distance;g.updateScenery();
      for(const o of [g.roadsideGrass.mesh,g.roadsideGrass.wildflowers,g.roadsideGrass.desertScrub]) {
        const a=o.instanceMatrix.array;
        for(let i=0;i<o.count;i++) min=Math.min(min, Math.abs(a[i*16+12]-centerX(-a[i*16+14])));
      }
    }
    g.playerS=1500;g.updateScenery();return min;
  });
  assert.ok(offRoad > 7.5, `plants should remain beyond the shoulder: ${offRoad}`);
  // Absolute slots don't jitter when the car crosses a recycling boundary.
  const stability=await page.evaluate(()=>{
    const g=window.__overtake;
    const get=()=>{const o=g.roadGroup.children.find(m=>m.name==='detailed-conifer');const a=o.instanceMatrix.array;return Array.from({length:o.count},(_,i)=>[a[i*16+12],a[i*16+14]].map(n=>n.toFixed(2)).join(','));};
    g.playerS=1504;g.updateScenery();const before=get();g.playerS=1506;g.updateScenery();const after=new Set(get());return {before:before.length,common:before.filter(x=>after.has(x)).length};
  });
  assert.ok(stability.common/stability.before>.85,JSON.stringify(stability));
  const grassStability=await page.evaluate(()=>{
    const g=window.__overtake, o=g.roadsideGrass.mesh;
    const get=()=>{const a=o.instanceMatrix.array;return Array.from({length:o.count},(_,i)=>[a[i*16+12],a[i*16+14]].map(n=>n.toFixed(2)).join(','));};
    g.playerS=1504;g.updateScenery();const before=get();g.playerS=1506;g.updateScenery();const after=new Set(get());return {before:before.length,common:before.filter(x=>after.has(x)).length};
  });
  assert.ok(grassStability.before>50 && grassStability.common/grassStability.before>.9,JSON.stringify(grassStability));
  const treelineStability=await page.evaluate(()=>{
    const g=window.__overtake, o=g.midgroundTreeline.mesh;
    const get=()=>{const a=o.instanceMatrix.array;return Array.from({length:o.count},(_,i)=>[a[i*16+12],a[i*16+14]].map(n=>n.toFixed(2)).join(','));};
    g.playerS=1750;g.updateScenery();const before=get();g.playerS=1755;g.updateScenery();const after=new Set(get());return {before:before.length,common:before.filter(x=>after.has(x)).length};
  });
  assert.ok(treelineStability.before>10 && treelineStability.common/treelineStability.before>.85,JSON.stringify(treelineStability));
  await page.evaluate(()=>{const g=window.__overtake;g.playerS=1506;g.updateScenery();});
  await page.click('#btn-graphics');
  await page.click('[data-scenery=medium]');assert.equal(await page.locator('[data-scenery=medium]').getAttribute('aria-pressed'),'true');
  const medium=await snapshot();assert.equal(medium.quality,'medium');assert.ok(medium.species.conifer<high.species.conifer);assert.ok(medium.species.broadleaf<high.species.broadleaf);assert.ok(medium.grass<high.grass && medium.grass>0);assert.ok(medium.treeline<high.treeline);
  await page.click('[data-scenery=low]');
  const low=await snapshot();assert.equal(low.quality,'low');assert.equal(low.species.conifer,0);assert.equal(low.oldTrees,true);assert.equal(low.panorama,false);assert.equal(low.grass,0);assert.equal(low.flowers,0);assert.equal(low.scrub,0);assert.equal(low.treeline,0);assert.equal(low.photoDetail,0);
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
  assert.ok(await page.evaluate(()=>{const p=window.__overtake.roadsideGrass;return p.mesh.count+p.wildflowers.count+p.desertScrub.count;}) < (high.grass+high.flowers+high.scrub)*.4, 'snow buries most roadside plants');
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
  assert.deepEqual(errors,[]);console.log({realRender,high,medium,low,biomes,offRoad,stability,grassStability,treelineStability,mobile,errors});
} finally {await browser.close();}
