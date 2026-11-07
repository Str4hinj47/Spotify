// Optional close-up and narrow-viewport rendering checks against the local server.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await pw.launch({executablePath: await chromium.executablePath(), headless:true,
  args: chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env, LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.click('#btn-start');
  await page.evaluate(()=>{
    const g=window.__overtake;cancelAnimationFrame(g.raf);g.clearTraffic();g.setCycleRunning(false);g.setTimeOfDay(12);g.setWeatherMode('clear');
    Object.assign(g.weather,{rain:0,wet:0,snow:0,snowCover:0});g.updateWorld(.1);g.updateRoad();g.scene.updateMatrixWorld(true);
    const lamp=g.lamps[0].g;lamp.updateWorldMatrix(true,false);
    const cameraPos=lamp.localToWorld(g.camera.position.clone().set(6,6,12));
    const target=lamp.localToWorld(g.camera.position.clone().set(-.7,4.1,0));
    g.camera.position.copy(cameraPos);g.camera.lookAt(target);g.camera.updateProjectionMatrix();g.composer.render();
  });
  fs.mkdirSync('test-results',{recursive:true});await page.addStyleTag({content:'body > :not(canvas):not(script) { visibility:hidden !important; }'});
  await page.screenshot({path:'test-results/streetlight-closeup.png',timeout:120000});
  await page.setViewportSize({width:390,height:844});
  const result=await page.evaluate(()=>{
    const g=window.__overtake;g.setWeatherMode('snow');Object.assign(g.weather,{rain:0,wet:0,snow:1,snowCover:1});
    g.updateWorld(.1);g.updateRoad();g.updateCamera(.1);g.composer.render();
    return {snow:g.snowLayer.visible, rail:g.railL.visible, width:g.renderer.domElement.width,height:g.renderer.domElement.height};
  });
  assert.ok(result.snow&&result.rail);assert.equal(result.width,390);assert.equal(result.height,844);
  await page.screenshot({path:'test-results/road-mobile-snow.png',timeout:120000});
  assert.deepEqual(errors,[]);console.log(result);
} finally {await browser.close();}
