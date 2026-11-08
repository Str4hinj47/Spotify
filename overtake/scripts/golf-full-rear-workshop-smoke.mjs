import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { seedEconomy } from './seed-economy.mjs';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 for(const [name,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]) {
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await seedEconomy(page);
  const boot=async()=>{await page.goto(`${process.env.BASE_URL||'http://localhost:4185'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await page.click('#menu-garage');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-workshop-part=rear]');};
  await boot();await page.click('[data-part-panel=rear] [aria-label="Next rear options"]');
  for(const value of ['golf-r32','golf-clean']) {
   const card=page.locator(`[data-part-panel=rear] button[data-value="${value}"]`);assert.equal(await card.count(),1);
   const image=card.locator('img');await image.waitFor();assert.ok((await image.getAttribute('src')).length>1000);
  }
  const balance=async()=>page.evaluate(()=>window.__overtake.getProgression().gems);
  const start=await balance();await page.click('[data-part-panel=rear] button[data-value="golf-r32"]');assert.equal(await balance(),start-30);assert.equal(await page.locator('#custom-rear').inputValue(),'golf-r32');
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await page.click('#menu-garage');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-workshop-part=rear]');assert.equal(await page.locator('#custom-rear').inputValue(),'golf-r32');
  // Pager selection is not persisted, but the selected tune is.
  if(await page.locator('[data-part-panel=rear] button[data-value="golf-clean"]').count()===0)await page.click('[data-part-panel=rear] [aria-label="Next rear options"]');
  await page.click('[data-part-panel=rear] button[data-value="golf-clean"]');assert.equal(await balance(),start-56);
  await page.click('[data-part-panel=rear] button[data-value="golf-r32"]');assert.equal(await balance(),start-56);assert.equal(await page.locator('#custom-rear').inputValue(),'golf-r32');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log(`${name}: rear cards, previews, purchases, ownership and reload passed`);await page.close();
 }
} finally {await browser.close()}
