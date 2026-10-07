"""Render a review-only icon set using Math Mews materials and room geometry.

Blender --background --python scripts/3d/render_icon_study.py
Outputs transparent PNGs and one editable scene per icon in a shared .blend.
"""
import bpy
import math
import os
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get('BRAINPET_ICON_OUTPUT', ROOT / 'docs/art/icon-study'))
OUT.mkdir(parents=True, exist_ok=True)
os.environ['BRAINPET_BLENDER_ASSET_DIR'] = str(OUT / 'source')
sys.path.insert(0, str(ROOT / 'scripts/3d'))
import render_assets as art

# UI symbols need level axes and a readable face at small sizes.
FRONT_ICONS = {
    'paw', 'settings', 'sleep', 'puzzles', 'heart', 'broken-heart', 'brain', 'lightbulb',
    'coin', 'flame', 'sparkle', 'film', 'lock', 'search', 'zoom-in', 'zoom-out',
    'check', 'warning', 'rotate', 'undo', 'restore', 'save', 'pause', 'video-play',
    'power', 'addition', 'subtraction', 'multiplication', 'division', 'equality',
    'patterns', 'fractions', 'operations',
    'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
    'chevron-up', 'chevron-down', 'chevron-right',
}


def frame_icon(scene, front=False):
    # Curve bounding boxes include unused control-point space. Frame the actual
    # evaluated surface so yarn and the other icons share the same optical size.
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in scene.objects:
        if obj.type not in {'MESH', 'CURVE', 'FONT'}:
            continue
        evaluated = obj.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    center = Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)))
    direction = (0, -9, 0) if front else art.ROOM_VIEW_DIRECTION
    scene.camera.location = center + Vector(direction)
    scene.camera.name = 'Front-facing icon camera' if front else 'Isometric object camera'
    scene['icon_view'] = 'front' if front else 'isometric'
    art.aim(scene.camera, center)
    bpy.context.view_layer.update()
    inverse = scene.camera.matrix_world.inverted()
    projected = [inverse @ point for point in points]
    min_x, max_x = min(p.x for p in projected), max(p.x for p in projected)
    min_y, max_y = min(p.y for p in projected), max(p.y for p in projected)
    shift = scene.camera.rotation_euler.to_matrix() @ Vector(((min_x+max_x)/2, (min_y+max_y)/2, 0))
    scene.camera.location += shift
    scene.camera.data.ortho_scale = max(max_x-min_x, max_y-min_y)*1.22


