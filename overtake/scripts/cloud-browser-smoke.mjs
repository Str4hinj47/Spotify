// Mocked auth/PostgREST: manual upload, restore, undo, conflict, future schema and delete.
import {chromium as pw} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://localhost:4178', id='11111111-1111-4111-8111-111111111111';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage({viewport:{width:900,height:900}}), errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
 const user={id,email:'driver@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 await page.addInitScript(({user})=>{
   const enc=x=>btoa(JSON.stringify(x)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
   const exp=Math.floor(Date.now()/1000)+3600;
   localStorage.setItem('sb-example-auth-token',JSON.stringify({access_token:`${enc({alg:'none',typ:'JWT'})}.${enc({sub:user.id,role:'authenticated',exp})}.sig`,refresh_token:'mock-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}));
   localStorage.setItem('overtake-progression-v2',JSON.stringify({version:2,money:1234,dev:true,owned:['golf'],upgrades:{},tunes:{}}));
 },{user});
 let row=null, conflict=false;
 await page.route('https://example.supabase.co/**',async route=>{
  const req=route.request(), url=new URL(req.url()), method=req.method();
  if(url.pathname==='/auth/v1/user') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
  if(url.pathname==='/rest/v1/overtake_cloud_saves') {
   let body=[];
   if(method==='GET') body=row?[row]:[];
   else if(method==='POST'){const data=req.postDataJSON();row={user_id:data.user_id,payload:data.payload,revision:1,updated_at:'2026-11-08T00:00:00Z'};body=[row];}
   else if(method==='PATCH'){ if(conflict){row.revision++;conflict=false;} else if(row&&url.searchParams.get('revision')===`eq.${row.revision}`){row.payload=req.postDataJSON().payload;row.revision++;body=[{revision:row.revision}];} }
   else if(method==='DELETE'){if(row&&url.searchParams.get('revision')===`eq.${row.revision}`){body=[{revision:row.revision}];row=null;}}
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  }
  return route.fulfill({status:404,contentType:'application/json',body:'{}'});
 });
 await page.goto(base,{waitUntil:'networkidle'});await page.click('#account-open');await page.waitForSelector('#cloud-controls:not([hidden])');
 await page.click('#cloud-upload');await page.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('updated'));
 assert.equal(row.payload.progression.money,1234);assert.equal(row.payload.progression.dev,false);
 await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('overtake-progression-v2'));p.money=777;localStorage.setItem('overtake-progression-v2',JSON.stringify(p));});
 await page.click('#cloud-restore');await page.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('restored to this device'));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-progression-v2')).money),1234);
 await page.click('#cloud-undo');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('overtake-progression-v2')).money),777);
 conflict=true;await page.click('#cloud-upload');await page.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('changed on another device'));assert.equal(row.payload.progression.money,1234);
 row.payload.schema=2;await page.click('#cloud-upload');await page.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('Unsupported'));assert.equal(row.payload.schema,2);
 await page.click('#cloud-delete');await page.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('deleted'));assert.equal(row,null);
 assert.deepEqual(errors,[]);console.log('Mocked cloud save flows passed');
} finally {await browser.close();}
