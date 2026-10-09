"""Export the game's original models and all cat actions for native Filament.
Blender --background --python scripts/3d/export-native.py -- [--items|--cats|--food-spill]
Use --items --id=catTreePink to rebuild selected items without exporting cats.
The saved catalog IDs and the original raster framing are retained in metadata.
"""
from pathlib import Path
import bpy, sys, math, json
PLAYABLE_PLANTS=('plantSmall','plantA','plantB','plantE','plantPotted','plantTallGreen','plantTallPink','plantTallBlue','plantTallPurple')
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
LAMP_GLOW_PARTS=json.loads((ROOT/'constants/lamp-glow-parts.json').read_text())
sys.path.insert(0,str(ROOT/'scripts/3d'))
from native_gltf import normalize_animation_times
OUT=ROOT/'assets/3d/native';OUT.mkdir(parents=True,exist_ok=True)
scope={'__file__':str(ROOT/'scripts/3d/render_assets.py'),'__name__':'__native_assets__'}
exec(compile((ROOT/'scripts/3d/render_assets.py').read_text(),scope['__file__'],'exec'),scope)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def clear():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def export(path,objects,animated=False):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.context.view_layer.update()
 temporary=path.with_name(path.stem+'-export.glb')
 bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_apply=not path.name.startswith('cat-'),export_animations=animated,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=True,export_anim_slide_to_zero=True)
 normalize_animation_times(temporary)
 temporary.replace(path)
def bounds(objects):
 bpy.context.view_layer.update()
 points=[o.matrix_world@Vector(c) for o in objects if o.type in ('MESH','CURVE') for c in o.bound_box]
 return [min(v[i] for v in points) for i in range(3)],[max(v[i] for v in points) for i in range(3)]
def window_sky_materials(objects):
 # The opaque pane depicts the sky outside, not a blue surface reflecting
 # interior lamps. Background shaders export as KHR_materials_unlit. Keep the
 # frame lit normally so pane lights illuminate its inward-facing surfaces.
 names=('Window glass','Sky blue glass','Arched glass lower pane','Arched sky glass','Round sky glass',
        'Window light reflection','Porthole reflection')
 for obj in objects:
  if obj.type!='MESH' or not any(obj.name==name or obj.name.startswith(name+'.') for name in names):continue
  for slot in obj.material_slots:
   if not slot.material:continue
   material=slot.material.copy();material.name='Outside sky '+obj.name
   color=material.diffuse_color[:]
   material.node_tree.nodes.clear()
   background=material.node_tree.nodes.new('ShaderNodeBackground');background.inputs['Color'].default_value=color
   output=material.node_tree.nodes.new('ShaderNodeOutputMaterial')
   material.node_tree.links.new(background.outputs['Background'],output.inputs['Surface'])
   slot.material=material
def lamp_glow_materials(id,objects):
 # Separate the shade from bases/stems that share the same authored color.
 # Runtime emission can then turn each lamp on/off without lighting its base.
 names=[part['node'] for part in LAMP_GLOW_PARTS[id]]
 for obj in objects:
  if obj.type!='MESH' or not any(obj.name==name or obj.name.startswith(name+'.') for name in names):continue
  for slot in obj.material_slots:
   if not slot.material:continue
   material=slot.material.copy();material.name='Lamp glow '+obj.name
   material.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=1
   slot.material=material
