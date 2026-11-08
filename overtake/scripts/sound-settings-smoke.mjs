// Sound settings, saved preferences and signal phase synchronization.
// Run against the local Vite server.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1100,height:700}});
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.click('#btn-settings-menu');await page.click('#btn-sound-settings');
  assert.equal(await page.locator('#btn-sound-settings').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#sound-score').isChecked(),true);assert.equal(await page.locator('#sound-indicator').isChecked(),true);
  await page.uncheck('#sound-score');
  assert.equal(await page.evaluate(()=>localStorage.getItem('overtake-score-sounds')),'0');
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.click('#btn-settings-menu');await page.click('#btn-sound-settings');assert.equal(await page.locator('#sound-score').isChecked(),false);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#sound-panel').isHidden(),true);
  await page.evaluate(()=>window.__overtake.setRunMode('endless'));await page.click('#menu-start');await page.waitForFunction(()=>window.__audio?.ctx?.state==='running',{timeout:90000});
  await page.evaluate(()=>{const g=window.__overtake;cancelAnimationFrame(g.raf);g.clearTraffic();g.trySpawn=()=>{};});
  const result=await page.evaluate(async ()=>{
    const g=window.__overtake,a=window.__audio;
    const calls=[], original=a.blip; a.blip=function(...args){calls.push(args[0]);return original.apply(this,args)};
    const emit=(kind)=>g.cb.onEvent({kind,text:'TEST'});
    for(const kind of ['overtake','near','oncoming','contract','finish'])emit(kind);
    const silentScores=calls.slice();const engineWithScoresOff=a.sim._volume;
    a.click(); const uiSound=calls.slice();
    g.toggleSignal('left');g.emitHud();g.emitHud();
    g.updatePlayerLights(.51);g.emitHud();g.emitHud();
    g.updatePlayerLights(.50);g.emitHud();
    const ticks=calls.slice(1);
    g.toggleSignal('right');const switched=calls.slice();
    g.toggleSignal('right');g.emitHud(); const cancelled=calls.slice();
    a.setScoreSounds(true);emit('near');const scoreOn=calls.slice();
    a.setMuted(true);await new Promise(resolve=>setTimeout(resolve,100));
    const mutedVolumes={master:a.effectsGain.gain.value,engine:a.sim._volume};
    g.toggleSignal('left');g.updatePlayerLights(.51);g.emitHud();const afterMute=calls.slice();
    a.setMuted(false);a.setIndicatorSounds(false);g.updatePlayerLights(.5);g.emitHud();const afterIndicatorOff=calls.slice();
    emit('overtake');const scoreStillOn=calls.slice();
    a.setIndicatorSounds(true);g.pause();g.emitHud();const paused=calls.slice();
    g.resume();g.toggleSignal('left');const stopped=calls.slice();
    a.blip=original;
    return {silentScores,engineWithScoresOff,uiSound,ticks,switched,cancelled,scoreOn,mutedVolumes,afterMute,afterIndicatorOff,scoreStillOn,paused,stopped};
  });
  assert.deepEqual(result.silentScores,[]);assert.equal(result.engineWithScoresOff,0.8);assert.deepEqual(result.uiSound,[420]);
  assert.deepEqual(result.ticks,[690,510,690]);assert.deepEqual(result.switched,[420,690,510,690,690]);
  assert.deepEqual(result.cancelled,result.switched);assert.deepEqual(result.scoreOn.slice(-2),[660,990]);
  assert.deepEqual(result.mutedVolumes,{master:0,engine:0});assert.deepEqual(result.afterMute,result.scoreOn);
  assert.deepEqual(result.afterIndicatorOff,result.afterMute);assert.deepEqual(result.scoreStillOn.slice(-2),[660,880]);
  assert.deepEqual(result.paused,result.scoreStillOn);assert.deepEqual(result.stopped,result.paused);
  await page.click('#btn-settings-menu');await page.click('#btn-sound-settings');assert.equal(await page.locator('#sound-score').isChecked(),true);
  await page.uncheck('#sound-score');await page.uncheck('#sound-indicator');
  await page.click('#sound-close');await page.click('#btn-sound');await page.click('#btn-sound-settings');assert.equal(await page.locator('#sound-master').isChecked(),false);
  await page.check('#sound-master');assert.equal(await page.locator('#btn-sound').getAttribute('aria-label'),'Mute sound');
  await page.click('#sound-close');await page.click('#btn-pause');
  await page.click('#btn-pause-sound');assert.equal(await page.locator('#sound-panel').isVisible(),true);
  assert.equal(await page.locator('#btn-pause-sound').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#sound-panel').isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'btn-pause-sound');
  await page.click('#btn-resume');await page.click('#btn-settings-menu');await page.click('#btn-sound-settings');
  await page.setViewportSize({width:390,height:844});
  const layout=await page.evaluate(()=>{
    const a=document.querySelector('.brand').getBoundingClientRect(), b=document.querySelector('.top-actions').getBoundingClientRect(),
      p=document.querySelector('#sound-panel').getBoundingClientRect();
    return {overlap:a.right>b.left, panelInside:p.left>=0&&p.right<=innerWidth, overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.deepEqual(layout,{overlap:false,panelInside:true,overflow:false});
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/sound-settings-mobile.png',timeout:120000});
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.click('#btn-settings-menu');await page.click('#btn-sound-settings');
  assert.equal(await page.locator('#sound-score').isChecked(),false);assert.equal(await page.locator('#sound-indicator').isChecked(),false);assert.equal(await page.locator('#sound-master').isChecked(),true);
  assert.deepEqual(errors,[]);console.log({result,layout,errors});
} finally {await browser.close();}
