"""Original boss dioramas. Blender --background --python this_file -- [--id train] [--preview]."""
from pathlib import Path
import bpy, math, sys, os
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
# Use the same authored materials, rounded primitives and lighting as the room assets.
scope={'__file__':str(ROOT/'scripts/3d/render_assets.py'),'__name__':'boss_helpers'}
exec(compile((ROOT/'scripts/3d/render_assets.py').read_text(),scope['__file__'],'exec'),scope)
box,sphere,cylinder,torus,curve,empty,setup,aim,material=[scope[k] for k in ('box','sphere','cylinder','torus','curve','empty','setup','aim','material')]
from boss_cat import StoryCat
OUT=Path(os.environ.get('BRAINPET_BOSS_RENDER_DIR',str(ROOT/'assets/3d/bosses')));SOURCE=ROOT/'prototypes/boss-scenes'
bpy.context.preferences.filepaths.save_version=0
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
IDS=['train','picnic','boats','music','shelves','kite','tickets','lift','theatre','parcels','fountain','lanterns','observatory','garden','signal','shop','shelter','vault']
GROUPS=[];MOTIONS=[];CAT=None
def group(name,stage=0):
 g=empty(name);g['completed_stage']=stage;GROUPS.append((g,stage));return g
def move(g,offset=(0,0,0),angle=0,axis=2,bob=0):
 MOTIONS.append((g,Vector(g.location),Vector(offset),g.rotation_euler.copy(),angle,axis,bob))
def pole(x,y,z,h=1.4,color='wood',parent=None):
 return cylinder('Post',(x,y,z+h/2),.045,h,color,parent)
def panel(name,points,color,parent=None):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(points,[],[list(range(len(points)))]);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(material(color));o.parent=parent
 solid=o.modifiers.new('Paper thickness','SOLIDIFY');solid.thickness=.018
 return o
def flag(x,y,z,color='coral',parent=None):
 pole(x,y,z,.55,'wood',parent);panel('Pennant',[(x,y,z+.55),(x+.3,y,z+.44),(x,y,z+.32)],color,parent)
def crate(x,y,z,parent=None,color='wood',size=.28):
 box('Crate',(x,y,z+size/2),(size,size,size),color,.035,parent)
 box('Crate band',(x,y-.003,z+size*.52),(size*.13,size+.02,size+.015),'paper',.008,parent)
def wheel(x,y,z,parent):
 cylinder('Wheel',(x,y,z),.12,.07,'dark',parent,(math.pi/2,0,0))
def cart(x,y,parent=None):
 g=empty('Cart',(x,y,0),parent);box('Cart tray',(0,0,.38),(.65,.48,.12),'teal',.04,g)
 for xx in [-.24,.24]:
  for yy in [-.24,.24]:wheel(xx,yy,.22,g)
 return g
def flower(x,y,z,parent=None,color='coral'):
 g=empty('Flower',(x,y,z),parent);cylinder('Stem',(0,0,.15),.018,.3,'green',g)
 for i in range(5):
  a=i*math.tau/5;sphere('Petal',(.1*math.cos(a),.1*math.sin(a),.35),(.085,.065,.04),color,g)
 sphere('Flower center',(0,0,.37),(.045,.045,.035),'gold',g);return g
def bunting(x1,x2,y,z,count=7,parent=None):
 curve('Bunting cord',[(x1,y,z),(0,y,z-.16),(x2,y,z)],.014,'wood',parent)
 for i in range(count):
  x=x1+(x2-x1)*(i+.5)/count;zz=z-.14*(1-(x/max(abs(x1),abs(x2)))**2)
  pennant=empty('Waving pennant',(x,y,zz),parent)
  panel('Bunting flag',[(-.09,0,0),(.09,0,0),(0,0,-.19)],['coral','teal','gold'][i%3],pennant);move(pennant,angle=.25,axis=0,bob=.015)
