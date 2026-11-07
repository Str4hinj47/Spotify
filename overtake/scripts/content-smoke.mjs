// Buy a data-driven livery variant, switch away/back, and reload its save.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL||'http://localhost:4181';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}), errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(!sessionStorage.getItem('content-seeded')){localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,money:1000,dev:false,owned:['golf'],upgrades:{},tunes:{}}));sessionStorage.setItem('content-seeded','1');}});
 const open=async()=>{await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await page.click('#menu-garage');assert.equal(await page.locator('#car-count').textContent(),'7 cars');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-workshop-tab=paint]');};
 await page.goto(`${base}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await open();
 const option=page.locator('[data-workshop-panel=paint] .workshop-choices button[data-value="sunset-stripe"]');assert.match(await option.innerText(),/Sunset stripe.*\$500/);await option.click();
 assert.equal(await page.locator('#custom-livery').inputValue(),'sunset-stripe');assert.equal(await page.locator('#custom-livery-color').inputValue(),'#ff7a1a');
 assert.equal(await page.evaluate(()=>window.__overtake.getProgression().money),500);assert.ok(await page.evaluate(()=>window.__overtake.getProgression().tunes.golf.includes('livery:sunset-stripe')));
 await page.click('[data-workshop-panel=paint] .workshop-choices button[data-value="none"]');await option.click();assert.equal(await page.evaluate(()=>window.__overtake.getProgression().money),500);
 await page.evaluate(()=>window.__overtake.composer.render());fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/content-workshop.png',timeout:120000});
 await page.reload({waitUntil:'domcontentloaded',timeout:180000});await open();assert.equal(await page.locator('#custom-livery').inputValue(),'sunset-stripe');assert.equal(await page.locator('#custom-livery-color').inputValue(),'#ff7a1a');assert.match(await option.innerText(),/Owned/);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-workshop-tab=paint]').click();await option.scrollIntoViewIfNeeded();assert.ok(await option.isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('Data-driven livery purchase, reuse and reload passed.');
} finally {await browser.close();}
