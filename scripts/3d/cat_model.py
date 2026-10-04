"""Approved dumpling cat, with procedural coat markings and editable expressions.

All dimensions are Blender units. Front is -Y and up is +Z. See HANDOFF.md
and docs/art/cat-approved-concept.png for the approved visual reference.
"""
import math
import bpy
import bmesh
from mathutils import Vector

HEAD_RADII = (.70, .55, .63)
HEAD_HOME = (0, -.035, 1.10)
BODY_HOME = (0, .08, .44)
TAIL_REST_POINTS = [(0, 0, 0), (.24, .14, .045), (.43, .12, .27), (.42, .04, .48)]
TAIL_BOX_POINTS = [(0, 0, 0), (.12, .10, .27), (.42, .12, .50), (.45, .04, .72)]
COATS = {'orange': 'EFA45E', 'grey': '929DA8', 'white': 'E9E4DA'}
STRIPES = {'orange': 'B47C50', 'grey': '667380', 'white': 'C7C0B5'}
CREAM = 'FFF5E5'
BLUSH = 'F09AAE'


def rgba(hexcolor):
    srgb = [int(hexcolor[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c < .04045 else ((c + .055) / 1.055) ** 2.4 for c in srgb] + [1]


def math_node(nodes, links, operation, *inputs):
    node = nodes.new('ShaderNodeMath')
    node.operation = operation
    for index, value in enumerate(inputs):
        if isinstance(value, (int, float)):
            node.inputs[index].default_value = value
        else:
            links.new(value, node.inputs[index])
    return node.outputs[0]


def fur_material(skin, pattern='plain'):
    name = f'Dumpling fur {skin} {pattern}'
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .78
    bsdf.inputs['Sheen Weight'].default_value = .20
    base = CREAM if pattern in ('head', 'body', 'paw') else COATS[skin]
    bsdf.inputs['Base Color'].default_value = rgba(base)
    material.diffuse_color = rgba(base)
    coordinates = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 145
    noise.inputs['Detail'].default_value = 2
    links.new(coordinates.outputs['Generated'], noise.inputs['Vector'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .08
    bump.inputs['Distance'].default_value = .004
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    if pattern == 'plain':
        return material
    separate = nodes.new('ShaderNodeSeparateXYZ')
    links.new(coordinates.outputs['Generated'], separate.inputs[0])
    x, y, z = (separate.outputs[key] for key in ('X', 'Y', 'Z'))
    calculate = lambda operation, *values: math_node(nodes, links, operation, *values)
    abs_x = calculate('ABSOLUTE', calculate('SUBTRACT', x, .5))
    if pattern == 'head':
        # Two warm crown patches, separated by a tapered ivory blaze.
        edge = calculate('SUBTRACT', .79, calculate('MULTIPLY', abs_x, .65))
        organic = calculate('MULTIPLY', calculate('SUBTRACT', noise.outputs['Fac'], .5), .004)
        crown = calculate('GREATER_THAN', z, calculate('ADD', edge, organic))
        blaze = calculate('ADD', .028, calculate('MULTIPLY', calculate('SUBTRACT', 1, z), .17))
        mask = calculate('MULTIPLY', crown, calculate('GREATER_THAN', abs_x, blaze))
    elif pattern == 'body':
        mask = calculate('MULTIPLY', calculate('GREATER_THAN', y, .63), calculate('GREATER_THAN', z, .48))
    else:
        dx = calculate('DIVIDE', calculate('SUBTRACT', x, .55), .22)
        dz = calculate('DIVIDE', calculate('SUBTRACT', z, .25), .17)
        ellipse = calculate('ADD', calculate('MULTIPLY', dx, dx), calculate('MULTIPLY', dz, dz))
        mask = calculate('MULTIPLY', calculate('LESS_THAN', ellipse, 1), calculate('LESS_THAN', y, .28))
    mix = nodes.new('ShaderNodeMixRGB')
    mix.inputs[1].default_value = rgba(CREAM)
    mix.inputs[2].default_value = rgba(COATS[skin])
    links.new(mask, mix.inputs[0])
    color = mix.outputs[0]
    if pattern == 'head':
        stripe_masks = []
        for center in (.37, .5, .63):
            dx = calculate('DIVIDE', calculate('SUBTRACT', x, center), .028)
            dz = calculate('DIVIDE', calculate('SUBTRACT', z, .90), .085)
            ellipse = calculate('ADD', calculate('MULTIPLY', dx, dx), calculate('MULTIPLY', dz, dz))
            stripe_masks.append(calculate('LESS_THAN', ellipse, 1))
        stripes = calculate('MAXIMUM', stripe_masks[0], calculate('MAXIMUM', stripe_masks[1], stripe_masks[2]))
        stripe_mix = nodes.new('ShaderNodeMixRGB')
        links.new(stripes, stripe_mix.inputs[0])
        links.new(color, stripe_mix.inputs[1])
        stripe_mix.inputs[2].default_value = rgba(STRIPES[skin])
        color = stripe_mix.outputs[0]
    links.new(color, bsdf.inputs['Base Color'])
    return material


def solid_material(name, color, roughness=.65):
    name = 'Dumpling ' + name
    material = bpy.data.materials.get(name)
    if material:
        return material
    material = bpy.data.materials.new(name)
    material.diffuse_color = rgba(color)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = rgba(color)
    shader.inputs['Roughness'].default_value = roughness
    return material


def group(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def ball(name, location, scale, material, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1)
    obj = bpy.context.object
    obj.name, obj.parent = name, parent
    obj.location, obj.scale = location, scale
    obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def line(name, points, radius, material, parent):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions, data.bevel_depth, data.bevel_resolution = '3D', radius, 4
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    data.materials.append(material)
    return obj


def rounded_prism(name, outline, depth, material, parent, bevel):
    count = len(outline)
    vertices = [(x, y, z) for y in (-depth / 2, depth / 2) for x, z in outline]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    mesh.materials.append(material)
    modifier = obj.modifiers.new('Soft sculpted edges', 'BEVEL')
    modifier.width, modifier.segments = bevel, 5
    obj.modifiers.new('Soft normals', 'WEIGHTED_NORMAL')
    return obj


def face_y(x, z):
    rx, ry, rz = HEAD_RADII
    return -ry * math.sqrt(max(.05, 1 - (x / rx) ** 2 - (z / rz) ** 2))


def sculpted_ear(name, coat, pink, parent):
    """A closed, rounded shell with a raised rim and a recessed pink cup.

    The front points toward -Y. Concentric rings give the inset real depth,
    rather than placing a flat pink triangle on a flat orange triangle.
    """
    outline = [(-.215, -.065), (.215, -.065), (.18, .24),
               (.105, .435), (.01, .52), (-.095, .435), (-.185, .24)]
    # Front lip, pink cavity, and a plump convex back, all one sealed mesh.
    rings = [(1, -.055), (.83, -.185), (.66, -.17),
             (.32, -.075), (.65, .205), (1, .065)]
    vertices = [(x * scale, y + z * .08, .20 + (z - .20) * scale)
                for scale, y in rings for x, z in outline]
    n = len(outline)
    faces, materials = [], []
    for ring in (0, 1, 2, 4, 5):
        next_ring = (ring + 1) % len(rings)
        for index in range(n):
            following = (index + 1) % n
            faces.append((ring * n + index, ring * n + following,
                          next_ring * n + following, next_ring * n + index))
            materials.append(1 if ring == 2 else 0)
    for ring, center, material in [(3, (0, -.029, .20), 1), (4, (0, .216, .20), 0)]:
        center_index = len(vertices)
        vertices.append(center)
        for index in range(n):
            faces.append((ring * n + index, ring * n + (index + 1) % n, center_index))
            materials.append(material)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(coat)
    mesh.materials.append(pink)
    mesh.update()
    normals = bmesh.new()
    normals.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(normals, faces=list(normals.faces))
    normals.to_mesh(mesh)
    normals.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    for face, material in zip(mesh.polygons, materials):
        face.material_index = material
        face.use_smooth = True
    subdivision = obj.modifiers.new('Rounded ear shell', 'SUBSURF')
    subdivision.levels = subdivision.render_levels = 2
    return obj


def face_ball(name, x, z, scale, material, head, offset=.016):
    y = face_y(x, z)
    obj = ball(name, (x, y - offset, z), scale, material, head)
    rx, ry, rz = HEAD_RADII
    normal = Vector((x / rx ** 2, y / ry ** 2, z / rz ** 2)).normalized()
    obj.rotation_euler = Vector((0, -1, 0)).rotation_difference(normal).to_euler()
    return obj


def create_cat(skin='orange', boxed=False):
    coat = fur_material(skin)
    cream = solid_material('Ivory', CREAM, .78)
    blush = solid_material('Rosy cheeks', BLUSH, .82)
    pink = solid_material('Inner ear', 'D9798E', .85)
    dark = solid_material('Glossy eyes', '201A18', .10)
    white = solid_material('Eye catchlight', 'FFFFFF', .16)
    caramel = solid_material('Brow ' + skin, STRIPES[skin], .80)
    mouth_color = solid_material('Mouth interior', '672F30', .72)
    tongue_color = solid_material('Tongue', 'EC8593', .55)
    root = group('Dumpling cat motion root')
    root['design'] = 'Approved expressive cream dumpling cat, 2026-10-03'
    root['coat'] = skin
    root['model_source'] = 'scripts/3d/cat_model.py'
    body = group('Short pear body', BODY_HOME, root)
    ball('Cream pear body', (0, 0, 0), (.46, .39, .45), fur_material(skin, 'body'), body)
    ball('Round haunches', (0, .09, -.11), (.48, .36, .31), fur_material(skin, 'body'), body)
    feet, back_feet, legs, back_legs = [], [], [], []
    for side in (-1, 1):
        feet.append(ball('Front paw ' + str(side), (side * .23, -.31, .18), (.16, .21, .20), fur_material(skin, 'paw'), root))
        back_feet.append(ball('Back paw ' + str(side), (side * .36, .16, .14), (.18, .20, .15), cream, root))
        legs.append(ball('Short front leg ' + str(side), (0, 0, 0), (.14, .14, .25), cream, root))
        back_legs.append(ball('Short back leg ' + str(side), (0, 0, 0), (.15, .15, .20), cream, root))
    head = group('Oversized round head', HEAD_HOME, root)
    ball('Ivory face and orange crown', (0, 0, 0), HEAD_RADII, fur_material(skin, 'head'), head)
    ears = []
    for side in (-1, 1):
        ear = group('Rounded ear ' + str(side), (side * .46, -.075, .435), head)
        sculpted_ear('Cupped ear shell ' + str(side), coat, pink, ear)
        ears.append(ear)
    eyes, glints, brows, tears = [], [], [], []
    for side in (-1, 1):
        x = side * .25
        eyes.append(face_ball('Glossy round eye ' + str(side), x, .065, (.091, .050, .105), dark, head))
        glints.append(face_ball('Eye sparkle ' + str(side), x - .023, .10, (.023, .012, .027), white, head, .067))
        brow = group('Expressive brow ' + str(side), (x, face_y(x, .235) - .022, .235), head)
        line('Gentle brow arch ' + str(side), [(-.042, 0, -.008), (0, -.002, .017), (.042, 0, -.008)], .013, caramel, brow)
        brows.append(brow)
        face_ball('Rosy cheek ' + str(side), side * .45, -.09, (.12, .027, .105), blush, head)
        tear = face_ball('Tear ' + str(side), x + side * .035, -.09, (.027, .015, .055), solid_material('Tear', 'A9D5F0', .25), head)
        tear.scale = (0, 0, 0)
        tears.append(tear)
    nose = rounded_prism('Tiny coral nose', [(-.037, .016), (.037, .016), (0, -.022)], .032, solid_material('Nose', 'EA8B7B', .55), head, .009)
    nose.location = (0, -.573, -.095)
    # Tiny upper lips, rather than the previous large separate muzzle spheres.
    for side in (-1, 1):
        face_ball('Small upper lip ' + str(side), side * .027, -.139, (.035, .023, .028), cream, head, .034)
    mouth = group('Smiling mouth', (0, face_y(0, -.205) - .025, -.205), head)
    ball('Soft open smile', (0, 0, 0), (.081, .027, .060), mouth_color, mouth)
    ball('Little pink tongue', (0, -.025, -.030), (.040, .014, .025), tongue_color, mouth)
    frown = group('Sad mouth', (0, face_y(0, -.22) - .027, -.22), head)
    line('Gentle frown', [(-.062, 0, -.020), (0, -.006, .015), (.062, 0, -.020)], .013, caramel, frown)
    frown.scale = (0, 0, 0)
    tail = group('Short curved tail pivot', (.34, .14, .24), root)
    # In the box, rise inside the opening before curling out above the rim.
    tail_curve = line('Plump orange tail', TAIL_REST_POINTS, .102, coat, tail)
    tail_tip = ball('Cream tail tip', TAIL_REST_POINTS[-1], (.097, .098, .095), cream, tail)
    return dict(root=root, body=body, head=head, ears=ears, eyes=eyes, glints=glints,
                brows=brows, mouth=mouth, frown=frown, tears=tears, feet=feet,
                back_feet=back_feet, legs=legs, back_legs=back_legs, tail=tail,
                tail_curve=tail_curve, tail_tip=tail_tip, boxed=boxed)


def smoothstep(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)


def pulse(t,center,radius):
    return smoothstep(1-abs(t-center)/radius)


def smooth_window(t,start,end,ramp):
    return smoothstep((t-start)/ramp)*smoothstep((end-t)/ramp)


def care_action_time(state, t):
    """Leave room for props to enter and leave around the existing actions."""
    if state == 'eating':
        return max(0, min(1, (t - .125) / .75))
    if state == 'box1':
        return max(0, min(1, (t - .25) / .75))
    if state == 'box3':
        return min(1, t / (2/3))
    return t


def pose_cat(rig, state, t):
    clip_t = t
    t = care_action_time(state, t)
    root, body, head, tail = (rig[key] for key in ('root', 'body', 'head', 'tail'))
    phase = t * math.tau
    envelope = math.sin(math.pi * t)
    root.location, root.rotation_euler = (0, 0, 0), (0, 0, 0)
    body.location, body.scale = BODY_HOME, (1, 1, 1 + .025 * math.sin(phase * 2))
    head.location, head.scale = HEAD_HOME, (1, 1, 1)
    head.rotation_euler = (.025 * math.sin(phase), .095 * math.sin(phase), -.025 * math.sin(phase))
    tail.location = (.34, .14, .24)
    tail.scale = (1, 1, 1)
    tail.rotation_euler = (.035 * math.sin(phase * 5), 0, .25 * math.sin(phase * 2))
    rig['mouth'].scale = (1, 1, .48)
    rig['frown'].scale = (0, 0, 0)
    blink = max(pulse(t,.38,.025), pulse(t,.76,.025))
    eye_height = .105 * (1 - .93 * blink)
    for side, ear, brow, paw, tear in zip((-1, 1), rig['ears'], rig['brows'], rig['feet'], rig['tears']):
        ear.rotation_euler = (.14, side * -.12, 0)
        brow.rotation_euler = (0, side * -.04, 0)
        paw.location, paw.rotation_euler, paw.scale = (side * .23, -.31, .18), (0, 0, 0), (.16, .21, .20)
        tear.scale = (0, 0, 0)
    for side, paw in zip((-1, 1), rig['back_feet']):
        paw.location, paw.scale = (side * .36, .16, .14), (.18, .20, .15)
    if state in ('idle', 'idle2', 'blinkIdle', 'blinkSit', 'waiting'):
        # Two breaths, a look to either side, a double ear flick and a paw shift.
        head.location.z += .014 * math.sin(phase * 2)
        for side, ear in zip((-1,1), rig['ears']):
            ear.rotation_euler.x += .18 * pulse(t,.22 + side*.018,.055)
        rig['feet'][1].location.z += .045 * pulse(t,.58,.12)
    if state == 'excited':
        # Lean into the touch, wriggle from side to side, then relax.
        pet = smooth_window(t, .04, .96, .16)
        wriggle = math.sin(phase * 2.5) * pet
        nuzzle = math.sin(phase * 1.5) * pet
        root.rotation_euler.z = .23 * wriggle
        body.location.x = .055 * wriggle
        body.scale = (1 + .065 * pet, 1 - .025 * pet, 1 - .07 * pet)
        head.location.x = .09 * nuzzle
        head.location.z -= .07 * pet
        head.rotation_euler = (.08 * pet, .26 * nuzzle, -.08 * wriggle)
        tail.rotation_euler.z = .44 * math.sin(phase * 3) * pet
        rig['mouth'].scale = (1 + .10 * pet, 1, .48 + .30 * pet)
        eye_height = .105 * (1 - .84 * pet)
        for side, paw, ear in zip((-1, 1), rig['feet'], rig['ears']):
            kick = max(0, side * math.sin(phase * 2.5)) * pet
            paw.location.x += side * .07 * kick
            paw.location.z += .15 * kick
            paw.rotation_euler.y = side * .30 * kick
            ear.rotation_euler.x += .12 * math.sin(phase * 3 - side * .4) * pet
    if state in ('correct', 'dance', 'preview'):
        cheer = 1 if state == 'preview' else smooth_window(t,.08,.90,.12)
        anticipation = pulse(t,.075,.075) if state != 'preview' else 0
        hop = pulse(t,.25,.12) + .68 * pulse(t,.48,.105) if state != 'preview' else 0
        land = pulse(t,.38,.055) + .65 * pulse(t,.60,.055) if state != 'preview' else 0
        root.location.z = .28 * hop
        squash = .12 * anticipation + .10 * land
        body.scale = (1 + squash*.5, 1 + squash*.5, 1-squash+.07*hop)
        head.location.z -= .08 * anticipation + .04 * land
        head.rotation_euler.y = -.13 * cheer + .08 * math.sin(phase * 5) * cheer
        rig['mouth'].scale = (1 + .15 * cheer, 1, .48 + .75 * cheer)
        paw = rig['feet'][1]
        wave = math.sin(phase*4) * smooth_window(t,.48,.85,.08)
        paw.location = (.23 + .16 * cheer + .035*wave, -.31 - .07 * cheer, .18 + .36 * cheer)
        paw.rotation_euler.y = -.78 * cheer + .23*wave
        for side, brow, ear in zip((-1, 1), rig['brows'], rig['ears']):
            brow.rotation_euler.y = side * -.20 * cheer
            ear.rotation_euler.x += -.20 * cheer + .08*math.sin(phase*3)*cheer
        if state == 'dance':
            root.rotation_euler.z = .22 * math.sin(phase * 5) * cheer
            rig['feet'][0].location.z += .22 * max(0, -math.sin(phase*3)) * cheer
        eye_height = .105 * (1 - .55 * cheer)
    if state in ('sad', 'incorrect', 'cry', 'angryCute'):
        # A puzzled reaction, then recovery. Wrong answers should invite retry.
        sadness = smooth_window(t,.10,.68,.12) if state == 'incorrect' else .70+.12*math.sin(phase)
        head.location.z -= .10 * sadness
        head.rotation_euler.y = .16 * math.sin(phase*3) * sadness if state == 'incorrect' else .12*sadness
        rig['mouth'].scale = (1, 1, .48 * max(0, 1 - 2 * sadness))
        rig['frown'].scale = (sadness, sadness, sadness)
        eye_height *= 1 - .15 * sadness
        for side, brow, ear in zip((-1, 1), rig['brows'], rig['ears']):
            brow.rotation_euler.y = side * (.42 if state != 'angryCute' else -.42) * sadness
            ear.rotation_euler.y = side * -.50 * sadness
        if state == 'incorrect':
            rig['feet'][0].location.z += .13 * pulse(t,.80,.13)
            rig['mouth'].scale.z += .30 * pulse(t,.83,.16)
        if state == 'cry':
            for tear in rig['tears']:
                tear.scale = (.027, .015, .055 * (.75 + .25 * math.sin(phase)))
    if state == 'surprised':
        rig['mouth'].scale = (.60, 1, .48 + .65 * envelope)
        eye_height = .105 * (1 + .12 * envelope)
        for brow in rig['brows']:
            brow.location.z = .235 + .045 * envelope
    else:
        for brow in rig['brows']:
            brow.location.z = .235
    if state in ('layDown', 'sleep', 'sleepy', 'restSleep', 'lieDown'):
        settle = smoothstep(min(1,t/.78)) if state in ('sleepy', 'lieDown') else 1
        body.location = (0, .08 + .08 * settle, .44 - .19 * settle)
        body.scale = (1 + .12 * settle, 1 + .32 * settle, (1 - .45 * settle) * (1 + .015 * math.sin(phase)))
        head.location = (0, -.035 - .11 * settle, 1.10 - .40 * settle)
        head.scale = (1 + .04 * settle, 1, 1 - .10 * settle)
        head.rotation_euler = (.055 * settle + .035*pulse(t,.86,.12), .022 * math.sin(phase), 0)
        for side, paw in zip((-1, 1), rig['feet']):
            paw.location = (side * .23, -.31 - .16 * settle, .18 - .055 * settle)
            paw.scale = (.16 + .01 * settle, .21 + .05 * settle, .20 - .08 * settle)
        tail.rotation_euler.z = .30 * settle + .06 * math.sin(phase*2)
        closing = settle if state == 'sleepy' else t * t * (3 - 2 * t) if state == 'restSleep' else 1 if state == 'sleep' else 0
        eye_height = .105 * (1 - .93 * closing)
        rig['mouth'].scale.z = .48 * (1 - closing) + .035 * closing
        if state in ('sleepy', 'restSleep'):
            rig['mouth'].scale.z += .85 * envelope ** 4
    if state == 'eating':
        lean = smooth_window(t,.03,.90,.15)
        munch = math.sin(phase * 5)
        head.location.z -= (.44 + .045 * munch) * lean
        head.location.y -= (.21 + .025 * munch) * lean
        head.rotation_euler = (.30 * lean + .045 * munch * lean,
                               .07 * math.sin(phase * 2) * lean, 0)
        rig['mouth'].scale.z = .48 * (1 - lean) + (.28 + .35 * munch ** 2) * lean
        eye_height = .105 * (1 - .35 * lean)
        tail.rotation_euler.z = .22 * math.sin(phase * 3) * lean
    if state in ('box1', 'box2', 'box3'):
        normal_pose = {obj: (obj.location.copy(), obj.rotation_euler.copy(), obj.scale.copy())
                       for obj in animated_parts(rig)}
        normal_eye_height = eye_height
        # Shared hidden pose makes the three one-shot clips join exactly.
        if state == 'box1':
            hide = smoothstep((t - .45) / .36)
            hop = .20 * pulse(t, .30, .17)
            crouch = pulse(t, .12, .12)
            look = 0
        elif state == 'box2':
            peek = smooth_window(t, .16, .77, .16)
            hide, hop, crouch = 1 - .56 * peek, 0, 0
            look = .20 * math.sin(phase * 1.5) * peek
        else:
            hide = 1 - smoothstep((t - .16) / .45)
            hop, crouch = 0, 0
            look = .10 * math.sin(phase * 2) * smooth_window(t, .62, .98, .12)
        root.location.z = -.08 + hop
        body.location = (0, .02, .45 - .187 * hide - .025 * crouch)
        body.scale = (.94 - .32 * hide + .06 * crouch,
                      .82 - .27 * hide, .50 - .41 * hide - .04 * crouch)
        head.location = (0, -.035, 1.10 - .83 * hide - .06 * crouch)
        head.scale = (1 - .62 * hide, 1 - .62 * hide, 1 - .955 * hide)
        head.rotation_euler = (.06 * crouch, look, 0)
        for side, paw, back_paw in zip((-1, 1), rig['feet'], rig['back_feet']):
            paw.location = (side * .23, -.13, .38 - .12 * hide)
            paw.scale = (.15 - .02 * hide, .17 - .02 * hide, .11 - .084 * hide)
            back_paw.location = (side * .34, .12, .37 - .11 * hide)
            back_paw.scale = (.17 - .02 * hide, .17 - .02 * hide, .11 - .084 * hide)
        # Curl inward before ducking, so the tail never crosses a side wall.
        tuck = smoothstep(min(1, hide * 3))
        tail.location = (.40 - .10 * hide, .14 - .02 * hide, .45 - .185 * hide)
        tail.scale = (1 - .65 * tuck, 1 - .65 * tuck, 1 - .975 * hide)
        tail.rotation_euler = (0, 0, .12 * math.sin(phase * 2) * (1 - hide))
        eye_height = .105 * (1 - .60 * hide)
        rig['mouth'].scale.z = .48 + .17 * (1 - hide)
        activity = (smoothstep((clip_t - .14) / .11) if state == 'box1' else
                    1 - smoothstep((clip_t - 2/3) / .08) if state == 'box3' else 1)
        transfer_hop = (smooth_window(clip_t, 0, .27, .055) if state == 'box1' else
                        smooth_window(clip_t, 2/3, .98, .08) if state == 'box3' else 0)
        for obj, (location, rotation, scale) in normal_pose.items():
            obj.location = location.lerp(obj.location, activity)
            obj.rotation_euler = tuple(a + (b-a)*activity for a, b in zip(rotation, obj.rotation_euler))
            obj.scale = scale.lerp(obj.scale, activity)
        eye_height = normal_eye_height + (eye_height-normal_eye_height)*activity
        # Lift and tuck the whole cat while the box moves underneath it.
        root.location.z += .28 * transfer_hop
        body.scale.z *= 1 - .70 * transfer_hop
        for paw in rig['feet']:
            paw.location.z += .30 * transfer_hop
            paw.scale.z *= 1 - .50 * transfer_hop
        for paw in rig['back_feet']:
            paw.location.z += .35 * transfer_hop
            paw.scale.z *= 1 - .33 * transfer_hop
        tail.location.z += .16 * transfer_hop
        root['box_activity'], root['transfer_hop'] = float(activity), float(transfer_hop)
        if rig['boxed']:
            for point, rest, curled in zip(rig['tail_curve'].data.splines[0].bezier_points, TAIL_REST_POINTS, TAIL_BOX_POINTS):
                point.co = Vector(rest).lerp(Vector(curled), activity)
            rig['tail_tip'].location = Vector(TAIL_REST_POINTS[-1]).lerp(Vector(TAIL_BOX_POINTS[-1]), activity)
    if state == 'waiting':
        head.rotation_euler.x = -.10 * envelope
        rig['feet'][1].location.z += .16 * envelope
    for eye, glint in zip(rig['eyes'], rig['glints']):
        eye.scale = (.091, .050, eye_height)
        opening = max(0, min(1, (eye_height - .010) / .065))
        glint.scale = (.023 * opening, .012 * opening, .027 * opening)
    # Root-local endpoints follow the posed torso and paws. Both ends overlap
    # their meshes, including during waves, breathing and lying down.
    body_transform = body.matrix_basis
    for side, paw, leg, back_paw, back_leg in zip(
            (-1, 1), rig['feet'], rig['legs'], rig['back_feet'], rig['back_legs']):
        for limb, foot, anchor, radius in (
                (leg, paw, (side * .23, -.18, 0), .14),
                (back_leg, back_paw, (side * .32, .12, -.16), .15)):
            shoulder = body_transform @ Vector(anchor)
            tip = foot.location.copy()
            direction = tip - shoulder
            limb.location = (shoulder + tip) / 2
            limb.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
            if state in ('box1', 'box2', 'box3'):
                radius += (.14 - .115 * hide - radius) * activity
                radius *= 1 - .36 * transfer_hop
            limb.scale = (radius, radius, direction.length / 2 + radius)


def configure_cat_camera(scene):
    scene.camera.location = (3.2, -10, 4.0)
    target = Vector((.04, 0, .94))
    scene.camera.rotation_euler = (target - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera.data.ortho_scale = 2.70


def animated_parts(rig):
    return [rig[key] for key in ('root', 'body', 'head', 'tail', 'tail_tip', 'mouth', 'frown')] + [
        obj for key in ('ears', 'eyes', 'glints', 'brows', 'feet', 'back_feet', 'legs', 'back_legs', 'tears') for obj in rig[key]
    ]
