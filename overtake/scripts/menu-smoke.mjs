// Main menu stats, ranked navigation, and return from a race.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{
  localStorage.setItem('overtake-records-v2',JSON.stringify({version:2,modes:{endless:{bestScore:4500,bestDistance:5600,runs:5,recent:[]}}}));
  localStorage.setItem('overtake-ranked-v1',JSON.stringify({version:1,points:140,attempts:2,scenarios:{}}));
 });
 await page.goto(`${process.env.BASE_URL||'http://localhost:4185'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 await page.click('#open-stats');assert.equal(await page.locator('#menu-best-score').textContent(),'4,500');assert.match(await page.locator('#menu-longest').innerText(),/5\.6/);assert.equal(await page.locator('#menu-rank-name').textContent(),'Street');
 await page.click('#menu-rank-select');assert.ok(await page.locator('#menu-ranked').isVisible());await page.click('[data-scenario=coast]');assert.equal(await page.locator('[data-scenario=coast]').getAttribute('aria-pressed'),'true');
 await page.click('#rank-road-open');assert.equal(await page.locator('.road-rank').count(),7);await page.click('#rank-road-close');await page.click('#drawer-close');await page.click('#menu-start');await page.waitForSelector('#hud:not(.hidden)');
 assert.equal(await page.evaluate(()=>window.__overtake.circuitGroup.userData.trackId),'coast');await page.evaluate(()=>window.__overtake.pause());await page.click('#btn-quit');assert.ok(await page.locator('#main-menu').isVisible());assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-ranked-v1')).points),128);
 assert.deepEqual(errors,[]);console.log('Main menu stats and ranked navigation passed');
}finally{await browser.close()}
