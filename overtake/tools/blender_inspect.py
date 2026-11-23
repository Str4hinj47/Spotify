#!/usr/bin/env python3
"""Dump the object/material hierarchy of a car GLB inside Blender.

Usage: source tools/blender_env.sh && python3 tools/blender_inspect.py public/models/mercedes.glb
"""
import sys, os
import bpy

path = os.path.abspath(sys.argv[1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)

print("OBJECTS: %d" % len(bpy.data.objects))
for ob in sorted(bpy.data.objects, key=lambda o: o.name):
    if ob.type != 'MESH':
        print("  %-46s type=%s" % (ob.name, ob.type))
        continue
    me = ob.data
    mats = [m.name if m else "<None>" for m in ob.material_slots]
    dims = [round(v, 3) for v in ob.dimensions]
    loc = [round(v, 3) for v in ob.location]
    print("  %-46s verts=%-7d tris=%-7d dims=%s loc=%s" % (
        ob.name, len(me.vertices), len(me.polygons), dims, loc))
    print("      materials: %s" % (mats if len(mats) <= 4 else mats[:4] + ["+%d" % (len(mats) - 4)]))
    print("      parent=%s  collections=%s" % (
        ob.parent.name if ob.parent else None,
        [c.name for c in ob.users_collection]))

print("\nMATERIALS: %d" % len(bpy.data.materials))
for m in sorted(bpy.data.materials, key=lambda m: m.name):
    if not m.use_nodes:
        print("  %-42s (no nodes)" % m.name)
        continue
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    mix = m.node_tree.nodes.get("Mix Shader")
    extra = []
    if bsdf:
        for key, label in (("Base Color", "base"), ("Metallic", "met"), ("Roughness", "rough"),
                           ("Alpha", "alpha"), ("IOR", "ior")):
            try:
                v = bsdf.inputs[key].default_value
                extra.append("%s=%s" % (label, [round(x, 3) for x in v] if hasattr(v, "__len__") else round(v, 3)))
            except Exception:
                pass
    print("  %-42s blend=%s alpha_clip=%s use_backface=%s %s%s" % (
        m.name, m.blend_method, m.use_backface_culling, m.show_transparent_back,
        " ".join(extra), "  [+MixShader]" if mix else ""))
