#!/usr/bin/env python3
"""Author interior + exact door hinge pivots + material opacity for a car GLB.

Usage:
  source tools/blender_env.sh
  python3 tools/author_car.py <car_id> <in_plain.glb> <out_plain.glb> [--open-preview <out_open.glb>]
"""
import sys, os, math, argparse
import bpy, bmesh
from mathutils import Vector, Matrix

# Per-car door & interior specs in Blender space (after glTF import):
# Note: in Blender, +Z is up, +X/-X is left/right, and Y is front/back.
# front_sign: -1 if front is -Y, +1 if front is +Y.
CAR_SPECS = {
    "mercedes": {
        "has_interior": True,
        "doors": 4,
        "front_sign": 1,  # front is +Y in Blender
        # (y_hinge, y_latch) for front and rear doors, plus x_min_abs, z_min, z_max
        "fl_y": (0.85, -0.05),   # hinge at +0.85 (front), latch at -0.05 (B-pillar)
        "rl_y": (-0.05, -0.95),  # hinge at -0.05 (B-pillar), latch at -0.95 (C-pillar)
        "x_min": 0.79,
        "z_range": (0.30, 1.32),
    },
    "golf": {
        "has_interior": False,
        "doors": 4,
        "front_sign": -1,
        "fl_y": (-0.75, 0.15),
        "rl_y": (0.15, 0.95),
        "x_min": 0.68,
        "z_range": (0.22, 1.38),
        "interior_box": ((-0.64, 0.64), (-0.55, 0.75), (0.32, 1.22)),
    },
    "audi": {
        "has_interior": False,
        "doors": 4,
        "front_sign": -1,
        "fl_y": (-0.82, 0.12),
        "rl_y": (0.12, 1.05),
        "x_min": 0.72,
        "z_range": (0.22, 1.36),
        "interior_box": ((-0.68, 0.68), (-0.65, 0.85), (0.30, 1.20)),
    },
    "mustang": {
        "has_interior": False,
        "doors": 2,
        "front_sign": -1,
        "fl_y": (-0.72, 0.45),
        "x_min": 0.72,
        "z_range": (0.28, 1.30),
        "interior_box": ((-0.66, 0.66), (-0.55, 0.75), (0.28, 1.15)),
    },
    "ferrari": {
        "has_interior": True,
        "doors": 2,
        "front_sign": -1,
        "fl_y": (-0.68, 0.38),
        "x_min": 0.72,
        "z_range": (0.20, 1.15),
    },
    "r8": {
        "has_interior": False,
        "doors": 2,
        "front_sign": -1,
        "fl_y": (-0.68, 0.35),
        "x_min": 0.72,
        "z_range": (0.20, 1.18),
        "interior_box": ((-0.64, 0.64), (-0.50, 0.50), (0.22, 0.92)),
    },
    "challenger": {
        "has_interior": False,
        "doors": 2,
        "front_sign": -1,
        "fl_y": (-0.78, 0.48),
        "x_min": 0.74,
        "z_range": (0.24, 1.35),
        "interior_box": ((-0.66, 0.66), (-0.60, 0.80), (0.28, 1.08)),
    },
}


def fix_materials():
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if mat.name.startswith("glass__"):
            mat.blend_method = "BLEND"
            if bsdf:
                bsdf.inputs["Alpha"].default_value = 0.38
        else:
            mat.blend_method = "OPAQUE"
            if bsdf and "Alpha" in bsdf.inputs:
                bsdf.inputs["Alpha"].default_value = 1.0


def add_interior(interior_box):
    bpy.ops.import_scene.gltf(filepath="/tmp/interior_template.glb")
    int_obs = [o for o in bpy.data.objects if o.type == "MESH" and "interior" in o.name.lower()]
    if not int_obs:
        return
    int_ob = int_obs[0]
    # Compute current bounds
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for v in int_ob.data.vertices:
        co = int_ob.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], co[i])
            hi[i] = max(hi[i], co[i])
    cur_size = hi - lo
    cur_center = (lo + hi) / 2

    (tx0, tx1), (ty0, ty1), (tz0, tz1) = interior_box
    tgt_center = Vector(((tx0 + tx1) / 2, (ty0 + ty1) / 2, (tz0 + tz1) / 2))
    tgt_size = Vector((tx1 - tx0, ty1 - ty0, tz1 - tz0))

    sx = tgt_size.x / max(cur_size.x, 0.01)
    sy = tgt_size.y / max(cur_size.y, 0.01)
    sz = tgt_size.z / max(cur_size.z, 0.01)

    # Apply transform directly to vertices
    for v in int_ob.data.vertices:
        co = int_ob.matrix_world @ v.co
        co = co - cur_center
        co = Vector((co.x * sx, co.y * sy, co.z * sz)) + tgt_center
        v.co = int_ob.matrix_world.inverted() @ co
    int_ob.data.update()


