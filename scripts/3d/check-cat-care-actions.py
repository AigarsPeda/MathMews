"""Check box story joins, petting recovery and the food spill trajectories."""
from pathlib import Path
import math
import sys
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

renderer = Path(__file__).with_name('render_assets.py')
scope = {'__file__': str(renderer), '__name__': '__care_qa__'}
exec(compile(renderer.read_text(), str(renderer), 'exec'), scope)

def transforms(rig, state, t):
    scope['cat_pose'](rig, state, t)
    bpy.context.view_layer.update()
    result = {obj.name: tuple(value for row in obj.matrix_basis for value in row)
              for obj in scope['animated_parts'](rig)}
    result['tail curve'] = tuple(value for point in rig['tail_curve'].data.splines[0].bezier_points for vector in (point.co, point.handle_left, point.handle_right) for value in vector)
    return result

def same_pose(left, right, label):
    assert left.keys() == right.keys(), label
    for name in left:
        assert max(abs(a-b) for a, b in zip(left[name], right[name])) < 1e-6, (label, name)

for skin in ('orange', 'grey', 'white'):
    scope['setup'](64)
    rig = scope['cat'](skin, boxed=True)
    for first, second in (('box1', 'box2'), ('box2', 'box3')):
        same_pose(transforms(rig, first, 1), transforms(rig, second, 0), f'{skin}: {first} → {second}')
    same_pose(transforms(rig, 'box1', 0), transforms(rig, 'box3', 1), f'{skin}: return to seated pose')
    same_pose(transforms(rig, 'box3', 1), transforms(rig, 'idle', 0), f'{skin}: box ends on idle')
    scope['setup'](64)
    rig = scope['cat'](skin)
    same_pose(transforms(rig, 'excited', 0), transforms(rig, 'excited', 1), f'{skin}: petting recovery')
    for t in (0, 1):
        same_pose(transforms(rig, 'eating', t), transforms(rig, 'idle', 0), f'{skin}: eating endpoint {t}')
    twists = []
    for frame in range(60):
        scope['cat_pose'](rig, 'excited', frame/59)
        twists.append(rig['root'].rotation_euler.z)
    assert min(twists) < -.20 and max(twists) > .20, 'Petting must wriggle in both directions'

for state, endpoints in (('eating', (0, 1)), ('box1', (0,)), ('box3', (1,))):
    scene = scope['setup'](64)
    scope['configure_cat_camera'](scene)
    slide, food = scope['care_props'](state)
    for t in endpoints:
        scope['pose_care_props'](slide, food, state, t)
        bpy.context.view_layer.update()
        for obj in slide.children:
            for corner in obj.bound_box:
                screen = world_to_camera_view(scene, scene.camera, obj.matrix_world @ Vector(corner))
                assert screen.x < 0, (state, t, obj.name, 'prop still visible at endpoint')

scope['setup'](64)
scope['bowl']()
pieces = scope['eating_food']()
for frame in range(72):
    t = frame/71
    scope['pose_eating_food'](pieces, t)
    for i, piece in enumerate(pieces):
        born = .18+i*.065
        if t <= born:
            assert piece.scale.length == 0, 'Food must not appear before its munch beat'
        if t >= born+.18:
            distance = math.hypot(piece.location.x, piece.location.y+.85)
            assert distance > .40, 'Spills must land outside the bowl'
            assert piece.location.z-piece.scale.z >= 0, 'Spills must stay above the floor'
        distance = math.hypot(piece.location.x, piece.location.y+.85)
        if .27 < distance < .40:
            assert piece.location.z-piece.scale.z > .225, 'Flying food must clear the bowl rim'
print('Verified matching box story joins for all coats, petting recovery and eight food spills across all 72 eating frames.')

if '--baked' in sys.argv:
    def saved_pose(state, frame):
        bpy.ops.wm.open_mainfile(filepath=str(scope['BLENDER_OUT']/(state+'.blend')))
        bpy.context.scene.frame_set(frame)
        result = {obj.name: tuple(value for row in obj.matrix_basis for value in row)
                  for obj in bpy.context.scene.objects if obj.animation_data}
        result['tail curve'] = tuple(value for point in bpy.context.scene.objects['Plump orange tail'].data.splines[0].bezier_points for vector in (point.co, point.handle_left, point.handle_right) for value in vector)
        return result
    for first, second in (('box1', 'box2'), ('box2', 'box3')):
        same_pose(saved_pose(first, scope['CAT_CLIPS'][first][0]), saved_pose(second, 1), f'saved: {first} → {second}')
    same_pose(saved_pose('excited', 1), saved_pose('excited', 60), 'saved: petting recovery')
    bpy.ops.wm.open_mainfile(filepath=str(scope['BLENDER_OUT']/'eating.blend'))
    pieces = [bpy.context.scene.objects[f'Spilled kibble {i+1}'] for i in range(8)]
    slide = bpy.context.scene.objects['Care prop slide']
    count = scope['CAT_CLIPS']['eating'][0]
    for frame in range(count):
        bpy.context.scene.frame_set(frame+1)
        baked = {obj.name: tuple(obj.location)+tuple(obj.rotation_euler)+tuple(obj.scale) for obj in pieces}
        slide_location = slide.location.copy()
        scope['pose_care_props'](slide, pieces, 'eating', frame/(count-1))
        assert (slide.location-slide_location).length < 1e-5, ('saved bowl slide', frame)
        for obj in pieces:
            expected = tuple(obj.location)+tuple(obj.rotation_euler)+tuple(obj.scale)
            assert max(abs(a-b) for a, b in zip(baked[obj.name], expected)) < 1e-5, ('saved food', frame, obj.name)
    print('Verified saved box joins, petting recovery and all keyed food poses.')
