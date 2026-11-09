// Browser integration for the shared performance model and persisted upgrades.
import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(!sessionStorage.getItem('physics-seed')){localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:1000000,credits:1000000,gems:10000,owned:['golf'],upgrades:{},tunes:{},dev:false}));sessionStorage.setItem('physics-seed','1')}});
 async function open(){await page.goto(`${process.env.BASE_URL||'http://localhost:4190'}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));await page.click('#menu-garage')}
 const stats=()=>page.evaluate(()=>Object.fromEntries(['speed','accel','braking','grip'].map(x=>[x,parseFloat(document.getElementById('stat-'+x).textContent)])));
 await open();const stock=await stats();await page.click('[data-garage-tab=upgrades]');
 for(const id of ['engine','tires','brakes'])await page.click(`[data-upgrade=${id}]`);
 const tuned=await stats();assert.ok(tuned.speed>stock.speed && tuned.accel<stock.accel && tuned.grip>stock.grip && tuned.braking<stock.braking,JSON.stringify({stock,tuned}));
 await open();assert.deepEqual(await stats(),tuned);assert.deepEqual(errors,[]);
 console.log('Garage shows shared physics estimates; engine, tire and brake upgrades persist across reload.');
}finally{await browser.close()}
