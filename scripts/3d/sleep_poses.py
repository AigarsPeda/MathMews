"""Compact feline rests, authored in the original rig's Z-up rest space.

The hips settle before the shoulders, paws fold separately, and the head is
last to rest. Waking lifts the head before the body rises.
"""
import math
from mathutils import Matrix, Vector

SLEEP_POSES = ('Loaf', 'Crescent', 'Side')
# Height of the resting tail's centre line: its own plush radius.
TAIL_REST = .118


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
    breath = .012 * math.sin(t*math.pi)**2 if loop else 0
    side = variant == 'Side'
    curl = variant == 'Crescent'
    roll = -1.30 if side else 0
    # The crescent bends chest and hips toward the same side around the
    # spine, so the whole back is one C and not a straight loaf with a twist.
    yaw = .90 if curl else 0
    flank = ease(p, .42, .94) if side else shoulders
    target = dict(standing)

    def body_joint(name, position, angles, amount, rotation_amount=None):
        turn = amount if rotation_amount is None else rotation_amount
        rotation = Matrix.Rotation(angles[2]*turn, 3, 'Z') @ Matrix.Rotation(angles[1]*turn, 3, 'Y') @ Matrix.Rotation(angles[0]*turn, 3, 'X')
        rest = standing[name].translation
        target[name] = joint_matrix(bones[name], rest.lerp(Vector(position), amount), rotation)
        return target[name] @ bones[name].matrix_local.inverted()

    # A side sleeper lowers its weight first, then rolls onto the flank.
    # The belly rests on the support: these heights are the plush torso's
    # own radii, so nothing hovers above the cushion or sinks through it.
    body_joint('spine', (-.16 if curl else 0, .06, (.365 if side else .345 if curl else .375)+breath), (0, roll, .08 if curl else 0), (hips+shoulders)/2, flank if side else None)
    if not side and not curl:
        # Fill the small waist into the single rounded mass of a loaf.
        target['spine'] = target['spine'] @ Matrix.Diagonal((1+.10*(hips+shoulders)/2,)*3+(1,))
    body_joint('belly', (0, .0, .31+breath), (0, roll, 0), (hips+shoulders)/2, flank if side else None)
    chest_position = (.04 if curl else 0, -.22 if curl else -.33 if side else -.30, .360+breath)
    chest = body_joint('chest', chest_position, (.03, roll, yaw), shoulders, flank if side else None)
    pelvis = body_joint('pelvis', (.12 if curl else 0, .28 if curl else .35 if side else .27, (.385 if side else .350)+breath*.7), (-.04, roll, -yaw), hips, flank if side else None)

    # The oversized stylized skull needs its own cheek/chin contact, rather
    # than inheriting the full roll and sinking into the cushion.
    # Loaf: a short-necked nod with all four mittens under the torso.
    # Crescent: the cheek closes the curved back and meets the wrapped tail.
    head_position = (.30, -.37, .465) if curl else (-.04, -.52, .525) if side else (0, -.44, .515)
    head_angles = (.08, -1.30, .08) if side else (.30, .08, 1.14) if curl else (.28, -.03, -.03)
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
    head_turn = (head_turn[0]-.10*head_lift, head_turn[1]+(.10 if side else 0)*head_lift,
                 head_turn[2]-(.18 if curl else 0)*head_lift)
    head_motion = body_joint('head', head_at, head_turn, 1)
    neck_position = chest @ bones['neck'].head_local
    # Blend the same anatomical neck point in both frames. Blending toward
    # the head joint instead pushed the neck up through the lowered skull.
    neck_position = neck_position.lerp(head_motion @ bones['neck'].head_local, .55*head)
    upright_neck = standing['chest'] @ bones['chest'].matrix_local.inverted() @ bones['neck'].head_local
    neck_position += (standing['neck'].translation-upright_neck)*(1-head)
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
            if side and rear:
                feet = ease(p, .32 if sign < 0 else .43, .87 if sign < 0 else .98)
            names = (f'{side_name}.{label}joint0', f'{side_name}.{label}joint1', f'{side_name}.{"rear" if rear else "front"}.paw')
            rest_shoulder = bones[names[0]].head_local
            shoulder = motion @ rest_shoulder
            planted = bones[names[2]].head_local
            # Work in an unrolled body frame for stable IK poles.
            pivot = Vector((0, .06, .41))
            rolling = Matrix.Translation(pivot) @ Matrix.Rotation(roll*flank, 4, 'Y') @ Matrix.Translation(-pivot)
            if side:
                # Loose, slightly bent legs. The upper pair falls across toward
                # the cushion and lands a little apart from the lower pair,
                # instead of four stiff legs pointing out in a row.
                upper = sign > 0
                reach = Vector(((.56 if upper else .46),
                                ((.24 if upper else .44) if rear else (-.53 if upper else -.69)),
                                .285 if upper else .155))
                toe = planted.lerp(reach, feet)
                # The lower mitten rests on its edge; the upper one drapes
                # across it, with a different wrist angle and landing time.
                toe.z = max(toe.z, .10+.055*flank)
                solved = limb_pose(bones, names, rolling.inverted() @ shoulder, rolling.inverted() @ toe, .90)
                turn = Matrix.Rotation((-.95 if upper else roll)*flank, 3, 'Y') @ Matrix.Rotation((.14 if upper else -.10)*feet, 3, 'Z') @ Matrix.Rotation((.20 if upper else -.10)*feet, 3, 'X')
            else:
                # Loaf and crescent draw each leg in under the body. The hind
                # paws disappear beneath the rump; the wrists fold behind
                # the chest contour. The full-size mittens stay inside it.
                tucked = motion @ Vector((sign*(.11 if rear else .10), .48 if rear else (-.19 if curl else -.08), planted.z))
                tucked.z = .23
                toe = planted.lerp(tucked, feet)
                solved = limb_pose(bones, names, shoulder, toe, .90)
                turn = Matrix.Rotation((-yaw*hips if rear else yaw*shoulders), 3, 'Z')
            for name, matrix in solved.items(): target[name] = rolling @ matrix if side else matrix
            target[names[2]] = joint_matrix(bones[names[2]], target[names[2]].translation, turn)

    # The tail drapes off the rump and rests in one open arc on the cushion.
    # Forward kinematics along that arc keep every segment its own length,
    # and each joint only adds the smallest turn to the one before it. Posing
    # joints independently stretched the plush tube and wrung it into links.
    # Rising takes the whole wake: the tip has the farthest to travel.
    tail_amount = 1-ease(t, .04, 1) if waking else ease(p, .08, .96)
    names = ('tailjoint0', 'tailjoint1', 'tailjoint2', 'tailjoint3', 'tailTip')
    anchor = pelvis @ bones['tailjoint0'].head_local
    rest_points = [bones[name].head_local for name in names]+[bones['tailTip'].tail_local]
    lengths = [(rest_points[i+1]-rest_points[i]).length for i in range(len(names))]
    # Loaf: wrapped along one flank. Crescent: carried on round the open
    # side of the curve toward the chin.
    path = [anchor, anchor+Vector((.10, .09, -.10)),
            Vector((.31, .65, .22)), Vector((.51, .53, TAIL_REST)),
            Vector((.55, .27, TAIL_REST)), Vector((.46, -.02, TAIL_REST)),
            Vector((.26, -.22, TAIL_REST))]
    if curl:
        path = [anchor, anchor+Vector((.14, .02, -.10)),
                Vector((.55, .43, .22)), Vector((.68, .22, TAIL_REST)),
                Vector((.65, -.05, TAIL_REST)), Vector((.47, -.25, TAIL_REST)),
                Vector((.20, -.31, TAIL_REST))]
    if side:
        path = [anchor, anchor+Vector((.10, .16, -.06)),
                Vector((.34, .99, .19)), Vector((.58, 1.11, TAIL_REST)),
                Vector((.84, 1.05, TAIL_REST)), Vector((1.03, .86, TAIL_REST))]
    for _ in range(3):
        # Corner cutting rounds the sketch into an even curve.
        path = [path[0]]+[point for a, b in zip(path, path[1:]) for point in (a.lerp(b, .25), a.lerp(b, .75))]+[path[-1]]
    points, travelled = [anchor], 0
    for length in lengths:
        travelled += length
        walked = 0
        for a, b in zip(path, path[1:]):
            step = (b-a).length
            if walked+step >= travelled:
                points.append(a.lerp(b, (travelled-walked)/step))
                break
            walked += step
        else:
            points.append(path[-1]+(path[-1]-path[-2]).normalized()*(travelled-walked))
    # Blend each joint's own turn relative to the joint before it. Blending
    # whole-tail orientations is ambiguous once the tip has turned half way
    # round: the shorter path flips sides and the tip whips across.
    carried = pelvis.to_quaternion()
    parent_final, parent_now, position = carried.copy(), carried.copy(), anchor.copy()
    # The standing pose has its own curved tail carriage, not identity turns.
    parent_standing = (standing['pelvis'] @ bones['pelvis'].matrix_local.inverted()).to_quaternion()
    for i, name in enumerate(names):
        rest_direction = rest_points[i+1]-rest_points[i]
        final = (parent_final @ rest_direction).rotation_difference(points[i+1]-points[i]) @ parent_final
        local = parent_final.inverted() @ final
        upright = (standing[name] @ bones[name].matrix_local.inverted()).to_quaternion()
        local_standing = parent_standing.inverted() @ upright
        now = parent_now @ local_standing.slerp(local, tail_amount)
        target[name] = joint_matrix(bones[name], position, now.to_matrix())
        position = position+now @ rest_direction
        parent_final, parent_now, parent_standing = final, now, upright

    # Facial meshes use absolute bones too; move them with the skull and close
    # both eyes gradually as the chin/cheek approaches its support.
    old_head = standing['head'] @ bones['head'].matrix_local.inverted()
    face_delta = head_motion @ old_head.inverted()
    for name in bones.keys():
        if name.startswith(('ear.', 'eye.', 'whisker.', 'brow.', 'lid.', 'mouth.')) or name == 'nose':
            target[name] = face_delta @ standing[name]
        closed = 1-ease(t, .06, .42) if waking else ease(p, .40, .95)
        if name.startswith('eye.'):
            center = bones[name].head_local
            # Flatten into the lid line, then vanish: a flat disc would still
            # show as a dark ellipse whenever the head is seen from above.
            gone = 1-ease(closed, .80, 1)
            close = Matrix.Translation(center) @ Matrix.Diagonal((gone, gone, 1-closed, 1)) @ Matrix.Translation(-center)
            target[name] = head_motion @ close @ bones[name].matrix_local
        if name.startswith('lid.'):
            # The happy crescent, turned over, is a peacefully closed eye.
            center, shown = bones[name].head_local, ease(closed, .55, 1)
            asleep = Matrix.Translation(center+Vector((0, 0, -.006*shown))) @ Matrix.Rotation(math.pi, 4, (bones[name].tail_local-bones[name].head_local).normalized()) @ Matrix.Diagonal((shown, shown, shown, 1)) @ Matrix.Translation(-center)
            target[name] = head_motion @ asleep @ bones[name].matrix_local
        if name.startswith('ear.'):
            spread = (.17 if name.endswith('L') else -.17)*head
            target[name] = head_motion @ joint_matrix(bones[name], bones[name].head_local, Matrix.Rotation(spread, 3, 'Y') @ Matrix.Rotation(-.10*head, 3, 'X'))
    return target
