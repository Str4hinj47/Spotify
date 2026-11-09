// Check player-only Golf halos are conformed to the headlight lenses and
// independently owned across cloned cars and saved workshop configurations.
import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4190'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const result=await page.evaluate(async()=>{
  const g=window.__overtake,T=await import('/node_modules/three/build/three.module.js'),{disposeBodyKit}=await import('/src/body-kits.ts');cancelAnimationFrame(g.raf);
  g.library.setCustomization('golf',{headlights:'halo'});const car=g.library.create('golf',{player:true}),clone=g.library.create('golf',{player:true}),traffic=g.library.create('golf',{player:false});car.updateMatrixWorld(true);
  const lens=car.getObjectByName('golf_mesh_4'),rings=[];car.traverse(o=>{if(o.name==='headlight-halo')rings.push(o)});
  const ray=new T.Raycaster(),direction=new T.Vector3(0,0,1).transformDirection(car.matrixWorld),v=new T.Vector3();let samples=0,maxGap=0;
  for(const ring of rings){const p=ring.geometry.attributes.position;for(let i=0;i<p.count;i+=7){v.fromBufferAttribute(p,i);ring.localToWorld(v);const local=car.worldToLocal(v.clone());ray.set(car.localToWorld(new T.Vector3(local.x,local.y,-3)),direction);const hit=ray.intersectObject(lens,false)[0];if(!hit)continue;const onLens=car.worldToLocal(hit.point.clone());maxGap=Math.max(maxGap,Math.abs(local.z-onLens.z));samples++;}}
  const cloneRing=clone.getObjectByName('headlight-halo'),owned=rings[0].geometry!==cloneRing.geometry && rings[0].material[0]!==cloneRing.material[0];
  const result={count:rings.length,vertices:rings.map(r=>r.geometry.attributes.position.count),bands:rings.map(r=>r.geometry.groups.length),triangles:rings.map(r=>r.geometry.index.count/3),samples,maxGap,traffic:!!traffic.getObjectByName('headlight-halo'),owned};
  disposeBodyKit(car.getObjectByName('custom-body-kit'));for(const geo of car.userData.customGeometries)geo.dispose();
  result.cloneStillHasGeometry=cloneRing.geometry.attributes.position.count>0;disposeBodyKit(clone.getObjectByName('custom-body-kit'));for(const geo of clone.userData.customGeometries)geo.dispose();
  g.library.setCustomization('golf',{headlights:'stock'});const stock=g.library.create('golf',{player:true});result.stock=!!stock.getObjectByName('headlight-halo');disposeBodyKit(stock.getObjectByName('custom-body-kit'));for(const geo of stock.userData.customGeometries)geo.dispose();
  return result;
 });
 assert.equal(result.count,2);assert.deepEqual(result.vertices,[325,325]);assert.deepEqual(result.bands,[4,4]);assert.deepEqual(result.triangles,[512,512]);assert.ok(result.samples>80);assert.ok(result.maxGap<.002,`halo must follow lens: ${result.maxGap}`);assert.equal(result.traffic,false);assert.equal(result.stock,false);assert.equal(result.owned,true);assert.equal(result.cloneStillHasGeometry,true);assert.deepEqual(errors,[]);
 console.log('Golf halo geometry follows both lenses, has detailed bezels, and remains player-only and independently disposable.');
}finally{await browser.close()}
