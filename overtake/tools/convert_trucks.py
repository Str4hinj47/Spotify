"""Convert the two user-provided truck assets into NPC-only glTFs.

First import the KrAZ 3DS into source-assets/trucks/kraz/kraz.blend (e.g. with
Blender's 3DS importer). The semi comes directly from the supplied archive.
Evaluated depsgraph instances are essential for the semi's five wheel axles.
"""
import bpy, json, sys
from pathlib import Path
from mathutils import Matrix, Vector
ROOT = Path(__file__).resolve().parents[1]
SPECS = {
 'semi': ('source-assets/trucks/semi/semi.blend', 16.0, 2.55, -1),
 'kraz': ('source-assets/trucks/kraz/kraz.blend', 8.0, 2.55, 1),
}

def material(src, cache):
 name = src.name.lower()
 if src.name in cache: return cache[src.name]
 # Explicit source-material classification: keep cab paint distinct from trailer.
 if 'painted_metal_red' in name or name == 'body': cat, color, metal, rough = 'paint', (0.25,0.08,0.035), .5, .38
 elif 'tire' in name or 'rubber' in name or name == 'gum': cat, color, metal, rough = 'tire', (.018,.019,.02), 0, .9
 elif 'glass' in name and 'headlight' not in name: cat, color, metal, rough = 'glass', (.025,.045,.06), .1, .12
 elif 'headlight' in name: cat, color, metal, rough = 'headlight', (.7,.75,.8), .2, .2
 elif 'plastic_red' in name or name == 'red': cat, color, metal, rough = 'taillight', (.45,.008,.006), .1, .3
 elif 'chrome' in name or name == 'wheel': cat, color, metal, rough = 'chrome', (.65,.67,.7), .8, .25
 elif 'aluminium' in name or 'steel' in name or 'metal' in name: cat, color, metal, rough = 'other', (.45,.47,.48), .6, .4
 elif 'tarpaulin' in name: cat, color, metal, rough = 'other', (.14,.18,.12), 0, .9
 elif 'black' in name or 'mesh' in name: cat, color, metal, rough = 'trim', (.025,.026,.027), 0, .8
 else: cat, color, metal, rough = 'other', tuple(src.diffuse_color[:3]), .1, .55
 mat=bpy.data.materials.new(f'{cat}__{src.name}'); mat.use_nodes=True
 bs=mat.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough
 if cat in ('headlight','taillight'):
  bs.inputs['Emission Color'].default_value=(*color,1); bs.inputs['Emission Strength'].default_value=.5
 # Imported texture images are retained when available (e.g. KrAZ tires).
 if src.use_nodes and cat in ('tire','other'):
  for node in src.node_tree.nodes:
   if node.type=='TEX_IMAGE' and node.image and node.image.has_data:
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=node.image
    mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']); break
 cache[src.name]=mat
 return mat

def convert(key, spec):
 path, length, width, front = spec
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/path),load_ui=False)
 for o in bpy.data.objects:
  for mod in o.modifiers:
   if mod.type=='SUBSURF': mod.levels=min(mod.levels,1)
 bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get()
 entries=[]; lo=Vector((1e20,)*3); hi=Vector((-1e20,)*3)
 for inst in deps.object_instances:
  obj=inst.object
  if obj.type!='MESH' or obj.original.type != 'MESH' or obj.name in ('Plane','Light'): continue
  mesh=obj.to_mesh()
  if not mesh or not mesh.vertices: obj.to_mesh_clear(); continue
  matrix=inst.matrix_world.copy()
  # Semi's source nose points -Y, while the glTF convention points +Y.
  rotate=Matrix.Diagonal((front,front,1,1)); matrix=rotate @ matrix
  for v in mesh.vertices:
   p=matrix @ v.co
   for axis in range(3): lo[axis]=min(lo[axis],p[axis]); hi[axis]=max(hi[axis],p[axis])
  entries.append((obj.name, mesh.copy(), matrix)); obj.to_mesh_clear()
 size=hi-lo; scale=length/size.y
 # Fit mirrors within the lane while retaining plausible height/length.
 sx=min(scale,width/size.x); norm=Matrix.Diagonal((sx,scale,scale,1)) @ Matrix.Translation(Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z)))
 print(key,'bounds',tuple(size),'scale',sx,scale,'parts',len(entries),flush=True)
 cache={}; output=[]
 for name,mesh,matrix in entries:
  if not mesh or not mesh.vertices: continue
  mesh.transform(norm @ matrix)
  old=list(mesh.materials); face_slots=[p.material_index for p in mesh.polygons]; mesh.materials.clear()
  for m in old: mesh.materials.append(material(m,cache) if m else material(bpy.data.materials.new('unknown'),cache))
  for poly, slot in zip(mesh.polygons, face_slots): poly.material_index=min(slot, max(0,len(mesh.materials)-1))
  new=bpy.data.objects.new(key+'_'+name,mesh); bpy.context.collection.objects.link(new); output.append(new)
 bpy.ops.object.select_all(action='DESELECT')
 for o in output: o.select_set(True)
 bpy.context.view_layer.objects.active=output[0]; bpy.ops.object.join(); model=bpy.context.object; model.name=key
 # Only decimate exceptional meshes; keep panels and small lamp details intact.
 tris=sum(len(p.vertices)-2 for p in model.data.polygons)
 print(key, 'original triangles', tris, flush=True)
 if tris>900000:
  dec=model.modifiers.new('GameLOD','DECIMATE'); dec.ratio=900000/tris; dec.use_collapse_triangulate=True; bpy.ops.object.modifier_apply(modifier=dec.name)
 dest=ROOT/'public/models'/f'{key}.glb'
 bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_materials='EXPORT',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
 tris=sum(len(p.vertices)-2 for p in model.data.polygons)
 info={'id':key,'file':f'models/{key}.glb','bytes':dest.stat().st_size,'triangles':tris,'source':path.split('/')[-1]}
 manifest=ROOT/'public/models/manifest.json'; data=json.loads(manifest.read_text()); data[key]=info; manifest.write_text(json.dumps(data,indent=2)+'\n'); print(info,flush=True)

if __name__=='__main__':
 for key,spec in SPECS.items():
  if len(sys.argv) == 1 or key in sys.argv[1:]: convert(key,spec)
