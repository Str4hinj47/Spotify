// Fitted W222 replacements: clone isolation, seam clipping, UI persistence and views.
import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(!sessionStorage.getItem('audi-seed')){localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,dev:false,owned:['golf','audi'],credits:0,gems:1000,upgrades:{},tunes:{}}));sessionStorage.setItem('audi-seed','1')}});
 await page.goto(`${process.env.BASE_URL||'http://localhost:4186'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
 const out=await page.evaluate(async()=>{
  const g=window.__overtake,T=await import('/node_modules/three/build/three.module.js');
  const cfg={front:'audi-splitter',rear:'audi-diffuser',skirts:'audi-wide',afterfire:true};g.library.setCustomization('audi',cfg);
  const start=performance.now(),player=g.library.create('audi',{player:true}),ms=performance.now()-start,traffic=g.library.create('audi');player.updateMatrixWorld(true);
  const before=traffic.getObjectByName('audi_mesh_10').geometry,after=player.getObjectByName('audi_mesh_10').geometry,inv=player.matrixWorld.clone().invert();
  let overlap=0;const mat=inv.multiply(player.getObjectByName('audi_mesh_10').matrixWorld),p=after.attributes.position,v=new T.Vector3();
  for(let i=0;i<p.count;i+=3){const q=new T.Vector3();for(let j=0;j<3;j++)q.add(v.fromBufferAttribute(p,i+j).applyMatrix4(mat));q.multiplyScalar(1/3);if(q.y<.43-1e-5&&q.z< -2.05-1e-5||q.y<.47-1e-5&&Math.abs(q.x)<.54-1e-5&&q.z>2.05+1e-5||q.y<.37-1e-5&&q.z> -1.10+1e-5&&q.z<.96-1e-5&&Math.abs(q.x)>.82+1e-5)overlap++;}
  let fitted=0,arches=0,spikes=0,splitters=0;player.traverse(o=>{if(o.name.startsWith('audi-fitted-'))fitted++;if(o.name==='wheel-arch-flare')arches++;if(o.name==='skirt-spike')spikes++;if(o.name==='front-splitter')splitters++;});
  return {ms,overlap,fitted,arches,spikes,splitters,sourceUntouched:before!==after&&before===g.library.get('audi').scene.getObjectByName('audi_mesh_10').geometry,wheels:player.userData.wheels.length};
 });
 assert.equal(out.overlap,0);assert.ok(out.fitted>=3);assert.equal(out.arches,4);assert.equal(out.spikes,10);assert.equal(out.splitters,1);assert.equal(out.sourceUntouched,true);assert.equal(out.wheels,4);
 await page.click('#menu-garage');while(!await page.locator('[data-car=audi]').isVisible())await page.click('#car-next');await page.click('[data-car=audi]');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
 for(const [part,value] of [['front','audi-splitter'],['rear','audi-diffuser'],['skirts','audi-wide']]) {await page.click(`[data-workshop-part=${part}]`);const card=page.locator(`[data-part-panel=${part}] .workshop-card[data-value=${value}]`);while(!await card.isVisible())await page.locator(`[data-part-panel=${part}] .workshop-card-pager button[aria-label^="Next"]`).click();await card.click();}
 for(const view of ['front','rear','side']) {await page.click(`[data-custom-view=${view}]`);await page.evaluate(()=>window.__overtake.composer.render());await page.screenshot({path:`test-results/audi-fitted-${view}.png`});}
 await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-customization-v1')).audi);assert.equal(saved.front,'audi-splitter');assert.equal(saved.rear,'audi-diffuser');assert.equal(saved.skirts,'audi-wide');assert.deepEqual(errors,[]);console.log('Audi fitted bodywork, mesh isolation and persistence passed',out);
}finally{await browser.close()}
