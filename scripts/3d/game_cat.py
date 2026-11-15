"""Build the original cartoon cat and bake its game actions for mobile.

The mesh and skeleton share one rest pose. Two-segment IK keeps planted paws
at their targets while the body sits, walks or lands.
"""
from pathlib import Path
import math
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from cat_model import COATS, STRIPES, rgba, create_cat as create_controls, pose_cat as pose_controls, ball, line, solid_material, care_action_time, smooth_window, pulse

ROOT = Path(__file__).resolve().parents[2]
JUMP = __import__('json').loads((ROOT/'constants/cat-jump.json').read_text())
from original_cat import create_cat as create_original_cat, EAR, join
from cat_gaits import GAITS, pose_gait
from cat_acting import performance
from cat_collar import add_collar

# The white coat's own trim is a touch brighter, so muzzle, bib and mittens
# still separate from the body.
IVORY = {'white': 'FFFCF7'}
# Share of the coat colour that is self-lit.
COAT_FILL = .12
# A seated hind leg keeps this share of its reach before drawing in.
SEATED_HAUNCH = .86
# Large, low, wide-set eyes carry the expression on the simple face.
EYE = {'x': .222, 'z': 1.300, 'width': .058, 'depth': .019, 'height': .074}
from puzzle_reactions import PUZZLE_REACTIONS, pose_reaction
from sleep_poses import SLEEP_POSES, sleep_pose


def keyed(t, keys):
    """Clamped, eased pose keys. End tangents settle without overshoot."""
    for (start, a), (end, b) in zip(keys, keys[1:]):
        if t <= end:
            u = max(0, min(1, (t-start)/(end-start)))
            return a+(b-a)*u*u*(3-2*u)
    return keys[-1][1]


def jump_pose(state, t, effort=1):
    """Hind-driven launch, gathered flight, fore-first impact and recovery.

    Upward jumps reach up; a downward jump looks and reaches down instead of
    replaying the same spring. Feet stay on their support until released.
    Values are offsets in the original cat's unscaled rest space.
    """
    off = state == 'jumpOff'
    takeoff, contact, hind_contact = JUMP['takeoff'], JUMP['touchdown'], JUMP['hindTouchdown']
    # Load the haunches, then visibly extend while the hind pads are STILL
    # planted. Finishing this after liftoff reads as an unsupported body bob.
    crouch = keyed(t, [(0, 0), (.115, 1), (takeoff, 0), (1, 0)])
    # Continue downward immediately after forepaw contact, then ease out at
    # maximum flexion. A smoothstep starting at contact would stop the torso
    # first and only then dip, making the landing feel like a separate bounce.
    impact = (0 if t <= contact else math.sin(min(1,(t-contact)/(.775-contact))*math.pi/2)
              if t <= .775 else keyed(t, [(.775, 1), (1, 0)]))
    # Negative pitch raises the nose in Blender's -Y forward convention.
    pitch = keyed(t, [(0, 0), (.12, .02 if off else -.035),
                      (.24, 0 if off else -.28), (.42, .12 if off else -.13),
                      (.62, .16 if off else .025), (.80, .055), (1, 0)])
    fore_lift = keyed(t, [(0, 0), (.09, 0), (takeoff, .19 if off else .29),
                          (.40, .30), (.58, -.035 if off else .045), (contact, 0), (1, 0)])
    fore_reach = keyed(t, [(0, 0), (.10, 0), (.25, -.07), (.44, .065),
                           (.58, -.13 if off else -.17), (contact, 0), (1, 0)])
    rear_lift = keyed(t, [(0, 0), (takeoff, 0), (.28, .065), (.43, .34),
                          (.62, .18), (hind_contact, 0), (1, 0)])
    rear_reach = keyed(t, [(0, 0), (takeoff, 0), (.28, .12 if off else .16), (.46, -.21),
                           (.63, -.09), (hind_contact, 0), (1, 0)])
    gather = keyed(t, [(0, 0), (.27, 0), (.44, 1), (.67, 0), (1, 0)])
    return tuple(value*effort for value in (crouch, impact, pitch, fore_lift, fore_reach, rear_lift, rear_reach, gather))


def load_cat(skin):
    arm, mesh = create_original_cat()
    recolor(mesh, skin)
    return arm, mesh


