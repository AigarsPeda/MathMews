"""Original cartoon cat geometry, anatomical rest skeleton and skin weights.

Construct the silhouette first, fuse the body into one sealed surface, then
bind it in that same rest pose. No downloaded model or paid assets are used.
"""
import math
import bpy
import numpy as np
from mathutils import Vector


# Shared with the coat painter, which draws the inner ear on this same shape.
EAR = {'x': .275, 'lean': .125, 'y': -.60, 'tilt': .03, 'base': 1.50, 'height': .46, 'width': .195, 'depth': .100}


# Neighbour-averaging passes applied to the body's skin weights.
SKIN_RELAXATION = 3
TAIL_RELAXATION = 14


def ear_axis(side, t):
    return side*(EAR['x']+EAR['lean']*t), EAR['y']+EAR['tilt']*t, EAR['base']+EAR['height']*t


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


def ear(side):
    """Plump rounded-triangle ears, thick enough to survive the fused remesh.

    The pink inner ear is painted on the front face by game_cat.coat_pixels,
    so it can never float in front of, or poke through, the outer shell.
    """
    vertices, faces = [], []
    rings = 14
    for i in range(rings):
        t = i/(rings-1)
        width, depth = EAR['width']*(1-t)**.62+.022, EAR['depth']*(1-t)**.8+.024
        x, y, z = ear_axis(side, t)
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
    obj = bpy.data.objects.new('Outer ear', data)
    bpy.context.collection.objects.link(obj)
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


def leg_surface(side, rear):
    """A chunky plush leg: full shoulder or haunch, soft wrist, no knobby joint.

    Ring centers follow the rest bones, so the thicker silhouette still bends
    at the same joints and keeps the established support footprint.
    """
    profile = ([(.78, .42, .175, .200), (.64, .400, .172, .190),
                (.49, .378, .150, .160), (.35, .392, .132, .138),
                (.21, .414, .124, .128), (.07, .43, .124, .128)] if rear else
               [(.78, -.385, .130, .150), (.64, -.378, .134, .146),
                (.49, -.366, .130, .136), (.31, -.380, .122, .126),
                (.14, -.396, .118, .122), (.07, -.40, .120, .124)])
    vertices, faces = [], []
    for z, y, width, depth in profile:
        for j in range(24):
            angle = j*math.tau/24
            vertices.append((side*.215+width*math.cos(angle), y+depth*math.sin(angle), z))
    for i in range(len(profile)-1):
        for j in range(24):
            a, b = i*24+j, i*24+(j+1)%24
            faces.append((a, a+24, b+24, b))
    faces.extend((tuple(range(24)), tuple(reversed(range((len(profile)-1)*24, len(profile)*24)))))
    data = bpy.data.meshes.new('Chunky plush leg')
    data.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new('Haunch and hock' if rear else 'Foreleg and wrist', data)
    bpy.context.collection.objects.link(obj)
    return obj


def paw_surface(side, rear):
    """A rounded mitten reaching forward of the wrist, with three soft toes."""
    y = .43 if rear else -.40
    pieces = [ellipsoid('Round paw', (side*.215, y-.045, .100), (.150, .185, .100), .86)]
    for offset in (-.078, 0, .078):
        pieces.append(ellipsoid('Toe', (side*.215+offset, y-.185+.022*abs(offset)/.078, .070), (.058, .062, .066)))
    return pieces


