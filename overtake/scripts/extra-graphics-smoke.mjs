// Weather-driven tire spray, foliage snow and recycled roadside signs.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
const realRender = process.env.REAL_RENDER === '1';
try {
  const page=await browser.newPage({viewport:realRender ? {width:720,height:480} : {width:1000,height:700}});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(realRender ? `${process.env.BASE_URL || 'http://localhost:3000'}/play.html` : `${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.click('#btn-start');
  const setup=await page.evaluate(()=>{
    const g=window.__overtake;cancelAnimationFrame(g.raf);g.clearTraffic();g.trySpawn=()=>{};g.setCycleRunning(false);g.setTimeOfDay(12);g.setCameraPreset('far');
    const spr=g.spray; spr.clear();
    for(let i=0;i<100;i++) spr.update(.016,g.pos,g.yaw,g.playerMeta.width,g.playerMeta.length,35,0,0,0);
    const dry=spr.points.visible;
    for(let i=0;i<100;i++) spr.update(.016,g.pos,g.yaw,g.playerMeta.width,g.playerMeta.length,0,1,0,0);
    const stopped=spr.points.visible;
    return {dry,stopped,signs:g.roadsideSigns.map(x=>({count:x.count,name:x.name})), snowShader:g.treeMat.customProgramCacheKey()};
  });
  assert.equal(setup.dry,false);assert.equal(setup.stopped,false);assert.equal(setup.signs.length,4);assert.ok(setup.signs.every(x=>x.count===8));assert.equal(setup.snowShader,'foliage-snow-caps-v1');
  fs.mkdirSync('test-results',{recursive:true});
  for(const weather of ['rain','snow']) {
    const result=await page.evaluate(weather=>{
      const g=window.__overtake;g.spray.clear();g.vehicle.speed=35;g.input.throttle=true;
      g.setWeatherMode(weather);Object.assign(g.weather,{rain:weather==='rain'?1:0,wet:weather==='rain'?1:0,snow:weather==='snow'?1:0,snowCover:weather==='snow'?1:0});
      for(let i=0;i<50;i++)g.updateDriving(.03);
      g.composer.render();
      const spray=g.spray, alphas=spray.geometry.getAttribute('sprayAlpha').array;
      return {visible:spray.points.visible, count:Array.from(alphas).filter(a=>a>0).length, speed:g.speed, cover:g.roadSurface.snow.value};
    },weather);
    assert.ok(result.visible && result.count>=10);assert.ok(result.speed>10);assert.equal(result.cover>0.5,weather==='snow');
    await page.screenshot({path:`test-results/tire-spray-${weather}${realRender ? "-real" : ""}.png`,timeout:120000});console.log(weather,result);
  }
  const stable=await page.evaluate(()=>{
    const g=window.__overtake;g.playerS=4700;g.updateScenery();
    const before=Array.from(g.roadsideSigns[0].instanceMatrix.array.slice(16,32));
    g.playerS+=155;g.updateScenery();
    const after=Array.from(g.roadsideSigns[0].instanceMatrix.array.slice(0,16));
    g.toGarage();return {before,after,hidden:!g.spray.points.visible};
  });
  assert.deepEqual(stable.before,stable.after);assert.equal(stable.hidden,true);assert.deepEqual(errors,[]);
  console.log('Additional graphics OK');
} finally {await browser.close();}
