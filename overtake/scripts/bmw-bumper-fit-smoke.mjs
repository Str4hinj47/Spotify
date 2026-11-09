import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${process.env.BASE_URL||'http://localhost:4190'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const result=await page.evaluate(async()=>{
  const g=window.__overtake,T=await import('/node_modules/three/build/three.module.js'),{bmwExhaustLayout}=await import('/src/bmw-exhaust.mjs');cancelAnimationFrame(g.raf);
  const out=[];
  for(const exhaust of ['stock','street','touring','sport','track','flame']) {
   g.library.setCustomization('bmw-m3',{exhaust,afterfire:true,livery:'stripe',liveryColor:'#f02222',paintScheme:'upper',secondaryColor:'#222222'});
   const c=g.library.create('bmw-m3',{player:true,paint:0x1f5fd0});c.updateMatrixWorld(true);
   const front=c.getObjectByName('bmw-street-front'),rear=c.getObjectByName('bmw-street-rear'),layout=bmwExhaustLayout(exhaust);
   const ray=(x,y)=>new T.Raycaster(new T.Vector3(x,y,4),new T.Vector3(0,0,-1)).intersectObject(rear,false).length;
   const holes=layout.centers.map(x=>ray(x,layout.y));
   const shoulders=layout.centers.map(x=>ray(x,layout.y+layout.radius*1.6));
   const mouths=[];c.traverse(o=>{if(o.name==='exhaust-mouth')mouths.push(o.getWorldPosition(new T.Vector3()).toArray())});
   const flames=c.getObjectByName('exhaust-flames');
   const geometry=[front,rear].map(m=>{const p=m.geometry.getAttribute('position'),n=m.geometry.getAttribute('normal');let valid=true;for(let i=0;i<p.count;i++)if(![p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite))valid=false;return {vertices:p.count,valid}});
   const shader={uniforms:{},vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};front.material[0].onBeforeCompile(shader);
   out.push({exhaust,holes,shoulders,mouths,expected:layout,flames:!!flames,wheels:c.userData.wheels.length,geometry,paintMatrix:shader.uniforms.kitMatrix.value.elements,pattern:shader.uniforms.kitPattern.value});
   for(const geo of c.userData.customGeometries)geo.dispose();for(const m of c.userData.customPaintMaterials)m.dispose();
  }
  const pairs=[];
  for(const cfg of [{front:'bmw-race-front'},{rear:'bmw-race-rear'},{hood:'bmw-race-hood'}]){
   g.library.setCustomization('bmw-m3',cfg);const c=g.library.create('bmw-m3',{player:true});pairs.push(['bmw-street-front','bmw-street-rear','bmw-street-hood'].map(n=>!!c.getObjectByName(n)));
  }
  const traffic=g.library.create('bmw-m3',{player:false});return {out,pairs,trafficHasPanels:!!traffic.getObjectByName('bmw-street-front')||!!traffic.getObjectByName('bmw-street-rear')};
 });
 for(const item of result.out){
  assert.ok(item.holes.every(n=>n===0),`${item.exhaust} outlets are occluded: ${item.holes}`);
  assert.ok(item.shoulders.every(n=>n>0),`${item.exhaust} bumper missing around outlets: ${item.shoulders}`);
  assert.equal(item.mouths.length,item.expected.centers.length);assert.equal(item.flames,true);assert.equal(item.wheels,4);
  for(let i=0;i<item.mouths.length;i++)for(const [j,want] of [item.expected.centers[i],item.expected.y,item.expected.mouthZ].entries())assert.ok(Math.abs(item.mouths[i][j]-want)<.001,`${item.exhaust} mouth ${i} coordinate ${j}`);
  assert.ok(item.geometry.every(g=>g.valid&&g.vertices>1000));assert.equal(item.pattern,1);assert.deepEqual(item.paintMatrix,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 }
 assert.deepEqual(result.pairs,[[false,true,true],[true,false,true],[true,true,false]]);assert.equal(result.trafficHasPanels,false);assert.deepEqual(errors,[]);
 console.log('BMW bumper fit, exhaust openings, flames, paint and independent race parts passed.');
} finally {await browser.close()}