def extruded_shape(name, points, color, depth=.18, position=(0, 0, 0)):
    count = len(points)
    vertices = [(x, y, z) for y in [-depth/2, depth/2] for x, z in points]
    faces = [tuple(range(count-1, -1, -1)), tuple(range(count, count*2))]
    faces += [(i, (i+1) % count, (i+1) % count+count, i+count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    art.finish(obj, name, color)
    bevel = obj.modifiers.new('Soft sculpted edges', 'BEVEL')
    bevel.width = .055
    bevel.segments = 4
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def paw():
    art.sphere('Main paw pad', (0, 0, .44), (.46, .20, .34), 'orange')
    for x, z, rotation in [(-.52, .82, -.25), (-.20, 1.12, -.1), (.20, 1.12, .1), (.52, .82, .25)]:
        toe = art.sphere('Rounded toe', (x, 0, z), (.20, .18, .27), 'orange')
        toe.rotation_euler.y = rotation
        pad = art.sphere('Pink toe bean', (x, -.145, z), (.125, .045, .16), 'pink')
        pad.rotation_euler.y = rotation
    art.sphere('Central bean', (0, -.19, .47), (.27, .055, .21), 'pink')


def feed():
    art.cylinder('Pet bowl body', (0, 0, .28), .70, .39, 'teal')
    art.torus('Soft bowl rim', (0, 0, .50), .60, .095, 'teal')
    art.cylinder('Food in bowl', (0, 0, .49), .54, .045, 'brown')
    for i in range(18):
        angle = i*2.4
        radius = .12 + .022*i
        art.sphere('Golden kibble', (radius*math.cos(angle), radius*math.sin(angle), .55),
                   (.07, .06, .048), 'gold' if i % 3 else 'orange')
    art.sphere('Paw on bowl', (0, -.693, .30), (.11, .035, .085), 'cream')
    for x in [-.12, 0, .12]:
        art.sphere('Bowl paw toe', (x, -.69, .40), (.043, .027, .046), 'cream')


def play():
    art.sphere('Coral yarn ball', (0, 0, .66), (.62, .62, .62), 'coral')
    # Broad winding lines remain legible when reduced to menu size.
    for n in range(7):
        angle = -.65 + n*.21
        points = []
        for i in range(32):
            t = math.tau*i/31
            x = .63*math.cos(t)*math.cos(angle)
            y = .63*math.cos(t)*math.sin(angle)
            z = .66 + .63*math.sin(t)
            points.append((x, y, z))
        art.curve('Yarn winding', points, .028, 'pink')
    art.curve('Loose yarn loop', [(0, -.50, .15), (.57, -.66, .08), (.95, -.47, .08),
                                (.77, -.12, .08), (.52, -.29, .08)], .036, 'coral')


def sleep():
    # One continuous crescent silhouette, with a rounded extrusion.
    outer = [(.68*math.cos(math.radians(58+i*244/40)), .68*math.sin(math.radians(58+i*244/40)))
             for i in range(41)]
    inner = [(.37+.51*math.cos(math.radians(-92-i*176/30)), .51*math.sin(math.radians(-92-i*176/30)))
             for i in range(31)]
    extruded_shape('Golden crescent', outer+inner, 'gold', .22, (0, 0, .79))
    points = [(math.cos(math.pi/2+i*math.pi/5)*(.25 if i%2 == 0 else .115),
               math.sin(math.pi/2+i*math.pi/5)*(.25 if i%2 == 0 else .115)) for i in range(10)]
    extruded_shape('Lilac dream star', points, 'lilac', .15, (.60, -.04, 1.28))


def puzzles():
    for x, z, color, label in [(-.35, .43, 'teal', '2'), (.35, .43, 'gold', '+'),
                              (-.35, 1.13, 'coral', '3'), (.35, 1.13, 'lilac', '?')]:
        art.box('Rounded puzzle tile', (x, 0, z), (.65, .28, .65), color, .12)
        curve = bpy.data.curves.new('Math tile symbol', 'FONT')
        curve.body = label
        curve.align_x = 'CENTER'
        curve.align_y = 'CENTER'
        curve.size = .48
        curve.extrude = .018
        curve.bevel_depth = .005
        obj = bpy.data.objects.new('Math tile symbol', curve)
        bpy.context.collection.objects.link(obj)
        obj.location = (x, -.16, z)
        obj.rotation_euler.x = math.pi/2
        art.finish(obj, 'Math tile symbol', 'cream')


def settings():
    # Gear ring with a real opening, rather than a dark circle pasted onto it.
    contour = []
    for tooth in range(10):
        for phase, radius in [(0, .62), (.18, .78), (.64, .78), (.82, .62)]:
            angle = (tooth+phase)*math.tau/10
            contour.append((radius*math.cos(angle), radius*math.sin(angle)))
    count = len(contour)
    hole = [(.26*math.cos(i*math.tau/count), .26*math.sin(i*math.tau/count)) for i in range(count)]
    vertices = [(x, y, z+.82) for y in [-.14, .14] for points in [contour, hole] for x, z in points]
    faces = []
    for i in range(count):
        j = (i+1) % count
        faces.extend([(i, j, count+j, count+i), (2*count+i, 3*count+i, 3*count+j, 2*count+j),
                      (i, 2*count+i, 2*count+j, j), (count+i, count+j, 3*count+j, 3*count+i)])
    mesh = bpy.data.meshes.new('Gear ring')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Teal rounded gear', mesh)
    bpy.context.collection.objects.link(obj)
    art.finish(obj, 'Teal rounded gear', 'teal')
    bevel = obj.modifiers.new('Rounded tooth edges', 'BEVEL')
    bevel.width = .045
    bevel.segments = 4
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    art.torus('Brass hub rim', (0, -.16, .82), .30, .045, 'gold', rotation=(math.pi/2, 0, 0))


def home():
    art.box('Home walls', (0, 0, .60), (1.20, .88, 1.08), 'cream', .10)
    extruded_shape('Warm pitched roof', [(-.79, 1.12), (0, 1.79), (.79, 1.12)], 'coral', 1.04)
    art.box('Teal front door', (.26, -.47, .42), (.33, .07, .72), 'teal', .06)
    art.sphere('Door knob', (.35, -.52, .45), (.035, .025, .035), 'gold')
    art.box('Blue front window', (-.28, -.47, .70), (.36, .05, .38), 'blue', .045)
    for x in [-.28]:
        art.box('Window crossbar', (x, -.504, .70), (.038, .022, .37), 'cream', .01)
        art.box('Window crossbar', (x, -.505, .70), (.35, .022, .038), 'cream', .01)
    art.box('House doorstep', (.25, -.59, .09), (.47, .28, .11), 'wood', .045)


builders = [('paw', paw), ('feed', feed), ('play', play), ('sofa', lambda: art.sofa('sofaA')),
            ('sleep', sleep), ('puzzles', puzzles), ('settings', settings), ('home', home)]
def render_set(icon_builders, output=OUT, size=512, filename="icons.blend"):
    output.mkdir(parents=True, exist_ok=True)
    for name, build in icon_builders:
        scene = bpy.data.scenes.new('Icon '+name)
        scene.world = bpy.data.worlds.new('Icon lighting '+name)
        bpy.context.window.scene = scene
        art.setup(size)
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 48
        scene.cycles.use_denoising = True
        build()
        frame_icon(scene, front=name in FRONT_ICONS)
        art.render(output / (name+'.png'))
        print('ICON_DONE', name, flush=True)
    (output / 'source').mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'source' / filename), compress=True)


def select_builders(icon_builders, output, filename):
    if '--only' not in sys.argv:
        return icon_builders
    selected = set(sys.argv[sys.argv.index('--only') + 1].split(','))
    if not selected.issubset({name for name, build in icon_builders}):
        raise ValueError('Unknown icon in --only')
    library = output / 'source' / filename
    if not library.exists():
        raise FileNotFoundError('Render the complete icon library before a partial rebuild')
    bpy.ops.wm.open_mainfile(filepath=str(library))
    for name in selected:
        scene = bpy.data.scenes.get('Icon ' + name)
        if scene:
            for obj in list(scene.objects):
                bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.scenes.remove(scene)
    return [(name, build) for name, build in icon_builders if name in selected]


if __name__ == '__main__':
    render_set(select_builders(builders, OUT, 'starter-icons.blend'), filename="starter-icons.blend")
