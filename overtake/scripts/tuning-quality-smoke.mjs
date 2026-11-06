// Expanded tuning options, Golf lamps, and procedural flames against Vite.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1100,height:760}});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://localhost:3000/?test=1',{timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.evaluate(()=>localStorage.removeItem('overtake-customization-v1'));
  await page.click('.car-card[data-car="golf"]');await page.click('#btn-customize');
  for(const part of ['front','rear','skirts','spoiler','exhaust']){
    await page.click(`[data-workshop-part="${part}"]`);
    for(const value of ['street','touring','sport','track']) assert.equal(await page.locator(`[data-part-panel="${part}"] button[data-value="${value}"]`).count(),1);
    await page.click(`[data-part-panel="${part}"] button[data-value="sport"]`);
  }
  const result=await page.evaluate(async()=>{
    const g=window.__overtake,{createBodyKit,disposeBodyKit,updateExhaustFlames}=await import('/src/body-kits.ts'),{sanitizeCustomization}=await import('/src/customization.mjs');
    cancelAnimationFrame(g.raf);
    const ids=['golf','mercedes','audi','mustang','ferrari','r8','challenger'],parts=['front','rear','skirts','spoiler','exhaust'],variants=['street','touring','sport','track'];
    const distinct=[];
    for(const id of ids)for(const part of parts){
      const signatures=[];
      for(const v of variants){const kit=createBodyKit(id,sanitizeCustomization({[part]:v}),0x808080), group=kit.getObjectByName('custom-'+part),items=[];
        group.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;let sum=0;for(let i=0;i<a.array.length;i++)sum+=a.array[i]*((i%31)+1);items.push([o.name,a.count,Math.round(sum*1000),o.position.toArray(),o.scale.toArray()]);});
        signatures.push(JSON.stringify(items));disposeBodyKit(kit);
      }
      distinct.push({id,part,count:new Set(signatures).size});
    }
    const golf=g.player;g.input.brake=false;g.updatePlayerLights(0);const off=golf.userData.indicatorState.brake.value;
    g.input.brake=true;g.updatePlayerLights(0);const on=golf.userData.indicatorState.brake.value;
    const lens=golf.getObjectByName('golf_mesh_13').material, cover=golf.getObjectByName('golf_mesh_4').material;
    const traffic=g.library.create('golf');
    const lamps={off,on,selective:lens.userData.selectiveBrake,intensity:lens.emissiveIntensity,coverTransparent:cover.transparent,trafficSelective:traffic.getObjectByName('golf_mesh_13').material.userData.selectiveBrake};
    g.library.setCustomization('ferrari',{exhaust:'flame'});g.setSelectedCar('ferrari');
    const flames=g.player.getObjectByName('exhaust-flames');updateExhaustFlames(g.player,12.5,true);g.composer.render();
    const flame={on:flames.visible,count:flames.children.length,shaders:flames.children.every(j=>j.children[0].material.isShaderMaterial),time:flames.children[0].children[0].material.uniforms.uTime.value};
    updateExhaustFlames(g.player,13,false);flame.off=flames.visible;
    return {distinct,lamps,flame};
  });
  for(const v of result.distinct) assert.equal(v.count,4,`${v.id} ${v.part} needs distinct geometry`);
  assert.deepEqual(result.lamps,{off:0,on:1,selective:true,intensity:.55,coverTransparent:true,trafficSelective:true});
  assert.deepEqual(result.flame,{on:true,count:3,shaders:true,time:12.5,off:false});
  await page.reload({timeout:180000,waitUntil:'domcontentloaded'});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.click('.car-card[data-car="golf"]');await page.click('#btn-customize');
  for(const part of ['front','rear','skirts','spoiler','exhaust'])assert.equal(await page.locator(`#custom-${part}`).inputValue(),'sport');
  assert.deepEqual(errors,[]);console.log('Tuning quality smoke passed:',result.distinct.length,'part/car combinations',result.lamps,result.flame);
} finally {await browser.close();}
