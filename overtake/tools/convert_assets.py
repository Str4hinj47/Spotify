"""Convert the user's Drive .blend cars into normalized, game-ready GLBs.

Run with Blender's Python module (bpy). Geometry is preserved from the source
models; modifiers are evaluated, meshes are joined, and materials are rebuilt as
lightweight PBR so the cars render reliably in WebGL.
"""
from __future__ import annotations

import bpy
import json
import math
import re
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "models"
OUT.mkdir(parents=True, exist_ok=True)

# Normalized Blender space: X = width, Y = length (front +Y), Z = up.
# glTF export (Y-up) then maps front +Y -> -Z, which is the game's forward axis.
SPECS = {
    "golf": {
        "path": ROOT / "source-assets/golf/GolfMK4-Cycles-Jay-Hardy-2011.blend",
        "length": 4.15,
        "paint": (0.62, 0.67, 0.72),
        "transform": Matrix(((0, 1, 0), (-1, 0, 0), (0, 0, 1))),
    },
    "mercedes": {
        "path": Path("/home/user/Spotify/google_drive/MB.W222.AMG.blend"),
        "length": 5.25,
        "paint": (0.035, 0.04, 0.05),
        "transform": Matrix(((-1, 0, 0), (0, -1, 0), (0, 0, 1))),
    },
    "audi": {
        "path": Path("/home/user/Spotify/google_drive/Audi_RS_6_Avant_Not+Applied.blend"),
        "length": 4.99,
        "paint": (0.42, 0.46, 0.49),
        "transform": Matrix.Identity(3),
    },
    "mustang": {
        "path": ROOT / "source-assets/mustang/Mustang/Mustang.blend",
        "length": 4.78,
        "paint": (0.02, 0.16, 0.48),
        "transform": Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1))),
    },
    "ferrari": {
        "path": ROOT / "source-assets/ferrari/ferrari_studio.blend",
        "length": 4.57,
        "paint": (0.62, 0.012, 0.018),
        "transform": Matrix(((-1, 0, 0), (0, -1, 0), (0, 0, 1))),
    },
}

EXCLUDE_MAT = re.compile(r"^(ground|ground2|studiolight|studio|clay|diffuseblocker|defaultmat)", re.I)
# Only strip studio/helper geometry. Do NOT match the substring "light" here:
# the Golf's actual rear/headlight meshes are named "Rear-Lights",
# "Front-lights-glass", etc., and were previously deleted by mistake.
EXCLUDE_OBJ = re.compile(r"^(ground|studio|backdrop|floor|camera)", re.I)


def category(name: str) -> str:
    n = name.lower()
    # Light lenses/covers must be classified before generic glass, otherwise a
    # headlight cover becomes a dark window and a rear lamp lens disappears.
    if re.search(r"(tail|rear|brake|break).*(light|lamp|led|emission)|tailight|taillight|bumper.*light|small red lamp", n):
        return "taillight"
    if re.search(r"headlight|head.?light|front.?light|drl|main_light|lamps|led|emitter|light.?cover|glass.?light", n):
        return "headlight"
    if re.search(r"glass|windshield|window|polarized|tint", n):
        return "glass"
    if re.search(r"tyre|tire|wheel.?tread|^w222 - wheel$", n):
        return "tire"
    if re.search(r"chrome|mirror|reflect", n):
        return "chrome"
    if re.search(r"carbon|grill|grille", n):
        return "carbon"
    if re.search(r"(?<![a-z])rims?(?![a-z])|alloy|wheel.?centre|wheel.?center", n):
        return "rim"
    if re.search(r"brake|break_disc|breaks", n):
        return "brake"
    if re.search(r"interior|seat|dashboard|steering|wiper|plastic|trim|rubber|black|dark|undercarriage|bottom|exhaust", n):
        return "trim"
    if re.search(r"plate|numberplate", n):
        return "plate"
    if re.search(r"photo|texture", n):
        return "photo"
    if re.search(r"logo|badge|horse|ferrari.?text|pinifarnia|vw", n):
        return "logo"
    if re.search(r"paint|body|carpaint|car color|mainbody|frontbumper|rear_bumper|hood|roof", n):
        return "paint"
    return "other"


