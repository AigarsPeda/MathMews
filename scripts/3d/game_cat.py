"""Build the original cartoon cat and bake its game actions for mobile.

The mesh and skeleton share one rest pose. Two-segment IK keeps planted paws
at their targets while the body sits, walks or lands.
"""
from pathlib import Path
import math
import bpy
import numpy as np
from mathutils import Matrix, Vector
from cat_model import COATS, STRIPES, rgba, create_cat as create_controls, pose_cat as pose_controls, ball, line, solid_material, care_action_time, smooth_window

ROOT = Path(__file__).resolve().parents[2]
from original_cat import create_cat as create_original_cat


def load_cat(skin):
    arm, mesh = create_original_cat()
    recolor(mesh, skin)
    return arm, mesh


def coat_pixels(points, pink_mask, skin):
    """Paint continuous rest-space shapes, independently of mesh triangulation."""
    x, y, z = points.T
    def ramp(low, high, value):
        t = np.clip((value-low)/(high-low), 0, 1)
        return t*t*(3-2*t)
    head = ramp(1.05, 1.21, z)*(1-ramp(-.10, .12, y))
    underside = .60+.08*np.cos(y*3)
    belly = 1-ramp(underside, underside+.02, z)
    bib = (1-ramp(-.31, -.29, y))*(1-ramp(1.04, 1.06, z))
    chin = (1-ramp(1.14, 1.16, z))*(1-ramp(-.12, .10, y))
    blaze = (1-ramp(.065, .075, np.abs(x)))*head
    ivory = np.maximum.reduce((belly, bib, chin, blaze))
    left = 1-ramp(.98, 1.02, ((x+.24)/.20)**2+((z-1.31)/.23)**2)
    right = ramp(.09, .11, x)*head
    patch = np.maximum(left*head, right)*(1-ivory)
    # Tapered dorsal stripes stay separate from the face and cream underside.
    width = .012+.030*ramp(.82, 1.00, z)
    band = 1-ramp(width, width+.008, np.min(np.abs(y[:, None]-np.array([-.02, .19, .40])), axis=1))
    band *= ramp(.80, .84, z)*(1-head)
    tail_band = 1-ramp(.013, .021, np.min(np.abs(z[:, None]-np.array([1.13, 1.35, 1.57, 1.79])), axis=1))
    tail_band *= ramp(.49, .57, y)*ramp(1.05, 1.12, z)
    dark = np.maximum.reduce((patch, band, tail_band))*(1-ivory)
    coat, cream, stripe, pink = [np.array(rgba(c)[:3]) for c in (COATS[skin], 'FFF5E5', STRIPES[skin], 'EC9CAA')]
    color = coat[None, :]*((1-dark)*(1-ivory))[:, None]+stripe[None, :]*dark[:, None]+cream[None, :]*ivory[:, None]
    pink_amount = np.clip(pink_mask, 0, 1)
    color = color*(1-pink_amount[:, None])+pink*pink_amount[:, None]
    # Paint the collar on the neck skin so it follows seated deformation.
    collar_level = z-.20*(y+.50)
    collar_radius = (x/.29)**2+((y+.50)/.32)**2
    collar = ramp(.948, .952, collar_level)*(1-ramp(.969, .973, collar_level))*(1-ramp(1.10, 1.40, collar_radius))
    return color*(1-collar[:, None])+np.array(rgba('B8473C')[:3])*collar[:, None]


def recolor(mesh, skin):
    tint = mesh.vertex_groups.get('Ear insert tint')
    inserts = [float(tint is not None and any(g.group == tint.index and g.weight > .5
                    for g in mesh.data.vertices[loop.vertex_index].groups)) for loop in mesh.data.loops]
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
        colors = coat_pixels(points, weights @ np.array([inserts[i] for i in triangle.loops]), skin)
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
    mesh.data.materials.clear()
    mesh.data.materials.append(material)
    for polygon in mesh.data.polygons:
        polygon.use_smooth = True
        polygon.material_index = 0