def window_area_lightmap(objects):
 # Bake one broad outside source onto the frame. This preserves a continuous
 # area-light response on mobile, where Filament exposes only punctual lights.
 skies=[o for o in objects if o.type=='MESH' and any(s.material and s.material.name.startswith('Outside sky ') for s in o.material_slots)]
 frames=[o for o in objects if o.type=='MESH' and o not in skies]
 if not skies or not frames:return
 glass=[o for o in skies if 'reflection' not in o.name.lower()]
 lo,hi=bounds(glass)
 scene=bpy.context.scene
 for obj in scene.objects:
  if obj.type=='LIGHT':obj.hide_render=True
 for obj in skies:obj.visible_shadow=False
 data=bpy.data.lights.new('Outside window area','AREA');data.shape='RECTANGLE'
 data.size=hi[0]-lo[0];data.size_y=hi[2]-lo[2];data.energy=100
 light=bpy.data.objects.new('Outside window area',data);scene.collection.objects.link(light)
 light.location=((lo[0]+hi[0])/2,hi[1]+.15,(lo[2]+hi[2])/2)
 light.rotation_euler=(-math.pi/2,0,0)
 image=bpy.data.images.new('Window area lightmap',width=256,height=256,float_buffer=True)
 copied={}
 for obj in frames:
  for slot in obj.material_slots:
   original=slot.material
   if original not in copied:
    material=original.copy();material.name='Window area '+original.name
    texture=material.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
    material.node_tree.nodes.active=texture
    copied[original]=(material,texture)
   slot.material=copied[original][0]
 bpy.ops.object.select_all(action='DESELECT')
 for obj in frames:obj.select_set(True)
 bpy.context.view_layer.objects.active=frames[0]
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.uv.smart_project(island_margin=.025)
 bpy.ops.object.mode_set(mode='OBJECT')
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32
 bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT'},margin=3,use_clear=True)
 pixels=list(image.pixels[:]);peak=max(pixels[i] for i in range(0,len(pixels),4))
 if peak>0:
  for i in range(0,len(pixels),4):
   value=max(0,min(1,pixels[i]/peak))
   pixels[i:i+4]=[value,value,value,1]
  image.pixels[:]=pixels
 image.pack()
 for material,texture in copied.values():
  shader=material.node_tree.nodes.get('Principled BSDF')
  material.node_tree.links.new(texture.outputs['Color'],shader.inputs['Emission Color'])
  shader.inputs['Emission Strength'].default_value=1
 bpy.data.objects.remove(light,do_unlink=True)
