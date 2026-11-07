// Offline save export/import/undo works with no account configured.
import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL||'http://localhost:4177';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}), errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,money:1234,dev:true,owned:['golf'],upgrades:{},tunes:{}})));
 await page.goto(`${base}/#account`,{waitUntil:'networkidle'});assert.ok(await page.locator('#account-dialog').isVisible());
 fs.mkdirSync('test-results',{recursive:true});
 const pending=page.waitForEvent('download');await page.click('#backup-export');const download=await pending;assert.equal(download.suggestedFilename(),'overtake-save.json');
 await download.saveAs('test-results/offline-save.json');const snapshot=JSON.parse(fs.readFileSync('test-results/offline-save.json'));assert.equal(snapshot.progression.coins,1234);assert.equal(snapshot.progression.dev,false);
 await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('overtake-progression-v2'));p.money=77;localStorage.setItem('overtake-progression-v2',JSON.stringify(p));});
 await page.locator('#backup-import').setInputFiles('test-results/offline-save.json');await page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Save imported'));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-progression-v2')).coins),1234);
 await page.click('#cloud-undo');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-progression-v2')).money),77);
 await page.locator('#backup-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('not valid JSON'));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-progression-v2')).money),77);assert.deepEqual(errors,[]);
 console.log('Offline backup flows passed');
} finally {await browser.close();}