def first_color_image(mat: bpy.types.Material):
    if not mat.use_nodes:
        return None
    bad = re.compile(r"normal|bump|rough|height|displace|alpha|spec", re.I)
    for node in mat.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image and node.image.size[0] > 0:
            if not bad.search(node.image.name) and not bad.search(node.image.filepath or ""):
                return node.image
    return None


def make_material(src: bpy.types.Material, paint_rgb, cache: dict):
    if src.name in cache:
        return cache[src.name]
    cat = category(src.name)
    mat = bpy.data.materials.new(name=f"{cat}__{src.name}")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    out = nt.nodes.get("Material Output")
    bsdf.location = (0, 0)
    out.location = (300, 0)

    base = (0.5, 0.5, 0.5)
    metallic, rough = 0.0, 0.5
    alpha = 1.0
    emission = (0, 0, 0)
    emission_strength = 0.0

    if cat == "paint":
        base, metallic, rough = paint_rgb, 0.65, 0.28
        if "Coat Weight" in bsdf.inputs:
            bsdf.inputs["Coat Weight"].default_value = 0.8
    elif cat == "glass":
        base, metallic, rough, alpha = (0.05, 0.08, 0.11), 0.1, 0.08, 0.55
    elif cat == "chrome":
        base, metallic, rough = (0.85, 0.87, 0.9), 1.0, 0.12
    elif cat == "rim":
        base, metallic, rough = (0.55, 0.57, 0.6), 0.95, 0.25
    elif cat == "tire":
        base, metallic, rough = (0.018, 0.018, 0.02), 0.0, 0.85
    elif cat == "brake":
        base, metallic, rough = (0.35, 0.05, 0.04), 0.7, 0.4
    elif cat == "carbon":
        base, metallic, rough = (0.025, 0.025, 0.03), 0.2, 0.55
    elif cat == "trim":
        base, metallic, rough = (0.035, 0.035, 0.04), 0.1, 0.6
    elif cat == "taillight":
        base, metallic, rough = (0.45, 0.01, 0.01), 0.1, 0.25
        emission, emission_strength = (0.9, 0.02, 0.01), 1.2
    elif cat == "headlight":
        base, metallic, rough = (0.9, 0.92, 0.95), 0.1, 0.15
        emission, emission_strength = (0.95, 0.97, 1.0), 1.5
    elif cat == "plate":
        base, metallic, rough = (0.85, 0.85, 0.82), 0.0, 0.5
    elif cat == "photo":
        base, metallic, rough = (0.5, 0.5, 0.5), 0.2, 0.45
    elif cat == "logo":
        base, metallic, rough = (0.7, 0.7, 0.7), 0.6, 0.3
    else:
        base, metallic, rough = tuple(src.diffuse_color[:3]), 0.2, 0.5

    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Alpha"].default_value = alpha
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        try:
            mat.blend_method = "BLEND"
        except Exception:
            pass
        try:
            mat.surface_render_method = "BLENDED"
        except Exception:
            pass
        mat.use_backface_culling = False

    # Preserve useful color textures (photo trim, badges, plates, light lenses).
    if cat in {"photo", "logo", "plate", "taillight", "headlight", "tire"}:
        img = first_color_image(src)
        if img is not None:
            try:
                if max(img.size) > 1024:
                    ratio = 1024 / max(img.size)
                    img.scale(max(1, int(img.size[0] * ratio)), max(1, int(img.size[1] * ratio)))
            except Exception:
                pass
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = img
            tex.location = (-320, 0)
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
            if cat in {"taillight", "headlight"}:
                nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    cache[src.name] = mat
    return mat


