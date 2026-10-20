"""Individual lesson characters and mechanical story scenes, authored in Blender."""
from pathlib import Path
import bpy, math, json, sys, os, hashlib, time
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/3d'))
from boss_cat import StoryCat, BLOCKING
scope={'__file__':str(ROOT/'scripts/3d/render_assets.py'),'__name__':'lesson_boss_helpers'}
exec(compile((ROOT/'scripts/3d/render_assets.py').read_text(),scope['__file__'],'exec'),scope)
box,sphere,cylinder,torus,curve,empty,setup,aim=[scope[k] for k in ('box','sphere','cylinder','torus','curve','empty','setup','aim')]
SPECS=json.loads((ROOT/'data/lesson-boss-scenes.json').read_text())
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT=Path(os.environ.get('BRAINPET_LESSON_BOSS_RENDER_DIR','/tmp/brainpet-lesson-boss-renders'))
SOURCE=ROOT/'prototypes/boss-scenes/lessons'
CONTROLS=[];REVEALS=[];MOVERS=[];BASES={};SPEC=None;CAT=None;BOSS=None;PARTS={}

def control(name,loc=(0,0,0),parent=None):
 o=empty(name,loc,parent);CONTROLS.append(o);return o
def reveal(name,stage,loc=(0,0,0)):
 o=control(name,loc);REVEALS.append((o,stage));return o
def flag(x,y,z,color='coral',parent=None):
 cylinder('Flag pole',(x,y,z+.4),.025,.8,'wood',parent)
 box('Fabric flag',(x+.15,y,z+.67),(.3,.025,.2),color,.02,parent)
def cargo(loc,parent=None,color='wood'):
 box('Cargo crate',loc,(.34,.3,.3),color,.035,parent)
 box('Cargo strap',(loc[0],loc[1]-.015,loc[2]),(.05,.32,.32),'paper',.007,parent)
def tree(x,y,color='sage'):
 cylinder('Tree trunk',(x,y,.55),.07,.9,'wood');sphere('Tree crown',(x,y,1.15),(.38,.32,.5),color)
def arch(name,x,y,color):
 for xx in [x-.7,x+.7]:box(name+' post',(xx,y,.8),(.12,.14,1.4),'wood',.035)
 box(name+' header',(x,y,1.55),(1.55,.2,.24),color,.06)

