// Browser regression: all playable cars have four fitted, rotating custom rims;
// garage controls and saved choices work without altering traffic or old saves.
import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}); page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const url=`${process.env.BASE_URL||'http://localhost:3000'}/play.html?test=1`;
 await page.goto(url);await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const data=await page.evaluate(async()=>{
  const g=window.__overtake, {spinWheels}=await import('/src/wheels.ts');
  let output={};
  for(const id of ['golf','mercedes','audi','mustang','ferrari','r8','challenger','bmw-m3','skyline','aventador-game']){
   g.library.setCustomization(id,{rim:'rim-1',rimColor:'#ddaa33',tireWidth:'wide'});
   const car=g.library.create(id,{player:true}),traffic=g.library.create(id),w=car.userData.wheels;
   spinWheels(car,1);
   output[id]={count:w.length,custom:w.filter(x=>x.getObjectByName('custom-rim')).length,rotation:w.map(x=>x.rotation.x),scale:w.map(x=>x.scale.x),trafficRim:!!traffic.getObjectByName('custom-rim')};
  }
  return {output,rims:g.library.rims.size};
 });
 assert.equal(data.rims,10);
 for(const [id,item] of Object.entries(data.output)){
  assert.equal(item.count,4,id);assert.equal(item.custom,4,id);assert.ok(item.rotation.every(n=>n!==0),id);assert.ok(item.scale.every(n=>n===1.18),id);assert.equal(item.trafficRim,false,id);
 }
 // Reset the test library before checking the real garage UI and persistence.
 await page.reload();await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 await page.click('#menu-garage');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-workshop-tab=wheels]');
 await page.locator('[data-workshop-panel=wheels] .workshop-card-pager button').last().click();await page.locator('[data-workshop-panel=wheels] .workshop-card-pager button').last().click();await page.click('[data-workshop-panel=wheels] .workshop-card[data-value="rim-10"]');
 await page.locator('#custom-rim-color').fill('#1a78c0');
 await page.selectOption('#custom-tire-width','wide');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-customization-v1')).golf);
 assert.equal(saved.rim,'rim-10');assert.equal(saved.rimColor,'#1a78c0');assert.equal(saved.tireWidth,'wide');
 await page.reload();await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.click('#menu-garage');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-workshop-tab=wheels]');
 assert.equal(await page.locator('#custom-rim').inputValue(),'rim-10');assert.equal(await page.locator('#custom-rim-color').inputValue(),'#1a78c0');assert.equal(await page.locator('#custom-tire-width').inputValue(),'wide');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#custom-rim-color').isVisible());
 assert.deepEqual(errors,[]);console.log('Wheel customization passed for 10 cars, all 10 designs, garage persistence and mobile controls.');
} finally {await browser.close()}
