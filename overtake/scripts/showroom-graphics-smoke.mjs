// Showroom presentation, every car, orbit, weather and mobile controls.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL || 'http://localhost:3000';
const real=process.env.REAL_RENDER==='1';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(real?base:`${base}/?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 await page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);g.garageAuto=false;});
 fs.mkdirSync('test-results',{recursive:true});
 const checks=[];
 for(const id of ['golf','mercedes','audi','mustang','ferrari','r8','challenger']) {
  const result=await page.evaluate(id=>{
   const g=window.__overtake;g.setSelectedCar(id);g.garageAngle=Math.PI*.78;g.garagePitch=.32;g.updateCamera(0);g.composer.render();
   return {id, car:g.player.name, width:g.playerMeta.width, length:g.playerMeta.length,
    shadow:[g.showroomShadow.scale.x,g.showroomShadow.scale.y], floor:!!g.garageGroup.getObjectByName('showroom-floor'),
    wall:!!g.garageGroup.getObjectByName('showroom-wall'), stage:!!g.garageGroup.getObjectByName('showroom-stage'),
    showroom:g.garageGroup.visible, road:g.roadGroup.visible};
  },id);
  assert.ok(result.width>0 && result.length>0 && result.floor && result.wall && result.stage && result.showroom && !result.road);
  assert.ok(Math.abs(result.shadow[0]-result.width*1.65)<.001 && Math.abs(result.shadow[1]-result.length*1.3)<.001);
  checks.push(result);
  if(real) await page.screenshot({path:`test-results/showroom-car-${id}.png`,timeout:120000});
 }
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
  const result=await page.evaluate(angle=>{const g=window.__overtake;g.garageAngle=angle;g.garageZoom=12;g.updateCamera(0);g.composer.render();return {pos:g.camera.position.toArray(), wall:g.garageGroup.getObjectByName('showroom-wall').visible};},angle);
  assert.ok(result.wall && result.pos.every(Number.isFinite));
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const g=window.__overtake;g.garageZoom=9.0;g.garageAngle=Math.PI*.78;g.setSelectedCar('golf');g.updateCamera(0);g.composer.render();});
 const mobile=await page.evaluate(()=>{const g=window.__overtake, detail=document.querySelector('#car-detail').getBoundingClientRect(), list=document.querySelector('.car-list').getBoundingClientRect(), start=document.querySelector('#btn-start').getBoundingClientRect();return {view:g.camera.view?.enabled,detail:{top:detail.top,bottom:detail.bottom},list:{top:list.top,bottom:list.bottom},start:{top:start.top,bottom:start.bottom},scroll:document.querySelector('#car-detail').scrollHeight>document.querySelector('#car-detail').clientHeight};});
 assert.ok(mobile.view && mobile.detail.top>300 && mobile.detail.bottom<=mobile.list.top && mobile.list.bottom<=844);
 assert.ok(mobile.start.top>=mobile.detail.top && mobile.start.bottom<=mobile.detail.bottom,'start button visible');
 if(real) await page.screenshot({path:'test-results/showroom-final-mobile.png',timeout:120000});
 await page.setViewportSize({width:568,height:320});
 const landscape=await page.evaluate(()=>{const g=window.__overtake;g.updateCamera(0);g.composer.render();const d=document.querySelector('#car-detail').getBoundingClientRect(),l=document.querySelector('.car-list').getBoundingClientRect(),b=document.querySelector('#btn-start').getBoundingClientRect();return {view:g.camera.view?.enabled||false,detail:d.toJSON(),list:l.toJSON(),start:b.toJSON(),scroll:document.querySelector('#car-detail').scrollHeight>document.querySelector('#car-detail').clientHeight};});
 assert.equal(landscape.view,false);assert.ok(landscape.list.right<landscape.detail.left && landscape.detail.bottom<=320 && landscape.scroll);
 assert.ok(landscape.start.top>=landscape.detail.top && landscape.start.bottom<=landscape.detail.bottom);
 if(real) await page.screenshot({path:'test-results/showroom-final-landscape.png',timeout:120000});
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const g=window.__overtake;g.updateCamera(0);g.composer.render();});
 await page.click('#btn-customize');assert.ok(await page.locator('#custom-panel').isVisible());await page.click('#custom-done');
 await page.click('#btn-start');
 const road=await page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);g.playerS=900;g.weather.snowCover=0;g.updateRoad();const before=Array.from(g.roadStuds.instanceMatrix.array.slice(16,32));g.playerS+=9;g.updateRoad();const after=Array.from(g.roadStuds.instanceMatrix.array.slice(0,16));const visible=g.roadStuds.visible;g.weather.snowCover=1;g.updateRoad();const snowy=g.roadStuds.visible;g.atmosphere.update(0,{rain:0,snow:0},{fog:0xbfd4e2},g.camera.position,1);g.updateWorld(.01);return {before,after,visible,snowy,count:g.roadStuds.count,garage:g.garageGroup.visible,world:g.roadGroup.visible};});
 assert.deepEqual(road.before,road.after);assert.ok(road.visible&&!road.snowy&&road.count>70&&!road.garage&&road.world);
 assert.deepEqual(errors,[]);console.log({real,checks,mobile,landscape,road,errors});
} finally {await browser.close();}
