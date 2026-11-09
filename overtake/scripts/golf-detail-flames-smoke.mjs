import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(`${process.env.BASE_URL||'http://localhost:4190'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
 const data=await page.evaluate(async()=>{
  const g=window.__overtake,T=await import('/node_modules/three/build/three.module.js'),{updateExhaustFlames}=await import('/src/body-kits.ts');cancelAnimationFrame(g.raf);g.toGarage();g.setLobbyPreview(false);g.garageAuto=false;g.garageWorkshop=false;
  const ready=async t=>{for(let i=0;i<100;i++){if(t.image?.complete&&t.image.naturalWidth)return;await new Promise(r=>setTimeout(r,100));}throw new Error('texture failed to load')};
  g.library.setCustomization('golf',{front:'golf-splitter',exhaust:'sport',afterfire:true,livery:'flames',liveryColor:'#ff2200'});g.setSelectedCar('golf');
  const cover=g.player.getObjectByName('golf-filled-front-grille'),p=cover.geometry.attributes.position;let range=[Infinity,-Infinity];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),t=(y-.205)/.2;const base=-2.04+.47*x*x-.24*(y-.34);if(Math.abs(x)<.58&&t>.1&&t<.9){const d=p.getZ(i)-base;range[0]=Math.min(range[0],d);range[1]=Math.max(range[1],d)}}
  const group=g.player.getObjectByName('exhaust-flames'),mat=group.userData.flameMaterials[0];await ready(mat.uniforms.uFlame.value);
  g.garageAngle=.30*Math.PI;g.garagePitch=.16;g.garageZoom=5;g.updateCamera(0);g.composer.render();
  const gl=g.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const pixels=()=>{g.composer.render();const buf=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);return buf};
  const frames=[];for(const time of [1,1.04,1.08,1.12,1.16]){updateExhaustFlames(g.player,time,true);frames.push(pixels())}
  const diff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)n++;return n};
  const motion=frames.slice(1).map((f,i)=>diff(frames[i],f));
  updateExhaustFlames(g.player,2,false);const off=group.visible;
  g.garageAngle=Math.PI/2;g.updateCamera(0);g.composer.render();
  const paint=g.player.userData.customPaintMaterials.find(m=>m.name==='custom-paint-golf');let shader;
  // Wait for the shared decal texture created on first render.
  paint.onBeforeCompile(shader={uniforms:{},vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'});await ready(shader.uniforms.kitFlameDecal.value);
  const red=pixels();g.library.setCustomization('golf',{front:'golf-splitter',exhaust:'sport',afterfire:true,livery:'flames',liveryColor:'#0099ff'});g.setSelectedCar('golf');updateExhaustFlames(g.player,2,false);g.updateCamera(0);const blue=pixels();
  g.library.setCustomization('golf',{front:'golf-splitter',exhaust:'sport',afterfire:true,livery:'none'});g.setSelectedCar('golf');updateExhaustFlames(g.player,2,false);g.updateCamera(0);const stock=pixels();
  return {range,motion,off,flameSize:[mat.uniforms.uFlame.value.image.width,mat.uniforms.uFlame.value.image.height],decalSize:[shader.uniforms.kitFlameDecal.value.image.width,shader.uniforms.kitFlameDecal.value.image.height],colorDiff:diff(red,blue),stockDiff:diff(blue,stock),crossfade:mat.fragmentShader.includes('mix(frame(a,uv),frame(b,uv)')};
 });
 assert.ok(data.range[1]-data.range[0]>.045,'front fascia must contain moulded relief');assert.deepEqual(data.flameSize,[640,640]);assert.deepEqual(data.decalSize,[800,256]);assert.ok(data.crossfade);assert.ok(data.motion.every(n=>n>5),`continuous flame frames: ${data.motion}`);assert.equal(data.off,false);assert.ok(data.colorDiff>500&&data.stockDiff>500,`decal renders and tints: ${data.colorDiff}/${data.stockDiff}`);assert.deepEqual(errors,[]);console.log('Golf fascia relief, 25-frame cross-faded fire, CC0 livery texture and tint:',data);
} finally {await browser.close()}
