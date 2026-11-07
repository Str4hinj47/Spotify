import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAR_CONTENT } from '../src/content/cars.mjs';
import { LIVERY_OPTIONS } from '../src/content/cosmetics.mjs';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
const seed = page => page.addInitScript(() => { if(!sessionStorage.getItem('seeded')) {localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,walletVersion:1,coins:1000000,credits:1000000,gems:10000,owned:['golf'],upgrades:{},tunes:{},dev:false}));sessionStorage.setItem('seeded','yes');}});
async function open(page) { await page.goto(`${process.env.BASE_URL || 'http://localhost:4181'}/play.html?test=1`,{timeout:180000,waitUntil:'domcontentloaded'}); await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.click('#menu-garage'); }
async function stats(page) {return page.evaluate(()=>Object.fromEntries(['speed','accel','braking','grip','bonus'].map(x=>[x,document.getElementById('stat-'+x).textContent])));}
try {
  fs.mkdirSync('test-results',{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(120000);page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));await seed(page);await open(page);
  const original=await stats(page);for(const value of Object.values(original)) assert.match(value,/^\d/);
  await page.screenshot({path:'test-results/performance-desktop.png'});
  await page.click('[data-upgrade=engine]');await page.click('[data-upgrade=tires]');await page.click('[data-upgrade=brakes]');
  const upgraded=await stats(page);assert.ok(+upgraded.speed>+original.speed && +upgraded.accel<+original.accel && +upgraded.grip>+original.grip && +upgraded.braking<+original.braking);
  await page.click('#dev-toggle');const dev=await stats(page);assert.ok(+dev.speed>+upgraded.speed);await page.click('#dev-toggle');assert.deepEqual(await stats(page),upgraded);
  await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-workshop-tab=wheels]');await page.selectOption('#custom-tire-width','wide',{force:true});await page.click('#custom-done');await page.click('[data-garage-tab=upgrades]');assert.ok(+(await stats(page)).grip>+upgraded.grip);
  await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-workshop-tab=paint]');await page.click('[data-custom-view=side]');
  for(const id of ['race','sprint-offset','velocity','heritage','apex']) {await page.selectOption('#custom-livery',id,{force:true});assert.equal(await page.locator('#custom-livery').inputValue(),id);await page.screenshot({path:`test-results/livery-${id}.png`,timeout:120000});}
  await page.locator('#custom-livery-color').fill('#edbb25');await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});await page.click('#menu-garage');await page.click('[data-garage-tab=style]');await page.click('#btn-customize');await page.click('[data-workshop-tab=paint]');assert.equal(await page.locator('#custom-livery').inputValue(),'apex');assert.equal(await page.locator('#custom-livery-color').inputValue(),'#edbb25');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-progression-v2')));for(const id of ['race','sprint-offset','velocity','heritage','apex'])assert.ok(saved.tunes.golf.includes('livery:'+id));
  // Render every style on all imported paint meshes, without touching saved UI state.
  await page.evaluate(({cars,liveries})=>{const g=window.__overtake;for(const id of cars)for(const style of (id==='golf'?liveries:['race'])){g.library.setCustomization(id,{...g.library.getCustomization(id),livery:style,liveryColor:'#ffffff'});g.setSelectedCar(id);g.setGarageView('front');g.composer.render();g.setGarageView('side');g.composer.render();}},{cars:CAR_CONTENT.map(c=>c.id),liveries:LIVERY_OPTIONS.map(x=>x.id)});
  await page.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.setDefaultTimeout(120000);mobile.on('pageerror',e=>errors.push(String(e)));await seed(mobile);await open(mobile);for(const v of Object.values(await stats(mobile)))assert.match(v,/^\d/);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.screenshot({path:'test-results/performance-mobile.png',timeout:120000});await mobile.close();
  assert.deepEqual(errors,[]);console.log({original,upgraded,dev,styles:LIVERY_OPTIONS.length,cars:CAR_CONTENT.length,errors});
} finally {await browser.close();}
