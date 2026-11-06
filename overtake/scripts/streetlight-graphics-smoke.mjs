// Render the lighting at night, during daytime, in snow and across pole recycling.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL || 'http://localhost:3000', real=process.env.REAL_RENDER==='1';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
 args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
 env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(real) await page.addInitScript(()=>localStorage.setItem('overtake-graphics-quality','balanced'));
 await page.goto(real?base:`${base}/?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 await page.click('#btn-start');
 const r=await page.evaluate(async()=>{
  const g=window.__overtake;cancelAnimationFrame(g.raf);g.clearTraffic();g.trySpawn=()=>{};g.setCycleRunning(false);g.setSceneryQuality('high');g.setWeatherMode('clear');
  Object.assign(g.weather,{rain:0,snow:0,wet:0,snowCover:0});g.vehicle.s=1500;g.vehicle.speed=0;g.setTimeOfDay(0);g.updateDriving(0);g.updateCamera(0);g.updateWorld(0);
  const render=()=>{g.composer.render();return g.renderer.domElement.toDataURL()};
  const night=g.roadSurface.streetlight.value, on=render();g.roadSurface.streetlight.value=0;const off=render();g.roadSurface.streetlight.value=night;
  const parse=url=>new Promise(resolve=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);resolve(ctx.getImageData(0,0,c.width,c.height).data)};img.src=url;});
  const diff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>10)n++;return n};
  const [a,b]=await Promise.all([parse(on),parse(off)]);const changed=diff(a,b);
  Object.assign(g.weather,{snow:1,snowCover:1,wet:0});g.updateRoad();g.updateWorld(0);const snowOn=render();g.roadSurface.streetlight.value=0;const snowOff=render();
  const [c,d]=await Promise.all([parse(snowOn),parse(snowOff)]);const snowy=diff(c,d);
  const slot=g.lamps.find(l=>l.s===1504);const head=slot?.g.localToWorld(new (await import('/node_modules/three/build/three.module.js')).Vector3(-2.47,0,0));
  const before=g.lamps.map(l=>({s:l.s,x:l.g.position.x,z:l.g.position.z,side:l.side}));
  g.playerS+=768;g.updateScenery();const after=g.lamps.map(l=>({s:l.s,x:l.g.position.x,z:l.g.position.z,side:l.side}));
  g.setSceneryQuality('low');const low=g.roadSurface.streetlight.value;g.setSceneryQuality('high');const restored=g.roadSurface.streetlight.value;
  g.setTimeOfDay(12);g.updateWorld(0);const day=g.roadSurface.streetlight.value;
  g.toGarage();return {night,low,restored,day,changed,snowy,before,after,head:head?.toArray(),garage:g.roadGroup.visible,image:on};
 });
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/night-streetlights.png',Buffer.from(r.image.split(',')[1],'base64'));delete r.image;
 assert.ok(r.night>.99 && r.restored>.99 && r.low===0 && r.day===0);assert.ok(r.changed>100,`night pixels: ${r.changed}`);assert.ok(r.snowy>100,`snow pixels: ${r.snowy}`);
 assert.ok(r.before.every((l,i)=>Math.abs((r.after[i].s-l.s)-768)<.01 && r.after[i].side===l.side));
 assert.ok(r.head?.every(Number.isFinite) && !r.garage);assert.deepEqual(errors,[]);console.log({real,...r,before:undefined,after:undefined});
} finally {await browser.close()}
