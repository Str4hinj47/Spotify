"""Convert the Chiron and two traffic cars supplied on Drive.
Extract the original .blend files into source-assets/new-vehicles/<id>/ first.
See THIRD_PARTY_NOTICES.md for attribution and rights information.
"""
import json, sys
from pathlib import Path
import bpy
from mathutils import Matrix
import convert_assets as base
ROOT=Path(__file__).resolve().parents[1]
R=Matrix(((-1,0,0),(0,-1,0),(0,0,1)))
SPECS={
 'bugatti':dict(path=ROOT/'source-assets/new-vehicles/bugatti/bugatti.blend',scene='Scene.004',keep_all_candidates=True,factory_wing_objects={'Cylinder.041','Cylinder.042'},tag_all_wing_materials=True,length=4.54,paint=(.03,.14,.36),transform=R,triangle_budget=220000,allow_objects={'Plane.035','Cube.060','Plane.034','Cube.056','Cube.061','Cube.034','Cube.035','Cube.057','Cylinder.041','Icosphere.002','Plane.032','Cube.055','Cylinder.042'}),
 'mercedes-560':dict(path=ROOT/'source-assets/new-vehicles/mercedes-560/Mercedes Benz 560 SEL.blend',length=5.16,paint=(.40,.43,.45),transform=R,triangle_budget=140000,exclude_objects={'Plane','Wheel'}),
 'range-rover':dict(path=ROOT/"source-assets/new-vehicles/range-rover/'16 C RRS.blend",length=4.85,paint=(.36,.39,.42),transform=R,triangle_budget=140000,exclude_objects={'Cube.001','K  E  N™','LandRover','LandRover_Base_House_Subdiv','LandRover_Base_Plate_Ring_Subdiv','LandRover_Base_Plate_Subdiv','LandRover_Glossy_Cover_PlateSubdiv','SPORT_Chrome_Frame_2','SPORT__red__2'}),
}
def classify(car,obj,name):
 n=name.lower().strip()
 if car=='bugatti':
  if n.startswith(('blue','navy')):return 'paint'
  if n.startswith('silver door strip'):return 'chrome'
  if n.startswith('red glass'):return 'taillight'
  if n.startswith(('headlight','glass front','reflective coat')):return 'headlight'
  if n.startswith(('tyre','tire')):return 'tire'
  if n.startswith(('rim_silver','rim blue')):return 'rim'
  if n.startswith('grill'):return 'carbon'
 if car=='mercedes-560':
  if n in ('primary','primary_2'):return 'paint'
  if obj=='Rear-Lights':return 'taillight'
  if obj=='Lights':return 'headlight'
  if n.startswith('tire_'):return 'tire'
 if car=='range-rover':
  if obj.startswith('Custom_Rim'):return 'rim'
  if obj.startswith('TailLight') and ('glass' in n or n in ('material.004','material.010','hamna')):return 'taillight'
  if obj.startswith('HeadLight') and ('glass' in n or n=='front sig ligh'):return 'headlight'
  if n.startswith('custom_rim'):return 'rim'
 return None
SPECS['mercedes-560']['face_category'] = lambda obj, name, c: 'taillight' if obj == 'Lights' and name == 'Lights_Body' and c.y < 0 else None
SPECS['mercedes-560']['exclude_face'] = lambda obj, c: obj == 'Plane.001' and abs(c.x) < .045 and c.y > 2.34 and c.z > .85
for car,spec in SPECS.items():
 spec['material_category']=lambda obj,name,car=car:classify(car,obj,name)
 spec['exclude_material']=lambda obj,name,car=car: car=='bugatti' and name.lower().startswith('number plate')
manifest=base.OUT/'manifest.json';report=json.loads(manifest.read_text())
for car in (sys.argv[1:] or SPECS):
 print('\n===',car,flush=True);report[car]=base.convert(car,SPECS[car]);manifest.write_text(json.dumps(report,indent=2)+'\n')
