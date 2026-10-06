"""Original cartoon cat geometry, anatomical rest skeleton and skin weights.

Construct the silhouette first, fuse the body into one sealed surface, then
bind it in that same rest pose. No downloaded model or paid assets are used.
"""
import math
import bpy
from mathutils import Vector


def ramp(low, high, value):
    t = max(0, min(1, (value-low)/(high-low)))
    return t*t*(3-2*t)


def ellipsoid(name, center, radii, exponent=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24)
    obj = bpy.context.object
    obj.name = name
    for vertex in obj.data.vertices:
        vertex.co = Vector(center)+Vector(tuple(math.copysign(abs(c)**exponent, c)*r for c, r in zip(vertex.co, radii)))
    return obj


def ear(side, inset=False):
    """Rounded triangular ears with sealed, recessed salmon inserts."""
    vertices, faces = [], []
    rings = 12
    for i in range(rings):
        t = i/(rings-1)
        width = (.16 if inset else .21)*(1-t)**.75+.005
        depth = (.025 if inset else .085)*(1-t)+.004
        x = side*(.32+.11*t)
        y = -.63+(.02*t)-(.068 if inset else 0)
        z = (1.56 if inset else 1.48)+(.26 if inset else .39)*t
        for j in range(16):
            a = j*math.tau/16
            vertices.append((x+width*math.cos(a), y+depth*math.sin(a), z))
    for i in range(rings-1):
        for j in range(16):
            a = i*16+j
            b = i*16+(j+1)%16
            faces.append((a, b, b+16, a+16))
    faces.extend((tuple(reversed(range(16))), tuple(range((rings-1)*16, rings*16))))
    data = bpy.data.meshes.new('Rounded ear surface')
    data.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new('Ear insert' if inset else 'Outer ear', data)
    bpy.context.collection.objects.link(obj)
    if inset:
        obj.vertex_groups.new(name='Ear insert tint').add(list(range(len(vertices))), 1, 'REPLACE')
    return obj


def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    return result


def make_surface():
    pieces = [ellipsoid('Torso', (0, .05, .81), (.30, .66, .27), .92),
              ellipsoid('Short neck', (0, -.43, 1.03), (.245, .25, .27)),
              ellipsoid('Rounded head', (0, -.61, 1.31), (.49, .36, .42), .84)]
    for side in (-1, 1):
        for y in (-.40, .43):
            pieces.extend((ellipsoid('Leg', (side*.215, y, .39), (.115, .13, .35), .85),
                           ellipsoid('Round paw', (side*.215, y-.018, .105), (.125, .145, .105), .85)))
        pieces.append(ear(side))
    # A single tapered tube, with a rounded tip, joins the rump continuously.
    points = [(0, .59, .89), (0, .72, 1.02), (0, .78, 1.31), (0, .77, 1.59), (0, .69, 1.80), (0, .56, 1.86)]
    data = bpy.data.curves.new('Upright hooked tail', 'CURVE')
    data.dimensions, data.bevel_depth, data.bevel_resolution = '3D', .073, 3
    data.resolution_u, data.use_fill_caps = 12, True
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for i, (point, coordinate) in enumerate(zip(spline.bezier_points, points)):
        point.co = coordinate
        point.handle_left_type = point.handle_right_type = 'AUTO'
        point.radius = 1-.35*i/(len(points)-1)
    tail = bpy.data.objects.new('Tail', data)
    bpy.context.collection.objects.link(tail)
    bpy.ops.object.select_all(action='DESELECT')
    tail.select_set(True)
    bpy.context.view_layer.objects.active = tail
    bpy.ops.object.convert(target='MESH')
    pieces.extend((bpy.context.object, ellipsoid('Rounded tail tip', points[-1], (.048, .048, .048))))
    mesh = join(pieces, 'Game cat skin')
    remesh = mesh.modifiers.new('Fuse continuous body', 'REMESH')
    remesh.mode, remesh.voxel_size, remesh.use_smooth_shade = 'VOXEL', .028, True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = mesh.modifiers.new('Soften surface joins', 'SMOOTH')
    smooth.factor, smooth.iterations = 1, 5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate = mesh.modifiers.new('Mobile surface density', 'DECIMATE')
    decimate.ratio = .55
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    subdivision = mesh.modifiers.new('Rounded silhouette', 'SUBSURF')
    subdivision.levels = 1
    bpy.ops.object.modifier_apply(modifier=subdivision.name)
    mesh = join([mesh, ear(-1, True), ear(1, True)], 'Game cat skin')
    # Smooth remeshing lifts the soles slightly; restore exact floor contact.
    floor = min(v.co.z for v in mesh.data.vertices)
    for vertex in mesh.data.vertices:
        vertex.co.z -= floor
    return mesh


