// In-game race AI integration: passing the player, brake lights and finishers.
import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4185'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 const result=await page.evaluate(async()=>{
  const g=window.__overtake,{TRACK_LENGTH}=await import('/src/circuit.mjs');g.setRunMode('circuit');g.setCircuitScenario('stadium');g.start();g.raceCountdown=0;
  const lights=g.circuitRivals.every(r=>r.group.userData.vehicleLights?.rear.length===2);
  g.updateWorld=()=>{};g.updateCamera=()=>{};g.emitHud=()=>{};
  const fast=g.circuitRivals[0];g.vehicle.s=65;g.vehicle.offset=0;g.vehicle.speed=18;g.speed=18;g.playerS=65;g.offset=0;
  fast.progress=40;fast.offset=0;fast.speed=32;for(let i=1;i<5;i++){g.circuitRivals[i].progress=-100-i*20;g.circuitRivals[i].speed=0;}
  let maxOffset=0,braked=false,passEngaged=false;
  for(let i=0;i<160;i++){g.updateCircuit(.05);maxOffset=Math.max(maxOffset,Math.abs(fast.offset));braked ||= fast.braking;passEngaged ||= fast.passTarget===-1;}
  const passed=fast.progress>g.playerS+8, yaw=fast.group.rotation.y;
  fast.progress=TRACK_LENGTH*3+20;fast.finished=true;fast.speed=25;const before=fast.progress;g.updateCircuit(.05);const rolling=fast.progress>before;
  return {lights,maxOffset,braked,passEngaged,passed,yaw,rolling};
 });
 assert.ok(result.lights);assert.ok(result.maxOffset>2);assert.ok(result.braked);assert.ok(result.passEngaged);assert.ok(result.passed);assert.ok(Number.isFinite(result.yaw));assert.ok(result.rolling);assert.deepEqual(errors,[]);console.log('In-game AI passing, brake lights and finish-line circulation passed.');
}finally{await browser.close()}
