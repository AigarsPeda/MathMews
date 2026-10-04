"""Compare saved joint curves and torso morphs to every procedural orange pose."""
from pathlib import Path
import bpy

renderer = Path(__file__).with_name('render_assets.py')
scope = {'__file__': str(renderer), '__name__': '__feline_bake_qa__'}
exec(compile(renderer.read_text(), str(renderer), 'exec'), scope)

def geometry(objects):
    bpy.context.view_layer.update()
    values = []
    for obj in objects:
        for point in obj.data.splines[0].bezier_points:
            values.extend((*point.co, *point.handle_left, *point.handle_right, point.radius))
    return values

checked = 0
for state, (count, fps) in scope['CAT_CLIPS'].items():
    scope['setup'](64)
    rig = scope['cat']('orange', boxed=state.startswith('box'))
    expected = []
    for index in range(count):
        one_shot = state in ['jumpOn','jumpOff','curlUp','sleepy','lieDown','eating','correct','incorrect','excited','dance','surprised','restSleep','box1','box2','box3',*scope['PLAY_CLIPS']]
        scope['cat_pose'](rig, state, index/(count-1) if one_shot else index/count)
        expected.append((geometry(rig['legs']+rig['back_legs']), rig['torso'].data.shape_keys.key_blocks['Standing feline waist'].value))
    bpy.ops.wm.open_mainfile(filepath=str(scope['BLENDER_OUT']/(state+'.blend')))
    limbs = [bpy.context.scene.objects[f'{name} {side}'] for name in ('Short front leg','Short back leg') for side in (-1,1)]
    torso = bpy.context.scene.objects['Cream pear body']
    for index, (joints, waist) in enumerate(expected):
        bpy.context.scene.frame_set(index+1)
        actual = geometry(limbs)
        assert max(abs(a-b) for a,b in zip(joints,actual)) < 1e-5, (state,index,'baked joint curve differs from rendered anatomy')
        assert abs(torso.data.shape_keys.key_blocks['Standing feline waist'].value-waist) < 1e-5, (state,index,'unbaked torso morph')
        checked += 1
print(f'Verified continuous elbows, wrists, knees, hocks and torso morphs in all {checked} saved orange frames across 35 clips.')
