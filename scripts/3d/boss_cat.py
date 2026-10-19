"""Stage and bake the shipped cat rig into boss stories. No replacement cat geometry."""
from pathlib import Path
import hashlib, json, math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT/'assets/3d/native/cat-orange.glb'
# Positions are on the diorama floor or an explicitly authored seat/platform.
# The last entry is the start of the ending; moving vehicles carry their actor.
BLOCKING = {
 'train': ([(-1.45,-.72,.12),(-.85,-.72,.12),(1.2,.48,.5),(-1.0,-.33,1.13)], [30,55,30,25], 'ticket', 'correct'),
 'picnic': ([(1.35,-.65,.12),(.55,-.4,.2),(.95,-.55,.2),(.85,-.5,.2)], [25,-25,25,25], 'ribbon', 'excited'),
 'boats': ([(1.45,-.65,.32),(-1.15,-.55,.32),(1.35,-.55,.32),(1.35,-.4,.32)], [25,-25,40,-35], 'flag', 'correct'),
 'music': ([(1.35,-.65,.12),(1.25,-.6,.12),(1.1,-.65,.12),(1.05,-.65,.12)], [25,-35,-35,25], 'key', 'dance'),
 'shelves': ([(1.45,-.65,.12),(1.2,-.6,.12),(1.05,-.65,.12),(1.05,-.65,.12)], [25,-35,30,25], 'toy', 'correct'),
 'kite': ([(-1.25,-.65,.12),(-.75,-.5,.12),(-.7,-.55,.12),(-.7,-.45,.12)], [25,55,50,45], 'spool', 'excited'),
 'tickets': ([(.7,-.65,.12),(.3,-.55,.12),(.25,-.55,.12),(.6,-.65,.12)], [25,-35,25,25], 'ticket', 'correct'),
 'lift': ([(.8,-.72,.12),(.2,-.65,.12),(-1.2,-.06,.875),(-1.2,-.06,.875)], [25,-30,25,25], 'flag', 'correct'),
 'theatre': ([(-1.7,-.6,.12),(-1.7,-.6,.12),(-1.7,-.6,.12),(0,.4,.51)], [30,60,60,25], 'baton', 'dance'),
 'parcels': ([(1.65,-.6,.12),(1.55,-.55,.12),(-.6,-.05,.12),(-.6,-.05,.12)], [25,-30,90,90], 'parcel', 'walk'),
 'fountain': ([(1.4,-.65,.12),(1.25,-.6,.12),(1.25,-.6,.12),(1.25,-.6,.12)], [25,-40,-40,-25], 'trowel', 'surprised'),
 'lanterns': ([(1.25,-.65,.12),(-1.2,-.6,.12),(0,-.6,.12),(.65,-.65,.12)], [25,25,25,70], 'lantern', 'walk'),
 'observatory': ([(-1.25,-.65,.12),(-.7,-.65,.12),(-.7,-.45,.65),(-.7,-.45,.65)], [25,45,90,55], 'chart', 'surprised'),
 'garden': ([(1.45,-.6,.12),(.3,-.6,.12),(.9,.45,.41),(.15,-.6,.12)], [25,-30,30,-35], 'watering', 'excited'),
 'signal': ([(-1.1,-.65,.12),(-.35,-.55,.12),(-.25,-.6,.12),(-.25,-.6,.12)], [25,45,40,40], 'radio', 'correct'),
 'shop': ([(.8,-.65,.12),(.8,-.6,.12),(.75,-.6,.12),(.85,-.6,.12)], [25,-25,25,25], 'toy', 'correct'),
 'shelter': ([(1.45,-.6,.51),(.85,-.45,.51),(.8,-.4,.51),(.2,-.7,.51)], [25,25,25,25], 'trowel', 'sit'),
 'vault': ([(1.4,-.65,.12),(.95,-.65,.12),(.75,-.6,.12),(.8,-.55,.12)], [25,-35,-30,-30], 'key', 'excited'),
}

