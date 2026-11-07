// Local ranked navigation, objectives, promotion, penalties, dev bypass and mobile.
import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL||'http://localhost:4180';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 fs.mkdirSync('test-results',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(!sessionStorage.getItem('rank-seeded')){localStorage.setItem('overtake-ranked-v1',JSON.stringify({version:1,points:110,attempts:2,scenarios:{}}));sessionStorage.setItem('rank-seeded','yes');}});
 await page.goto(`${base}/play.html?test=1&mode=ranked`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 assert.equal(await page.locator('[data-garage-tab=ranked]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#rank-name').textContent(),'Rookie');
 assert.equal(await page.locator('.rank-scenario').count(),3);assert.equal(await page.locator('#start-label').innerText(),'Start ranked attack');
 await page.screenshot({path:'test-results/ranked-garage.png',timeout:120000});
 await page.click('#rank-road-open');assert.ok(await page.locator('#rank-road').isVisible());assert.equal(await page.locator('.road-rank').count(),7);await page.screenshot({path:'test-results/rank-road.png',timeout:120000});await page.keyboard.press('Escape');assert.equal(await page.locator('#rank-road').isVisible(),false);
 await page.click('[data-scenario=needle]');assert.equal(await page.locator('[data-scenario=needle]').getAttribute('aria-pressed'),'true');await page.click('[data-scenario=slipstream]');
 await page.click('#btn-start');assert.match(await page.locator('#contract-title').textContent(),/Slipstream/);assert.match(await page.locator('#contract-count').textContent(),/0 \/ 4/);
 await page.evaluate(()=>{const g=window.__overtake;g.clearTraffic();g.run.distance=1999;g.run.elapsed=45;g.run.timeLeft=15;g.run.overtakes=4;g.vehicle.speed=25;g.speed=25;g.updateDriving(.1);});
 await page.waitForSelector('#gameover:not(.hidden)',{timeout:10000});assert.match(await page.locator('#final-rank-change').innerText(),/\+40 RP/);assert.match(await page.locator('#final-rank-message').innerText(),/PROMOTED TO STREET/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-ranked-v1')).points),150);
 await page.screenshot({path:'test-results/ranked-result.png',timeout:120000});
 await page.click('#btn-garage');assert.equal(await page.locator('#rank-name').textContent(),'Street');await page.click('#btn-start');await page.evaluate(()=>window.__overtake.pause());assert.match(await page.locator('#quit-label').textContent(),/−12 RP/);await page.click('#btn-quit');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-ranked-v1')).points),138);
 await page.click('#btn-start');await page.evaluate(()=>{const g=window.__overtake;g.clearTraffic();g.run.distance=1999;g.run.elapsed=45;g.run.timeLeft=15;g.run.overtakes=0;g.vehicle.speed=25;g.speed=25;g.updateDriving(.1);});
 await page.waitForSelector('#gameover:not(.hidden)',{timeout:10000});assert.match(await page.locator('#final-title').textContent(),/Objective missed/);assert.match(await page.locator('#final-rank-change').textContent(),/-12 RP/);
 await page.click('#btn-garage');await page.click('#btn-start');
 await page.evaluate(()=>{const g=window.__overtake;g.clearTraffic();g.run.timeLeft=.01;g.vehicle.speed=0;g.speed=0;g.updateDriving(.1);});
 await page.waitForSelector('#gameover:not(.hidden)',{timeout:10000});assert.match(await page.locator('#final-title').textContent(),/Time up/);assert.match(await page.locator('#final-rank-change').textContent(),/-12 RP/);assert.match(await page.locator('#final-rank-message').textContent(),/Rank changed to Rookie/);
 await page.click('#btn-garage');await page.click('#btn-start');await page.evaluate(()=>window.__overtake.crash('test crash'));await page.waitForSelector('#gameover:not(.hidden)',{timeout:10000});assert.match(await page.locator('#final-title').textContent(),/Wrecked/);assert.match(await page.locator('#final-rank-change').textContent(),/-12 RP/);
 await page.click('#btn-garage');await page.click('#dev-toggle');const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-ranked-v1')).points);await page.click('#btn-start');await page.evaluate(()=>{const g=window.__overtake;g.clearTraffic();g.run.distance=1999;g.run.elapsed=45;g.run.timeLeft=15;g.run.overtakes=4;g.vehicle.speed=25;g.speed=25;g.updateDriving(.1);});await page.waitForSelector('#gameover:not(.hidden)',{timeout:10000});assert.match(await page.locator('#final-rank-change').textContent(),/DEV PREVIEW/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-ranked-v1')).points),before);assert.deepEqual(errors,[]);await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.goto(`${base}/play.html?test=1&mode=ranked`,{waitUntil:'domcontentloaded',timeout:180000});await mobile.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await mobile.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 await mobile.screenshot({path:'test-results/ranked-mobile.png',timeout:120000});await mobile.click('#rank-road-open');await mobile.screenshot({path:'test-results/rank-road-mobile.png',timeout:120000});assert.equal(await mobile.locator('.road-rank').count(),7);await mobile.click('#rank-road-close');await mobile.click('[data-scenario=gauntlet]');assert.equal(await mobile.locator('[data-scenario=gauntlet]').getAttribute('aria-pressed'),'true');await mobile.click('#btn-start');assert.match(await mobile.locator('#contract-title').textContent(),/Redline/);
 console.log('Ranked browser flows passed');
} finally {await browser.close();}
