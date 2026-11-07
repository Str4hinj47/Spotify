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
 await page.goto(real?`${base}/play.html`:`${base}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
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
  const lights=g.streetLights.map(l=>({visible:l.visible,intensity:l.intensity,shadow:l.castShadow,position:l.position.toArray()}));
  g.streetLights.forEach(l=>l.visible=false);const unlitCars=render();g.streetLights.forEach(l=>l.visible=true);
  const lightPixels=diff(a,await parse(unlitCars));
  const T=await import('/node_modules/three/build/three.module.js');
  const expected=g.streetLights.map((_,i)=>{const s=Math.floor(g.playerS/32)*32+i*32;const lamp=g.lamps.find(l=>l.s===s);return lamp.g.localToWorld(new T.Vector3(-2.47,8.015,0)).toArray()});
  Object.assign(g.weather,{rain:1,wet:1,snow:0,snowCover:0});g.updateRoad();g.updateWorld(0);const wetOn=render();g.roadSurface.streetlight.value=0;const wetOff=render();
  const [wa,wb]=await Promise.all([parse(wetOn),parse(wetOff)]);const wetPixels=diff(wa,wb);
  Object.assign(g.weather,{rain:0,snow:1,snowCover:1,wet:0});g.updateRoad();g.updateWorld(0);const snowOn=render();g.roadSurface.streetlight.value=0;const snowOff=render();
  const [c,d]=await Promise.all([parse(snowOn),parse(snowOff)]);const snowy=diff(c,d);
  const slot=g.lamps.find(l=>l.s===1504);const head=slot?.g.localToWorld(new (await import('/node_modules/three/build/three.module.js')).Vector3(-2.47,0,0));
  const before=g.lamps.map(l=>({s:l.s,x:l.g.position.x,z:l.g.position.z,side:l.side}));
  g.playerS+=768;g.updateScenery();const after=g.lamps.map(l=>({s:l.s,x:l.g.position.x,z:l.g.position.z,side:l.side}));
  g.setSceneryQuality('low');const low=g.roadSurface.streetlight.value, lowLights=g.streetLights.every(l=>!l.visible);g.setSceneryQuality('high');const restored=g.roadSurface.streetlight.value;
  g.pause();g.setTimeOfDay(12);const day=g.roadSurface.streetlight.value, dayLamp=g.lampMat.emissiveIntensity;
  g.setTimeOfDay(0);const pausedNight=g.roadSurface.streetlight.value, nightLamp=g.lampMat.emissiveIntensity;
  g.toGarage();return {night,low,lowLights,restored,day,dayLamp,pausedNight,nightLamp,changed,snowy,wetPixels,lights,expected,lightPixels,before,after,head:head?.toArray(),garage:g.roadGroup.visible,image:on,wetImage:wetOn};
 });
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/night-streetlights.png',Buffer.from(r.image.split(',')[1],'base64'));delete r.image;fs.writeFileSync('test-results/night-streetlights-wet.png',Buffer.from(r.wetImage.split(',')[1],'base64'));delete r.wetImage;
 assert.ok(r.night>.99 && r.restored>.99 && r.low===0 && r.lowLights && r.day===0 && r.pausedNight>.99 && r.nightLamp>r.dayLamp);
 assert.ok(r.lightPixels>40 && r.lights.every((l,i)=>l.visible && l.intensity>0 && !l.shadow && l.position.every((p,j)=>Math.abs(p-r.expected[i][j])<.01)), `nearby lights: ${JSON.stringify(r.lights)}`);assert.ok(r.changed>100,`night pixels: ${r.changed}`);assert.ok(r.snowy>100,`snow pixels: ${r.snowy}`);assert.ok(r.wetPixels>100,`wet pixels: ${r.wetPixels}`);
 assert.ok(r.before.every((l,i)=>Math.abs((r.after[i].s-l.s)-768)<.01 && r.after[i].side===l.side));
 assert.ok(r.head?.every(Number.isFinite) && !r.garage);assert.deepEqual(errors,[]);console.log({real,...r,before:undefined,after:undefined});
} finally {await browser.close()}