def items():
 selected=[a.split('=',1)[1] for a in ARGS if a.startswith('--id=')]
 metadata=json.loads((OUT/'catalog.json').read_text()) if selected else {}
 for entry in json.loads((ROOT/'scripts/3d/inventory.json').read_text())['entries']:
  if selected and entry['id'] not in selected:continue
  clear();scene=scope['setup'](256);id=entry['id'];kind=entry['kind']
  if kind=='room':
   # Reuse the original room builder without producing another raster or .blend.
   previous=scope['render'];scope['render']=lambda path:None
   save=bpy.ops.wm.save_as_mainfile
   # Extract only the model-building part; room() also saves an external library.
   code=(ROOT/'scripts/3d/render_assets.py').read_text();start=code.index('def room(entry):');end=code.index(" render(OUT/'rooms'",start)
   exec(code[start:end].replace('def room(entry):','def native_room(entry):'),scope);scope['native_room'](entry)
   scope['render']=previous
   objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];render_scale=7.85;center=[0,0,.9]
  else:
   objects,root=scope['build_item'](entry)
   framing=[o for o in objects if not o.hide_render and o.name!='Hanging toy string' and not o.name.startswith(('Leaf midrib','Leaf vein','Soil grain')) and not (id in PLAYABLE_PLANTS and o.type=='CURVE')]
   framed_center=scope['frame_camera'](framing,1.22)
   render_scale=bpy.context.scene.camera.data.ortho_scale
   lo,hi=bounds(objects);center=[(a+b)/2 for a,b in zip(lo,hi)]
   # Match frame_camera's average bounding-box center, including asymmetric props.
   points=[o.matrix_world@Vector(c) for o in framing if o.type in ('MESH','CURVE') for c in o.bound_box]
   center=list(sum(points,Vector())/len(points))
   if id in scope['STORE_FURNITURE_IDS']:center=list(framed_center)
   objects=[root,*objects]
  if id.startswith('window') or id=='bathroomBathWindow':
   window_sky_materials(objects)
   window_area_lightmap(objects)
  elif id in LAMP_GLOW_PARTS:lamp_glow_materials(id,objects)
  lo,hi=bounds(objects)
  # Item animations are local. Doors remain closed and fixed until explicitly used.
  wind=id in ('plantSmall','plantA','plantB','plantE','plantPotted','plantSunflower','plantTallGreen','plantTallPink','plantTallBlue','plantTallPurple')
  animated=kind!='room' and id not in PLAYABLE_PLANTS and (entry.get('animated',False) or wind) and 'door' not in id.lower()
  rotations={o:o.rotation_euler.copy() for o in objects}
  if animated:
   scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=1;scene.frame_end=49
   for frame in range(49):
    scope['animate_furniture'](objects,frame/48)
    if wind:
     for o in objects:
      if 'leaf' in o.name.lower() or 'flower' in o.name.lower():o.rotation_euler.y=rotations[o].y+.07*math.sin(frame/48*math.tau+o.location.x*2)
    for o in objects:
     for prop in ('location','rotation_euler','scale'):o.keyframe_insert(data_path=prop,frame=frame+1)
   for o in objects:
    if o.animation_data and o.animation_data.action:
     action=o.animation_data.action;action.name=id+' motion';track=o.animation_data.nla_tracks.new();track.name='Motion';track.strips.new('Motion',1,action);o.animation_data.action=None
  export(OUT/(id+'.glb'),objects,animated)
  def yup(v):return [v[0],v[2],-v[1]]
  metadata[id]={'kind':kind,'renderScale':render_scale,'center':yup(center),'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]],'animated':animated,'wind':wind}
  contact=next((o for o in objects if o.name=='Bathroom contact'),None)
  if contact:
   metadata[id]['bathroom']={'kind':contact['bathroom_kind'],'contact':yup(list(contact.location))}
   outlet=next((o for o in objects if o.name=='Bathroom water outlet'),None)
   if outlet:metadata[id]['bathroom']['sprayHeight']=max(.01,outlet.location.z-contact.location.z)
  if id in PLAYABLE_PLANTS:
   metadata[id]['leaves']=[{'node':o.parent.name,'contact':o.name,'point':yup(list(o.matrix_world.translation))} for o in sorted(objects,key=lambda o:o.name) if o.name.startswith('Leaf contact ')]
  if (id.startswith('sofa') and id!='sofaPillow') or 'catTree' in id or 'scratchPost' in id or id in PLAYABLE_PLANTS or id=='lampFloorArc':
   # Keep the open space above the seat. One enclosing box fills that space.
   metadata[id]['collisionBoxes']=[]
   for obj in objects:
    if obj.type not in ('MESH','CURVE'):continue
    if id in PLAYABLE_PLANTS and obj.name not in ('Ceramic planter','Pot rim','Soil'):continue
    if obj.name in ('Dangling toy','Hanging toy string') or obj.name.startswith('Rope ring'):continue
    if id=='lampFloorArc' and obj.name=='Brass arch stem':
     # One box around the curved stem fills the air below its arch. Short
     # height bands preserve the upright and leave the sofa cushion accessible.
     evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
     vertices=[obj.matrix_world@v.co for v in mesh.vertices]
     low,high=bounds([obj])
     for band in range(math.ceil((high[2]-low[2])/.2)):
      bottom=low[2]+band*.2;top=bottom+.2;points=[]
      for face in mesh.polygons:
       face_points=[vertices[i] for i in face.vertices]
       if min(v.z for v in face_points)<=top and max(v.z for v in face_points)>=bottom:points.extend(face_points)
      if points:
       lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)]
       metadata[id]['collisionBoxes'].append({'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]})
     evaluated.to_mesh_clear();continue
    low,high=bounds([obj])
    metadata[id]['collisionBoxes'].append({'min':[low[0],low[2],-high[1]],'max':[high[0],high[2],-low[1]]})
  print('NATIVE_ITEM',id,flush=True)
 if not selected:
  airflow()
  food_spill()
 # Selected exports still keep inventory order for deterministic catalog checks.
 inventory_ids=[e['id'] for e in json.loads((ROOT/'scripts/3d/inventory.json').read_text())['entries']]
 metadata={id:metadata[id] for id in inventory_ids if id in metadata}
 (OUT/'catalog.json').write_text(json.dumps(metadata,indent=2)+'\n')
 sources='// Generated by scripts/3d/export-native.py; IDs match existing saves.\nexport const NATIVE_MODEL_SOURCES: Record<string, number> = {\n'+''.join(f'  "{id}": require("@/assets/3d/native/{id}.glb"),\n' for id in metadata)+'};\n'
 (ROOT/'constants/native-model-sources.ts').write_text(sources)
def airflow():
 clear();scene=scope['setup'](256)
 material=scope['material']('Soft mint airflow','A9D5DF')
 material.diffuse_color=(*material.diffuse_color[:3],.35)
 material.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.35
 material.surface_render_method='DITHERED'
 objects=[]
 for x in (-.35,0,.35):objects.append(scope['curve']('Airflow stroke',[(x,-.15,-.1),(x,-.4,-.18),(x,-.65,-.3)],.015,material))
 scene.render.fps=24;scene.frame_start=1;scene.frame_end=49
 for frame in range(49):
  for i,o in enumerate(objects):
   o.location.z=-.04*math.sin(frame/48*math.tau+i*.7)
   o.scale=(1,1,.85+.15*math.sin(frame/48*math.tau+i*.7))
   for prop in ('location','scale'):o.keyframe_insert(data_path=prop,frame=frame+1)
 for o in objects:
  action=o.animation_data.action;track=o.animation_data.nla_tracks.new();track.name='Airflow';track.strips.new('Airflow',1,action);o.animation_data.action=None
 export(OUT/'airflow.glb',objects,True)
def food_spill():
 clear()
 scene=scope['setup'](256)
 pieces=scope['eating_food']()
 for obj in list(scene.objects):
  if obj.type=='MESH' and obj not in pieces:bpy.data.objects.remove(obj,do_unlink=True)
 root=scope['empty']('Placed bowl food spill')
 for piece in pieces:piece.parent=root
 count,fps=json.loads((ROOT/'scripts/3d/clips.json').read_text())['eating']
 frames=round(count/fps*24)
 scene.render.fps=24
 scene.frame_start,scene.frame_end=1,frames+1
 for frame in range(frames+1):
  t=frame/frames
  contact_time=scope['care_action_time']('eating',t)
  for i,piece in enumerate(pieces):
   # Three pieces are displaced as the lowered muzzle first touches food;
   # smaller spills follow each munch. Arcs clear the rim and bounce once.
   born=.17+max(0,i-2)*.07
   flight=max(0,min(1,(contact_time-born)/.12))
   angle=(-2.7,-.4,-1.6,-2.3,-.8,-2.9,-1.2,-.15)[i]
   radius=.24+(.25+.025*(i%3))*flight
   bounce=math.sin(math.pi*max(0,min(1,(contact_time-born-.12)/.10)))
   z=.193*(1-flight)+.035*flight+1.16*flight*(1-flight)+.06*bounce
   appear=scope['smoothstep']((contact_time-born)/.012)
   piece.location=(radius*math.cos(angle),radius*math.sin(angle),z)
   piece.scale=(.045*appear,.037*appear,.03*appear)
   piece.rotation_euler=(flight*2.4,flight*3.1,angle)
   piece.scale*=1-scope['smoothstep']((t-.875)/.125)
   for prop in ('location','rotation_euler','scale'):piece.keyframe_insert(data_path=prop,frame=frame+1)
 for piece in pieces:
  action=piece.animation_data.action
  track=piece.animation_data.nla_tracks.new();track.name='Eating spill'
  track.strips.new('Eating spill',1,action);piece.animation_data.action=None
 export(OUT/'bowl-food-spill.glb',[root,*pieces],True)

def cats():
 from game_cat import export_cats
 export_cats(scope,ARGS,export)
if '--food-spill' in ARGS:food_spill()
if '--cats' not in ARGS and '--food-spill' not in ARGS:items()
if '--items' not in ARGS and '--food-spill' not in ARGS:
 cats()
 # Keep OS launch and React fallback artwork in sync with a cat rebuild.
 import runpy, subprocess
 runpy.run_path(str(ROOT/'scripts/3d/render-native-branding.py'))
 subprocess.run(['node',str(ROOT/'scripts/generate-branding.mjs')],cwd=ROOT,check=True)
