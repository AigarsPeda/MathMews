"""Blender-authored counting objects. Rebuild with Blender --background --python this_file."""
from pathlib import Path
import bpy, math, json, sys
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
scope = {'__file__': str(ROOT / 'scripts/3d/render_assets.py'), '__name__': 'puzzle_helpers'}
exec(compile(Path(scope['__file__']).read_text(), scope['__file__'], 'exec'), scope)
box, sphere, cylinder, curve, setup, aim = [scope[k] for k in ('box', 'sphere', 'cylinder', 'curve', 'setup', 'aim')]
OUT = ROOT / 'assets/3d/puzzle-objects'
SOURCE = ROOT / 'prototypes/puzzle-objects/puzzle-objects.blend'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.parent.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0

def mouse():
    scope['PALETTE'].update({'mouse-body':'596B85', 'mouse-ear':'435772', 'mouse-pink':'CE6B89', 'mouse-eye':'172331'})
    sphere('Plush mouse body', (0, 0, .30), (.58, .32, .29), 'mouse-body')
    sphere('Soft pointed snout', (-.43, -.02, .26), (.28, .25, .21), 'mouse-body')
    sphere('Pink stitched nose', (-.68, -.02, .27), (.10, .09, .075), 'mouse-pink')
    for y in [-.22, .22]:
        sphere('Round felt ear', (-.28, y, .56), (.20, .10, .23), 'mouse-ear')
        sphere('Inner pink ear', (-.30, y-.06, .58), (.14, .045, .155), 'mouse-pink')
        sphere('Embroidered eye', (-.47, y*1.03, .38), (.05, .035, .05), 'mouse-eye')
    curve('Curled fabric tail', [(.48, 0, .28), (.72, .08, .12), (.85, -.10, .06), (.73, -.23, .07)], .045, 'mouse-pink')
    for y in [-.30, -.38]:
        curve('Cream whisker', [(-.60, -.15, .26), (-.79, y, .28)], .008, 'cream')
    curve('Back seam', [(-.12, 0, .585), (.14, 0, .575), (.34, 0, .50)], .012, 'mouse-ear')

def ribbon(color):
    """A tied fabric bow: folded broad loops, a wrapped knot and fishtail ends."""
    fabric = scope['material']('Ribbon fabric '+color, '309BC5' if color == 'blue' else 'DF537E', roughness=.78)

    def cloth(name, vertices, faces):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces); mesh.update()
        obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
        obj.data.materials.append(fabric)
        for face in mesh.polygons: face.use_smooth = True
        thickness = obj.modifiers.new('Fabric thickness', 'SOLIDIFY'); thickness.thickness = .018
        edge = obj.modifiers.new('Soft fabric edges', 'BEVEL'); edge.width = .012; edge.segments = 3
        obj.modifiers.new('Fabric normals', 'WEIGHTED_NORMAL')
        return obj

    for side in [-1, 1]:
        # A continuous band folds back underneath itself, widening away from the knot.
        vertices, faces = [], []
        steps, across = 48, 8
        for i in range(steps+1):
            t = i / steps
            reach = math.sin(math.pi*t)
            for j in range(across+1):
                u = j/across*2-1
                vertices.append((side*(.08+.57*reach-.11*reach*u*u), .09+.17*reach+u*(.06+.20*reach),
                                 .10+.13*math.sin(math.tau*t)+.06*(1-u*u)*reach))
        for i in range(steps):
            for j in range(across):
                a = i*(across+1)+j
                face = (a,a+1,a+across+2,a+across+1)
                faces.append(face if side == 1 else tuple(reversed(face)))
        cloth('Folded bow loop', vertices, faces)
        points = [(.015,.08),(.19,.06),(.45,-.55),(.29,-.49),(.17,-.66),(-.045,-.09)]
        tail = [(side*x,y,.015+.025*math.cos(y*6)) for x,y in points]
        order = tuple(range(len(tail)))
        cloth('V-notched ribbon tail', tail, [order if side == 1 else tuple(reversed(order))])
    knot = box('Wrapped fabric knot', (0,.075,.205), (.23,.27,.20), fabric, .07)
    knot.rotation_euler.z = -.06

def star(color):
    pts = [(math.cos(math.pi/2+i*math.pi/5)*(.52 if i%2==0 else .24), math.sin(math.pi/2+i*math.pi/5)*(.52 if i%2==0 else .24), .06) for i in range(10)]
    mesh = bpy.data.meshes.new('Five point paper star'); mesh.from_pydata(pts, [], [list(range(10))]); mesh.update()
    obj = bpy.data.objects.new('Thick paper star', mesh); bpy.context.collection.objects.link(obj)
    obj.data.materials.append(scope['material'](color))
    mod = obj.modifiers.new('Paper thickness', 'SOLIDIFY'); mod.thickness = .06
    mod = obj.modifiers.new('Soft cut edges', 'BEVEL'); mod.width = .018; mod.segments = 3
    obj.modifiers.new('Paper normals', 'WEIGHTED_NORMAL')

