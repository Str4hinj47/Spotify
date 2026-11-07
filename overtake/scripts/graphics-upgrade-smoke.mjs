// Real render checks for the road-contact, cloud and wind graphics upgrades.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://localhost:3000';
const real = process.env.REAL_RENDER === '1';
const browser = await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if (real) await page.addInitScript(() => localStorage.setItem('overtake-graphics-quality', 'balanced'));
 await page.goto(real?base:`${base}/?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 await page.waitForFunction(()=>window.__overtake.detailedScenery.ready,null,{timeout:180000});
 await page.click('#btn-start');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),g=window.__overtake;
  cancelAnimationFrame(g.raf);g.clearTraffic();g.trySpawn=()=>{};g.setCycleRunning(false);g.setTimeOfDay(12);g.setWeatherMode('clear');
  Object.assign(g.weather,{rain:0,snow:0,wet:0,snowCover:0});g.vehicle.s=1500;g.vehicle.speed=0;g.updateDriving(0);
  g.spawnSame(g.playerS+15,0);g.spawnOncoming(g.playerS+29,0);g.updateDriving(0);g.updateCamera(0);g.updateWorld(0);
  const shadow=g.trafficShadows.mesh, live=shadow.count, matrices=Array.from(shadow.instanceMatrix.array.slice(0,live*16));
  const render=()=>{g.composer.render();return g.renderer.domElement.toDataURL()};
  const withShadows=render();shadow.visible=false;const withoutShadows=render();shadow.visible=true;
  const daylight=g.roadSurface.cloud.value;g.roadSurface.cloud.value=0;const noCloud=render();g.roadSurface.cloud.value=daylight;const clouds=render();
  g.roadSurface.time.value+=90;const moved=render();
  const pixels=url=>new Promise(resolve=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);resolve(ctx.getImageData(0,0,c.width,c.height).data)};img.src=url;});
  const [a,b,c,d,e]=await Promise.all([withShadows,withoutShadows,noCloud,clouds,moved].map(pixels));
  const diff=(a,b)=>{let count=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>10)count++;return count;};
  const pixelsShadow=diff(a,b),pixelsCloud=diff(c,d),pixelsMotion=diff(d,e);
  const names=['detailed-broadleaf','detailed-conifer','detailed-fern'];
  const materials=names.map(name=>g.roadGroup.getObjectByName(name)?.material?.customProgramCacheKey()).filter(Boolean);
  g.setSceneryQuality('low');const low=g.roadSurface.cloud.value;g.updateWorld(0);
  g.setSceneryQuality('high');g.setTimeOfDay(0);g.updateWorld(0);const night=g.roadSurface.cloud.value;
  g.setTimeOfDay(12);Object.assign(g.weather,{rain:1,snow:0});g.updateWorld(0);const rain=g.roadSurface.cloud.value;
  // Shadows stay compact and follow the road at different distances and in snow.
  const shapes=['golf','mercedes','audi','mustang','ferrari','r8','challenger','semi','kraz'].map((id,i)=>{
    const meta=g.library.get(id);return {s:g.playerS+20+i*8,offset:i%2?2.1:-2.1,width:meta.width,length:meta.length};
  });
  g.trafficShadows.update(shapes,g.playerS,0);const dryY=Array.from({length:shapes.length},(_,i)=>shadow.instanceMatrix.array[i*16+13]);
  g.trafficShadows.update(shapes,g.playerS,1);const snowY=Array.from({length:shapes.length},(_,i)=>shadow.instanceMatrix.array[i*16+13]);
  const snowLift=snowY.every((y,i)=>y>=dryY[i] && y-dryY[i]<.3);
  g.clearTraffic();const cleared=shadow.count;g.toGarage();const garage=g.roadGroup.visible;
  return {live,matrices,pixelsShadow,pixelsCloud,pixelsMotion,daylight,low,night,rain,cleared,garage,snowLift,wind:materials.some(k=>k.includes('foliage-wind-v1')),image:withShadows};
 });
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/graphics-upgrade-traffic.png',Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
 assert.equal(result.live,2);assert.ok(result.matrices.every(Number.isFinite));
 for(let i=0;i<result.live;i++){const m=result.matrices.slice(i*16,(i+1)*16);const sx=Math.hypot(m[0],m[1],m[2]),sz=Math.hypot(m[8],m[9],m[10]);assert.ok(sx>1 && sx<4 && sz>2 && sz<20,'bounded contact patch');}
 assert.ok(result.pixelsShadow>20,`traffic shadow pixels: ${result.pixelsShadow}`);assert.ok(result.pixelsCloud>100,`cloud shadow pixels: ${result.pixelsCloud}`);
 assert.ok(result.pixelsMotion>100 && result.snowLift);
 assert.ok(result.daylight>.15 && result.low===0 && result.night<.001 && result.rain<result.daylight);
 assert.ok(result.wind && result.cleared===0 && !result.garage);assert.deepEqual(errors,[]);
 console.log({real,...result});
} finally {await browser.close();}
