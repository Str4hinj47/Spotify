// Reward-road layout, touch/keyboard access, unlocks, purchase, and persistence.
import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const base=process.env.BASE_URL||'http://localhost:4186';
try {
 for(const [name,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]) {
  const page=await browser.newPage({viewport,isMobile:name==='phone',hasTouch:name==='phone'}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{if(!sessionStorage.getItem('road-seed')){const d=new Date(),period=d.getUTCFullYear()*4+Math.floor(d.getUTCMonth()/3);localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:0,credits:0,gems:100,dev:false,owned:['golf'],upgrades:{},tunes:{},seasonPass:{period,xp:400,premium:false}}));sessionStorage.setItem('road-seed','1')}});
  await page.goto(`${base}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await page.click('#open-season');
  assert.equal(await page.locator('#season-premium-list li').count(),8);assert.equal(await page.locator('#season-reward-list li').count(),8);assert.equal(await page.locator('#season-tier-markers li').count(),8);
  assert.equal(await page.locator('#season-reward-list li.earned').count(),4);assert.equal(await page.locator('#season-premium-list li.earned').count(),0);assert.equal(await page.locator('#season-premium-list li:has-text("NEEDS PREMIUM")').count(),4);
  assert.equal(await page.locator('#season-progress').getAttribute('aria-valuenow'),'400');assert.match(await page.locator('#season-xp').textContent(),/400 \/ 800 XP/);
  assert.ok(await page.evaluate(()=>document.querySelector('#season-premium-list').getBoundingClientRect().top < document.querySelector('#season-reward-list').getBoundingClientRect().top));
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.pass-reward')].filter(e=>getComputedStyle(e).display==='none').length),0);
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[viewport.width,viewport.height]);
  await page.screenshot({path:`test-results/season-road-${name}.png`});
  if(name==='landscape') assert.ok(await page.evaluate(()=>document.querySelector('#season-reward-list').getBoundingClientRect().bottom <= document.querySelector('.lobby-drawer-card').getBoundingClientRect().bottom));
  if(name==='desktop') {
   assert.ok(await page.evaluate(()=>document.querySelector('#season-road-viewport').scrollWidth<=document.querySelector('#season-road-viewport').clientWidth+1));
   await page.click('#season-premium-buy');assert.equal(await page.locator('#season-premium-list li.earned').count(),4);assert.equal(await page.locator('#season-premium-buy').isDisabled(),true);assert.equal(await page.evaluate(()=>window.__overtake.getProgression().gems),50);
   assert.ok(await page.evaluate(()=>window.__overtake.getProgression().tunes.golf.includes('livery:race')));
   await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await page.click('#open-season');assert.equal(await page.locator('#season-premium-list li.earned').count(),4);assert.match(await page.locator('#season-premium-buy').textContent(),/ACTIVE/);
  } else {
   const road=page.locator('#season-road-viewport');await road.scrollIntoViewIfNeeded();
   if(name==='phone') {
     const box=await road.boundingBox(), cdp=await page.context().newCDPSession(page),y=box.y+box.height/2;
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width-25,y}]});
     for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width-25-step*35,y}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);
     assert.ok(await road.evaluate(e=>e.scrollLeft>0),'swiping should scroll the reward road');await road.evaluate(e=>e.scrollLeft=0);
   }
   await road.focus();await page.keyboard.press('End');assert.ok(await road.evaluate(e=>e.scrollLeft>0));
   const last=page.locator('#season-reward-list li').last();await last.scrollIntoViewIfNeeded();assert.ok(await last.isVisible());
   await page.click('#pass-scroll-prev');await page.waitForTimeout(500);assert.ok(await road.evaluate(e=>e.scrollLeft<e.scrollWidth-e.clientWidth));
  }
  assert.deepEqual(errors,[]);console.log(name,'reward road passed');await page.close();
 }
}finally{await browser.close()}
