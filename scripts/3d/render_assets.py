"""Original Math Mews 3D assets. Run with Blender --background --python this_file -- --only preview."""
import bpy, math, json, os, sys, random
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/3d'))
from cat_model import create_cat, pose_cat, configure_cat_camera, animated_parts, smoothstep, care_action_time
OUT=ROOT/'assets/3d'
OUT.mkdir(parents=True,exist_ok=True)
BLENDER_OUT=Path(os.environ.get('BRAINPET_BLENDER_ASSET_DIR',str(ROOT.parent/'BrainPet-blender-assest'))).expanduser().resolve()
BLENDER_OUT.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ONLY=ARGS[ARGS.index('--only')+1] if '--only' in ARGS else None
SIZE=256
ROOM_VIEW_DIRECTION=(8,-8,6.1)
CAT_FRAME_SIZE=768
ROTATION_GROUPS=[['chairOfficeA','chairOfficeB'],['chairClassicA','chairClassicB','chairClassicC','chairClassicD'],['chairGamingA','chairGamingB','chairGamingC','chairGamingD'],['deskWoodA','deskWoodB'],['sofaA','sofaB'],['computerNewImacA','computerNewImacB'],['computerOldImacA','computerOldImacB'],['computerOldPcA','computerOldPcB'],['computerRotationScreenA','computerRotationScreenB','computerRotationScreenC']]
ROTATION_BASE={id:group[0] for group in ROTATION_GROUPS for id in group}

PALETTE={'cream':'FEFBEC','white':'FFF9F0','coral':'FF827E','teal':'72C6BF','gold':'EBC16B','sage':'B9CCAD','rose':'C2ABA9','blue':'A9D5F0','lilac':'C2B6D7','wood':'C9996D','dark':'454852','ink':'30323C','grey':'919AA6','orange':'EFA45E','pink':'EFAAA8','green':'83AE88','red':'D87973','purple':'AF9CC6','brown':'A58872','black':'494B54','silver':'BCC7CF','paper':'F7EBD6'}
MATS={}
def material(name,hexcolor=None,roughness=.72,metallic=0):
 key=(name,hexcolor,roughness,metallic)
 if key in MATS:return MATS[key]
 h=hexcolor or PALETTE.get(name,name)
 rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 linear=[c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
 m=bpy.data.materials.new(name);m.diffuse_color=(*linear,1);m.use_nodes=True
 bsdf=m.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*linear,1);bsdf.inputs['Roughness'].default_value=roughness;bsdf.inputs['Metallic'].default_value=metallic
 MATS[key]=m;return m

def mat(value):return value if isinstance(value,bpy.types.Material) else material(value)
def finish(obj,name,color,parent=None):
 obj.name=name;obj.data.materials.append(mat(color))
 if parent:obj.parent=parent
 return obj

def box(name,loc,scale,color,bevel=.08,parent=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Rounded edges','BEVEL');mod.width=min(bevel,min(scale)*.45);mod.segments=3
  mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return finish(o,name,color,parent)

def sphere(name,loc,scale,color,parent=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=loc);o=bpy.context.object;o.scale=scale
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,name,color,parent)

def cylinder(name,loc,radius,depth,color,parent=None,rotation=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth,location=loc);o=bpy.context.object
 bevel=o.modifiers.new('Soft rim','BEVEL');bevel.width=min(radius*.14,.045);bevel.segments=3
 o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 if rotation:o.rotation_euler=rotation
 return finish(o,name,color,parent)

def torus(name,loc,major,minor,color,parent=None,rotation=None):
 bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=32,minor_segments=10,location=loc);o=bpy.context.object
 for p in o.data.polygons:p.use_smooth=True
 if rotation:o.rotation_euler=rotation
 return finish(o,name,color,parent)

def curve(name,points,radius,color,parent=None):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=3;c.use_fill_caps=True
 s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat(color))
 if parent:o.parent=parent
 return o

def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc
 if parent:o.parent=parent
 return o

def setup(size=SIZE,room=False):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 scene=bpy.context.scene;scene.render.engine='CYCLES' if '--cycles' in ARGS else 'BLENDER_EEVEE'
 if hasattr(scene,'eevee'):scene.eevee.taa_render_samples=24
 scene.render.resolution_x=size;scene.render.resolution_y=size;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
 scene.render.image_settings.color_depth='8';scene.render.fps=24
 scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [i.identifier for i in scene.view_settings.bl_rna.properties['look'].enum_items] else 'None'
 scene.view_settings.exposure=0;scene.view_settings.gamma=1
 scene.world.color=(.3,.3,.3);scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.69,.74,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
 bpy.ops.object.camera_add(location=(6,-9,7));camera=bpy.context.object;camera.name='Fixed isometric camera';camera.data.type='ORTHO';scene.camera=camera;aim(camera,(0,0,1));camera.data.ortho_scale=4.1
 for name,loc,energy,size in [('Warm key',(-3,-4,7),500,5),('Fill',(4,-1,4),180,4),('Rim',(1,4,6),300,4)]:
  bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;aim(light,(0,0,1))
 return scene

def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def render(path):
 bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
def frame_camera(objects,margin=1.17):
 camera=bpy.context.scene.camera;deps=bpy.context.evaluated_depsgraph_get();coords=[]
 for o in objects:
  if o.type not in ('MESH','CURVE'):continue
  e=o.evaluated_get(deps);coords.extend(e.matrix_world@Vector(v) for v in e.bound_box)
 if not coords:return
 center=sum(coords,Vector())/len(coords);camera.location=center+Vector(ROOM_VIEW_DIRECTION);aim(camera,center)
 bpy.context.view_layer.update();inv=camera.matrix_world.inverted();points=[inv@v for v in coords];w=max(v.x for v in points)-min(v.x for v in points);h=max(v.y for v in points)-min(v.y for v in points)
 camera.data.ortho_scale=max(w,h)*margin

def cat(skin='orange',boxed=False):
 return create_cat(skin,boxed=boxed)

def cat_pose(rig,state,t):
 pose_cat(rig,state,t)

def bowl(color='teal',loc=(0,-.85,.08)):
 cylinder('Bowl base',loc,.36,.13,color);torus('Bowl rim',(loc[0],loc[1],loc[2]+.08),.30,.065,color);cylinder('Food',(loc[0],loc[1],loc[2]+.085),.27,.035,'brown')

def eating_food():
 # Small pieces in the bowl and eight deterministic spills, saved as keyframes.
 for i in range(14):
  angle=i*2.4;radius=.055+.012*i
  sphere('Bowl kibble',(radius*math.cos(angle),-.85+radius*math.sin(angle),.193),(.037,.032,.026),'brown' if i%2 else 'gold')
 return [sphere(f'Spilled kibble {i+1}',(0,-.85,.19),(.04,.033,.028),
                'brown' if i%2 else 'gold') for i in range(8)]

def pose_eating_food(pieces,t):
 for i,piece in enumerate(pieces):
  born=.18+i*.065
  flight=max(0,min(1,(t-born)/.18))
  angle=-2.85+i*.37
  radius=.10+(.38+.025*(i%3))*flight
  # Arc clears the rim, followed by one diminishing bounce on the floor.
  bounce=math.sin(math.pi*max(0,min(1,(t-born-.18)/.10)))
  z=.19*(1-flight)+.035*flight+.32*math.sin(math.pi*flight)
  if flight==1:z+=.075*bounce
  piece.location=(radius*math.cos(angle),-.85+radius*math.sin(angle),z)
  appear=smoothstep((t-born)/.025)
  piece.scale=(.04*appear,.033*appear,.028*appear)
  piece.rotation_euler=(flight*2.4,flight*3.1,angle)

