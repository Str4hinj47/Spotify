// Purchase/drive the Chiron and verify the other two models spawn as traffic.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1100,height:750}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(!sessionStorage.getItem('chiron-seed')){localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:50000,credits:60000,gems:100,dev:false,owned:['golf','challenger','skyline','mustang','bmw-m3','audi','mercedes','r8','ferrari','aventador'],upgrades:{},tunes:{}}));sessionStorage.setItem('chiron-seed','1');}});
 const open=async()=>{await page.goto(`${process.env.BASE_URL||'http://localhost:4181'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));};
 await open();await page.click('#menu-garage');
 for(const id of ['camry','mercedes-560','range-rover']) assert.equal(await page.locator(`[data-car="${id}"]`).count(),0);
 await page.click('[data-car=bugatti]');assert.match(await page.locator('#d-class').innerText(),/LEGENDARY · TIER 11/);assert.equal(await page.locator('#buy-car').isEnabled(),true);
 await page.click('#buy-car');assert.equal((await page.evaluate(()=>window.__overtake.getProgression())).credits,5000);
 await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-workshop-tab=body]');await page.click('[data-workshop-part=front]');await page.click('[data-part-panel=front] button[data-value=street]');
 const kit=await page.evaluate(()=>{const g=window.__overtake;g.composer.render();return {kit:!!g.player.getObjectByName('front-fascia'),wheels:g.player.userData.wheels.length}});assert.deepEqual(kit,{kit:true,wheels:4});
 const wings=await page.evaluate(()=>{const g=window.__overtake;const survey=car=>{let out=[];car.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&o.material.name.includes('__factory_wing'))out.push(o.visible)});return out};g.library.setCustomization('bugatti',{spoiler:'track'});const tuned=survey(g.library.create('bugatti',{player:true})),traffic=survey(g.library.create('bugatti'));g.library.setCustomization('bugatti',{spoiler:'stock',front:'street'});return {tuned,traffic};});assert.ok(wings.tuned.length&&wings.tuned.every(v=>!v));assert.ok(wings.traffic.length&&wings.traffic.every(Boolean));await page.click('#custom-done');
 await page.click('#btn-start');assert.equal(await page.evaluate(()=>window.__overtake.mode),'driving');
 const traffic=await page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);g.clearTraffic();g.score=0;for(let i=0;i<16;i++)g.spawnSame(150,20);let same=g.traffic.map(t=>t.id);g.clearTraffic();for(let i=0;i<16;i++)g.spawnOncoming(150,20);let opposite=g.traffic.map(t=>t.id);let wheels={};for(const id of ['mercedes-560','range-rover']){const c=g.library.create(id);wheels[id]=c.userData.wheels.map(w=>w.children.length)}g.clearTraffic();return {same,opposite,wheels}});
 for(const lane of ['same','opposite'])for(const id of ['mercedes-560','range-rover','camry'])assert.ok(traffic[lane].includes(id),`${id} missing from ${lane} lane`);
 for(const wheels of Object.values(traffic.wheels))assert.ok(wheels.length===4&&wheels.every(n=>n>=2),'traffic wheels and rims must rotate');
 await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});assert.ok(await page.evaluate(()=>window.__overtake.canDrive('bugatti')));assert.deepEqual(errors,[]);
 console.log('Chiron purchase, driving, customization, save and traffic-only spawns passed.');
}finally{await browser.close()}
