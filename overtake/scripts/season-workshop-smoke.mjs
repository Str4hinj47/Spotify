import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(!sessionStorage.getItem('season-test-init')){localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,money:10000,dev:false,owned:['golf'],upgrades:{},tunes:{}}));sessionStorage.setItem('season-test-init','yes')}});
 const url=`${process.env.BASE_URL||'http://localhost:3000'}/play.html?test=1`;await page.goto(url);await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 assert.match(await page.locator('#season-xp').innerText(),/0 \/ 800 XP/);await page.locator('.season-rewards summary').click();assert.equal(await page.locator('#season-reward-list li').count(),8);
 // Use real run contract completion events to check the game -> pass -> save path.
 const result=await page.evaluate(async()=>{
  const g=window.__overtake,{registerPass}=await import('/src/run.mjs');cancelAnimationFrame(g.raf);g.setRunMode('endless');g.start();
  for(let i=0;i<5;i++)g.handleRunEvents(registerPass(g.run,'same',false,1).events);
  let saved=JSON.parse(localStorage.getItem('overtake-progression-v2'));
  g.toGarage();let before=g.getProgression().gems;let buy=g.purchaseTune('golf','front','street');let after=g.getProgression().gems;
  return {xp:saved.seasonPass.xp,unlocked:saved.tunes.golf,byGame:g.getProgression().seasonPass.xp,buy,before,after};
 });
 assert.equal(result.xp,100);assert.ok(result.unlocked.includes('front:street'));assert.equal(result.byGame,100);assert.equal(result.buy,true);assert.equal(result.after,result.before);
 assert.match(await page.locator('#season-xp').innerText(),/100 \/ 800 XP/);await page.click('#season-premium-buy');assert.match(await page.locator('#season-premium-buy').innerText(),/PREMIUM ACTIVE/);assert.match(await page.locator('#season-premium-list li').first().innerText(),/UNLOCKED/);assert.match(await page.locator('#season-reward-list li').first().innerText(),/UNLOCKED/);
 await page.click('#menu-garage');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
 await page.click('[data-workshop-part=hood]');await page.click('[aria-label="Hood"] button[data-value="sport"]');
 await page.click('[data-workshop-part=roof]');await page.click('[aria-label="Roof"] button[data-value="track"]');
 let config=await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-customization-v1')).golf);assert.equal(config.hood,'sport');assert.equal(config.roof,'track');
 let actual=await page.evaluate(()=>{let g=window.__overtake;return {hood:!!g.player.getObjectByName('hood-scoop'),roof:g.player.getObjectsByProperty('name','roof-fin').length,traffic:!!g.library.create('golf').getObjectByName('hood-scoop')}});assert.deepEqual(actual,{hood:true,roof:3,traffic:false});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('[data-workshop-part=roof]').isVisible());
 await page.reload();await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});assert.match(await page.locator('#season-xp').innerText(),/100 \/ 800 XP/);assert.match(await page.locator('#season-premium-buy').innerText(),/PREMIUM ACTIVE/);await page.click('#menu-garage');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');assert.equal(await page.locator('#custom-hood').inputValue(),'sport');assert.equal(await page.locator('#custom-roof').inputValue(),'track');
 // Each playable car offers all hood and roof meshes; traffic remains stock.
 const cars=await page.evaluate(()=>{let g=window.__overtake,out={};for(let id of ['golf','mercedes','audi','mustang','ferrari','r8','challenger','bmw-m3','skyline','aventador-game']){g.library.setCustomization(id,{hood:'track',roof:'track'});let c=g.library.create(id,{player:true});out[id]={hood:!!c.getObjectByName('hood-scoop'),fins:c.getObjectsByProperty('name','roof-fin').length}}return out});
 for(const [id,v] of Object.entries(cars)){assert.ok(v.hood,id);assert.equal(v.fins,3,id)}assert.deepEqual(errors,[]);console.log('Season XP, rewards, workshop and persistence passed.',result);
}finally{await browser.close()}
