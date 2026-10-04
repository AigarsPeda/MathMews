"""Verify grounded strides, connected limbs, and the curl/sleep pose join."""
from pathlib import Path
from mathutils import Vector
renderer = Path(__file__).with_name('render_assets.py')
scope = {'__file__': str(renderer), '__name__': '__room_cat_qa__'}
exec(compile(renderer.read_text(), str(renderer), 'exec'), scope)
for skin in ('orange', 'grey', 'white'):
    scope['setup'](64)
    rig = scope['cat'](skin)
    for frame in range(24):
        scope['cat_pose'](rig, 'walk', frame / 24)
        feet = rig['feet'] + rig['back_feet']
        assert min(paw.location.z for paw in feet) <= .141, 'A stride must retain contact with the floor'
        assert abs(rig['root'].location.z) < .001, 'Walking must never become a hop'
        for side, front, front_leg, back, back_leg in zip((-1, 1), rig['feet'], rig['legs'], rig['back_feet'], rig['back_legs']):
            for limb, paw, anchor in ((front_leg, front, (side*.23, -.18, 0)), (back_leg, back, (side*.32, .12, -.16))):
                shoulder = rig['body'].matrix_basis @ Vector(anchor)
                for end in (shoulder, paw.location):
                    assert (limb.matrix_basis.inverted() @ end).length < .999, 'Walking must keep the legs connected'
    scope['cat_pose'](rig, 'curlUp', 1)
    curled = [(obj.location.copy(), obj.scale.copy()) for obj in scope['animated_parts'](rig)]
    tail = [point.co.copy() for point in rig['tail_curve'].data.splines[0].bezier_points]
    scope['cat_pose'](rig, 'curlSleep', 0)
    for obj, (location, scale) in zip(scope['animated_parts'](rig), curled):
        assert (obj.location-location).length < .001 and (obj.scale-scale).length < .001, 'Curling must join the sleeping pose without a jump'
    for point, before in zip(rig['tail_curve'].data.splines[0].bezier_points, tail):
        assert (point.co-before).length < .001
print('Verified grounded four-paw strides, connected walking legs, and matching curl/sleep poses for all three coats.')
