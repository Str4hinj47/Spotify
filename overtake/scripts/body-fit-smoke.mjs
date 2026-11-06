// Regression coverage for factory-part replacement and mesh-fitted workshop parts.
// Run against the local Vite server.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://localhost:3000/?test=1',{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=window.__overtake;
    cancelAnimationFrame(g.raf);
    const make=(id,cfg)=>{g.library.setCustomization(id,cfg);const c=g.library.create(id,{player:true});c.updateMatrixWorld(true);return c;};
    const stock=make('mustang',{spoiler:'stock'}),street=make('mustang',{spoiler:'street'}),track=make('mustang',{spoiler:'track'}),traffic=g.library.create('mustang');
    const counts=c=>['mustang_mesh_1','mustang_mesh_5'].map(n=>c.getObjectByName(n).geometry.index.count);
    const mustang={stock:counts(stock),street:counts(street),track:counts(track),traffic:counts(traffic),
      owned:track.userData.customGeometries.length,louvers:track.getObjectByName('mustang_mesh_1').visible,
      customStreet:!!street.getObjectByName('deck-lip'),customTrack:!!track.getObjectByName('wing-blade')};
    const mustangFlame=make('mustang',{exhaust:'flame'}), mustangReplacement=make('mustang',{exhaust:'track'});
    const mustangOutlet=mustangFlame.getObjectByName('mustang_mesh_9'), mustangMarkers=[], mustangJets=[];
    mustangFlame.getObjectByName('custom-exhaust').traverse(o=>{if(o.name==='exhaust-mouth')mustangMarkers.push(o.getWorldPosition(new T.Vector3()).toArray());});
    mustangFlame.getObjectByName('exhaust-flames').children.forEach(o=>mustangJets.push(o.getWorldPosition(new T.Vector3()).toArray()));
    const mustangVertices=mustangOutlet.geometry.attributes.position, mv=new T.Vector3(), mustangNearest=[];
    for(const marker of mustangMarkers){let best=Infinity;for(let i=0;i<mustangVertices.count;i++){mv.fromBufferAttribute(mustangVertices,i).applyMatrix4(mustangOutlet.matrixWorld);best=Math.min(best,Math.hypot(mv.x-marker[0],mv.y-marker[1],mv.z-marker[2]));}mustangNearest.push(best);}
    const mustangExhaust={visible:mustangOutlet.visible,replacement:mustangReplacement.getObjectByName('mustang_mesh_9').visible,traffic:traffic.getObjectByName('mustang_mesh_9').visible,markers:mustangMarkers,jets:mustangJets,nearest:mustangNearest};
    const plateMeshes=[];g.library.create('ferrari').traverse(o=>{if(o.isMesh && o.material.name?.startsWith('plate__'))plateMeshes.push(o.visible)});
    const challengerStock=make('challenger',{spoiler:'stock'}),challengerCustom=make('challenger',{spoiler:'track'}),challengerTraffic=g.library.create('challenger');
    const challenger={stock:challengerStock.getObjectByName('Cube001_Cube003').visible,custom:challengerCustom.getObjectByName('Cube001_Cube003').visible,traffic:challengerTraffic.getObjectByName('Cube001_Cube003').visible};
    const ferrari=make('ferrari',{exhaust:'flame',exhaustFinish:'carbon'}),factory=ferrari.getObjectByName('ferrari_mesh_23');
    const kit=ferrari.getObjectByName('custom-exhaust'),markers=[],jets=[];
    kit.traverse(o=>{if(o.name==='exhaust-mouth')markers.push(o.getWorldPosition(new T.Vector3()).toArray());});
    for(const o of ferrari.getObjectByName('exhaust-flames').children)jets.push(o.getWorldPosition(new T.Vector3()).toArray());
    const verts=factory.geometry.getAttribute('position'),v=new T.Vector3(),nearest=[];
    for(const m of markers){let best=Infinity;for(let i=0;i<verts.count;i++){v.fromBufferAttribute(verts,i).applyMatrix4(factory.matrixWorld);best=Math.min(best,Math.hypot(v.x-m[0],v.y-m[1],v.z-m[2]));}nearest.push(best);}
    const ferrariResult={visible:factory.visible,material:factory.material.name,markers,jets,nearest,pipes:kit.children.filter(o=>o.name==='exhaust-pipe').length};
    const skirts=[];
    for(const id of ['golf','mercedes','audi','mustang','ferrari','r8','challenger']) {
      const c=make(id,{skirts:'track'});let front=-Infinity,rear=Infinity,meshCount=0,extensions=[];
      c.traverse(m=>{if(!m.isMesh)return;const mats=Array.isArray(m.material)?m.material:[m.material];
        if(mats.some(x=>x.name.startsWith('tire__'))) {const a=m.geometry.getAttribute('position');for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);if(v.z<0)front=Math.max(front,v.z);else rear=Math.min(rear,v.z);}}
        if(m.name==='side-skirt'){meshCount++;const a=m.geometry.getAttribute('position');let min=Infinity,max=-Infinity;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);min=Math.min(min,v.z);max=Math.max(max,v.z);}extensions.push([min,max]);}
      });
      skirts.push({id,front,rear,meshCount,extensions});
    }
    return {mustang,mustangExhaust,plateMeshes,challenger,ferrari:ferrariResult,skirts};
  });
  const {mustang,mustangExhaust,plateMeshes,challenger,ferrari,skirts}=result;
  assert.deepEqual(plateMeshes,[false,false]);
  assert.equal(mustangExhaust.visible,true);assert.equal(mustangExhaust.replacement,false);assert.equal(mustangExhaust.traffic,true);assert.equal(mustangExhaust.markers.length,4);
  for(let i=0;i<4;i++){assert.ok(mustangExhaust.nearest[i]<.05,`Mustang outlet ${i} is not on stock exhaust: ${mustangExhaust.nearest[i]}`);assert.ok(mustangExhaust.markers[i].every((v,j)=>Math.abs(v-mustangExhaust.jets[i][j])<1e-6));}
  assert.deepEqual(challenger,{stock:true,custom:false,traffic:true});
  for(let i=0;i<2;i++){assert.ok(mustang.street[i]<mustang.stock[i]);assert.equal(mustang.track[i],mustang.street[i]);assert.equal(mustang.traffic[i],mustang.stock[i]);assert.ok(mustang.street[i]>0);}
  assert.equal(mustang.owned,2);assert.equal(mustang.louvers,true);assert.equal(mustang.customStreet,true);assert.equal(mustang.customTrack,true);
  assert.equal(ferrari.visible,true);assert.equal(ferrari.material,'custom-carbon');assert.equal(ferrari.pipes,0);assert.equal(ferrari.markers.length,3);
  for(let i=0;i<3;i++){assert.ok(ferrari.nearest[i]<.045,`Ferrari outlet ${i} is not on stock exhaust`);assert.ok(ferrari.markers[i].every((v,j)=>Math.abs(v-ferrari.jets[i][j])<1e-6));}
  for(const s of skirts){assert.equal(s.meshCount,2);for(const [min,max] of s.extensions){assert.ok(min>s.front,`${s.id} skirt overlaps front tire`);assert.ok(max<s.rear,`${s.id} skirt overlaps rear tire`);}}
  assert.deepEqual(errors,[]);console.log(result);
} finally {await browser.close();}
