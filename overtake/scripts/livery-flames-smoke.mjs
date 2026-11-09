import { seedEconomy } from './seed-economy.mjs';
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())}); page.on('pageerror',e=>errors.push(String(e)));
  await seedEconomy(page);
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`); await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.click('#menu-garage');
  await page.click('.car-card[data-car="golf"]');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
  await page.click('[data-workshop-tab="paint"]');
  await page.selectOption('#custom-paint-scheme','upper',{force:true});
  await page.selectOption('#custom-secondary-finish','carbon',{force:true});
  await page.selectOption('#custom-livery','race',{force:true});await page.locator('#custom-livery-color').fill('#ffcf20');
  for(const part of ['front','rear','skirts','spoiler','exhaust']) {
    await page.selectOption(`#custom-${part}`,part==='exhaust'?'flame':'track',{force:true});
    await page.selectOption(`#custom-${part}-finish`,'carbon',{force:true});
  }
  await page.click('[data-custom-view="rear"]');
  const state=await page.evaluate(()=>{
    const g=window.__overtake, kit=g.player.getObjectByName('custom-body-kit'), saved=JSON.parse(localStorage.getItem('overtake-customization-v1')).golf;
    const carbon=[];kit.traverse(x=>{if(x.isMesh && x.material?.name==='custom-carbon')carbon.push(x.name)});
    return {saved,carbon,paintMaterials:g.player.userData.customPaintMaterials.length,flameCount:kit.getObjectByName('exhaust-flames').children.length};
  });
  assert.equal(state.saved.livery,'race');assert.equal(state.saved.liveryColor,'#ffcf20');assert.equal(state.saved.exhaust,'flame');
  for(const p of ['front','rear','skirts','spoiler','exhaust'])assert.equal(state.saved[`${p}Finish`],'carbon');
  assert.ok(state.carbon.includes('front-fascia')&&state.carbon.includes('rear-valance')&&state.carbon.includes('side-skirt')&&state.carbon.includes('roof-extension'));
  assert.ok(state.paintMaterials>0);assert.equal(state.flameCount,2);
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/paint-workshop.png',timeout:120000});
  await page.click('#custom-done');await page.click('#btn-start');await page.click('#menu-start');
  const drive = await page.evaluate(()=>{
    const g=window.__overtake; cancelAnimationFrame(g.raf);g.clearTraffic();g.trySpawn=()=>{};
    g.vehicle.speed=18; g.input.throttle=true; g.input.brake=false;g.updateDriving(0);g.loop();cancelAnimationFrame(g.raf);
    const on=g.player.getObjectByName('exhaust-flames').visible;
    g.input.throttle=false;g.loop();cancelAnimationFrame(g.raf);
    const off=g.player.getObjectByName('exhaust-flames').visible;
    g.input.throttle=true;g.input.brake=true;g.loop();cancelAnimationFrame(g.raf);
    return {on,off,braking:g.player.getObjectByName('exhaust-flames').visible};
  });
  assert.deepEqual(drive,{on:true,off:false,braking:false});
  // Validate each car and ensure the original traffic clone stays unmodified.
  const all=await page.evaluate(()=>{
    const g=window.__overtake;const out=[];
    for(const id of ['golf','mercedes','audi','mustang','ferrari','r8','challenger']) {
      g.library.setCustomization(id,{front:'track',rear:'track',skirts:'track',spoiler:'track',exhaust:'flame',frontFinish:'carbon',rearFinish:'carbon',skirtsFinish:'carbon',spoilerFinish:'carbon',exhaustFinish:'carbon',paintScheme:'lower',secondaryFinish:'carbon',livery:'race',liveryColor:'#ffee11'});
      g.setSelectedCar(id);const flames=g.player.getObjectByName('exhaust-flames');const traffic=g.library.create(id);
      g.player.updateMatrixWorld(true);traffic.updateMatrixWorld(true);
      const mouths=[];g.player.traverse(o=>{if(o.name==='exhaust-mouth')mouths.push(o.getWorldPosition(o.position.clone()).toArray())});
      const jets=flames.children.map(j=>j.getWorldPosition(j.position.clone()).toArray());
      const glass=[];traffic.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]) if(m.name.startsWith('glass__')&&!m.name.endsWith('__lamp_lens')) glass.push({opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite});});
      const spoiler=g.player.getObjectByName('custom-spoiler');
      out.push({id,jets:jets.length,mouths,jetsWorld:jets,glass,roof:!!spoiler.getObjectByName('roof-extension'),pedestals:spoiler.children.filter(o=>o.name==='wing-pedestal').length,paint:g.player.userData.customPaintMaterials.length,traffic:traffic.getObjectByName('custom-body-kit')!==undefined});
      g.composer.render();
    }
    return out;
  });
  assert.equal(all.length,7);for(const x of all){
    assert.ok(x.jets>=2&&x.paint>0);assert.equal(x.traffic,false);
    assert.equal(x.jets,x.mouths.length,`${x.id} mouths`);
    for(let i=0;i<x.jets;i++) assert.ok(x.jetsWorld[i].every((v,j)=>Math.abs(v-x.mouths[i][j])<1e-6),`${x.id} flame ${i} must start at its pipe mouth`);
    assert.ok(x.glass.length>0);for(const glass of x.glass) assert.deepEqual(glass,{opacity:1,transparent:false,depthWrite:true});
    if(x.id==='golf'||x.id==='audi'){assert.equal(x.roof,true);assert.equal(x.pedestals,0);}
  }
  await page.reload({timeout:180000,waitUntil:'domcontentloaded'});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.click('#menu-garage');await page.click('.car-card[data-car="golf"]');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');
  assert.equal(await page.locator('#custom-livery').inputValue(),'race');assert.equal(await page.locator('#custom-exhaust').inputValue(),'flame');
  assert.equal(await page.locator('#custom-secondary-finish').inputValue(),'carbon');assert.equal(await page.locator('#custom-front-finish').inputValue(),'carbon');
  await page.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(String(e)));
  await seedEconomy(mobile);
  await mobile.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`,{timeout:180000,waitUntil:'domcontentloaded'});
  await mobile.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await mobile.click('#menu-garage');await mobile.click('[data-garage-tab=style]');await mobile.click('#btn-customize');
  assert.equal(await mobile.locator('#custom-front-finish').isDisabled(),true);
  await mobile.selectOption('#custom-front','street',{force:true});await mobile.selectOption('#custom-front-finish','carbon',{force:true});
  await mobile.click('[data-workshop-tab="paint"]');
  await mobile.locator('#custom-primary-color').fill('#da3366');await mobile.selectOption('#custom-paint-scheme','lower',{force:true});
  await mobile.locator('#custom-secondary-color').fill('#26b3a0');await mobile.selectOption('#custom-livery','stripe',{force:true});
  const mobileState=await mobile.evaluate(()=>({primary:document.querySelector('#custom-primary-color').value,
    secondary:document.querySelector('#custom-secondary-color').value,layout:document.querySelector('#custom-paint-scheme').value,
    livery:document.querySelector('#custom-livery').value,finish:document.querySelector('#custom-front-finish').value,
    overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.deepEqual(mobileState,{primary:'#da3366',secondary:'#26b3a0',layout:'lower',livery:'stripe',finish:'carbon',overflow:false});
  await mobile.screenshot({path:'test-results/paint-mobile.png',timeout:120000});await mobile.close();
  assert.deepEqual(errors,[]);console.log({state,drive,all,mobileState,errors});
} finally {await browser.close();}
