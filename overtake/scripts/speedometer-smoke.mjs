import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await pw.launch({ executablePath: await chromium.executablePath(), headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']),
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` } });
try {
  const page = await browser.newPage({ viewport:{width:1280,height:800} });
  const errors=[]; page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`);
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__overtake?.mode === 'driving');
  const state = await page.evaluate(() => {
    const g=window.__overtake, a=window.__audio;
    cancelAnimationFrame(g.raf); g.clearTraffic(); g.trySpawn=()=>{};
    const original=a.engine; let sample={rpm:3500, gear:3, redline:7000, boost:0};
    a.engine=()=>sample;
    const read=()=>({ speed:document.querySelector('#hud-speed').textContent, gear:document.querySelector('#hud-gear').textContent,
      rpm:document.querySelector('#hud-rpm').textContent, max:document.querySelector('#speed-max').textContent,
      arc:Number(document.querySelector('#speed-arc').style.strokeDashoffset), rpmWidth:parseFloat(document.querySelector('#rpm-fill').style.width),
      red:document.querySelector('#speed-cluster').classList.contains('redline') });
    g.vehicle.speed=27; g.updateDriving(0); const mid=read();
    sample={rpm:6900, gear:5, redline:7000, boost:0}; g.vehicle.speed=54; g.updateDriving(0); const high=read();
    sample={rpm:850, gear:0, redline:7000, boost:0}; g.vehicle.speed=0; g.updateDriving(0); const neutral=read();
    a.engine=()=>null; g.updateDriving(0); const unavailable=read();
    a.engine=original; g.vehicle.speed=0; g.updateDriving(0);
    return {mid,high,neutral,unavailable};
  });
  assert.equal(state.mid.speed,'97'); assert.equal(state.mid.gear,'3'); assert.equal(state.mid.rpm,'3,500');
  assert.ok(Math.abs(state.mid.arc-50)<1); assert.equal(state.mid.rpmWidth,50);
  assert.equal(state.high.gear,'5'); assert.ok(state.high.arc < 0.1 && state.high.red);
  assert.equal(state.neutral.gear,'N'); assert.equal(state.neutral.arc,100);
  assert.equal(state.unavailable.gear,'—'); assert.equal(state.unavailable.rpm,'—');
  fs.mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/speedometer-desktop.png',timeout:120000});
  await page.setViewportSize({width:390,height:844});
  const boxes = await page.evaluate(() => {
    const rect = sel => { const r=document.querySelector(sel).getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; };
    return {meter:rect('.hud-right'), contract:rect('.contract-card'), signals:rect('.turn-signals')};
  });
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  assert.ok(boxes.meter.left>=0 && boxes.meter.right<=390);
  assert.ok(!overlaps(boxes.meter,boxes.contract),'meter overlaps contract');
  assert.ok(!overlaps(boxes.meter,boxes.signals),'meter overlaps indicator buttons');
  await page.evaluate(() => window.__overtake.composer.render());
  await page.screenshot({path:'test-results/speedometer-mobile.png',timeout:120000});
  // Engine telemetry remains live even when sound is muted.
  const muted = await page.evaluate(() => {
    const g=window.__overtake, a=window.__audio; a.setMuted(true);
    g.vehicle.speed=12; g.updateDriving(0);
    return {gear:document.querySelector('#hud-gear').textContent, rpm:document.querySelector('#hud-rpm').textContent};
  });
  assert.notEqual(muted.gear,'—'); assert.notEqual(muted.rpm,'—');
  await page.evaluate(() => window.__audio.setMuted(false));
  assert.deepEqual(errors,[]); console.log({state,boxes,muted,errors});
} finally { await browser.close(); }
