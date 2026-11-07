// Run a sustained highway simulation with detailed scenery and sample real frames.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL || 'http://localhost:3000';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(`${base}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.waitForFunction(()=>window.__overtake.detailedScenery.ready,null,{timeout:180000});
  await page.click('#menu-start');
  await page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);g.clearTraffic();g.trySpawn=()=>{};g.setCycleRunning(false);g.setTimeOfDay(12);g.setWeatherMode('clear');Object.assign(g.weather,{rain:0,wet:0,snow:0,snowCover:0});g.vehicle.speed=35;g.setInput('throttle',true);});
  fs.mkdirSync('test-results',{recursive:true});
  let previous=0;
  for(let batch=0;batch<6;batch++) {
    const state=await page.evaluate(()=>{
      const g=window.__overtake;
      for(let i=0;i<80;i++)g.updateDriving(.04);
      g.updateCamera(.5);g.composer.render();
      const pos=g.terrain.geometry.getAttribute('position').array;
      const conifer=g.roadGroup.children.find(o=>o.name==='detailed-conifer');
      return {distance:g.playerS,mode:g.mode,finite:Array.from(pos).every(Number.isFinite),pines:conifer.count,shadows:g.sceneryShadows.count,sunCastsShadow:g.atmosphere.sun.castShadow};
    });
    assert.equal(state.mode,'driving');assert.equal(state.finite,true);assert.ok(state.distance>previous);assert.equal(state.sunCastsShadow,false);
    assert.ok(state.pines>=0&&state.pines<=90&&state.shadows<=144);previous=state.distance;
    if(batch===2||batch===5)await page.screenshot({path:`test-results/scenery-motion-${batch}.png`,timeout:120000});
  }
  assert.ok(previous>500,`Only drove ${previous}m`);assert.deepEqual(errors,[]);
  console.log(`Drove ${previous.toFixed(1)}m continuously with detailed scenery; no errors.`);
} finally {await browser.close();}
