// Direct event selection, retired-mode fallback, saved history, and race launches.
import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://localhost:4186';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(!sessionStorage.getItem('event-seed')){localStorage.setItem('overtake-mode','ghost');localStorage.removeItem('overtake-circuit-intro-v1');localStorage.setItem('overtake-records-v2',JSON.stringify({modes:{ghost:{bestScore:4567,runs:3},daily:{bestScore:999,runs:2}}}));localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,dev:false,owned:['golf','challenger'],coins:0,credits:0,gems:0,upgrades:{},tunes:{}}));sessionStorage.setItem('event-seed','1')}});
 const ready=async url=>{await page.goto(url,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf))};
 await ready(`${base}/play.html?test=1`);
 assert.equal(await page.evaluate(()=>window.__overtake.getRunMode()),'endless');
 assert.equal(await page.evaluate(()=>localStorage.getItem('overtake-mode')),'endless');
 assert.equal(await page.evaluate(()=>window.__overtake.getRecords().modes.ghost.bestScore),4567);
 await page.click('#open-modes');
 assert.deepEqual(await page.locator('.mode-card').evaluateAll(es=>es.map(e=>e.dataset.track||e.dataset.mode)),['endless','rush','trial','stadium','summit','coast','dockside','neon','ranked']);
 assert.equal(await page.locator('.mode-card:visible').count(),6);await page.click('#mode-next');assert.equal(await page.locator('.mode-card:visible').count(),3);await page.click('#mode-prev');
 await page.click('[data-mode=trial]');assert.equal(await page.locator('#menu-selected-mode').textContent(),'TIME ATTACK');
 // A drift car is eligible for every track.
 await page.click('#menu-garage');await page.click('[data-car=challenger]');await page.click('#garage-back');
 for(const id of ['stadium','summit','coast','dockside','neon']){
   await page.click('#open-modes');
   if(!await page.locator(`[data-track=${id}]`).isVisible()) await page.click(['dockside','neon'].includes(id)?'#mode-next':'#mode-prev');
   await page.click(`[data-track=${id}]`);
   assert.equal(await page.locator('#lobby-drawer').isVisible(),false);
   assert.equal(await page.evaluate(()=>window.__overtake.getCircuitScenario().id),id);
   await page.click('#open-tracks');
   assert.equal(await page.locator(`[data-track=${id}]`).getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('.mode-card[aria-pressed=true]').count(),1);
   await page.click('#drawer-close');await page.click('#menu-start');
   assert.equal(await page.evaluate(()=>window.__overtake.circuitGroup.userData.trackId),id);
   assert.equal(await page.evaluate(()=>window.__overtake.run.mode),'circuit');
   await page.evaluate(()=>window.__overtake.toGarage());
 }
 await ready(`${base}/play.html?test=1&mode=weekly`);
 assert.equal(await page.evaluate(()=>window.__overtake.getRunMode()),'endless');
 assert.equal(await page.evaluate(()=>window.__overtake.getRecords().modes.daily.bestScore),999);
 await ready(`${base}/play.html?test=1&mode=trial`);
 assert.equal(await page.evaluate(()=>window.__overtake.getRunMode()),'trial');
 assert.equal(await page.locator('#menu-selected-mode').textContent(),'TIME ATTACK');
 assert.deepEqual(errors,[]);console.log('Direct circuit selection and launch, paging, Time Attack, retired-mode fallback and legacy records passed.');
}finally{await browser.close()}
