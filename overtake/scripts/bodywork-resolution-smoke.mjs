import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAR_CONTENT } from '../src/content/cars.mjs';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
 fs.mkdirSync('test-results',{recursive:true});const page=await browser.newPage({viewport:{width:1200,height:800}});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(`${process.env.BASE_URL||'http://localhost:4181'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const results=await page.evaluate(async ids=>{
  const g=window.__overtake,{createBodyKit,disposeBodyKit}=await import('/src/body-kits.ts'),{sanitizeCustomization}=await import('/src/customization.mjs');cancelAnimationFrame(g.raf);
  const out=[];
  for(const id of ids)for(const variant of ['street','touring','sport','track']) {
   const config=sanitizeCustomization(Object.fromEntries(['front','rear','skirts','spoiler','exhaust','hood','roof'].map(k=>[k,variant])));
   const kit=createBodyKit(id,config,0x404750);let triangles=0, nonfinite=0;const parts={},names=[];
   kit.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.getAttribute('position'),norm=o.geometry.getAttribute('normal');const tris=o.geometry.index?o.geometry.index.count/3:a.count/3;triangles+=tris;if(o.name)names.push(o.name);parts[o.name]=(parts[o.name]||0)+tris;
    for(const attr of [a,norm])if(attr)for(const v of attr.array)if(!Number.isFinite(v))nonfinite++;
   });
   const traffic=g.library.create(id),result={id,variant,triangles,nonfinite,parts,names,trafficKit:!!traffic.getObjectByName('custom-body-kit')};out.push(result);disposeBodyKit(kit);
  }
  return out;
 },CAR_CONTENT.map(c=>c.id));
 for(const r of results){assert.equal(r.nonfinite,0,`${r.id}/${r.variant} finite geometry`);assert.ok(r.triangles>5000 && r.triangles<100000,`${r.id}/${r.variant} triangles ${r.triangles}`);assert.ok(r.parts['front-fascia']>1000,`${r.id} front`);assert.ok(r.parts['side-skirt']>3000,`${r.id} skirts`);assert.equal(r.trafficKit,false);assert.ok(r.names.includes('custom-body-kit')===false);}
 await page.click('#menu-garage');
 for(const id of ['golf','mustang','bugatti','aventador-game']) {
  await page.evaluate(id=>{const g=window.__overtake;g.library.setCustomization(id,{front:'track',rear:'track',skirts:'track',spoiler:'track',exhaust:'track',hood:'track',roof:'track'});g.setSelectedCar(id);g.garageAuto=false;g.garageZoom=5.8;g.garagePitch=.20;g.garageAngle=Math.PI*.75;g.updateCamera(0);g.composer.render()},id);
  await page.screenshot({path:`test-results/body-polish-${id}-front.png`,timeout:120000});
  await page.evaluate(()=>{const g=window.__overtake;g.garageAngle=.25;g.updateCamera(0);g.composer.render()});await page.screenshot({path:`test-results/body-polish-${id}-rear.png`,timeout:120000});
 }
 await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.setDefaultTimeout(120000);mobile.on('pageerror',e=>errors.push(String(e)));mobile.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await mobile.addInitScript(()=>{if(!sessionStorage.getItem('body-seeded')){localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:100000,credits:100000,gems:10000,dev:false,owned:['golf'],upgrades:{},tunes:{}}));sessionStorage.setItem('body-seeded','yes')}});
 await mobile.goto(`${process.env.BASE_URL||'http://localhost:4181'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await mobile.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await mobile.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await mobile.click('#menu-garage');await mobile.click('[data-garage-tab=style]');await mobile.click('#btn-customize');
 for(const part of ['front','skirts','hood','roof']) {await mobile.click(`[data-workshop-part="${part}"]`);await mobile.selectOption(`#custom-${part}`,'track',{force:true});}
 await mobile.evaluate(()=>window.__overtake.composer.render());assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await mobile.reload({waitUntil:'domcontentloaded',timeout:180000});await mobile.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await mobile.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await mobile.click('#menu-garage');await mobile.click('[data-garage-tab=style]');await mobile.click('#btn-customize');
 for(const part of ['front','skirts','hood','roof'])assert.equal(await mobile.locator(`#custom-${part}`).inputValue(),'track');await mobile.close();
 assert.deepEqual(errors,[]);console.log('Body kits validated:',results.length,'configurations, triangle range',Math.min(...results.map(r=>r.triangles)),Math.max(...results.map(r=>r.triangles)));
}finally{await browser.close()}