class StoryCat:
 def __init__(self, scene, scene_id, helpers):
  self.scene, self.id = scene, scene_id
  self.positions, self.yaws, self.tool, self.ending = BLOCKING[scene_id]
  before = set(scene.objects); old_actions = set(bpy.data.actions)
  bpy.ops.import_scene.gltf(filepath=str(MODEL))
  imported = set(scene.objects)-before
  self.arm = next(obj for obj in imported if obj.type == 'ARMATURE')
  self.arm.name = 'Boss story cat rig'
  for obj in imported:
   if 'Game prop' in obj.name:
    bpy.data.objects.remove(obj, do_unlink=True)
   elif obj.animation_data:
    for track in obj.animation_data.nla_tracks: track.mute = True
  actions = {action.name.split('.')[0]: action for action in set(bpy.data.actions)-old_actions}
  # Cache imported bone poses before replacing source actions with this story's
  # editable timeline. Changing a scene frame later cannot replay an old NLA clip.
  self.cache = {}
  for state in {'idle','waiting','correct',self.ending}:
   action = actions[state]; self.arm.animation_data_create(); self.arm.animation_data.action = action
   self.arm.animation_data.action_slot = action.slots[0]
   for sample in range(17):
    frame = action.frame_range[0]+(action.frame_range[1]-action.frame_range[0])*sample/16
    scene.frame_set(math.floor(frame), subframe=frame%1); bpy.context.view_layer.update()
    self.cache[state,sample] = {bone.name: bone.matrix_basis.copy() for bone in self.arm.pose.bones}
  for obj in [self.arm,*self.arm.children]: obj.animation_data_clear()
  for action in actions.values():
   if action.users == 0: bpy.data.actions.remove(action)
  self.anchor = helpers['empty']('Cat story placement')
  self.anchor['character_source'] = 'assets/3d/native/cat-orange.glb'
  self.anchor['character_sha256'] = hashlib.sha256(MODEL.read_bytes()).hexdigest()
  self.arm.parent = self.anchor
  self.hand = helpers['empty']('Cat story tool', parent=self.anchor)
  self.make_tool(helpers)
  self.lead = helpers['curve']('Cat kite string',[(0,0,0),(0,0,.1),(0,0,.2)],.012,'wood') if scene_id=='kite' else None
  self.water = helpers['curve']('Cat watering stream',[(0,0,0),(0,0,.1),(0,0,.2)],.018,'blue') if scene_id=='garden' else None
  if scene_id=='observatory':
   helpers['cylinder']('Cat telescope stool',(-.7,-.45,.4),.29,.5,'wood')
  self.records = []

 def make_tool(self, h):
  box, cylinder, torus, sphere, curve = [h[key] for key in ('box','cylinder','torus','sphere','curve')]
  p = self.hand
  if self.tool in ('ticket','chart'):
   box('Cat clipboard',(0,0,.1),(.5,.06,.5),'wood',.03,p)
   box('Paper plan',(0,-.04,.12),(.42,.02,.38),'paper',.01,p)
   for z in [0,.12,.24]: box('Plan mark',(0,-.06,z),(.28,.02,.02),'teal',.005,p)
  elif self.tool == 'key':
   torus('Cat winding key',(0,0,.1),.14,.035,'gold',p,(math.pi/2,0,0))
   box('Key stem',(.2,0,.1),(.3,.045,.045),'gold',.01,p)
   for x in [.25,.32]: box('Key tooth',(x,0,.05),(.045,.045,.12),'gold',.01,p)
  elif self.tool == 'watering':
   cylinder('Cat watering can',(0,0,.12),.22,.32,'teal',p)
   torus('Can handle',(.23,0,.2),.18,.035,'wood',p,(math.pi/2,0,0))
   curve('Watering spout',[(-.18,0,.2),(-.45,0,.3),(-.5,0,.4)],.045,'teal',p)
  elif self.tool in ('spool','ribbon'):
   cylinder('Cat ribbon spool',(0,0,.12),.2,.24,'coral' if self.tool=='ribbon' else 'wood',p)
   curve('Loose string',[(0,-.2,.1),(.2,-.25,-.04),(.3,-.2,-.12)],.018,'gold',p)
  elif self.tool in ('flag','baton'):
   cylinder('Cat signal baton',(0,0,.18),.025,.65,'wood',p)
   if self.tool=='flag': box('Rescue flag',(.14,0,.42),(.28,.025,.2),'gold',.01,p)
  elif self.tool in ('lantern','radio'):
   box('Cat lamp casing',(0,0,.15),(.32,.2,.42),'wood' if self.tool=='lantern' else 'teal',.035,p)
   box('Cat lamp face',(0,-.12,.15),(.23,.025,.28),'gold',.015,p)
   torus('Carry handle',(0,0,.42),.12,.025,'wood',p,(math.pi/2,0,0))
  elif self.tool=='trowel':
   cylinder('Tool handle',(0,0,.15),.045,.4,'wood',p)
   sphere('Trowel blade',(0,0,-.1),(.12,.04,.17),'silver',p)
  elif self.tool=='parcel':
   box('Cat parcel',(0,0,.12),(.38,.3,.35),'wood',.03,p)
   box('Parcel ribbon',(0,-.01,.12),(.07,.32,.37),'paper',.005,p)
  else:
   sphere('Cat toy mouse',(0,0,.1),(.22,.15,.13),'teal',p)
   curve('Mouse tail',[(.18,0,.1),(.32,0,.13),(.4,.04,.12)],.02,'wood',p)

 def pose(self, completed, t=0, reaction=False):
  state = self.ending if completed==3 else ('waiting' if completed==1 else 'correct') if reaction else 'idle' if completed==0 else 'waiting'
  # Static checkpoints retain the satisfied/working pose; reactions finish in
  # that same pose, rather than snapping back to a neutral face after the clip.
  sample = round(t*16) if reaction or completed==3 else 3 if completed==0 else 8 if completed==1 else 10
  if completed==2 and not reaction: state='correct'
  pose = self.cache[state,max(0,min(16,sample))]
  if reaction or completed==3:
   target=self.cache['sit',16] if completed==3 and self.ending=='sit' else self.cache['waiting',8] if completed==1 else self.cache['correct',10]
   blend=max(0,min(1,(t-.75)/.25));blend=blend*blend*(3-2*blend)
   pose={name:matrix.lerp(target[name],blend) for name,matrix in pose.items()}
  for bone in self.arm.pose.bones: bone.matrix_basis = pose[bone.name]
  scale = .4 if self.id in ('train','lift') and completed>=2 else .52
  self.anchor.scale = (scale,scale,scale)
  position = Vector(self.positions[completed]); u=t*t*(3-2*t) if completed==3 else 0
  if completed==3 and self.id=='train': position.x += 1.4*u
  if completed==3 and self.id=='lift': position += Vector((2.2,0,1.35))*u
  if completed==3 and self.id=='parcels': position.x += .35*u
  if completed==3 and self.id=='lanterns': position += Vector((.45,-.1,0))*u
  self.anchor.location = position
  self.anchor.rotation_euler = (0,0,math.radians(self.yaws[completed]))
  if completed==3 and self.id in ('music','theatre'):
   self.anchor.rotation_euler.z += .12*math.sin(t*math.tau*2)*math.sin(t*math.pi)
  # Turn toward the player to acknowledge a solved task, then back to the job.
  if reaction and completed<3:
   self.anchor.rotation_euler.z += .18*math.sin(math.pi*t)
  bpy.context.view_layer.update()
  self.hand.location = self.arm.pose.bones['R.front.paw'].matrix.translation+Vector((.15,-.08,.22))
  self.hand.rotation_euler = (0, -.12*math.sin(t*math.tau) if completed==3 and self.tool=='watering' else 0, 0)
  bpy.context.view_layer.update()
  if self.lead:
   start=self.hand.matrix_world.translation
   end=self.scene.objects['Kite frame'].matrix_world@Vector((0,-.8,0))
   for point,value in zip(self.lead.data.splines[0].bezier_points,(start,start.lerp(end,.5)-Vector((0,0,.12)),end)): point.co=value
  if self.water:
   self.water.scale=(1,1,1) if completed==3 else (.00001,.00001,.00001)
   start=self.hand.matrix_world@Vector((-.5,0,.4));end=Vector((-.48,-.7,.44))
   for point,value in zip(self.water.data.splines[0].bezier_points,(start,start.lerp(end,.5)+Vector((0,0,.08)),end)): point.co=value
  bpy.context.view_layer.update()

 def clear_geometry_keys(self):
  for item in (self.lead,self.water):
   if item: item.data.animation_data_clear()

 def key(self, frame):
  for obj in (self.anchor,self.hand):
   for prop in ('location','rotation_euler','scale'): obj.keyframe_insert(prop,frame=frame)
  for bone in self.arm.pose.bones:
   for prop in ('location','rotation_quaternion','scale'): bone.keyframe_insert(prop,frame=frame)
  for item in (self.lead,self.water):
   if item:
    item.keyframe_insert('scale',frame=frame)
    for i,point in enumerate(item.data.splines[0].bezier_points):
     item.data.keyframe_insert(data_path=f'splines[0].bezier_points[{i}].co',frame=frame)

 def record(self, completed, label):
  # Numeric evidence comes from projected, evaluated cat mesh vertices, not a
  # hand-authored claim that an actor happens to be on screen.
  from bpy_extras.object_utils import world_to_camera_view
  graph=bpy.context.evaluated_depsgraph_get()
  body=max((obj for obj in self.arm.children if obj.type=='MESH'),key=lambda obj:len(obj.data.vertices))
  evaluated=body.evaluated_get(graph)
  pixels=[world_to_camera_view(self.scene,self.scene.camera,evaluated.matrix_world@Vector(v)) for v in evaluated.bound_box]
  direction=self.scene.camera.rotation_euler.to_matrix()@Vector((0,0,-1))
  head=self.arm.pose.bones['head'].matrix.translation
  visible=0
  for dx in [-.15,0,.15]:
   target=self.arm.matrix_world@(head+Vector((dx,-.12,.12)))
   hit,_,_,_,obj,_=self.scene.ray_cast(graph,target-direction*20,direction,distance=20.5)
   if hit and obj.original in self.arm.children:visible+=1
  self.records.append({'visibleHeadRays':visible,'pose':label,'completed':completed,'position':list(self.anchor.location),
   'bounds':[min(v.x for v in pixels),min(v.y for v in pixels),max(v.x for v in pixels),max(v.y for v in pixels)],
   'bonePoseSha256':hashlib.sha256(str([round(value,5) for bone in self.arm.pose.bones for row in bone.matrix_basis for value in row]).encode()).hexdigest()})

 def write_metadata(self, folder):
  data={'model':'assets/3d/native/cat-orange.glb','modelSha256':self.anchor['character_sha256'],
   'rigBones':len(self.arm.pose.bones),'tool':self.tool,'ending':self.ending,'poses':self.records}
  (folder/'cat-staging.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
