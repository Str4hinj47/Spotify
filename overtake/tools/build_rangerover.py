#!/usr/bin/env python3
"""Build a clean Range Rover SUV GLB with interior, transparent windows, and 4 opening doors."""
import math
import bpy, bmesh
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)

def make_mat(name, color, met=0.0, rough=0.5, alpha=1.0, emissive=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = met
    bsdf.inputs["Roughness"].default_value = rough
    if alpha < 1.0:
        m.blend_method = "BLEND"
        bsdf.inputs["Alpha"].default_value = alpha
    else:
        m.blend_method = "OPAQUE"
    if emissive:
        bsdf.inputs["Emission Color"].default_value = (*emissive, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 3.0
    return m

mat_paint = make_mat("paint__RangeRover", (0.08, 0.10, 0.12), met=0.65, rough=0.25)
mat_trim  = make_mat("trim__RangeRover", (0.03, 0.03, 0.035), met=0.1, rough=0.6)
mat_chrome= make_mat("chrome__RangeRover", (0.85, 0.87, 0.90), met=1.0, rough=0.12)
mat_glass = make_mat("glass__RangeRover", (0.05, 0.08, 0.11), met=0.1, rough=0.06, alpha=0.38)
mat_tire  = make_mat("tire__RangeRover", (0.02, 0.02, 0.022), met=0.0, rough=0.9)
mat_rim   = make_mat("rim__RangeRover", (0.65, 0.67, 0.70), met=0.95, rough=0.22)
mat_head  = make_mat("headlight__RangeRover", (0.95, 0.97, 1.0), emissive=(0.95, 0.97, 1.0))
mat_tail  = make_mat("taillight__RangeRover", (0.85, 0.05, 0.05), emissive=(0.85, 0.05, 0.05))

def add_box(name, center, size, mat, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
        v.co += Vector(center)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob

# Lower chassis / body (-Y is front, +Y is rear, +Z is up)
add_box("rr_lower_front", (0, -1.65, 0.68), (1.98, 1.60, 0.72), mat_paint)
add_box("rr_lower_rear",  (0,  1.65, 0.72), (1.98, 1.50, 0.80), mat_paint)
add_box("rr_floor",       (0,  0.00, 0.36), (1.88, 2.20, 0.12), mat_trim)
add_box("rr_roof",        (0,  0.25, 1.78), (1.82, 2.75, 0.08), mat_paint)

# Pillars (A, B, C, D)
for sx in (-1, 1):
    add_box(f"rr_apillar_{sx}", (sx*0.88, -0.88, 1.40), (0.09, 0.14, 0.76), mat_trim)
    add_box(f"rr_bpillar_{sx}", (sx*0.88,  0.08, 1.40), (0.09, 0.12, 0.76), mat_trim)
    add_box(f"rr_cpillar_{sx}", (sx*0.88,  1.12, 1.40), (0.10, 0.16, 0.76), mat_trim)
    add_box(f"rr_dpillar_{sx}", (sx*0.88,  2.10, 1.42), (0.12, 0.22, 0.72), mat_trim)

# Front & rear windshields (transparent)
add_box("rr_windshield", (0, -0.92, 1.38), (1.68, 0.06, 0.72), mat_glass)
add_box("rr_rear_glass", (0,  2.28, 1.42), (1.66, 0.06, 0.64), mat_glass)

# Grille, headlights, taillights
add_box("rr_grille",     (0, -2.46, 0.76), (1.10, 0.04, 0.30), mat_chrome)
for sx in (-1, 1):
    add_box(f"rr_hl_{sx}", (sx*0.74, -2.46, 0.78), (0.34, 0.05, 0.16), mat_head)
    add_box(f"rr_tl_{sx}", (sx*0.80,  2.41, 0.88), (0.28, 0.05, 0.24), mat_tail)

# 4 Wheels
for wname, (wx, wy, wz) in [
    ("wheel_fl", (-0.94, -1.50, 0.42)),
    ("wheel_fr", ( 0.94, -1.50, 0.42)),
    ("wheel_rl", (-0.94,  1.45, 0.42)),
    ("wheel_rr", ( 0.94,  1.45, 0.42)),
]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.42, depth=0.28, location=(wx, wy, wz), rotation=(0, math.radians(90), 0))
    t = bpy.context.active_object
    t.name = wname
    t.data.materials.append(mat_tire)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.28, depth=0.30, location=(wx, wy, wz), rotation=(0, math.radians(90), 0))
    r = bpy.context.active_object
    r.name = wname + "_rim"
    r.data.materials.append(mat_rim)

# 4 Opening doors with exact hinge pivots
for dname, sx, y_hinge, y_mid, dlen in [
    ("door_fl", -1, -0.82, -0.37, 0.90),
    ("door_fr",  1, -0.82, -0.37, 0.90),
    ("door_rl", -1,  0.12,  0.58, 0.92),
    ("door_rr",  1,  0.12,  0.58, 0.92),
]:
    piv = bpy.data.objects.new(dname, None)
    piv.location = Vector((sx * 0.96, y_hinge, 0.85))
    bpy.context.scene.collection.objects.link(piv)
    dy = y_mid - y_hinge
    add_box(f"{dname}_panel", (0, dy, -0.14), (0.07, dlen, 0.72), mat_paint, parent=piv)
    add_box(f"{dname}_glass", (0, dy,  0.50), (0.04, dlen - 0.06, 0.56), mat_glass, parent=piv)

# Interior from template
bpy.ops.import_scene.gltf(filepath="/tmp/interior_template.glb")
int_ob = [o for o in bpy.data.objects if o.type == "MESH" and "interior" in o.name.lower()][0]
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for v in int_ob.data.vertices:
    co = int_ob.matrix_world @ v.co
    for i in range(3):
        lo[i] = min(lo[i], co[i]); hi[i] = max(hi[i], co[i])
cur_c = (lo + hi) / 2
cur_s = hi - lo
tgt_c = Vector((0.0, 0.10, 0.95))
tgt_s = Vector((1.42, 1.50, 0.92))
for v in int_ob.data.vertices:
    co = (int_ob.matrix_world @ v.co) - cur_c
    co = Vector((co.x * tgt_s.x / cur_s.x, co.y * tgt_s.y / cur_s.y, co.z * tgt_s.z / cur_s.z)) + tgt_c
    v.co = int_ob.matrix_world.inverted() @ co
int_ob.data.update()

bpy.ops.export_scene.gltf(filepath="/tmp/rangerover_plain.glb", export_format="GLB")
print("Exported /tmp/rangerover_plain.glb")

for ob in bpy.data.objects:
    if ob.name in ("door_fl", "door_rl"):
        ob.rotation_euler.z = math.radians(58)
    elif ob.name in ("door_fr", "door_rr"):
        ob.rotation_euler.z = math.radians(-58)
bpy.ops.export_scene.gltf(filepath="/tmp/rangerover_open.glb", export_format="GLB")
print("Exported /tmp/rangerover_open.glb")
