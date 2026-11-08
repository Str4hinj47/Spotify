// Circuit visuals, venue caching, scenery controls and racing-surface clearance.
import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,dev:true,owned:['golf']})));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4185'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 const out=await page.evaluate(async()=>{
  const g=window.__overtake,{TRACKS,trackPoint}=await import('/src/circuit.mjs'),THREE=await import('/node_modules/three/build/three.module.js');const rows=[];
  for(const track of TRACKS) {
   g.toGarage();g.setRunMode('circuit');g.setSelectedCar('challenger');g.setCircuitScenario(track.id);if(!g.start())throw Error('start '+track.id);
   const venue=g.circuitGroup,detail=venue.getObjectByName('circuit-details'),trees=venue.getObjectByName('venue-trees'),rubber=venue.getObjectByName('rubber-marks'),fence=venue.getObjectByName('catch-fence');
   const road=venue.getObjectByName('circuit-asphalt');
   const matrix=new THREE.Matrix4(),pos=new THREE.Vector3();let nearest=Infinity;
   for(let i=0;i<trees.count;i++){trees.getMatrixAt(i,matrix);pos.setFromMatrixPosition(matrix);for(let s=0;s<track.length;s+=4){const p=trackPoint(s,0,track.id);nearest=Math.min(nearest,Math.hypot(pos.x-p.x,pos.z-p.z));}}
   const high=detail.userData.extra.visible;g.setSceneryQuality('low');const low=detail.userData.extra.visible;g.setSceneryQuality('high');const restored=detail.userData.extra.visible;
   rows.push({id:track.id,road:!!road,uv:!!road?.geometry.attributes.uv,detail:!!detail,fence:!!fence,marks:rubber.geometry.attributes.position.count,trees:trees.count,nearest,halfWidth:track.halfWidth,high,low,restored,rivals:g.circuitRivals.length,texture:!!road.material.map});
  }
  g.toGarage();g.setRunMode('endless');g.start();return {rows,highway:g.roadGroup.visible&&!g.circuitGroup.visible};
 });
 for(const r of out.rows){assert.ok(r.road&&r.uv&&r.texture&&r.detail&&r.fence,`${r.id} missing detail`);assert.ok(r.marks>0&&r.trees>0,`${r.id} missing scenery`);assert.ok(r.nearest>r.halfWidth+8,`${r.id} tree intrudes on track`);assert.equal(r.high,true);assert.equal(r.low,false);assert.equal(r.restored,true);assert.equal(r.rivals,5)}assert.ok(out.highway);assert.deepEqual(errors,[]);console.log('Five detailed circuits, texture mapping, safe tree placement, scenery controls and highway isolation passed.');
}finally{await browser.close()}
