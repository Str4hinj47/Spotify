// Circuit safety barrier regression check.
//
// The walls are open ribbons (no thickness). If they are single-sided, the
// face is culled as soon as the camera moves behind it, which is what made the
// barrier look like it "ended" at the apex. This also pins the contrast bands
// (plinth + stripe) that keep the low wall from disappearing into the run-off.
import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';

const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(180000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:0,credits:0,gems:0,dev:false,owned:['golf'],upgrades:{},tunes:{}})));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4191'}/play.html?test=1&mode=circuit`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 await page.evaluate(()=>{const g=window.__overtake;g.setRunMode('circuit');g.setCircuitScenario('stadium');g.setSelectedCar('golf');if(!g.start())throw Error('circuit did not start');g.raceCountdown=0;});
 await page.waitForTimeout(1200);
 const result=await page.evaluate(async()=>{
  const g=window.__overtake;const THREE=await import('/node_modules/.vite/deps/three.js');
  const {trackPoint}=await import('/src/circuit.mjs');
  g.loop=()=>{};cancelAnimationFrame(g.raf);
  const walls=[];g.scene.traverse(o=>{if(o.name?.startsWith('safety-wall-'))walls.push(o);});
  const face=walls.find(w=>w.name==='safety-wall-right');
  const pos=face.geometry.getAttribute('position');let minY=Infinity,maxY=-Infinity;
  for(let i=0;i<pos.count;i++){minY=Math.min(minY,pos.getY(i));maxY=Math.max(maxY,pos.getY(i));}
  // Look from the middle of the track at the 23 % point of the lap, where the
  // original screenshot showed the barrier vanishing. The first wall mesh on
  // that line of sight must be one of the named barrier meshes.
  const s=373,p=trackPoint(s,0,'stadium'),target=trackPoint(s,13,'stadium');
  const dir=new THREE.Vector3(target.x-p.x,0,target.z-p.z).normalize();
  const ray=new THREE.Raycaster(new THREE.Vector3(p.x,.8,p.z),dir);
  const meshes=[];g.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const hits=ray.intersectObjects(meshes,false).filter(h=>h.object.name?.startsWith('safety-wall-'));
  const a=trackPoint(s+1,0,'stadium'),b=trackPoint(s-1,0,'stadium');
  const f=new THREE.Vector3(a.x-b.x,0,a.z-b.z).normalize();
  g.camera.position.set(p.x-f.x*9,2.7,p.z-f.z*9);g.camera.up.set(0,1,0);
  g.camera.lookAt(p.x+f.x*16,1.0,p.z+f.z*16);g.camera.fov=62;g.camera.updateProjectionMatrix();
  g.renderer.render(g.scene,g.camera);
  return {names:walls.map(w=>w.name).sort(),sides:[...new Set(walls.map(w=>w.material.side))],minY,maxY,hits:hits.length,nearest:hits[0]?.object.name,drawn:g.renderer.info.render.triangles};
 });
 assert.deepEqual(errors,[],`page errors: ${errors.join('; ')}`);
 assert.equal(result.names.length,8,`expected 8 barrier meshes, got ${result.names.length}`);
 for(const side of ['left','right'])for(const part of ['','-cap','-plinth','-stripe'])assert.ok(result.names.includes(`safety-wall${part}-${side}`),`missing safety-wall${part}-${side}`);
 assert.deepEqual(result.sides,[2],'barriers must render from both sides');
 assert.ok(result.minY<=.13&&result.maxY>=1.14,`barrier height ${result.minY}..${result.maxY}`);
 assert.ok(result.hits>0,'no barrier along the line of sight at the 23 % point');
 assert.ok(result.nearest?.startsWith('safety-wall-'),`run-off or scenery covers the barrier (${result.nearest})`);
 assert.ok(result.drawn>0,'nothing was rendered');
 console.log(`barriers ok: ${result.names.length} meshes, height ${result.minY.toFixed(2)}-${result.maxY.toFixed(2)} m, nearest hit ${result.nearest}`);
}finally{await browser.close();}