def cookie():
    cylinder('Baked biscuit', (0, 0, .10), .43, .16, 'gold')
    cylinder('Cookie face', (0, 0, .19), .38, .035, 'orange')
    for x, y, r in [(-.19, -.13, .06), (.13, -.21, .045), (.22, .10, .055), (-.08, .17, .06), (-.02, -.03, .04)]:
        sphere('Chocolate chip', (x, y, .22), (r, r*.83, .023), 'brown')
    for i in range(12):
        a = i*math.tau/12
        sphere('Crimped edge', (.395*math.cos(a), .395*math.sin(a), .15), (.055, .055, .04), 'gold')

def parcel():
    box('Kraft parcel', (0, 0, .29), (.78, .66, .54), 'wood', .055)
    box('Paper wrap top', (0, 0, .57), (.78, .65, .025), 'paper', .01)
    box('Teal ribbon length', (0, 0, .30), (.12, .68, .58), 'teal', .01)
    box('Teal ribbon cross', (0, 0, .30), (.80, .11, .58), 'teal', .01)
    sphere('Ribbon knot', (0, 0, .64), (.12, .09, .06), 'teal')

def planting_tile():
    box('One square planting space', (0, 0, .07), (.86, .86, .14), 'wood', .06)
    box('Dark garden soil', (0, 0, .15), (.70, .70, .07), 'brown', .04)
    cylinder('Seedling stem', (0, 0, .24), .025, .18, 'green')
    for sign in [-1, 1]:
        leaf = sphere('Seedling leaf', (sign*.12, 0, .32), (.18, .075, .04), 'green')
        leaf.rotation_euler.y = -sign*.35

def carriage():
    box('Toy train carriage', (0, 0, .32), (1.12, .52, .42), 'teal', .07)
    box('Carriage roof', (0, 0, .58), (1.19, .59, .14), 'coral', .05)
    for x in [-.32, 0, .32]:
        box('Cream window', (x, -.272, .38), (.20, .025, .19), 'cream', .025)
    for x in [-.35, .35]:
        for y in [-.27, .27]:
            cylinder('Wooden wheel', (x, y, .13), .13, .065, 'dark', rotation=(math.pi/2, 0, 0))
    for x in [-.64, .64]:
        box('Carriage coupling', (x, 0, .18), (.20, .10, .06), 'gold', .02)

builders = {'mouse': mouse, 'ribbon-red': lambda: ribbon('coral'), 'ribbon-blue': lambda: ribbon('blue'), 'star': lambda: star('gold'), 'star-red': lambda: star('coral'), 'cookie': cookie, 'parcel': parcel, 'planting-tile': planting_tile, 'carriage': carriage}
selected = set(sys.argv[sys.argv.index('--only')+1].split(',')) if '--only' in sys.argv else set(builders)
if not selected.issubset(builders): raise ValueError('Unknown puzzle object in --only')
if '--only' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    for scene in list(bpy.data.scenes):
        if scene.name.removeprefix('Puzzle object - ') in selected:
            bpy.data.scenes.remove(scene)
scenes = []
for name, build in builders.items():
    if name not in selected: continue
    scene = bpy.data.scenes.new('Puzzle object - '+name)
    scene.world = bpy.data.worlds.new('Soft studio - '+name)
    bpy.context.window.scene = scene
    setup(256)
    scene.render.resolution_x = 384 if name == 'mouse' else 256
    scene.render.resolution_y = 256
    build()
    objects = [o for o in scene.objects if o.type in {'MESH', 'CURVE'}]
    camera = scene.camera
    camera.location = (1.6, -5, 5.5) if name == 'mouse' else (2, -5, 7)
    if name.startswith('ribbon-'):
        camera.location = (0, -.15, 7)
        for light in scene.objects:
            if light.type == 'LIGHT': light.data.energy *= .55
        camera.name = 'Front-facing bow camera'
    aim(camera, (0, 0, .22))
    bpy.context.view_layer.update()
    # Bezier control bounds can dwarf a thin tail or seam. Frame the rendered
    # geometry so a mouse remains the same readable size as the other objects.
    coords = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        coords.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    for _ in range(2):
        inv = camera.matrix_world.inverted(); projected = [inv @ v for v in coords]
        lowx, highx = min(v.x for v in projected), max(v.x for v in projected)
        lowy, highy = min(v.y for v in projected), max(v.y for v in projected)
        offset = camera.matrix_world.to_quaternion() @ Vector(((lowx+highx)/2, (lowy+highy)/2, 0))
        camera.location += offset
        aspect = scene.render.resolution_x / scene.render.resolution_y
        camera.data.ortho_scale = max(highx-lowx, (highy-lowy)*aspect)*1.12
        bpy.context.view_layer.update()
    scene.render.filepath = str(OUT / (name+'.png'))
    bpy.ops.render.render(write_still=True)
    scenes.append(scene)
    print('PUZZLE_OBJECT_DONE', name, flush=True)
bpy.context.window.scene = scenes[0]
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
(OUT/'catalog.json').write_text(json.dumps({'generator':'scripts/3d/build-puzzle-objects.py', 'source':'prototypes/puzzle-objects/puzzle-objects.blend', 'objects':list(builders), 'render':'transparent Blender Eevee orthographic PNG'}, indent=2)+'\n')
