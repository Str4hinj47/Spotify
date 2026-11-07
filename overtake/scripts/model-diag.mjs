import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
const args = chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required']);
const browser = await pw.launch({ executablePath: await chromium.executablePath(), args, headless: true, env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.local/lib/chromium-deps' } });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}/play.html?test=1`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#topbar:not(.hidden)', { timeout: 120000 });
const res = await page.evaluate(() => {
  const g = window.__overtake;
  const lib = g.library;
  const ids = ['golf','mercedes','audi','mustang','ferrari'];
  const out = {};
  for (const id of ids) {
    const scene = lib.get(id).scene;
    scene.updateMatrixWorld(true);
    const groups = {};
    scene.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const geo = o.geometry;
      const pos = geo.attributes.position;
      const e = o.matrixWorld.elements;
      const name = mats[0]?.name || 'none';
      const cat = name.split('__')[0];
      const arr = (groups[cat] ||= []);
      for (let i=0;i<pos.count;i++) {
        const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
        arr.push([e[0]*x+e[4]*y+e[8]*z+e[12], e[1]*x+e[5]*y+e[9]*z+e[13], e[2]*x+e[6]*y+e[10]*z+e[14]]);
      }
    });
    const stats = {};
    for (const [cat, pts] of Object.entries(groups)) {
      let min=[1e9,1e9,1e9], max=[-1e9,-1e9,-1e9], c=[0,0,0];
      for (const p of pts) for (let a=0;a<3;a++){min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a]);c[a]+=p[a];}
      c=c.map(x=>x/pts.length);
      let xx=0,xz=0,zz=0;
      for (const p of pts){const dx=p[0]-c[0], dz=p[2]-c[2]; xx+=dx*dx; xz+=dx*dz; zz+=dz*dz;}
      const theta = 0.5*Math.atan2(2*xz, xx-zz);
      let a = Math.atan2(Math.cos(theta), Math.sin(theta))*180/Math.PI;
      while(a>90)a-=180; while(a<-90)a+=180;
      stats[cat]={n:pts.length,min,max,center:c,skewFromZ:+a.toFixed(2)};
    }
    out[id]={innerRotationY:scene.rotation.y, stats};
  }
  return out;
});
console.log(JSON.stringify(res,null,2));
await browser.close();
