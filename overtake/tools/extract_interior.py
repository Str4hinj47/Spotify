import bpy, bmesh
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/tmp/mercedes_plain.glb")
ob = [o for o in bpy.data.objects if o.type == "MESH"][0]

# Duplicate object and keep only interior faces
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
bpy.ops.object.duplicate()
int_ob = bpy.context.active_object
int_ob.name = "mercedes_interior_template"

# Remove original
bpy.data.objects.remove(ob, do_unlink=True)

bm = bmesh.new()
bm.from_mesh(int_ob.data)
bm.faces.ensure_lookup_table()

keep_mats = {
    "photo__W222 - Photo Textures",
    "trim__W222 - Pure Black",
    "trim__W222 - Glossy Black",
    "chrome__W222 - Chrome",
}

to_del = []
for f in bm.faces:
    mname = int_ob.material_slots[f.material_index].name
    c = int_ob.matrix_world @ f.calc_center_median()
    in_cabin = (abs(c.x) < 0.76) and (-0.82 < c.y < 0.95) and (0.34 < c.z < 1.26)
    if not (mname in keep_mats and in_cabin):
        to_del.append(f)

bmesh.ops.delete(bm, geom=to_del, context="FACES")
# Clean loose verts
loose = [v for v in bm.verts if not v.link_faces]
if loose:
    bmesh.ops.delete(bm, geom=loose, context="VERTS")

bm.to_mesh(int_ob.data)
bm.free()
int_ob.data.update()

# Compute bounds
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for v in int_ob.data.vertices:
    co = int_ob.matrix_world @ v.co
    for i in range(3):
        lo[i] = min(lo[i], co[i])
        hi[i] = max(hi[i], co[i])

print(f"Extracted interior: {len(int_ob.data.vertices)} verts, {len(int_ob.data.polygons)} faces")
print(f"Bounds lo={[round(x,3) for x in lo]} hi={[round(x,3) for x in hi]}")

bpy.ops.export_scene.gltf(
    filepath="/tmp/interior_template.glb",
    export_format="GLB",
    use_selection=False,
)
print("Saved /tmp/interior_template.glb")
