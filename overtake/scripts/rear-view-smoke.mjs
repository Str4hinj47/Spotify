// Hold-to-look behavior, simultaneous inputs, race-only proximity and touch layout.
import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const base=process.env.BASE_URL||'http://localhost:4185';
try {for(const [name,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}],['small-landscape',{width:667,height:375}],['short-landscape',{width:568,height:320}]]) {
 const page=await browser.newPage({viewport,...(name==='desktop'?{}:{isMobile:true,hasTouch:true})}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${base}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await page.click('#menu-start');
 assert.ok(await page.locator('#look-behind').isVisible());assert.equal(await page.locator('#look-behind').getAttribute('aria-pressed'),'false');
 const layout=await page.evaluate(()=>{const ids=['look-behind','signal-left','signal-right','t-left','t-brake','t-gas','t-right','contract-card','speed-cluster','env-chip','run-clock','race-map','hud-score'];return Object.fromEntries(ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return [id,{x:r.left,y:r.top,right:r.right,bottom:r.bottom,visible:getComputedStyle(e).display!=='none'}]}))});
 const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
 const rear=layout['look-behind'];assert.ok(rear.x>=0&&rear.y>=0&&rear.right<=viewport.width&&rear.bottom<=viewport.height,`${name} rear button outside viewport`);
 for(const id of ['signal-left','signal-right','t-left','t-brake','t-gas','t-right','contract-card','speed-cluster','env-chip','run-clock','race-map','hud-score'])if(layout[id].visible && await page.locator(`#${id}`).isVisible())assert.ok(!overlap(rear,layout[id]),`${name} rear button overlaps ${id}: ${JSON.stringify(layout)}`);
 if(name==='desktop') {
  for(const preset of ['close','chase','far','hood','bumper','free']) {
   const initial=await page.evaluate(preset=>{const g=window.__overtake;g.setCameraPreset(preset);if(preset==='free'){g.freeYaw=.45;g.freePitch=.2}g.updateCamera(0);return {position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),saved:localStorage.getItem('overtake-camera'),free:[g.freeYaw,g.freePitch]};},preset);
   await page.keyboard.down('r');assert.equal(await page.locator('#look-behind').getAttribute('aria-pressed'),'true');
   const view=await page.evaluate(async()=>{const g=window.__overtake,T=await import('/node_modules/three/build/three.module.js');const d=new T.Vector3();g.camera.getWorldDirection(d);return {dot:d.x*(-Math.sin(g.yaw))+d.z*(-Math.cos(g.yaw)),preset:g.getCameraSettings().preset,input:{...g.input},free:[g.freeYaw,g.freePitch]};});
   assert.ok(view.dot<-.96,`${preset}: not looking behind: ${view.dot}`);assert.equal(view.preset,preset);assert.deepEqual(view.free,initial.free);assert.equal(view.input.handbrake,false);
   await page.keyboard.up('r');assert.equal(await page.locator('#look-behind').getAttribute('aria-pressed'),'false');
   const after=await page.evaluate(()=>{const g=window.__overtake;return {position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),saved:localStorage.getItem('overtake-camera'),free:[g.freeYaw,g.freePitch]}});
   assert.deepEqual(after,initial,`${preset}: original camera was not restored`);
  }
  await page.keyboard.down('r');const button=await page.locator('#look-behind').boundingBox();await page.mouse.move(button.x+button.width/2,button.y+button.height/2);await page.mouse.down();await page.keyboard.up('r');assert.equal(await page.evaluate(()=>window.__overtake.getLookBehind()),true);await page.mouse.up();assert.equal(await page.evaluate(()=>window.__overtake.getLookBehind()),false);
  await page.mouse.move(button.x+button.width/2,button.y+button.height/2);await page.mouse.down();assert.equal(await page.evaluate(()=>window.__overtake.getLookBehind()),true);await page.locator('#look-behind').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});assert.equal(await page.evaluate(()=>window.__overtake.getLookBehind()),false);await page.mouse.up();
  await page.locator('#look-behind').focus();await page.keyboard.down('Space');assert.equal(await page.evaluate(()=>window.__overtake.getLookBehind()),true);assert.equal(await page.evaluate(()=>window.__overtake.input.handbrake),false);await page.keyboard.up('Space');assert.equal(await page.evaluate(()=>window.__overtake.getLookBehind()),false);
  await page.keyboard.down('r');await page.evaluate(()=>window.__overtake.pause());assert.equal(await page.evaluate(()=>window.__overtake.getLookBehind()),false);await page.keyboard.up('r');await page.evaluate(()=>window.__overtake.resume());assert.equal(await page.evaluate(()=>window.__overtake.getLookBehind()),false);
 }
 if(name==='phone'){
  const touch=await page.context().newCDPSession(page),rect=await page.locator('#look-behind').boundingBox(),point={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});assert.equal(await page.locator('#look-behind').getAttribute('aria-pressed'),'true');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.locator('#look-behind').getAttribute('aria-pressed'),'false');await touch.detach();
 }
 await page.evaluate(()=>{const g=window.__overtake;g.playerS=100;g.raceCountdown=0;g.circuitRivals.forEach((r,i)=>r.progress=i===0?88:-500-i*100);g.emitHud()});assert.equal(await page.locator('#rear-proximity').textContent(),'12m BACK');assert.ok(await page.locator('#look-behind').evaluate(e=>e.classList.contains('rear-near')));
 await page.keyboard.down('r');await page.evaluate(()=>{const g=window.__overtake;g.camera.updateMatrixWorld();g.composer.render()});await page.screenshot({path:`test-results/rear-view-${name}.png`,timeout:120000});await page.keyboard.up('r');
 await page.evaluate(()=>{const g=window.__overtake;g.toGarage();g.setRunMode('endless');g.start();g.emitHud()});assert.equal(await page.locator('#rear-proximity').isVisible(),false);
 assert.deepEqual(errors,[]);console.log(name,'rear view passed');await page.close();
}}finally{await browser.close()}
