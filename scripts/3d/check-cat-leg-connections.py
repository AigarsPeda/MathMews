"""Check every procedural leg endpoint. Run with Blender --background --python."""
import json
from pathlib import Path
from mathutils import Vector
renderer = Path(__file__).with_name('render_assets.py')
scope = {'__file__': str(renderer), '__name__': '__cat_qa__'}
exec(compile(renderer.read_text(), str(renderer), 'exec'), scope)
clips = json.loads((renderer.parent/'clips.json').read_text())
for skin in ('orange', 'grey', 'white'):
    scope['setup'](64)
    rig = scope['cat'](skin)
    for state, (count, fps) in clips.items():
        for i in range(count):
            t = i/(count-1) if state in ['jumpOn','jumpOff','curlUp','sleepy','lieDown','eating','correct','incorrect','excited','dance','surprised','restSleep','box1','box2','box3',*scope['PLAY_CLIPS']] else i/count
            scope['cat_pose'](rig,state,t)
            for anchors, leg, foot, back_leg, back_foot in zip(rig['leg_anchors'],rig['legs'],rig['feet'],rig['back_legs'],rig['back_feet']):
                for limb, paw, anchor in ((leg,foot,anchors[0]),(back_leg,back_foot,anchors[1])):
                    shoulder = rig['body'].matrix_basis @ Vector(anchor)
                    points = limb.data.splines[0].bezier_points
                    assert (points[0].co-shoulder).length < 1e-5, (skin,state,i,limb.name,'detached shoulder/hip')
                    assert (points[-1].co-paw.location).length < 1e-5, (skin,state,i,limb.name,'detached paw')
                    assert all(point.radius > 0 for point in points), 'Joint volume must stay positive'
                    assert points[-1].radius < points[0].radius, 'Legs must taper toward the wrist and toe'
                    assert limb in scope['animated_parts'](rig), 'Connector must survive baked animation playback'
print(f'Verified torso/paw overlap and keyed leg controls at every pose in all {len(clips)*3} clips.')