def make_surface():
    # A bean: deep chest, a slight tuck behind the ribs and a round rump.
    pieces = [ellipsoid('Torso', (0, .05, .785), (.320, .66, .305)),
              ellipsoid('Chest', (0, -.33, .795), (.312, .30, .350)),
              ellipsoid('Rump', (0, .40, .790), (.345, .33, .345)),
              # A soft tuft of chest fluff gives the profile a little character.
              ellipsoid('Chest fluff', (0, -.585, .835), (.150, .085, .125)),
              ellipsoid('Short neck', (0, -.44, 1.02), (.275, .26, .26)),
              # A mochi head: a round dome, widest through the cheeks.
              ellipsoid('Rounded head', (0, -.62, 1.325), (.485, .385, .405)),
              ellipsoid('Muzzle', (0, -.915, 1.185), (.175, .095, .105))]
    for side in (-1, 1):
        pieces.append(ellipsoid('Cheek', (side*.270, -.70, 1.190), (.265, .275, .220)))
        for rear in (False, True):
            pieces.append(leg_surface(side, rear))
            pieces.extend(paw_surface(side, rear))
        pieces.append(ear(side))
    # A single plush tube with a rounded tip joins the rump continuously.
    points = [(0, .59, .89), (0, .72, 1.02), (0, .78, 1.31), (0, .77, 1.59), (0, .69, 1.80), (0, .56, 1.86)]
    data = bpy.data.curves.new('Upright hooked tail', 'CURVE')
    data.dimensions, data.bevel_depth, data.bevel_resolution = '3D', .098, 3
    data.resolution_u, data.use_fill_caps = 12, True
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for i, (point, coordinate) in enumerate(zip(spline.bezier_points, points)):
        point.co = coordinate
        point.handle_left_type = point.handle_right_type = 'AUTO'
        point.radius = 1-.22*i/(len(points)-1)
    tail = bpy.data.objects.new('Tail', data)
    bpy.context.collection.objects.link(tail)
    bpy.ops.object.select_all(action='DESELECT')
    tail.select_set(True)
    bpy.context.view_layer.objects.active = tail
    bpy.ops.object.convert(target='MESH')
    pieces.extend((bpy.context.object, ellipsoid('Rounded tail tip', points[-1], (.078, .078, .078))))
    mesh = join(pieces, 'Game cat skin')
    remesh = mesh.modifiers.new('Fuse continuous body', 'REMESH')
    remesh.mode, remesh.voxel_size, remesh.use_smooth_shade = 'VOXEL', .028, True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = mesh.modifiers.new('Soften surface joins', 'SMOOTH')
    smooth.factor, smooth.iterations = 1, 5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate = mesh.modifiers.new('Mobile surface density', 'DECIMATE')
    decimate.ratio = .47
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    subdivision = mesh.modifiers.new('Rounded silhouette', 'SUBSURF')
    subdivision.levels = 1
    bpy.ops.object.modifier_apply(modifier=subdivision.name)
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
    for side, x in (('L', -.32), ('R', .32)):
        bone('ear.'+side, (x, -.63, 1.59), (x*1.18, -.61, 1.85), 'head')
    for side, x in (('L', -.215), ('R', .215)):
        for label, points, parent in (
                ('foreleg', [(x, -.40, .79), (x, -.36, .49), (x, -.40, .10)], 'chest'),
                ('hindleg', [(x, .43, .77), (x, .37, .49), (x, .43, .10)], 'pelvis')):
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
    order = {name: index for index, name in enumerate(groups)}
    raw = np.zeros((len(mesh.data.vertices), len(order)))
    for vertex in mesh.data.vertices:
        p = vertex.co
        # Around the neck's own column the skull hands over higher up, which
        # leaves a band that belongs to the neck alone. The bend from chest to
        # head is then shared by two joints instead of creasing at the collar.
        nape = 1-ramp(.27, .37, math.hypot(p.x, p.y+.44))
        head = (ramp(.98, 1.18, p.z)*(1-nape)+ramp(1.06, 1.26, p.z)*nape)*(1-ramp(-.12, .08, p.y))
        # The chin belongs to the skull. A height-only blend left the
        # lower face on the neck when a sleeping cat turned its head.
        # Keep the throat blend behind the jaw instead of across the face.
        head = max(head, (1-ramp(-.70, -.53, p.y))*ramp(.84, .98, p.z))
        neck = ramp(.80, 1.02, p.z)*(1-ramp(-.08, .14, p.y))*(1-head)
        # A long hand-over from rump to tail: the root bends as a thick,
        # rounded curve and never pinches into a hinge.
        tail = ramp(.50, .70, p.y)*ramp(.87, 1.12, p.z)
        # The hooked tip bends forward beyond the base's Y cutoff. Keep
        # its upper vertices on the tail when it folds down for sleep.
        tail = max(tail, ramp(.30, .46, p.y)*ramp(1.14, 1.22, p.z))
        leg_y = -.40 if p.y < 0 else .43
        distance = math.hypot(abs(p.x)-.215, p.y-leg_y)
        # Below the belly the whole mitten belongs to its leg. Higher up,
        # tighten around the limb so the belly midline is never pulled
        # toward one side as the legs swing past each other.
        reach = .14+.12*(1-ramp(.30, .50, p.z))
        leg = (1-ramp(.59, .83, p.z))*(1-ramp(reach, reach+.13, distance))*ramp(0, .07, abs(p.x))
        body = max(0, 1-head-neck-tail-leg)
        weights = {'head': head, 'neck': neck}
        rear = ramp(-.25, .35, p.y)
        # Give the middle back its own bend. Uniform spine weight along
        # the torso flattened the curve between chest and pelvis offsets.
        middle = ramp(-.34, -.02, p.y)*(1-ramp(.10, .42, p.y))
        spine = .18+.60*middle
        weights.update({'chest': body*(1-rear)*(1-spine), 'pelvis': body*rear*(1-spine), 'spine': body*spine})
        side = 'L' if p.x < 0 else 'R'
        label = 'foreleg' if p.y < 0 else 'hindleg'
        paw = side+('.front.paw' if p.y < 0 else '.rear.paw')
        # Blend on either side of each anatomical bend, avoiding abrupt
        # rings of rigid vertices at knees, elbows and paw roots.
        # The hip and knee bands never overlap: a vertex shared by the body
        # and both limb segments is thrown outward as a fin when the leg tucks.
        lower = 1-ramp(.45, .53, p.z)
        toe = 1-ramp(.12, .30, p.z)
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
        # Fade across the fused base so a swivel bends the ear, not the skull.
        ear_weight = ramp(1.60, 1.77, p.z)*(1-ramp(-.46, -.31, p.y))*ramp(.13, .22, abs(p.x))
        if ear_weight:
            weights = {name: value*(1-ear_weight) for name, value in weights.items()}
            weights['ear.'+('L' if p.x < 0 else 'R')] = ear_weight
        for name, weight in weights.items():
            if weight > 1e-5:
                raw[vertex.index, order[name]] = weight
    raw /= raw.sum(axis=1, keepdims=True)
    # Relax the analytic regions across the surface. Their boundaries are
    # exact in rest space, which creased the thick haunch and elbow as soon
    # as a limb folded. The skull, ears and soles keep their authored weights.
    edges = np.array([edge.vertices[:] for edge in mesh.data.edges])
    degree = np.bincount(edges.ravel(), minlength=len(raw))[:, None]
    points = np.array([vertex.co[:] for vertex in mesh.data.vertices])
    head = raw[:, order['head']]+raw[:, order['ear.L']]+raw[:, order['ear.R']]
    free = ((head < .02) & (points[:, 2] > .09))[:, None]
    smooth = raw.copy()
    for _ in range(SKIN_RELAXATION):
        total = np.zeros_like(smooth)
        np.add.at(total, edges[:, 0], smooth[edges[:, 1]])
        np.add.at(total, edges[:, 1], smooth[edges[:, 0]])
        smooth = np.where(free, .5*smooth+.5*total/degree, raw)
    # The tail is one long tube on four joints. Extra passes along it spread
    # every bend over the neighbouring rings, so a curled tail reads as a
    # curve and not as elbows.
    tail = (sum(raw[:, order[name]] for name in order if name.startswith('tail')) > .5)[:, None]
    for _ in range(TAIL_RELAXATION):
        total = np.zeros_like(smooth)
        np.add.at(total, edges[:, 0], smooth[edges[:, 1]])
        np.add.at(total, edges[:, 1], smooth[edges[:, 0]])
        smooth = np.where(tail, .5*smooth+.5*total/degree, smooth)
    names = list(order)
    for index, row in enumerate(smooth):
        strongest = np.argsort(row)[-4:]
        strongest = strongest[row[strongest] > 1e-4]
        for joint in strongest:
            groups[names[joint]].add([index], float(row[joint]/row[strongest].sum()), 'REPLACE')
    mesh.parent = arm
    mesh.modifiers.new('Anatomical skin deformation', 'ARMATURE').object = arm
    mesh['source'] = 'Original Math Mews cartoon cat, authored in Blender'
    mesh['construction'] = 'Continuous sealed body, cheeked round head, chunky legs and mitten paws, short neck, plush hooked tail, anatomical skin weights.'
    return arm, mesh


def create_cat():
    mesh = make_surface()
    arm = make_armature()
    return bind(mesh, arm)