def care_props(state):
 # Keep the moving prop separate from the cat and the spilled floor pieces.
 before=set(bpy.context.scene.objects)
 food=[]
 if state=='eating':
  bowl();food=eating_food()
 else:cat_play_box()
 moving=[obj for obj in bpy.context.scene.objects if obj not in before and obj not in food]
 slide=bpy.data.objects.new('Care prop slide',None);bpy.context.collection.objects.link(slide)
 for obj in moving:obj.parent=slide
 return slide,food

def pose_care_props(slide,food,state,t):
 enter=smoothstep(t/.125) if state=='eating' else smoothstep(t/.25) if state=='box1' else 1
 leave=smoothstep((t-.875)/.125) if state=='eating' else smoothstep((t-.75)/.25) if state=='box3' else 0
 # Camera-right lies in the floor plane, so this is a horizontal screen slide.
 right=bpy.context.scene.camera.rotation_euler.to_matrix()@Vector((1,0,0))
 slide.location=right*(-2.4*(1-enter+leave))
 if food:
  pose_eating_food(food,care_action_time(state,t))
  for piece in food:piece.scale*=1-leave

def sample():
 scene=setup(640);rig=cat();configure_cat_camera(scene)
 cat_pose(rig,'preview',.35);render(OUT/'cat-preview.png');bpy.ops.wm.save_as_mainfile(filepath=str(BLENDER_OUT/'cat.blend'),compress=True)



def color_for(id):
 id=ROTATION_BASE.get(id,id)
 lower=id.lower()
 for key in ['purple','lilac','orange','pink','green','blue','red','white','dark','brown','tan','yellow']:
  if key in lower:return {'tan':'wood','yellow':'gold'}.get(key,key)
 return 'sage' if sum(map(ord,id))%3==0 else 'blue' if sum(map(ord,id))%3==1 else 'rose'

def legs(w=1.7,d=.9,h=.9,color='wood'):
 for x in [-w/2,w/2]:
  for y in [-d/2,d/2]:box('Leg',(x,y,h/2),(.11,.11,h),color,.04)

def table(id,desk=False):
 color=color_for(id);w=2.1 if desk else 1.7;d=1.15
 box('Rounded tabletop',(0,0,1.0),(w,d,.13),'wood' if 'wood' in id.lower() or desk else color,.08);legs(w*.82,d*.72,.93)
 if desk:
  box('Drawer unit',(.68,.03,.60),(.57,.84,.65),color,.06)
  for z in [.43,.68]:box('Drawer face',(.68,-.411,z),(.48,.035,.20),'cream',.025);box('Drawer handle',(.68,-.445,z),(.15,.055,.035),'gold',.015)

def sofa(id):
 color='sage';w=2.4
 legs(1.8,.65,.24)
 box('Sofa base',(0,0,.37),(w,1.03,.32),color,.16)
 box('Upholstered back',(0,.40,.88),(w, .26,.85),color,.16)
 for x in [-1.11,1.11]:box('Rounded arm',(x,-.01,.63),(.28,1.06,.57),color,.13)
 for x in [-.48,.48]:box('Seat cushion',(x,-.09,.59),(.93,.78,.22),'sage',.12);box('Back cushion',(x,.22,1.0),(.9,.19,.46),'sage',.12)
 p=box('Coral accent pillow',(.63,.04,.86),(.35,.25,.35),'pink',.10);p.rotation_euler.y=.16

def chair(id):
 gaming='gaming' in id.lower();office='office' in id.lower();color=color_for(id)
 box('Seat',(0,0,.70),(.83,.76,.19),color,.12);box('Backrest',(0,.29,1.16),(.84,.17,.87),color,.13)
 if office or gaming:
  cylinder('Chair stem',(0,0,.36),.065,.56,'silver')
  for angle in range(5):
   a=angle*math.tau/5;curve('Caster spoke',[(0,0,.12),(.40*math.cos(a),.40*math.sin(a),.07)],.045,'dark');sphere('Wheel',(.4*math.cos(a),.4*math.sin(a),.07),(.075,.06,.075),'dark')
  for x in [-.46,.46]:box('Arm rest',(x,0,.94),(.12,.57,.09),'dark',.04)
 else:legs(.63,.55,.60)
 if gaming:box('Head rest',(0,.22,1.65),(.47,.23,.22),'cream',.08)

def shelf(id):
 low=id.lower();wall=any(s in low for s in ['longshelf','smallshelf','shelving','japaneseshelf'])
 if wall:
  box('Wall shelf',(0,0,.25),(2.0,.42,.14),'wood',.045)
  for x in [-.65,.65]:box('Shelf bracket',(x,.16,.15),(.08,.12,.34),'cream',.02)
 else:
  color=color_for(id);h=2.1
  for x in [-.68,.68]:box('Shelf side',(x,0,h/2),(.12,.65,h),color,.04)
  box('Shelf back',(0,.31,h/2),(1.45,.06,h),color,.035)
  for z in [.12,.72,1.32,2.03]:box('Shelf',(0,0,z),(1.46,.70,.11),'wood',.045)
  for index,x in enumerate([-.40,-.16,.1,.35]):box('Book',(x,.02,.97),(.14,.29,.41),['rose','blue','gold','sage'][index],.018)
  vase((.28,0,1.48),'cream',.45)

def closet(id):
 low=id.lower();color='wood' if 'wood' in low or 'japanese' in low else 'silver'
 if 'drawer' in low:
  box('Drawer',(0,-.3 if 'open' in low else 0,.21),(1.20,.71,.38),'wood',.04);box('Drawer front',(0,-.68 if 'open' in low else -.38,.21),(1.30,.09,.43),'cream',.04);box('Pull',(0,-.75 if 'open' in low else -.45,.21),(.21,.07,.045),'gold',.02);return
 if 'door1' in low or 'door2' in low:
  hinge=empty('Cabinet hinge',(-.38,0,0));box('Cabinet panel',(.38,0,.94),(.75,.09,1.86),'cream',.035,hinge);box('Pull',(.66,-.08,.94),(.05,.065,.24),'gold',.02,hinge);hinge.rotation_euler.z=.65 if 'open' in low else 0;return
 h=1.25 if 'clothescase' in low else 2.0
 box('Cabinet',(0,0,h/2),(1.5,.75,h),color,.06)
 if 'base' in low:
  box('Open interior',(0,-.391,h/2),(1.25,.025,h-.25),'brown',.03)
  for z in [.25,.9,1.55]:box('Inner shelf',(0,-.08,z),(1.3,.65,.06),'wood',.018)
 else:
  for x in [-.38,.38]:
   box('Cabinet door',(x,-.395,h/2),(.70,.05,h-.17),'cream' if color=='wood' else color,.03)
   box('Door handle',(x+(.21 if x<0 else -.21),-.45,h/2),(.045,.08,.23),'gold' if color=='wood' else 'dark',.015)

