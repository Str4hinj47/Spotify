// Tests actual rendered front and rear lenses for every car, including side
// isolation, blink-off and rear-window occlusion. Run against the Vite server.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']);
const browser = await pw.launch({ executablePath: await chromium.executablePath(), args, headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` } });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`);
  await page.waitForSelector('#topbar:not(.hidden)', { timeout: 180000 });
  await page.evaluate(() => { const g = window.__overtake; cancelAnimationFrame(g.raf); g.garageAuto = false; g.garageZoom = 5.7; g.garagePitch = 0.24; });
  fs.mkdirSync('test-results', { recursive: true });
  for (const id of (process.env.INDICATOR_CAR ? [process.env.INDICATOR_CAR] : ['golf', 'mercedes', 'audi', 'mustang', 'ferrari', 'r8', 'challenger'])) {
    const result = await page.evaluate(async id => {
      const g = window.__overtake; g.setSelectedCar(id);
      const indicator = g.player.userData.indicatorState;
      const render = (angle, left, right) => {
        g.garageAngle = angle; g.updateCamera(0); g.updateIndicatorView();
        indicator.left.value = left; indicator.right.value = right;
        g.composer.render();
        return g.renderer.domElement.toDataURL('image/png');
      };
      const idle = render(0, 0, 0), left = render(0, 1, 0), right = render(0, 0, 1);
      const off = render(0, -1, 0);
      const frontIdle = render(Math.PI, 0, 0), frontOn = render(Math.PI, 1, 0), frontRight = render(Math.PI, 0, 1), frontOff = render(Math.PI, -1, 0);
      const load = url => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
      const pixels = async url => { const img = await load(url); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data; };
      const images = await Promise.all([idle, left, right, off, frontIdle, frontOn, frontRight, frontOff].map(pixels));
      const diff = (a, b) => {
        let lhs = 0, rhs = 0; const w = 800;
        for (let i = 0; i < a.length; i += 4) {
          const d = Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]);
          if (d > 35) { if ((i / 4) % w < w / 2) lhs++; else rhs++; }
        }
        return { left: lhs, right: rhs };
      };
      let challengerWindowDiff = 0, ringCenterDiff = 0;
      if (id === 'challenger') {
        // Turning off the front lamps must not alter the rear-window pixels.
        // This catches real rendering/depth regressions, not just opacity flags.
        const frontMeshes = [];
        g.player.traverse(o => { if (o.isMesh && (o.name === 'Cylinder_Cylinder004' || o.name === 'Cylinder003_Cylinder001' || o.name === 'Sphere001_Sphere002')) frontMeshes.push(o); });
        frontMeshes.forEach(o=>o.visible=false);
        const noFront = await pixels(render(0,0,0));
        frontMeshes.forEach(o=>o.visible=true);
        for(let y=225;y<292;y++) for(let x=285;x<515;x++) {
          const i=(y*800+x)*4; challengerWindowDiff+=Math.abs(images[0][i]-noFront[i])+Math.abs(images[0][i+1]-noFront[i+1])+Math.abs(images[0][i+2]-noFront[i+2]);
        }
        // Signal should illuminate the rounded perimeter, not the dark center.
        // Derive its screen bounds from changed pixels so the check follows the camera.
        let minX=800,maxX=0,minY=600,maxY=0;
        for(let y=0;y<600;y++) for(let x=0;x<400;x++) {
          const i=(y*800+x)*4, d=Math.abs(images[0][i]-images[1][i])+Math.abs(images[0][i+1]-images[1][i+1])+Math.abs(images[0][i+2]-images[1][i+2]);
          if(d>35){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
        }
        const cx=Math.round((minX+maxX)/2),cy=Math.round((minY+maxY)/2);
        for(let y=cy-2;y<=cy+2;y++) for(let x=cx-2;x<=cx+2;x++) {
          const i=(y*800+x)*4;ringCenterDiff+=Math.abs(images[0][i]-images[1][i])+Math.abs(images[0][i+1]-images[1][i+1])+Math.abs(images[0][i+2]-images[1][i+2]);
        }
      }
      let sprites = 0; g.player.traverse(o => { if (o.isSprite && o.material.opacity > 0) sprites++; });
      return { id, left: diff(images[0], images[1]), right: diff(images[0], images[2]),
        off: diff(images[1], images[3]), front: diff(images[4], images[5]), frontRight: diff(images[4], images[6]), frontOff: diff(images[5], images[7]),
        lamps: g.player.userData.indicatorMaterials.length, visibleSprites: sprites, challengerWindowDiff, ringCenterDiff, screenshot: left, frontScreenshot: frontOn, frontBase: frontIdle };
    }, id);
    if (id === 'audi') { for (const [key, name] of [['frontBase','front-off'],['frontScreenshot','front-on']]) fs.writeFileSync(`test-results/audi-${name}.png`, Buffer.from(result[key].split(',')[1], 'base64')); }
    assert.ok(result.lamps > 0, `${id} has no lens materials`);
    assert.ok(result.left.left > 20, `${id} left indicator is not visible: ${JSON.stringify(result.left)}`);
    assert.ok(result.left.right < result.left.left * 0.05 + 4, `${id} left signal changed right side`);
    assert.ok(result.right.right > 20, `${id} right indicator is not visible: ${JSON.stringify(result.right)}`);
    assert.ok(result.right.left < result.right.right * 0.05 + 4, `${id} right signal changed left side`);
    assert.ok(result.off.left > 20, `${id} indicator does not blink off`);
    // Looking at the nose reverses screen-left and car-left.
    assert.ok(result.front.right > 20 && result.front.left < result.front.right * .05 + 4, `${id} front left: ${JSON.stringify(result.front)}`);
    assert.ok(result.frontRight.left > 20 && result.frontRight.right < result.frontRight.left * .05 + 4, `${id} front right: ${JSON.stringify(result.frontRight)}`);
    assert.ok(result.frontOff.right > 20 && result.frontOff.left < result.frontOff.right * .05 + 4, `${id} front does not blink off: ${JSON.stringify(result.frontOff)}`);
    assert.equal(result.visibleSprites, 0, `${id} uses a floating indicator`);
    if (id === 'challenger') {
      assert.equal(result.challengerWindowDiff, 0, 'front lamps leaked through the Challenger rear glass');
      assert.ok(result.ringCenterDiff < 150, `Challenger signal filled its dark lens center: ${result.ringCenterDiff}`);
    }
    fs.writeFileSync(`test-results/indicator-verified-${id}.png`, Buffer.from(result.screenshot.split(',')[1], 'base64'));
    delete result.screenshot; delete result.frontScreenshot; delete result.frontBase; console.log(result);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