def evaluated_bounds(obj, depsgraph, transform):
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    if me is None or len(me.vertices) == 0:
        ev.to_mesh_clear()
        return None
    mw = transform @ obj.matrix_world
    pts = [mw @ v.co for v in me.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ev.to_mesh_clear()
    return lo, hi, (lo + hi) / 2


def convert(key: str, spec: dict):
    bpy.ops.wm.open_mainfile(filepath=str(spec["path"]), load_ui=False)
    # Reduce subdivision to keep the game light while preserving silhouettes.
    for obj in bpy.data.objects:
        for mod in obj.modifiers:
            if mod.type == "SUBSURF":
                mod.levels = min(mod.levels, 1)
                mod.render_levels = min(mod.render_levels, 1)
            if mod.type == "MIRROR" and spec.get("disable_mirror"):
                mod.show_viewport = False
                mod.show_render = False
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    transform = spec["transform"].to_4x4()

    candidates = []
    for obj in list(bpy.data.objects):
        if obj.type != "MESH" or obj.hide_render:
            continue
        if EXCLUDE_OBJ.search(obj.name):
            continue
        mats = [s.material for s in obj.material_slots if s.material]
        if mats and all(EXCLUDE_MAT.match(m.name) for m in mats):
            continue
        b = evaluated_bounds(obj, deps, transform)
        if b is None:
            continue
        candidates.append((obj, b))

    # Drop detached studio helpers / stray parts far from the main body cluster.
    if candidates:
        centers = [b[2] for _, b in candidates]
        med = Vector((sorted(c.x for c in centers)[len(centers)//2],
                      sorted(c.y for c in centers)[len(centers)//2],
                      sorted(c.z for c in centers)[len(centers)//2]))
        mads = []
        for axis in range(3):
            vals = sorted(abs(c[axis] - med[axis]) for c in centers)
            mads.append(vals[len(vals)//2])
        kept = []
        for obj, b in candidates:
            c = b[2]
            if all(abs(c[i] - med[i]) <= max(2.0, 6.0 * mads[i] + 0.5) for i in range(3)):
                kept.append((obj, b))
            else:
                print("  drop outlier", obj.name, [round(v, 2) for v in c])
        candidates = kept or candidates

    lo = Vector((min(b[0].x for _, b in candidates), min(b[0].y for _, b in candidates), min(b[0].z for _, b in candidates)))
    hi = Vector((max(b[1].x for _, b in candidates), max(b[1].y for _, b in candidates), max(b[1].z for _, b in candidates)))
    size = hi - lo
    scale = spec["length"] / max(size.y, 1e-6)
    center = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    norm = Matrix.Translation(-center) @ transform
    norm = Matrix.Diagonal((scale, scale, scale, 1)) @ norm

    cache = {}
    new_objs = []
    for obj, _ in candidates:
        ev = obj.evaluated_get(deps)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=deps)
        if me is None or len(me.vertices) == 0:
            continue
        me.transform(norm @ obj.matrix_world)
        # Rebuild materials on the evaluated mesh. Capture face -> slot mapping
        # before touching slots (some source files link slots to the object).
        src_mats = [s.material for s in obj.material_slots]
        face_slots = [p.material_index for p in me.polygons]
        me.materials.clear()
        for src in src_mats:
            if src is None:
                me.materials.append(make_material(bpy.data.materials.new("Unknown"), spec["paint"], cache))
            else:
                me.materials.append(make_material(src, spec["paint"], cache))
        for p, slot in zip(me.polygons, face_slots):
            p.material_index = min(slot, max(0, len(me.materials) - 1))
        new_obj = bpy.data.objects.new(name=f"{key}_{obj.name}", object_data=me)
        bpy.context.collection.objects.link(new_obj)
        new_objs.append(new_obj)

    bpy.ops.object.select_all(action="DESELECT")
    for o in new_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new_objs[0]
    bpy.ops.object.join()
    car = bpy.context.view_layer.objects.active
    car.name = f"{key}_car"
    car.data.name = f"{key}_mesh"
    # Remove doubles introduced by overlapping source parts.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()

    # Keep traffic clones affordable: cap dense source meshes at ~150k triangles.
    tris_now = sum(len(p.vertices) - 2 for p in car.data.polygons)
    if tris_now > 150_000:
        dec = car.modifiers.new("GameLOD", "DECIMATE")
        dec.ratio = 150_000 / tris_now
        dec.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=dec.name)

    dest = OUT / f"{key}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(dest),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_cameras=False,
        export_lights=False,
    )
    tris = sum(len(p.vertices) - 2 for p in car.data.polygons)
    dims = car.dimensions
    info = {
        "id": key,
        "file": f"models/{key}.glb",
        "bytes": dest.stat().st_size,
        "triangles": tris,
        "dimensions": [round(v, 3) for v in dims],
        "source": spec["path"].name,
    }
    print(key, json.dumps(info))
    return info


def main():
    report = {}
    for key, spec in SPECS.items():
        print("\n===", key, "===")
        report[key] = convert(key, spec)
    (OUT / "manifest.json").write_text(json.dumps(report, indent=2))
    print("\nDone", json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
