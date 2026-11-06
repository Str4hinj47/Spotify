// Real rendering path, not ?test=1: verify draw-buffer scaling and textures.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://localhost:3000/',{timeout:180000,waitUntil:'domcontentloaded'});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  const inspect=()=>page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);const r=g.renderer,c=g.composer;
    const car=g.library.create('mercedes');const textures=[];car.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map){const t=m.map;textures.push({name:t.name,width:t.image.width,height:t.image.height,aniso:t.anisotropy});}});
    return {ratio:r.getPixelRatio(),canvas:[r.domElement.width,r.domElement.height],buffer:[c.inputBuffer.width,c.inputBuffer.height],maxAniso:r.capabilities.getMaxAnisotropy(),textures};});
  const initial=await inspect();assert.equal(initial.ratio,1.25);assert.deepEqual(initial.canvas,[1200,800]);assert.deepEqual(initial.buffer,initial.canvas);
  const atlas=initial.textures.find(x=>x.width===4096&&x.height===4096);assert.ok(atlas);assert.equal(atlas.aniso,Math.min(8,initial.maxAniso));
  await page.setViewportSize({width:800,height:600});await page.waitForFunction(()=>window.__overtake.renderer.domElement.width===1000,{timeout:30000});const resized=await inspect();assert.deepEqual(resized.canvas,[1000,750]);assert.deepEqual(resized.buffer,resized.canvas);
  await page.addStyleTag({content:'#garage,#topbar{visibility:hidden!important}'});
  await page.evaluate(()=>{const g=window.__overtake;g.setSelectedCar('mercedes');g.garageAngle=0;g.garagePitch=.15;g.garageZoom=5.7;g.updateCamera(0);g.composer.render();});
  await page.screenshot({path:'test-results/mercedes-resolution.png',timeout:120000});
  assert.deepEqual(errors,[]);console.log({initial,resized,errors});
} finally {await browser.close();}
