import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL||'http://localhost:4181';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 fs.mkdirSync('test-results',{recursive:true}); const errors=[];
 const page=await browser.newPage({viewport:{width:1440,height:900}}); page.on('pageerror', e=>errors.push(String(e)));
 await page.addInitScript(()=>{ localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,money:50000,dev:false,owned:['golf','bmw-m3','skyline','aventador','aventador-game'],upgrades:{},tunes:{}})); });
 await page.goto(`${base}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000}); await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000}); await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 for(const mode of ['seasonal','convoy','ghost']) assert.equal(await page.locator(`[data-mode=${mode}]`).count(),1);
 await page.click('[data-mode=ghost]'); assert.match(await page.locator('#ghost-menu-note').innerText(),/No ghost/);
 await page.click('#menu-start'); assert.match(await page.locator('#ghost-hud').innerText(),/FIRST RUN/);
 await page.evaluate(()=>{const g=window.__overtake;g.clearTraffic();g.run.distance=2999;g.vehicle.speed=25;g.speed=25;g.updateDriving(.1)});
 await page.waitForSelector('#gameover:not(.hidden)'); assert.ok(await page.evaluate(()=>localStorage.getItem('overtake-ghost-v1-golf')));
 await page.click('#btn-result-menu'); assert.match(await page.locator('#ghost-menu-note').innerText(),/Your local/); await page.click('#menu-start');
 assert.match(await page.locator('#ghost-hud').innerText(),/LOCAL GHOST/); assert.ok(await page.evaluate(()=>!!window.__overtake.ghostModel));
 await page.evaluate(()=>window.__overtake.pause()); await page.click('#btn-quit');
 await page.click('[data-mode=convoy]'); await page.click('#menu-start');
 assert.equal(await page.evaluate(()=>window.__overtake.traffic.filter(t=>t.dir===1).length),7);
 await page.evaluate(()=>window.__overtake.pause()); await page.click('#btn-quit');
 await page.click('#menu-garage'); assert.equal(await page.locator('[data-car=camry]').count(),0);
 for(const id of ['bmw-m3','skyline','aventador','aventador-game']) {
   await page.click(`[data-car="${id}"]`); await page.click('[data-garage-tab=style]'); await page.click('#btn-customize');
   assert.ok(await page.locator('[data-workshop-tab=body]').isEnabled()); await page.click('[data-workshop-tab=body]'); await page.click('[data-workshop-part=front]'); await page.click('[data-part-panel=front] button[data-value=street]');
   const state=await page.evaluate(()=>{const g=window.__overtake;g.composer.render();return {wheels:g.player.userData.wheels.length,kit:!!g.player.getObjectByName('custom-body-kit')}});
   console.log(id,state); assert.equal(state.kit,true); assert.equal(state.wheels,4);
   await page.screenshot({path:`test-results/${id}.png`,timeout:120000}); await page.click('#custom-close');
 }
 console.log('camry wheels',await page.evaluate(()=>{let n=0;window.__overtake.library.get('camry').scene.traverse(o=>{if(o.name.startsWith('wheel_pivot_'))n++});return n}));
 assert.deepEqual(errors,[]); console.log('New cars and modes browser smoke passed.');
} finally {await browser.close();}
