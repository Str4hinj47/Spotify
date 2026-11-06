import * as THREE from 'three';
import type { TrafficId } from './catalog';

// Approximate emitter centers measured in each normalized model's local space.
// Front is -Z; rear is +Z. No red road beams are created.
type Lamps = { front: [number,number,number]; rear: [number,number,number] };
export const LAMP_POSITIONS: Record<TrafficId, Lamps> = {
  golf:       {front:[.54,.67,-1.93],rear:[.67,.76,1.94]},
  mercedes:   {front:[.68,.72,-2.39],rear:[.72,.68,2.49]},
  audi:       {front:[.69,.67,-2.25],rear:[.70,.87,2.32]},
  mustang:    {front:[.70,.69,-2.16],rear:[.54,.72,2.30]},
  ferrari:    {front:[.70,.68,-1.68],rear:[.71,.76,1.88]},
  r8:         {front:[.65,.56,-1.91],rear:[.65,.69,2.06]},
  challenger: {front:[.65,.73,-2.30],rear:[.59,.87,2.39]},
  semi:       {front:[.75,.74,-8.08],rear:[.84,.76,7.99]},
  kraz:       {front:[.79,.78,-4.08],rear:[.85,.85,3.90]},
};

let glow: THREE.CanvasTexture | null = null;
function glowTexture() {
  if (glow) return glow;
  const c=document.createElement('canvas'); c.width=c.height=64;
  const ctx=c.getContext('2d')!; const g=ctx.createRadialGradient(32,32,0,32,32,31);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.15,'rgba(255,255,255,.65)'); g.addColorStop(.45,'rgba(255,255,255,.14)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);glow=new THREE.CanvasTexture(c);return glow;
}
export type VehicleLights = { front: THREE.Sprite[]; rear: THREE.Sprite[]; beam?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> };
export function addVehicleLights(group: THREE.Group, id: TrafficId, npc: boolean): VehicleLights {
  const profile=LAMP_POSITIONS[id];
  const make = (pos:[number,number,number], color:number, size:number, name:string) => [-1,1].map(side=>{
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color,transparent:true,opacity:0,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending}));
    sprite.name=name;sprite.position.set(side*pos[0],pos[1],pos[2]);sprite.scale.set(size,size*.7,1);group.add(sprite);return sprite;
  });
  const lights:VehicleLights={front:make(profile.front,0xe7f5ff,.30,'front-lamp-glow'),rear:make(profile.rear,0xff1712,.34,'rear-lamp-glow')};
  if (npc) {
    // A transparent road decal costs no additional dynamic lights/shadows.
    // Its two soft wedges are projected from the real front, never the rear.
    const length=15, width=7;
    const geo=new THREE.PlaneGeometry(width,length,1,16);geo.rotateX(-Math.PI/2);geo.translate(0,.08,profile.front[2]-length/2);
    const material=new THREE.ShaderMaterial({uniforms:{strength:{value:0},offset:{value:profile.front[0]/width}},transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`varying vec2 vUv;uniform float strength,offset;void main(){float d=vUv.y;float width=mix(.035,.25,d);float left=1.0-smoothstep(width*.25,width,abs(vUv.x-(.5-offset)));float right=1.0-smoothstep(width*.25,width,abs(vUv.x-(.5+offset)));float fade=smoothstep(0.0,.06,d)*(1.0-smoothstep(.32,1.0,d));gl_FragColor=vec4(.73,.82,1.0,max(left,right)*fade*strength);}`});
    const mesh=new THREE.Mesh(geo,material);mesh.name='npc-headlight-beams';mesh.frustumCulled=false;mesh.renderOrder=2;group.add(mesh);lights.beam=mesh;
    mesh.userData.basePositions=Float32Array.from(geo.attributes.position.array as ArrayLike<number>);
  }
  group.userData.vehicleLights=lights;return lights;
}
const cameraLocal=new THREE.Vector3();
export function updateVehicleLights(group:THREE.Group,camera:THREE.Camera,night:number,braking:boolean, garage=false) {
  const lights=group.userData.vehicleLights as VehicleLights | undefined;if(!lights)return;
  group.updateWorldMatrix(true,false);cameraLocal.copy(camera.position);group.worldToLocal(cameraLocal);
  const frontVisible=cameraLocal.z < 0, rearVisible=cameraLocal.z > 0;
  const darkness=THREE.MathUtils.clamp(night,0,1);
  // Brighten the model's own headlamp lenses as well as the soft halo.
  for(const mat of (group.userData.headlightMaterials ?? []) as THREE.MeshStandardMaterial[])
    mat.emissiveIntensity = mat.name === 'headlight__r8' ? .30 + darkness*.42 : .45 + darkness*.50;
  for(const sprite of lights.front) sprite.material.opacity=frontVisible ? .30+darkness*.52 : 0;
  for(const sprite of lights.rear) sprite.material.opacity=rearVisible ? (braking ? .85 : .35+darkness*.34) : 0;
  if(lights.beam) { lights.beam.visible=!garage;lights.beam.material.uniforms.strength.value=.08+darkness*.48; }
}
export function conformTrafficBeam(group:THREE.Group, s:number, dir:1|-1, roadHeight:(s:number)=>number) {
  const beam=(group.userData.vehicleLights as VehicleLights | undefined)?.beam;if(!beam)return;
  const p=beam.geometry.getAttribute('position') as THREE.BufferAttribute, base=beam.userData.basePositions as Float32Array, h=roadHeight(s);
  for(let i=0;i<p.count;i++) p.setY(i,.08+roadHeight(s + -base[i*3+2]*dir)-h);
  p.needsUpdate=true;
}
export function disposeVehicleLights(group:THREE.Group) {
  const lights=group.userData.vehicleLights as VehicleLights | undefined;
  if(lights?.beam){lights.beam.geometry.dispose();lights.beam.material.dispose();}
}