def building(name,x,y,w=1.5,h=1.2,color='paper',parent=None):
 box(name,(x,y,h/2+.13),(w,.75,h),color,.07,parent)
 panel('Roof front',[(x-w*.6,y-.5,h+.12),(x+w*.6,y-.5,h+.12),(x,y-.5,h+.6)],'coral',parent)
 panel('Roof back',[(x-w*.6,y+.5,h+.12),(x+w*.6,y+.5,h+.12),(x,y+.5,h+.6)],'coral',parent)
 box('Roof plane',(x-w*.3,y,h+.36),(w*.72,1.08,.07),'coral',.02,parent).rotation_euler[1]=-.47
 box('Roof plane',(x+w*.3,y,h+.36),(w*.72,1.08,.07),'coral',.02,parent).rotation_euler[1]=.47
 box('Window',(x-w*.27,y-.388,h*.7),(.3,.025,.3),'blue',.025,parent)
def boat(x,y,parent):
 g=empty('Paper boat',(x,y,.22),parent)
 panel('Boat hull',[(-.22,-.12,0),(.22,-.12,0),(.31,0,.12),(0,.15,0),(-.31,0,.12)],'paper',g)
 panel('Paper sail',[(-.13,0,.07),(.13,0,.07),(0,0,.38)],'gold',g);return g

