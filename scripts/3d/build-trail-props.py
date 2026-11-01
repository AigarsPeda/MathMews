"""Shared craft geometry and the live trail finish marker.

Blender --background --threads 4 --python-exit-code 1 --python scripts/3d/build-trail-props.py
The twenty-asset collections import the yarn, pencil and fraction geometry.
"""
import math
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'prototypes/trail-props'
RENDERS = SOURCE / 'renders'
RENDERS.mkdir(parents=True, exist_ok=True)


def material(name, color, roughness=.92, wood=False, fabric=False):
    rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Specular IOR Level'].default_value = .14
    if wood:
        tex = nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = 3
        tex.inputs['Detail'].default_value = 2
        coordinates = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeVectorMath'); mapping.operation = 'MULTIPLY'
        mapping.inputs[1].default_value = (2, 28, 3)
        mat.node_tree.links.new(coordinates.outputs['Generated'], mapping.inputs[0])
        mat.node_tree.links.new(mapping.outputs[0], tex.inputs['Vector'])
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*[v * .85 for v in linear], 1)
        ramp.color_ramp.elements[1].color = (*[min(1, v * 1.08) for v in linear], 1)
        mat.node_tree.links.new(tex.outputs['Fac'], ramp.inputs[0])
        mat.node_tree.links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .24
        bump.inputs['Distance'].default_value = .012
        mat.node_tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs[0], bsdf.inputs['Normal'])
    if fabric:
        tex = nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value = 155
        tex.inputs['Detail'].default_value = 3
        bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .38
        bump.inputs['Distance'].default_value = .016
        mat.node_tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs[0], bsdf.inputs['Normal'])
        bsdf.inputs['Sheen Weight'].default_value = .24
    return mat


def curve(name, points, radius, mat):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'; data.bevel_depth = radius; data.bevel_resolution = 3
    spline = data.splines.new('POLY'); spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def rope(name, points, mats, thickness=.025):
    """Two softly twisted plies, with a continuous cord silhouette."""
    curve(name+' soft wool center', points, thickness * .60, mats[0])
    length = 0
    strands = [[], []]
    for i, point in enumerate(points):
        p = Vector(point)
        tangent = (Vector(points[min(i+1, len(points)-1)]) - Vector(points[max(0, i-1)])).normalized()
        normal = tangent.cross(Vector((0, 0, 1)))
        if normal.length < .05:
            normal = tangent.cross(Vector((0, 1, 0)))
        normal.normalize(); binormal = tangent.cross(normal).normalized()
        if i:
            length += (p - Vector(points[i-1])).length
        for strand in range(2):
            angle = length * 10 + strand * math.pi
            strands[strand].append(p + thickness * .36 * (normal * math.cos(angle) + binormal * math.sin(angle)))
    for strand, coords in enumerate(strands):
        curve(f'{name} / ply {strand+1}', coords, thickness * .64, mats[strand % len(mats)])