def backdrop(s):
 w=s['world'];i=s['worldIndex'];c=['teal','coral','gold','blue','lilac','sage'][i%6]
 box('Rounded story island',(0,0,.04),(4.8,3.2,.18),'paper' if i%2 else 'sage',.16)
 # The place has its own silhouette and physical landmarks, not a recolored room.
 if w=='train':
  for y in [.85,1.15]:box('Rail',(0,y,.17),(4.3,.035,.04),'silver',.01)
  for x in [-1.8,-1.2,-.6,0,.6,1.2,1.8]:box('Sleeper',(x,1,.14),(.12,.55,.04),'wood',.015)
  arch('Station canopy',0,1.25,'teal')
 elif w=='picnic':
  box('Picnic cloth',(0,.7,.16),(3.6,1.1,.04),'coral',.025)
  for x in [-1.4,-.7,0,.7,1.4]:box('Cloth stripe',(x,.7,.19),(.045,1.05,.01),'paper',0)
  cargo((-1.65,1,.36));flag(1.8,1,.15,'gold')
 elif w=='boats':
  box('Harbor water',(0,.8,.14),(4.3,1.2,.04),'blue',.16)
  for x in [-1.7,1.7]:box('Dock',(x,.75,.3),(.55,1.4,.13),'wood',.045)
  arch('Harbor gate',0,1.4,'blue')
 elif w=='music':
  box('Keyboard stand',(0,1.05,.4),(3.5,.7,.5),'wood',.08)
  for n in range(12):box('Ivory key',(-1.5+n*.27,.66,.7),(.24,.35,.09),'paper',.015)
  for n in [1,2,4,6,7,9,10]:box('Black key',(-1.5+n*.27,.8,.78),(.1,.25,.07),'dark',.01)
 elif w=='shelves':
  box('Workshop bench',(0,1.1,.7),(3.5,.8,.18),'wood',.06)
  for x in [-1.3,1.3]:box('Bench leg',(x,1.1,.4),(.16,.5,.7),'wood',.025)
  for x in [-1.2,-.4,.4,1.2]:sphere('Wooden toy',(x,1.1,.92),(.14,.14,.14),c)
 elif w=='kite':
  for x,y in [(-1.8,1),(1.8,1.1)]:tree(x,y)
  frame=control('Meadow kite',(.7,1.3,1.3));box('Kite spine',(0,0,0),(.045,.03,1.1),'wood',.01,frame)
  o=box('Diamond sail',(0,0,0),(.7,.045,.7),'coral',.025,frame);o.rotation_euler[1]=math.pi/4
  curve('Kite tail',[(.7,1.3,.9),(.6,1.3,.6),(.9,1.3,.3)],.02,'gold')
 elif w=='tickets':
  arch('Festival arch',0,1.25,'gold')
  for x in [-1.8,-1.4,1.4,1.8]:box('Festival fence',(x,1.2,.45),(.12,.1,.65),'teal',.025)
  for x in [-.4,0,.4]:sphere('Hanging lantern',(x,1.22,1.3),(.12,.12,.15),'gold')
 elif w=='lift':
  for x,z in [(-1.75,1.4),(1.7,1.9)]:
   box('Lift tower',(x,1,z/2),(.14,.15,z),'wood',.035)
   torus('Cable wheel',(x,1,z),.2,.035,'dark',rotation=(math.pi/2,0,0))
  curve('Mountain cable',[(-1.75,1,1.4),(0,1,1.55),(1.7,1,1.9)],.018,'silver')
 elif w=='theatre':
  box('Stage',(0,.9,.34),(3.8,1.3,.4),'wood',.08)
  for x in [-1.6,1.6]:
   box('Theatre curtain',(x,1.3,1.2),(.45,.18,1.65),'coral',.1)
  box('Curtain rail',(0,1.3,2),(3.8,.18,.18),'gold',.04)
 elif w=='parcels':
  box('Depot awning',(0,1.2,1.5),(3.5,.85,.16),'teal',.06)
  for x in [-1.5,1.5]:box('Depot post',(x,1.2,.8),(.12,.12,1.4),'wood',.025)
  for x in [-1.6,-1.2,1.2,1.6]:cargo((x,.85,.35),color='coral' if x<0 else 'gold')
 elif w=='fountain':
  for x in [-1.6,-.8,0,.8,1.6]:
   for y in [.9,1.3]:box('Mosaic tile',(x,y,.16),(.6,.3,.04),'blue' if x<0 else 'teal',.04)
  arch('Mosaic garden',0,1.5,'blue')
 elif w=='lanterns':
  for x in [-1.8,1.8]:tree(x,1.15,'green')
  for x in [-1.2,0,1.2]:
   cylinder('Lantern post',(x,1.1,.6),.035,.9,'wood');sphere('Trail lantern',(x,1.1,1.15),(.12,.12,.17),'gold')
 elif w=='observatory':
  sphere('Observatory dome',(.85,1.25,.7),(.8,.6,.7),'blue')
  cylinder('Dome rim',(.85,1.25,.18),.82,.12,'silver')
  for x,z in [(-1.7,1.4),(-1.2,1.9),(-.6,1.5)]:sphere('Star marker',(x,1.3,z),(.055,.055,.055),'gold')
 elif w=='garden':
  for x in [-1.3,1.3]:
   box('Raised bed',(x,1,.27),(1.1,.8,.25),'wood',.05)
   box('Garden soil',(x,1,.4),(.95,.65,.04),'brown',.025)
   for dx in [-.3,0,.3]:sphere('Garden sprout',(x+dx,1,.55),(.09,.06,.18),'green')
 elif w=='signal':
  for x in [-.6,.6]:box('Signal tower leg',(x,1.2,.95),(.1,.12,1.6),'silver',.025)
  for z in [.45,.9,1.35,1.75]:box('Tower crossbar',(0,1.2,z),(1.35,.16,.07),'silver',.015)
  box('Relay hut',(-1.6,1.2,.5),(.7,.65,.7),'teal',.06)
 elif w=='shop':
  arch('Shopfront',0,1.3,'teal')
  for n in range(10):box('Striped awning',(-1.55+n*.345,1.05,1.7),(.33,.7,.1),'coral' if n%2 else 'paper',.02)
  box('Shop counter',(0,1.2,.5),(2.8,.65,.6),'wood',.05)
 elif w=='shelter':
  for x in [-1.4,1.4]:box('Shelter post',(x,1.1,.8),(.12,.12,1.4),'wood',.035)
  box('Shelter roof',(0,1.15,1.6),(3.3,1.15,.14),'coral',.05)
  for x in [-1.2,0,1.2]:sphere('Bird cushion',(x,1,.25),(.28,.2,.09),'teal')
 elif w=='vault':
  for x in [-1.4,1.4]:
   box('Archive case',(x,1.2,.8),(.7,.55,1.35),'wood',.05)
   for n in range(4):box('Archive book',(x-.22+n*.145,.88,.8),(.1,.3,.65),['coral','teal','gold','lilac'][n],.015)
  arch('Archive doorway',0,1.4,'grey')

