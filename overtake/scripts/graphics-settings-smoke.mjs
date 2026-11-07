// Real renderer, saved quality, resize, keyboard/pause and compact-screen layout.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL || 'http://localhost:3000';
const browser=await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}/play.html`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
  const inspect=()=>page.evaluate(()=>{const g=window.__overtake,r=g.renderer;return {quality:g.getGraphicsQuality(),ratio:r.getPixelRatio(),canvas:[r.domElement.width,r.domElement.height],buffer:[g.composer.inputBuffer.width,g.composer.inputBuffer.height]};});
  assert.deepEqual(await inspect(),{quality:'sharp',ratio:1.25,canvas:[1200,800],buffer:[1200,800]});
  assert.equal(await page.locator('#btn-graphics svg').count(),1, 'graphics button has a visible icon');
  assert.equal(await page.locator('#btn-pause-graphics svg').count(),1);
  await page.click('#btn-graphics');
  assert.equal(await page.locator('#btn-graphics').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('[data-quality=sharp]').getAttribute('aria-pressed'),'true');
  await page.click('[data-quality=performance]');
  assert.deepEqual(await inspect(),{quality:'performance',ratio:0.8,canvas:[768,512],buffer:[768,512]});
  assert.equal(await page.evaluate(()=>localStorage.getItem('overtake-graphics-quality')),'performance');
  await page.click('[data-quality=balanced]');
  assert.deepEqual(await inspect(),{quality:'balanced',ratio:1,canvas:[960,640],buffer:[960,640]});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#graphics-panel').isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'btn-graphics');
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
  assert.deepEqual(await inspect(),{quality:'balanced',ratio:1,canvas:[960,640],buffer:[960,640]});
  await page.click('#menu-start');await page.evaluate(()=>cancelAnimationFrame(window.__overtake.raf));
  await page.keyboard.down('ArrowUp');
  assert.equal(await page.evaluate(()=>window.__overtake.input.throttle),true);
  await page.evaluate(()=>window.__overtake.pause());
  assert.equal(await page.evaluate(()=>window.__overtake.input.throttle),false);
  await page.keyboard.down('ArrowLeft');
  assert.equal(await page.evaluate(()=>window.__overtake.input.left),false);
  await page.keyboard.up('ArrowUp');await page.keyboard.up('ArrowLeft');
  await page.click('#btn-pause-graphics');
  assert.equal(await page.locator('#btn-pause-graphics').getAttribute('aria-expanded'),'true');
  await page.click('[data-quality=sharp]');assert.equal((await inspect()).ratio,1.25);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'btn-pause-graphics');
  await page.click('#btn-resume');
  for (const width of [390,320]) {
    await page.setViewportSize({width,height:844});
    await page.waitForFunction(w=>window.__overtake.renderer.domElement.width===w,width,{timeout:30000});
    await page.click('#btn-graphics');
    const layout=await page.evaluate(()=>{const a=document.querySelector('.brand').getBoundingClientRect(), b=document.querySelector('.top-actions').getBoundingClientRect(), p=document.querySelector('#graphics-panel').getBoundingClientRect();return {overlap:a.width>0&&a.right>b.left,panelInside:p.left>=0&&p.right<=innerWidth,actionsInside:b.left>=0&&b.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.deepEqual(layout,{overlap:false,panelInside:true,actionsInside:true,overflow:false});
    const dimensions=await inspect();assert.deepEqual(dimensions.buffer,dimensions.canvas);
    await page.click('#graphics-close');
  }
  await page.goto(`${base}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  assert.equal((await inspect()).ratio,1);
  await page.click('#btn-graphics');await page.click('[data-quality=performance]');assert.equal((await inspect()).ratio,1);
  assert.deepEqual(errors,[]);console.log('Graphics settings smoke passed; renderer, persistence, pause and mobile layout verified.');
} finally {await browser.close();}