def plant(id):
 low=id.lower();color=color_for(id);cactus='cactus' in low;bonsai='bonsai' in low;sunflower='sunflower' in low
 cylinder('Ceramic planter',(0,0,.24),.33,.44,color);torus('Pot rim',(0,0,.43),.31,.03,color);cylinder('Soil',(0,0,.445),.285,.02,'brown')
 if cactus:
  cylinder('Cactus',(0,0,.87),.15,.85,'green');sphere('Cactus top',(0,0,1.29),(.15,.15,.16),'green')
  for side in [-1,1]:curve('Cactus arm',[(0,0,.83),(side*.32,0,.86),(side*.32,0,1.12)],.085,'green')
 elif bonsai:
  curve('Bonsai trunk',[(0,0,.44),(.13,.03,.88),(-.04,.04,1.10)],.06,'wood')
  for loc,sc in [((-.20,0,1.12),(.37,.24,.19)),((.26,.02,.96),(.29,.20,.15)),((.04,.02,1.33),(.26,.20,.15))]:sphere('Bonsai canopy',loc,sc,'green')
 elif sunflower:
  cylinder('Stem',(0,0,.88),.028,.86,'green')
  for n in range(10):
   a=n*math.tau/10;sphere('Petal',(.18*math.cos(a),-.03,1.34+.18*math.sin(a)),(.09,.04,.13),'gold')
  sphere('Flower centre',(0,-.09,1.34),(.14,.07,.14),'brown')
 else:
  for n in range(5+(sum(map(ord,id))%5)):
   angle=n*2.4;z=.72+n*(.15 if 'tall' in low else .10);x=.20*math.cos(angle);y=.20*math.sin(angle)
   curve('Stem',[(0,0,.44),(x*.5,y*.5,z-.12),(x,y,z)],.024,'green')
   leaf=sphere('Leaf',(x*1.4,y*1.4,z),(.13,.30,.065),'green');leaf.rotation_euler=(.25,0,angle)

def vase(loc=(0,0,.35),color='cream',scale=1):
 x,y,z=loc;sphere('Vase belly',(x,y,z+.22*scale),(.25*scale,.25*scale,.31*scale),color);cylinder('Vase neck',(x,y,z+.50*scale),.10*scale,.23*scale,color);torus('Vase lip',(x,y,z+.61*scale),.10*scale,.02*scale,color)

def bed(id):
 color=color_for(id)
 if 'house' in id:
  legs(1.48,1.7,.22);box('Bed frame',(0,0,.25),(1.8,2.25,.25),'wood',.08);box('Mattress',(0,0,.46),(1.72,2.14,.23),'cream',.12)
  box('Duvet',(0,-.37,.60),(1.73,1.36,.20),color,.13);box('Headboard',(0,1.07,.77),(1.88,.15,1.02),'wood',.07)
  for x in [-.43,.43]:box('Pillow',(x,.64,.64),(.70,.48,.18),'white',.12)
  for x in [-.45,0,.45]:box('Blanket seam',(x,-.37,.703),(.009,1.10,.004),'cream',0)
 else:
  cushion=sphere('Pet bed cushion',(0,0,.15),(.77,.63,.17),'cream')
  rim=torus('Soft bed rim',(0,0,.26),.64,.17,color);rim.scale=(1.20,1,1)
  sphere('Little pillow',(.34,.14,.30),(.26,.21,.10),'white')

def monitor(id,t=0):
 low=id.lower();laptop='macbook' in low;keyboard='keyboard' in low;tablet='wacom' in low;tower='tower' in low
 if keyboard:
  box('Keyboard',(0,0,.08),(1.5,.52,.12),'cream',.06)
  for y in range(3):
   for x in range(9):box('Key',(-.59+x*.15,-.16+y*.14,.152),(.105,.095,.025),'silver',.012)
 elif tablet:box('Drawing tablet',(0,0,.08),(1.5,1.0,.12),'dark',.06);box('Drawing surface',(.12,0,.148),(1.1,.76,.015),'grey',.01);curve('Stylus',[(.6,.35,.18),(.8,.50,.18)],.022,'dark')
 elif tower:
  box('PC tower',(0,0,.76),(.61,.74,1.5),'silver',.06);box('Front panel',(0,-.389,.76),(.47,.025,1.28),'dark',.03)
  for z in [.39,.75,1.11]:torus('Cooling fan',(0,-.418,z),.12,.017,'teal',rotation=(math.pi/2,0,0))
 else:
  w=1.5;h=.88
  if laptop:
   box('Laptop base',(0,-.13,.08),(1.55,1.0,.09),'silver',.035);box('Trackpad',(0,-.40,.129),(.43,.24,.006),'grey',.025)
   if 'closed' in low:box('Laptop lid',(0,-.13,.15),(1.55,1.0,.09),'silver',.045);return
   y=.34;z=.58
  else:
   cylinder('Monitor stand',(0,0,.35),.06,.58,'silver');box('Stand foot',(0,-.05,.08),(.65,.43,.10),'silver',.05);y=0;z=1.10
  if 'vertical' in low:w,h=.88,1.5
  box('Monitor',(0,y,z),(w,.11,h),'cream' if 'imac' in low else 'dark',.06)
  box('Screen',(0,y-.061,z),(w-.13,.016,h-.12),'blue',.02)
  for j in range(3):box('Screen content',(-w*.24+j*w*.22,y-.073,z-.05+.04*math.sin(t*math.tau+j)),(w*.16,.008,.11+j*.055),['cream','teal','rose'][j],.02)

def window(id):
 low=id.lower();w=1.45;h=1.7
 box('Window frame',(0,0,h/2),(w,.15,h),'wood' if 'japanese' in low else 'cream',.04)
 box('Window glass',(0,-.09,h/2),(w-.18,.025,h-.18),'blue',.025)
 for x in ([-.35,.35] if '11' in low else [0]):box('Window muntin',(x,-.125,h/2),(.055,.055,h-.15),'cream',.01)
 box('Window crossbar',(0,-.13,h*.55),(w-.12,.055,.055),'cream',.01)
 box('Sill',(0,-.12,.03),(w+.16,.35,.10),'cream',.045)
 if 'blinds' in low:
  for z in range(9):box('Blind slat',(0,-.18,.35+z*.15),(w-.08,.08,.10),'paper',.025)
 elif any(v in low for v in ['7','8','11']):
  style=ord(id[-1])-ord('A') if id[-1] in 'ABC' else 0
  curtain_color=['sage','pink','lilac'][style]
  for side in [-1,1]:
   for j in range(2+style):cylinder('Curtain fold',(side*(.69-j*.055),-.18,.90),.06,1.73,curtain_color)
  if '8' in low:box('Curtain pelmet',(0,-.18,1.65),(w+.10,.17,.20),curtain_color,.055)
 elif 'japanese' in low:
  for z in [.35,.68,1.01,1.34]:box('Shoji lattice',(0,-.13,z),(w-.12,.055,.035),'wood',.009)
  box('Sliding panel',( .34 if id.endswith('R') else -.34,-.15,h/2),(.57,.045,h-.14),'paper',.018)


def book(id):
 low=id.lower();pile='pile' in low;notebooks='notebook' in low;ring='binder' in low
 count=4 if pile else 3 if notebooks else 1
 for i in range(count):
  color=['rose','sage','blue','gold'][i] if count>1 else color_for(id)
  cover=box('Book cover',(0,0,.12+i*.17),(1.0,.68,.17),color,.025);cover.rotation_euler.z=.08*i
  box('Pages',(0,-.015,.12+i*.17),(.90,.66,.115),'paper',.009)
  box('Spine',(-.47,0,.12+i*.17),(.07,.69,.18),color,.02)
 if ring:
  for z in [.20,.50]:torus('Binder ring',(-.48,0,z),.06,.013,'gold',rotation=(math.pi/2,0,0))


