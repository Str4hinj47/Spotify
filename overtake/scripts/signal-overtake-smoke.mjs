// Exercise the real driving/pass path, not a simulated signal callback.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1100,height:700}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.click('#btn-start');
  const result=await page.evaluate(()=>{
    const g=window.__overtake, audio=window.__audio;
    cancelAnimationFrame(g.raf);g.clearTraffic();g.trySpawn=()=>{};
    const state=()=>({signal:g.signal,elapsed:g.signalElapsed,overtakes:g.run.overtakes,
      oncoming:g.run.oncomingDodges,lamps:[g.player.userData.indicatorState.left.value,g.player.userData.indicatorState.right.value],
      left:document.querySelector('#signal-left').getAttribute('aria-pressed'),right:document.querySelector('#signal-right').getAttribute('aria-pressed'),audio:audio.signal});
    const add=(kind,delta,offset)=>{
      if(kind==='same')g.spawnSame(g.playerS+delta,0);else g.spawnOncoming(g.playerS+delta,0);
      const t=g.traffic[g.traffic.length-1];t.offset=g.vehicle.offset+offset;return t;
    };
    g.toggleSignal('left');const ahead=add('same',10,3);
    g.updateDriving(0);const approaching=state();
    ahead.s=g.playerS-(g.playerMeta.length/2+ahead.length/2+.5);
    g.updateDriving(0);const notYetClear=state();
    ahead.s=g.playerS-(g.playerMeta.length/2+ahead.length/2+1.1);
    g.updateDriving(0);const completed=state();
    g.clearTraffic();g.toggleSignal('right');
    const incoming=add('oncoming',-20,3);incoming.s=g.playerS-(g.playerMeta.length/2+incoming.length/2+1.1);
    g.updateDriving(0);const dodged=state();
    // A near pass also cancels, even during the unlit half of the cycle.
    g.clearTraffic();const near=add('same',-20,2.5);near.s=g.playerS-(g.playerMeta.length/2+near.length/2+1.1);
    g.updatePlayerLights(.6);g.emitHud();const unlit=state();
    g.updateDriving(0);const nearComplete=state();
    g.toggleSignal('left');g.toggleSignal('left');const manual=state();
    g.toggleSignal('right');const reactivated=state();
    return {approaching,notYetClear,completed,dodged,unlit,nearComplete,manual,reactivated};
  });
  assert.equal(result.approaching.signal,'left');assert.equal(result.notYetClear.signal,'left');assert.equal(result.notYetClear.overtakes,0);
  assert.equal(result.completed.overtakes,1);assert.equal(result.completed.signal,null);assert.equal(result.completed.elapsed,0);
  assert.deepEqual(result.completed.lamps,[0,0]);assert.equal(result.completed.left,'false');assert.equal(result.completed.audio,null);
  assert.equal(result.dodged.oncoming,1);assert.equal(result.dodged.signal,'right');assert.equal(result.dodged.right,'true');
  assert.equal(result.unlit.signal,'right');assert.equal(result.unlit.lamps[1],-1);
  assert.equal(result.nearComplete.overtakes,2);assert.equal(result.nearComplete.signal,null);assert.deepEqual(result.nearComplete.lamps,[0,0]);assert.equal(result.nearComplete.right,'false');assert.equal(result.nearComplete.audio,null);
  assert.equal(result.manual.signal,null);assert.equal(result.reactivated.signal,'right');assert.deepEqual(errors,[]);
  console.log(result);
} finally {await browser.close();}