def coat_pixels(points, skin):
    """Paint continuous rest-space shapes, independently of mesh triangulation.

    One symmetrical design for every coat: cream muzzle, blaze, bib, belly
    and mittens; soft tabby marks and a darker tail tip; painted inner ears
    and blush.
    """
    x, y, z = points.T
    ax = np.abs(x)
    def ramp(low, high, value):
        t = np.clip((value-low)/(high-low), 0, 1)
        return t*t*(3-2*t)
    front = 1-ramp(-.60, -.44, y)
    # Lower face: a rounded mask under the eyes that wraps onto the cheeks.
    arch = np.sqrt(np.clip(1-(x/.47)**2, 0, 1))
    muzzle = (1-ramp(-.09, .09, (z-1.095)/.15-arch))*front*ramp(.86, .93, z)
    # A flame between the eyes, tapering to a point on the forehead.
    width = .105*(1-ramp(1.22, 1.50, z))-.016
    blaze = (1-ramp(width-.013, width+.013, ax))*ramp(1.12, 1.20, z)*(1-ramp(-.82, -.72, y))
    bib = (1-ramp(.78, 1.06, (x/.235)**2+((z-.80)/.37)**2))*(1-ramp(-.47, -.31, y))
    leg_y = np.where(y < 0, -.40, .43)
    limb = np.hypot(ax-.215, y-leg_y)
    belly = (1-ramp(.54, .62, z))*(1-ramp(.19, .29, ax))*(1-ramp(.36, .52, y))*ramp(-.50, -.36, y)*ramp(.40, .44, z)
    mittens = (1-ramp(.215, .270, z))*(1-ramp(.24, .32, limb))
    tail = ramp(.47, .55, y)*ramp(1.02, 1.10, z)
    tail = np.maximum(tail, ramp(.30, .42, y)*ramp(1.62, 1.70, z))
    tip = (1-ramp(.155, .195, np.sqrt(x*x+(y-.56)**2+(z-1.86)**2)))*tail
    ivory = np.maximum.reduce((muzzle, blaze, bib, belly, mittens))
    # Tabby marks, each a little different so none looks stamped: a long
    # centre stroke between two shorter ones that fan outward on the forehead,
    # three saddle bands that sweep back as they run down the flank, and
    # tail rings that thin toward the tip.
    forehead = np.zeros_like(x)
    for centre, fan, start, length, weight in ((0, 0, -.89, .47, 1), (-.108, -.050, -.85, .33, .86), (.108, .050, -.85, .33, .86)):
        along = np.clip((y-start)/length, 0, 1)
        stroke = weight*(.011+.021*np.sin(along*math.pi))
        mark = 1-ramp(stroke, stroke+.012, np.abs(x-centre-fan*along))
        forehead = np.maximum(forehead, mark*ramp(0, .08, along)*(1-ramp(.90, 1, along)))
    forehead *= ramp(1.50, 1.56, z)*(1-ramp(.24, .30, ax))
    band = np.zeros_like(x)
    for centre, weight, reach, sweep in ((-.10, 1, .845, .10), (.15, 1.2, .79, .14), (.40, .9, .865, .08)):
        half = weight*(.013+.030*ramp(reach+.02, 1.06, z))
        band = np.maximum(band, (1-ramp(half, half+.012, np.abs(y-centre-sweep*(1.11-z))))*ramp(reach, reach+.06, z))
    band *= (1-ramp(1.13, 1.17, z))*(1-tail)
    ring = np.zeros_like(x)
    for level, half in ((1.15, .019), (1.36, .016), (1.57, .013)):
        ring = np.maximum(ring, 1-ramp(half, half+.010, np.abs(z-level)))
    ring *= tail*ramp(.60, .66, y)
    dark = np.maximum.reduce((forehead, band, ring, tip))*(1-ivory)
    coat, cream, stripe = [np.array(rgba(c)[:3]) for c in (COATS[skin], IVORY.get(skin, 'FFF5E5'), STRIPES[skin])]
    color = coat[None, :]*((1-dark)*(1-ivory))[:, None]+stripe[None, :]*dark[:, None]+cream[None, :]*ivory[:, None]
    # Two short toe lines over the front of every mitten.
    front_edge = leg_y-.226
    toes = 1-ramp(.0045, .0105, np.min(np.abs(ax[:, None]-np.array([.167, .263])), axis=1))
    toes *= ramp(front_edge-.004, front_edge+.012, y)*(1-ramp(front_edge+.085, front_edge+.125, y))*(1-ramp(.15, .19, z))*ramp(.012, .03, z)
    color = color*(1-.75*toes[:, None])+np.array(rgba('C9B8A6')[:3])*.75*toes[:, None]
    # Soft cheek blush under the outer corner of each eye.
    blush = .42*np.exp(-(((ax-.345)/.080)**2+((z-1.165)/.046)**2))*(1-ramp(-.74, -.62, y))
    color = color*(1-blush[:, None])+np.array(rgba('F2A0AE')[:3])*blush[:, None]
    # Inner ear, painted on the front face of the same shape original_cat builds.
    t = np.clip((z-EAR['base'])/EAR['height'], 0, 1)
    across = np.abs(ax-(EAR['x']+EAR['lean']*t))/(EAR['width']*(1-t)**.62+.022)
    inner = (1-ramp(.50, .62, across))*ramp(.26, .34, t)*(1-ramp(.76, .90, t))*ramp(.19, .25, ax)
    inner *= 1-ramp(EAR['y']+EAR['tilt']*t-.040, EAR['y']+EAR['tilt']*t-.018, y)
    pink = np.array(rgba('F2A9B4')[:3])[None, :]*t[:, None]+np.array(rgba('DE8494')[:3])[None, :]*(1-t)[:, None]
    color = color*(1-inner[:, None])+pink*inner[:, None]
    return color


