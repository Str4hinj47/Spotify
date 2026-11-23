#!/usr/bin/env python3
"""Studio-render a car GLB from a list of camera views with Cycles (CPU).

Usage:
  source tools/blender_env.sh
  python3 tools/blender_render.py <plain.glb> <outdir> [--res 900] [--samples 64] \
      [--views front,front34,side,rear34,rear,top,low34,interior,cabin_left,cabin_right]

The car is imported as authored (no re-scaling) so the renders match the game's
own coordinates: +Z forward, +X left, +Y up, origin on the ground.
"""
import sys, os, math, argparse
import bpy
from mathutils import Vector

# azimuth degrees measured from +Z (car nose) going towards +X (car's left)
VIEWS = {
    "front":        (0,   8,  9.2),
    "front34":      (35,  12, 9.2),
    "side_left":    (90,  6,  9.0),
    "side_right":   (270, 6,  9.0),
    "rear34":       (145, 12, 9.2),
    "rear":         (180, 8,  9.2),
    "top":          (35,  62, 10.0),
    "low_front34":  (30,  -4, 8.6),
    "low_rear34":   (150, -4, 8.6),
    "wheel_front":  (55,  -6, 4.2),
    "interior":     (25,  14, 0.0),   # special: camera inside the cabin
}


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_studio():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.film_transparent = False
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("studio")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.055, 0.062, 0.075, 1.0)
    bg.inputs[1].default_value = 1.0

    def area(name, energy, loc, rot, size):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size[0]
        light.size_y = size[1]
        light.spread = math.radians(120)
        ob = bpy.data.objects.new(name, light)
        ob.location = loc
        ob.rotation_euler = [math.radians(a) for a in rot]
        bpy.context.scene.collection.objects.link(ob)
        return ob

    # big soft key from front-left-high, fill from the right, rim from behind
    area("key", 900, (-6.0, 3.2, 6.5), (58, 0, -32), (7, 7))
    area("fill", 420, (6.5, -1.0, 3.4), (72, 0, 28), (6, 6))
    area("rim", 620, (0.5, -7.5, 3.6), (70, 0, 178), (8, 5))
    area("under", 90, (0.0, 0.0, -1.2), (180, 0, 0), (6, 12))

    # shadow-catcher ground
    ground = bpy.data.meshes.new("ground")
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    bm.to_mesh(ground)
    bm.free()
    gob = bpy.data.objects.new("ground", ground)
    bpy.context.scene.collection.objects.link(gob)
    mat = bpy.data.materials.new("ground_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.045, 0.048, 0.055, 1)
    bsdf.inputs["Roughness"].default_value = 0.42
    bsdf.inputs["Metallic"].default_value = 0.0
    gob.data.materials.append(mat)


def frame_camera(cam_ob, target, distance, az_deg, el_deg):
    az = math.radians(az_deg)
    el = math.radians(el_deg)
    # Blender space after glTF import: -Y forward, +X right, +Z up
    x = target.x + math.sin(az) * math.cos(el) * distance
    y = target.y - math.cos(az) * math.cos(el) * distance
    z = target.z + math.sin(el) * distance
    cam_ob.location = (x, y, z)
    direction = target - cam_ob.location
    rot = direction.to_track_quat("-Z", "Y").to_euler()
    cam_ob.rotation_euler = rot


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("glb")
    ap.add_argument("outdir")
    ap.add_argument("--res", type=int, default=900)
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--views", default="front,front34,side_left,side_right,rear34,rear,top")
    ap.add_argument("--prefix", default="view")
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    clear_scene()
    build_studio()
    bpy.context.scene.cycles.samples = args.samples
    bpy.context.scene.render.resolution_x = args.res
    bpy.context.scene.render.resolution_y = int(args.res * 0.62)
    bpy.context.scene.render.image_settings.file_format = "PNG"

    bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.glb))
    cars = [o for o in bpy.data.objects if o.type == "MESH" and o.name != "ground"]
    # overall bounds
    import mathutils
    lo = mathutils.Vector((1e9, 1e9, 1e9))
    hi = mathutils.Vector((-1e9, -1e9, -1e9))
    for ob in cars:
        for corner in ob.bound_box:
            w = ob.matrix_world @ mathutils.Vector(corner)
            lo.x, lo.y, lo.z = min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)
            hi.x, hi.y, hi.z = max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)
    center = (lo + hi) / 2
    target = mathutils.Vector((center.x, center.y, center.z))
    print("bounds lo=%s hi=%s center=%s" % ([round(v, 3) for v in lo], [round(v, 3) for v in hi],
                                            [round(v, 3) for v in center]))

    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam_ob = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam_ob)
    bpy.context.scene.camera = cam_ob

    for name in args.views.split(","):
        name = name.strip()
        if name not in VIEWS:
            print("unknown view", name); continue
        az, el, dist = VIEWS[name]
        if name == "interior":
            # put the camera at the driver's eye point, looking forward-left
            cam_ob.location = (-0.38, 1.14, 0.15)
            cam_ob.rotation_euler = [math.radians(a) for a in (86, 0, 8)]
            cam_data.lens = 26
        else:
            cam_data.lens = 50
            frame_camera(cam_ob, target, dist, az, el)
        out = os.path.join(args.outdir, "%s_%s.png" % (args.prefix, name))
        bpy.context.scene.render.filepath = out
        bpy.ops.render.render(write_still=True)
        print("rendered", out)


main()