def make_armature():
    data = bpy.data.armatures.new('Original cat skeleton')
    arm = bpy.data.objects.new('Game cat rig', data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name, head, tail, parent=None):
        b = data.edit_bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = data.edit_bones[parent]
    bone('spine', (0, .08, .81), (0, -.15, .84))
    bone('belly', (0, 0, .70), (0, -.12, .70), 'spine')
    bone('chest', (0, -.40, .81), (0, -.40, 1.0), 'spine')
    bone('pelvis', (0, .43, .78), (0, .30, .82), 'spine')
    bone('neck', (0, -.43, 1.0), (0, -.53, 1.14), 'chest')
    bone('head', (0, -.53, 1.14), (0, -.61, 1.55), 'neck')
    for side, x in (('L', -.215), ('R', .215)):
        for label, points, parent in (
                ('foreleg', [(x, -.40, .79), (x, -.37, .42), (x, -.40, .10)], 'chest'),
                ('hindleg', [(x, .43, .77), (x, .39, .43), (x, .43, .10)], 'pelvis')):
            paw = side+('.front.paw' if label == 'foreleg' else '.rear.paw')
            upper, lower = [side+'.'+label+'joint'+str(i) for i in (0, 1)]
            bone(upper, points[0], points[1], parent)
            bone(lower, points[1], points[2], upper)
            bone(paw, points[2], Vector(points[2])+Vector((0, -.10, 0)), lower)
    points = [(0, .59, .89), (0, .77, 1.18), (0, .78, 1.47), (0, .71, 1.75), (0, .56, 1.86)]
    for i in range(4):
        bone('tailjoint'+str(i), points[i], points[i+1], 'spine' if i == 0 else 'tailjoint'+str(i-1))
    bone('tailTip', points[-1], Vector(points[-1])+Vector((0, -.03, 0)), 'tailjoint3')
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.show_in_front = True
    return arm


def segment_weight(point, a, b):
    delta = b-a
    t = max(0, min(1, (point-a).dot(delta)/delta.length_squared))
    return (point-(a+delta*t)).length_squared, t


def bind(mesh, arm):
    groups = {bone.name: mesh.vertex_groups.new(name=bone.name) for bone in arm.data.bones}
    tint = mesh.vertex_groups.get('Ear insert tint')
    for vertex in mesh.data.vertices:
        p = vertex.co
        inserts = tint and any(g.group == tint.index and g.weight > .5 for g in vertex.groups)
        if inserts:
            weights = {'head': 1}
        else:
            head = ramp(.98, 1.18, p.z)*(1-ramp(-.12, .08, p.y))
            neck = ramp(.87, 1.08, p.z)*(1-ramp(-.12, .08, p.y))*(1-head)
            tail = ramp(.54, .68, p.y)*ramp(.93, 1.08, p.z)
            leg_y = -.40 if p.y < 0 else .43
            distance = math.hypot(abs(p.x)-.215, p.y-leg_y)
            leg = (1-ramp(.54, .74, p.z))*(1-ramp(.14, .24, distance))
            body = max(0, 1-head-neck-tail-leg)
            weights = {'head': head, 'neck': neck}
            rear = ramp(-.25, .35, p.y)
            weights.update({'chest': body*(1-rear)*.65, 'pelvis': body*rear*.65, 'spine': body*.35})
            side = 'L' if p.x < 0 else 'R'
            label = 'foreleg' if p.y < 0 else 'hindleg'
            paw = side+('.front.paw' if p.y < 0 else '.rear.paw')
            # Blend on either side of each anatomical bend, avoiding abrupt
            # rings of rigid vertices at knees, elbows and paw roots.
            lower = 1-ramp(.33, .51, p.z)
            toe = 1-ramp(.14, .25, p.z)
            weights[side+'.'+label+'joint0'] = leg*(1-lower)
            weights[side+'.'+label+'joint1'] = leg*lower*(1-toe)
            weights[paw] = leg*lower*toe
            if tail:
                names = ['tailjoint'+str(i) for i in range(4)]
                samples = [segment_weight(p, arm.data.bones[n].head_local, arm.data.bones[n].tail_local) for n in names]
                i = min(range(4), key=lambda j: samples[j][0])
                t = samples[i][1]
                weights[names[i]] = tail*(1-t if i < 3 else 1)
                if i < 3:
                    weights[names[i+1]] = tail*t
        strongest = sorted(((n, w) for n, w in weights.items() if w > 1e-5), key=lambda v: -v[1])[:4]
        total = sum(w for _, w in strongest)
        for name, weight in strongest:
            groups[name].add([vertex.index], weight/total, 'REPLACE')
    mesh.parent = arm
    mesh.modifiers.new('Anatomical skin deformation', 'ARMATURE').object = arm
    mesh['source'] = 'Original Math Mews cartoon cat, authored in Blender'
    mesh['construction'] = 'Continuous sealed body, rounded head and paws, short neck, hooked tail, anatomical skin weights.'
    return arm, mesh


def create_cat():
    mesh = make_surface()
    arm = make_armature()
    return bind(mesh, arm)
