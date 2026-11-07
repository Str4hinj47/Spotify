"""Build the uploaded BlendSwap cars. Source zips are in ignored google_drive/.
Extract their blend files into source-assets/new-cars/<id>/ first.
See THIRD_PARTY_NOTICES.md before distributing any resulting model.
"""
import json, sys
from pathlib import Path
import bpy
from mathutils import Matrix
import convert_assets as base
ROOT=Path(__file__).resolve().parents[1]
R=Matrix(((-1,0,0),(0,-1,0),(0,0,1)))
SPECS={
 'bmw-m3':dict(path=ROOT/'source-assets/new-cars/bmw/bmw_m3_gt3_cycles.blend',length=4.62,paint=(.55,.57,.60),transform=R,exclude_objects={'Earth','Light_Plane'},triangle_budget=180000),
 'skyline':dict(path=ROOT/'source-assets/new-cars/skyline/newSKYLINE.blend',length=4.60,paint=(.45,.55,.65),transform=R,exclude_objects={'Sphere','Cube','Cube.001','Plane.001','Plane.002','Plane.003','Plane.012','Plane.013','Plane.014','GTR_Logo','GTR_Logo.001','SKYLINE','NissanBadge'},factory_wing_objects={'Spoiler'},triangle_budget=230000),
 'aventador':dict(path=ROOT/'source-assets/new-cars/aventador/blendswap.blend',length=4.78,paint=(.64,.16,.015),transform=R,source_region=[(-1.5,6.6),(-33.6,-21.3),(-.3,3.0)],rest_pose=True,rotate_objects=[('Plane.000',(.6,-29.6,0),-.35),('Plane.030',(4.6,-29.6,0),.35)],triangle_budget=220000),
 'aventador-game':dict(path=ROOT/'source-assets/new-cars/aventador-game/Aventador_Blendswap_Shadman.blend',length=4.78,paint=(.60,.11,.02),transform=R,exclude_objects={'Ground','light_key','LightSource'},triangle_budget=150000),
 'camry':dict(path=ROOT/'source-assets/new-cars/camry/Toyota Camry 2002.blend',length=4.82,paint=(.43,.48,.50),transform=R,exclude_objects={'Plane','Interior.001','Circle'},triangle_budget=160000),
}
def classify_for_object(car, obj, name):
 n=name.lower().strip()
 if car=='camry':
  if obj in ('Plane.001','Plane.002') and n in ('material.005','material.006','material.008'): return 'glass'
  if obj in ('taillights_glass.002','taillights_glass.003') and n in ('taillights light','glass.001','taillight cheat.001','glass red.001'): return 'headlight'
  if obj=='taillights_glass.001' and n in ('taillights light','glass.001','taillight cheat.001','glass red.001'): return 'taillight'
 if car=='aventador':
  if n=='noirvitre': return 'glass'
  if obj.startswith('pharearriere') and n.startswith('vitrephare'): return 'taillight'
  if obj in ('phares','leds.001') and n=='light': return 'headlight'
  if obj.startswith('pharearriere') and n=='backlight': return 'taillight'
 return None

def remove_brand(car, obj, name):
 n=name.lower().strip()
 if car=='skyline': return n.startswith('gtr_logo') or n=='logo.metal.001' or n=='gtr.alloylogo'
 if car=='aventador': return n in ('logo','immatriculation','etiquette')
 if car=='aventador-game': return n in ('logo','plate')
 if car=='camry': return n in ('material.003','aaaa')
 return False
for car, spec in SPECS.items():
 spec['material_category'] = lambda obj, name, car=car: classify_for_object(car,obj,name)
 spec['exclude_material'] = lambda obj, name, car=car: remove_brand(car,obj,name)
original=base.category
key=''
def category(name):
 n=name.lower().strip()
 if key=='bmw-m3':
  if n=='material':return 'paint'
  if n=='reifen':return 'tire'
  if n=='blinker':return 'taillight'
  if n=='light':return 'headlight'
 if key=='skyline':
  if n.startswith('paint.') or n=='carpaint':return 'paint'
  if n.startswith('rubbertyre'):return 'tire'
  if n.startswith('gtr.alloy'):return 'rim'
 if key == 'aventador-game':
  if n == 'light': return 'headlight'
  if n == 'neon light': return 'taillight'
 if key in ('aventador','aventador-game'):
  if n.startswith('pneu') or n=='rubber':return 'tire'
  if n.startswith('jante'):return 'rim'
  if n.startswith('vitrephare'):return 'headlight'
  if n.startswith('pharearriere'):return 'taillight'
  if n.startswith('vitre') or n=='trans':return 'glass'
 if key=='camry':
  if n.startswith('opoma') or n.startswith('opona'):return 'tire'
  if n=='rubbertires':return 'trim'
  if n=='felga':return 'rim'
  if 'taillight' in n or n=='glass red.001':return 'taillight'
  if n=='hl glass':return 'glass'
 return original(name)
base.category=category
manifest=base.OUT/'manifest.json';report=json.loads(manifest.read_text())
for key in (sys.argv[1:] or SPECS):
 print('\n===',key,flush=True);report[key]=base.convert(key,SPECS[key]);manifest.write_text(json.dumps(report,indent=2)+'\n')