def poster(id):
 low=id.lower();w=1.1;h=1.4
 box('Frame',(0,0,h/2),(w,.10,h),'wood',.035);box('Paper',(0,-.058,h/2),(w-.12,.025,h-.12),'paper',.015)
 if 'medical' in low or 'fire' in low:
  color='red' if 'fire' in low else 'teal';box('Symbol vertical',(0,-.08,h/2),(.16,.012,.60),color,.025);box('Symbol horizontal',(0,-.09,h/2),(.55,.012,.16),color,.025)
 elif 'map' in low or 'blueprint' in low:
  for j in range(4):curve('Map route',[(-.40,-.08,.30+j*.23),(-.15,-.08,.42+j*.2),(.1,-.08,.27+j*.2),(.38,-.08,.36+j*.2)],.013,'teal')
 elif 'portraitcat' in low:
  sphere('Cat portrait head',(0,-.085,.76),(.31,.035,.28),'orange')
  for x in [-.2,.2]:sphere('Portrait ear',(x,-.08,1.01),(.10,.032,.16),'orange');sphere('Portrait eye',(x*.6,-.126,.78),(.045,.02,.055),'ink')
  sphere('Portrait muzzle',(0,-.127,.63),(.18,.025,.09),'cream')
 elif 'diploma' in low:
  for i in range(5):box('Certificate line',(0,-.085,.47+i*.14),(.70-i*.06,.01,.016),'wood',.003)
  cylinder('Gold seal',(.25,-.09,.29),.11,.014,'gold',rotation=(math.pi/2,0,0))
 else:
  variant=sum(ord(c) for c in id)
  for n in range(variant%4+1):sphere('Abstract motif',(-.30+n*.18,-.084,.35+(n%3)*.24),(.10,.013,.09),['teal','rose','lilac','gold'][n%4])
  sphere('Illustrated sun',(.20,-.081,.99),(.15,.012,.15),'gold');box('Landscape',(0,-.08,.38),(.84,.012,.28),'sage',.07);sphere('Landscape hill',(-.18,-.085,.55),(.27,.015,.18),color_for(id))


def carpet(id):
 roundrug='round' in id.lower();color=color_for(id)
 if roundrug:
  o=cylinder('Round rug',(0,0,.045),.85,.055,color);torus('Rug binding',(0,0,.075),.81,.019,'cream')
 else:
  box('Rug',(0,0,.04),(1.8,1.2,.055),color,.035)
  for y in [-.5,.5]:box('Rug border',(0,y,.072),(1.63,.035,.007),'cream',.009)
  if 'classic' in id.lower() or 'red' in id.lower():
   for x in [-.5,0,.5]:o=box('Rug motif',(x,0,.078),(.25,.25,.006),'cream',.015);o.rotation_euler.z=math.pi/4

def toy(id,t=0):
 low=id.lower();color=color_for(id)
 if 'scratch' in low or 'cattree' in low:
  box('Cat tree base',(0,0,.08),(1.2,.90,.15),color,.07)
  cylinder('Sisal post',(-.15,.06,.75),.12,1.30,'paper')
  for z in range(18):torus('Rope ring',(-.15,.06,.16+z*.063),.121,.010,'wood')
  box('Upper perch',(-.15,.06,1.43),(1.0,.8,.16),color,.09)
  sphere('Cushion',(-.15,.06,1.55),(.44,.34,.10),'cream')
  sphere('Dangling toy',(.35,-.12,1.15+.03*math.sin(t*math.tau)),(.10,.10,.10),'pink')
 elif 'mouse' in low:
  sphere('Toy mouse',(0,0,.23),(.36,.22,.22),'grey')
  for x in [-.21,.21]:sphere('Mouse ear',(x,-.08,.40),(.11,.045,.11),'pink')
  sphere('Mouse nose',(0,-.25,.21),(.044,.035,.035),'pink');curve('Mouse tail',[(0,.18,.17),(.22,.49,.10),(.48,.55,.10)],.02,'pink')
 else:
  ball=sphere('Ball',(0,0,.36),(.36,.36,.36),color);ball.rotation_euler.x=t*math.tau
  for a in [0,math.pi/2]:torus('Ball seam',(0,0,.36),.36,.010,'cream',rotation=(a,math.pi/2,0))


def tv(id,t=0):
 box('TV body',(0,0,.79),(1.9,.15,1.2),'dark',.07);box('TV screen',(0,-.082,.79),(1.73,.018,1.02),'blue' if 'ani' in id.lower() else 'grey',.04)
 for x in [-.66,.66]:curve('TV foot',[(x,0,.26),(x-.1,-.16,.04),(x+.08,-.16,.04)],.04,'dark')
 if 'ani' in id.lower():
  sphere('TV sun',(.35*math.sin(t*math.tau),-.097,.94),(.19,.010,.19),'gold');box('TV landscape',(0,-.105,.5),(1.6,.01,.30),'sage',.08)


def robot(id,t=0):
 cylinder('Robot vacuum',(0,0,.16),.64,.27,'cream');cylinder('Lidar cap',(0,.07,.34),.16,.12,'silver');box('Button',(0,-.2,.31),(.15,.12,.03),'teal',.02)
 for angle in [0,2.1,4.2]:
  a=angle+t*math.tau;curve('Brush',[(.42*math.cos(a),.42*math.sin(a),.04),(.71*math.cos(a),.71*math.sin(a),.04)],.018,'dark')


