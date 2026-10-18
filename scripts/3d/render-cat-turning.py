"""Render actual native-worklet bone matrices from check-cat-turning.mjs --poses.

Run Blender --background --python scripts/3d/render-cat-turning.py.
Frames are written to /tmp/brainpet-turn-review for contact-sheet or GIF review.
"""
import json
import math
import struct
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('/tmp/brainpet-turn-review')
OUT.mkdir(exist_ok=True)
poses = json.loads(Path('/tmp/brainpet-turn-poses.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d/native/cat-orange.glb'))
arm = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
for obj in list(bpy.context.scene.objects):
    if obj.animation_data:
        for track in obj.animation_data.nla_tracks:
            track.mute = True
        obj.animation_data.action = None
    if 'Game prop' in obj.name:
        obj.hide_render = True
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.world.color = (.65, .65, .65)
scene.view_settings.view_transform = 'AgX'
for location, energy in [((3, -5, 7), 300), ((-4, -2, 4), 180), ((0, 4, 5), 180)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.size = 5
    light.rotation_euler = (Vector((0, 0, .7))-light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(3, -5, 3.0))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .7))-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.0
scene.camera = camera
bpy.ops.mesh.primitive_plane_add(size=200)
floor = bpy.context.object
mat = bpy.data.materials.new('Warm floor')
mat.diffuse_color = (.78, .73, .64, 1)
floor.data.materials.append(mat)
floor.location.z = .07
# Fixed grid makes planted contacts and root drift visible between frames.
line = bpy.data.materials.new('Grid')
line.diffuse_color = (.45, .48, .45, 1)
for axis in (0, 1):
    for i in range(-4, 5):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(i*.25 if axis == 0 else 0, i*.25 if axis == 1 else 0, .071))
        obj = bpy.context.object
        obj.scale = (.004, 2.3, .001) if axis == 0 else (2.3, .004, .001)
        obj.data.materials.append(line)
scene.render.resolution_x = scene.render.resolution_y = 320
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
conversion = Matrix(((1,0,0,0), (0,0,-1,0), (0,1,0,0), (0,0,0,1)))
inverse = conversion.inverted()
arm_inverse = arm.matrix_world.inverted()
raw = (ROOT/'assets/3d/native/cat-orange.glb').read_bytes()
model = json.loads(raw[20:20+struct.unpack_from('<I', raw, 12)[0]])
parents = {child: i for i, node in enumerate(model['nodes']) for child in node.get('children', [])}
binds = {}
def bind_world(i):
    if i in binds:
        return binds[i]
    node = model['nodes'][i]
    from mathutils import Quaternion
    q = node.get('rotation', [0, 0, 0, 1])
    local = Matrix.LocRotScale(Vector(node.get('translation', [0,0,0])), Quaternion((q[3], *q[:3])), Vector(node.get('scale', [1,1,1])))
    binds[i] = (bind_world(parents[i]) if i in parents else Matrix.Identity(4)) @ local
    return binds[i]
corrections = {}
for i, node in enumerate(model['nodes']):
    if node['name'] in arm.pose.bones:
        bone = arm.data.bones[node['name']]
        corrections[bone.name] = bind_world(i).inverted() @ inverse @ arm.matrix_world @ bone.matrix_local
for degrees in (-90, 90, 180):
    frames = [p for p in poses if p['degrees'] == degrees]
    for i, pose in enumerate(frames):
        desired = {}
        for bone in arm.pose.bones:
            values = pose['nodes'].get(bone.name)
            if values:
                native = Matrix([values[j::4] for j in range(4)])
                desired[bone.name] = arm_inverse @ conversion @ native @ corrections[bone.name]
        for bone in arm.pose.bones:
            if bone.name in desired:
                parent_rest = bone.parent.bone.matrix_local if bone.parent else Matrix.Identity(4)
                parent_pose = desired[bone.parent.name] if bone.parent else Matrix.Identity(4)
                bone.matrix_basis = bone.bone.matrix_local.inverted() @ parent_rest @ parent_pose.inverted() @ desired[bone.name]
        bpy.context.view_layer.update()
        scene.render.filepath = str(OUT/f'{degrees}-{i:02d}.png')
        bpy.ops.render.render(write_still=True)
