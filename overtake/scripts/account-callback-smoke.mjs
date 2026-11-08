// Email-link return is consumed by the Supabase client and opens the account dialog.
// All auth network traffic is mocked; no real account or email is created.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://localhost:4178';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const user={id:'11111111-1111-4111-8111-111111111111',email:'driver@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 await page.route('https://example.supabase.co/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)}));
 const exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const token=`${enc({alg:'none',typ:'JWT'})}.${enc({sub:user.id,role:'authenticated',exp})}.sig`;
 const hash=new URLSearchParams({access_token:token,refresh_token:'mock-refresh',expires_in:'3600',token_type:'bearer',type:'magiclink'});
 await page.goto(`${base}/#${hash}`,{waitUntil:'networkidle'});
 await page.waitForSelector('#account-dialog[open]');
 assert.match(await page.locator('#account-info').textContent(),/Signed in as driver@example.com/);
 assert.ok(await page.locator('#cloud-controls').isVisible());assert.equal(new URL(page.url()).hash,'');assert.deepEqual(errors,[]);
 console.log('Mocked email-link return opens the account dialog');
} finally {await browser.close();}