def yarn():
    mats = [material('Lavender wool ' + str(i), color, .98, fabric=True) for i, color in enumerate(['B99CD4', 'C2A6DD', 'B192CF'])]
    center = Vector((-.20, .05, .95))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=.78, location=center)
    core = bpy.context.object; core.name = 'Wool core'; core.data.materials.append(mats[0])
    for face in core.data.polygons: face.use_smooth = True
    # A wound foundation covers the entire core, including the gaps between crossing bundles.
    foundation = []
    for i in range(9001):
        latitude = -math.pi/2 + .025 + (math.pi - .05) * i / 9000
        angle = math.tau * 34 * i / 9000
        foundation.append(center + Vector((.792 * math.cos(latitude) * math.cos(angle),
                                           .792 * math.cos(latitude) * math.sin(angle), .792 * math.sin(latitude))))
    rope('Continuous wound foundation', foundation, mats, .035)
    normals = [(0,0,1), (.4,1,.4), (1,-.2,.6), (1,.4,0), (-.4,.44,.7), (1,.4,.05)]
    for band, axis in enumerate(normals):
        rotation = (Quaternion(Vector((3,-6.5,5.8)).normalized(), .55) @ Vector(axis)).to_track_quat('Z','Y').to_matrix()
        radius = .65 + band * .055
        for strand in range(5):
            offset = (strand - 2) * .145
            circle_radius = math.sqrt(radius * radius - offset * offset)
            points = []
            for step in range(481):
                angle = math.tau * step / 480
                wobble = .009 * math.sin(7*angle + band*1.7 + strand) + .005 * math.sin(13*angle + strand)
                points.append(center + rotation @ Vector(((circle_radius+wobble) * math.cos(angle), (circle_radius+wobble) * math.sin(angle), offset + .008*math.sin(5*angle+band))))
            before = set(bpy.context.scene.objects)
            rope(f'Winding {band+1}.{strand+1}', points, mats, .084)
            # Wool compresses where bundles cross. Flatten each cord radially so
            # successive wraps sit on top of one another instead of intersecting.
            for obj in set(bpy.context.scene.objects) - before:
                bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
                bpy.ops.object.convert(target='MESH')
                for vertex in obj.data.vertices:
                    direction = vertex.co - center
                    vertex.co = center + direction.normalized() * (radius + (direction.length - radius) * .32)
                for face in obj.data.polygons: face.use_smooth = True
    # The final loose crossing is the recognisable hand-wound diagonal in the reference.
    axis = Quaternion(Vector((3,-6.5,5.8)).normalized(), .55) @ Vector((-.4,.44,.7))
    rotation = axis.to_track_quat('Z','Y').to_matrix()
    before = set(bpy.context.scene.objects)
    points = [center + rotation @ Vector((.98*math.cos(math.tau*i/480), .98*math.sin(math.tau*i/480), 0)) for i in range(481)]
    rope('Final diagonal wrap', points, mats, .084)
    for obj in set(bpy.context.scene.objects) - before:
        bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        for vertex in obj.data.vertices:
            direction = vertex.co-center
            vertex.co = center+direction.normalized()*(.98+(direction.length-.98)*.32)
        for face in obj.data.polygons: face.use_smooth = True
    # Wound wool settles into a slightly squat ball rather than an upright oval.
    for obj in bpy.context.scene.objects:
        obj.scale.z *= .88
        obj.location.z *= .88
    # Loose end settles into one generous loop beside the ball.
    control = [Vector(v) for v in [(-.58, -.25, .52), (-.80, -.30, .06), (-.45, -.60, .035),
                                  (.65, -.12, .035), (1.04, .50, .035), (.66, .82, .035), (.25, .60, .09)]]
    points = []
    padded = [control[0], *control, control[-1]]
    for j in range(1, len(padded)-2):
        a, b, c, d = padded[j-1:j+3]
        for k in range(60):
            t = k / 60
            p = .5 * ((2*b) + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t)
            p.z = max(.035, p.z)
            points.append(p)
    rope('Loose wool loop', points, mats, .070)


def rounded_cube(name, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=size)
    obj = bpy.context.object; obj.name = name; obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Generously rounded corners', 'BEVEL'); bevel.width = .11; bevel.segments = 8
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for face in obj.data.polygons: face.use_smooth = True
    return obj








def soft_box(name, location, size, mat, angle=0):
    obj = rounded_cube(name, 1, mat)
    obj.scale = size; obj.location = location; obj.rotation_euler.z = angle
    normals = obj.modifiers.new('Soft painted corners', 'WEIGHTED_NORMAL'); normals.keep_sharp = True
    return obj