def character(s):
 global BOSS,PARTS
 a=s['animal'];i=s['worldIndex'];color=['brown','lilac','orange','grey','paper','brown','green','brown','teal'][['beaver','owl','fox','mouse','rabbit','hedgehog','turtle','otter','robot'].index(a)]
 BOSS=control('Boss '+s['name'],(1.55,-.75,.2));PARTS={}
 def orb(n,p,size,col):return sphere(n,p,size,col,BOSS)
 if a=='robot':
  box('Robot body',(0,0,.4),(.43,.32,.55),color,.08,BOSS)
  head=control('Robot head',(0,0,.9),BOSS);box('Robot face',(0,0,0),(.52,.35,.35),'teal',.09,head)
  cylinder('Robot antenna',(0,0,1.2),.025,.2,'silver',BOSS);orb('Antenna tip',(0,0,1.32),(.06,.06,.06),'gold')
 else:
  orb('Character body',(0,0,.4),(.3,.25,.4),color)
  head=control('Boss head',(0,-.035,.92),BOSS);sphere('Character face',(0,0,0),(.32,.26,.3),color,head)
  if a=='owl':
   for x in [-.15,.15]:sphere('Owl face patch',(x,-.22,.01),(.15,.045,.17),'paper',head)
   sphere('Owl beak',(0,-.3,-.07),(.065,.08,.07),'gold',head)
  else:
   sphere('Muzzle',(0,-.22,-.1),(.2,.1,.12),'paper',head);sphere('Nose',(0,-.32,-.05),(.045,.035,.035),'dark',head)
  for x in [-.2,.2]:
   ear=control('Ear',(x,.02,.21),head)
   sphere('Ear outside',(0,0,.06),(.085,.06,.27 if a=='rabbit' else .12),color,ear)
   sphere('Ear inside',(0,-.045,.065),(.045,.025,.2 if a=='rabbit' else .07),'pink',ear)
  if a=='beaver':
   orb('Beaver tail',(0,.3,.16),(.18,.35,.09),'wood')
   for x in [-.045,.045]:box('Beaver tooth',(x,-.29,.74),(.065,.04,.11),'paper',.01,BOSS)
  elif a=='fox':
   tail=control('Fox tail',(.15,.2,.2),BOSS);sphere('Fluffy tail',(.2,.23,.18),(.19,.38,.19),'orange',tail);sphere('White tail tip',(.22,.48,.18),(.15,.16,.15),'paper',tail);PARTS['tail']=tail
  elif a=='hedgehog':
   for n in range(11):
    angle=n*math.tau/11;orb('Soft spine',(.26*math.sin(angle),.15+.12*math.cos(angle),.45+.1*(n%3)),(.075,.15,.2),'wood')
  elif a=='turtle':
   orb('Turtle shell',(0,.13,.45),(.37,.27,.42),'sage')
   for n in range(5):orb('Shell tile',(.16*math.sin(n*math.tau/5),.34,.48+.15*math.cos(n*math.tau/5)),(.1,.025,.12),'green')
  elif a=='otter':orb('Otter tail',(.12,.3,.12),(.12,.38,.1),'brown')
 # Eyes, highlights and purposeful movable limbs remain clear at card scale.
 for x in [-.12,.12]:
  sphere('Boss eye',(x,-.26,.02),(.047,.035,.06),'ink',head)
  sphere('Eye highlight',(x-.012,-.291,.04),(.014,.01,.016),'white',head)
 for sign in [-1,1]:
  arm=control('Working paw '+str(sign),(sign*.29,-.02,.54),BOSS)
  sphere('Paw',(0,-.05,-.12),(.085,.1,.2),color,arm);PARTS['paw'+str(sign)]=arm
  foot=control('Working foot '+str(sign),(sign*.17,-.1,.05),BOSS)
  sphere('Foot',(0,0,0),(.13,.19,.09),color,foot);PARTS['foot'+str(sign)]=foot
 PARTS['head']=head
 hat=control('Profession cap',(0,0,1.2),BOSS)
 cylinder('Cap brim',(0,0,0),.32,.035,['gold','teal','coral'][i%3],hat)
 sphere('Cap crown',(0,.015,.05),(.24,.22,.1),['gold','teal','coral'][i%3],hat)

