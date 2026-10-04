"""Check play recovery, toy entrances, floor clearance and saved motion controls."""
import bpy
from pathlib import Path
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

renderer = Path(__file__).with_name('render_assets.py')
scope = {'__file__': str(renderer), '__name__': '__play_qa__'}
exec(compile(renderer.read_text(), str(renderer), 'exec'), scope)
expected = {}

def snapshot(objects):
    bpy.context.view_layer.update()
    return {obj.name: tuple(v for row in obj.matrix_basis for v in row) for obj in objects}

def same_pose(left, right, label):
    assert left.keys() == right.keys(), label
    for name in left:
        assert max(abs(a-b) for a,b in zip(left[name],right[name])) < 1e-5, (label,name)

for skin in ('orange','grey','white'):
    for state in scope['PLAY_CLIPS']:
        scene = scope['setup'](64)
        rig = scope['cat'](skin)
        scope['configure_cat_camera'](scene)
        toy = scope['play_props'](state)
        parts = scope['animated_parts'](rig)
        scope['cat_pose'](rig,'idle',0)
        idle = snapshot(parts)
        count,fps = scope['CAT_CLIPS'][state]
        for i in range(count):
            t = i/(count-1)
            scope['cat_pose'](rig,state,t)
            scope['pose_play_props'](toy,state,t)
            pose = snapshot(parts)
            if i in (0,count-1):
                same_pose(idle,pose,f'{skin}/{state} idle endpoint {i}')
                for obj in toy.children:
                    for corner in obj.bound_box:
                        screen = world_to_camera_view(scene,scene.camera,obj.matrix_world@Vector(corner))
                        assert screen.x < 0, (state,t,obj.name,'toy still visible at endpoint')
            # Actual toy vertices must clear the floor, even during a bounce.
            deps = bpy.context.evaluated_depsgraph_get()
            for obj in toy.children:
                evaluated = obj.evaluated_get(deps)
                mesh = evaluated.to_mesh()
                assert min((evaluated.matrix_world@v.co).z for v in mesh.vertices) > -.005, (skin,state,i,obj.name,'toy passes through floor')
                evaluated.to_mesh_clear()
            if skin == 'orange':
                expected[(state,i+1)] = snapshot(parts+[toy])

for state in scope['PLAY_CLIPS']:
    bpy.ops.wm.open_mainfile(filepath=str(scope['BLENDER_OUT']/(state+'.blend')))
    scene = bpy.context.scene
    for frame in range(scene.frame_start,scene.frame_end+1):
        scene.frame_set(frame)
        actual = snapshot([scene.objects[name] for name in expected[(state,frame)]])
        same_pose(expected[(state,frame)],actual,f'saved {state} frame {frame}')
print('Verified 1,008 play poses, idle recovery, off-screen toys, floor clearance and all 336 saved orange frames.')