def add_face(arm, mesh):
    """Attach the simple reference-style face and collar to anatomical joints."""
    eye = solid_material('Soft charcoal eyes', '24252A', .38)
    sparkle = solid_material('Eye catchlights', 'FFFCF6', .30)
    objects = {}
    for side in (-1, 1):
        label = 'L' if side < 0 else 'R'
        x = side*.225
        name = 'eye.'+label
        objects[name] = ball(name, (x, -.954, 1.30), (.041, .022, .050), eye, None)
        objects[name+'.glint'] = ball(name+'.glint', (x-.01, -.975, 1.316), (.005, .004, .006), sparkle, None)
        objects['lid.'+label] = line('Happy crescent eyelid '+label,
            [(x-.033, -.972, 1.29), (x, -.978, 1.313), (x+.033, -.972, 1.29)], .0045, eye, None)
        objects['brow.'+label] = line('Soft eyebrow '+label,
            [(x-.030, -.944, 1.40), (x, -.955, 1.410), (x+.030, -.944, 1.40)], .005, eye, None)
        for index, rise in enumerate((.029, 0, -.029)):
            objects[f'whisker.{label}.{index}'] = line('Whisker '+label+str(index),
                [(side*.105, -.98, 1.20), (side*.26, -.982, 1.20+rise*.5), (side*.43, -.94, 1.20+rise)], .0025, eye, None)
    objects['nose'] = ball('Small cat nose', (0, -.989, 1.223), (.038, .021, .018), eye, None)
    objects['mouth.stem'] = line('Muzzle center', [(0, -.99, 1.216), (0, -.995, 1.173)], .004, eye, None)
    objects['mouth.smile'] = line('Content cat smile', [(-.075, -.981, 1.178), (-.039, -.993, 1.160), (0, -.995, 1.173), (.039, -.993, 1.160), (.075, -.981, 1.178)], .004, eye, None)
    objects['mouth.frown'] = line('Gentle frown', [(-.052, -.985, 1.159), (0, -.995, 1.180), (.052, -.985, 1.159)], .004, eye, None)
    objects['mouth.open'] = ball('Soft open smile', (0, -.990, 1.157), (.030, .014, .023), eye, None)
    gold = solid_material('Small gold bell', 'E6AE51', .40)
    attachment = min(mesh.data.vertices, key=lambda v: (v.co-Vector((0, -.72, .925))).length_squared)
    objects['bell'] = ball('Small collar bell', attachment.co+Vector((0, -.025, -.022)), (.023, .023, .027), gold, None)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, obj in objects.items():
        if name == 'bell':
            continue
        bone = arm.data.edit_bones.new(name)
        center = obj.location if obj.type == 'MESH' else arm.data.edit_bones['head'].head.copy()
        bone.head, bone.tail = center, center+Vector((0, 0, .05))
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
        if name == 'bell':
            # Follow the same skin weights as the attachment point, so the
            # bell remains on the neck during both standing and sleep poses.
            for group in attachment.groups:
                joint = mesh.vertex_groups[group.group].name
                if joint in arm.data.bones:
                    obj.vertex_groups.new(name=joint).add(list(range(len(obj.data.vertices))), group.weight, 'REPLACE')
        else:
            obj.vertex_groups.new(name=name).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        obj.modifiers.new('Head attachment', 'ARMATURE').object = arm
        obj.parent = arm
    return list(objects.values())


def joint_matrix(bone, position, rotation=None):
    rotation = rotation or Matrix.Identity(3)
    return Matrix.Translation(position) @ rotation.to_4x4() @ bone.matrix_local.to_3x3().to_4x4()


def limb_pose(bones, names, shoulder, toe):
    a, b, c = [bones[name].head_local for name in names]
    upper, lower = (b-a).length, (c-b).length
    direction = toe-shoulder
    distance = max(.001, min(direction.length, upper+lower-.0001))
    direction.normalize()
    along = (upper*upper-lower*lower+distance*distance)/(2*distance)
    # Stable anatomical poles keep elbows bending back and rear knees forward.
    # Inferring a pole from an almost straight leg can flip during a stride.
    bend = Vector((0, -1 if 'hindleg' in names[0] else 1, 0))
    bend -= direction*bend.dot(direction)
    if bend.length < .001:
        bend = Vector((1, 0, 0))
    elbow = shoulder+direction*along+bend.normalized()*math.sqrt(max(0, upper*upper-along*along))
    toe = shoulder+direction*distance
    rotations = [(b-a).rotation_difference(elbow-shoulder).to_matrix(),
                 (c-b).rotation_difference(toe-elbow).to_matrix(), Matrix.Identity(3)]
    return {name: joint_matrix(bones[name], position, rotation)
            for name, position, rotation in zip(names, (shoulder, elbow, toe), rotations)}


