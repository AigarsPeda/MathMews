"""Compact feline rests, authored in the original rig's Z-up rest space.

The hips settle before the shoulders, paws fold separately, and the head is
last to rest. Waking lifts the head before the body rises.
"""
import math
from mathutils import Matrix, Vector

SLEEP_POSES = ('Loaf', 'Crescent', 'Side')


def ease(t, start=0, end=1):
    u = max(0, min(1, (t-start)/(end-start)))
    return u*u*(3-2*u)


def sleep_pose(arm, state, t, standing, joint_matrix, limb_pose):
    bones = arm.data.bones
    variant = next(name for name in SLEEP_POSES if name in state)
    loop = state.endswith('Sleep')
    waking = state.endswith('Wake')
    p = 1-ease(t, .25, 1) if waking else 1 if loop else t
    head_lift = ease(t, 0, .24)*(1-ease(t, .30, .78)) if waking else 0
    hips, shoulders, head = ease(p, .03, .69), ease(p, .12, .80), ease(p, .22, 1)
    # One quiet four-second breath; the head and pads remain supported.
    breath = .008 * math.sin(t*math.pi)**2 if loop else 0
    side = variant == 'Side'
    curl = variant == 'Crescent'
    roll = 1.35 if side else .40 if curl else .04
    yaw = .20 if curl else 0
    flank = ease(p, .42, .94) if side else shoulders
    target = dict(standing)

    def body_joint(name, position, angles, amount, rotation_amount=None):
        turn = amount if rotation_amount is None else rotation_amount
        rotation = Matrix.Rotation(angles[2]*turn, 3, 'Z') @ Matrix.Rotation(angles[1]*turn, 3, 'Y') @ Matrix.Rotation(angles[0]*turn, 3, 'X')
        rest = standing[name].translation
        target[name] = joint_matrix(bones[name], rest.lerp(Vector(position), amount), rotation)
        return target[name] @ bones[name].matrix_local.inverted()

    # A side sleeper lowers its weight first, then rolls onto the flank.
    body_joint('spine', (.065 if curl else 0, .06, (.39 if side else .41)+breath), (0, roll, 0), (hips+shoulders)/2, flank if side else None)
    body_joint('belly', (0, .0, .31+breath), (0, roll, 0), (hips+shoulders)/2, flank if side else None)
    chest_position = (-.07 if curl else 0, -.28 if curl else -.34, (.38 if side else .44 if curl else .40)+breath)
    chest = body_joint('chest', chest_position, (.03, roll, yaw), shoulders, flank if side else None)
    pelvis = body_joint('pelvis', (-.055 if curl else 0, .35, (.36 if side else .38)+breath*.7), (-.04, roll, -.30 if curl else 0), hips, flank if side else None)

    # The oversized stylized skull needs its own cheek/chin contact, rather
    # than inheriting the full roll and sinking into the cushion.
    head_position = (-.13, -.39, .50) if curl else (.20, -.54, .48) if side else (0, -.53, .73)
    head_angles = (.12, 1.34, -.06) if side else (.33, .25, 1.05) if curl else (.14, -.055, -.04)
    # Carry the skull with the descending shoulders, then add the final nod.
    # Delaying the whole head until the nod stretched the neck above a crouch.
    chest_drop = target['chest'].translation-standing['chest'].translation
    final_chest = Vector(chest_position)
    carried_head = standing['head'].translation+chest_drop
    final_carried_head = standing['head'].translation+final_chest-standing['chest'].translation
    head_at = carried_head+(Vector(head_position)-final_carried_head)*head
    head_turn = (head_angles[0]*head, head_angles[1]*flank, head_angles[2]*head) if side else tuple(a*head for a in head_angles)
    # Wake while still supported by the cushion. The neck follows the small
    # lift; only then do the shoulders unroll and the paws gather underneath.
    head_at += Vector((0, -.02, .12))*head_lift
    head_turn = (head_turn[0]-.10*head_lift, head_turn[1]-(.10 if side else 0)*head_lift,
                 head_turn[2]-(.18 if curl else 0)*head_lift)
    head_motion = body_joint('head', head_at, head_turn, 1)
    neck_position = chest @ bones['neck'].head_local
    neck_position = neck_position.lerp(target['head'].translation, .30*head)
    if side or curl:
        # Share the bend between chest and skull. Half the skull's absolute
        # roll left the neck upright while the side sleeper lay on its flank.
        neck_rotation = chest.to_quaternion().slerp(head_motion.to_quaternion(), .55)
        target['neck'] = joint_matrix(bones['neck'], neck_position, neck_rotation.to_matrix())
    else:
        body_joint('neck', neck_position, tuple(a*.55*head for a in head_angles), 1)

    # Solve folded legs in an upright frame, then roll that frame with the
    # flank. This keeps elbows and hocks anatomical even in the side sleeper.
    for label, rear, motion in (('foreleg', False, chest), ('hindleg', True, pelvis)):
        for side_name, sign in (('L', -1), ('R', 1)):
            # Receive the body's weight before folding the wrists. Offset the
            # two front paws so they do not collapse inward simultaneously.
            feet = ease(p, .22, .80) if rear else ease(p, .40 if sign < 0 else .49, .90 if sign < 0 else .98)
            names = (f'{side_name}.{label}joint0', f'{side_name}.{label}joint1', f'{side_name}.{"rear" if rear else "front"}.paw')
            rest_shoulder = bones[names[0]].head_local
            shoulder = motion @ rest_shoulder
            planted = bones[names[2]].head_local
            fold = Vector((sign*(.16 if rear else .11), .37 if rear else -.16, .15))
            if side:
                # Relaxed unequal reaches avoid a four-paws-in-a-row silhouette.
                fold = Vector((sign*.14, (.36 if sign < 0 else .56) if rear else (-.46 if sign < 0 else -.62), -.02))
            if curl:
                fold.y = .24 if rear else -.20
            # Work in an unrolled body frame for stable IK poles.
            pivot = Vector((0, .06, .41))
            rolling = Matrix.Translation(pivot) @ Matrix.Rotation(roll*flank, 4, 'Y') @ Matrix.Translation(-pivot)
            toe = planted.lerp(fold, feet)
            toe = rolling @ toe
            # The curled forearm sweeps beneath the chest during the tuck;
            # reserve its skin thickness as well as the pad's contact height.
            toe.z = max(toe.z, .10+(.08 if curl and not rear else .04)*shoulders)
            solved = limb_pose(bones, names, rolling.inverted() @ shoulder, rolling.inverted() @ toe)
            for name, matrix in solved.items(): target[name] = rolling @ matrix
            # The loaf folds its wrists inward underneath the chest.
            wrist = .25*feet if not rear and not side else -.13*feet
            target[names[2]] = joint_matrix(bones[names[2]], target[names[2]].translation,
                Matrix.Rotation(roll*flank, 3, 'Y') @ Matrix.Rotation(wrist, 3, 'X'))

    # The tail follows a curved chain on the cushion, rather than rotating
    # the entire upright hook into a rigid bar above the back.
    tail_amount = ease(p, .12, .92)
    names = ('tailjoint0', 'tailjoint1', 'tailjoint2', 'tailjoint3', 'tailTip')
    anchor = pelvis @ bones['tailjoint0'].head_local
    points = [anchor, Vector((.30, .57, .22)), Vector((.44, .31, .13)),
              Vector((.44, .02, .13)), Vector((.29, -.09, .13))]
    if side:
        # A loose curve beside the haunches, rather than the curled nap's wrap.
        points = [anchor, Vector((.24, .68, .22)), Vector((.47, .65, .15)),
                  Vector((.65, .45, .14)), Vector((.65, .28, .14))]
    rest_points = [bones[name].head_local for name in names]
    for i, name in enumerate(names):
        low, high = max(0, i-1), min(len(names)-1, i+1)
        rest_direction = rest_points[high]-rest_points[low]
        direction = points[high]-points[low]
        rotation = Matrix.Identity(3).to_quaternion().slerp(rest_direction.rotation_difference(direction), tail_amount)
        # Translation follows the same smoothly distributed curvature as the
        # rotations, so a tightly wrapped tail does not acquire sharp hinges.
        start = anchor + rest_points[i]-rest_points[0]
        position = start.lerp(points[i], tail_amount)
        target[name] = joint_matrix(bones[name], position, rotation.to_matrix())

    # Facial meshes use absolute bones too; move them with the skull and close
    # both eyes gradually as the chin/cheek approaches its support.
    old_head = standing['head'] @ bones['head'].matrix_local.inverted()
    face_delta = head_motion @ old_head.inverted()
    for name in bones.keys():
        if name.startswith(('ear.', 'eye.', 'whisker.', 'brow.', 'lid.', 'mouth.')) or name == 'nose':
            target[name] = face_delta @ standing[name]
        if name.startswith('eye.'):
            center = bones[name].head_local
            closed = 1-ease(t, .06, .42) if waking else ease(p, .40, .95)
            close = Matrix.Translation(center) @ Matrix.Diagonal((1, 1, 1-.955*closed, 1)) @ Matrix.Translation(-center)
            target[name] = head_motion @ close @ bones[name].matrix_local
        if name.startswith('ear.'):
            spread = (.10 if name.endswith('L') else -.10)*head
            target[name] = head_motion @ joint_matrix(bones[name], bones[name].head_local, Matrix.Rotation(spread, 3, 'Y'))
    return target