def mechanism(s):
 m=s['mechanism'];i=s['worldIndex'];c=['teal','coral','lilac','gold','blue','sage'][i%6]
 box('Working plinth',(0,0,.23),(2.25,1.1,.18),'wood',.08)
 if m=='bridge':
  for x in [-.9,.9]:
   g=reveal('Bridge support '+str(x),1,(x,0,.3));box('Pillar',(0,0,.27),(.18,.7,.55),'wood',.03,g)
  deck=reveal('Opening bridge deck',2,(0,0,.56));box('Bridge deck',(0,0,0),(2.1,.72,.1),c,.035,deck)
  for x in [-.9,-.45,0,.45,.9]:box('Bridge plank',(x,0,.065),(.36,.7,.025),'paper',.02,deck)
  for y in [-.35,.35]:curve('Rope railing',[(-1,y,.2),(0,y,.35),(1,y,.2)],.025,'gold',deck)
  MOVERS.append(('bridge',deck))
 elif m=='book':
  g=reveal('Reading stand',1,(0,.1,.4));box('Book stand',(0,0,.05),(1.5,.65,.12),'wood',.04,g)
  book=reveal('Book binding',2,(-.65,0,.58));box('Book back',(.65,0,0),(1.4,.72,.1),c,.025,book)
  cover=control('Turning cover',(0,0,.1),book);box('Book cover',(.65,0,0),(1.35,.7,.045),c,.015,cover)
  for n in range(5):
   p=control('Turning page '+str(n),(0,0,.09+n*.014),book);box('Paper page',(.65,0,0),(1.25,.64,.012),'paper',.005,p);MOVERS.append(('page'+str(n),p))
  MOVERS.append(('cover',cover))
 elif m=='loom':
  g=reveal('Loom frame',1)
  for x in [-.85,.85]:box('Loom upright',(x,.2,.9),(.12,.18,1.35),'wood',.035,g)
  box('Loom top',(0,.2,1.6),(1.9,.2,.12),'wood',.035,g)
  for n in range(7):curve('Warp thread',[(-.65+n*.22,.18,.45),(-.65+n*.22,.18,1.55)],.012,'paper',g)
  shuttle=reveal('Weaving shuttle',2,(-.7,.02,1));box('Shuttle',(0,0,0),(.38,.16,.12),c,.045,shuttle);MOVERS.append(('shuttle',shuttle))
  cloth=reveal('Woven fabric',3,(0,.1,.55));box('Unrolling cloth',(0,0,0),(1.35,.045,.7),c,.025,cloth)
  for n in range(5):box('Cloth band',(0,-.03,-.28+n*.14),(1.3,.015,.035),'gold',.005,cloth)
  MOVERS.append(('cloth',cloth))
 elif m=='clock':
  g=reveal('Mechanism casing',1);box('Clock casing',(0,.2,.8),(1.7,.25,1.25),'wood',.1,g)
  for n,(x,z,r) in enumerate([(-.45,.9,.31),(.15,1,.25),(.5,.62,.22)]):
   gear=reveal('Driven gear '+str(n),2,(x,-.02,z));cylinder('Gear center',(0,0,0),r,.09,c,gear,(math.pi/2,0,0))
   for k in range(10):
    a=k*math.tau/10;o=box('Gear tooth',(math.sin(a)*r,0,math.cos(a)*r),(.09,.1,.12),'gold',.012,gear);o.rotation_euler[1]=a
   MOVERS.append(('gear'+str(n),gear))
  g=reveal('Clock bell',3);sphere('Bell',(0,.2,1.6),(.25,.2,.15),'gold',g)
 elif m=='balloon':
  g=reveal('Launch basket',1,(0,0,.5));box('Balloon basket',(0,0,0),(.68,.52,.45),'wood',.07,g)
  balloon=reveal('Rising balloon',2,(0,0,.6));sphere('Balloon envelope',(0,0,1.15),(.66,.5,.78),c,balloon)
  for x in [-.25,.25]:
   for y in [-.2,.2]:curve('Balloon rope',[(x,y,0),(x*1.6,y*1.5,.8)],.016,'wood',balloon)
  MOVERS.extend([('basket',g),('balloon',balloon)])
  load=reveal('Balanced cargo',3,(0,0,.66));cargo((0,0,0),load,'gold');MOVERS.append(('load',load))
 elif m=='sorter':
  g=reveal('Receiving bins',1)
  for x in [-.8,.8]:box('Receiving tray',(x,.25,.55),(.65,.65,.22),c,.055,g)
  belt=reveal('Conveyor rollers',2)
  for n in range(8):cylinder('Roller',(-.8+n*.23,-.35,.65),.085,.45,'silver',belt,(math.pi/2,0,0))
  for n in range(3):
   load=reveal('Moving delivery '+str(n),3,(-.8+n*.3,-.35,.85));cargo((0,0,0),load,['coral','gold','teal'][n]);MOVERS.append(('cargo'+str(n),load))
  gate=control('Sorter diverter',(0,.1,.75));box('Cargo guide',(0,0,0),(.5,.08,.12),'wood',.025,gate);MOVERS.append(('gate',gate))
 elif m=='boat':
  g=reveal('Boat channel',1);box('Water channel',(0,0,.42),(2.4,.9,.08),'blue',.13,g)
  boat=reveal('Sailing vessel',2,(-.65,0,.6));sphere('Boat hull',(0,0,0),(.52,.24,.15),c,boat)
  cylinder('Sail mast',(0,0,.5),.025,.9,'wood',boat);sail=control('Unfurling sail',(0,0,.6),boat)
  box('Fabric sail',(.18,0,0),(.38,.025,.6),'paper',.02,sail);MOVERS.extend([('sail',sail),('boat',boat)])
  g=reveal('Far dock',3,(1,0,.57));box('Landing',(0,0,0),(.35,.85,.13),'wood',.035,g)
 elif m=='fountain':
  g=reveal('Water basin',1);cylinder('Basin bowl',(0,0,.5),.9,.22,'wood',g)
  cylinder('Basin water',(0,0,.63),.78,.025,'blue',g)
  g=reveal('Water pipes',2);cylinder('Fountain stem',(0,0,.9),.09,.6,c,g)
  for n in range(3):
   a=n*math.tau/3;jet=reveal('Water jet '+str(n),3)
   pts=[(0,0,1.2),(.3*math.cos(a),.3*math.sin(a),1.55),(.65*math.cos(a),.65*math.sin(a),.66)]
   curve('Arcing water',pts,.025,'blue',jet);MOVERS.append(('jet'+str(n),jet))
   drop=control('Traveling water drop '+str(n));sphere('Water bead',(0,0,0),(.05,.05,.065),'blue',drop);MOVERS.append(('drop'+str(n),drop))
 elif m=='beacon':
  g=reveal('Beacon base',1);cylinder('Beacon pedestal',(0,0,.6),.5,.55,'wood',g)
  light=reveal('Turning reflector',2,(0,0,1.25));box('Lamp housing',(0,0,0),(.65,.4,.5),c,.09,light)
  cylinder('Reflector',(0,-.24,0),.23,.05,'gold',light,(math.pi/2,0,0));MOVERS.append(('reflector',light))
  g=reveal('Beacon rays',3,(0,-.28,1.25))
  for n in range(3):
   o=box('Light ray',((n-1)*.18,-.35,0),(.035,.6,.035),'gold',.012,g);o.rotation_euler[2]=(n-1)*.2
  MOVERS.append(('rays',g))

