import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1100,height:750}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(120000);
 await page.addInitScript(()=>{if(!sessionStorage.getItem('wide-seed')){localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:50000,credits:0,gems:200,dev:false,owned:['golf','challenger'],upgrades:{},tunes:{}}));sessionStorage.setItem('wide-seed','1')}});
 await page.goto(`${process.env.BASE_URL||'http://localhost:4191'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const data=await page.evaluate(async()=>{
  const g=window.__overtake,T=await import('/node_modules/three/build/three.module.js');cancelAnimationFrame(g.raf);
  const make=c=>{g.library.setCustomization('golf',c);const o=g.library.create('golf',{player:true});o.updateMatrixWorld(true);return o};
  const custom=make({skirts:'golf-superwide',rear:'golf-diffuser',rearDiffuserColor:'#dd2244',skirtsColor:'#2366bb',rearColor:'#e7a500'}),stock=make({}),carbon=make({skirts:'golf-superwide',skirtsFinish:'carbon'}),traffic=g.library.create('golf',{player:false});
  const list=(c,name)=>{let a=[];c.traverse(o=>{if(o.name===name)a.push(o)});return a},arch=list(custom,'wheel-arch-flare'),bolts=list(custom,'golf-flare-rivet'),fins=list(custom,'diffuser-fin'),tray=custom.getObjectByName('golf-diffuser-tray');
  const bounds=o=>{const b=new T.Box3().setFromObject(o);return {min:b.min.toArray(),max:b.max.toArray()}};
  return {arches:arch.map(bounds),bolts:bolts.length,archColor:arch[0].material.color.getHexString(),boltColor:bolts[0].material.color.getHexString(),fins:fins.map(bounds),finColor:fins[0].material.color.getHexString(),tray:bounds(tray),stockFlares:list(stock,'wheel-arch-flare').length,trafficFlares:list(traffic,'wheel-arch-flare').length,stockTray:!!stock.getObjectByName('golf-diffuser-tray'),carbonName:list(carbon,'wheel-arch-flare')[0].material.name,wheels:custom.userData.wheels.length};
 });
 assert.equal(data.arches.length,4);assert.equal(data.bolts,28);assert.equal(data.archColor,'2366bb');assert.notEqual(data.boltColor,'2366bb');assert.equal(data.fins.length,7);assert.equal(data.finColor,'dd2244');assert.equal(data.stockFlares,0);assert.equal(data.trafficFlares,0);assert.equal(data.stockTray,false);assert.equal(data.wheels,4);assert.notEqual(data.carbonName,'custom-skirts-color');
 for(const a of data.arches){assert.ok(a.max[0]-a.min[0]<.18);assert.ok(a.max[1]<.80);}
 assert.ok(data.fins.every(f=>f.min[1]>.15&&f.max[1]>=data.tray.min[1]-.003&&f.max[2]<=data.tray.max[2]+.01));
 await page.click('#menu-garage');await page.click('[data-car=challenger]');assert.equal(await page.locator('#start-label').textContent(),'Select');await page.click('#btn-start');assert.ok(await page.locator('#main-menu').isVisible());assert.equal(await page.evaluate(()=>window.__overtake.mode),'garage');assert.match(await page.locator('#menu-car-name').textContent(),/brawler/i);assert.equal(await page.evaluate(()=>localStorage.getItem('overtake-car')),'challenger');
 await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});assert.match(await page.locator('#menu-car-name').textContent(),/brawler/i);
 await page.click('#menu-garage');await page.click('[data-car=skyline]');assert.ok(await page.locator('#btn-start').isDisabled());await page.click('[data-car=golf]');await page.click('#btn-start');assert.equal(await page.evaluate(()=>window.__overtake.mode),'garage');await page.click('#menu-start');assert.equal(await page.evaluate(()=>window.__overtake.mode),'driving');
 assert.deepEqual(errors,[]);console.log('Golf flare, rivet, diffuser finish and select-to-menu flow passed.');
}finally{await browser.close()}
