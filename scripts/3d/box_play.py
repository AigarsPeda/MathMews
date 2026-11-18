"""Cardboard hide-and-peek on the native cat rig."""
import math
from mathutils import Matrix, Vector
from sleep_poses import ease, rest_tail, sleep_pose

FLOOR = .08
RIM = 1.21


def arrival(clip, t):
    return t if clip == 'box1' else 1-t if clip == 'box3' else 1


def build_box(scope):
    # The side facing the arriving cat folds out as a ramp. The other walls
    # never pass through the cat as the box slides in from its left.
    root = scope['empty']('Sliding cardboard box')
    box = scope['box']
    front, back = -1.18, 1.41
    center, depth = (front+back)/2, back-front
    box('Box bottom', (0, center, FLOOR/2), (1.58, depth, FLOOR), 'wood', .025, root)
    for name, y in [('front', front), ('back', back)]:
        box('Box '+name, (0, y, RIM/2), (1.58, .065, RIM), 'wood', .025, root)
    box('Box side', (-.76, center, RIM/2), (.065, depth-.06, RIM), 'wood', .025, root)
    flap = box('Box folding side', (.76, center, .035), (.065, depth-.06, RIM-.035), 'wood', .025, root)
    flap.data.transform(Matrix.Translation((0, 0, (RIM-.035)/2)))
    return root, flap


def pose_box(parts, clip, t):
    root, flap = parts
    a = arrival(clip, t)
    root.location.x = -4.5*(1-ease(a, .02, .32))
    flap.rotation_euler.y = math.pi/2*(1-ease(a, .35, .55))


def pose_box_cat(arm, clip, t, standing, joint_matrix, limb_pose):
    a = arrival(clip, t)
    peek = ease(t, .17, .40)*(1-ease(t, .64, .84)) if clip == 'box2' else 0
    duck = ease(a, .35, .86)-.56*peek
    tail_tuck = ease(a, .17, .43)
    if duck:
        pose = sleep_pose(arm, 'restLoafEnter', duck, standing, joint_matrix, limb_pose, tail_tuck=tail_tuck)
    else:
        pose = standing.copy()
        if tail_tuck:
            pelvis = pose['pelvis'] @ arm.data.bones['pelvis'].matrix_local.inverted()
            rest_tail(arm.data.bones, pose, standing, pelvis, tail_tuck, joint_matrix)
    # Lean around one corner, raising the near eye over the rim first.
    head = pose['head'].translation
    lean = (Matrix.Translation(head+Vector((.18, -.07, 0))*peek)
            @ Matrix.Rotation(-.36*peek, 4, 'Y') @ Matrix.Translation(-head))
    for name in pose:
        if name == 'head' or (arm.data.bones[name].parent and arm.data.bones[name].parent.name == 'head'):
            pose[name] = lean @ pose[name]
    hop = .20*ease(a, .075, .17)*(1-ease(a, .23, .36))
    lift = Matrix.Translation((0, 0, FLOOR*ease(a, .08, .30)+hop))
    return {name: lift @ matrix for name, matrix in pose.items()}
