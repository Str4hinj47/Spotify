import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { seedEconomy } from './seed-economy.mjs';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));await seedEconomy(page);
 await page.goto(`${process.env.BASE_URL||'http://localhost:4185'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const data=await page.evaluate(async()=>{
  const g=window.__overtake,T=await import('/node_modules/three/build/three.module.js'),{spinWheels}=await import('/src/wheels.ts'),{updateExhaustFlames,disposeBodyKit}=await import('/src/body-kits.ts');cancelAnimationFrame(g.raf);
  const mk=config=>{g.library.setCustomization('golf',config);const c=g.library.create('golf',{player:true});c.updateMatrixWorld(true);return c};
  const dispose=c=>{const kit=c.getObjectByName('custom-body-kit');if(kit)disposeBodyKit(kit);for(const geo of c.userData.customGeometries)geo.dispose()};
  const quad=[];
  for(const rear of ['stock','street','track','golf-r32','golf-clean','golf-diffuser']) {
   const c=mk({rear,exhaust:'golf-quad-flame',flameColor:'#00aaff'}),panel=c.getObjectByName('rear-valance'),group=c.getObjectByName('exhaust-flames');
   const centers=[-.57,-.47,.47,.57],holes=centers.map(x=>new T.Raycaster(new T.Vector3(x,.29,2.4),new T.Vector3(0,0,-1)).intersectObject(panel).length);
   const mouths=[];c.getObjectByName('custom-exhaust').traverse(o=>{if(o.name==='exhaust-mouth')mouths.push(o.position.toArray())});
   const lights=group.children.map(o=>o.position.toArray());const first=group.children[0].children[0],material=first.material,extent=new T.Box3().setFromObject(first).getSize(new T.Vector3()).length();
   updateExhaustFlames(c,12,true);const on=group.visible;updateExhaustFlames(c,13,false);
   quad.push({rear,holes,mouths,lights,extent,color:material.uniforms.uFlameColor.value.getHexString(),sprite:!!material.uniforms.uFlame.value,on,off:group.visible});dispose(c);
  }
  function bounds(part,config){const c=mk(config),o=c.getObjectByName(part),b=new T.Box3().setFromObject(o);const result={min:b.min.toArray(),max:b.max.toArray()};dispose(c);return result}
  const front=bounds('front-fascia',{front:'golf-wide'}),normalFront=bounds('front-fascia',{front:'track'});
  const k=mk({spoiler:'golf-wing',rear:'golf-diffuser',hood:'golf-vented',roof:'golf-roof-scoop',headlights:'halo',mirrors:'sport'}),kit=k.getObjectByName('custom-body-kit');let counts={};kit.traverse(o=>{if(o.isMesh)counts[o.name]=(counts[o.name]||0)+1});const wing=new T.Box3().setFromObject(k.getObjectByName('wing-blade'));const mirrors=[];
  for(const name of ['golf_mesh','golf_mesh_3','golf_mesh_7']) {const m=k.getObjectByName(name),a=m.geometry.attributes.position,idx=m.geometry.index,mat=new T.Matrix4().copy(k.matrixWorld).invert().multiply(m.matrixWorld),v=new T.Vector3();let inside=0;for(let i=0;i<(idx?idx.count:a.count);i+=3){let q=new T.Vector3();for(let j=0;j<3;j++)q.add(v.fromBufferAttribute(a,idx?idx.getX(i+j):i+j).applyMatrix4(mat));q.multiplyScalar(1/3);if(Math.abs(q.x)>.805&&q.y>.86&&q.y<1.07&&q.z>-.64&&q.z<-.30)inside++;}mirrors.push(inside)}dispose(k);
  const profiles=[];
  for(const profile of ['low','standard','thick']) {
   const c=mk({rim:'rim-1',tireProfile:profile}),pivot=c.userData.wheels[0],tire=pivot.children.find(o=>o.name==='golf_mesh_12_rotating_0'),a=tire.geometry.attributes.position,idx=tire.geometry.index,mat=new T.Matrix4().copy(pivot.matrixWorld).invert().multiply(tire.matrixWorld),v=new T.Vector3();let min=Infinity,max=0;for(let i=0;i<idx.count;i++){v.fromBufferAttribute(a,idx.getX(i)).applyMatrix4(mat);const r=Math.hypot(v.y,v.z);min=Math.min(min,r);max=Math.max(max,r)}
   const rim=pivot.getObjectByName('custom-rim'),radius=rim.scale.x;spinWheels(c,1);c.updateMatrixWorld(true);const axis=new T.Vector3(0,0,1).applyQuaternion(rim.getWorldQuaternion(new T.Quaternion()));
   profiles.push({profile,min,max,radius,axis:axis.toArray(),brakeVisible:c.getObjectByName('golf_mesh_9').visible});dispose(c);
  }
  return {quad,front,normalFront,counts,wing:wing.max.toArray(),mirrors,profiles};
 });
 for(const q of data.quad){assert.deepEqual(q.holes,[0,0,0,0],`${q.rear} quad cutouts`);assert.deepEqual(q.mouths,q.lights);assert.equal(q.color,'00aaff');assert.equal(q.sprite,true);assert.ok(q.extent>.57);assert.equal(q.on,true);assert.equal(q.off,false);}
 assert.ok(data.front.min[2]<data.normalFront.min[2]-.08,'extended front must project outward');
 assert.equal(data.counts['wing-pedestal'],2);assert.equal(data.counts['wing-endplate'],2);assert.equal(data.counts['diffuser-fin'],7);assert.equal(data.counts['headlight-halo'],2);assert.equal(data.counts['mirror-housing'],2);assert.ok(data.wing[1]>1.65);assert.deepEqual(data.mirrors,[0,0,0]);
 const [low,standard,thick]=data.profiles;assert.ok(low.min>standard.min && standard.min>thick.min);assert.ok(low.radius>standard.radius && standard.radius>thick.radius);assert.ok(Math.abs(low.max-standard.max)<.002 && Math.abs(thick.max-standard.max)<.002);
 for(const w of data.profiles){assert.ok(Math.abs(w.axis[0])>.999 && Math.abs(w.axis[1])<.001 && Math.abs(w.axis[2])<.001,`rim axle tilted: ${w.axis}`);assert.equal(w.brakeVisible,false)}
 // Exercise the actual workshop controls, then reload the local save.
 await page.click('#menu-garage');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
 for(const [part,value] of [['front','golf-wide'],['rear','golf-diffuser'],['spoiler','golf-wing'],['exhaust','golf-quad-flame'],['hood','golf-vented'],['roof','golf-roof-scoop']])await page.selectOption(`#custom-${part}`,value,{force:true});
 await page.click('[data-workshop-part=exhaust]');await page.locator('#custom-flame-color').fill('#00aaff');await page.click('[data-workshop-tab=wheels]');await page.selectOption('#custom-tire-profile','thick');await page.click('[data-workshop-tab=lighting]');await page.selectOption('#custom-headlights','halo');await page.selectOption('#custom-mirrors','sport');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-customization-v1')).golf);for(const [key,val] of Object.entries({front:'golf-wide',rear:'golf-diffuser',spoiler:'golf-wing',exhaust:'golf-quad-flame',hood:'golf-vented',roof:'golf-roof-scoop',headlights:'halo',mirrors:'sport',tireProfile:'thick',flameColor:'#00aaff'}))assert.equal(saved[key],val,key);
 await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await page.click('#menu-garage');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');assert.equal(await page.locator('#custom-exhaust').inputValue(),'golf-quad-flame');assert.equal(await page.locator('#custom-flame-color').inputValue(),'#00aaff');
 await page.setViewportSize({width:390,height:844});await page.click('[data-workshop-tab=wheels]');assert.equal(await page.locator('#custom-tire-profile').inputValue(),'thick');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.click('[data-workshop-tab=lighting]');assert.equal(await page.locator('#custom-headlights').inputValue(),'halo');assert.equal(await page.locator('#custom-mirrors').inputValue(),'sport');assert.deepEqual(errors,[]);
 console.log('Golf expansion: six rear/quad combinations, flame colors, extended front, aero, mirrors, aligned wheels, sidewalls and saved mobile/desktop controls passed.');
}finally{await browser.close()}
