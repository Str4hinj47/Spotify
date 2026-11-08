// Measure stock player body meshes and wheel pivots in normalized car space.
// Usage: BASE_URL=http://localhost:4186 node scripts/audit-bodywork-meshes.mjs
// Output is a local test artifact, not a replacement for visual fit checks.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4186'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const report=await page.evaluate(async()=>{
  const game=window.__overtake, THREE=await import('/node_modules/three/build/three.module.js'), {CARS}=await import('/src/catalog.ts');
  cancelAnimationFrame(game.raf);
  const result={};
  for(const {id} of CARS){
   const car=game.library.create(id,{player:false});car.updateMatrixWorld(true);const inverse=car.matrixWorld.clone().invert(),meshes=[];
   car.traverse(object=>{
    if(!object.isMesh || !object.geometry.attributes.position)return;
    for(let parent=object.parent;parent&&parent!==car;parent=parent.parent)if(parent.name.startsWith('wheel_pivot_'))return;
    const material=Array.isArray(object.material)?object.material.map(m=>m.name):[object.material.name];
    if(!material.some(m=>/^(paint|trim|chrome|carbon|photo|headlight|taillight|glass)__/.test(m)))return;
    const position=object.geometry.attributes.position, transform=inverse.clone().multiply(object.matrixWorld), box=new THREE.Box3(),v=new THREE.Vector3();
    for(let i=0;i<position.count;i++)box.expandByPoint(v.fromBufferAttribute(position,i).applyMatrix4(transform));
    const round=n=>Math.round(n*1000)/1000;
    meshes.push({name:object.name,material,vertices:position.count,min:box.min.toArray().map(round),max:box.max.toArray().map(round)});
   });
   const wheels=car.userData.wheels.map(w=>({center:w.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse).toArray().map(n=>Math.round(n*1000)/1000),radius:w.userData.wheelRadius,halfWidth:w.userData.wheelHalfWidth}));
   result[id]={meshes,wheels};
  }
  return result;
 });
 if(errors.length)throw new Error(errors.join('\n'));
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/bodywork-mesh-audit.json',JSON.stringify(report,null,2));
 console.log(`Measured ${Object.keys(report).length} cars; output: test-results/bodywork-mesh-audit.json`);
}finally{await browser.close()}