def pencils():
    wood = material('Pencil exposed cedar', 'DBBD91', wood=True)
    colors = [material('Pencil paint '+str(i),c,wood=True) for i,c in enumerate(['C6AFD6','9CBFB0','E3B2AD'])]
    for j,angle in enumerate([-.17,.09,.27]):
        root = bpy.data.objects.new('Pencil placement',None); bpy.context.collection.objects.link(root)
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=.105, depth=1.28, location=(0,0,.82))
        body=bpy.context.object; body.name='Hexagonal painted pencil'; body.data.materials.append(colors[j]); body.parent=root
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=.105, radius2=0, depth=.30, location=(0,0,.03))
        tip=bpy.context.object; tip.rotation_euler.x=math.pi; tip.data.materials.append(wood); tip.parent=root
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=.030, radius2=0, depth=.09, location=(0,0,-.10))
        lead=bpy.context.object; lead.rotation_euler.x=math.pi; lead.data.materials.append(colors[j]); lead.parent=root
        root.rotation_euler=(math.pi/2,angle,.30+angle)
        root.location=(-.40+j*.31,.50+j*.08,.13)
    # A small, irregular paper scrap tucked beneath the drawing tools.
    paper=material('Warm drawing paper','F4E8CB',fabric=True)
    soft_box('Paper scrap',(.30,.16,.025),(.70,.83,.025),paper,-.18)










def soft_triangle(name, points, depth, mat):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(x,y,z) for x,y,z in points]+[(x,y+depth,z) for x,y,z in points],[],[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)]); mesh.update()
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj); obj.data.materials.append(mat)
    bevel=obj.modifiers.new('Soft hand cut corners','BEVEL'); bevel.width=.045; bevel.segments=4
    obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return obj
















def fractionpie():
    colors=['DDBB8B','C8AACD','A8BFA9','DBB2A7']
    for j,c in enumerate(colors):
        a0=j*math.pi/2+.035; a1=(j+1)*math.pi/2-.035
        offset=Vector((.18,.10,0)) if j==0 else Vector((0,0,0))
        points=[(0,0)]+[(.63*math.cos(a0+(a1-a0)*i/32),.63*math.sin(a0+(a1-a0)*i/32)) for i in range(33)]
        n=len(points); vertices=[tuple(Vector((x,y,z))+offset) for z in [.04,.17] for x,y in points]
        faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        mesh=bpy.data.meshes.new('Quarter piece'); mesh.from_pydata(vertices,[],faces); mesh.update()
        obj=bpy.data.objects.new('Painted wooden quarter',mesh); bpy.context.collection.objects.link(obj); obj.data.materials.append(material('Quarter paint '+str(j),c,wood=True))
        bevel=obj.modifiers.new('Worn round quarter edges','BEVEL'); bevel.width=.032; bevel.segments=4
        obj.modifiers.new('Weighted quarter normals','WEIGHTED_NORMAL')


