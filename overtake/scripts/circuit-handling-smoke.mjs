// Browser integration: track picker, dry weather isolation, runoff and wall impacts.
import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4185'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 await page.click('#open-tracks');assert.equal(await page.locator('[data-scenario]').count(),5);assert.equal(await page.locator('[data-scenario]:visible').count(),3);await page.screenshot({path:'test-results/circuit-picker-desktop.png'});
 await page.click('#rank-track-next');assert.equal(await page.locator('[data-scenario]:visible').count(),2);await page.click('[data-scenario=neon]');assert.match(await page.locator('#menu-selected-mode').textContent(),/NEON SLIDE/);
 // The two drift tracks require a suitable car; use Coast for this Golf run.
 await page.click('#rank-track-prev');await page.click('[data-scenario=coast]');await page.click('#drawer-close');assert.match(await page.locator('#menu-selected-mode').textContent(),/COAST RUN/);
 await page.evaluate(()=>{const g=window.__overtake;g.setWeatherMode('rain');g.weather.rain=1;g.weather.wet=1;});await page.click('#menu-start');
 const out=await page.evaluate(async()=>{
  const g=window.__overtake,{getTrack}=await import('/src/circuit.mjs'),{circuitCarOverlap}=await import('/src/circuit-contact.mjs');const initial={track:g.raceTrack,weather:g.getWorldSettings().weather,rain:g.weather.rain,wet:g.weather.wet,field:g.circuitRivals.length};g.setWeatherMode('snow');g.updateWorld(2);const stillDry={rain:g.weather.rain,snow:g.weather.snow,mode:g.weather.mode};
  g.raceCountdown=0;g.updateWorld=()=>{};g.updateCamera=()=>{};g.emitHud=()=>{};g.circuitRivals.forEach((r,i)=>{r.progress=-250-i*50;r.offset=0;r.speed=0});
  g.vehicle.s=100;g.vehicle.offset=10.35;g.vehicle.heading=-.1;g.vehicle.speed=15;g.updateCircuit(.01);const runoff=g.vehicle.offset;
  g.vehicle.offset=12.5;g.vehicle.heading=-.3;g.vehicle.speed=15;g.updateCircuit(.01);const impact={offset:g.vehicle.offset,heading:g.vehicle.heading,speed:g.vehicle.speed,shake:g.shake};
  const r=g.circuitRivals[0];g.vehicle.s=100;g.vehicle.offset=0;g.vehicle.heading=0;g.vehicle.speed=30;r.progress=103.6;r.offset=0;r.heading=0;r.speed=10;g.updateCircuit(.01);
  const actualPlayer={progress:g.vehicle.s,offset:g.vehicle.offset,heading:g.vehicle.heading,driftAngle:g.vehicle.driftAngle,length:g.playerMeta.length,width:g.playerMeta.width};
  const collision={playerSpeed:g.vehicle.speed,rivalSpeed:r.speed,overlap:!!circuitCarOverlap(actualPlayer,r,getTrack('coast').length)};
  r.progress=350;r.offset=0;r.heading=0;r.speed=22;let wheel=0,yaw=0;for(let i=0;i<40;i++){g.updateCircuit(.05);wheel=Math.max(wheel,Math.abs(r.wheelSteer));yaw=Math.max(yaw,Math.abs(r.yawRate||0))}
  g.toGarage();const restored={mode:g.weather.mode,rain:g.weather.rain,wet:g.weather.wet};return {initial,stillDry,runoff,impact,collision,wheel,yaw,restored,halfWidth:getTrack('coast').halfWidth};
 });
 assert.deepEqual(out.initial,{track:'coast',weather:'Clear',rain:0,wet:0,field:5});assert.deepEqual(out.stillDry,{rain:0,snow:0,mode:'clear'});assert.ok(out.runoff>out.halfWidth);assert.ok(out.impact.offset>out.halfWidth&&out.impact.heading>0&&out.impact.speed<15&&out.impact.shake>0);assert.ok(out.collision.playerSpeed<30&&out.collision.rivalSpeed>10);assert.equal(out.collision.overlap,false);assert.ok(out.wheel>.001&&out.yaw>.001);assert.equal(out.restored.mode,'snow');assert.equal(out.restored.rain,1);assert.equal(out.restored.wet,1);assert.deepEqual(errors,[]);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const g=window.__overtake;g.setRunMode('circuit')});await page.click('#open-tracks');assert.ok(await page.locator('#rank-track-next').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'test-results/circuit-picker-phone.png'});
 console.log('Track picker, five layouts, dry-only circuit weather, highway weather restoration, wall impact, runoff and steering wheels passed.');
}finally{await browser.close()}
