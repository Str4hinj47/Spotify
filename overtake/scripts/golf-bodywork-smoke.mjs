import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4185'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {disposeBodyKit}=await import('/src/body-kits.ts');const g=window.__overtake;cancelAnimationFrame(g.raf);
  const source=g.library.get('golf').scene.getObjectByName('golf_mesh_3').geometry;
  const check=[];const vector=new T.Vector3();
  function car(config){g.library.setCustomization('golf',config);const c=g.library.create('golf',{player:true});c.updateMatrixWorld(true);return c;}
  function dispose(c){const kit=c.getObjectByName('custom-body-kit');if(kit)disposeBodyKit(kit);for(const geometry of c.userData.customGeometries)geometry.dispose();}
  for(const variant of ['street','touring','sport','track']) for(const part of ['front','rear','skirts','all']) {
   const config=part==='all'?{front:variant,rear:variant,skirts:variant}:{[part]:variant};
   const c=car(config),mesh=c.getObjectByName('golf_mesh_3'),p=mesh.geometry.getAttribute('position'),matrix=new T.Matrix4().copy(c.matrixWorld).invert().multiply(mesh.matrixWorld);
   let inside=0;for(let i=0;i<p.count;i+=3){const q=new T.Vector3();for(let j=0;j<3;j++)q.add(vector.fromBufferAttribute(p,i+j).applyMatrix4(matrix));q.multiplyScalar(1/3);
     if((config.rear&&q.y<.39-1e-5&&q.z>1.55+1e-5)||(config.front&&q.y<.36-1e-5&&q.z< -1.49-1e-5)||(config.skirts&&q.y<.38-1e-5&&q.z>-.8+1e-5&&q.z<.98-1e-5&&Math.abs(q.x)>.68+1e-5)) inside++;
   }
   const kit=c.getObjectByName('custom-body-kit'),names=[];kit.traverse(o=>{if(o.isMesh)names.push(o.name)});
   check.push({variant,part,inside,names,cloned:mesh.geometry!==source,sourceIntact:g.library.get('golf').scene.getObjectByName('golf_mesh_3').geometry===source});dispose(c);
  }
  const full=[];
  for(const rear of ['golf-r32','golf-clean']) {
   const c=car({rear}), paint=c.getObjectByName('golf_mesh_3'),trim=c.getObjectByName('golf_mesh'), kit=c.getObjectByName('custom-body-kit');
   const countInside=(mesh)=>{const p=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index,matrix=new T.Matrix4().copy(c.matrixWorld).invert().multiply(mesh.matrixWorld);let n=0;
     for(let i=0;i<(idx?idx.count:p.count);i+=3){const q=new T.Vector3();for(let j=0;j<3;j++)q.add(vector.fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(matrix));q.multiplyScalar(1/3);if(q.y<.62-1e-5&&q.z>1.55+1e-5)n++;}return n;};
   const exhaust=kit.getObjectByName('custom-exhaust'),mouths=[];exhaust?.traverse(o=>{if(o.name==='exhaust-mouth')mouths.push(o.position.x)});
   full.push({rear,paint:countInside(paint),trim:countInside(trim),mouths});dispose(c);
  }
  const r32=[];
  for(const exhaust of ['stock','street','touring','sport','track','flame']) {
    const c=car({rear:'golf-r32',exhaust,rearFinish:'carbon'}),panel=c.getObjectByName('rear-valance');
    const hits=[-.48,.48].map(x=>new T.Raycaster(new T.Vector3(x,.29,2.4),new T.Vector3(0,0,-1)).intersectObject(panel).length);
    const group=c.getObjectByName('custom-exhaust'),mouths=[];group.traverse(o=>{if(o.name==='exhaust-mouth')mouths.push(o.position.toArray())});
    const flames=group.getObjectByName('exhaust-flames');r32.push({exhaust,hits,mouths,flames:flames?.children.map(o=>o.position.toArray())||[],carbon:panel.material[0].name});dispose(c);
  }
  const exhaust=[];
  for(const variant of ['street','touring','sport','track','flame']) {
   const c=car({rear:'track',exhaust:variant,rearFinish:'carbon'}),panel=c.getObjectByName('rear-valance');
   const centers=variant==='sport'?[-.48,.48]:[-.52-.10*(variant==='touring'?.38:.5),-.52+.10*(variant==='touring'?.38:.5)];
   const hits=centers.map(x=>new T.Raycaster(new T.Vector3(x,.29,2.4),new T.Vector3(0,0,-1)).intersectObject(panel).length);
   exhaust.push({variant,hits,carbon:panel.material[0].name});dispose(c);
  }
  const stock=car({}),traffic=g.library.create('golf');const intact={stock:stock.getObjectByName('golf_mesh_3').geometry===source,traffic:traffic.getObjectByName('golf_mesh_3').geometry===source,trafficKit:!!traffic.getObjectByName('custom-body-kit')};dispose(stock);
  return {check,exhaust,intact,full,r32};
 });
 for(const c of result.check){assert.equal(c.inside,0,`${c.variant}/${c.part}: factory triangles remain in replacement region`);assert.ok(c.cloned && c.sourceIntact);if(c.part==='all'||c.part==='rear')assert.ok(c.names.includes('rear-valance'));if(c.part==='all'||c.part==='front')assert.ok(c.names.includes('front-fascia'));if(c.part==='all'||c.part==='skirts')assert.equal(c.names.filter(n=>n==='side-skirt').length,2);}
 for(const f of result.full){assert.equal(f.paint,0,`${f.rear} factory paint`);assert.equal(f.trim,0,`${f.rear} factory rubbing strip`);assert.deepEqual(f.mouths,f.rear==='golf-r32'?[-.48,.48]:[]);}
 for(const e of result.r32){assert.deepEqual(e.hits,[0,0],`${e.exhaust} R32 outlets`);assert.equal(e.carbon,'custom-carbon');assert.deepEqual(e.mouths.map(x=>x[0]),[-.48,.48]);if(e.exhaust==='flame'||e.exhaust==='sport')assert.deepEqual(e.flames,e.mouths);else assert.deepEqual(e.flames,[]);}
 for(const e of result.exhaust){assert.deepEqual(e.hits,e.hits.map(()=>0),`${e.variant} exhaust cutout`);assert.equal(e.carbon,'custom-carbon');}
 assert.deepEqual(result.intact,{stock:true,traffic:true,trafficKit:false});assert.deepEqual(errors,[]);
 fs.mkdirSync('test-results',{recursive:true});await page.evaluate(()=>{const g=window.__overtake;g.toGarage();g.setLobbyPreview(false);g.garageAuto=false;g.garageWorkshop=false;g.library.setCustomization('golf',{front:'track',rear:'track',skirts:'track',exhaust:'track'});g.setSelectedCar('golf');g.garageZoom=5.6;g.garagePitch=.16;});await page.addStyleTag({content:'#topbar,#main-menu,#garage,#hud{visibility:hidden!important}'});
 for(const [name,angle] of [['rear',0],['rear-quarter',.65],['side',1.57],['front',Math.PI]]){await page.evaluate(angle=>{const g=window.__overtake;g.garageAngle=angle;g.updateCamera(0);g.composer.render()},angle);await page.screenshot({path:`test-results/golf-bodywork-${name}.png`,timeout:120000});}
 for(const rear of ['golf-r32','golf-clean'])for(const [view,angle] of [['rear',0],['rear-quarter',.65],['side',1.57]]){
  await page.evaluate(({rear,angle})=>{const g=window.__overtake;g.library.setCustomization('golf',{rear});g.setSelectedCar('golf');g.garageAngle=angle;g.updateCamera(0);g.composer.render()},{rear,angle});await page.screenshot({path:`test-results/${rear}-${view}.png`,timeout:120000});
 }
 console.log('Golf: old/new fits, six R32 exhaust layouts and flame origins, trim removal, carbon, stock/traffic isolation and views passed.');
}finally{await browser.close()}
