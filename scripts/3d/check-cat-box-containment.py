"""Check box walls against posed geometry, or the saved clips with --baked."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

renderer = Path(__file__).with_name('render_assets.py')
scope = {'__file__': str(renderer), '__name__': '__box_qa__'}
exec(compile(renderer.read_text(), str(renderer), 'exec'), scope)
clips = json.loads((renderer.parent/'clips.json').read_text())

def world_vertices(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    evaluated.to_mesh_clear()
    return points

def check_scene(label):
    bpy.context.view_layer.update()
    def bounds(obj):
        points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        return [(min(point[axis] for point in points), max(point[axis] for point in points)) for axis in range(3)]
    sides = sorted((bounds(obj) for obj in bpy.context.scene.objects if obj.name.startswith('Box side')), key=lambda box: box[0][0])
    assert len(sides) == 2, 'Missing box side walls'
    front, back, floor = [bounds(bpy.context.scene.objects[name]) for name in ('Box front', 'Box back', 'Box bottom')]
    tail_points = []
    for obj in bpy.context.scene.objects:
        paw = obj.name.startswith(('Front paw ', 'Back paw '))
        leg = obj.name.startswith(('Short front leg ', 'Short back leg '))
        tail = obj.name in ('Plump orange tail', 'Cream tail tip')
        if not (paw or leg or tail):
            continue
        points = world_vertices(obj)
        if tail:
            tail_points.extend(points)
        for point in points:
            # Measure the actual walls, including those in saved Blender scenes.
            assert point.z >= sides[0][2][1] or point.x > sides[0][0][1], (label, obj.name, 'left wall', point[:])
            assert point.z >= sides[1][2][1] or point.x < sides[1][0][0], (label, obj.name, 'right wall', point[:])
            assert point.z >= front[2][1] or point.y > front[1][1], (label, obj.name, 'front wall', point[:])
            assert point.z >= back[2][1] or point.y < back[1][0], (label, obj.name, 'back wall', point[:])
            if paw or tail:
                assert point.z > floor[2][1], (label, obj.name, 'below floor', point[:])
            if paw:
                assert point.z < front[2][1], (label, obj.name, 'paw above front rim', point[:])
    assert tail_points, 'Missing tail geometry'
    rim_height = max(front[2][1], back[2][1], *(side[2][1] for side in sides))
    assert any(point.x > sides[1][0][1] and point.z > rim_height for point in tail_points), (label, 'tail must curl above the rim')

checked = 0
if '--baked' in sys.argv:
    for state in ('box1', 'box2', 'box3'):
        bpy.ops.wm.open_mainfile(filepath=str(scope['BLENDER_OUT']/(state+'.blend')))
        for frame in range(1, clips[state][0]+1):
            bpy.context.scene.frame_set(frame)
            check_scene((state, frame))
            checked += 1
else:
    for skin in ('orange', 'grey', 'white'):
        for state in ('box1', 'box2', 'box3'):
            scope['setup'](64)
            rig = scope['cat'](skin, boxed=True)
            scope['cat_play_box']()
            for frame in range(clips[state][0]):
                scope['cat_pose'](rig, state, frame/clips[state][0])
                check_scene((skin, state, frame))
                for paw in rig['back_feet']:
                    assert paw in scope['animated_parts'](rig), 'Tucked back paws must be baked'
                checked += 1
print(f'Verified {checked} box poses: paws inside and above the floor; tail clears every wall before curling outward.')