def pose(arm, driver, state, t, idle_controls):
    pose_controls(driver, 'idle' if state == 'sit' else state, t)
    driver['root'].rotation_euler = (0, 0, 0)
    driver_standing = driver['torso'].data.shape_keys.key_blocks['Standing feline waist'].value
    sleeping = state in ('curlUp', 'curlSleep', 'layDown', 'sleep', 'sleepy', 'restSleep', 'lieDown')
    settle = min(1, t/.78) if state in ('sleepy', 'lieDown') else t if state == 'curlUp' else 1
    settle = settle*settle*(3-2*settle) if sleeping else 0
    standing = driver_standing if state in ('jumpOn', 'jumpOff') else 0 if state in ('sit', 'wash') or sleeping else 1
    seated = (1-standing)*(1-settle)
    bones = arm.data.bones
    # Sitting lowers the pelvis around the shoulders; normal idle is standing.
    eating_time = care_action_time(state, t)
    eating_lean = smooth_window(eating_time, .03, .90, .15) if state == 'eating' else 0
    origin = bones['pelvis'].head_local if state == 'eating' else (bones['L.forelegjoint0'].head_local+bones['R.forelegjoint0'].head_local)/2
    rotation = Matrix.Rotation(-.52*seated+.24*eating_lean, 3, 'X')
    baseline_body = idle_controls['standing_height'] if driver_standing else idle_controls['body_height']
    shift = Vector((driver['body'].location.x, 0, driver['body'].location.z-baseline_body))*.6
    shift.z -= .24*settle
    if state.startswith('walk'):
        shift.z -= .07
    body = Matrix.Translation(origin+shift) @ rotation.to_4x4() @ Matrix.Translation(-origin)
    desired = {name: body @ bones[name].matrix_local for name in ('spine', 'belly', 'chest', 'pelvis')}
    chest_shift = (body @ bones['chest'].head_local)-bones['chest'].head_local
    head_shift = (driver['head'].location-idle_controls['head'])*.65
    if standing:
        head_shift = Vector((0, 0, .002*math.cos(t*math.tau*2)))
    head_rotation = driver['head'].rotation_euler.to_matrix()
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
    for name in ('neck', 'head'):
        position = bones[name].head_local+chest_shift+head_shift
        desired[name] = joint_matrix(bones[name], position, head_rotation)
    for side, i in (('L', 0), ('R', 1)):
        for rear, key, label, paw in ((False, 'feet', 'foreleg', 'front.paw'), (True, 'back_feet', 'hindleg', 'rear.paw')):
            names = (side+'.'+label+'joint0', side+'.'+label+'joint1', side+'.'+paw)
            shoulder = body @ bones[names[0]].head_local
            toe = bones[names[2]].head_local.copy()
            if seated:
                toe.y = toe.y*(1-seated)+(shoulder.y+(-.04 if rear else -.025))*seated
            if settle:
                toe.y += -.08*settle if not rear else -.05*settle
            if state.startswith('walk'):
                baseline = Vector((driver[key][i].location.x, .44 if rear else -.38, .105 if rear else .12))
                delta = driver[key][i].location-baseline
            else:
                delta = driver[key][i].location-idle_controls[key][i]
            toe += delta
            if state == 'wash' and not rear and side == 'R':
                lift = smooth_window(t, .08, .88, .12)
                wipe = math.sin(t*math.tau*2)
                muzzle = bones['head'].head_local+chest_shift+head_shift
                target = muzzle+Vector((.17+.05*wipe, -.25, -.19+.09*wipe))
                toe = toe.lerp(target, lift)
            desired.update(limb_pose(bones, names, shoulder, toe))
    # The upright hooked tail follows the pelvis.
    tail_rotation = driver['tail'].rotation_euler.to_matrix()
    anchor = bones['tailjoint0'].head_local
    tail_transform = body @ Matrix.Translation(anchor) @ tail_rotation.to_4x4() @ Matrix.Translation(-anchor)
    for name in [*('tailjoint'+str(i) for i in range(4)), 'tailTip']:
        desired[name] = tail_transform @ bones[name].matrix_local
    head_motion = desired['head'] @ bones['head'].matrix_local.inverted()
    for side, i in (('L', 0), ('R', 1)):
        blink = max(.045, min(1, driver['eyes'][i].scale.z/.105))
        for suffix in ('', '.glint'):
            name = 'eye.'+side+suffix
            center = bones[name].head_local
            close = Matrix.Translation(center) @ Matrix.Diagonal((1, 1, blink, 1)) @ Matrix.Translation(-center)
            desired[name] = head_motion @ close @ bones[name].matrix_local
    visibility = {'mouth.open': driver['mouth'].scale.x, 'mouth.smile': driver['smile'].scale.x,
                  'mouth.frown': driver['frown'].scale.x,
                  **{'lid.'+side: driver['happy_lids'][i].scale.x for side, i in (('L', 0), ('R', 1))}}
    for name in bones.keys():
        if name.startswith(('whisker.', 'brow.')) or name in ('nose', 'mouth.stem') or name in visibility:
            center = bones[name].head_local
            visible = visibility.get(name, 1)
            local = Matrix.Translation(center) @ Matrix.Diagonal((visible, visible, visible, 1)) @ Matrix.Translation(-center)
            desired[name] = head_motion @ local @ bones[name].matrix_local
    return desired


def export_cats(scope, args, export):
    clips = __import__('json').loads((ROOT/'scripts/3d/clips.json').read_text())
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
        scene.render.fps = 24
        for clip, (count, fps) in clips.items():
            frames = round(count/fps*24)
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
        scene.frame_start, scene.frame_end = 1, 121
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
