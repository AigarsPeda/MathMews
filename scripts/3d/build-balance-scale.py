"""Rebuild the editable toy balance and its three transparent puzzle layers in Blender."""
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/3d'))
from render_assets import aim, cylinder, material, setup, sphere, torus

OUT = ROOT / 'assets/3d/education-props'
SOURCE = ROOT / 'prototypes/puzzle-objects/balance-scale.blend'
OUT.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
scene = setup()
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = .55
# A broad frontal bounce keeps the number plate light beneath the bezel.
bpy.ops.object.light_add(type='AREA', location=(0, -5, 2.5))
bounce = bpy.context.object
bounce.name = 'Number plate bounce'
bounce.data.energy = 190
bounce.data.shape = 'DISK'
bounce.data.size = 5
aim(bounce, (0, 0, .8))

enamel = material('Lagoon enamel', '208986', .28, .18)
edge = material('Deep teal casting', '20575C', .34, .22)
brass = material('Honey brass', 'DCA24F', .30, .57)
light_brass = material('Burnished rims', 'F0CB82', .27, .52)
ivory = material('Vanilla enamel', 'FFF0C9', .42)
for paint in (enamel, ivory):
    paint.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value = .24


def casting(name, outline, y, depth, rounding, finish):
    """Extrude an X/Z silhouette. Its flat face can carry live puzzle text."""
    n = len(outline)
    vertices = [(x, plane, z) for plane in (y - depth / 2, y + depth / 2) for x, z in outline]
    faces = [tuple(range(n)), tuple(reversed(range(n, n * 2)))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, i + n, j + n, j))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(finish)
    bevel = obj.modifiers.new('Eased casting edges', 'BEVEL')
    bevel.width = rounding
    bevel.segments = 5
    obj.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
    return obj


def plaque(name, width, height, radius, z, y, depth, finish):
    points = []
    for sx, sz, angle in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for i in range(9):
            a = math.radians(angle + i * 90 / 8)
            points.append((sx * (width / 2 - radius) + radius * math.cos(a),
                           z + sz * (height / 2 - radius) + radius * math.sin(a)))
    return casting(name, points, y, depth, min(.04, depth * .35), finish)


def weight():
    # A stocky cast weight with a through-handle, standing on a shallow pan.
    cylinder('Pan bearing', (0, 0, -.14), .14, .34, edge)
    plaque('Brass pan', 3.54, .17, .08, .045, 0, 1.07, brass)
    casting('Tapered enamel body', [(-1.48, .13), (1.48, .13), (1.59, .24),
            (1.56, .49), (1.30, 1.31), (1.13, 1.45), (.38, 1.55),
            (-.38, 1.55), (-1.13, 1.45), (-1.30, 1.31), (-1.56, .49), (-1.59, .24)],
            0, 1.0, .115, enamel)
    cylinder('Eye socket', (0, 0, 1.55), .29, .13, light_brass)
    torus('Cast lifting eye', (0, 0, 1.87), .32, .116, brass, rotation=(math.pi / 2, 0, 0))
    plaque('Brass bezel', 2.61, .90, .28, .79, -.502, .065, light_brass)
    plaque('Enamel number plate', 2.52, .81, .24, .79, -.543, .052, ivory)


def beam():
    plaque('Brass beam', 7.55, .25, .125, 0, 0, .32, brass)
    plaque('Recessed stripe', 7.24, .072, .036, -.01, -.164, .018, edge)
    across = (math.pi / 2, 0, 0)
    cylinder('Pivot rim', (0, -.19, 0), .35, .15, light_brass, rotation=across)
    cylinder('Pivot medallion', (0, -.28, 0), .277, .065, enamel, rotation=across)
    sphere('Pad on pivot', (0, -.32, -.048), (.106, .022, .078), light_brass)
    for x, z in ((-.13, .038), (0, .103), (.13, .038)):
        sphere('Toe on pivot', (x, -.325, z), (.045, .021, .058), light_brass)


def base():
    casting('Pedestal casting', [(-.79, .10), (.79, .10), (.76, .21), (.40, .31),
            (.27, .52), (.21, .86), (-.21, .86), (-.27, .52), (-.40, .31), (-.76, .21)],
            0, .61, .065, enamel)
    plaque('Cast sole', 2.10, .19, .09, .095, 0, .85, edge)
    plaque('Brass foot rim', 2.06, .065, .032, .152, -.02, .84, brass)


def layer(name, build):
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    initial = set(scene.objects)
    build()
    for obj in set(scene.objects) - initial:
        for owner in tuple(obj.users_collection):
            owner.objects.unlink(obj)
        collection.objects.link(obj)
    return collection


weight_layer = layer('Weight and pan', weight)
beam_layer = layer('Moving beam', beam)
base_layer = layer('Fixed pedestal', base)
layers = (weight_layer, beam_layer, base_layer)


def camera(target, width):
    target = Vector(target)
    scene.camera.location = target + Vector((0, -11, 1.35))
    aim(scene.camera, target)
    scene.camera.data.ortho_scale = width


def render_layer(collection, name, width, height, scale, center):
    for part in layers:
        part.hide_render = part != collection
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    camera((0, 0, center), scale)
    scene.render.filepath = str(OUT / ('balance-' + name + '.png'))
    bpy.ops.render.render(write_still=True)


render_layer(weight_layer, 'weight', 672, 492, 3.70, 1.0)
render_layer(beam_layer, 'beam', 1200, 126, 7.64, -.025)
render_layer(base_layer, 'base', 468, 225, 2.19, .425)

# Keep one editable, assembled instrument in the saved scene. Both weights share meshes.
for part in layers:
    part.hide_render = False
for obj in beam_layer.objects:
    obj.location.z += .85
for obj in list(weight_layer.objects):
    twin = obj.copy()
    weight_layer.objects.link(twin)
    obj.location += Vector((-2.42, 0, 1.22))
    twin.location += Vector((2.42, 0, 1.22))
scene.render.resolution_x, scene.render.resolution_y = 1200, 570
camera((0, 0, 1.72), 8.7)
scene.render.filepath = '//balance-scale.png'
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_perspective = 'CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
