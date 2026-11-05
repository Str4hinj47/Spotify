"""Inspect connected components in an existing glTF using Blender's Python API.

Requires Blender's bpy module (optional authoring dependency, not runtime):
  python tools/inspect_mesh_components.py public/models/mustang.glb BlackTrim

Coordinates are in imported glTF axes converted to game-style X/Y/Z *before*
any per-car orientation or centering in ModelLibrary. Components connect by
position, so split UV/normal vertices on the same surface stay together.
"""
import sys
import bpy

if len(sys.argv) != 3:
    raise SystemExit('usage: python inspect_mesh_components.py MODEL.glb MATERIAL_SUBSTRING')
path, material_filter = sys.argv[1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    mesh = obj.data
    for slot, material in enumerate(mesh.materials):
        if material is None or material_filter.lower() not in material.name.lower():
            continue
        parents, positions = {}, {}
        def root(key):
            while parents[key] != key:
                parents[key] = parents[parents[key]]
                key = parents[key]
            return key
        for face in mesh.polygons:
            if face.material_index != slot:
                continue
            keys = []
            for index in face.vertices:
                v = obj.matrix_world @ mesh.vertices[index].co
                point = (v.x, v.z, -v.y)
                key = tuple(round(value, 4) for value in point)
                parents.setdefault(key, key)
                positions[key] = point
                keys.append(key)
            for key in keys[1:]:
                a, b = root(keys[0]), root(key)
                if a != b:
                    parents[b] = a
        components = {}
        for key in parents:
            components.setdefault(root(key), []).append(positions[key])
        print('\n', obj.name, material.name)
        for points in sorted(components.values(), key=len, reverse=True):
            if len(points) < 20:
                continue
            axes = list(zip(*points))
            print(len(points), 'min', *(round(min(a), 3) for a in axes),
                  'max', *(round(max(a), 3) for a in axes))
