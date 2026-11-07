"""Prepare optimized wheel designs from the user-supplied FBX.
Run: LD_LIBRARY_PATH=/home/user/libdeps/blender /home/user/.venv/bin/python tools/convert_rims.py
"""
import bpy, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath='../google_drive/Wheels++.fbx+.fbx')
for obj in list(bpy.data.objects):
 if obj.type!='MESH' or not obj.name.lower().startswith('wheel'):
  bpy.data.objects.remove(obj,do_unlink=True);continue
 # Work in world space: the source wheels lie in XY and are .35 across, Z is the axle.
 obj.data.transform(obj.matrix_world); obj.matrix_world.identity()
 mins=[min(v.co[i] for v in obj.data.vertices) for i in range(3)];maxs=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
 center=[(a+b)/2 for a,b in zip(mins,maxs)]; radius=max(maxs[0]-mins[0],maxs[1]-mins[1])/2
 for v in obj.data.vertices:
  x,y,z=v.co;v.co=((z-center[2])/radius,(y-center[1])/radius,(x-center[0])/radius)
 mod=obj.modifiers.new('Optimize','DECIMATE');mod.ratio=min(1,8000/max(1,len(obj.data.polygons)))
 bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
 print(obj.name,len(obj.data.polygons),flush=True)
 # All designs occupy one common origin. Consumers clone the named meshes.
for obj in bpy.data.objects: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath='public/models/custom-rims.glb',export_format='GLB',export_materials='NONE')
