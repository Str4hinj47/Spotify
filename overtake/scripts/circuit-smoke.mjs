// Race integration: venue, grid, countdown, opponents, finish and highway isolation.
import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 for(const [label,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]) {
  const page=await browser.newPage({viewport,isMobile:label==='phone',hasTouch:label==='phone'}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{if(!sessionStorage.getItem('seeded-circuit')) {localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:0,credits:0,gems:0,dev:false,owned:['golf'],upgrades:{},tunes:{}})); localStorage.setItem('overtake-mode','rush');sessionStorage.setItem('seeded-circuit','1');}});
  await page.goto(`${process.env.BASE_URL||'http://localhost:4183'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
  assert.match(await page.locator('#menu-selected-mode').textContent(),/CIRCUIT · STADIUM CIRCUIT/);
  await page.click('#menu-start');
  const initial=await page.evaluate(async()=>{const g=window.__overtake,{CARS}=await import('/src/catalog.ts');g.composer.render();return {mode:g.mode,run:g.run.mode,road:g.roadGroup.visible,circuit:g.circuitGroup.visible,track:g.circuitGroup.name,traffic:g.traffic.length,rivals:g.circuitRivals.map(r=>({id:r.id,progress:r.progress})),ids:CARS.map(c=>c.id),s:g.playerS,countdown:g.raceCountdown}});
  assert.equal(initial.run,'circuit');assert.equal(initial.mode,'driving');assert.equal(initial.road,false);assert.equal(initial.circuit,true);assert.equal(initial.traffic,0);assert.equal(initial.rivals.length,5);assert.ok(initial.rivals.every(r=>initial.ids.includes(r.id) && r.id!=='golf'));assert.ok(initial.countdown>0);assert.match(await page.locator('#contract-title').textContent(),/STARTING IN/);if(label==='phone')assert.ok(await page.locator('#t-gas').isVisible());
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[viewport.width,viewport.height]);
  await page.screenshot({path:`test-results/circuit-${label}.png`});
  const result=await page.evaluate(async()=>{const g=window.__overtake,{RACE_DISTANCE}=await import('/src/circuit.mjs');g.raceCountdown=0;g.input.throttle=true;for(let i=0;i<60;i++)g.updateCircuit(.05);const moved=g.playerS;g.pause();const paused=g.mode;g.resume();g.circuitRivals[0].progress=RACE_DISTANCE;g.circuitRivals[0].finished=true;g.circuitRivals[1].progress=RACE_DISTANCE;g.circuitRivals[1].finished=true;g.vehicle.s=RACE_DISTANCE+.1;g.updateCircuit(.01);const out={moved,paused,mode:g.mode,position:g.raceFinishPosition,score:g.run.score,credits:g.getProgression().credits,gems:g.getProgression().gems,passXp:g.getProgression().seasonPass?.xp,record:g.getRecords().modes.circuit.runs};g.toGarage();g.setRunMode('endless');g.start();out.highway=g.roadGroup.visible&&!g.circuitGroup.visible;out.traffic=g.traffic.length;return out});
  assert.ok(result.moved>initial.s);assert.equal(result.paused,'paused');assert.equal(result.mode,'gameover');assert.equal(result.position,3);assert.ok(result.score>=1600);assert.ok(result.credits>0);assert.equal(result.gems,5);assert.equal(result.passXp,100);assert.equal(result.record,1);assert.equal(result.highway,true);assert.ok(result.traffic>0);
  if(label==='desktop') {
   const full=await page.evaluate(async()=>{
    const g=window.__overtake,{trackAt}=await import('/src/circuit.mjs');g.toGarage();g.setRunMode('circuit');g.start();g.raceCountdown=0;
    // Keep the simulation realistic while omitting expensive frame rendering.
    g.updateWorld=()=>{};g.updateCamera=()=>{};g.emitHud=()=>{};
    let steps=0;while(g.mode==='driving' && steps++<15000) {
     // Brake for the actual upcoming curvature rather than treating every
     // nonzero spline value as the same bend at a fixed 25 m/s.
     const bend=Math.max(.001,Math.abs(trackAt(g.vehicle.s).curvature),Math.abs(trackAt(g.vehicle.s+30).curvature));
     const target=Math.min(33,Math.sqrt(5/bend));
     const desired=Math.max(-.25,Math.min(.25,g.vehicle.offset*.025)), error=desired-g.vehicle.heading;
     g.input.throttle=g.vehicle.speed<target;g.input.brake=g.vehicle.speed>target+1;g.input.left=error>.025;g.input.right=error<-.025;g.updateCircuit(.025);
    }
    return {mode:g.mode,steps,position:g.raceFinishPosition,distance:g.run.distance,score:g.run.score};
   });
   assert.equal(full.mode,'gameover');assert.ok(full.steps<15000);assert.ok(full.position>=1 && full.position<=6);assert.ok(full.distance>4000);assert.ok(full.score>=500);
  }
  await page.evaluate(()=>{const g=window.__overtake;g.toGarage();g.setRunMode('endless')});await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});assert.equal(await page.evaluate(()=>window.__overtake.getRunMode()),'endless');
  assert.deepEqual(errors,[]);console.log(label,'passed');await page.close();
 }
}finally{await browser.close()}
