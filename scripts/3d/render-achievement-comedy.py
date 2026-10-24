"""Reward-only visual comedy. Puzzle checkpoints and their mechanics stay independent."""
from pathlib import Path
import sys, math, json, time
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/3d'))
import importlib.util
spec=importlib.util.spec_from_file_location('lesson_bosses',ROOT/'scripts/3d/build-lesson-bosses.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT=Path('/tmp/brainpet-achievement-comedy')

def smooth(a,b,t):
 u=max(0,min(1,(t-a)/(b-a)));return u*u*(3-2*u)

def make_gag(s):
 scene=base.build(s)
 # Finale rewards use the trophy, not the original mission's kite/watering tools.
 if s['mechanism']=='trophy':
  for name in ('lead','water'):
   obj=getattr(base.CAT,name)
   if obj is not None:bpy.data.objects.remove(obj,do_unlink=True);setattr(base.CAT,name,None)
 scene.render.resolution_x=512;scene.render.resolution_y=448
 scene.camera.location=(4,-9,5.8);base.aim(scene.camera,(0,0,1.25));scene.camera.data.ortho_scale=6.1
 if hasattr(scene,'eevee'):scene.eevee.taa_render_samples=8
 # An oversized prop gives the surprise a readable silhouette at phone size.
 prop=base.control('Comedy payoff')
 m=s['mechanism']
 if m=='book':
  base.sphere('Pop-up fish',(0,0,0),(.7,.16,.35),'gold',prop)
  base.sphere('Fish eye',(-.35,-.14,.12),(.07,.045,.07),'ink',prop)
  tail=base.box('Fish tail',(.7,0,0),(.45,.1,.45),'coral',.03,prop);tail.rotation_euler[1]=math.pi/4
 elif m=='loom':
  for n in range(9):base.torus('Endless scarf coil',(0,0,n*.11),.36,.085,['coral','gold'][n%2],prop)
  base.box('Scarf trailing end',(.4,-.05,.2),(.18,.12,.65),'coral',.025,prop)
 elif m=='trophy':
  base.cylinder('Trophy foot',(0,0,0),.32,.12,'gold',prop)
  base.cylinder('Trophy stem',(0,0,.3),.08,.5,'gold',prop)
  base.sphere('Trophy cup',(0,0,.65),(.4,.32,.35),'gold',prop)
  for x in [-.38,.38]:base.torus('Trophy handle',(x,0,.65),.2,.045,'gold',prop,(math.pi/2,0,0))
 elif m=='sorter':
  for n in range(5):base.cargo((0,0,n*.34),prop,['gold','coral','teal'][n%3])
 elif m=='boat':
  base.sphere('Giant rubber duck',(0,0,.2),(.48,.35,.35),'gold',prop)
  base.sphere('Duck head',(-.25,0,.65),(.27,.25,.28),'gold',prop)
  base.sphere('Duck bill',(-.49,-.05,.6),(.22,.16,.08),'coral',prop)
  base.sphere('Duck eye',(-.31,-.24,.72),(.045,.025,.045),'ink',prop)
 # Capture every transform so posing never depends on render order.
 hat=scene.objects['Profession cap'];hat_base=hat.location.copy()
 gasp=base.sphere('Surprised mouth',(0,-.31,-.15),(.07,.025,.09),'ink',base.PARTS['head'])

 tether=base.curve('Hat balloon string',[(0,0,0),(0,0,.1),(0,0,.2)],.015,'wood') if m=='balloon' else None
 def pose(t):
  base.pose(3,1,False)
  boss=base.BOSS;head=base.PARTS['head'];cat=base.CAT.anchor
  boss.location=(1.35,-.65,.2);boss.rotation_euler=(0,0,-.3);boss.scale=(1,1,1)
  head.rotation_euler=(0,0,-.25);hat.location=hat_base;hat.rotation_euler=(0,0,0)
  prop.scale=(.00001,)*3;prop.location=(0,0,0);prop.rotation_euler=(0,0,0)
  cat.location=(-1.65,-.85,.15);cat.rotation_euler.z=.15;cat.scale=(.62,)*3
  base.CAT.hand.scale=(.00001,)*3
  gasp.scale=(.001,)*3
  anticipation=smooth(.12,.28,t);action=smooth(.30,.68,t);settle=smooth(.70,.90,t)
  # Read, anticipate, surprise, react. No punchline competes with another.
  if m=='bridge':
   jump=smooth(.32,.67,t)
   boss.location=(1.35-2.5*jump,-.4,.2+1.65*math.sin(math.pi*jump))
   boss.scale=(1+.12*anticipation*(1-action),1+.12*anticipation*(1-action),1-.24*anticipation*(1-action))
   head.rotation_euler[2]=-.25+.6*settle
   cat.rotation_euler.z=.15-.7*settle
   hat.location.z+=.35*math.sin(math.pi*jump)
  elif m=='trophy':
   prop.location=(.65,-.6,.35);prop.scale=(.35+1.65*action,)*3
   boss.location.x=1.35+.2*action
   head.rotation_euler[0]=-.55*action
   base.PARTS['paw-1'].rotation_euler[0]=-1.7*action
   cat.rotation_euler.z=.15-.4*settle
  elif m=='balloon':
   # The passenger is ready. The balloon chooses the hat instead.
   for kind,o in base.MOVERS:
    if kind in ('balloon','basket','load'):o.location.z=base.BASES[o.name][0].z+.75*action
   hat.location=(hat_base.x-.8*action,hat_base.y,hat_base.z+1.25*action)
   boss.location.z=.2+.22*math.sin(math.pi*action)
   base.PARTS['paw-1'].rotation_euler[0]=-1.9*action
   head.rotation_euler[0]=-.6*action
  elif m=='book':
   for kind,o in base.MOVERS:
    if kind=='cover' or kind.startswith('page'):o.rotation_euler[1]=-1.6*action
   prop.scale=(action,)*3;prop.location=(0,-.1,.8+1.2*action)
   prop.rotation_euler[1]=-.2+.4*action
   boss.rotation_euler[1]=-.28*math.sin(math.pi*action)
   head.rotation_euler[0]=-.5*action
   hat.location.z+=.25*math.sin(math.pi*action)
  elif m=='loom':
   prop.location=(1.35,-.65,.3);prop.scale=(action,action,action)
   boss.rotation_euler[2]=-.3+math.tau*action
   base.PARTS['paw1'].rotation_euler[0]=-1.2*settle
   head.rotation_euler[2]=-.25+.65*settle
  elif m=='clock':
   # The single meme beat: frantic gears, then a silent look straight at camera.
   for kind,o in base.MOVERS:
    if kind.startswith('gear'):o.rotation_euler[1]=math.tau*5*action*(1 if kind[-1]=='0' else -1)
   hat.location.z+=.45*math.sin(math.pi*action)
   head.rotation_euler[2]=-.25+1.0*settle
   boss.rotation_euler[2]=-.3+.25*settle
   scene.camera.data.ortho_scale=6.1-1.7*settle
   base.aim(scene.camera,Vector((0,0,1.25)).lerp(Vector((.85,-.4,1)),settle))
  elif m=='sorter':
   prop.location=(1.15,-.65,.45);prop.scale=(1,1,action)
   prop.rotation_euler[1]=.14*math.sin(t*math.tau*3)*action
   base.PARTS['paw-1'].rotation_euler[0]=-1.5*action
   head.rotation_euler[0]=-.55*action
   hat.location.z+=.16*math.sin(math.pi*action)
  elif m=='boat':
   prop.location=(-.5+1.4*action,-.05,.62);prop.scale=(action*1.35,)*3
   prop.rotation_euler[2]=.1*math.sin(t*math.tau*2)
   boss.location.x=1.35+.3*action;head.rotation_euler[0]=-.3*action
   base.PARTS['paw1'].rotation_euler[0]=-1.1*settle
  elif m=='fountain':
   hat.location=(hat_base.x-1.35*action,hat_base.y+.65*action,hat_base.z+.65*action)
   hat.rotation_euler[1]=.18*math.sin(t*math.tau*3)*action
   for kind,o in base.MOVERS:
    if kind.startswith('jet'):o.scale=(1,1,1+.65*action)
   head.rotation_euler[0]=-.5*action
   base.PARTS['paw-1'].rotation_euler[0]=-1.8*action
  elif m=='beacon':
   boss.rotation_euler[2]=-.3+math.tau*action
   boss.location.z=.2+.28*abs(math.sin(action*math.pi*3))*(1-settle)
   for sign in [-1,1]:base.PARTS['paw'+str(sign)].rotation_euler[0]=-1.3*math.sin(action*math.pi*3)
   head.rotation_euler[2]=-.25+.8*settle
  if m in ('book','balloon','sorter','boat','fountain','trophy'):
   gasp.scale=(.07*action,.025*action,.09*action)
  bpy.context.view_layer.update()
  if tether:
   start=Vector((0,0,1.4+.75*action));end=hat.matrix_world.translation
   for point,value in zip(tether.data.splines[0].bezier_points,(start,start.lerp(end,.5)-Vector((0,0,.12)),end)):point.co=value
  if m=='fountain':
   start=boss.matrix_world@hat_base
   hat.matrix_world.translation=start.lerp(Vector((0,0,2.45)),action)
  bpy.context.view_layer.update()
 return scene,pose

# Each of the 18 worlds keeps its own setting, cast, colors and props.
finales=[]
for world in dict.fromkeys(s['world'] for s in base.SPECS):
 s=next(s.copy() for s in base.SPECS if s['world']==world)
 s.update(id=world,mechanism='trophy',ending='excited');finales.append(s)
selected=[*base.SPECS,*finales]
if '--shard' in ARGS:
 part,total=map(int,ARGS[ARGS.index('--shard')+1].split('/'));selected=[s for i,s in enumerate(selected) if i%total==part]
if '--missing' in ARGS:selected=[s for s in selected if not all((OUT/s['id']/f'frame-{n:02}.png').exists() for n in range(24))]
if '--id' in ARGS:selected=[s for s in selected if s['id'] in ARGS[ARGS.index('--id')+1].split(',')]
for s in selected:
 start=time.monotonic();folder=OUT/s['id'];folder.mkdir(parents=True,exist_ok=True)
 scene,pose=make_gag(s)
 frames=[0,9,17,23] if '--preview' in ARGS else range(24)
 for n in frames:
  pose(n/23);scene.render.filepath=str(folder/f'frame-{n:02}.png');bpy.ops.render.render(write_still=True)
 print('COMEDY_DONE',s['id'],round(time.monotonic()-start,2),flush=True)
