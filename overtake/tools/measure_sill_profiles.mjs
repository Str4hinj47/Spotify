// Measure the paint surface in normalized game coordinates, for authoring
// fitted side skirts. Start Vite first, then:
//   GAME_URL=http://localhost:3000 node tools/measure_sill_profiles.mjs CAR_ID FRONT_Z REAR_Z
// Merge the resulting entry into src/sill-profiles.json; do not overwrite the
// existing profiles. Without arguments, it measures the original seven cars.
// The ranges should be chosen from the actual tire extents, with clearance.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { CAR_CONTENT } from '../src/content/cars.mjs';
const defaults={golf:[-.80,.98],mercedes:[-1.33,1.02],audi:[-1.10,.96],mustang:[-1.02,.83],ferrari:[-.67,.94],r8:[-.84,1.05],challenger:[-1.13,1]};
const [id,front,rear]=process.argv.slice(2);
if (id && (!CAR_CONTENT.some(car=>car.id===id) || front === undefined || rear === undefined || !Number.isFinite(Number(front)) || !Number.isFinite(Number(rear)) || Number(front)>=Number(rear))) { console.error('Usage: node tools/measure_sill_profiles.mjs CAR_ID FRONT_Z REAR_Z'); process.exit(1); }
const ranges=id ? {[id]:[Number(front),Number(rear)]} : defaults;
const browser = await pw.launch({executablePath:await chromium.executablePath(),headless:true,
  args:chromium.args.filter(a=>a!=='--single-process').concat(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']),
  env:{...process.env,LD_LIBRARY_PATH:`/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH||''}`}});
try {
  const page=await browser.newPage();
  await page.goto(`${(process.env.GAME_URL||'http://localhost:3000').replace(/\/$/,'')}/play.html?test=1`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('#topbar:not(.hidden)',{timeout:180000});
  const profiles=await page.evaluate(async(ranges)=>{
    const g=window.__overtake,T=await import('/node_modules/three/build/three.module.js');
    const out={};
    for(const [id,[start,end]] of Object.entries(ranges)) {
      const car=g.library.create(id);car.updateMatrixWorld(true);const meshes=[];
      car.traverse(m=>{if(m.isMesh&&(Array.isArray(m.material)?m.material:[m.material]).some(x=>x.name.startsWith('paint__')))meshes.push(m);});
      const sides=[];
      for(const side of [-1,1]) {
        const rows=[];
        for(const y of [.30,.38]) {
          const row=[];
          for(let i=0;i<=12;i++) {
            const z=start+(end-start)*i/12;
            const ray=new T.Raycaster(new T.Vector3(side*2.5,y,z),new T.Vector3(-side,0,0),0,2.1);
            const hit=ray.intersectObjects(meshes,false)[0];row.push(hit?+Math.abs(hit.point.x).toFixed(3):null);
          }
          // Fill mesh holes by linear interpolation, retaining measured ends.
          for(let i=0;i<row.length;i++) if(row[i]===null) {
            let left=i-1,right=i+1;while(left>=0&&row[left]===null)left--;while(right<row.length&&row[right]===null)right++;
            row[i]=left>=0&&right<row.length?+(row[left]+(row[right]-row[left])*(i-left)/(right-left)).toFixed(3):left>=0?row[left]:row[right];
          }
          rows.push(row);
        }
        sides.push(rows);
      }
      out[id]={range:[start,end],sides};
    }
    return out;
  },ranges);
  process.stdout.write(JSON.stringify(profiles)+'\n');
} finally { await browser.close(); }
