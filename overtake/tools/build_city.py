#!/usr/bin/env python3
"""Procedural city asset pack for OVERTAKE (public/models/city/city.glb).

Designs 24 unique buildings — storefronts, apartments, civic blocks and
towers — plus a park fountain, a bench and a parking sign. Everything is
modelled in Blender (via the bpy module) and exported as one glTF binary
that the game loads at runtime. Geometry stays low-poly but with real
silhouettes: parapets, gables, porticos, setbacks, awnings and roof props.

Usage:
  /path/to/bpyvenv/bin/python overtake/tools/build_city.py

Requires: `bpy` and `pillow` in the venv (pip install bpy pillow).
No internet access or .blend inputs are needed; textures are generated here.
The outputs are committed to public/models/city/city.glb.
"""
import bpy
import math
import os
import random
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'public', 'models', 'city', 'city.glb')
FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

# --------------------------------------------------------------------------
# Textures (Pillow, generated). Kept near-white so material tints multiply
# cleanly; mortar/shadow detail lives in the image.
# --------------------------------------------------------------------------
def make_textures(tmpdir):
    from PIL import Image, ImageDraw, ImageFilter
    import random

    def noise_overlay(img, strength=26):
        rnd = random.Random(1234)
        px = img.load()
        for y in range(img.height):
            for x in range(img.width):
                r, g, b = px[x, y]
                n = rnd.randint(-strength, strength)
                px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
        return img

    # Brick: warm light-gray bricks, darker mortar, slight per-brick value shift.
    S = 512
    img = Image.new('RGB', (S, S), (176, 172, 166))
    d = ImageDraw.Draw(img)
    rnd = random.Random(77)
    bh, bw = 32, 84
    for row in range(S // bh):
        offset = (row % 2) * (bw // 2)
        for col in range(-1, S // bw + 1):
            x0 = col * bw + offset
            shade = rnd.randint(196, 232)
            d.rectangle([x0 + 2, row * bh + 2, x0 + bw - 2, (row + 1) * bh - 2],
                        fill=(shade, int(shade * 0.96), int(shade * 0.90)))
    img = noise_overlay(img, 18)
    img.save(os.path.join(tmpdir, 'brick.png'))

    # Stucco: soft plaster speckle.
    img = Image.new('RGB', (S, S), (226, 224, 218))
    d = ImageDraw.Draw(img)
    rnd = random.Random(91)
    for _ in range(9000):
        x, y = rnd.randrange(S), rnd.randrange(S)
        v = rnd.randint(190, 255)
        d.point((x, y), fill=(v, v, v))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    noise_overlay(img, 8).save(os.path.join(tmpdir, 'stucco.png'))

    # Concrete: panel seams + speckle.
    img = Image.new('RGB', (S, S), (214, 214, 210))
    d = ImageDraw.Draw(img)
    for i in range(1, 4):
        d.line([(i * S // 4, 0), (i * S // 4, S)], fill=(150, 150, 146), width=3)
        d.line([(0, i * S // 4), (S, i * S // 4)], fill=(150, 150, 146), width=3)
    img = noise_overlay(img, 20)
    img.save(os.path.join(tmpdir, 'concrete.png'))

    # Corrugated metal: vertical rib shading.
    img = Image.new('RGB', (S, S), (226, 228, 230))
    d = ImageDraw.Draw(img)
    for x in range(0, S, 16):
        d.rectangle([x, 0, x + 5, S], fill=(168, 170, 174))
        d.rectangle([x + 5, 0, x + 8, S], fill=(240, 242, 244))
    img = noise_overlay(img, 10)
    img.save(os.path.join(tmpdir, 'corrugated.png'))

    paths = {n: os.path.join(tmpdir, f'{n}.png') for n in ['brick', 'stucco', 'concrete', 'corrugated']}
    return paths

# --------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------
_mat_cache = {}

def set_image_srgb(img):
    try:
        img.colorspace_settings.name = 'sRGB'
    except Exception:
        pass

def facade_material(name, texture_path, tint, roughness=0.92):
    key = ('facade', name)
    if key in _mat_cache:
        return _mat_cache[key]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(texture_path, check_existing=True)
    set_image_srgb(tex.image)
    tex.extension = 'REPEAT'
    bsdf.inputs['Base Color'].default_value = (*tint, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0.0
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    _mat_cache[key] = mat
    return mat

def solid_material(name, color, roughness=0.8, metallic=0.0, emission=None, emission_strength=0.0):
    key = ('solid', name)
    if key in _mat_cache:
        return _mat_cache[key]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    _mat_cache[key] = mat
    return mat

# Common shared materials (created lazily in main()).
M = {}

def hexcol(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

# --------------------------------------------------------------------------
# Geometry helpers. All parts are built around the origin; each building is
# joined into a single mesh before export. Front face = +Y in Blender, which
# maps to -Z in glTF (what the game expects for rotation.y = 0).
# --------------------------------------------------------------------------

def scale_uvs(obj, tile=4.0):
    """Scale box UVs so texture density is uniform in world units."""
    mesh = obj.data
    if not mesh.uv_layers:
        return
    uv = mesh.uv_layers.active.data
    from mathutils import Vector
    dims = Vector(obj.dimensions)
    for poly in mesh.polygons:
        n = poly.normal
        if abs(n.x) > 0.5:
            su, sv = dims.y / tile, dims.z / tile
        elif abs(n.y) > 0.5:
            su, sv = dims.x / tile, dims.z / tile
        else:
            su, sv = dims.x / tile, dims.y / tile
        for li in poly.loop_indices:
            uv[li].uv = (uv[li].uv.x * su, uv[li].uv.y * sv)

def add_box(name, w, d, h, x, y, z, material, uv_tile=None):
    """Axis-aligned box centred on (x, y, z).

    Convention: w = X extent (facade width), d = Y extent (footprint depth),
    h = Z extent (height). Blender is Z-up and the exporter maps Blender +Y to
    glTF -Z, so z here is the real vertical axis.
    """
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    if uv_tile:
        scale_uvs(obj, uv_tile)
    return obj

def add_cyl(name, r_bottom, r_top, depth, x, y, z, material, segments=16):
    bpy.ops.mesh.primitive_cone_add(vertices=segments, radius1=r_bottom, radius2=r_top, depth=depth, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return obj

def prism_from_pydata(name, verts, faces, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if material:
        mesh.materials.append(material)
    return obj

def gable_roof(name, w, d, h, z, material):
    """A simple gable (triangular prism) sitting on top of a wall box."""
    hw, hd = w / 2, d / 2
    verts = [(-hw, -hd, z), (hw, -hd, z), (0, -hd, z + h),
             (-hw, hd, z), (hw, hd, z), (0, hd, z + h)]
    faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (2, 1, 4, 5), (0, 2, 5, 3)]
    return prism_from_pydata(name, verts, faces, material)

def hip_roof(name, w, d, h, z, material):
    hw, hd = w / 2, d / 2
    ridge = min(hw, hd) * 0.55
    verts = [(-hw, -hd, z), (hw, -hd, z), (hw, hd, z), (-hw, hd, z),
             (-ridge, 0, z + h), (ridge, 0, z + h)]
    faces = [(0, 1, 4), (1, 5, 4), (1, 2, 5), (2, 3, 5), (3, 4, 5), (3, 0, 4)]
    return prism_from_pydata(name, verts, faces, material)

def pediment(name, w, h, d, z, material):
    hw = w / 2
    verts = [(-hw, -d / 2, z), (hw, -d / 2, z), (0, -d / 2, z + h),
             (-hw, d / 2, z), (hw, d / 2, z), (0, d / 2, z + h)]
    faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (2, 1, 4, 5), (0, 2, 5, 3)]
    return prism_from_pydata(name, verts, faces, material)

def make_text(name, body, size, location, material, extrude=0.09):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.size = size
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    # Sign text is read at a distance, so keep the glyph tessellation lean:
    # at resolution 6 the extruded lettering alone was ~80k triangles.
    curve.resolution_u = 2
    curve.extrude = extrude
    curve.bevel_depth = 0.0
    if hasattr(curve, 'bevel_resolution'):
        curve.bevel_resolution = 0
    if os.path.exists(FONT_PATH):
        curve.font = bpy.data.fonts.load(FONT_PATH)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    if material:
        curve.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    return bpy.context.view_layer.objects.active

def ac_unit(name, x, y, z, size=0.9):
    return add_box(name, size, size * 0.72, size, x, y, z, M['trim_dark'])

def parapet(x_w, y_d, z_top, thickness, height, material):
    """Four thin boxes forming a roof parapet."""
    parts = []
    hw, hd = x_w / 2, y_d / 2
    parts.append(add_box('parapet_f', x_w + thickness, thickness, height, 0, hd, z_top + height / 2, material))
    parts.append(add_box('parapet_b', x_w + thickness, thickness, height, 0, -hd, z_top + height / 2, material))
    parts.append(add_box('parapet_l', thickness, y_d + thickness, height, -hw, 0, z_top + height / 2, material))
    parts.append(add_box('parapet_r', thickness, y_d + thickness, height, hw, 0, z_top + height / 2, material))
    return parts

def window_grid(w, d, wall_h, floors, y0, bays, glass, trim, style='punch', margin=1.1, floor_h=None):
    """Punch windows on front and back faces. Returns list of created objects."""
    created = []
    bw = (w - 2 * margin) / bays
    fh = floor_h if floor_h else (wall_h - 1.0) / floors
    for f in range(floors):
        z = y0 + fh * (f + 0.62)
        for b in range(bays):
            x = -w / 2 + margin + bw * (b + 0.5)
            if style == 'punch':
                ww, wh = min(1.5, bw * 0.55), min(1.9, fh * 0.52)
                created.append(add_box('win', ww, 0.07, wh, x, d / 2 + 0.012, z, trim))
                created.append(add_box('winglass', ww - 0.16, 0.06, wh - 0.16, x, d / 2 + 0.045, z, glass))
                created.append(add_box('winb', ww, 0.07, wh, x, -d / 2 - 0.012, z, trim))
                created.append(add_box('winglassb', ww - 0.16, 0.06, wh - 0.16, x, -d / 2 - 0.045, z, glass))
                # sill
                created.append(add_box('sill', ww + 0.16, 0.08, 0.12, x, d / 2 + 0.05, z - wh / 2 - 0.05, trim))
            elif style == 'tall':
                ww, wh = min(1.15, bw * 0.42), fh * 0.72
                created.append(add_box('win', ww, 0.06, wh, x, d / 2 + 0.010, z, trim))
                created.append(add_box('winglass', ww - 0.14, 0.05, wh - 0.14, x, d / 2 + 0.04, z, glass))
                created.append(add_box('winb', ww, 0.06, wh, x, -d / 2 - 0.010, z, trim))
                created.append(add_box('winglassb', ww - 0.14, 0.05, wh - 0.14, x, -d / 2 - 0.04, z, glass))
    return created

def side_windows(w, d, wall_h, floors, y0, glass, trim):
    """Simple side-face windows (both sides), skipping storefront height."""
    created = []
    bays = max(1, int((d - 2 * 1.2) // 2.6))
    fh = (wall_h - 1.0) / floors
    for f in range(floors):
        z = y0 + fh * (f + 0.62)
        for b in range(bays):
            y = -d / 2 + 1.2 + (d - 2.4) * (b + 0.5) / bays
            wh = min(1.9, fh * 0.5)
            ww = 1.4
            for s in (1, -1):
                created.append(add_box('swin', 0.05, ww, wh, s * (w / 2 + 0.035), y, z, glass))
                created.append(add_box('ssill', 0.08, ww + 0.14, 0.1, s * (w / 2 + 0.06), y, z - wh / 2 - 0.05, trim))
    return created

def storefront(w, d, glass, frame, awning_mat, sign_mat, sign_text, awning_color, door_w=1.3):
    """Ground floor: big glass, recessed door, fascia band, sloped awning, sign text."""
    created = []
    hw = w / 2
    gh = 3.15  # storefront glass height
    gz = 1.65
    # Glass wall segments with door gap in the middle.
    side_w = (w - 0.6 - door_w) / 2
    for s in (1, -1):
        cx = s * (door_w / 2 + side_w / 2 + 0.1)
        created.append(add_box('shopfront', side_w, 0.1, gh, cx, d / 2 + 0.03, gz, frame))
        created.append(add_box('shopglass', side_w - 0.14, 0.05, gh - 0.14, cx, d / 2 + 0.075, gz, glass))
    # Door: recessed dark panel + frame.
    created.append(add_box('door', door_w + 0.24, 0.14, gh + 0.15, 0, d / 2 + 0.01, (gh + 0.15) / 2, frame))
    created.append(add_box('doorpanel', door_w, 0.06, gh - 0.1, 0, d / 2 + 0.085, gh / 2, glass))
    # Fascia band above storefront.
    created.append(add_box('fascia', w, 0.16, 0.62, 0, d / 2 + 0.06, gh + 0.42, frame))
    # Sloped awning.
    awn = add_box('awning', w - 1.6, 1.15, 0.14, 0, d / 2 + 0.72, gh + 0.02, awning_mat)
    awn.rotation_euler = (math.radians(-22), 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    created.append(awn)
    # Sign text on the fascia.
    try:
        t = make_text('sign', sign_text, 0.44, (0, d / 2 + 0.17, gh + 0.42), sign_mat, 0.06)
        created.append(t)
    except Exception as e:
        print(f'  [warn] sign text skipped ({e})')
    return created

# --------------------------------------------------------------------------
# Building archetypes
# --------------------------------------------------------------------------

def join_parts(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        if p is not None:
            p.select_set(True)
    active = next((p for p in parts if p is not None), None)
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    # Bake the joined object's transform into the vertices, then place the
    # origin at the world origin. Assigning location directly would move the
    # whole building: the active part's origin is its own centre, not 0,0,0.
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.location = (0, 0, 0)
    return obj

def roof_extras(parts, seed, w, d, z, water_tower=False, antenna=False):
    rnd = random.Random(seed)
    for i in range(rnd.randint(1, 3)):
        ac_unit(f'ac{i}', rnd.uniform(-w * 0.3, w * 0.3), rnd.uniform(-d * 0.3, d * 0.3), z + 0.32, rnd.uniform(0.7, 1.15))
    if water_tower:
        add_cyl('wt_tank', 0.95, 0.8, 1.6, w * 0.22, -d * 0.2, z + 1.85, M['roof_wood'], 12)
        add_cyl('wt_cone', 1.02, 0.0, 0.7, w * 0.22, -d * 0.2, z + 3.0, M['trim_dark'], 12)
        for j in range(4):
            a = j * math.pi / 2 + math.pi / 4
            add_cyl('wt_leg', 0.07, 0.07, 1.3, w * 0.22 + math.cos(a) * 0.62, -d * 0.2 + math.sin(a) * 0.62, z + 0.62, M['trim_dark'], 6)
    if antenna:
        add_cyl('antenna', 0.05, 0.02, 2.6, -w * 0.28, d * 0.22, z + 1.3, M['trim_dark'], 6)

def shop(key, w, d, upper_floors, tex, tint, awning, sign, seed, awning_everywhere=True):
    """Two-to-three storey commercial building with a ground-floor storefront."""
    gh = 3.7
    fh = 3.05
    wall_h = gh + upper_floors * fh
    facade = facade_material(f'facade_{key}', TEX[tex], hexcol(tint), 0.9 if tex != 'concrete' else 0.85)
    parts = [add_box('shell', w, d, wall_h, 0, 0, wall_h / 2, facade, uv_tile=4.0 if tex == 'brick' else 3.0)]
    if upper_floors > 0:
        parts += window_grid(w, d, wall_h, upper_floors, gh, max(2, int(w // 2.35)), M['glass'], M['trim_dark'], style='punch', margin=0.9)
        parts += side_windows(w, d, wall_h, upper_floors, gh, M['glass'], M['trim_dark'])
    # Cornice between storefront and upper floors.
    parts.append(add_box('cornice1', w + 0.3, d + 0.3, 0.22, 0, 0, gh + 0.02, M['trim_light']))
    # Parapet + cap.
    parts += parapet(w, d, wall_h, 0.18, 0.75, facade)
    parts += [add_box('roofcap', w + 0.42, d + 0.42, 0.24, 0, 0, wall_h + 0.12, M['trim_light'])]
    roof_extras(parts, seed, w, d, wall_h + 0.24)
    parts += storefront(w, d, M['shopglass'], M['trim_dark'], awning, M['sign_cream'], sign, awning, door_w=1.35)
    return join_parts(parts, f'bldg_{key}')

def apartment(key, w, d, floors, tex, tint, seed, bulkhead=True):
    fh = 3.0
    wall_h = floors * fh + 0.4
    facade = facade_material(f'facade_{key}', TEX[tex], hexcol(tint), 0.92)
    parts = [add_box('shell', w, d, wall_h, 0, 0, wall_h / 2, facade, uv_tile=4.0)]
    parts += window_grid(w, d, wall_h, floors, 0.4, max(3, int(w // 2.5)), M['glass'], M['trim_dark'], style='punch', margin=1.2)
    parts += side_windows(w, d, wall_h, floors, 0.4, M['glass'], M['trim_dark'])
    parts += parapet(w, d, wall_h, 0.2, 0.85, facade)
    parts.append(add_box('roofcap', w + 0.5, d + 0.5, 0.26, 0, 0, wall_h + 0.13, M['trim_light']))
    # Ground floor entrance.
    parts.append(add_box('entry', 1.6, 0.3, 2.4, 0, d / 2 + 0.02, 1.2, M['trim_dark']))
    parts.append(add_box('entryglass', 1.3, 0.1, 2.1, 0, d / 2 + 0.12, 1.15, M['shopglass']))
    if bulkhead:
        parts.append(add_box('stairbulk', 3.4, 2.6, 2.2, w * 0.18, -d * 0.12, wall_h + 1.1, facade, uv_tile=4.0))
        parts.append(add_box('bulkcap', 3.7, 2.9, 0.22, w * 0.18, -d * 0.12, wall_h + 2.28, M['trim_light']))
    roof_extras(parts, seed, w, d, wall_h + 0.25, water_tower=(seed % 3 == 0))
    return join_parts(parts, f'bldg_{key}')

def rowhouse(key, w, d, floors, tex, tint, seed, dormer=True):
    wall_h = floors * 2.95 + 0.3
    facade = facade_material(f'facade_{key}', TEX[tex], hexcol(tint), 0.9)
    parts = [add_box('shell', w, d, wall_h, 0, 0, wall_h / 2, facade, uv_tile=4.0)]
    parts += window_grid(w, d, wall_h, floors, 0.3, 2, M['glass'], M['trim_dark'], style='tall', margin=0.85)
    parts.append(gable_roof('gable', w + 0.35, d + 0.35, 2.2, wall_h, M['roof_shingle']))
    parts.append(add_box('gableeave', w + 0.42, d + 0.42, 0.18, 0, 0, wall_h + 0.02, M['trim_light']))
    # Chimney.
    parts.append(add_box('chimney', 0.72, 0.72, 1.5, w * 0.28, -d * 0.18, wall_h + 2.1, facade, uv_tile=4.0))
    # Entrance + stoop.
    parts.append(add_box('door', 1.25, 0.25, 2.3, 0, d / 2 + 0.0, 1.25, M['trim_dark']))
    parts.append(add_box('stoop', 1.9, 0.75, 0.42, 0, d / 2 + 0.55, 0.21, M['trim_light']))
    if dormer:
        parts.append(add_box('dormer', 1.5, 1.2, 1.15, 0, d * 0.06, wall_h + 1.15, facade, uv_tile=4.0))
        parts.append(add_box('dormerwin', 0.9, 0.08, 0.6, 0, d * 0.06 + 0.55, wall_h + 1.1, M['glass']))
        parts.append(gable_roof('dormerroof', 1.8, 1.45, 0.75, wall_h + 1.72, M['roof_shingle']))
    return join_parts(parts, f'bldg_{key}')

def townhouse(key, w, d, floors, tex, tint, seed):
    wall_h = floors * 3.1 + 0.3
    facade = facade_material(f'facade_{key}', TEX[tex], hexcol(tint), 0.88)
    parts = [add_box('shell', w, d, wall_h, 0, 0, wall_h / 2, facade, uv_tile=4.0)]
    parts += window_grid(w, d, wall_h, floors, 0.3, 3, M['glass'], M['trim_dark'], style='tall', margin=0.95)
    parts.append(hip_roof('hip', w + 0.4, d + 0.4, 2.6, wall_h, M['roof_metal']))
    parts.append(add_box('hipeave', w + 0.5, d + 0.5, 0.2, 0, 0, wall_h + 0.02, M['trim_light']))
    parts.append(add_box('chimney', 0.8, 0.8, 1.7, -w * 0.26, d * 0.14, wall_h + 2.6, facade, uv_tile=4.0))
    parts.append(add_box('door', 1.4, 0.3, 2.5, 0, d / 2 + 0.0, 1.3, M['trim_dark']))
    parts.append(add_box('stoop', 2.1, 0.85, 0.45, 0, d / 2 + 0.6, 0.22, M['trim_light']))
    parts.append(add_box('entryarch', 2.3, 0.3, 0.5, 0, d / 2 + 0.1, 2.7, M['trim_light']))
    return join_parts(parts, f'bldg_{key}')

def bank(key, seed=11):
    w, d, wall_h = 17.0, 15.0, 10.2
    facade = facade_material('facade_bank', TEX['concrete'], hexcol('#cfc9b6'), 0.8)
    parts = [add_box('shell', w, d, wall_h, 0, 0, wall_h / 2, facade, uv_tile=5.0)]
    # Portico: platform, 6 columns, entablature, pediment.
    parts.append(add_box('steps1', 12.0, 2.2, 0.35, 0, d / 2 + 1.0, 0.17, M['trim_light']))
    parts.append(add_box('steps2', 11.2, 1.6, 0.35, 0, d / 2 + 0.9, 0.5, M['trim_light']))
    parts.append(add_box('steps3', 10.4, 1.0, 0.35, 0, d / 2 + 0.8, 0.82, M['trim_light']))
    for i in range(6):
        cx = -5.25 + i * 2.1
        parts.append(add_cyl(f'col{i}', 0.34, 0.38, 5.6, cx, d / 2 + 0.55, 0.98 + 2.8, M['trim_light'], 14))
        parts.append(add_box(f'cap{i}', 0.86, 0.86, 0.3, cx, d / 2 + 0.55, 6.9, M['trim_light']))
    parts.append(add_box('architrave', 12.4, 1.1, 1.05, 0, d / 2 + 0.5, 7.35, M['trim_light']))
    parts.append(pediment('pediment', 12.4, 2.15, 1.1, 7.9, facade))
    # Door + tall windows.
    parts.append(add_box('door', 2.5, 0.3, 3.4, 0, d / 2 + 0.12, 1.7, M['trim_dark']))
    parts.append(add_box('doorpanel', 2.1, 0.1, 2.9, 0, d / 2 + 0.24, 1.62, M['glass']))
    for i in (-1, 1):
        for k in (-3.4, -6.1):
            parts.append(add_box('bwin', 1.5, 0.14, 3.6, i * -k, d / 2 + 0.05, 2.6, M['trim_dark']))
            parts.append(add_box('bwinglass', 1.3, 0.06, 3.3, i * -k, d / 2 + 0.1, 2.6, M['glass']))
    # Hex cap roof + corner urns.
    add_cyl('hexcap', 4.6, 3.6, 1.5, 0, 0, wall_h + 0.75, facade, 6)
    parts += [add_box('roofcap', w + 0.6, d + 0.6, 0.3, 0, 0, wall_h + 0.15, M['trim_light'])]
    for i in range(4):
        cx = (-1 if i < 2 else 1) * (w / 2 - 0.7)
        cy = (-1 if i % 2 == 0 else 1) * (d / 2 - 0.7)
        parts.append(add_cyl(f'urn{i}', 0.16, 0.3, 0.75, cx, cy, wall_h + 0.65, M['trim_light'], 10))
    try:
        parts.append(make_text('sign', 'BANK', 0.85, (0, d / 2 + 1.12, 7.35), M['sign_dark'], 0.08))
    except Exception as e:
        print(f'  [warn] bank sign skipped ({e})')
    return join_parts(parts, f'bldg_{key}')

def office_slab(key, seed=21):
    w, d, floors = 26.0, 13.0, 7
    fh = 3.15
    wall_h = floors * fh + 0.3
    facade = facade_material('facade_office', TEX['concrete'], hexcol('#b7bcbe'), 0.78)
    parts = [add_box('shell', w, d, wall_h, 0, 0, wall_h / 2, facade, uv_tile=5.0)]
    # Ribbon windows with mullions per floor.
    for f in range(floors):
        z = 1.35 + fh * f + 1.05
        parts.append(add_box(f'ribbon{f}', w - 2.0, 0.09, 1.32, 0, d / 2 + 0.03, z, M['trim_dark']))
        parts.append(add_box(f'ribbonglass{f}', w - 2.24, 0.05, 1.08, 0, d / 2 + 0.075, z, M['glass']))
        parts.append(add_box(f'ribbonb{f}', w - 2.0, 0.09, 1.32, 0, -d / 2 - 0.03, z, M['trim_dark']))
        parts.append(add_box(f'ribbonglassb{f}', w - 2.24, 0.05, 1.08, 0, -d / 2 - 0.075, z, M['glass']))
    for i in range(11):
        x = -w / 2 + 1.0 + i * (w - 2.0) / 10
        parts.append(add_box(f'mull{i}f', 0.16, 0.12, wall_h - 1.0, x, d / 2 + 0.04, wall_h / 2 + 0.2, M['trim_dark']))
        parts.append(add_box(f'mull{i}b', 0.16, 0.12, wall_h - 1.0, x, -d / 2 - 0.04, wall_h / 2 + 0.2, M['trim_dark']))
    # Lobby.
    parts.append(add_box('lobby', 6.4, 0.25, 3.4, 0, d / 2 + 0.1, 1.7, M['trim_dark']))
    parts.append(add_box('lobbyglass', 5.9, 0.1, 2.9, 0, d / 2 + 0.2, 1.65, M['shopglass']))
    parts.append(add_box('roofcap', w + 0.55, d + 0.55, 0.3, 0, 0, wall_h + 0.15, M['trim_light']))
    parts += parapet(w, d, wall_h, 0.2, 0.55, facade)
    parts.append(add_box('overhang', 5.2, 1.6, 0.28, 0, d / 2 + 0.8, 3.6, M['trim_light']))
    roof_extras(parts, seed, w, d, wall_h + 0.3)
    parts.append(add_box('stairbulk', 4.2, 3.0, 2.3, -w * 0.22, -d * 0.1, wall_h + 1.15, facade, uv_tile=5.0))
    return join_parts(parts, f'bldg_{key}')

def glass_tower(key, seed=31):
    w, d, floors = 19.0, 19.0, 10
    fh = 3.0
    wall_h = floors * fh + 0.3
    parts = [add_box('shell', w, d, wall_h, 0, 0, wall_h / 2, M['curtain'], uv_tile=3.0)]
    # Curtain-wall mullion grid on all four faces.
    step = 1.58
    n = int(w // step)
    for i in range(n + 1):
        x = -w / 2 + i * (w / n)
        for s in (1, -1):
            parts.append(add_box('mullv', 0.12, 0.1, wall_h, x, s * (d / 2 + 0.045), wall_h / 2, M['trim_dark']))
            parts.append(add_box('mullv2', 0.1, d, wall_h, s * (w / 2 + 0.045), x, wall_h / 2, M['trim_dark']))
    for f in range(floors + 1):
        z = f * fh + 0.15
        for s in (1, -1):
            parts.append(add_box('mullh', w, 0.1, 0.16, 0, s * (d / 2 + 0.045), z, M['trim_dark']))
            parts.append(add_box('mullh2', 0.1, d, 0.16, s * (w / 2 + 0.045), 0, z, M['trim_dark']))
    # Setback crown + illuminated band.
    parts.append(add_box('crown', w * 0.62, d * 0.62, 3.4, 0, 0, wall_h + 1.7, M['curtain'], uv_tile=3.0))
    parts.append(add_box('crownband', w * 0.62 + 0.15, d * 0.62 + 0.15, 0.34, 0, 0, wall_h + 3.32, M['sign_glow']))
    parts.append(add_box('roofcap', w + 0.4, d + 0.4, 0.24, 0, 0, wall_h + 0.12, M['trim_dark']))
    return join_parts(parts, f'bldg_{key}')

def tower_setback(key, seed=41):
    w, d, low = 18.0, 18.0, 8
    fh = 3.0
    low_h = low * fh + 0.3
    facade = facade_material('facade_setback', TEX['brick'], hexcol('#8d6f5c'), 0.9)
    facade2 = facade_material('facade_setback2', TEX['concrete'], hexcol('#a9a49a'), 0.85)
    parts = [add_box('shell', w, d, low_h, 0, 0, low_h / 2, facade, uv_tile=4.0)]
    parts += window_grid(w, d, low_h, low, 0.25, 5, M['glass'], M['trim_dark'], style='punch', margin=1.35)
    parts += side_windows(w, d, low_h, low, 0.25, M['glass'], M['trim_dark'])
    up_w, up_d, up_floors = w * 0.62, d * 0.62, 3
    up_h = up_floors * fh + 0.2
    parts.append(add_box('setback', up_w, up_d, up_h, 0, -d * 0.06, low_h + up_h / 2, facade2, uv_tile=4.0))
    parts += window_grid(up_w, up_d, up_h, up_floors, low_h, 3, M['glass'], M['trim_dark'], style='punch', margin=1.0, floor_h=3.0)
    # Re-place upper windows on the setback block itself (offset).
    parts.append(add_box('setbackcap', up_w + 0.4, up_d + 0.4, 0.26, 0, -d * 0.06, low_h + up_h + 0.13, M['trim_light']))
    parts.append(add_box('cornice', w + 0.4, d + 0.4, 0.3, 0, 0, low_h + 0.06, M['trim_light']))
    add_cyl('hexcap2', 2.4, 1.6, 1.35, 0, -d * 0.06, low_h + up_h + 0.85, facade2, 6)
    roof_extras(parts, seed, w, d, low_h + 0.3)
    return join_parts(parts, f'bldg_{key}')

def diner(key, seed=51):
    w, d, wall_h = 13.0, 12.0, 4.6
    facade = facade_material('facade_diner', TEX['corrugated'], hexcol('#b9c2c9'), 0.55)
    parts = [add_box('shell', w, d, wall_h, 0, 0, wall_h / 2, facade, uv_tile=3.5)]
    # Ribbon glass on two faces + roadside sign pole.
    for s in (1, -1):
        parts.append(add_box(f'dinerglass{s}', w - 1.7, 0.1, 1.7, 0, s * (d / 2 + 0.05), 2.0, M['shopglass']))
        parts.append(add_box(f'dinerband{s}', w + 0.25, 0.14, 0.5, 0, s * (d / 2 + 0.06), 3.62, M['sign_red']))
    parts.append(add_box('roofcap', w + 0.4, d + 0.4, 0.26, 0, 0, wall_h + 0.13, M['trim_light']))
    parts += parapet(w, d, wall_h, 0.18, 0.4, facade)
    parts.append(add_box('signbase', 2.6, 0.5, 1.5, w / 2 - 0.1, d / 2 + 1.15, 2.7, M['trim_dark']))
    try:
        parts.append(make_text('sign', 'DINER', 0.52, (w / 2 - 0.1, d / 2 + 1.16, 2.72), M['sign_glow'], 0.08))
    except Exception as e:
        print(f'  [warn] diner sign skipped ({e})')
    return join_parts(parts, f'bldg_{key}')

BUILDINGS = {}

def define_buildings(TEX):
    BUILDINGS.update({
        # Commercial strip (storefront ground floor, 1–2 upper floors)
        'bakery':   lambda: shop('bakery',   11.0, 12.0, 1, 'brick',      '#b5835e', M['awn_red'],    'BAKERY',   101),
        'pizzeria': lambda: shop('pizzeria', 10.0, 12.0, 1, 'stucco',     '#d9d2c0', M['awn_green'],  'PIZZERIA', 102),
        'cafe':     lambda: shop('cafe',     12.0, 11.0, 2, 'stucco',     '#cfd6c9', M['awn_teal'],   'CAFE',     103),
        'market':   lambda: shop('market',   16.0, 17.0, 0, 'stucco',     '#cfc8b6', M['awn_blue'],   'MARKET',   104),
        'books':    lambda: shop('books',    11.0, 12.5, 2, 'brick',      '#7d5947', M['awn_navy'],   'BOOKS',    105),
        'barber':   lambda: shop('barber',   10.0, 11.0, 1, 'stucco',     '#ccd5d9', M['awn_red'],    'BARBER',   106),
        'pharmacy': lambda: shop('pharmacy', 13.0, 13.5, 1, 'concrete',   '#d3d7d3', M['awn_red'],    'PHARMACY', 107),
        'flowers':  lambda: shop('flowers',  10.0, 11.5, 1, 'brick',      '#a8896f', M['awn_green'],  'FLOWERS',  108),
        'hardware': lambda: shop('hardware', 14.0, 16.0, 0, 'corrugated', '#99a0a6', M['awn_gray'],   'HARDWARE', 109),
        'laundry':  lambda: shop('laundry',  11.0, 11.5, 1, 'stucco',     '#d2c5d1', M['awn_purple'], 'LAUNDRY',  110),
        'tailor':   lambda: shop('tailor',   10.0, 12.0, 1, 'concrete',   '#c6c0b1', M['awn_charcoal'],'TAILOR',   111),
        'toys':     lambda: shop('toys',     11.0, 12.0, 1, 'stucco',     '#dcc84a', M['awn_red'],    'TOYS',     112),
        'grocer':   lambda: shop('grocer',   15.0, 16.0, 0, 'brick',      '#b08e6b', M['awn_blue'],   'GROCER',   113),
        'diner':    lambda: diner('diner', 114),
        # Residential
        'apt_brick': lambda: apartment('apt_brick', 16.0, 14.0, 5, 'brick',  '#997a5f', 201, True),
        'apt_stucco':lambda: apartment('apt_stucco',15.0, 14.0, 4, 'stucco', '#c4b294', 202, True),
        'townhouse': lambda: townhouse('townhouse', 12.0, 16.0, 3, 'brick',  '#a2684f', 203),
        'rowhouse_a':lambda: rowhouse('rowhouse_a',  9.0, 12.0, 3, 'brick',  '#8f6a55', 204, True),
        'rowhouse_b':lambda: rowhouse('rowhouse_b',  9.0, 12.0, 3, 'stucco', '#a8b3ba', 205, False),
        'rowhouse_c':lambda: rowhouse('rowhouse_c',  9.0, 11.0, 2, 'concrete','#c2b49a',206, True),
        # Civic / towers
        'office_slab': lambda: office_slab('office_slab', 301),
        'glass_tower': lambda: glass_tower('glass_tower', 302),
        'tower_setback': lambda: tower_setback('tower_setback', 303),
        'bank':      lambda: bank('bank', 11),
    })

# --------------------------------------------------------------------------
# Street / park props
# --------------------------------------------------------------------------

def make_fountain():
    parts = []
    parts.append(add_cyl('basin', 2.75, 2.45, 0.85, 0, 0, 0.42, M['concrete_prop'], 10))
    parts.append(add_cyl('basin_rim', 2.95, 2.95, 0.22, 0, 0, 0.92, M['concrete_prop'], 10))
    parts.append(add_cyl('water', 2.45, 2.45, 0.06, 0, 0, 0.82, M['water'], 20))
    parts.append(add_cyl('pedestal', 0.34, 0.44, 1.5, 0, 0, 1.6, M['concrete_prop'], 12))
    parts.append(add_cyl('bowl', 1.15, 0.75, 0.42, 0, 0, 2.5, M['concrete_prop'], 12))
    parts.append(add_cyl('water2', 1.0, 1.0, 0.05, 0, 0, 2.72, M['water'], 16))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.28, location=(0, 0, 2.95))
    sphere = bpy.context.active_object
    sphere.name = 'finial'
    sphere.data.materials.append(M['concrete_prop'])
    parts.append(sphere)
    return join_parts(parts, 'prop_fountain')

def make_bench():
    parts = []
    # Two cast-iron ends + wood slats.
    for s in (1, -1):
        parts.append(add_box('benchend', 0.12, 0.42, 0.62, s * 0.82, 0, 0.28, M['iron']))
        parts.append(add_box('benchback', 0.12, 0.5, 0.09, s * 0.82, -0.18, 0.82, M['iron']))
    for i in range(3):
        parts.append(add_box(f'seat{i}', 1.75, 0.11, 0.17, 0, -0.2 + i * 0.21, 0.52, M['wood']))
    for i in range(2):
        parts.append(add_box(f'back{i}', 1.75, 0.09, 0.13, 0, -0.33, 0.83 + i * 0.24, M['wood']))
    return join_parts(parts, 'prop_bench')

def make_parking_sign():
    parts = []
    parts.append(add_cyl('pole', 0.07, 0.07, 2.6, 0, 0, 1.3, M['iron'], 10))
    parts.append(add_box('plate', 1.15, 0.1, 1.15, 0, 0, 2.75, M['sign_blue']))
    try:
        parts.append(make_text('pmark', 'P', 0.8, (0, 0.075, 2.75), M['sign_cream'], 0.02))
    except Exception as e:
        print(f'  [warn] P sign text skipped ({e})')
    return join_parts(parts, 'prop_parkingsign')

def init_materials():
    M['glass'] = solid_material('glass', hexcol('#222a31'), 0.12, 0.15)
    M['shopglass'] = solid_material('shopglass', hexcol('#2b343b'), 0.08, 0.1, emission=hexcol('#ffb46b'), emission_strength=0.55)
    M['curtain'] = solid_material('curtain', hexcol('#33454f'), 0.05, 0.35, emission=hexcol('#8adfff'), emission_strength=0.08)
    M['trim_dark'] = solid_material('trim_dark', hexcol('#3c4148'), 0.6, 0.35)
    M['trim_light'] = solid_material('trim_light', hexcol('#d8d5cc'), 0.7, 0.05)
    M['roof_shingle'] = solid_material('roof_shingle', hexcol('#5c4a3e'), 0.9)
    M['roof_metal'] = solid_material('roof_metal', hexcol('#6d7276'), 0.55, 0.6)
    M['roof_wood'] = solid_material('roof_wood', hexcol('#7a5f45'), 0.85)
    M['sign_cream'] = solid_material('sign_cream', hexcol('#f2e9d8'), 0.5, 0.0, emission=hexcol('#ffe9b8'), emission_strength=1.4)
    M['sign_glow'] = solid_material('sign_glow', hexcol('#f5f0e0'), 0.5, 0.0, emission=hexcol('#cfe8ff'), emission_strength=1.6)
    M['sign_red'] = solid_material('sign_red', hexcol('#a03028'), 0.6, 0.0, emission=hexcol('#ff4a3c'), emission_strength=0.9)
    M['sign_dark'] = solid_material('sign_dark', hexcol('#2e2a24'), 0.7)
    M['sign_blue'] = solid_material('sign_blue', hexcol('#1f4f9c'), 0.55, 0.0, emission=hexcol('#2f6fff'), emission_strength=0.5)
    # Awnings.
    for name, color in [('red','#b23a2e'),('green','#2e7a44'),('teal','#2b7f83'),('blue','#2f5a8a'),('navy','#2e3f5e'),('gray','#5a6066'),('purple','#5e4468'),('charcoal','#33393e')]:
        M[f'awn_{name}'] = solid_material(f'awn_{name}', hexcol(color), 0.75)
    M['concrete_prop'] = solid_material('concrete_prop', hexcol('#c9c7bd'), 0.85)
    M['water'] = solid_material('water', hexcol('#3e7d9c'), 0.05, 0.0, emission=hexcol('#7fd4ff'), emission_strength=0.25)
    M['iron'] = solid_material('iron', hexcol('#2f3337'), 0.5, 0.65)
    M['wood'] = solid_material('wood', hexcol('#6f4f33'), 0.8)

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    init_materials()
    tmpdir = tempfile.mkdtemp(prefix='citytex_')
    global TEX
    TEX = make_textures(tmpdir)
    define_buildings(TEX)

    built = []
    for key in sorted(BUILDINGS):
        try:
            obj = BUILDINGS[key]()
            built.append(obj)
            tris = sum(len(p.vertices) - 2 for p in obj.data.polygons) * 1 if False else len(obj.data.polygons)
            print(f'  built {obj.name}')
        except Exception as e:
            import traceback; traceback.print_exc()
            print(f'  [FAIL] {key}: {e}')
            raise

    built.append(make_fountain())
    built.append(make_bench())
    built.append(make_parking_sign())

    # Export only our city objects.
    bpy.ops.object.select_all(action='DESELECT')
    for o in built:
        o.select_set(True)
    bpy.context.view_layer.objects.active = built[0]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )
    print(f'exported -> {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)')

TEX = {}

if __name__ == '__main__':
    main()