def pose(stage,t=0,reaction=False):
 u=t*t*(3-2*t);i=SPEC['worldIndex'];m=SPEC['mechanism'];strength=.14+i*.008
 for o,required in REVEALS:
  scale=1 if stage>required or stage==required and not reaction else .02+.98*u if stage==required else .00001
  o.scale=(scale,scale,scale)
 # Every ending has a physical consequence, with distinct mechanics and trajectories.
 for kind,o in MOVERS:
  o.location=BASES[o.name][0];o.rotation_euler=BASES[o.name][1]
  if stage==3:
   if kind=='bridge':o.rotation_euler[1]=-.6*(1-u);o.location.z=.56+.05*math.sin(math.pi*u)
   elif kind=='cover':o.rotation_euler[1]=-(1.6+.015*i)*u
   elif kind.startswith('page'):o.rotation_euler[1]=-(1.3+.03*int(kind[-1]))*max(0,min(1,(u-int(kind[-1])*.09)*1.5))
   elif kind=='shuttle':o.location.x=-.7+1.4*u;o.location.z=1+.04*math.sin(t*math.tau*2)
   elif kind=='cloth':o.scale.z=.12+.88*u
   elif kind.startswith('gear'):o.rotation_euler[1]=(1 if int(kind[-1])%2==0 else -1)*(math.tau+strength)*u
   elif kind in ['balloon','basket','load']:o.location.z={'balloon':.6,'basket':.5,'load':.66}[kind]+(.5+i*.006)*u;o.location.x=strength*math.sin(math.pi*u)
   elif kind.startswith('cargo'):o.location.x=-.8+int(kind[-1])*.3+(1.1+i*.012)*u;o.location.y=-.35+.5*u
   elif kind=='gate':o.rotation_euler[2]=(.5+i*.01)*u
   elif kind=='boat':o.location.x=-.65+(1.4+i*.01)*u;o.rotation_euler[2]=.06*math.sin(math.pi*u)
   elif kind=='sail':o.rotation_euler[2]=-.4*(1-u)
   elif kind.startswith('drop'):
    a=int(kind[-1])*math.tau/3;v=(t*1.8+int(kind[-1])*.23)%1
    o.location=(.65*v*math.cos(a),.65*v*math.sin(a),1.2+.9*v-1.44*v*v);o.scale=(math.sin(math.pi*t),)*3
   elif kind=='reflector':o.rotation_euler[2]=(-.7+i*.02)*(1-u)
   elif kind=='rays':o.rotation_euler[2]=(-.7+i*.02)*(1-u)
  elif kind.startswith('drop'):o.scale=(.00001,)*3
  elif kind=='cover':o.rotation_euler[1]=0
  elif kind=='shuttle':o.location.x=-.7+(.4*u if stage==2 else 0)
  elif kind.startswith('gear') and stage==2:o.rotation_euler[1]=(1 if int(kind[-1])%2==0 else -1)*u*.3
 BOSS.location=(1.55,-.75,.2)
 BOSS.rotation_euler=(0,0,-.2)
 PARTS['head'].rotation_euler=(0,0,(-.25+strength*math.sin(math.pi*t)) if reaction else -.25)
 for sign in [-1,1]:PARTS['paw'+str(sign)].rotation_euler=(.3*math.sin(math.pi*t)*(1 if sign==1 else -.5) if reaction else 0,0,sign*.15)
 for sign in [-1,1]:PARTS['foot'+str(sign)].rotation_euler=(sign*.35*math.sin(t*math.tau*3)*math.sin(math.pi*t) if reaction else 0,0,0)
 if 'tail' in PARTS:PARTS['tail'].rotation_euler[2]=strength*math.sin(t*math.tau) if reaction else 0
 if stage==3:
  if m=='bridge':BOSS.location=(1.55-2.1*u,-.75+.7*u,.2+.4*min(1,u*4));BOSS.rotation_euler[2]=-math.pi/2*math.sin(math.pi*u)
  elif m=='sorter':BOSS.location.x=1.55-.35*u
  elif m=='boat':BOSS.location.x=1.55-.25*u;PARTS['paw1'].rotation_euler[0]=-.5*math.sin(math.pi*t)
  elif m=='balloon':PARTS['head'].rotation_euler[0]=-.25*u
  elif m=='book':PARTS['paw1'].rotation_euler[0]=-.55*u
  elif m=='clock':PARTS['head'].rotation_euler[2]=-.25+strength*math.sin(t*math.tau)
  elif m=='beacon':PARTS['head'].rotation_euler[2]=-.25+.5*u
 CAT.pose(stage,t,reaction)
 bpy.context.view_layer.update()

