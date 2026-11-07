import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1200,height:800}});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:10000,credits:10000,gems:1000,owned:['golf'],upgrades:{golf:{engine:3,tires:0,brakes:0}},tunes:{}})));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4181'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await page.click('#menu-start');
 const result=await page.evaluate(async()=>{
  const g=window.__overtake,{createRun}=await import('/src/run.mjs');g.clearTraffic();g.trySpawn=()=>{};g.run=createRun('endless');g.vehicle.offset=.4;g.offset=.4;g.vehicle.speed=25;
  for(let i=0;i<20;i++)g.updateDriving(.1);
  const empty={score:g.run.score,combo:g.run.combo,overtakes:g.run.overtakes};
  g.spawnOncoming(g.playerS+10,0);let t=g.traffic.at(-1);t.offset=-2.1;t.s=g.playerS-(g.playerMeta.length/2+t.length/2+.5);g.updateDriving(.1);
  const oncoming={score:g.run.score,combo:g.run.combo,near:g.run.nearMisses};g.clearTraffic();
  g.spawnSame(g.playerS+10,0);t=g.traffic.at(-1);t.offset=g.offset+2.7;t.s=g.playerS-(g.playerMeta.length/2+t.length/2+.5);g.updateDriving(.1);
  const pass={score:g.run.score,combo:g.run.combo,overtakes:g.run.overtakes};g.updateDriving(.1);pass.after=g.run.score;g.clearTraffic();
  g.spawnSame(g.playerS-20,0);t=g.traffic.at(-1);t.offset=g.offset+2.7;g.updateDriving(.1);const behind=g.run.score;g.clearTraffic();
  g.run=createRun('endless');g.vehicle.speed=60;g.input.throttle=true;for(let i=0;i<4;i++)g.updateDriving(.1);const before=g.run.score;g.updateDriving(.1);const first=g.run.score;for(let i=0;i<5;i++)g.updateDriving(.1);const second=g.run.score;
  const hud={active:!document.querySelector('#speed-bonus-active').classList.contains('hidden'),label:document.querySelector('#speed-bonus-active').textContent};
  g.pause();g.loop();cancelAnimationFrame(g.raf);const paused=g.run.score;
  return {empty,oncoming,pass,behind,before,first,second,paused,hud};
 });
 assert.deepEqual(result.empty,{score:0,combo:0,overtakes:0});assert.deepEqual(result.oncoming,{score:0,combo:0,near:0});assert.deepEqual(result.pass,{score:100,combo:1,overtakes:1,after:100});assert.equal(result.behind,100);assert.equal(result.before,0);assert.equal(result.first,25);assert.equal(result.second,50);assert.equal(result.paused,50);assert.equal(result.hud.active,true);assert.match(result.hud.label,/25/);await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.setDefaultTimeout(120000);mobile.on('pageerror',e=>errors.push(String(e)));await mobile.addInitScript(()=>localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:0,credits:0,gems:0,owned:['golf'],upgrades:{golf:{engine:3,tires:0,brakes:0}},tunes:{}})));
 await mobile.goto(`${process.env.BASE_URL||'http://localhost:4181'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await mobile.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await mobile.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await mobile.click('#menu-mobile-start');await mobile.evaluate(()=>{const g=window.__overtake;g.clearTraffic();g.trySpawn=()=>{};g.vehicle.speed=60;g.input.throttle=true;for(let i=0;i<5;i++)g.updateDriving(.1)});assert.equal(await mobile.locator('#speed-bonus-active').isVisible(),true);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.screenshot({path:'test-results/speed-bonus-mobile.png',timeout:120000});await mobile.close();
 assert.deepEqual(errors,[]);console.log(result);
} finally {await browser.close()}
