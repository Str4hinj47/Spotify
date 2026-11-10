// Racing-line reference and post-race comparison. Runs one real lap in the
// browser so the recorded line comes from the actual vehicle model, then
// checks the results map is drawn and laid out at three viewport sizes.
import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
import {TRACKS,getTrack} from '../src/circuit.mjs';
import {referenceLine} from '../src/racing-line.mjs';

// The guide stays on the asphalt, uses both sides of it and closes the loop.
for(const track of TRACKS){
 const line=referenceLine(track.id);
 assert.equal(line.samples.length,192);
 assert.ok(line.samples.every((p,i)=>i===0||p.s>line.samples[i-1].s),`${track.id}: samples are ordered`);
 const offsets=line.samples.map(p=>p.offset),reach=Math.max(...offsets)-Math.min(...offsets);
 assert.ok(offsets.every(o=>Math.abs(o)<=track.halfWidth),`${track.id}: line leaves the road`);
 assert.ok(reach>track.halfWidth,`${track.id}: line does not use the width (${reach.toFixed(2)})`);
 assert.ok(reach<track.halfWidth*2,`${track.id}: line range ${reach.toFixed(2)}`);
 assert.ok(Math.abs(line.samples.at(-1).offset-line.samples[0].offset)<2,`${track.id}: line does not close`);
}

const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try{
 for(const [name,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]){
  const page=await browser.newPage({viewport});page.setDefaultTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:0,credits:0,gems:0,dev:false,owned:['golf','challenger','skyline','mustang','bmw-m3'],upgrades:{},tunes:{}})));
  await page.goto(`${process.env.BASE_URL||'http://localhost:4191'}/play.html?test=1&ads=demo`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
  const driven=await page.evaluate(async()=>{
   const g=window.__overtake,{TRACKS,trackSample}=await import('/src/circuit.mjs');
   g.setRunMode('circuit');g.setCircuitScenario('stadium');g.setSelectedCar('golf');
   if(!g.start())throw Error('circuit did not start');
   g.raceCountdown=0;
   const track=TRACKS.find(t=>t.id==='stadium');
   let steps=0;
   while(steps++<4000 && g.mode==='driving' && g.playerS<track.length+6){
    const c=trackSample(g.playerS+28,'stadium').curvature;
    const limit=Math.min(46,Math.sqrt(7.6/Math.max(.002,Math.abs(c))));
    g.input.throttle=g.vehicle.speed<limit-1;
    g.input.brake=g.vehicle.speed>limit+2;
    const err=Math.max(-.18,Math.min(.18,g.vehicle.offset*.03))-g.vehicle.heading;
    g.input.left=err>.02;g.input.right=err<-.02;
    g.updateCircuit(.05);
   }
   const lap={s:g.playerS,elapsed:g.run.elapsed,laps:[...g.raceTiming.lapTimes],mode:g.mode};
   g.vehicle.s=track.length*track.laps+.5;g.updateCircuit(.01);
   return {...lap,after:g.mode,lapTimes:[...g.raceTiming.lapTimes],lineLaps:g.lineLaps.map(l=>({lap:l.lap,time:l.time,samples:l.samples.length})),line:g.raceLine?{lap:g.raceLine.lap,time:g.raceLine.lapTime,samples:g.raceLine.samples.length,track:g.raceLine.track}:null};
  });
  assert.equal(driven.mode,'driving',`${name}: lap did not complete (${driven.s.toFixed(0)}m)`);
  assert.ok(driven.line,`${name}: no racing line was captured`);
  assert.equal(driven.line.track,'stadium');
  assert.ok(driven.line.samples>100,`${name}: only ${driven.line.samples} samples`);
  assert.ok(driven.line.time>20,`${name}: recorded lap time ${driven.line.time}`);
  assert.equal(driven.after,'gameover');
  await page.waitForTimeout(250);
  const ui=await page.evaluate(()=>{
   const panel=document.getElementById('race-line'),canvas=document.getElementById('race-line-map'),modal=document.querySelector('#gameover .modal');
   const rect=canvas.getBoundingClientRect();let cyan=0,green=0;
   if(rect.width>0&&rect.height>0){const ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height).data;for(let i=0;i<data.length;i+=4){const r=data[i],gg=data[i+1],b=data[i+2];if(b>180&&gg>170&&r<160)cyan++;if(r>190&&gg>140&&b<170)green++;}}
   const style=getComputedStyle(modal);
   return {hidden:panel.classList.contains('hidden'),adOfferVisible:!document.getElementById('btn-ad-double').classList.contains('hidden'),adOfferInModal:document.querySelector('#gameover .modal').contains(document.getElementById('btn-ad-double')),rect:[Math.round(rect.width),Math.round(rect.height)],cyan,green,lap:document.getElementById('race-line-lap').textContent,note:document.getElementById('race-line-note').textContent,overflowY:modal.scrollHeight-modal.clientHeight,scroll:style.overflowY,doc:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};
  });
  assert.equal(ui.hidden,false,`${name}: line panel hidden`);
  assert.equal(ui.adOfferVisible,true,`${name}: rewarded offer missing on race results`);
  assert.equal(ui.adOfferInModal,true,`${name}: rewarded offer outside the results card`);
  assert.ok(ui.rect[0]>120&&ui.rect[1]>40,`${name}: map is ${ui.rect}`);
  assert.ok(ui.cyan>300,`${name}: player line missing (${ui.cyan}px)`);
  assert.ok(ui.green>120,`${name}: reference line missing (${ui.green}px)`);
  assert.equal(ui.lap,'1');
  assert.match(ui.note,/\d+:\d\d\.\d\d/);
  assert.deepEqual(ui.doc,[viewport.width,viewport.height],`${name}: page overflow ${ui.doc}`);
  assert.ok(ui.overflowY<=2 || ui.scroll==='auto',`${name}: results are clipped (${ui.overflowY}px, ${ui.scroll})`);
  assert.deepEqual(errors,[],`${name}: page errors`);
  await page.screenshot({path:`test-results/racing-line-${name}.png`});
  console.log(name,'passed',JSON.stringify({line:driven.line,rect:ui.rect,cyan:ui.cyan,green:ui.green,overflowY:ui.overflowY}));
  await page.close();
 }
}finally{await browser.close()}
