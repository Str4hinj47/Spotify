import bpy, json, os
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ASSETS = {
    'golf': ROOT / 'source-assets/golf/GolfMK4-Cycles-Jay-Hardy-2011.blend',
    'mercedes': Path('/home/user/Spotify/google_drive/MB.W222.AMG.blend'),
    'audi': Path('/home/user/Spotify/google_drive/Audi_RS_6_Avant_Not+Applied.blend'),
    'mustang': ROOT / 'source-assets/mustang/Mustang/Mustang.blend',
    'ferrari': ROOT / 'source-assets/ferrari/ferrari_studio.blend',
}
report = {}
for key, path in ASSETS.items():
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False)
    meshes = []
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
        lo = [min(c[i] for c in corners) for i in range(3)]
        hi = [max(c[i] for c in corners) for i in range(3)]
        meshes.append({
            'name': o.name, 'vertices': len(o.data.vertices), 'faces': len(o.data.polygons),
            'collections': [c.name for c in o.users_collection],
            'hide_render': o.hide_render, 'hide_viewport': o.hide_viewport,
            'location': list(o.location), 'rotation': list(o.rotation_euler), 'scale': list(o.scale),
            'min': lo, 'max': hi, 'dimensions': list(o.dimensions),
            'materials': [s.material.name if s.material else None for s in o.material_slots],
            'modifiers': [(m.name, m.type, m.show_viewport, m.show_render) for m in o.modifiers],
        })
    materials = []
    for m in bpy.data.materials:
        nodes = []
        if m.use_nodes:
            for n in m.node_tree.nodes:
                item = {'name': n.name, 'type': n.type}
                if n.type == 'TEX_IMAGE':
                    item['image'] = n.image.name if n.image else None
                    item['path'] = n.image.filepath if n.image else None
                if n.type == 'BSDF_PRINCIPLED':
                    item['inputs'] = {i.name: list(i.default_value) if hasattr(i.default_value, '__len__') else i.default_value for i in n.inputs if hasattr(i, 'default_value') and not i.is_linked}
                nodes.append(item)
        materials.append({'name': m.name, 'diffuse': list(m.diffuse_color), 'nodes': nodes})
    report[key] = {
        'file': str(path), 'version': bpy.app.version_string,
        'collections': [{'name': c.name, 'objects': [o.name for o in c.objects], 'hide_render': c.hide_render} for c in bpy.data.collections],
        'meshes': meshes, 'materials': materials,
        'images': [{'name': i.name, 'path': i.filepath, 'size': list(i.size), 'packed': bool(i.packed_file)} for i in bpy.data.images],
    }
    print('\n===', key, '===')
    print('Collections:', [(c.name, len(c.objects), c.hide_render) for c in bpy.data.collections])
    print('Meshes:', len(meshes), 'vertices:', sum(m['vertices'] for m in meshes))
    for m in sorted(meshes, key=lambda m: -m['vertices'])[:35]:
        print(m['name'], m['vertices'], 'dim', [round(v, 3) for v in m['dimensions']], 'loc', [round(v, 3) for v in m['location']], 'mat', m['materials'], 'col', m['collections'], 'mods', m['modifiers'])
    print('Materials:', [m['name'] for m in materials])
    print('Images:', [(i['name'], i['size'], i['packed']) for i in report[key]['images']])
(ROOT / 'source-assets/inspection.json').write_text(json.dumps(report, indent=2))