def small_object(id,t=0):
 low=id.lower();color=color_for(id)
 if 'bowl' in low:bowl(color,(0,0,.07))
 elif 'yarn' in low:
  sphere('Yarn ball',(0,0,.30),(.32,.32,.32),color)
  for a in range(4):torus('Yarn strand',(0,0,.30),.321,.012,'cream',rotation=(a*.7,a*.5,.1))
  curve('Loose yarn',[(.1,-.25,.04),(.4,-.4,.04),(.57,-.27,.04),(.7,-.32,.04)],.013,color)
 elif 'lamp' in low or 'candle' in low:
  if 'lava' in low:
   cylinder('Lamp base',(0,0,.13),.24,.20,'silver');cylinder('Glass',(0,0,.72),.20,1.05,'blue')
   for i in range(3):sphere('Lava blob',(.065*math.sin(t*math.tau+i),-.185,.40+i*.22+.055*math.sin(t*math.tau+i)),(.11,.03,.11),'pink')
   cylinder('Cap',(0,0,1.27),.22,.12,'silver')
  elif 'japanese' in low:
   box('Lantern base',(0,0,.10),(.65,.65,.16),'wood',.04);box('Paper lantern',(0,0,.62),(.52,.52,.93),'paper',.05)
   for x in [-.27,.27]:
    for y in [-.27,.27]:box('Lantern frame',(x,y,.62),(.05,.05,.96),'wood',.012)
   box('Lantern lid',(0,0,1.14),(.68,.68,.10),'wood',.035)
  else:cylinder('Candle',(0,0,.40),.20,.75,'cream');sphere('Flame',(0,0,.84),(.065,.065,.13),'gold')
 elif 'carton' in low or 'box' in low:
  box('Storage box',(0,0,.45),(1.1,.85,.83),'wood' if 'carton' in low else 'cream',.055);box('Box lid',(0,0,.89),(1.16,.9,.10),color,.05);box('Box label',(0,-.446,.5),(.41,.018,.21),'paper',.015)
 elif 'cup' in low or 'tea' in low:
  cylinder('Cup',(0,0,.29),.23,.48,color);torus('Cup rim',(0,0,.53),.20,.04,color);cylinder('Tea',(0,0,.523),.18,.01,'brown');torus('Handle',(.27,0,.30),.13,.036,color,rotation=(math.pi/2,0,0))
 elif 'dish' in low:cylinder('Plate',(0,0,.05),.48,.06,'cream');torus('Plate rim',(0,0,.08),.44,.035,'cream')
 elif 'vase' in low:vase((0,0,0),color)
 elif 'pillow' in low:box('Pillow',(0,0,.22),(.9,.7,.4),'pink',.17)
 elif 'duck' in low:
  sphere('Duck body',(0,0,.3),(.4,.3,.28),'gold');sphere('Duck head',(0,-.18,.64),(.23,.23,.23),'gold');box('Beak',(0,-.42,.60),(.19,.23,.07),'orange',.035)
  for x in [-.11,.11]:sphere('Duck eye',(x,-.35,.68),(.025,.02,.028),'ink')
 elif 'towel' in low:box('Folded towel',(0,0,.14),(1.0,.6,.23),color,.07);box('Towel fold',(0,-.307,.14),(.92,.01,.03),'cream',.006)
 elif 'soap' in low:box('Soap',(0,0,.13),(.73,.40,.23),color,.10);box('Soap stamp',(0,0,.251),(.25,.14,.004),'cream',.035)
 elif 'rolledpaper' in low:
  for i in range(3):cylinder('Rolled drawing',((i-1)*.16,0,.30),.075,.58,'paper');torus('Drawing band',((i-1)*.16,0,.30),.077,.010,'wood')
 elif 'eraser' in low:box('Whiteboard eraser',(0,0,.12),(.67,.27,.21),'blue',.04);box('Felt pad',(0,0,.025),(.66,.26,.045),'dark',.015)
 elif 'paper' in low or 'blueprint' in low or 'stickynote' in low:
  box('Paper',(0,0,.025),(.85,.63,.035),color if 'sticky' in low else 'paper',.015)
  for y in [-.12,.0,.12]:box('Printed line',(-.03,y,.045),(.52,.011,.003),'blue',.003)
 elif 'calculator' in low or 'telephone' in low:
  box('Device',(0,0,.15),(.63,.9,.28),'cream',.06);box('Display',(0,.20,.30),(.42,.22,.025),'blue',.02)
  for x in [-.18,0,.18]:
   for y in [-.26,-.10,.06]:box('Button',(x,y,.30),(.10,.09,.04),'sage',.02)
 elif 'headset' in low:
  torus('Headset band',(0,0,.6),.39,.045,'dark',rotation=(math.pi/2,0,0))
  for x in [-.4,.4]:sphere('Ear cup',(x,0,.46),(.13,.12,.20),'blue')
 elif 'speaker' in low:
  box('Speaker',(0,0,.69),(.59,.45,1.30),'wood',.04)
  for z,r in [(.43,.17),(.93,.10)]:cylinder('Speaker cone',(0,-.24,z),r,.04,'dark',rotation=(math.pi/2,0,0))
 elif 'foodbag' in low:
  box('Food bag',(0,0,.51),(.69,.39,.98),'teal',.07);sphere('Paw label',(0,-.21,.57),(.16,.015,.17),'cream')
 elif 'fireext' in low:
  cylinder('Extinguisher',(0,0,.58),.23,1.10,'red');curve('Hose',[(0,0,1.2),(.24,0,1.25),(.32,0,.71)],.035,'dark')
 elif 'ruler' in low:
  box('Ruler',(0,0,.02),(1.4,.18,.035),'wood',.01)
  for x in range(12):box('Ruler mark',(-.6+x*.1,.04,.04),(.009,.07,.004),'dark',0)
 elif 'pencil' in low:
  cylinder('Pencil cup',(0,0,.30),.22,.56,'cream')
  for x in [-.12,0,.12]:cylinder('Pencil',(x,0,.68),.021,.59,color);sphere('Eraser',(x,0,.985),(.024,.024,.035),'pink')
 elif 'trash' in low or 'bin' in low:
  cylinder('Bin',(0,0,.43),.37,.80,color);torus('Bin rim',(0,0,.82),.35,.025,'cream')
  if 'full' in low: sphere('Crumpled paper',(0,0,.82),(.29,.24,.23),'paper')
 elif 'clock' in low:
  cylinder('Clock body',(0,0,.60),.54,.10,'wood',rotation=(math.pi/2,0,0));cylinder('Clock face',(0,-.063,.60),.48,.02,'cream',rotation=(math.pi/2,0,0))
  curve('Hour hand',[(0,-.08,.60),(.12,-.08,.83)],.018,'dark');curve('Minute hand',[(0,-.085,.60),(-.32,-.085,.65+t*.15)],.012,'dark')
 elif 'tissues' in low or 'toiletpaper' in low:
  if 'toilet' in low:cylinder('Paper roll',(0,0,.28),.25,.50,'cream');cylinder('Roll core',(0,0,.537),.065,.018,'wood')
  else:box('Tissue box',(0,0,.17),(.85,.50,.30),'blue',.04);box('Tissue',(0,0,.46),(.28,.05,.39),'white',.02)
 elif 'ac' in low or 'aircon' in low:
  box('Air conditioner',(0,0,.40),(1.65,.37,.72),'cream',.08)
  for z in [.25,.31,.37]:box('Vent',(0,-.20,z),(1.33,.015,.025),'silver',.01)
 else:
  # Compact stationery and personal accessories retain their own silhouette.
  box('Accessory',(0,0,.19),(.75,.51,.34),color,.08);box('Detail',(0,-.27,.19),(.39,.03,.13),'cream',.025)

def console(id):
 low=id.lower();handheld=any(v in low for v in ['gameboy','psp','switch'])
 if handheld:
  vertical=low.endswith('gameboy');w,h=(1.05,1.45) if vertical else (1.65,.75)
  color='cream' if vertical or 'advance' in low else 'dark'
  box('Handheld console',(0,0,.12),(w,h,.22),color,.10);box('Game screen',(0,.12,.239),(w*.55,h*.55,.02),'sage' if vertical else 'blue',.035)
  for x in [-w*.35,w*.35]:cylinder('Control button',(x,-h*.12,.245),.065,.035,'coral' if x>0 else 'grey')
  if 'switch' in low:
   box('Left controller',(-.70,0,.16),(.26,.75,.24),'blue',.07);box('Right controller',(.70,0,.16),(.26,.75,.24),'coral',.07)
  if 'advance' in low:
   for x in [-.75,.75]:sphere('Rounded grip',(x,0,.10),(.22,.40,.11),'lilac')
  return
 cube='gamecube' in low;vertical=any(v in low for v in ['ps2','ps5','xboxx','xbox360','wii'])
 cream=any(v in low for v in ['dreamcast','ps1','snes','nes4','wii','xbox360','ps5'])
 color='purple' if cube else 'cream' if cream else 'dark'
 scale=(1.04,1.04,.90) if cube else (.49,.72,1.43) if vertical else (1.4,.94,.31)
 w,d,h=scale;box('Console housing',(0,0,h/2),scale,color,.10)
 if any(v in low for v in ['dreamcast','ps1','gamecube','sega','xbox']):
  cylinder('Disc cover',(0,0,h+.015),min(w,d)*.34,.018,'grey' if cream else 'black')
 if 'atari' in low:
  box('Wood front',(0,-d/2-.018,h/2),(w,.06,h*.7),'wood',.025)
  for i in range(8):box('Case ridge',(-.55+i*.16,0,h+.02),(.055,d*.8,.027),'grey',.008)
 if 'nes' in low and 'snes' not in low:box('Cartridge flap',(.22,-.04,h+.02),(.52,.61,.035),'grey',.018)
 if 'ps4' in low:
  box('Upper console slab',(.06,0,h+.14),(w,d,.20),'black',.03);box('Blue power line',(0,-d/2-.015,h+.04),(w*.9,.015,.018),'blue',.005)
 if 'ps5' in low:
  for x in [-.27,.27]:panel=box('White curved side',(x,0,h/2),(.09,d+.12,h+.18),'white',.07);panel.rotation_euler.y=x*.22
 if 'n64' in low:
  for x in [-.45,0,.45]:cylinder('Controller port',(x,-d/2-.03,.13),.075,.025,'grey',rotation=(math.pi/2,0,0))
 if 'xbox' in low:
  for sign in [-1,1]:mark=box('Cross logo',(0,0,h+.04),(.48,.055,.018),'green',.015);mark.rotation_euler.z=sign*math.pi/4
 if 'snes' in low:
  for x in [-.3,.3]:cylinder('Top button',(x,-.12,h+.035),.095,.025,'purple')
 box('Disc slot',(0,-d/2-.009,h*.60),(w*.55,.015,.019),'grey',.004);sphere('Power indicator',(w*.30,-d/2-.02,h*.30),(.025,.014,.025),'teal')
 if cube:curve('Cube handle',[(-.3,.48,.6),(-.3,.65,.6),(.3,.65,.6),(.3,.48,.6)],.055,'grey')
 sphere('Controller',(.64,-.66,.13),(.39,.23,.11),'dark')
 for x in [.46,.80]:cylinder('Controller stick',(x,-.69,.25),.055,.06,'grey')

