// Check that front signals remain visible with the largest body-kit option.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser = await pw.launch({executablePath: await chromium.executablePath(), headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env: {...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}`}});
const errors = [];
try {
 const page = await browser.newPage({viewport:{width:800,height:600}});
 page.on('pageerror', e => errors.push(String(e)));
 page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
 await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 for (const id of ['golf','mercedes','audi','mustang','ferrari','r8','challenger']) {
  const result = await page.evaluate(async id => {
   const g=window.__overtake; cancelAnimationFrame(g.raf); g.garageAuto=false;
   g.library.setCustomization(id,{front:'track',paintScheme:'upper',livery:'race'});
   g.setSelectedCar(id); g.garageAngle=Math.PI; g.garageZoom=5.7;g.garagePitch=.24;g.updateCamera(0);g.updateIndicatorView();
   const state=g.player.userData.indicatorState;
   const render=value=>{state.left.value=value;g.composer.render();return g.renderer.domElement.toDataURL();};
   const urls=[render(0),render(1)];
   const imgs=await Promise.all(urls.map(url=>new Promise(resolve=>{const image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);resolve(ctx.getImageData(0,0,800,600).data)};image.src=url;})));
   let lhs=0,rhs=0;for(let i=0;i<imgs[0].length;i+=4){const d=Math.abs(imgs[0][i]-imgs[1][i])+Math.abs(imgs[0][i+1]-imgs[1][i+1])+Math.abs(imgs[0][i+2]-imgs[1][i+2]);if(d>35){if((i/4)%800<400)lhs++;else rhs++;}}
   return {lhs,rhs};
  },id);
  assert.ok(result.rhs>20 && result.lhs<result.rhs*.05+4,`${id}: ${JSON.stringify(result)}`);
  console.log(id,result);
 }
 assert.deepEqual(errors,[]);
} finally {await browser.close();}
