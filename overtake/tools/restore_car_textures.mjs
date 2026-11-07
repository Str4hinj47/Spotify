// Replace selected downsampled GLB images without decoding/recompressing meshes.
// Usage: node tools/restore_car_textures.mjs /path/to/prepared-images
// The input directory contains mercedes-clean.jpg, ferrari-tread.png and
// ferrari-side.png, extracted from the user-provided originals. Redact the
// Mercedes atlas with tools/redact_mercedes_atlas.py before using this script.
import fs from 'node:fs';
import path from 'node:path';
const dir=process.argv[2];
if(!dir)throw Error('Usage: node tools/restore_car_textures.mjs prepared-images-directory');
const replacements={
  mercedes:{'MB_W222_Photo_Textures.1001':['mercedes-clean.jpg','image/jpeg']},
  ferrari:{wheel_tread:['ferrari-tread.png','image/png'],wheel_side:['ferrari-side.png','image/png']},
};
const manifestPath='public/models/manifest.json', manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
for(const [id,images] of Object.entries(replacements)){
  const filename=`public/models/${id}.glb`,input=fs.readFileSync(filename);
  if(input.readUInt32LE(0)!==0x46546c67||input.readUInt32LE(4)!==2||input.readUInt32LE(8)!==input.length)throw Error(`Invalid GLB ${id}`);
  const jsonLength=input.readUInt32LE(12),json=JSON.parse(input.subarray(20,20+jsonLength).toString('utf8'));
  const binHeader=20+jsonLength;
  if(input.readUInt32LE(binHeader+4)!==0x004e4942||json.buffers.length!==1)throw Error(`Unsupported GLB structure ${id}`);
  const bin=input.subarray(binHeader+8,binHeader+8+input.readUInt32LE(binHeader)), views=new Map();
  for(const [name,[file,mime]] of Object.entries(images)){
    const image=json.images.find(x=>x.name===name);
    if(!image||image.bufferView===undefined)throw Error(`Missing image ${id}/${name}`);
    const bytes=fs.readFileSync(path.join(dir,file));
    if(mime==='image/jpeg' && (bytes[0]!==0xff||bytes[1]!==0xd8))throw Error(`Invalid JPEG: ${file}`);
    if(mime==='image/png' && bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error(`Invalid PNG: ${file}`);
    if(json.images.some(x=>x!==image && x.bufferView===image.bufferView))throw Error(`Shared image buffer view: ${name}`);
    views.set(image.bufferView,bytes);image.mimeType=mime;
  }
  const parts=[];let offset=0;
  for(let i=0;i<json.bufferViews.length;i++){
    const view=json.bufferViews[i];if(view.buffer!==0||view.extensions)throw Error('Unsupported buffer view');
    const bytes=views.get(i)??bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
    const padding=(4-offset%4)%4;if(padding){parts.push(Buffer.alloc(padding));offset+=padding;}
    view.byteOffset=offset;view.byteLength=bytes.length;parts.push(bytes);offset+=bytes.length;
  }
  json.buffers[0].byteLength=offset;
  const payload=Buffer.concat(parts),binPadding=(4-payload.length%4)%4,raw=Buffer.from(JSON.stringify(json)),jsonPadding=(4-raw.length%4)%4;
  const jsonChunk=Buffer.concat([raw,Buffer.alloc(jsonPadding,0x20)]),binChunk=Buffer.concat([payload,Buffer.alloc(binPadding)]);
  const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonChunk.length+8+binChunk.length,8);
  jh.writeUInt32LE(jsonChunk.length,0);jh.writeUInt32LE(0x4e4f534a,4);
  bh.writeUInt32LE(binChunk.length,0);bh.writeUInt32LE(0x004e4942,4);
  const out=Buffer.concat([header,jh,jsonChunk,bh,binChunk]);fs.writeFileSync(filename,out);manifest[id].bytes=out.length;
  console.log(`${id}: restored ${Object.keys(images).join(', ')}; ${out.length} bytes`);
}
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