def bathroom(id,t=0):
 low=id.lower();color=color_for(id)
 if 'bathani' in low:
  box('Bathtub base',(0,0,.28),(2.0,1.0,.55),'cream',.22);box('Bath water',(0,0,.57),(1.60,.67,.03),'blue',.12)
  for x in [-.89,.89]:box('Tub rim',(x,0,.64),(.22,1.06,.19),'white',.10)
  for y in [-.47,.47]:box('Tub rim',(0,y,.64),(1.93,.20,.19),'white',.10)
  tap((.75,.32,.66))
  for n in range(3):torus('Water ripple',(-.30+n*.3,0,.6),.10+n*.03,.012,'cream')
 elif 'wcfurniture' in low:
  box('Vanity cabinet',(0,0,.45),(1.3,.70,.88),'wood',.07);box('Vanity top',(0,0,.92),(1.4,.78,.10),'cream',.04);torus('Sink rim',(0,-.04,.985),.25,.035,'white');tap((.35,.15,1.0))
  for x in [-.3,.3]:box('Cabinet door',(x,-.368,.45),(.55,.03,.68),'sage',.025)
 elif 'wctap' in low:
  tap((0,0,.10));curve('Flowing water',[(0,-.30,.40),(0,-.30,.10)],.025,'blue')
 elif 'wc' in low:
  cylinder('Toilet pedestal',(0,-.17,.24),.29,.46,'cream');sphere('Toilet bowl',(0,-.22,.55),(.45,.59,.20),'cream');seat=torus('Toilet seat',(0,-.24,.72),.36,.061,'white');seat.scale.y=1.32
  box('Toilet tank',(0,.38,.83),(.76,.37,.82),'cream',.13);box('Tank lid',(0,.38,1.26),(.80,.41,.07),'white',.04);box('Flush button',(.21,.36,1.31),(.10,.08,.025),'silver',.015)
 elif 'mirror' in low:
  cylinder('Mirror frame',(0,0,.78),.66,.085,'wood',rotation=(math.pi/2,0,0));cylinder('Mirror',(0,-.052,.78),.59,.025,'silver',rotation=(math.pi/2,0,0))
  curve('Reflection',[(-.32,-.075,.45),(.22,-.075,1.04)],.02,'cream')
 elif 'showerfloor' in low or 'showertray' in low:
  box('Shower tray',(0,0,.09),(1.65,1.65,.16),'cream',.09);cylinder('Drain',(0,0,.183),.12,.012,'silver')
  for x in [-.5,0,.5]:box('Tile seam',(x,0,.179),(.01,1.55,.007),'silver',0)
 elif 'tap' in low:
  tap((0,0,.15))
  if 'shower' in low:curve('Shower riser',[(0,0,.2),(0,.1,1.6),(0,-.3,1.7)],.035,'silver');cylinder('Shower head',(0,-.3,1.68),.19,.065,'silver')
 elif 'hanger' in low:
  curve('Hanger',[(-.6,0,.10),(0,0,.53),(.6,0,.10),(-.6,0,.10)],.033,'wood');curve('Hook',[(0,0,.53),(0,0,.80),(.12,0,.87),(.19,0,.77)],.025,'silver')
 else:small_object(id,t)

def tap(loc):
 x,y,z=loc;cylinder('Tap base',(x,y,z),.09,.13,'silver');curve('Curved tap',[(x,y,z),(x,y,z+.4),(x,y-.23,z+.45),(x,y-.30,z+.30)],.044,'silver');box('Tap lever',(x+.11,y,z+.24),(.25,.065,.055),'silver',.025)

def machine(id,t=0):
 low=id.lower();color='cream' if 'white' in low or 'wood' not in low else 'wood'
 if 'waterdispenser' in low:
  box('Water cooler',(0,0,.82),(.78,.72,1.6),'cream',.07);cylinder('Water bottle',(0,0,1.9),.26,.7,'blue');box('Dispenser recess',(0,-.37,1.05),(.50,.04,.40),'grey',.025)
  for x,c in [(-.14,'blue'),(.14,'red')]:box('Tap button',(x,-.4,1.15),(.10,.08,.10),c,.025)
 elif 'projectorscreen' in low:
  cylinder('Stand',(0,0,.75),.035,1.4,'silver');box('Projection screen',(0,0,1.5),(2.0,.08,1.15),'cream',.025);box('Screen housing',(0,0,2.13),(2.12,.15,.12),'silver',.03)
  for a in [0,2.1,4.2]:curve('Tripod leg',[(0,0,.15),(.4*math.cos(a),.4*math.sin(a),.025)],.025,'silver')
 elif 'projector' in low:
  box('Projector',(0,0,.19),(1.0,.65,.34),'cream',.08);cylinder('Projector lens',(.26,-.35,.20),.115,.08,'blue',rotation=(math.pi/2,0,0))
 elif 'medical' in low:
  box('First aid kit',(0,0,.4),(1.02,.35,.75),'cream',.06);box('Medical cross v',(0,-.191,.40),(.12,.025,.38),'coral',.025);box('Medical cross h',(0,-.21,.40),(.37,.025,.12),'coral',.025);curve('Handle',[(-.20,0,.77),(-.20,0,.96),(.20,0,.96),(.20,0,.77)],.035,'wood')
 else:
  h=1.25 if 'copy' in low or 'shredder' in low else .57
  box('Office machine',(0,0,h/2),(1.0,.90,h),color,.07);box('Control panel',(.27,-.31,h+.05),(.35,.22,.08),'blue',.03);box('Paper output',(0,-.37,h*.45),(.72,.27,.06),'dark',.025);box('Printed page',(0,-.51,h*.48),(.52,.5,.012),'paper',.01)
  box('Lid',(0,0,h+.06),(1.02,.92,.10),'silver',.04)


def door(id,t=0):
 sliding='sliding' in id.lower();w=1.65;h=2.1
 for x in [-w/2,w/2]:box('Door jamb',(x,0,h/2),(.10,.18,h),'wood',.025)
 box('Door header',(0,0,h),(w+.1,.18,.10),'wood',.025)
 leaf=empty('Door hinge',(-w/2+.08,0,0))
 box('Door leaf',(w/2-.10,0,h/2),(w-.20,.11,h-.12),'paper',.04,leaf)
 for z in [.60,1.18,1.76]:box('Door lattice',(w/2-.10,-.075,z),(w-.22,.05,.045),'wood',.009,leaf)
 for x in [.5,1.0]:box('Door lattice',(x,-.075,h/2),(.035,.045,h-.18),'wood',.009,leaf)
 box('Door handle',(w-.35,-.095,.93),(.05,.06,.21),'gold',.015,leaf)
 leaf.rotation_euler.z=.75*math.sin(t*math.pi) if not sliding else 0
 if sliding:leaf.location.x+=.60*math.sin(t*math.pi)