def build(s):
 global CONTROLS,REVEALS,MOVERS,BASES,SPEC,CAT,BOSS,PARTS
 CONTROLS=[];REVEALS=[];MOVERS=[];SPEC=s
 scene=setup(512);scope['MATS'].clear();bpy.data.orphans_purge(do_recursive=True);scene.timeline_markers.clear()
 scene.render.resolution_x=512;scene.render.resolution_y=320;scene.render.fps=8;scene.render.image_settings.compression=15
 if hasattr(scene,'eevee'):scene.eevee.taa_render_samples=16
 scene.camera.location=(5.8,-10.5,7);aim(scene.camera,(0,0,1.05));scene.camera.data.ortho_scale=7.8
 backdrop(s);character(s);mechanism(s)
 BASES={o.name:(o.location.copy(),o.rotation_euler.copy()) for _,o in MOVERS}
 i=s['worldIndex'];BLOCKING[s['id']]=([(-1.5,-.8,.15),(-1.4,-.85,.15),(-1.25,-.85,.15),(-1.3,-.85,.15)],[22,32,38,24+i],s['tool'],s['ending'])
 CAT=StoryCat(scene,s['id'],scope)
 return scene

def run(s):
 start=time.monotonic();folder=OUT/s['id'];folder.mkdir(parents=True,exist_ok=True);scene=build(s)
 timeline=[(1,0,0,False),(2,1,0,True),*[(3+i,1,i/7,True) for i in range(8)],(11,2,0,True),*[(12+i,2,i/7,True) for i in range(8)],(20,3,0,True),*[(21+i,3,i/15,True) for i in range(16)]]
 for frame,stage,t,reaction in timeline:
  pose(stage,t,reaction)
  for o in CONTROLS:
   for prop in ['location','rotation_euler','scale']:o.keyframe_insert(prop,frame=frame)
  CAT.key(frame)
 scene.frame_start=1;scene.frame_end=36
 for name,frame in [('Meet '+s['name'],1),('First repair',2),('Second repair',11),('Individual ending',20)]:scene.timeline_markers.new(name,frame=frame)
 scene.frame_set(1);scene['lesson_boss_spec']=json.dumps(s);scene['boss_character']=s['name'];scene['mechanism']=s['mechanism']
 SOURCE.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(s['id']+'.blend')),compress=True)
 for o in list(scene.objects):o.animation_data_clear()
 CAT.clear_geometry_keys();fingerprints=[]
 for stage in range(4):
  pose(stage,1 if stage else 0);CAT.record(stage,f'state-{stage}');scene.render.resolution_x=768;scene.render.resolution_y=480
  scene.render.filepath=str(folder/f'state-{stage}.png');bpy.ops.render.render(write_still=True)
 if '--preview' not in ARGS:
  scene.render.resolution_x=512;scene.render.resolution_y=320
  for stage,count in [(1,8),(2,8),(3,16)]:
   for n in range(count):
    pose(stage,n/(count-1),True);prefix='outcome' if stage==3 else f'reaction-{stage}';CAT.record(stage,f'{prefix}-{n:02}')
    transforms=[[o.name,*[round(v,5) for v in o.location],*[round(v,5) for v in o.rotation_euler],*[round(v,5) for v in o.scale]] for o in CONTROLS]
    fingerprints.append(hashlib.sha256(json.dumps(transforms).encode()).hexdigest())
    scene.render.filepath=str(folder/f'{prefix}-{n:02}.png');bpy.ops.render.render(write_still=True)
 CAT.write_metadata(folder)
 (folder/'lesson-staging.json').write_text(json.dumps({'spec':s,'motionFingerprints':fingerprints,'source':str((SOURCE/(s['id']+'.blend')).relative_to(ROOT))},separators=(',',':'))+'\n')
 print('LESSON_BOSS_DONE',s['id'],round(time.monotonic()-start,2),flush=True)

if __name__=='__main__':
 selected=SPECS
 if '--id' in ARGS:selected=[s for s in selected if s['id'] in ARGS[ARGS.index('--id')+1].split(',')]
 if '--shard' in ARGS:
  part,total=map(int,ARGS[ARGS.index('--shard')+1].split('/'));selected=[s for i,s in enumerate(selected) if i%total==part]
 if '--missing' in ARGS:selected=[s for s in selected if not (OUT/s['id']/'lesson-staging.json').exists()]
 assert selected or '--missing' in ARGS
 for s in selected:run(s)