def recolor(mesh, skin):
    # A dedicated UV unwrap lets the native renderer sample smooth coat shapes.
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=.008)
    bpy.ops.object.mode_set(mode='OBJECT')
    mesh.data.calc_loop_triangles()
    size = 1024
    image_pixels = np.zeros((size, size, 4), dtype=np.float32)
    image_pixels[:, :, :3] = rgba('FFF5E5')[:3]
    image_pixels[:, :, 3] = 1
    painted = np.zeros((size, size), dtype=bool)
    uv = mesh.data.uv_layers.active.data
    for triangle in mesh.data.loop_triangles:
        coords = np.array([uv[i].uv[:] for i in triangle.loops])*size-.5
        low = np.maximum(0, np.floor(coords.min(axis=0)).astype(int))
        high = np.minimum(size-1, np.ceil(coords.max(axis=0)).astype(int))
        if np.any(high<low): continue
        xx, yy = np.meshgrid(np.arange(low[0], high[0]+1), np.arange(low[1], high[1]+1))
        p0, p1, p2 = coords
        denominator = (p1[1]-p2[1])*(p0[0]-p2[0])+(p2[0]-p1[0])*(p0[1]-p2[1])
        if abs(denominator)<1e-8: continue
        a = ((p1[1]-p2[1])*(xx-p2[0])+(p2[0]-p1[0])*(yy-p2[1]))/denominator
        b = ((p2[1]-p0[1])*(xx-p2[0])+(p0[0]-p2[0])*(yy-p2[1]))/denominator
        c = 1-a-b
        inside = (a>=-1e-5)&(b>=-1e-5)&(c>=-1e-5)
        if not inside.any(): continue
        weights = np.stack((a[inside], b[inside], c[inside]), axis=1)
        points = weights @ np.array([mesh.data.vertices[i].co[:] for i in triangle.vertices])
        colors = coat_pixels(points, skin)
        image_pixels[yy[inside], xx[inside], :3] = colors
        image_pixels[yy[inside], xx[inside], 3] = 1
        painted[yy[inside], xx[inside]] = True
    # Pad UV islands so filtered texels at seams keep the adjacent coat color.
    for _ in range(4):
        for axis, step in ((0, 1), (0, -1), (1, 1), (1, -1)):
            neighbors = np.roll(painted, step, axis)
            fill = neighbors & ~painted
            image_pixels[fill] = np.roll(image_pixels, step, axis)[fill]
            painted |= fill
    image = bpy.data.images.new(skin+' coat texture', size, size, alpha=True)
    # Generated byte images save their values directly. Encode linear coat
    # colors into sRGB PNG values before packing for glTF's base-color texture.
    linear = image_pixels[:, :, :3]
    image_pixels[:, :, :3] = np.where(linear <= .0031308, linear*12.92, 1.055*np.power(linear, 1/2.4)-.055)
    image.pixels.foreach_set(image_pixels.ravel())
    image.filepath_raw = str(Path('/tmp')/('brainpet-cat-'+skin+'-coat.png'))
    image.file_format = 'PNG'
    image.save()
    filename = image.filepath_raw
    bpy.data.images.remove(image)
    image = bpy.data.images.load(filename, check_existing=False)
    image.name = skin+' coat texture'
    image.pack()
    material = bpy.data.materials.new(skin+' game cat coat')
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .82
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    links.new(texture.outputs['Color'], bsdf.inputs['Base Color'])
    # A little of the coat's own colour is self-lit, so the face and markings
    # stay readable in evening and night rooms without bleaching in daylight.
    links.new(texture.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = COAT_FILL
    mesh.data.materials.clear()
    mesh.data.materials.append(material)
    for polygon in mesh.data.polygons:
        polygon.use_smooth = True
        polygon.material_index = 0


def add_face(arm, mesh):
    """Attach the cartoon face and surface-weighted neck accessories.

    Every feature is projected onto the fused head, so the face follows the
    sculpted cheeks and muzzle instead of floating on a remembered plane.
    """
    eye = solid_material('Glossy charcoal eyes', '26262C', .22)
    sparkle = solid_material('Eye catchlights', 'FFFCF6', .30)
    ink = solid_material('Warm face lines', '5A463F', .60)
    whisker = solid_material('Soft whiskers', 'B3A396', .70)
    blossom = solid_material('Pink nose', 'E88D97', .45)
    skin = BVHTree.FromPolygons([v.co.copy() for v in mesh.data.vertices], [p.vertices[:] for p in mesh.data.polygons])
    def surface(x, z, lift=0, fallback=-.80):
        hit, normal, _, _ = skin.ray_cast(Vector((x, -3, z)), Vector((0, 1, 0)))
        if hit is None:
            return Vector((x, fallback, z)), Vector((0, -1, 0))
        return hit+normal*lift, normal
    def stroke(name, points, radius, material, lift=.004):
        # An optional third value places a point that lies beyond the silhouette.
        return line(name, [surface(point[0], point[1], lift, *point[2:])[0] for point in points], radius, material, None)
    objects, axes = {}, {}
    for side in (-1, 1):
        label = 'L' if side < 0 else 'R'
        x = side*EYE['x']
        center, normal = surface(x, EYE['z'], -.003)
        turn = Vector((0, -1, 0)).rotation_difference(normal)
        name = 'eye.'+label
        objects[name] = ball(name, center, (EYE['width'], EYE['depth'], EYE['height']), eye, None)
        objects[name].rotation_euler = turn.to_euler()
        glints = []
        for dx, dz, size in ((-.017, .027, 1), (.020, -.030, .42)):
            out = EYE['depth']*math.sqrt(max(.05, 1-(dx/EYE['width'])**2-(dz/EYE['height'])**2))
            glint = ball(name+'.glint', center+turn @ Vector((dx, -out-.002, dz)), (.0175*size, .007*size, .0215*size), sparkle, None)
            glint.rotation_euler = turn.to_euler()
            glints.append(glint)
        bpy.context.view_layer.update()
        for glint in glints:
            glint.data.transform(glint.matrix_world)
            glint.matrix_world = Matrix.Identity(4)
        objects[name+'.glint'] = join(glints, name+'.glint')
        objects[name+'.glint'].location = center
        objects[name+'.glint'].data.transform(Matrix.Translation(-center))
        axes['lid.'+label] = normal
        objects['lid.'+label] = stroke('Happy crescent eyelid '+label,
            [(x-.060, EYE['z']-.016), (x-.034, EYE['z']+.014), (x, EYE['z']+.026), (x+.034, EYE['z']+.014), (x+.060, EYE['z']-.016)], .0095, eye, .030)
        objects['brow.'+label] = stroke('Soft eyebrow '+label,
            [(x-.034, EYE['z']+.128), (x+side*.004, EYE['z']+.141), (x+.034, EYE['z']+.128)], .0065, ink)
        # Two short, tapered whiskers a side. Three hair-thin strands were
        # narrower than a pixel at game size and broke up into scratchy marks;
        # these stay wider than a pixel at their roots and read as clean ticks.
        for index, rise in enumerate((.046, -.034)):
            strand = stroke('Whisker '+label+str(index),
                [(side*.345, 1.190+rise*.25), (side*.470, 1.190+rise*.70, -.83), (side*.585, 1.190+rise, -.785)], .0095, whisker, .003)
            strand.data.use_fill_caps = True
            for point, taper in zip(strand.data.splines[0].bezier_points, (1, .78, .30)):
                point.radius = taper
            objects[f'whisker.{label}.{index}'] = strand
    center, _ = surface(0, 1.214, -.004)
    objects['nose'] = ball('Small cat nose', center, (.037, .019, .024), blossom, None)
    for vertex in objects['nose'].data.vertices:
        # A rounded triangle: broad and flat above, narrowing to the lip line.
        vertex.co.x *= 1+.42*vertex.co.z
        if vertex.co.z > 0:
            vertex.co.z *= .72
    objects['mouth.stem'] = stroke('Muzzle center', [(0, 1.196), (0, 1.160)], .0045, ink)
    objects['mouth.smile'] = stroke('Content cat smile', [(-.078, 1.166), (-.040, 1.142), (0, 1.160), (.040, 1.142), (.078, 1.166)], .0045, ink)
    objects['mouth.frown'] = stroke('Gentle frown', [(-.056, 1.140), (0, 1.164), (.056, 1.140)], .0045, ink)
    center, _ = surface(0, 1.140, .002)
    objects['mouth.open'] = ball('Soft open smile', center, (.046, .014, .040), solid_material('Mouth interior', '7A3A3C', .70), None)
    for vertex in objects['mouth.open'].data.vertices:
        # A happy D: flat along the lip line, round below.
        if vertex.co.z > 0:
            vertex.co.z *= .30
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, obj in objects.items():
        bone = arm.data.edit_bones.new(name)
        # Strokes pivot where they sit on the face: whiskers at their roots,
        # everything else about its own middle. Scaling one away, or tilting
        # a brow, then happens in place instead of swinging around the skull.
        points = [point.co.copy() for point in obj.data.splines[0].bezier_points] if obj.type == 'CURVE' else []
        center = obj.location if obj.type == 'MESH' else points[0] if name.startswith('whisker.') else sum(points, Vector())/len(points)
        # Eyelid bones point out of the face, giving their turn-over an axis.
        bone.head, bone.tail = center, center+axes.get(name, Vector((0, 0, 1)))*.05
        bone.parent = arm.data.edit_bones['head']
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
    for name, obj in objects.items():
        if obj.type == 'CURVE':
            data = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
            old = obj
            obj = bpy.data.objects.new(old.name+' Game face', data)
            bpy.context.collection.objects.link(obj)
            obj.matrix_world = old.matrix_world
            bpy.data.objects.remove(old, do_unlink=True)
            objects[name] = obj
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        obj.vertex_groups.new(name=name).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        obj.modifiers.new('Head attachment', 'ARMATURE').object = arm
        obj.parent = arm
    return list(objects.values())+add_collar(arm, mesh)


def joint_matrix(bone, position, rotation=None):
    rotation = rotation or Matrix.Identity(3)
    return Matrix.Translation(position) @ rotation.to_4x4() @ bone.matrix_local.to_3x3().to_4x4()


def limb_pose(bones, names, shoulder, toe, soft=0):
    """Two-segment IK. `soft` is the extension below which the limb telescopes.

    A plush limb that is as thick as it is long cannot fold tightly: the
    upper segment shears into a fin and the joint pinches. Resting poses
    therefore keep a gentle bend at `soft` of full reach and draw the whole
    limb in toward the body beyond that, leaving the mitten where it belongs.
    The paw itself is never scaled.
    """
    a, b, c = [bones[name].head_local for name in names]
    upper, lower = (b-a).length, (c-b).length
    direction = toe-shoulder
    reach, scale = direction.length, 1
    if soft and reach < soft*(upper+lower):
        scale = max(.2, reach/(soft*(upper+lower)))
        reach = soft*(upper+lower)
    distance = max(abs(upper-lower)+.0001, min(reach, upper+lower-.0001))
    direction.normalize()
    along = (upper*upper-lower*lower+distance*distance)/(2*distance)
    # Stable anatomical poles keep elbows bending back and rear knees forward.
    # Inferring a pole from an almost straight leg can flip during a stride.
    bend = Vector((0, -1 if 'hindleg' in names[0] else 1, 0))
    bend -= direction*bend.dot(direction)
    if bend.length < .001:
        bend = Vector((1, 0, 0))
    elbow = shoulder+(direction*along+bend.normalized()*math.sqrt(max(0, upper*upper-along*along)))*scale
    toe = shoulder+direction*distance*scale
    rotations = [(b-a).rotation_difference(elbow-shoulder).to_matrix(),
                 (c-b).rotation_difference(toe-elbow).to_matrix(), Matrix.Identity(3)]
    size = Matrix.Diagonal((scale, scale, scale, 1))
    return {name: joint_matrix(bones[name], position, rotation) @ (Matrix.Identity(4) if name == names[2] else size)
            for name, position, rotation in zip(names, (shoulder, elbow, toe), rotations)}


RESTING_STATES = ('idle', 'idle2', 'blinkIdle', 'waiting', 'sit', 'blinkSit')
# Standing carriage of the tail, base to tip. The lean is shared by the two
# lower joints and the upper two curl up again, so the root leaves the rump
# in line with the back instead of kinking sideways.
TAIL_CARRIAGE = (-.27, -.17, .20, .26)
TAIL_ROOT_LIMIT = .62


def tail_wave(state, t):
    """Per-joint (pitch, sway) that travels from the base of the tail to its tip.

    The base follows the hips and every later joint arrives a little after the
    one before it. A tail turned as one rigid hook reads as a lever; this
    successive drag is what makes it read as a tail. All terms loop exactly.
    """
    phase = t*math.tau
    if state in RESTING_STATES:
        wave = [(0, (.034+.024*i)*math.sin(phase-.75*i)) for i in range(4)]
    elif state.startswith('walk'):
        wave = [(.012*math.sin(2*phase-.5*i), (.030+.017*i)*math.sin(phase-.55*i)) for i in range(4)]
    elif state == 'trot':
        wave = [((.018+.010*i)*math.sin(2*phase-.6*i), (.022+.013*i)*math.sin(phase-.55*i)) for i in range(4)]
    elif state == 'run':
        wave = [((.032+.020*i)*math.sin(phase+.4-.6*i), 0) for i in range(4)]
    elif state == 'crawl' or state.startswith('box') or state in ('curlUp', 'curlSleep'):
        # These lay the tail flat or fold it away with their own controls.
        return None
    else:
        wave = [(0, 0)]*4
    # Carried as a relaxed S behind the hips, the tail no longer stands on
    # the centre line like a third ear when the cat faces the camera. Every
    # standing clip shares the carriage, so none pops as it starts or ends.
    return [(pitch+lean, sway) for (pitch, sway), lean in zip(wave, TAIL_CARRIAGE)]


def pose(arm, driver, state, t, idle_controls):
    if any(state == 'rest'+name+phase for name in SLEEP_POSES for phase in ('Enter', 'Sleep', 'Wake')):
        return sleep_pose(arm, state, t, pose(arm, driver, 'idle', 0, idle_controls), joint_matrix, limb_pose)
    # Small drops/hops use a separately solved contact pose. Blending a strong
    # jump with idle rotations would slide planted pads as the knees unfold.
    effort = .58 if state.endswith('Light') else 1
    state = state.removesuffix('Light')
    jumping = state in ('jumpOn', 'jumpOff', 'hop')
    pose_controls(driver, 'idle' if jumping or state in PUZZLE_REACTIONS else 'walk' if state in ('crawl', 'trot', 'run', 'rubLeft', 'rubRight') else 'idle' if state in ('sit', 'wakeStretch') else state, 0 if jumping or state == 'wakeStretch' else t)
    reaction = pose_reaction(driver, state, t, idle_controls) if state in PUZZLE_REACTIONS else None
    # Whole-body acting for the emotional clips; see cat_acting.performance.
    acting = None if reaction else performance(state, t)
    if state in ('trot', 'run'):
        pose_gait(driver, state, t)
    driver['root'].rotation_euler = (0, 0, 0)
    driver_standing = driver['torso'].data.shape_keys.key_blocks['Standing feline waist'].value
    sleeping = state in ('curlUp', 'curlSleep', 'layDown', 'sleep', 'sleepy', 'restSleep', 'lieDown')
    settle = min(1, t/.78) if state in ('sleepy', 'lieDown') else t if state == 'curlUp' else 1
    settle = settle*settle*(3-2*settle) if sleeping else 0
    standing = 1 if jumping else 0 if state in ('sit', 'blinkSit', 'wash') or sleeping else 1
    seated = (1-standing)*(1-settle)
    bones = arm.data.bones
    # Share of reach kept before a limb draws in, for the deep bends of a
    # jump, a crawl under furniture and a cat packed into its box.
    gathered = .86 if jumping else .80 if state == 'crawl' else .86 if state.startswith('box') else 0
    # Sitting lowers the pelvis around the shoulders; normal idle is standing.
    eating_time = care_action_time(state, t)
    eating_lean = smooth_window(eating_time, .03, .90, .15) if state == 'eating' else 0
    origin = bones['pelvis'].head_local if state == 'eating' else (bones['L.forelegjoint0'].head_local+bones['R.forelegjoint0'].head_local)/2
    lean = .045 if state == 'trot' else .075+.025*math.sin(t*math.tau) if state == 'run' else 0
    if jumping:
        crouch, landing, lean, fore_lift, fore_reach, rear_lift, rear_reach, gather = jump_pose(state, t, effort)
        airborne = smooth_window(t,JUMP['takeoff'],JUMP['touchdown'],.10)
    rotation = Matrix.Rotation(-.55*seated+.24*eating_lean+lean, 3, 'X')
    baseline_body = idle_controls['standing_height'] if driver_standing else idle_controls['body_height']
    shift = Vector((driver['body'].location.x, 0, driver['body'].location.z-baseline_body))*.6
    shift.z -= .24*settle
    if jumping:
        # Wind up: sink and rock back onto the haunches before the push.
        shift.z += -(.07 if state == 'jumpOff' else .16)*crouch
        shift.y += .035*crouch
    if state.startswith('walk') or state in ('crawl', 'turn', 'trot', 'run', 'rubLeft', 'rubRight'):
        shift.z -= .045 if state.startswith('walk') or state in ('trot', 'run') else .07
    if state in ('trot','run'):
        # Leave enough bend for the hind paws at both stance extremes. The
        # forward lean otherwise raises the hips beyond their reachable length.
        shift.z -= .035 if state == 'trot' else .065
    if state == 'crawl':
        shift.z -= .20
    # A resting cat is never a statue: two slow breaths lift and fill the
    # chest, and the weight settles onto the other side before a paw lifts.
    resting = state in RESTING_STATES
    breath = .5-.5*math.cos(t*math.tau*2) if resting else 0
    if resting:
        shift.x -= .020*pulse(t, .56, .19)
        shift.z += .004*breath
    if acting:
        shift += Vector((acting.get('side', 0), acting.get('back', 0), acting.get('lift', 0)+acting.get('hop', 0)))
    body = Matrix.Translation(origin+shift) @ rotation.to_4x4() @ Matrix.Translation(-origin)
    # The shoulders and pelvis compress/extend in opposition once per running
    # stride. This owns the running silhouette; runtime spine offsets add
    # landing loads, without applying a second running pitch cycle.
    fore_body, hind_body = body, body
    if state == 'run':
        flex = math.cos((t-.65)*math.tau)
        def bend_at(name, angle):
            pivot = bones[name].head_local
            return body @ Matrix.Translation(pivot) @ Matrix.Rotation(angle, 4, 'X') @ Matrix.Translation(-pivot)
        # Gather during the suspended recovery; lengthen into the fore landing.
        # Translation brings the haunch under the back without moving the paws.
        fore_body = Matrix.Translation((0, .060*flex, -.015*flex)) @ bend_at('chest', .22*flex)
        hind_body = Matrix.Translation((0, -.075*flex, .015*flex)) @ bend_at('pelvis', -.26*flex)
        body = Matrix.Translation((0, 0, .045*flex+.020*flex*flex)) @ body
    if jumping:
        # The short torso bends through the gathering/impact, rather than
        # travelling as one rigid block. No axial twist or airborne yaw.
        def bend_jump(name, angle):
            pivot = bones[name].head_local
            return body @ Matrix.Translation(pivot) @ Matrix.Rotation(angle, 4, 'X') @ Matrix.Translation(-pivot)
        # Forelimbs receive the impact first. The pelvis follows after the
        # hind paws arrive, rather than both halves bouncing simultaneously.
        hind_impact = (0 if t <= JUMP['hindTouchdown'] else
                       math.sin(min(1,(t-JUMP['hindTouchdown'])/.07)*math.pi/2)
                       if t <= .89 else keyed(t, [(.89, 1), (1, 0)]))
        extension = keyed(t, [(0, 0), (.11, 0), (.23, 1), (.30, .65), (.42, 0), (1, 0)])
        hip_push = (0 if state == 'jumpOff' else .155)*extension*effort
        fore_body = Matrix.Translation((0, -.045*landing, -.18*landing)) @ bend_jump('chest', .055*gather+.045*landing)
        hind_body = Matrix.Translation((0, 0, hip_push-.10*crouch-.02*landing-.085*hind_impact*effort)) @ bend_jump('pelvis', -.09*gather-.04*crouch)
        # Blend the spine through the shoulder/hip absorption, keeping the
        # contact legs independent and the head quieter than the torso.
        body = Matrix.Translation((0, 0, hip_push*.4-.075*landing-.045*hind_impact*effort)) @ body
    stretch = keyed(t, [(0, 0), (.16, .12), (.40, 1), (.61, 1), (.84, .18), (1, 0)]) if state == 'wakeStretch' else 0
    if state == 'wakeStretch':
        # A compact waking bow: chest lowers below the hips, pads stay planted.
        # Absolute bone targets preserve the footprint on narrow seats.
        fore_body = Matrix.Translation((0, -.035*stretch, -.20*stretch)) @ body
        hind_body = Matrix.Translation((0, 0, -.015*stretch)) @ body
        body = Matrix.Translation((0, 0, -.045*stretch)) @ body
    if state in ('rubLeft', 'rubRight'):
        # Cheek leads the shoulder along the edge; feet keep their walking path.
        side = 1 if state == 'rubLeft' else -1
        pivot = bones['chest'].head_local
        brush = Matrix.Translation((side*.035, 0, -.025)) @ Matrix.Translation(pivot) @ Matrix.Rotation(side*-.105, 4, 'Y') @ Matrix.Translation(-pivot)
        fore_body = brush @ body
        hind_body = Matrix.Translation((side*.018, 0, 0)) @ body
        body = Matrix.Translation((side*.024, 0, -.012)) @ body
    bend = reaction or acting
    if bend:
        def reaction_bend(name, pitch, roll=0):
            pivot = bones[name].head_local
            return body @ Matrix.Translation(pivot) @ Matrix.Rotation(pitch, 4, 'X') @ Matrix.Rotation(roll, 4, 'Y') @ Matrix.Translation(-pivot)
        fore_body = reaction_bend('chest', bend.get('chest', 0), bend.get('roll', 0))
        hind_body = reaction_bend('pelvis', bend.get('hips', 0))
    if resting:
        fore_body = Matrix.Translation((0, 0, .007*breath)) @ fore_body
    desired = {name: body @ bones[name].matrix_local for name in ('spine', 'belly')}
    desired.update(chest=fore_body @ bones['chest'].matrix_local, pelvis=hind_body @ bones['pelvis'].matrix_local)
    if seated:
        # A seated rump spreads into one round mass on the support.
        desired['pelvis'] = desired['pelvis'] @ Matrix.Diagonal((1+.12*seated,)*3+(1,))
    if resting:
        # Uniform, so the neck and forelegs keep exact transforms beneath it.
        desired['chest'] = desired['chest'] @ Matrix.Diagonal((1+.022*breath,)*3+(1,))
    chest_shift = (fore_body @ bones['chest'].head_local)-bones['chest'].head_local
    head_shift = (driver['head'].location-idle_controls['head'])*.65
    if standing and state not in ('jumpOn', 'jumpOff', 'hop') and state not in PUZZLE_REACTIONS:
        head_shift = Vector((0, 0, (.004 if state in ('trot','run') else .002)*math.cos(t*math.tau*2)-(.025 if state=='run' else 0)-(.75*chest_shift.z if state in ('trot','run') else 0)-(.012*flex if state=='run' else 0)))
    head_rotation = driver['head'].rotation_euler.to_matrix()
    if resting:
        # Two held tilts with eased arrivals replace a continuous metronome
        # sway; the breath adds a barely visible nod.
        tilt = .075*smooth_window(t, .06, .44, .15)-.055*smooth_window(t, .56, .95, .15)
        head_rotation = (Matrix.Rotation(.45*tilt, 3, 'Z') @ Matrix.Rotation(tilt, 3, 'Y')
                         @ Matrix.Rotation((.10 if state == 'waiting' else 0)*-math.sin(math.pi*t)+.012*breath, 3, 'X'))
    if state in ('trot','run'):
        head_rotation = Matrix.Rotation(-lean*.65, 3, 'X')
    if jumping:
        # The head dips into the wind-up and nods through the landing, a beat
        # behind the shoulders, instead of riding level like a figurine.
        head_shift = Vector((0,-.045*airborne,-.035*crouch-.065*landing))
        # These are absolute bone targets: retain a quieter version of the
        # body's pitch, keeping the gaze toward the destination.
        head_rotation = Matrix.Rotation(lean*.35+.10*crouch+.12*landing,3,'X')
    if state == 'wakeStretch':
        # Let the chin follow the shoulder bow and recover slightly later.
        head_stretch = keyed(t, [(0, 0), (.22, .06), (.46, 1), (.64, 1), (.90, .12), (1, 0)])
        head_shift = Vector((0, -.035*head_stretch, -.10*head_stretch))
        head_rotation = Matrix.Rotation(.20*head_stretch, 3, 'X')
    if sleeping:
        # Rest the chin ahead of the chest instead of sinking the skull into it.
        head_shift += Vector((0, -.15, .06))*settle
    if state == 'crawl':
        head_shift.z -= .16
        head_rotation = Matrix.Rotation(.12, 3, 'X')
    if state == 'eating':
        # Bend the chest and neck toward the food while IK keeps all paws planted.
        munch = math.sin(eating_time*math.tau*5)*eating_lean
        head_shift = Vector((0, -.08*eating_lean, -.40*eating_lean+.012*munch))
        head_rotation = Matrix.Rotation(.72*eating_lean+.025*munch, 3, 'X')
    if state == 'wash':
        # A seated cat lifts one forepaw to its muzzle, then wipes across its
        # cheek. The other paw and both hind paws stay planted throughout.
        head_shift = Vector((.035*math.sin(t*math.tau), -.02, -.065))
        head_rotation = Matrix.Rotation(.12+.08*math.sin(t*math.tau), 3, 'X')
    if acting:
        head_shift = head_shift+Vector(acting.get('head', (0, 0, 0)))
        pitch, tilt, turn = acting.get('look', (0, 0, 0))
        head_rotation = (Matrix.Rotation(turn, 3, 'Z') @ Matrix.Rotation(tilt, 3, 'Y') @ Matrix.Rotation(pitch, 3, 'X')) @ head_rotation
    # The neck travels and turns half way between the chest and the skull.
    # Carrying it rigidly with the head put the whole bend into one crease
    # across the shoulders whenever the head dropped or turned.
    desired['head'] = joint_matrix(bones['head'], bones['head'].head_local+chest_shift+head_shift, head_rotation)
    neck_turn = fore_body.to_quaternion().slerp(head_rotation.to_quaternion(), .5)
    desired['neck'] = joint_matrix(bones['neck'], bones['neck'].head_local+chest_shift+head_shift*.5, neck_turn.to_matrix())
    for side, i in (('L', 0), ('R', 1)):
        for rear, key, label, paw in ((False, 'feet', 'foreleg', 'front.paw'), (True, 'back_feet', 'hindleg', 'rear.paw')):
            names = (side+'.'+label+'joint0', side+'.'+label+'joint1', side+'.'+paw)
            shoulder = (hind_body if rear else fore_body) @ bones[names[0]].head_local
            toe = bones[names[2]].head_local.copy()
            if seated:
                # Hind paws rest forward of the folded haunch, not hidden under
                # the hips. They keep the standing track width: a seat on a
                # narrow shelf has no room for a wider footprint.
                toe.y = toe.y*(1-seated)+(shoulder.y+(-.24 if rear else -.025))*seated
                if not rear:
                    # Forepaws close up side by side, as a sitting cat's do. The
                    # open gap between them showed the belly as a hanging wedge.
                    toe.x *= 1-.36*seated
            if settle:
                toe.y += -.08*settle if not rear else -.05*settle
            if state.startswith('walk') or state in ('crawl', 'turn', 'trot', 'run', 'rubLeft', 'rubRight'):
                baseline = Vector((driver[key][i].location.x, .44 if rear else -.38, .105 if rear else .12))
                delta = driver[key][i].location-baseline
            else:
                delta = driver[key][i].location-idle_controls[key][i]
            toe += delta
            if acting:
                if acting.get('plant'):
                    toe -= delta
                toe.z += acting.get('hop', 0)
                if acting.get('paws'):
                    toe += Vector(acting['paws'][(2 if rear else 0)+i])
            if jumping:
                toe += Vector((0,rear_reach if rear else fore_reach,rear_lift if rear else fore_lift))
                toe.x *= 1-(.36 if rear else .28)*gather
            if state == 'wash' and not rear and side == 'R':
                lift = smooth_window(t, .08, .88, .12)
                wipe = math.sin(t*math.tau*2)
                muzzle = bones['head'].head_local+chest_shift+head_shift
                target = muzzle+Vector((.17+.05*wipe, -.25, -.19+.09*wipe))
                toe = toe.lerp(target, lift)
            desired.update(limb_pose(bones, names, shoulder, toe, max(SEATED_HAUNCH*seated if rear else 0, .90*settle, gathered)))
            if state.startswith('walk') or state in ('trot', 'run'):
                # Let the airborne paw curl, then open before contact. The
                # driver already holds a level pad throughout the stance.
                desired[names[2]] = joint_matrix(bones[names[2]], desired[names[2]].translation,
                    driver[key][i].rotation_euler.to_matrix())
            if jumping:
                # Fold the wrists/hocks with the gathered legs. Unfold before
                # reaching so the pads are level for their existing contacts.
                fold = keyed(t, [(0, 0), (.24, 0), (.43, 1), (.62, 0), (1, 0)])
                desired[names[2]] = joint_matrix(bones[names[2]], desired[names[2]].translation,
                    Matrix.Rotation((.32 if rear else .46)*fold*effort, 3, 'X'))
            if reaction and not rear and side == 'R' and reaction['wrist']:
                desired[names[2]] = joint_matrix(bones[names[2]], desired[names[2]].translation, Matrix.Rotation(reaction['wrist'], 3, 'X'))
    # The upright hooked tail follows the pelvis.
    # Let the tail trail the launch, then recover after the shoulders. Its
    # distal curl follows later, avoiding a rigid upright silhouette in flight.
    tail_trail = keyed(t, [(0, 0), (.12, -.08), (.35, -.52), (.62, -.38), (.82, -.17), (1, 0)]) if jumping else 0
    tail_rotation = Matrix.Rotation(tail_trail*effort, 3, 'X') if jumping else driver['tail'].rotation_euler.to_matrix()
    if resting:
        # The travelling wave carries the sway; keep only a hint of the twist.
        sway = driver['tail'].rotation_euler
        tail_rotation = Matrix.Rotation(.35*sway.z, 3, 'Z') @ Matrix.Rotation(.5*sway.x, 3, 'X')
    if state in ('curlUp', 'curlSleep'):
        # Fold the upright tail forward alongside the resting body. The driver
        # curls a curve, but this exported rig needs the same motion in bones.
        tail_rotation = Matrix.Rotation(-.65*settle, 3, 'Z') @ Matrix.Rotation(1.60*settle, 3, 'X') @ tail_rotation
    if state == 'crawl':
        tail_rotation = Matrix.Rotation(-1.0, 3, 'X') @ tail_rotation
    if state == 'wakeStretch':
        tail_rotation = Matrix.Rotation(-.12*stretch, 3, 'X') @ tail_rotation
    if acting and acting.get('tail'):
        tail_rotation = Matrix.Identity(3)
    anchor = bones['tailjoint0'].head_local
    tail_transform = hind_body @ Matrix.Translation(anchor) @ tail_rotation.to_4x4() @ Matrix.Translation(-anchor)
    wave, chain, chains = tail_wave(state, t), Matrix.Identity(4), {}
    if acting and acting.get('tail'):
        wave = acting['tail']
    if wave and abs(wave[0][0]) > TAIL_ROOT_LIMIT:
        # The root can only turn so far before the rump creases above it.
        # Whatever a pose asks beyond that is passed up the tail instead.
        wave = [tuple(joint) for joint in wave]
        excess = wave[0][0]-math.copysign(TAIL_ROOT_LIMIT, wave[0][0])
        wave[0] = (wave[0][0]-excess, wave[0][1])
        wave[1] = (wave[1][0]+.6*excess, wave[1][1])
        wave[2] = (wave[2][0]+.4*excess, wave[2][1])
    for i, name in enumerate([*('tailjoint'+str(i) for i in range(4)), 'tailTip']):
        if wave and i < 4:
            pivot = bones[name].head_local
            chain = chain @ Matrix.Translation(pivot) @ Matrix.Rotation(wave[i][0], 4, 'X') @ Matrix.Rotation(wave[i][1], 4, 'Y') @ Matrix.Translation(-pivot)
        chains[name] = chain
        desired[name] = tail_transform @ chain @ bones[name].matrix_local
    if jumping:
        tip_follow = keyed(t, [(0, 0), (.22, 0), (.48, -.18), (.72, -.12), (.90, .06), (1, 0)])
        pivot = bones['tailjoint2'].head_local
        follow = Matrix.Translation(pivot) @ Matrix.Rotation(tip_follow*effort, 4, 'X') @ Matrix.Translation(-pivot)
        for name in ('tailjoint2', 'tailjoint3', 'tailTip'):
            desired[name] = tail_transform @ chains[name] @ follow @ bones[name].matrix_local
    if reaction:
        pivot = bones['tailjoint2'].head_local
        follow = Matrix.Translation(pivot) @ Matrix.Rotation(reaction['tail_tip'], 4, 'Y') @ Matrix.Translation(-pivot)
        for name in ('tailjoint2','tailjoint3','tailTip'):
            desired[name] = tail_transform @ chains[name] @ follow @ bones[name].matrix_local
    head_motion = desired['head'] @ bones['head'].matrix_local.inverted()
    for side in ('L', 'R'):
        name = 'ear.'+side
        # Sleep relaxes outward, flight tucks back; waking gently perks up.
        pitch = -.14*airborne if jumping else -.06*stretch if state == 'wakeStretch' else -.035*settle
        spread = (.10 if side == 'L' else -.10)*settle
        if acting and acting.get('ears'):
            pitch += acting['ears'][0 if side == 'L' else 1][0]
            spread += acting['ears'][0 if side == 'L' else 1][1]
        rotation = Matrix.Rotation(pitch, 3, 'X') @ Matrix.Rotation(spread, 3, 'Y')
        if state in PUZZLE_REACTIONS:
            rotation = driver['ears'][0 if side == 'L' else 1].rotation_euler.to_matrix()
        desired[name] = head_motion @ joint_matrix(bones[name], bones[name].head_local, rotation)
    eyelids = {}
    for side, i in (('L', 0), ('R', 1)):
        opening = driver['eyes'][i].scale.z/.105
        if acting:
            opening *= acting.get('squint', 1)
        blink = max(0 if reaction else .045, min(1.25 if reaction or acting else 1, opening))
        # One clean curve stands in for a closed eye: the smiling crescent,
        # or the same crescent turned over for a blink. The eye itself is
        # gone by then; a flattened disc still showed as a sliver from above.
        smiling = min(1, driver['happy_lids'][i].scale.x)
        shut = (1-smiling)*smooth_window(1-min(1, opening), .70, 2, .26)
        blink *= 1-smiling
        across = (1-smiling)*(1-shut)
        eyelids['lid.'+side] = (smiling, shut)
        for suffix in ('', '.glint'):
            name = 'eye.'+side+suffix
            center = bones[name].head_local
            close = Matrix.Translation(center) @ Matrix.Diagonal((across, across, blink, 1)) @ Matrix.Translation(-center)
            if reaction:
                gaze = reaction['gaze']
                close = Matrix.Translation((gaze[0],0,gaze[1])) @ close
            desired[name] = head_motion @ close @ bones[name].matrix_local
    visibility = {'mouth.open': driver['mouth'].scale.x, 'mouth.smile': driver['smile'].scale.x,
                  'mouth.frown': driver['frown'].scale.x,
                  **{'lid.'+side: driver['happy_lids'][i].scale.x for side, i in (('L', 0), ('R', 1))}}
    for name in bones.keys():
        if name.startswith(('whisker.', 'brow.')) or name in ('nose', 'mouth.stem') or name in visibility:
            center = bones[name].head_local
            visible = visibility.get(name, 1)
            local = Matrix.Translation(center) @ Matrix.Diagonal((visible, visible, visible, 1)) @ Matrix.Translation(-center)
            if name in eyelids:
                smiling, shut = eyelids[name]
                out = (bones[name].tail_local-bones[name].head_local).normalized()
                turned = Matrix.Rotation(math.pi, 4, out) if shut > smiling else Matrix.Identity(4)
                shown = max(smiling, shut)
                local = Matrix.Translation(center) @ turned @ Matrix.Diagonal((shown, shown, shown, 1)) @ Matrix.Translation(-center)
            if acting and acting.get('brows') and name.startswith('brow.'):
                lift, slant = acting['brows'][0 if name.endswith('L') else 1]
                local = Matrix.Translation((0, 0, lift)) @ Matrix.Translation(center) @ Matrix.Rotation(slant, 4, 'Y') @ Matrix.Translation(-center)
            if state in PUZZLE_REACTIONS and name.startswith('brow.'):
                brow = driver['brows'][0 if name.endswith('L') else 1]
                local = Matrix.Translation((0,0,brow.location.z-.235)) @ Matrix.Translation(center) @ brow.rotation_euler.to_matrix().to_4x4() @ Matrix.Translation(-center)
            if reaction and name.startswith('whisker.'):
                spread = reaction['whiskers'] * (-1 if '.L.' in name else 1)
                local = Matrix.Translation(center) @ Matrix.Rotation(spread,4,'Y') @ Matrix.Translation(-center)
            desired[name] = head_motion @ local @ bones[name].matrix_local
    return desired


def export_cats(scope, args, export):
    clips = {**__import__('json').loads((ROOT/'scripts/3d/clips.json').read_text()), **{name: spec['clip'] for name, spec in GAITS.items() if 'clip' in spec}}
    skins = [a.split('=', 1)[1] for a in args if a.startswith('--skin=')] or ('orange', 'grey', 'white')
    for skin in skins:
        scope['MATS'].clear()
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        scene = scope['setup'](256)
        driver = create_controls(skin)
        pose_controls(driver, 'idle', 0)
        idle_controls = {'head': driver['head'].location.copy(), 'body_height': driver['body'].location.z,
                         **{key: [o.location.copy() for o in driver[key]] for key in ('feet', 'back_feet')}}
        pose_controls(driver, 'walk', 0)
        idle_controls['standing_height'] = driver['body'].location.z
        driver_objects = set(scene.objects)
        groups, categories = {}, {}
        for state in ('eating', 'box1', 'ballToss', 'yarnRoll', 'featherChase'):
            before = set(scene.objects)
            groups[state] = scope['care_props'](state) if state in ('eating', 'box1') else scope['play_props'](state)
            for obj in set(scene.objects)-before:
                categories[obj] = state
        arm, mesh = load_cat(skin)
        face = add_face(arm, mesh)
        bpy.context.view_layer.update()
        exports, bindings = [mesh, *face], {}
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode='EDIT')
        for i, (obj, category) in enumerate(categories.items()):
            if obj.type not in ('MESH', 'CURVE'):
                continue
            name = 'prop'+str(i)
            bone = arm.data.edit_bones.new(name)
            bone.head = obj.matrix_world.translation
            bone.tail = bone.head+Vector((0, 0, .08))
            bindings[name] = (obj, obj.matrix_world.copy(), category)
        bpy.ops.object.mode_set(mode='OBJECT')
        for name, (obj, bind, _) in bindings.items():
            data = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
            data.transform(bind)
            out = bpy.data.objects.new(obj.name+' Game prop', data)
            bpy.context.collection.objects.link(out)
            out.vertex_groups.new(name=name).add(list(range(len(data.vertices))), 1, 'REPLACE')
            out.modifiers.new('Prop animation', 'ARMATURE').object = arm
            out.parent = arm
            exports.append(out)
        arm.animation_data_create()
        # Denser keys keep planted toes from dipping between large knee/hip
        # rotations when glTF interpolates the baked bone quaternions.
        scene.render.fps = 60
        for clip, (count, fps) in clips.items():
            frames = round(count/fps*scene.render.fps)
            action = bpy.data.actions.new(clip)
            arm.animation_data.action = action
            for frame in range(frames+1):
                t = frame/frames
                driver['boxed'] = clip.startswith('box')
                desired = pose(arm, driver, 'walk' if clip.startswith('walk') else clip, t, idle_controls)
                if clip == 'eating' or clip.startswith('box'):
                    scope['pose_care_props'](*groups['eating' if clip == 'eating' else 'box1'], clip, t)
                elif clip in ('ballToss', 'yarnRoll', 'featherChase'):
                    scope['pose_play_props'](groups[clip], clip, t)
                bpy.context.view_layer.update()
                for name, (obj, bind, category) in bindings.items():
                    visible = category == clip or category == 'box1' and clip.startswith('box')
                    motion = obj.matrix_world @ bind.inverted_safe() if visible else Matrix.Diagonal((0, 0, 0, 1))
                    desired[name] = motion @ arm.data.bones[name].matrix_local
                for bone in arm.pose.bones:
                    parent = bone.parent
                    bone.matrix_basis = bone.bone.convert_local_to_pose(desired[bone.name], bone.bone.matrix_local,
                        parent_matrix=desired[parent.name] if parent else Matrix.Identity(4),
                        parent_matrix_local=parent.bone.matrix_local if parent else Matrix.Identity(4), invert=True)
                    bone.rotation_mode = 'QUATERNION'
                    for prop in ('location', 'rotation_quaternion', 'scale'):
                        bone.keyframe_insert(data_path=prop, frame=frame+1)
            track = arm.animation_data.nla_tracks.new()
            track.name = clip
            track.strips.new(clip, 1, action)
            arm.animation_data.action = None
        for bone in arm.pose.bones:
            bone.matrix_basis = Matrix.Identity(4)
        scene.frame_start, scene.frame_end = 1, round(max(count/fps for count, fps in clips.values())*scene.render.fps)+1
        # Authoring controls are never exported or visible in the saved rig.
        for obj in driver_objects | set(categories):
            if obj.type not in ('CAMERA', 'LIGHT'):
                bpy.data.objects.remove(obj, do_unlink=True)
        scene.frame_set(1)
        bpy.context.view_layer.update()
        # Reload the finished scene before glTF gathers its nodes. Library-loaded
        # objects otherwise retain stale dependency-graph selection in Blender.
        editable = ROOT/'prototypes/cat-model/cat-orange.blend' if skin == 'orange' else Path('/tmp')/('brainpet-cat-'+skin+'.blend')
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(editable), compress=True)
        bpy.ops.wm.open_mainfile(filepath=str(editable))
        scene = bpy.context.scene
        arm = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
        exports = [obj for obj in scene.objects if obj.type == 'MESH']
        export(ROOT/'assets/3d/native'/('cat-'+skin+'.glb'), [arm, *exports], True)
        for track in arm.animation_data.nla_tracks:
            track.mute = track.name != 'idle'
        scene.frame_set(1)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(editable), compress=True)
        print('GAME_CAT', skin, len(arm.data.bones), len(clips), flush=True)
