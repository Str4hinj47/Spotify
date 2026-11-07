// Main menu/garage navigation, stats, ranked play and responsive layout.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL||'http://localhost:4181';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 fs.mkdirSync('test-results',{recursive:true});const errors=[];
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(!sessionStorage.getItem('menu-seeded')){
  localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,money:2000,dev:false,owned:['golf'],upgrades:{},tunes:{}}));
  localStorage.setItem('overtake-records-v2',JSON.stringify({version:2,modes:{endless:{bestScore:4500,bestDistance:5600,runs:5,recent:[]}}}));
  localStorage.setItem('overtake-ranked-v1',JSON.stringify({version:1,points:140,attempts:2,scenarios:{}}));sessionStorage.setItem('menu-seeded','yes');
 }});
 await page.goto(`${base}/play.html?test=1&mode=daily`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 assert.ok(await page.locator('#main-menu').isVisible());assert.equal(await page.locator('#garage').isVisible(),false);
 assert.equal(await page.locator('[data-mode=daily]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#menu-best-score').textContent(),'4,500');assert.match(await page.locator('#menu-longest').innerText(),/5\.6/);assert.equal(await page.locator('#menu-runs').textContent(),'7');assert.equal(await page.locator('#menu-rank-name').textContent(),'Street');assert.match(await page.locator('.global-overview').innerText(),/not connected yet/i);
 await page.screenshot({path:'test-results/main-menu-desktop.png',timeout:120000});
 await page.click('#menu-garage');assert.ok(await page.locator('#garage').isVisible());assert.equal(await page.locator('#main-menu').isVisible(),false);assert.equal(await page.locator('[data-mode=daily]').isVisible(),false);await page.screenshot({path:'test-results/separate-garage.png',timeout:120000});
 await page.click('[data-garage-tab=style]');assert.ok(await page.locator('#btn-customize').isVisible());await page.click('#garage-back');assert.ok(await page.locator('#main-menu').isVisible());assert.equal(await page.locator('[data-mode=daily]').getAttribute('aria-pressed'),'true');
 await page.click('[data-mode=ranked]');assert.ok(await page.locator('#menu-ranked').isVisible());await page.click('[data-scenario=needle]');assert.equal(await page.locator('[data-scenario=needle]').getAttribute('aria-pressed'),'true');await page.click('#rank-road-open');assert.equal(await page.locator('.road-rank').count(),7);await page.click('#rank-road-close');
 await page.click('#menu-start');await page.waitForSelector('#hud:not(.hidden)');assert.match(await page.locator('#contract-title').textContent(),/Thread the Needle/);assert.equal(await page.locator('#main-menu').isVisible(),false);
 await page.evaluate(()=>window.__overtake.pause());await page.click('#btn-quit');assert.ok(await page.locator('#main-menu').isVisible());assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-ranked-v1')).points),128);
 await page.click('[data-mode=trial]');await page.click('#menu-start');await page.evaluate(()=>{const g=window.__overtake;g.clearTraffic();g.run.distance=2999;g.vehicle.speed=25;g.speed=25;g.updateDriving(.1)});await page.waitForSelector('#gameover:not(.hidden)');await page.click('#btn-result-menu');assert.ok(await page.locator('#main-menu').isVisible());
 await page.click('#menu-garage');await page.click('[data-car=mustang]');await page.click('#garage-back');assert.equal(await page.locator('#menu-start').isDisabled(),true);assert.match(await page.locator('#menu-car-status').innerText(),/NOT OWNED/);assert.deepEqual(errors,[]);
 await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.goto(`${base}/play.html?test=1&mode=ranked`,{waitUntil:'domcontentloaded',timeout:180000});await mobile.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await mobile.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 assert.ok(await mobile.locator('#main-menu').isVisible());assert.equal(await mobile.locator('[data-mode=ranked]').getAttribute('aria-pressed'),'true');await mobile.screenshot({path:'test-results/main-menu-mobile.png',timeout:120000});
 await mobile.locator('#menu-ranked').scrollIntoViewIfNeeded();await mobile.screenshot({path:'test-results/menu-ranked-mobile.png',timeout:120000});await mobile.click('[data-scenario=gauntlet]');await mobile.click('#menu-start');assert.match(await mobile.locator('#contract-title').textContent(),/Redline/);
 console.log('Main menu navigation passed');
} finally {await browser.close();}