def build(id):
 global GROUPS,MOTIONS,CAT
 GROUPS=[];MOTIONS=[];scene=setup(512)
 # Drop orphan geometry between missions; only the current cat and diorama
 # belong in the editable source. Helper materials are rebuilt on demand.
 scope['MATS'].clear();bpy.data.orphans_purge(do_recursive=True);scene.timeline_markers.clear()
 scene.render.resolution_x=512;scene.render.resolution_y=320
 scene.render.film_transparent=True;scene.render.fps=8
 scene.render.engine='BLENDER_EEVEE';scene.render.image_settings.color_mode='RGBA'
 scene.render.threads_mode='FIXED';scene.render.threads=2
 # Fixed framing across every state avoids a camera jump on a saved checkpoint.
 scene.camera.location=(5.8,-8.8,6.5);aim(scene.camera,(0,0,.8));scene.camera.data.ortho_scale=7.5 if id in ['shelves','theatre','observatory'] else 6.8
 box('Diorama island',(0,0,0),(4.1,2.65,.22),'sage' if id in ['picnic','garden','kite','lanterns'] else 'paper',.16)
 if id=='train':
  for yy in [-.52,-.13]:box('Rail',(0,yy,.15),(3.9,.045,.04),'silver',.01)
  for x in [i*.3-1.8 for i in range(13)]:box('Sleeper',(x,-.32,.13),(.12,.65,.06),'wood',.015)
  box('Platform',(0,.75,.3),(3.4,.7,.38),'grey',.06)
  for x in [-1.4,1.4]:pole(x,.9,.49,1.2)
  box('Station sign',(0,.9,1.58),(1.4,.12,.32),'teal',.05)
  g=group('Stops prepared',1)
  for x in [-1.25,-.4,.4,1.25]:sphere('Platform light',(x,.38,.55),(.07,.07,.1),'gold',g)
  train=group('Train ready',2);train.location=(-.7,-.33,.2)
  box('Engine',(0,0,.35),(1.0,.36,.38),'teal',.07,train);cylinder('Boiler',(.3,0,.63),.19,.55,'coral',train,(0,math.pi/2,0))
  box('Cab',(-.3,0,.72),(.36,.43,.5),'teal',.04,train);box('Cab window',(-.3,-.23,.79),(.21,.02,.22),'blue',.01,train)
  cylinder('Chimney',(.37,0,.92),.08,.28,'dark',train)
  for x in [-.3,.3]:
   for y in [-.22,.22]:wheel(x,y,.19,train)
  move(train,(1.4,0,0))
  g=group('Passengers aboard',3)
  for i in range(3):crate(-1.2+i*.3,.6,.5,g,['coral','gold','blue'][i],.2)
 elif id=='picnic':
  box('Picnic blanket',(0,-.1,.15),(2.9,1.9,.04),'coral',.02)
  for x in [-1,-.5,0,.5,1]:box('Blanket weave',(x,-.1,.18),(.045,1.9,.008),'paper',0)
  g=group('Ribbons packed',1);box('Picnic basket',(-.7,.1,.45),(.6,.5,.5),'wood',.07,g)
  torus('Basket handle',(-.7,.1,.8),.25,.035,'wood',g,(math.pi/2,0,0))
  for x in [-.85,-.55]:cylinder('Ribbon roll',(x,-.2,.28),.1,.08,'teal',g)
  g=group('Places prepared',2)
  for i in range(13):
   a=i*math.tau/13;cylinder('Place setting',(1.2*math.cos(a),.72*math.sin(a)-.1,.23),.095,.025,'paper',g)
  g=group('Picnic open',3);bunting(-1.6,1.6,.85,1.7,13,g)
  for x in [-1.65,1.65]:pole(x,.85,.1,1.65,parent=g)
  for x in [-1.6,1.6]:
   f=flower(x,-.9,.13,g);move(f,(0,0,.12),bob=.08)
 elif id=='boats':
  box('River',(0,-.15,.13),(3.9,1.45,.04),'blue',.2)
  for x in [-1.25,1.2]:box('Dock',(x,.1,.24),(.6,1.7,.13),'wood',.04)
  building('Boat house',1.2,.84,.85,.65)
  for stage,x in [(1,-1.1),(2,0),(3,.85)]:
   g=group('Rescued flotilla '+str(stage),stage)
   for i in range(3):boat(x+i*.2,-.8+i*.4,g)
   if stage==3:move(g,(.35,.22,0),bob=.035)
 elif id=='music':
  box('Music box',(0,0,.4),(1.9,1.35,.6),'wood',.1);box('Gold inset',(0,0,.73),(1.65,1.15,.08),'gold',.05)
  lid=group('Music box lid',1);lid.location=(0,.6,.75)
  box('Open lid',(0,.12,.6),(1.9,.12,1.15),'wood',.08,lid);box('Lid mirror',(0,.04,.6),(1.55,.03,.85),'blue',.07,lid)
  g=group('Winding gears',2)
  for x in [-.5,0,.5]:
   gear=empty('Turning gear',(x,0,.83),g);move(gear,angle=math.tau)
   torus('Clockwork',(0,0,0),.2,.05,'gold',gear)
   for i in range(8):
    a=i*math.tau/8;box('Gear tooth',(.23*math.cos(a),.23*math.sin(a),0),(.1,.1,.08),'gold',.01,gear)
  g=group('Tune restored',3)
  for i in range(5):
   note=empty('Rising note',(-.8+i*.4,-.2,1.1+(i%2)*.25),g)
   sphere('Note head',(0,0,0),(.09,.06,.07),'teal',note);pole(.06,0,0,.3,'teal',note);move(note,(0,0,.25),angle=.2,bob=.08)
 elif id=='shelves':
  box('Workshop wall',(0,.85,1.1),(3.6,.16,2),'paper',.05)
  for stage,(rows,cols,z) in enumerate([(2,5,.25),(3,4,.85),(4,6,1.45)],1):
   box('Display shelf',(0,.45,z),(3.3,.7,.09),'wood',.03)
   g=group('Display '+str(stage),stage)
   for r in range(rows):
    for c in range(cols):
     x=(c-(cols-1)/2)*.36;y=.2+r*.13
     sphere('Toy mouse',(x,y,z+.11),(.11,.07,.06),['teal','coral','gold'][stage-1],g)
   if stage==3:move(g,angle=.04,bob=.025)
  g=group('Workshop open',3);bunting(-1.7,1.7,.75,2.4,7,g);move(g,(0,0,.08),bob=.06)
 elif id=='kite':
  spool=group('Repair kit',0);cylinder('String spool',(-1,-.7,.3),.17,.3,'wood',spool)
  kite=group('Kite frame',0);kite.location=(.35,0,1.15);kite.rotation_euler[0]=math.radians(75)
  pts=[(.65*math.cos(math.pi/2+i*math.tau/6),.95*math.sin(math.pi/2+i*math.tau/6),0) for i in range(6)]
  for i in range(6):curve('Kite spar',[(0,0,0),pts[i]],.02,'wood',kite)
  for i in range(6):
   g=group('Sail section '+str(i),1 if i<2 else 3);g.parent=kite
   panel('Sail panel',[(0,0,.015),pts[i],pts[(i+1)%6]],'coral' if i<2 else 'teal',g)
  g=group('Equivalent patch seams',2);g.parent=kite
  for i in range(6):
   p=Vector(pts[i]);q=Vector(pts[(i+1)%6]);curve('Panel seam',[(0,0,.04),tuple((p+q)/2+Vector((0,0,.04)))],.008,'paper',g)
  curve('Kite tail',[(0,-.85,0),(.15,-1.1,0),(-.1,-1.35,0)],.018,'wood',kite)
  move(kite,(.2,0,.45),angle=-.2,axis=1,bob=.08)
 elif id=='tickets':
  for x in [-1.35,1.35]:pole(x,.5,.12,1.9,'teal')
  box('Festival arch',(0,.5,2),(2.9,.26,.3),'coral',.07)
  g=group('Ticket desk',1);box('Desk',(-.9,-.35,.55),(1,.65,.85),'teal',.06,g)
  g=group('Guest list ready',2)
  for i in range(5):box('Ticket',( -.9+i*.06,-.45,.99+i*.014),(.35,.18,.015),'paper',.008,g)
  gate=group('Welcome gate',0);gate.location=(0,.45,.18)
  box('Gate rail',(0,0,.6),(1.1,.07,.08),'wood',.01,gate)
  for x in [-.4,0,.4]:box('Gate bar',(x,0,.4),(.05,.06,.5),'wood',.01,gate)
  move(gate,angle=-1.25)
  g=group('Festival opens',3)
  for i in range(3):
   balloon=empty('Balloon',(-1.6+i*1.6,.7,1.7),g);sphere('Balloon globe',(0,0,0),(.17,.17,.23),['gold','teal','coral'][i],balloon)
   curve('Balloon string',[(0,0,-.2),(.06,0,-.7)],.008,'wood',balloon);move(balloon,(0,0,.35),bob=.06)
 elif id=='lift':
  for x,z,r in [(-.9,.7,1.1),(.8,1.2,1.3)]:
   bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=r,depth=z*2,location=(x,.6,z));bpy.context.object.data.materials.append(material('sage'))
  for x,z in [(-1.5,.2),(1.2,1.8)]:pole(x,0,z,.7,'wood')
  curve('Lift cable',[(-1.5,0,.9),(1.2,0,2.5)],.025,'dark')
  g=group('Supplies counted',1)
  for i in range(3):crate(-1.65+i*.28,-.7,.12,g)
  carrier=group('Supply lift loaded',2);carrier.location=(-1.2,-.06,.45)
  box('Lift cabin',(0,0,.2),(.55,.5,.45),'coral',.05,carrier);box('Lift window',(0,-.26,.25),(.35,.02,.2),'blue',.02,carrier)
  move(carrier,(2.2,0,1.35))
  g=group('Rescue cabin supplied',3);flag(1.4,.3,1.45,'gold',g)
 elif id=='theatre':
  box('Stage',(0,.65,.3),(3.3,1,.4),'wood',.08)
  for x in [-1.6,1.6]:pole(x,1,.45,1.9,'gold')
  box('Theatre header',(0,1,2.3),(3.4,.18,.2),'coral',.04)
  for side in [-1,1]:
   curtain=group('Curtain '+str(side),0);curtain.location=(side*.55,1,1.35)
   box('Curtain cloth',(0,0,0),(1.1,.12,1.65),'coral',.05,curtain);move(curtain,(side*.85,0,0))
  for stage,rr,cc in [(1,7,8),(2,7,1),(3,1,9)]:
   g=group('Audience seating '+str(stage),stage)
   for r in range(rr):
    for c in range(cc):
     col=c if stage==1 else 8 if stage==2 else c;row=r if stage<3 else 7
     box('Seat',((col-4)*.3,-1+row*.18,.2),(.19,.12,.1),'teal',.02,g)
  g=group('Firefly performance',3)
  for i in range(7):
   f=sphere('Firefly',(-1+i*.33,.3,1.1+(i%3)*.18),(.055,.055,.055),'gold',g);move(f,(0,0,.25),bob=.12)
 elif id=='parcels':
  building('Parcel depot',0,.8,2,.9,'teal')
  g=group('Arriving crates',1)
  for i in range(4):crate(-1.5+i*.45,.15,.12,g)
  g=group('Carts loaded',2)
  for i in range(4):
   c=cart(-1.35+i*.85,-.65,g)
   for j in range(7):crate((j%3-.9)*.18,(j//3-.7)*.16,.46,c,'gold',.15)
  move(g,(.35,0,0))
  g=group('Reserve for next delivery',3)
  for i in range(3):crate(.9+i*.25,.6,.12,g,'coral',.2)
 elif id=='fountain':
  cylinder('Basin',(0,0,.25),1.1,.24,'paper');torus('Basin rim',(0,0,.42),1,.1,'wood')
  for i in range(8):
   a=i*math.tau/8;g=group('Mosaic '+str(i),1 if i<3 else 3)
   box('Mosaic tile',(.88*math.cos(a),.88*math.sin(a),.48),(.32,.25,.06),'teal' if i<3 else 'paper',.02,g).rotation_euler[2]=a
  g=group('Split mosaic seams',2)
  for i in range(8):
   a=i*math.tau/8;box('Tile split',(.88*math.cos(a),.88*math.sin(a),.52),(.02,.25,.01),'wood',.002,g).rotation_euler[2]=a
  cylinder('Fountain pedestal',(0,0,.7),.2,.7,'wood');cylinder('Top bowl',(0,0,1.1),.5,.15,'paper')
  g=group('Fountain flowing',3)
  for i in range(8):
   a=i*math.tau/8;curve('Water stream',[(.3*math.cos(a),.3*math.sin(a),1.15),(.7*math.cos(a),.7*math.sin(a),1.25),(.8*math.cos(a),.8*math.sin(a),.48)],.035,'blue',g)
  move(g,bob=.045)
 elif id=='lanterns':
  for i in range(9):
   x=-1.6+i*.4;y=.4*math.sin(i*.7);cylinder('Trail stone',(x,y,.15),.22,.05,'grey')
  for stage,x in enumerate([-1.2,0,1.2],1):
   y=.45;pole(x,y,.1,1.5,'wood');box('Lantern frame',(x,y,1.65),(.35,.28,.5),'dark',.04)
   g=group('Lantern '+str(stage)+' lit',stage);box('Lantern light',(x,y-.16,1.65),(.23,.04,.34),'gold',.03,g)
   if stage==3:move(g,bob=.035)
  g=group('Trail open',3);bunting(-1.6,1.6,.7,2.25,9,g)
 elif id=='observatory':
  cylinder('Observatory base',(.35,.5,.55),.9,1,'paper');sphere('Dome',(.35,.5,1.15),(.95,.95,.7),'teal')
  g=group('Power restored',1);box('Power console',(-1.2,-.6,.45),(.6,.4,.65),'teal',.04,g)
  for x in [-1.35,-1.2,-1.05]:sphere('Power indicator',(x,-.82,.57),(.045,.02,.045),'gold',g)
  telescope=group('Telescope aligned',2);telescope.location=(.35,-.45,1.35)
  barrel=cylinder('Telescope',(0,0,0),.18,1.2,'wood',telescope,(0,math.pi/2,0));torus('Lens',(.62,0,0),.16,.035,'gold',telescope,(0,math.pi/2,0));move(telescope,angle=.35,axis=1)
  g=group('Stars found',3)
  comet=empty('Comet',(-1.2,.6,2.2),g)
  sphere('Comet head',(0,0,0),(.12,.1,.1),'gold',comet)
  curve('Comet tail',[(0,0,0),(-.35,.1,.08),(-.65,.2,.15)],.045,'paper',comet);move(comet,(1.9,0,.05))
  for i in range(7):
   a=i*.9;s=sphere('Star',(-1.5+i*.5,.8,2.2+.25*math.sin(a)),(.045,.045,.045),'gold',g);move(s,bob=.06)
 elif id=='garden':
  for q in range(4):
   x=(-.85 if q%2==0 else .85);y=(-.55 if q<2 else .55)
   box('Garden bed',(x,y,.2),(1.45,.85,.2),'wood',.04);box('Soil',(x,y,.32),(1.3,.7,.04),'brown',.02)
  g=group('Flower spaces planned',1)
  for i in range(18):
   q=i//6;j=i%6;x=(-.85 if q%2==0 else .85)+(j%3-1)*.35;y=(-.55 if q<2 else .55)+(j//3-.5)*.3
   cylinder('Planting marker',(x,y,.36),.045,.03,'paper',g)
  g=group('Paths reserved',2);box('Garden path',(.85,.55,.37),(1.25,.65,.06),'paper',.03,g)
  g=group('Garden planted',3)
  for i in range(18):
   q=i//6;j=i%6;x=(-.85 if q%2==0 else .85)+(j%3-1)*.35;y=(-.55 if q<2 else .55)+(j//3-.5)*.3
   f=flower(x,y,.35,g,['coral','gold','lilac'][q]);move(f,(0,0,.05),angle=.07,axis=1,bob=.035)
 elif id=='signal':
  box('Signal hut',(-1,-.2,.5),(1,.7,.8),'teal',.07)
  for x in [.2,1.2]:
   for y in [-.4,.4]:pole(x,y,.1,2.3,'silver')
  for z in [.6,1.1,1.6,2.1]:
   box('Tower crossbar',(.7,0,z),(1.1,.9,.05),'silver',.01)
  g=group('Pulse connected',1);curve('Power cable',[(-.5,-.2,.2),(.3,-.2,.2),(.7,0,1.2)],.035,'coral',g)
  g=group('Amplifier ready',2);box('Amplifier',(.7,0,1.4),(.6,.5,.5),'teal',.06,g)
  g=group('Signal broadcast',3);sphere('Antenna',(.7,0,2.6),(.11,.11,.11),'gold',g)
  for i in range(3):
   ring=torus('Signal wave',(.7,0,2.6),.25+i*.17,.02,'gold',g,(math.pi/2,0,0));move(ring,(.15,-.45-i*.12,0),bob=.035)
 elif id=='shop':
  building('Toy shop',0,.65,2.8,1.2,'teal');box('Shopfront window',(-.7,.25,.75),(.7,.04,.6),'blue',.04)
  for i in range(9):box('Awning stripe',(-1.2+i*.3,.05,1.5),(.28,.65,.1),'coral' if i%2 else 'paper',.025)
  g=group('Discount calculated',1);box('Sale tag',(-1.25,-.2,.7),(.45,.08,.45),'gold',.03,g)
  g=group('Prices ready',2);box('Toy stand',(-.7,-.7,.3),(.75,.5,.3),'wood',.04,g)
  for i in range(3):sphere('Toy ball',(-.95+i*.25,-.7,.56),(.1,.1,.1),['gold','coral','teal'][i],g)
  door=group('Shop door',0);door.location=(.35,.22,.14);box('Door',( .35,0,.5),(.65,.05,1),'wood',.03,door);sphere('Door handle',(.56,-.05,.55),(.035,.035,.035),'gold',door);move(door,angle=-1.25)
  g=group('Shop open',3);flag(1.45,.3,1.1,'gold',g)
 elif id=='shelter':
  box('Rooftop',(0,0,.28),(3.6,2.25,.4),'grey',.08)
  for x in [-1.1,1.1]:
   for y in [-.6,.6]:pole(x,y,.5,1.1,'wood')
  g=group('Roof area measured',1)
  box('Roof panel',(0,0,1.7),(2.7,1.7,.12),'coral',.04,g)
  for i in range(8):box('Tile seam',(-1.05+i*.3,0,1.77),(.012,1.65,.006),'paper',0,g)
  for i in range(6):box('Tile seam',(0,-.6+i*.24,1.77),(2.65,.012,.006),'paper',0,g)
  g=group('Crates delivered',2)
  for i in range(9):crate(-1.7+(i%3)*.27,.4+(i//3)*.27,.51,g,'wood',.23)
  g=group('Shelter ready',3);box('Dry cushion',(0,-.1,.57),(1.2,.7,.15),'teal',.1,g);flag(1.2,.65,1.7,'gold',g)
  sun=sphere('Sun',(-1.5,.8,1.85),(.25,.25,.25),'gold',g);move(sun,(0,0,.2))
 elif id=='vault':
  box('Archive wall',(0,.65,1.15),(3.6,.22,2.1),'grey',.08)
  torus('Vault frame',(0,.45,1.1),.9,.15,'wood',None,(math.pi/2,0,0))
  door=group('Vault door',0);door.location=(-.85,.36,1.1)
  cylinder('Door disk',(.85,0,0),.85,.15,'teal',door,(math.pi/2,0,0));torus('Dial',(.85,-.1,0),.2,.04,'gold',door,(math.pi/2,0,0));move(door,angle=-1.15)
  g=group('Door clue solved',1);sphere('Lock lamp',(1.25,.4,1.8),(.09,.04,.09),'gold',g)
  g=group('Drawers checked',2)
  for i in range(6):box('Drawer',(-1.4+(i%2)*.33,.3,.45+(i//2)*.37),(.28,.22,.3),'wood',.025,g)
  g=group('Archive unlocked',3)
  for i in range(5):box('Archive book',(-.4+i*.2,.7,.45),(.14,.32,.55),['coral','gold','blue','sage','lilac'][i],.02,g)
  move(g,(0,-.25,0))
  star=empty('Hidden star',(0,.22,1.1),g)
  points=[(math.sin(i*math.pi/5)*(.32 if i%2==0 else .15),-.08,math.cos(i*math.pi/5)*(.32 if i%2==0 else .15)) for i in range(10)]
  panel('Star',points,'gold',star);move(star,(0,-.12,.5),angle=.2)
 CAT=StoryCat(scene,id,scope)
 return scene

def pose(completed,t=0,reaction=False):
 for g,stage in GROUPS:
  s=1 if completed>=stage else .00001;g.scale=(s,s,s)
 for g,base,offset,rot,angle,axis,bob in MOTIONS:
  u=(t*t*(3-2*t)) if completed==3 else 0
  g.location=base+offset*u
  if completed==3:g.location.z+=math.sin(t*math.tau)*bob
  g.rotation_euler=rot.copy();g.rotation_euler[axis]+=angle*u
  if g.name.startswith('Flower'):
   grow=.08+.92*u if completed==3 else 1;g.scale=(grow,grow,grow)
 CAT.pose(completed,t,reaction)

def run(id):
 folder=OUT/id;folder.mkdir(parents=True,exist_ok=True);scene=build(id)
 # Save a genuinely editable Blender timeline with the three progress checkpoints
 # and the same two-second outcome that is rendered into the native atlas.
 timeline=[(1,0,0,False),(2,1,0,True),*[(3+i,1,i/7,True) for i in range(8)],
  (11,2,0,True),*[(12+i,2,i/7,True) for i in range(8)],
  (20,3,0,True),*[(21+i,3,i/15,True) for i in range(16)]]
 for frame,stage,t,reaction in timeline:
  pose(stage,t,reaction)
  for g,_ in GROUPS:
   g.keyframe_insert('scale',frame=frame);g.keyframe_insert('location',frame=frame);g.keyframe_insert('rotation_euler',frame=frame)
  for g,*_ in MOTIONS:
   g.keyframe_insert('scale',frame=frame);g.keyframe_insert('location',frame=frame);g.keyframe_insert('rotation_euler',frame=frame)
  CAT.key(frame)
 scene.frame_start=1;scene.frame_end=36
 for name,frame in [('Before mission',1),('Task 1 cat reaction',2),('Task 2 cat reaction',11),('Mission outcome and cat',20)]:scene.timeline_markers.new(name,frame=frame)
 scene.frame_set(1)
 bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(id+'.blend')),compress=True)
 # Clearing animation data lets authored poses render directly without Blender
 # evaluating a previous timeline key over them. The saved source keeps its keys.
 for obj in list(scene.objects):obj.animation_data_clear()
 CAT.clear_geometry_keys()
 for stage in range(4):
  pose(stage,1 if stage==3 else 0);CAT.record(stage,f'state-{stage}');scene.render.resolution_x=768;scene.render.resolution_y=480
  scene.render.filepath=str(folder/f'state-{stage}.png');bpy.ops.render.render(write_still=True)
 if '--preview' not in ARGS:
  scene.render.resolution_x=512;scene.render.resolution_y=320
  for stage in [1,2,3]:
   count=16 if stage==3 else 8
   for i in range(count):
    pose(stage,i/(count-1),True);prefix='outcome' if stage==3 else f'reaction-{stage}'
    CAT.record(stage,f'{prefix}-{i:02}')
    scene.render.filepath=str(folder/f'{prefix}-{i:02}.png');bpy.ops.render.render(write_still=True)
 CAT.write_metadata(folder)
 print('BOSS_SCENE_DONE',id,flush=True)

SOURCE.mkdir(parents=True,exist_ok=True)
selected=[ARGS[ARGS.index('--id')+1]] if '--id' in ARGS else IDS
for id in selected:
 assert id in IDS;run(id)
