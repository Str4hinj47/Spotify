// Five ranked track races, drift-car eligibility and UI layout on desktop/mobile.
import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {for(const [name,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]) {
 const p=await browser.newPage({viewport}),errors=[];p.setDefaultTimeout(120000);p.on('pageerror',e=>errors.push(String(e)));
 await p.addInitScript(()=>localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:0,credits:0,gems:0,dev:false,owned:['golf','challenger','skyline','mustang','bmw-m3'],upgrades:{},tunes:{}})));
 await p.goto(`${process.env.BASE_URL||'http://localhost:4185'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await p.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await p.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 await p.click('#open-modes');await p.click('#mode-next');await p.click('[data-mode=ranked]');
 assert.equal(await p.locator('#rank-scenarios .rank-scenario:not(.hidden)').count(),3);const firstPage=await p.evaluate(()=>{const e=document.querySelector('.lobby-drawer-card');return [e.scrollHeight,e.clientHeight]});assert.ok(firstPage[0]<=firstPage[1]+1,`${name} first page overflow ${firstPage}`);await p.click('#rank-track-next');assert.equal(await p.locator('#rank-scenarios .rank-scenario:not(.hidden)').count(),2);await p.click('[data-scenario=dockside]');
 assert.equal(await p.locator('#menu-start').isDisabled(),true);assert.match(await p.locator('#menu-start-label').textContent(),/DRIFT CAR/);
 const overflow=await p.locator('#lobby-drawer-card').count();
 const sizes=await p.evaluate(()=>{const e=document.querySelector('.lobby-drawer-card');return [e.scrollHeight,e.clientHeight,document.documentElement.scrollWidth,document.documentElement.scrollHeight]});
 assert.ok(sizes[0]<=sizes[1]+1,`${name} drawer overflow ${sizes}`);assert.deepEqual(sizes.slice(2),[viewport.width,viewport.height]);
 await p.screenshot({path:`test-results/ranked-tracks-${name}.png`});
 const result=await p.evaluate(async()=>{
  const g=window.__overtake,{TRACKS}=await import('/src/circuit.mjs'),{isDriftCar}=await import('/src/drift.mjs');
  const out=[];g.setRunMode('ranked');g.setRankedScenario('dockside');const blocked=!g.start();g.setSelectedCar('challenger');
  for(const track of TRACKS) {
   g.setRankedScenario(track.id);if(!g.start())throw Error('could not start '+track.id);
   const first={id:track.id,mode:g.run.mode,world:g.circuitGroup.userData.trackId,road:g.roadGroup.visible,rivals:g.circuitRivals.length,allDrift:g.circuitRivals.every(r=>isDriftCar(r.id))};
   g.raceCountdown=0;g.input.throttle=true;for(let i=0;i<50;i++)g.updateCircuit(.05);
   first.slip=g.vehicle.driftAngle;first.moved=g.playerS;g.vehicle.s=track.length*track.laps+.1;g.updateCircuit(.01);
   first.finish=g.mode;first.rp=g.getRanked().points;first.result=g.run.racePosition;out.push(first);g.toGarage();
  }
  return {blocked,out};
 });
 assert.equal(result.blocked,true);assert.equal(result.out.length,5);for(const [i,row] of result.out.entries()){assert.equal(row.mode,'ranked');assert.equal(row.world,row.id);assert.equal(row.road,false);assert.equal(row.rivals,5);assert.equal(row.finish,'gameover');assert.equal(row.result,1);assert.equal(row.rp,40*(i+1));assert.ok(row.moved>-36);assert.ok(Number.isFinite(row.slip));if(row.id==='dockside'||row.id==='neon')assert.equal(row.allDrift,true)}
 assert.deepEqual(errors,[]);console.log(name,'passed');await p.close();
}} finally {await browser.close()}