def milestone():
    gold = material('Honey painted wood', 'F3C35E', wood=True)
    dark = material('Star amber', 'BD7C25')
    points = []
    for i in range(128):
        a = math.tau * i / 128
        r = .57 + .055 * math.cos(8*a)
        points.append((r*math.cos(a), r*math.sin(a)))
    n = len(points)
    vertices = [(x, y, z) for z in (0, .16) for x, y in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))] + [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    mesh = bpy.data.meshes.new('Scalloped rosette'); mesh.from_pydata(vertices, [], faces); mesh.update()
    obj = bpy.data.objects.new('Scalloped rosette', mesh); bpy.context.collection.objects.link(obj); obj.data.materials.append(gold)
    bevel = obj.modifiers.new('Soft rosette edges', 'BEVEL'); bevel.width = .065; bevel.segments = 5
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    # A contrasting five-point star face, without a font or an emoji.
    outline = [(math.cos(math.pi/2+i*math.pi/5) * (.29 if i%2 == 0 else .16),
                math.sin(math.pi/2+i*math.pi/5) * (.29 if i%2 == 0 else .16)) for i in range(10)]
    mesh = bpy.data.meshes.new('Star inset'); mesh.from_pydata([(x,y,.168) for x,y in outline], [], [tuple(range(10))]); mesh.update()
    star = bpy.data.objects.new('Amber star', mesh); bpy.context.collection.objects.link(star); star.data.materials.append(dark)
    solid = star.modifiers.new('Inset face', 'SOLIDIFY'); solid.thickness = .009
    bevel = star.modifiers.new('Soft star corners', 'BEVEL'); bevel.width = .025; bevel.segments = 3


def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()


def contact_shadow(name, scale, opacity, z, offset):
    """A soft studio contact shadow with transparent edges, authored in Blender.

    An infinite Cycles catcher baked a gray rectangle into the transparent sprite.
    This receiver fades to zero inside the image bounds instead.
    """
    bpy.ops.mesh.primitive_plane_add(size=2, location=(*offset, z))
    plane = bpy.context.object; plane.name = name; plane.scale = (*scale, 1)
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    nodes = mat.node_tree.nodes; nodes.clear(); links = mat.node_tree.links
    coord = nodes.new('ShaderNodeTexCoord')
    subtract = nodes.new('ShaderNodeVectorMath'); subtract.operation = 'SUBTRACT'; subtract.inputs[1].default_value = (.5,.5,0)
    links.new(coord.outputs['UV'], subtract.inputs[0])
    multiply = nodes.new('ShaderNodeVectorMath'); multiply.operation = 'SCALE'; multiply.inputs[3].default_value = 2
    links.new(subtract.outputs[0], multiply.inputs[0])
    length = nodes.new('ShaderNodeVectorMath'); length.operation = 'LENGTH'; links.new(multiply.outputs[0], length.inputs[0])
    inverse = nodes.new('ShaderNodeMath'); inverse.operation = 'SUBTRACT'; inverse.inputs[0].default_value = 1; inverse.use_clamp = True
    links.new(length.outputs['Value'], inverse.inputs[1])
    fade = nodes.new('ShaderNodeMath'); fade.operation = 'POWER'; fade.inputs[1].default_value = 1.5; links.new(inverse.outputs[0], fade.inputs[0])
    alpha = nodes.new('ShaderNodeMath'); alpha.operation = 'MULTIPLY'; alpha.inputs[1].default_value = opacity; links.new(fade.outputs[0], alpha.inputs[0])
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    dark = nodes.new('ShaderNodeEmission'); dark.inputs[0].default_value = (.08,.11,.09,1)
    mix = nodes.new('ShaderNodeMixShader'); links.new(alpha.outputs[0], mix.inputs[0]); links.new(transparent.outputs[0], mix.inputs[1]); links.new(dark.outputs[0], mix.inputs[2])
    output = nodes.new('ShaderNodeOutputMaterial'); links.new(mix.outputs[0], output.inputs['Surface'])
    plane.data.materials.append(mat)


def studio(name):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 64; scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 4
    scene.render.resolution_x = 768; scene.render.resolution_y = 768; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
    scene.world = bpy.data.worlds.new('Soft mint studio'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.85, .88, .84, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .32
    target = (0, 0, .05)
    bpy.ops.object.camera_add(location=(0, -2.7, 7))
    camera = bpy.context.object; camera.name = 'Approved trail preview camera'; camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 1.9
    scene.camera = camera; aim(camera, target)
    for label, loc, energy, size in [('Large softbox', (-3,-4,7), 330, 4), ('Gentle fill', (4,-1,4), 180, 3), ('Top rim', (1,4,6), 170, 3)]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        light = bpy.context.object; light.name = label; light.data.energy = energy; light.data.shape = 'DISK'; light.data.size = size; aim(light, target)
    broad_scale = (.70, .65)
    contact_shadow('Broad offset shadow', broad_scale, .68, -.018, (-.27,-.20))
    contact_shadow('Dark contact beneath prop', (.50,.44), .64, -.014, (-.02,-.08))
    scene.render.filepath = str(RENDERS / f'{name}.png')


if __name__ == '__main__':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    milestone(); studio('milestone')
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'milestone.blend'), compress=True)
    bpy.ops.render.render(write_still=True)
    print('TRAIL_PROP_DONE milestone', flush=True)
