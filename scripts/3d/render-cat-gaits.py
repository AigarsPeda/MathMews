"""Compare the shipped walk/trot/run skin, or actual actor matrices from --poses."""
from pathlib import Path
import bpy, math, json, struct, sys
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[2]
fluid='--fluid' in sys.argv
OUT=Path('/tmp/brainpet-fluid-review' if fluid else '/tmp/brainpet-gait-review');OUT.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d/native/cat-orange.glb'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for obj in bpy.context.scene.objects:
    if 'Game prop' in obj.name:obj.hide_render=True
    if obj.animation_data:obj.animation_data.action=None
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.resolution_x=scene.render.resolution_y=288;scene.render.resolution_percentage=100
scene.world.color=(.7,.7,.7);scene.view_settings.view_transform='AgX'
for location,energy in [((3,-4,6),350),((-4,-2,3),220),((0,4,5),200)]:
    bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object
    light.data.energy=energy;light.data.size=5
    light.rotation_euler=(Vector((0,0,.8))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-5,2.8));camera=bpy.context.object
camera.data.type='ORTHO';camera.data.ortho_scale=2.8;scene.camera=camera
bpy.ops.mesh.primitive_plane_add(size=60);floor=bpy.context.object
mat=bpy.data.materials.new('Floor');mat.diffuse_color=(.82,.77,.67,1);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.82,.77,.67,1);floor.data.materials.append(mat)
line=bpy.data.materials.new('Grid');line.diffuse_color=(.5,.51,.47,1);line.use_nodes=True;line.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.35,.37,.35,1)
grid=[]
for axis in (0,1):
    for i in range(-36,37):
        bpy.ops.mesh.primitive_cube_add(size=1,location=(i*.25 if axis==0 else 0,i*.25 if axis==1 else 0,.001))
        obj=bpy.context.object;obj.scale=(.003,10,.001) if axis==0 else (10,.003,.001);obj.data.materials.append(line);grid.append(obj)
conversion=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));inverse=conversion.inverted()
raw=(ROOT/'assets/3d/native/cat-orange.glb').read_bytes();model=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
parents={child:i for i,node in enumerate(model['nodes']) for child in node.get('children',[])};binds={}
def bind_world(i):
    if i not in binds:
        n=model['nodes'][i];q=n.get('rotation',[0,0,0,1])
        local=Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])),Quaternion((q[3],*q[:3])),Vector(n.get('scale',[1,1,1])))
        binds[i]=(bind_world(parents[i]) if i in parents else Matrix.Identity(4))@local
    return binds[i]
corrections={}
for i,n in enumerate(model['nodes']):
    if n['name'] in arm.pose.bones and n['name'] not in corrections:
        corrections[n['name']]=bind_world(i).inverted()@inverse@arm.matrix_world@arm.data.bones[n['name']].matrix_local
if '--runtime' in sys.argv or fluid:
    poses=json.loads(Path('/tmp/brainpet-fluid-poses.json' if fluid else '/tmp/brainpet-gait-poses.json').read_text())
    for track in arm.animation_data.nla_tracks:track.mute=True
    arm.animation_data.action=None
    floor.location.z=.068
    for obj in grid:obj.location.z+=.068
    counts={}
    for pose in poses:
        if pose['time']>(3.8 if fluid else 6):continue
        index=counts.get(pose['gait'],0);counts[pose['gait']]=index+1
        if index%2:continue
        desired={name:arm.matrix_world.inverted()@conversion@Matrix([values[j::4] for j in range(4)])@corrections[name] for name,values in pose['nodes'].items() if name in corrections}
        for bone in arm.pose.bones:
            parent_rest=bone.parent.bone.matrix_local if bone.parent else Matrix.Identity(4)
            parent_pose=desired[bone.parent.name] if bone.parent else Matrix.Identity(4)
            bone.matrix_basis=bone.bone.matrix_local.inverted()@parent_rest@parent_pose.inverted()@desired[bone.name]
        root=conversion@Vector(pose['position']);size=pose.get('scale',.8)/.8
        camera.data.ortho_scale=2.8*size;camera.location=root+Vector((4.8,-2.8,2.7))*size
        camera.rotation_euler=(root+Vector((0,0,.75))*size-camera.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.view_layer.update();scene.render.filepath=str(OUT/f"runtime-{pose['gait']}-{index//2:02d}.png")
        bpy.ops.render.render(write_still=True)
else:
    for gait in ('walk','trot','run'):
        for track in arm.animation_data.nla_tracks:track.mute=track.name!=gait
        for index,phase in enumerate((0,.25,.5,.75)):
            frame=1+phase*24;scene.frame_set(int(frame),subframe=frame%1)
            camera.location=(3,-5,2.8);camera.rotation_euler=(Vector((0,0,.8))-camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(OUT/f'raw-{gait}-{index}.png');bpy.ops.render.render(write_still=True)
