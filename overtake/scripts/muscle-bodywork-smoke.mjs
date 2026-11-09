import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';

const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(120000);
 await page.addInitScript(()=>{if(!sessionStorage.getItem('muscle-seed')){localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:50000,credits:50000,gems:300,dev:false,owned:['golf','challenger','skyline','mustang','bmw-m3'],upgrades:{},tunes:{}}));sessionStorage.setItem('muscle-seed','1')}});
 await page.goto(`${process.env.BASE_URL||'http://localhost:4190'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const results=await page.evaluate(async()=>{
  const g=window.__overtake,T=await import('/node_modules/three/build/three.module.js');cancelAnimationFrame(g.raf);
  const defs={mustang:{front:'mustang-heritage',rear:'mustang-valance',skirts:'mustang-rockers'},challenger:{front:'challenger-aero',rear:'challenger-diffuser',skirts:'challenger-wide'}};
  const out={};
  for(const [id,parts] of Object.entries(defs)){
   const make=config=>{g.library.setCustomization(id,config);const c=g.library.create(id,{player:true});c.updateMatrixWorld(true);return c};
   const stock=make({}),unique=make(parts),sport=make({front:'sport',rear:'sport'}),mixed=make({front:parts.front,frontFinish:'carbon',rear:'stock',skirts:'stock'}),traffic=g.library.create(id,{player:false});
   const names=c=>{const all=[];c.traverse(o=>all.push(o.name));return all};
   const count=(c,name)=>names(c).filter(n=>n===name).length;
   const extent=(c,name)=>{const mesh=c.getObjectByName(name);return new T.Box3().setFromObject(mesh).getSize(new T.Vector3()).toArray()};
   const source=id==='mustang'?'mustang_mesh_7':'Plane005_Plane037';
   const features=id==='mustang'?['mustang-front-valance-signals','mustang_mesh_9']:['Plane010_Plane056'];
   const fitted={};for(const part of Object.keys(parts))fitted[part]=count(unique,`${id}-fitted-${part}`);
   out[id]={fitted,stockFitted:count(stock,`${id}-fitted-front`),trafficFitted:count(traffic,`${id}-fitted-front`),mixedRear:count(mixed,`${id}-fitted-rear`),mixedSkirts:count(mixed,`${id}-fitted-skirts`),wheels:[stock.userData.wheels.length,unique.userData.wheels.length],features:features.map(n=>[!!stock.getObjectByName(n),!!unique.getObjectByName(n)]),sourceShared:stock.getObjectByName(source).geometry===unique.getObjectByName(source).geometry,frontSizes:[extent(unique,`${id}-front-lip`),extent(sport,`${id}-front-lip`)],rearSizes:[extent(unique,`${id}-rear-diffuser`),extent(sport,`${id}-rear-diffuser`)],blades:count(unique,`${id}-rocker-blade`),arches:count(unique,'challenger-wheel-arch-flare'),carbon:!!mixed.getObjectByName(`${id}-fitted-front`)?.material};
  }return out;
 });
 for(const [id,r] of Object.entries(results)){
  for(const part of ['front','rear','skirts'])assert.ok(r.fitted[part]>0,`${id} fitted ${part}`);
  assert.equal(r.stockFitted,0);assert.equal(r.trafficFitted,0);assert.equal(r.mixedRear,0);assert.equal(r.mixedSkirts,0);
  assert.deepEqual(r.wheels,[4,4]);for(const f of r.features)assert.deepEqual(f,[true,true]);assert.equal(r.sourceShared,false);
  assert.ok(r.frontSizes[0][1]>r.frontSizes[1][1]);assert.ok(r.rearSizes[0][2]>r.rearSizes[1][2]);assert.equal(r.blades,2);assert.equal(r.arches,id==='challenger'?4:0);assert.ok(r.carbon);
 }
 await page.click('#menu-garage');await page.click('.car-card[data-car="mustang"]');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
 const buyParts=async(parts)=>{for(const [part,value] of parts){await page.click(`[data-workshop-part=${part}]`);const card=page.locator(`.workshop-card[data-value=${value}]`);if(!await card.count())await page.getByRole('button',{name:`Next ${part} options`}).click();assert.ok(await card.locator('img').getAttribute('src'));await card.click();assert.equal(await page.locator(`#custom-${part}`).inputValue(),value);}};
 const mustang=[['front','mustang-heritage'],['rear','mustang-valance'],['skirts','mustang-rockers']],challenger=[['front','challenger-aero'],['rear','challenger-diffuser'],['skirts','challenger-wide']];
 await buyParts(mustang);
 await page.click('#custom-close');await page.click('.car-card[data-car="challenger"]');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await buyParts(challenger);
 let save=await page.evaluate(()=>({custom:JSON.parse(localStorage.getItem('overtake-customization-v1')),p:JSON.parse(localStorage.getItem('overtake-progression-v2'))}));
 for(const [id,parts] of [['mustang',mustang],['challenger',challenger]])for(const [part,value] of parts){assert.equal(save.custom[id][part],value);assert.ok(save.p.tunes[id].includes(`${part}:${value}`));}assert.equal(save.p.gems,133);
 await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.click('#menu-garage');
 for(const [id,parts] of [['mustang',mustang],['challenger',challenger]]){await page.click(`.car-card[data-car="${id}"]`);await page.click('[data-garage-tab=style]');await page.click('#btn-customize');for(const [part,value] of parts){await page.click(`[data-workshop-part=${part}]`);assert.equal(await page.locator(`#custom-${part}`).inputValue(),value);}await page.click('#custom-close');}
 assert.deepEqual(errors,[]);console.log('Muscle bodywork isolation, geometry, previews and purchase persistence passed:',results);
} finally {await browser.close()}