def board(id):
 low=id.lower();w=1.75;h=1.10
 box('Board frame',(0,0,.78),(w,.10,h),'wood',.04);box('Board surface',(0,-.058,.78),(w-.12,.025,h-.12),'wood' if 'cork' in low else 'cream',.018)
 if 'empty' not in low:
  for i in range(5):box('Note',(-.57+(i%3)*.52,-.085,.52+(i//3)*.44),(.36,.015,.29),['sage','pink','blue','gold','paper'][i],.015)


def tori():
 for x in [-.75,.75]:cylinder('Gate pillar',(x,0,.95),.12,1.90,'red')
 box('Gate crossbeam',(0,0,1.60),(2.1,.23,.13),'red',.045);box('Gate lintel',(0,0,2.04),(2.3,.35,.21),'wood',.07)

def family(id):
 low=id.lower()
 if id.startswith('bed-'):return 'bed'
 if id.startswith('toy-') or low.startswith('cattree'):return 'toy'
 if low.startswith('room'):return 'room'
 if low.startswith('sofa') and 'pillow' not in low:return 'sofa'
 if low.startswith('chair') or low=='japaneseseat':return 'chair'
 if 'window' in low:return 'window'
 if low.startswith('poster') or any(s in low for s in ['canvas','diploma','pictureframe','portrait','photos']):return 'poster'
 if low.startswith('computer'):return 'monitor'
 if low.startswith('tv') or 'tvoff' in low:return 'tv'
 if low.startswith('console'):return 'console'
 if 'door' in low and 'closet' not in low:return 'door'
 if 'closet' in low or 'clothescase' in low:return 'closet'
 if 'shelf' in low or 'shelving' in low or 'rack' in low:return 'shelf'
 if 'table' in low or low.startswith('desk') or 'projectorstand' in low:return 'table'
 if 'carpet' in low:return 'carpet'
 if 'plant' in low or 'bonsai' in low:return 'plant'
 if low.startswith('books') or low=='livingbook':return 'book'
 if 'robot' in low or 'rumba' in low:return 'robot'
 if 'torigate' in low:return 'tori'
 if any(s in low for s in ['copy','printer','projector','shredder','medicalkit','waterdispenser']):return 'machine'
 if 'board' in low or 'partition' in low or 'glasswall' in low:return 'board'
 if low.startswith('bathroom'):return 'bathroom'
 return 'small'

def build_item(entry,t=0):
 id=entry['id'];f=family(id);before=set(bpy.context.scene.objects)
 if f=='bed':bed(id)
 elif f=='toy':toy(id,t)
 elif f=='sofa':sofa(id)
 elif f=='chair':chair(id)
 elif f=='window':window(id)
 elif f=='poster':poster(id)
 elif f=='monitor':monitor(id,t)
 elif f=='console':console(id)
 elif f=='tv':tv(id,t)
 elif f=='door':door(id,t)
 elif f=='closet':closet(id)
 elif f=='shelf':shelf(id)
 elif f=='table':table(id,'desk' in id.lower() or 'drawing' in id.lower())
 elif f=='carpet':carpet(id)
 elif f=='plant':plant(id)
 elif f=='book':book(id)
 elif f=='robot':robot(id,t)
 elif f=='tori':tori()
 elif f=='machine':machine(id,t)
 elif f=='board':board(id)
 elif f=='bathroom':bathroom(id,t)
 else:small_object(id,t)
 objects=list(set(bpy.context.scene.objects)-before);root=empty(id+' orientation')
 for o in objects:
  if o.parent is None:o.parent=root
 # Window look variants all remain in the same wall plane. Wall side is
 # mirrored separately by the app, never inferred from the style index.
 groups=ROTATION_GROUPS
 for group in groups:
  if id in group:root.rotation_euler.z=group.index(id)*math.pi/2
 # The fourth monitor variant changes the screen to portrait, facing forward.
 root['asset_id']=id;root['orientation_degrees']=round(math.degrees(root.rotation_euler.z))
 bpy.context.scene['projection_direction']=list(ROOM_VIEW_DIRECTION)
 bpy.context.view_layer.update();return objects,root


def room(entry):
 scene=setup(1024,True);index=int(entry['id'][4:])-1
 colors=['rose','blue','lilac','wood','sage','pink','teal','cream','gold','grey','purple','blue','green','coral','brown'];wall=colors[index]
 box('Rounded room foundation',(0,0,-.13),(5.1,5.1,.26),'wood',.10)
 box('Cream floor',(0,0,.018),(5.0,5.0,.10),'cream',.04)
 box('Left wall',(-2.46,0,1.38),(.17,5.0,2.8),wall,.035)
 box('Back wall',(0,2.46,1.38),(5.0,.17,2.8),wall,.035)
 box('Left skirting',(-2.35,0,.12),(.085,4.9,.18),'cream',.025)
 box('Back skirting',(0,2.35,.12),(4.9,.085,.18),'cream',.025)
 for x in [-1.6,-.8,0,.8,1.6]:box('Subtle floor joint',(x,0,.071),(.011,4.8,.002),'paper',0)
 objects=[o for o in scene.objects if o.type=='MESH'];scene.camera.location=(8,-8,7);aim(scene.camera,(0,0,.9));scene.camera.data.ortho_scale=7.85
 render(OUT/'rooms'/f"{entry['id']}.png")
 library=BLENDER_OUT/'rooms';library.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(library/(entry['id']+'.blend')),compress=True)


def animate_furniture(objects,t):
 for o in objects:
  name=o.name
  if name.startswith('Door hinge'):o.rotation_euler.z=.7*math.sin(t*math.pi)
  elif name.startswith('TV sun'):o.location.x=.35*math.sin(t*math.tau)
  elif name.startswith('Lava blob'):o.location.z=.4+.13*math.sin(t*math.tau+o.location.x*10)
  elif name.startswith('Printed page'):o.location.y=-.51+.10*math.sin(t*math.tau)
  elif name.startswith('Brush'):o.rotation_euler.z=t*math.tau
  elif name.startswith('Cooling fan'):o.rotation_euler.y=t*math.tau
  elif name.startswith('Screen content'):o.scale.z=1+.35*math.sin(t*math.tau+o.location.x*3)
  elif name.startswith('Cabinet door'):o.rotation_euler.z=.25*math.sin(t*math.tau)
  elif name.startswith('Control panel') or name.startswith('Tap button'):o.scale.z=1+.25*math.sin(t*math.tau)
  elif name.startswith('Projector lens'):o.scale=(1+.08*math.sin(t*math.tau),)*3
  elif name.startswith('Medical cross'):o.scale=(1+.06*math.sin(t*math.tau),)*3
  elif name.startswith('Projection screen'):o.scale.z=1-.12*(1-math.cos(t*math.tau))
  elif name.startswith('Toilet seat'):o.rotation_euler.x=.22*math.sin(t*math.tau)
  elif name.startswith('Flowing water'):o.scale.z=1+.2*math.sin(t*math.tau)
  elif name.startswith('Minute hand'):o.rotation_euler.y=.10*math.sin(t*math.tau)
  elif name.startswith('Water ripple'):o.scale=(1+.25*math.sin(t*math.tau),)*3


def render_furniture(entries):
 for entry in entries:
  if entry['kind']=='room':continue
  id=entry['id'];animated=(entry.get('animated',False) or id in ['toy-orangeBall','toy-blueBall','toy-pinkBall','toy-mouse']);count=8 if animated else 1
  dest=OUT/'frames'/id if animated else OUT/entry['kind'];dest.mkdir(parents=True,exist_ok=True)
  if '--refresh' not in ARGS and animated and all((dest/f'{i:03}.png').exists() for i in range(count)):continue
  if '--refresh' not in ARGS and not animated and (dest/f'{id}.png').exists():continue
  scene=setup(192 if animated else 256);objects,root=build_item(entry);frame_camera(objects,1.22)
  scene.render.fps=12;scene.frame_start=1;scene.frame_end=count
  for i in range(count):
   scene.frame_set(i+1)
   animate_furniture(objects,i/count)
   if id.startswith('toy-'):
    root.rotation_euler.z=.15*math.sin(i/count*math.tau);root.location.z=.03*max(0,math.sin(i/count*math.tau))
   if animated:
    for o in [root,*objects]:
     for prop in ['location','rotation_euler','scale']:o.keyframe_insert(data_path=prop,frame=i+1)
   render(dest/(f'{i:03}.png' if animated else f'{id}.png'))
  library=BLENDER_OUT/'items';library.mkdir(parents=True,exist_ok=True)
  bpy.ops.wm.save_as_mainfile(filepath=str(library/f'{id}.blend'),compress=True)
  print('ASSET_DONE',id,flush=True)

CAT_CLIPS=json.loads((ROOT/'scripts/3d/clips.json').read_text())

def cat_play_box():
 # Open cardboard box with a low front so the cat stays visible.
 box('Box bottom',(0,0,.08),(1.35,.92,.12),'wood',.05)
 for x in [-.65,.65]:box('Box side',(x,0,.28),(.08,.94,.43),'wood',.035)
 box('Box front',(0,-.43,.25),(1.31,.08,.36),'wood',.025)
 box('Box back',(0,.43,.30),(1.31,.08,.47),'wood',.025)

def render_cats():
 skins=[ARGS[ARGS.index('--skin')+1]] if '--skin' in ARGS else ['orange','grey','white']
 states=ARGS[ARGS.index('--clips')+1].split(',') if '--clips' in ARGS else list(CAT_CLIPS)
 if any(skin not in ['orange','grey','white'] for skin in skins):raise ValueError('Unknown cat coat')
 if any(state not in CAT_CLIPS for state in states):raise ValueError('Unknown cat clip')
 for skin in skins:
  for state,(count,fps) in CAT_CLIPS.items():
   if state not in states:continue
   dest=OUT/'frames'/('cat-'+skin+'-'+state);dest.mkdir(parents=True,exist_ok=True)
   if '--refresh' not in ARGS and all((dest/f'{i:03}.png').exists() for i in range(count)):continue
   scene=setup(CAT_FRAME_SIZE);rig=cat(skin,boxed=state.startswith('box'));configure_cat_camera(scene)
   slide,food=care_props(state) if state=='eating' or state.startswith('box') else (None,[])
   scene.render.fps=fps;scene.frame_start=1;scene.frame_end=count
   for i in range(count):
    scene.frame_set(i+1);t=i/(count-1) if state in ['sleepy','lieDown','eating','correct','incorrect','excited','dance','surprised','restSleep','box1','box2','box3'] else i/count
    cat_pose(rig,state,t)
    if slide:pose_care_props(slide,food,state,t)
    for obj in animated_parts(rig)+food+([slide] if slide else []):
     for prop in ['location','rotation_euler','scale']:obj.keyframe_insert(data_path=prop,frame=i+1,group='Math Mews '+state)
    if rig['boxed']:
     # Animated point coordinates do not refresh AUTO handles on saved playback.
     for point in range(4):
      for prop in ['co','handle_left','handle_right']:rig['tail_curve'].data.keyframe_insert(data_path=f'splines[0].bezier_points[{point}].{prop}',frame=i+1)
     for prop in ['box_activity','transfer_hop']:rig['root'].keyframe_insert(data_path=f'["{prop}"]',frame=i+1)
    render(dest/f'{i:03}.png')
   if skin=='orange':
    library=BLENDER_OUT;bpy.ops.wm.save_as_mainfile(filepath=str(library/(state+'.blend')),compress=True)
   print('CAT_DONE',skin,state,flush=True)


def branding():
 sample()
 for id in ['store','stats']:
  scene=setup(640)
  if id=='store':
   box('Shop',(0,0,.68),(1.7,.95,1.35),'cream',.13);box('Door',(.40,-.49,.45),(.40,.035,.80),'teal',.045);box('Shop window',(-.42,-.49,.70),(.64,.025,.60),'blue',.04)
   box('Roof',(0,0,1.40),(1.9,1.1,.15),'wood',.06)
   for n in range(8):
    stripe=box('Striped awning',(-.81+n*.23,-.64,1.18),(.23,.52,.13),'coral' if n%2==0 else 'cream',.03);stripe.rotation_euler.x=.20
   box('Sign',(0,-.50,1.66),(1.1,.12,.34),'teal',.08)
   for x in [-.12,.12]:sphere('Paw toe',(x,-.58,1.72),(.055,.03,.055),'cream')
   sphere('Paw pad',(0,-.58,1.61),(.09,.03,.07),'cream')
  else:
   box('Chart base',(0,0,.08),(1.7,1.1,.15),'cream',.08)
   for x,h,c in [(-.50,.55,'blue'),(0,.92,'teal'),(.50,1.30,'coral')]:box('Progress column',(x,0,h/2+.16),(.35,.55,h),c,.08)
   curve('Growth line',[(-.62,-.39,.8),(0,-.39,1.19),(.6,-.39,1.58)],.04,'gold')
   sphere('Reward coin',(.60,-.39,1.62),(.15,.06,.15),'gold')
  frame_camera([o for o in scene.objects if o.type in ['MESH','CURVE']],1.15)
  render(OUT/(id+'-icon.png'));bpy.ops.wm.save_as_mainfile(filepath=str(BLENDER_OUT/(id+'.blend')),compress=True)

def main():
 entries=json.loads((ROOT/'scripts/3d/inventory.json').read_text())['entries']
 if ONLY=='preview':sample();return
 if ONLY=='branding':branding();return
 if ONLY=='samples':
  (OUT/'rooms').mkdir(exist_ok=True)
  room(next(e for e in entries if e['id']=='room1'));render_furniture([e for e in entries if e['id'] in ['sofaA','livingTable','plantSmall','chairClassicA','bed-brown']]);return
 if ONLY=='cat':render_cats();return
 if ONLY=='rotations':render_furniture([e for e in entries if e['id'] in ROTATION_BASE]);return
 if ONLY and ONLY.startswith('room') and ONLY!='rooms':room(next(e for e in entries if e['id']==ONLY));return
 if ONLY and ONLY not in ['furniture','rooms']:
  render_furniture([e for e in entries if e['id']==ONLY]);return
 if ONLY in [None,'rooms']:
  (OUT/'rooms').mkdir(exist_ok=True)
  for entry in entries:
   if entry['kind']=='room' and ('--refresh' in ARGS or not (OUT/'rooms'/f"{entry['id']}.png").exists()):room(entry);print('ROOM_DONE',entry['id'],flush=True)
 if ONLY in [None,'furniture']:render_furniture(entries)
 if ONLY is None:render_cats()

if __name__=='__main__':main()
