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
    """Three sewn felt panels, pinched ears and a two-ply cotton tail."""
    def felt(name, dark, light):
        mat = scope['material'](name, light, roughness=.98)
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = nodes.get('Principled BSDF')
        shader.inputs['Sheen Weight'].default_value = .27
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 174
        noise.inputs['Detail'].default_value = 2.5
        ramp = nodes.new('ShaderNodeValToRGB')
        for stop, hexcolor in zip(ramp.color_ramp.elements, (dark, light)):
            base = [int(hexcolor[i:i+2], 16)/255 for i in (0, 2, 4)]
            stop.color = tuple(((v+.055)/1.055)**2.4 for v in base) + (1,)
        links.new(noise.outputs['Fac'], ramp.inputs[0])
        links.new(ramp.outputs[0], shader.inputs['Base Color'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .12
        bump.inputs['Distance'].default_value = .007
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
        return mat

    heather = felt('Heather felt', '8765AC', 'B799D4')
    belly = felt('Oatmeal gusset', 'C6A2BE', 'EBD0D9')
    lining = felt('Apricot ear lining', 'DB8293', 'FFC2A7')
    binding = felt('Plum felt binding', '7A588D', 'AA83AB')
    nose = felt('Raspberry nose', 'A73964', 'E77993')
    floss = scope['material']('Aubergine embroidery floss', '402C48', roughness=.9)
    stitch = scope['material']('Oat embroidery floss', 'D8B6CB', roughness=.94)
    twist = scope['material']('Berry cotton', 'C15983', roughness=.95)
    twist_light = scope['material']('Coral cotton', 'E7929C', roughness=.95)

    # Profiles are cut from the muzzle to the rump. A bottom gusset flattens
    # against the ground while the two side panels meet at the spine.
    profiles = [(-.85, .008, .349, .364), (-.823, .065, .297, .390),
                (-.738, .116, .244, .429), (-.59, .181, .178, .520),
                (-.40, .257, .115, .639), (-.17, .332, .073, .749),
                (.08, .378, .058, .805), (.31, .375, .059, .794),
                (.52, .314, .086, .700), (.66, .220, .135, .578),
                (.73, .121, .197, .474), (.762, .010, .321, .344)]
    ring = 48
    vertices, faces = [], []
    for x, width, low, high in profiles:
        for j in range(ring):
            angle = math.tau*j/ring
            vertices.append((x, width*math.sin(angle), (low+high)/2+(high-low)/2*math.cos(angle)))
    for i in range(len(profiles)-1):
        for j in range(ring):
            k = (j+1) % ring
            faces.append((i*ring+j, (i+1)*ring+j, (i+1)*ring+k, i*ring+k))
    faces.extend([tuple(range(ring)), tuple(reversed(range(len(vertices)-ring, len(vertices))))])
    mesh = bpy.data.meshes.new('Catnip mouse pattern')
    mesh.from_pydata(vertices, [], faces); mesh.update()
    body = bpy.data.objects.new('Stuffed side panels and gusset', mesh)
    bpy.context.collection.objects.link(body)
    for material in (heather, belly, nose): mesh.materials.append(material)
    for face in mesh.polygons:
        section, arc = divmod(face.index, ring)
        face.material_index = 2 if section < 2 or face.index == len(mesh.polygons)-2 else 1 if 15 <= arc <= 32 else 0
        face.use_smooth = True
    rounding = body.modifiers.new('Stuffed seams', 'SUBSURF')
    rounding.levels = 2
    bpy.context.view_layer.update()
    surface = body.evaluated_get(bpy.context.evaluated_depsgraph_get())

    def cheek(x, z, side, lift=.006):
        hit, spot, normal, _ = surface.ray_cast((x, side, z), (0, -side, 0))
        if not hit: raise ValueError(('Outside felt panel', x, z))
        return spot + normal*lift, normal

    for side in (-1, 1):
        # Flat satin stitches lie on the panel; even the far eye follows the cheek.
        spot, normal = cheek(-.508, .419, side, .002)
        eye = sphere('Stitched oval eye', spot, (.054, .064, .009), floss)
        eye.rotation_euler = normal.to_track_quat('Z','Y').to_euler()
        glint, _ = cheek(-.523, .438, side, .009)
        sphere('Single eye stitch', glint, (.010, .010, .011), stitch)
        for whisker in [[(-.681,.332),(-.626,.348),(-.566,.347)],
                        [(-.672,.302),(-.617,.298),(-.571,.286)]]:
            curve('Whisker stitch', [cheek(x,z,side)[0] for x,z in whisker], .007, binding)

        # Felt ears are narrower at the pinched base and fold outward at the lip.
        vertices, faces = [], []
        rings = (.01,.30,.62,.84,.91,.98,1)
        segments = 48
        base = Vector((-.285 if side == 1 else -.325, side*.164, .604))
        across = Vector((.88, .475, 0)) if side == 1 else Vector((.02, 1, 0))
        forward = Vector((-across.y, across.x, 0))
        for r in rings:
            for j in range(segments):
                a = math.tau*j/segments
                h = .5 + r*.5*math.cos(a)
                u = r*.204*math.sin(a)*(.84+.18*math.cos(a))
                pinch = .038 * math.exp(-((u/.050)**2)) * (1-h)**2
                fold = .028*(u/.204)**2 - .036*(1-r*r) + pinch
                pos = base + across*u + forward*fold
                pos += Vector((.105*h*h, side*(.102 if side == 1 else .073)*h, (.390 if side == 1 else .365)*h))
                vertices.append(pos)
        for i in range(len(rings)-1):
            for j in range(segments):
                k = (j+1) % segments
                indices = (i*segments+j, i*segments+k, (i+1)*segments+k, (i+1)*segments+j)
                faces.append(tuple(reversed(indices)))
        faces.append(tuple(reversed(range(segments))))
        mesh = bpy.data.meshes.new('Cut felt ear')
        mesh.from_pydata(vertices, [], faces); mesh.update()
        ear = bpy.data.objects.new('Folded petal ear', mesh); bpy.context.collection.objects.link(ear)
        for material in (lining,binding,heather): mesh.materials.append(material)
        for face in mesh.polygons:
            face.use_smooth = True
            face.material_index = 0 if face.index//segments < 4 or len(face.vertices)>4 else 1
        thickness = ear.modifiers.new('Two fabric layers', 'SOLIDIFY')
        thickness.thickness = .028; thickness.material_offset = 2
        edge = ear.modifiers.new('Soft cut edge', 'BEVEL'); edge.width=.009; edge.segments=3

    # A small felt applique follows the convex flank, edged with blanket stitches.
    heart = felt('Rose applique', 'C3547C', 'F596A6')
    def patch_point(angle, radius, lift):
        x = .27 + radius*.152*math.sin(angle)**3
        z = .450 + radius*.0085*(13*math.cos(angle)-5*math.cos(2*angle)-2*math.cos(3*angle)-math.cos(4*angle))
        return cheek(x,z,1,lift)[0]
    segments = 48
    verts = [cheek(.27,.450,1,.016)[0]]
    for radius in (.45,.80,1):
        verts.extend(patch_point(math.tau*i/segments,radius,.008+.008*(1-radius)) for i in range(segments))
    faces = [(0,1+i,1+(i+1)%segments) for i in range(segments)]
    for j in (0,1):
        for i in range(segments):
            k=(i+1)%segments; a=1+j*segments
            faces.append((a+i,a+segments+i,a+segments+k,a+k))
    mesh=bpy.data.meshes.new('Bias cut heart'); mesh.from_pydata(verts,[],faces); mesh.update()
    badge=bpy.data.objects.new('Heart applique',mesh); bpy.context.collection.objects.link(badge)
    mesh.materials.append(heart)
    for face in mesh.polygons: face.use_smooth=True
    for a in (.72, 2.12, 4.16, 5.56):
        curve('Applique stitch',[patch_point(a+d,.84,.016) for d in (-.09,0,.09)],.006,stitch)

    # The topstitch follows the actual stuffed surface, including its slope.
    for x in (-.01, .105, .22, .335, .45, .565):
        points=[]
        for t in (0,.5,1):
            xx=x+t*.057
            hit, spot, normal, _ = surface.ray_cast((xx,.063,1.2), (0,0,-1))
            if hit: points.append(spot+normal*.006)
        curve('Running topstitch', points, .012, stitch)

    # Twist two fine strands along one relaxed S curve. Both share the same
    # centreline and converge into a soft knot at the free end.
    controls = [Vector(v) for v in [(.65,.013,.265),(.80,.005,.163),(.91,.10,.125),
                (1.01,.162,.184),(1.11,.224,.243),(1.13,.207,.390),(1.056,.132,.428)]]
    path=[]
    for i in (0,3):
        a,b,c,d=controls[i:i+4]
        for n in range(81):
            if i and n==0: continue
            t=n/80; path.append(a*(1-t)**3+b*3*t*(1-t)**2+c*3*(1-t)*t*t+d*t**3)
    for strand, material in enumerate((twist,twist_light)):
        points=[]
        for i, center in enumerate(path):
            tangent=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized()
            normal=tangent.cross(Vector((0,0,1))).normalized()
            angle=i/(len(path)-1)*math.tau*8 + math.pi*strand
            points.append(center+.012*(normal*math.cos(angle)+tangent.cross(normal)*math.sin(angle)))
        curve('Twisted cotton strand',points,.019,material)
    sphere('Cord end knot',path[-1],(.042,.039,.040),twist)

def ribbon(color):
    """A tied fabric bow: folded broad loops, a wrapped knot and fishtail ends."""
    fabric = scope['material']('Felt bow '+color, '04B5CD' if color == 'blue' else 'FA357C', roughness=.89)
    # A shallow nap catches the key light without adding screen-sized speckles.
    shader = fabric.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Sheen Weight'].default_value = .10
    shader.inputs['Sheen Roughness'].default_value = .8

    velvet = fabric.node_tree
    nap = velvet.nodes.new('ShaderNodeTexNoise')
    nap.inputs['Scale'].default_value = 165
    bump = velvet.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .15
    bump.inputs['Distance'].default_value = .012
    velvet.links.new(nap.outputs['Fac'], bump.inputs['Height'])
    velvet.links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    lining = scope['material']('Inner bow fold '+color, '057F98' if color == 'blue' else 'BD205D')

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
                # Tilt the loop opening toward the viewer. The returned band stays
                # visible as a curved lip below the broad, convex face of the bow.
                lift = math.sin(math.tau*t)
                width = .07 + .255*reach
                x = .045 + .80*reach - .065*reach*u*u
                y = .085 + .06*reach + u*width + .155*lift
                z = .20 + .24*lift + .11*(1-u*u)*reach
                vertices.append((side*x, y, z))
        for i in range(steps):
            for j in range(across):
                a = i*(across+1)+j
                face = (a,a+1,a+across+2,a+across+1)
                faces.append(tuple(reversed(face)) if side == 1 else face)
        loop = cloth('Folded bow loop', vertices, faces)
        loop.data.materials.append(lining)
        for face in loop.data.polygons:
            if face.index // across >= steps // 2:
                face.material_index = 1
        points = [(.015,.08),(.19,.06),(.49,-.48),(.31,-.43),(.19,-.59),(-.045,-.09)]
        tail = [(side*x,y,.015+.025*math.cos(y*6)) for x,y in points]
        order = tuple(range(len(tail)))
        cloth('V-notched ribbon tail', tail, [order if side == 1 else tuple(reversed(order))])
    knot = sphere('Wrapped fabric knot', (0,.06,.27), (.168,.190,.160), fabric)
    knot.rotation_euler.z = -.06

def counting_paw(skin):
    coat = scope['material']('Counting paw '+skin,
                             {'orange':'EFA45E', 'grey':'929DA8', 'white':'E0D9CE'}[skin])
    ivory = scope['material']('Ivory toes', 'FFF0DA', roughness=.85)
    sphere('Foreleg', (.78, 0, .16), (1.05, .215, .19), coat)
    sphere('Soft mitten', (-.16, 0, .18), (.39, .26, .215), ivory)
    for i, offset in enumerate((-.145, 0, .145)):
        sphere('Toe '+str(i+1), (-.37 - (.055 if i == 1 else 0), offset, .18),
               (.175, .110, .145), ivory)

def star(color):
    # Round the silhouette itself, so the tips stay soft even at 24 points.
    corners = [Vector((math.cos(math.pi/2+i*math.pi/5)*(.52 if i%2==0 else .27),
                       math.sin(math.pi/2+i*math.pi/5)*(.52 if i%2==0 else .27), .10)) for i in range(10)]
    pts = []
    for i, corner in enumerate(corners):
        distance = .075 if i%2 == 0 else .035
        start = corner + (corners[(i-1)%10]-corner).normalized()*distance
        end = corner + (corners[(i+1)%10]-corner).normalized()*distance
        for j in range(9):
            t = j/8
            pts.append((1-t)**2*start + 2*(1-t)*t*corner + t*t*end)
    mesh = bpy.data.meshes.new('Rounded five point star'); mesh.from_pydata(pts, [], [list(range(len(pts)))]); mesh.update()
    obj = bpy.data.objects.new('Soft counting star', mesh); bpy.context.collection.objects.link(obj)
    obj.data.materials.append(scope['material']('Counting star '+color, 'FFB82E' if color == 'gold' else 'F5687D', roughness=.85))
    mod = obj.modifiers.new('Star thickness', 'SOLIDIFY'); mod.thickness = .09
    mod = obj.modifiers.new('Soft rim', 'BEVEL'); mod.width = .018; mod.segments = 4
    obj.modifiers.new('Star normals', 'WEIGHTED_NORMAL')
    highlight = scope['material']('Star highlight '+color, 'FFE394' if color == 'gold' else 'FFB8C1', roughness=1)
    curve('Small upper-left highlight', [(-.125,.19,.105),(-.095,.25,.105),(-.065,.31,.105)], .017, highlight)

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
for skin in ('orange', 'grey', 'white'):
    builders['paw-'+skin] = lambda skin=skin: counting_paw(skin)
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
    scene.render.resolution_x = 768 if name.startswith('paw-') else 384 if name == 'mouse' else 256
    scene.render.resolution_y = 256
    build()
    objects = [o for o in scene.objects if o.type in {'MESH', 'CURVE'}]
    camera = scene.camera
    camera.location = (-4.1, 6.35, 2.04) if name == 'mouse' else (2, -5, 7)
    if name == 'mouse':
        # Light the cheeks from the same side as the low, nose-first camera.
        key = next(light for light in scene.objects if light.type == 'LIGHT' and light.name.startswith('Warm key'))
        key.location = (-4, 3, 5)
        aim(key, (0, 0, .35))
    if name.startswith('star'):
        camera.location = (0, 0, 7)
        camera.name = 'Upright front-facing star camera'
        for light in scene.objects:
            if light.type == 'LIGHT': light.data.energy *= .45
    if name.startswith('paw-'):
        camera.location = (0, -.6, 7)
        for light in scene.objects:
            if light.type == 'LIGHT': light.data.energy *= .48
    if name.startswith('ribbon-'):
        camera.location = (0, -1.8, 7)
        for light in scene.objects:
            if light.type == 'LIGHT':
                light.data.energy *= .9 if light.name.startswith('Warm key') else .48
        scene.world.node_tree.nodes['Background'].inputs[1].default_value = .48
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
