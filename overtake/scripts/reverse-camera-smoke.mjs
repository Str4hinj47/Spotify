import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1100,height:750}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:0,credits:0,gems:0,dev:false,owned:['golf','challenger'],upgrades:{},tunes:{}})));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4191'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 for(const id of ['golf','challenger']){
  await page.evaluate(id=>{const g=window.__overtake;g.setSelectedCar(id);g.setRunMode('circuit');if(!g.start())throw Error('race did not start');g.raceCountdown=0;for(const r of g.circuitRivals)g.scene.remove(r.group);g.circuitRivals=[];Object.assign(g.vehicle,{s:200,offset:11,heading:-.7,speed:0,yawRate:0,steer:0});},id);
  await page.keyboard.down('s');
  const reverse=await page.evaluate(()=>{const g=window.__overtake;for(let i=0;i<120;i++)g.updateCircuit(1/60);return {speed:g.vehicle.speed,offset:g.vehicle.offset,s:g.vehicle.s,mode:g.mode,display:document.querySelector('#hud-speed').textContent,position:g.camera.position.toArray()}});
  assert.ok(reverse.speed< -3,`${id} reverse`);assert.ok(reverse.offset<10,`${id} must back away from wall`);assert.ok(reverse.s<200);assert.equal(reverse.mode,'driving');assert.match(reverse.display,/^R /);assert.ok(reverse.position.every(Number.isFinite));
  await page.keyboard.up('s');await page.keyboard.down('w');const forward=await page.evaluate(()=>{const g=window.__overtake;for(let i=0;i<180;i++)g.updateCircuit(1/60);return {speed:g.vehicle.speed,mode:g.mode}});await page.keyboard.up('w');assert.ok(forward.speed>0,`${id} must return to forward`);assert.equal(forward.mode,'driving');await page.evaluate(()=>window.__overtake.toGarage());
 }
 assert.deepEqual(errors,[]);console.log('Grip and drift cars reverse away from wall, display R, and return to forward.');
}finally{await browser.close()}
