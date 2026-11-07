// Snow and wet-tire spray regression against the local Vite server.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
  const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.goto('http://localhost:3000/?test=1',{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=window.__overtake;
    cancelAnimationFrame(g.raf);
    const spray=g.spray,pos=new T.Vector3(0,0,0);
    const run=(speed,wet,snow)=>{for(let i=0;i<90;i++){pos.z-=speed/60;spray.update(1/60,pos,0,1.8,4.4,speed,wet,snow,snow*.03);}};
    const summarize=()=>{const active=Array.from(spray.ages,(_,i)=>i).filter(i=>spray.ages[i]>=0);
      return {visible:spray.points.visible,count:active.length,kinds:active.reduce((a,i)=>(a[spray.kinds[i]]++,a),[0,0,0]),
        finite:active.every(i=>[...spray.positions.slice(i*3,i*3+3),spray.sizes[i],spray.opacity[i]].every(Number.isFinite)),
        minX:Math.min(...active.map(i=>spray.positions[i*3])),maxX:Math.max(...active.map(i=>spray.positions[i*3]))};};
    spray.clear();run(25,0,0);const dry=summarize();
    spray.clear();run(0,0,1);const stopped=summarize();
    spray.clear();run(25,1,0);const wet=summarize();
    spray.clear();run(25,.2,1);const snow=summarize();
    g.start();g.clearTraffic();g.trySpawn=()=>{};g.weather.snow=1;g.weather.snowCover=1;g.weather.mode='snow';g.vehicle.speed=25;g.updateDriving(0);
    g.composer.render();
    spray.clear();const cleared=summarize();
    return {dry,stopped,wet,snow,cleared};
  });
  assert.equal(result.dry.count,0);assert.equal(result.stopped.count,0);
  assert.ok(result.wet.count>0);assert.equal(result.wet.kinds[1]+result.wet.kinds[2],0);
  assert.ok(result.snow.kinds[1]>0 && result.snow.kinds[2]>0);assert.equal(result.snow.kinds[0],0);
  assert.ok(result.snow.count<=512 && result.snow.finite);assert.ok(result.snow.minX<0 && result.snow.maxX>0);
  assert.equal(result.cleared.visible,false);assert.equal(result.cleared.count,0);
  assert.deepEqual(errors,[]);console.log('Snow spray smoke passed',result);
} finally { await browser.close(); }
