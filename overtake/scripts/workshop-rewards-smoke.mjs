// Workshop paging and local economy settlement, including Dev runs.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 for(const [name,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]) {
  const page=await browser.newPage({viewport}), errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:0,credits:0,gems:0,dev:false,owned:['golf'],upgrades:{},tunes:{}})));
  await page.goto(`${process.env.BASE_URL||'http://localhost:4183'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
  const settlement=await page.evaluate(()=>{
   const g=window.__overtake, results=[];
   for(const dev of [false,true]) {
    g.setDeveloperMode(dev);if(!g.start())throw Error('run failed to start');
    g.run.score=1000;g.run.distance=1000;g.toGarage();const first=g.getProgression();g.toGarage();const second=g.getProgression();
    results.push({first:[first.coins,first.credits],second:[second.coins,second.credits],stored:JSON.parse(localStorage.getItem('overtake-progression-v2')).coins});
   }
   if(!g.start())throw Error('game-over test did not start');
   g.run.score=200;g.run.distance=100;g.endRun('crash');g.endRun('crash');
   const finished=g.getProgression();results.push({finished:[finished.coins,finished.credits],stored:JSON.parse(localStorage.getItem('overtake-progression-v2')).coins});g.toGarage();
   return results;
  });
  assert.deepEqual(settlement,[{first:[1350,1350],second:[1350,1350],stored:1350},{first:[2700,2700],second:[2700,2700],stored:2700},{finished:[2910,2910],stored:2910}]);
  await page.click('#menu-garage');assert.equal(await page.locator('#progress-xp .currency-icon').count(),3);
  await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
  for(const tab of ['body','paint','wheels','lighting']) {
   await page.click(`[data-workshop-tab=${tab}]`);
   const size=await page.locator('#custom-panel').evaluate(e=>({scroll:e.scrollHeight,client:e.clientHeight}));
   assert.ok(size.scroll<=size.client+1,`${name} ${tab}: ${JSON.stringify(size)}`);
  }
  await page.click('[data-workshop-tab=wheels]');const panel=page.locator('[data-workshop-panel=wheels]');
  assert.equal(await panel.locator('.workshop-card').count(),4);
  assert.equal(await panel.locator('.workshop-card img').count(),3);
  await panel.locator('.workshop-card-pager button').last().click();
  assert.ok(await panel.locator('.workshop-card[data-value="rim-4"]').isVisible());
  await panel.locator('.workshop-card[data-value="rim-4"]').click();
  assert.equal(await page.locator('#custom-rim').inputValue(),'rim-4');
  assert.deepEqual(errors,[]);console.log(name,'passed');await page.close();
 }
}finally {await browser.close()}
