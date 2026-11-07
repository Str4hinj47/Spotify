// Run against a dev server with VITE_SUPABASE_URL=https://example.supabase.co
// and VITE_SUPABASE_ANON_KEY=sb_publishable_mock; all auth requests are mocked.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL || 'http://localhost:4178';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,args:chromium.args.filter(a=>a!=='--single-process').concat(['--no-sandbox']),env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
 const page=await browser.newPage(), errors=[];page.on('pageerror',e=>errors.push(String(e)));let request;
 await page.route('https://example.supabase.co/**',async route=>{ request=route.request();await route.fulfill({status:200,contentType:'application/json',body:'{}'}); });
 await page.goto(base,{waitUntil:'networkidle'});await page.click('#account-open');
 await page.waitForSelector('#account-form:not([hidden])');
 await page.fill('#account-email','driver@example.com');await page.click('#account-submit');
 await page.waitForFunction(()=>document.querySelector('#account-status').textContent.includes('Check your email'));
 assert.equal(request.method(),'POST');assert.ok(request.url().includes('/auth/v1/otp'));
 assert.equal(JSON.parse(request.postData()).email,'driver@example.com');
 assert.equal(new URL(request.url()).searchParams.get('redirect_to'),`${base}/`);
 assert.match(await page.locator('.account-disclaimer').innerText(),/not verified/i);
 assert.deepEqual(errors,[]);console.log('Mocked account sign-in passed');
} finally {await browser.close();}