def split_doors(spec):
    """Split door faces from body meshes into door_fl, door_fr (and door_rl, door_rr)."""
    x_min = spec["x_min"]
    z_lo, z_hi = spec["z_range"]
    door_defs = []

    y_h, y_l = spec["fl_y"]
    y_lo, y_hi = min(y_h, y_l), max(y_h, y_l)
    door_defs.append(("door_fl", +1, y_lo, y_hi, y_h))
    door_defs.append(("door_fr", -1, y_lo, y_hi, y_h))

    if spec["doors"] == 4:
        ry_h, ry_l = spec["rl_y"]
        ry_lo, ry_hi = min(ry_h, ry_l), max(ry_h, ry_l)
        door_defs.append(("door_rl", +1, ry_lo, ry_hi, ry_h))
        door_defs.append(("door_rr", -1, ry_lo, ry_hi, ry_h))

    skip_prefixes = ("tire__", "rim__", "brake__", "wheel")

    for dname, x_sign, y_lo, y_hi, y_hinge in door_defs:
        created_parts = []
        for ob in list(bpy.data.objects):
            if ob.type != "MESH" or ob.name.startswith("door_"):
                continue
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            bm.faces.ensure_lookup_table()
            mw = ob.matrix_world

            sel_faces = []
            for f in bm.faces:
                mname = ob.material_slots[f.material_index].name if ob.material_slots else ""
                if any(mname.startswith(p) for p in skip_prefixes):
                    continue
                c = mw @ f.calc_center_median()
                if (c.x * x_sign > x_min) and (y_lo <= c.y <= y_hi) and (z_lo <= c.z <= z_hi):
                    sel_faces.append(f)

            if not sel_faces:
                bm.free()
                continue

            # Create new mesh for this door's contribution from ob
            door_me = bpy.data.meshes.new(f"{dname}_{ob.name}")
            door_ob = bpy.data.objects.new(f"{dname}_{ob.name}", door_me)
            bpy.context.scene.collection.objects.link(door_ob)
            for slot in ob.material_slots:
                door_ob.data.materials.append(slot.material)

            # Copy selected faces to door_bm
            door_bm = bmesh.new()
            vert_map = {}
            for f in sel_faces:
                new_verts = []
                for v in f.verts:
                    if v.index not in vert_map:
                        vert_map[v.index] = door_bm.verts.new(mw @ v.co)
                    new_verts.append(vert_map[v.index])
                try:
                    nf = door_bm.faces.new(new_verts)
                    nf.material_index = f.material_index
                except ValueError:
                    pass
            door_bm.to_mesh(door_me)
            door_bm.free()
            door_me.update()
            created_parts.append(door_ob)

            # Delete selected faces from original ob
            bmesh.ops.delete(bm, geom=sel_faces, context="FACES")
            loose = [v for v in bm.verts if not v.link_faces]
            if loose:
                bmesh.ops.delete(bm, geom=loose, context="VERTS")
            bm.to_mesh(ob.data)
            bm.free()
            ob.data.update()

        if created_parts:
            # Create empty pivot at exact hinge edge
            pivot = bpy.data.objects.new(dname, None)
            pivot.empty_display_type = "PLAIN_AXES"
            pivot.location = Vector((x_sign * (x_min + 0.14), y_hinge, (z_lo + z_hi) * 0.5))
            bpy.context.scene.collection.objects.link(pivot)
            for part in created_parts:
                for v in part.data.vertices:
                    v.co = v.co - pivot.location
                part.data.update()
                part.parent = pivot
            print(f"Created {dname} at {[round(v, 3) for v in pivot.location]} with {len(created_parts)} parts")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("car_id")
    ap.add_argument("in_glb")
    ap.add_argument("out_glb")
    ap.add_argument("--open-preview", default=None)
    args = ap.parse_args()

    spec = CAR_SPECS[args.car_id]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.in_glb))

    if not spec.get("has_interior") and "interior_box" in spec:
        add_interior(spec["interior_box"])

    split_doors(spec)
    fix_materials()

    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out_glb), export_format="GLB")
    print("Exported", args.out_glb)

    if args.open_preview:
        sign = spec.get("front_sign", -1)
        for ob in bpy.data.objects:
            if ob.name in ("door_fl", "door_rl"):
                ob.rotation_euler.z = math.radians(58 * sign)
            elif ob.name in ("door_fr", "door_rr"):
                ob.rotation_euler.z = math.radians(-58 * sign)
        bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.open_preview), export_format="GLB")
        print("Exported open preview", args.open_preview)


main()
