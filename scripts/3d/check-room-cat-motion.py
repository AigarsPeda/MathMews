"""Verify grounded strides, connected limbs, and the curl/sleep pose join."""
from pathlib import Path
from mathutils import Vector
renderer = Path(__file__).with_name('render_assets.py')
scope = {'__file__': str(renderer), '__name__': '__room_cat_qa__'}
exec(compile(renderer.read_text(), str(renderer), 'exec'), scope)
for skin in ('orange', 'grey', 'white'):
    scope['setup'](64)
    rig = scope['cat'](skin)
    for state in ('walk', 'walkAway', 'walkToward', 'walkAwayDiagonal', 'walkTowardDiagonal'):
        for frame in range(24):
            t = frame / 24
            scope['cat_pose'](rig, state, t)
            feet = rig['back_feet'][:1] + rig['feet'][:1] + rig['back_feet'][1:] + rig['feet'][1:]
            assert sum(abs(paw.location.z - paw.scale.z) < .001 for paw in feet) >= 2, 'At least two paws must support the standing cat'
            assert abs(rig['root'].location.z) < .001, 'Walking must never become a hop'
            for paw, offset in zip(feet, (0, .25, .50, .75)):
                gait = (t + offset) % 1
                if gait < .64 - .001:
                    y = paw.location.y
                    scope['cat_pose'](rig, state, t + .0001)
                    # Forward torso travel is half a Blender unit per cycle.
                    assert abs((paw.location.y - y) / .0001 - .5) < .001, 'A planted paw must remain fixed against forward floor travel'
                    scope['cat_pose'](rig, state, t)
            for anchors, front, front_leg, back, back_leg in zip(rig['leg_anchors'], rig['feet'], rig['legs'], rig['back_feet'], rig['back_legs']):
                for limb, paw, anchor in ((front_leg, front, anchors[0]), (back_leg, back, anchors[1])):
                    shoulder = rig['body'].matrix_basis @ Vector(anchor)
                    # Roots must be embedded in the pear torso, not just joined
                    # to a paw by a long diagonal connector.
                    scope['bpy'].context.view_layer.update()
                    torso = rig['torso'].evaluated_get(scope['bpy'].context.evaluated_depsgraph_get())
                    local = torso.matrix_basis.inverted() @ anchor
                    found, surface, normal, _ = torso.closest_point_on_mesh(local)
                    assert found and (local-surface).dot(normal) < 0, 'Shoulders and hips must sit inside the torso'
                    assert abs(shoulder.x - paw.location.x) < .07, 'Walking paws must stay beneath the torso instead of splaying sideways'
                    assert abs(shoulder.y - paw.location.y) < .34, 'Legs must attach near their chest/hip end of the body'
                    points = limb.data.splines[0].bezier_points
                    assert (points[0].co-shoulder).length < 1e-5 and (points[-1].co-paw.location).length < 1e-5, 'Walking must keep the legs connected'
                    if limb == back_leg:
                        assert points[1].co.y < shoulder.lerp(paw.location,.42).y, 'Rear knees must bend forward'
                        assert points[2].co.y > shoulder.lerp(paw.location,.78).y, 'Rear hocks must turn back toward the heel'
                assert (rig['body'].matrix_basis @ anchors[1]).y - (rig['body'].matrix_basis @ anchors[0]).y > .70, 'Shoulders and hips must span the standing torso'
    scope['cat_pose'](rig, 'idle', 0)
    sitting = [(obj.location.copy(), obj.scale.copy()) for obj in scope['animated_parts'](rig)]
    scope['cat_pose'](rig, 'jumpOn', 1)
    for obj, (location, scale) in zip(scope['animated_parts'](rig), sitting):
        assert (obj.location-location).length < .001 and (obj.scale-scale).length < .001, 'Jumping onto the sofa must end in the seated pose'
    scope['cat_pose'](rig, 'jumpOff', 0)
    for obj, (location, scale) in zip(scope['animated_parts'](rig), sitting):
        assert (obj.location-location).length < .001 and (obj.scale-scale).length < .001, 'Jumping off must start from the seated pose'
    for state in ('jumpOn', 'jumpOff'):
        scope['cat_pose'](rig, state, .14)
        crouched_height = rig['body'].scale.z
        scope['cat_pose'](rig, state, .45)
        assert rig['body'].scale.z > crouched_height, 'Takeoff must extend out of the crouch'
        assert all(paw.location.z > paw.scale.z + .12 for paw in rig['feet'] + rig['back_feet']), 'Airborne paws must tuck clear of the ground'
        scope['cat_pose'](rig, state, .77)
        assert rig['body'].scale.z < .90, 'Landing must absorb the impact'
    scope['cat_pose'](rig, 'jumpOff', 1)
    assert all(abs(paw.location.z-paw.scale.z) < .001 for paw in rig['feet'] + rig['back_feet']), 'Jump-down must land on four paws before walking'
    scope['cat_pose'](rig, 'curlUp', 1)
    curled = [(obj.location.copy(), obj.scale.copy()) for obj in scope['animated_parts'](rig)]
    tail = [point.co.copy() for point in rig['tail_curve'].data.splines[0].bezier_points]
    scope['cat_pose'](rig, 'curlSleep', 0)
    for obj, (location, scale) in zip(scope['animated_parts'](rig), curled):
        assert (obj.location-location).length < .001 and (obj.scale-scale).length < .001, 'Curling must join the sleeping pose without a jump'
    for point, before in zip(rig['tail_curve'].data.splines[0].bezier_points, tail):
        assert (point.co-before).length < .001
print('Verified five directional walks, planted paws without sliding, two supporting feet, connected walking legs, distinct sofa takeoffs and landings, tucked airborne paws, and matching curl/sleep poses for all three coats.')
