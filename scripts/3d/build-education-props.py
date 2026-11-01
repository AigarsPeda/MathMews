"""Build the original education-prop collection, transparent previews and reusable GLBs.

Blender --background --threads 4 --python scripts/3d/build-education-props.py
Optional -- --only addition (updates that model/render, retains the complete source scene).
Coordinates: Blender Z-up, meters, bottom-center origin; GLB exports are Y-up.
No lights, cameras, backdrops or price/catalog registrations enter the GLB exports.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'prototypes/education-props'
OUT = ROOT / 'assets/3d/education-props'
RENDERS = SOURCE / 'renders'
for folder in (SOURCE, SOURCE / 'models', OUT, RENDERS):
    folder.mkdir(parents=True, exist_ok=True)
args = argparse.ArgumentParser()
args.add_argument('--only')
options = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
FONT = bpy.data.fonts.load(str(ROOT / 'assets/fonts/nunito/Nunito-900.ttf'))
bpy.context.preferences.filepaths.save_version = 0
PALETTE = {'berry': 'C32468', 'violet': '8036CD', 'sunshine': 'FFC83D',
           'mint': '2FC8B3', 'paper': 'F4E5C7', 'page-edge': 'DCCBA9',
           'graphite': '24314B', 'wood': 'E5B67A', 'metal': 'C9D2DB',
           'mint-ink': '178C7A', 'violet-dark': '54218C', 'screen': 'E3F4DC'}
MATERIALS = {}
for key, value in PALETTE.items():
    color = [int(value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in color]
    material = bpy.data.materials.new('Education / ' + key)
    material.diffuse_color = (*linear, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*linear, 1)
    shader.inputs['Roughness'].default_value = .28 if key not in ('paper', 'page-edge', 'wood') else .55
    shader.inputs['Metallic'].default_value = .65 if key == 'metal' else 0
    MATERIALS[key] = material


def finish(obj, name, color, bevel=0):
    obj.name = name
    obj.data.materials.append(MATERIALS[color])
    if obj.type == 'MESH':
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if bevel:
        mod = obj.modifiers.new('Soft toy edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 4
        mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return obj


def box(name, loc, dimensions, color, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, color, min(bevel, min(dimensions) * .45))


def prism(name, outline, depth, color, bevel=.025):
    n = len(outline)
    vertices = [(x, y, z) for z in (0, depth) for x, y in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, n*2))]
    faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, color, bevel)


def plate(name, loc, width, depth, thickness, color, corner=.10):
    outline = []
    for cx, cy, start in ((width/2-corner, depth/2-corner, 0),
                          (-width/2+corner, depth/2-corner, 90),
                          (-width/2+corner, -depth/2+corner, 180),
                          (width/2-corner, -depth/2+corner, 270)):
        for i in range(9):
            a = math.radians(start + i*90/8)
            outline.append((cx + corner*math.cos(a), cy + corner*math.sin(a)))
    obj = prism(name, outline, thickness, color, min(.018, thickness*.25))
    obj.location = loc
    return obj


def text_mesh(name, text, height, color, upright=False, depth=.10, bevel=.025):
    data = bpy.data.curves.new(name, 'FONT')
    data.body = text
    data.font = FONT
    data.align_x = 'CENTER'
    data.size = 1
    data.extrude = depth
    data.bevel_depth = bevel
    data.bevel_resolution = 3
    data.resolution_u = 8
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATERIALS[color])
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    if upright:
        obj.rotation_euler.x = math.pi/2
    bpy.context.view_layer.update()
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    axis = 2 if upright else 1
    scale = height / (max(v[axis] for v in coords)-min(v[axis] for v in coords))
    obj.scale *= scale
    bpy.context.view_layer.update()
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    obj.location.x -= (min(v.x for v in coords)+max(v.x for v in coords))/2
    if upright:
        obj.location.z -= min(v.z for v in coords)
    else:
        obj.location.y -= (min(v.y for v in coords)+max(v.y for v in coords))/2
    return obj


def tube(name, loc, radius, depth, color, vertices=48, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    return finish(bpy.context.object, name, color, .015)


def addition():
    for x in (-.88, .88):
        obj = text_mesh('Berry two', '2', 1.25, 'berry', upright=True)
        obj.location.x += x
    obj = text_mesh('Sunshine plus', '+', .66, 'sunshine', upright=True)
    obj.location.z += .28


def square_root():
    outline = [(-.86, .62), (-.64, .74), (-.38, .28), (.01, 1.56),
               (1.24, 1.56), (1.24, 1.30), (.22, 1.30), (-.20, .02),
               (-.46, .02), (-.86, .62)]
    obj = prism('Violet radical', outline[:-1], .24, 'violet', .045)
    obj.rotation_euler.x = math.pi/2
    nine = text_mesh('Sunshine nine', '9', 1.02, 'sunshine', upright=True)
    nine.location.x += .75
    nine.location.z += .05


def fractions():
    for index in range(4):
        angle = index*math.pi/2
        outline = [(0, 0)] + [(math.cos(angle+i*math.pi/48)*.72, math.sin(angle+i*math.pi/48)*.72) for i in range(25)]
        obj = prism('Quarter '+str(index+1), outline, .26, 'berry' if index == 0 else 'mint', .035)
        obj.rotation_euler.x = math.pi/2
        direction = angle+math.pi/4
        gap = .10 if index == 0 else .035
        obj.location = (math.cos(direction)*gap, 0, .74+math.sin(direction)*gap)


def book(color='violet', origin=(0, 0, 0), rotation=0, prefix='Book'):
    before = set(bpy.context.scene.objects)
    plate(prefix+' lower cover', (0, 0, 0), 1.60, 1.20, .055, color)
    plate(prefix+' page block', (.025, 0, .06), 1.45, 1.08, .21, 'paper', .065)
    plate(prefix+' upper cover', (0, 0, .28), 1.60, 1.20, .06, color)
    box(prefix+' rounded spine', (-.76, 0, .17), (.12, 1.19, .32), color, .055)
    for z in (.105, .155, .205):
        box(prefix+' page edges', (.06, -.545, z), (1.30, .008, .006), 'page-edge', .002)
    for obj in set(bpy.context.scene.objects)-before:
        x, y = obj.location.x, obj.location.y
        obj.location = (origin[0]+x*math.cos(rotation)-y*math.sin(rotation),
                        origin[1]+x*math.sin(rotation)+y*math.cos(rotation), origin[2]+obj.location.z)
        obj.rotation_euler.z += rotation


def book_stack():
    for index, (color, angle, x) in enumerate((('violet', -.05, 0), ('mint', .07, .04), ('sunshine', -.075, -.04), ('berry', .045, .025))):
        book(color, (x, 0, index*.34), angle, 'Stack '+str(index+1))


def page_half(name, sign, color, offset, thickness, width=.91, depth=1.20):
    steps = 24
    profile = [(sign*width*i/steps, .22+.16*math.sin(math.pi*i/steps*.91)+.025*i/steps+offset) for i in range(steps+1)]
    vertices = [(x, y, z-dz) for dz in (0, thickness) for y in (-depth/2, depth/2) for x, z in profile]
    n = steps+1
    faces = []
    for i in range(steps):
        faces += [(i,i+1,n+i+1,n+i), (2*n+i,3*n+i,3*n+i+1,2*n+i+1),
                  (i,2*n+i,2*n+i+1,i+1), (n+i,n+i+1,3*n+i+1,3*n+i)]
    faces += [(0,n,3*n,2*n), (n-1,3*n-1,4*n-1,2*n-1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    # Both halves must face outward even though their profile directions differ.
    import bmesh
    bm = bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(mesh); bm.free()
    finish(obj, name, color, .012)
    return obj


def open_book():
    for sign in (-1, 1):
        page_half('Berry open cover', sign, 'berry', -.14, .045, .97, 1.28)
        page_half('Cream open pages', sign, 'paper', 0, .13)
        for layer in range(3):
            # Actual paper layers, not floating accessories or markings.
            page_half('Paper leaf edge', sign, 'page-edge', -.035-layer*.035, .003, .912, 1.205)
    box('Open book binding', (0, 0, .075), (.12, 1.28, .10), 'berry')


def pencil():
    before = set(bpy.context.scene.objects)
    rotation = (0, math.pi/2, 0)
    tube('Hexagonal yellow barrel', (0,0,.22), .21, 1.65, 'sunshine', 6, rotation)
    tube('Metal eraser ferrule', (.925,0,.22), .215, .20, 'metal', rotation=rotation)
    for x in (.86,.98):
        tube('Ferrule ring', (x,0,.22), .221, .018, 'metal', rotation=rotation)
    tube('Berry eraser', (1.12,0,.22), .21, .22, 'berry', rotation=rotation)
    for name, x, length, r1, r2, color in (
        ('Sharpened cedar', -1.01, .37, .21, .047, 'wood'),
        ('Graphite point', -1.255, .13, .047, .008, 'graphite')):
        bpy.ops.mesh.primitive_cone_add(vertices=6 if color=='wood' else 32, radius1=r1, radius2=r2, depth=length,
                                       location=(x,0,.22), rotation=(0,-math.pi/2,0))
        finish(bpy.context.object, name, color, .007)
    for obj in set(bpy.context.scene.objects)-before:
        x, y = obj.location.x, obj.location.y
        obj.location.x, obj.location.y = x*math.cos(.95)-y*math.sin(.95), x*math.sin(.95)+y*math.cos(.95)
        obj.rotation_euler.z += .95


def set_square():
    outer = [(-.86,-.62),(.86,-.62),(.86,.86)]
    inner = [(-.13,-.27),(.50,-.27),(.50,.27)]
    vertices = [(x,y,z) for z in (0,.16) for ring in (outer,inner) for x,y in ring]
    faces = []
    for i in range(3):
        j=(i+1)%3
        faces += [(i,j,j+3,i+3), (i+6,i+9,j+9,j+6), (i,i+6,j+6,j), (i+3,j+3,j+9,i+9)]
    mesh=bpy.data.meshes.new('Set square ring'); mesh.from_pydata(vertices,[],faces); mesh.update()
    import bmesh
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new('Mint triangular set square',mesh);bpy.context.collection.objects.link(obj)
    finish(obj,obj.name,'mint',.04)
    for i in range(8):
        y=-.42+i*.15
        box('Measuring tick',(.77,y,.162),(.10 if i%2==0 else .065,.014,.006),'mint-ink',.003)


def calculator():
    plate('Violet calculator body',(0,0,0),1.30,1.82,.22,'violet',.18)
    plate('Display bezel',(0,.54,.22),1.06,.44,.025,'violet-dark',.07)
    plate('LCD glass',(0,.54,.245),.94,.33,.012,'screen',.045)
    digit=text_mesh('LCD four','4',.20,'graphite',depth=.001,bevel=0)
    digit.location+=(Vector((.32,.54,.26)))
    keys=[['7','8','9','÷'],['4','5','6','×'],['1','2','3','−'],['0','.','=','+']]
    for row, values in enumerate(keys):
        for col, value in enumerate(values):
            x=-.45+col*.30; y=.10-row*.28
            color='berry' if value=='=' else 'mint' if col==3 else 'paper'
            plate('Key '+value,(x,y,.225),.245,.22,.065,color,.045)
            label=text_mesh('Key legend '+value,value,.12,'paper' if value=='=' else 'graphite',depth=.001,bevel=0)
            bpy.context.view_layer.update()
            # Thin operators such as minus need a width limit, not height-only sizing.
            if label.dimensions.x > .16:
                factor = .16/label.dimensions.x
                label.scale *= factor
                label.location *= factor
            label.location+=Vector((x,y,.294))


BUILDERS={'addition':addition,'square-root':square_root,'fractions':fractions,
          'book-closed':book,'book-open':open_book,'book-stack':book_stack,
          'pencil':pencil,'set-square':set_square,'calculator':calculator}
if options.only and options.only not in BUILDERS:
    raise ValueError('Unknown object: '+options.only)


def bounds(objects):
    deps=bpy.context.evaluated_depsgraph_get(); coords=[]
    for obj in objects:
        evaluated=obj.evaluated_get(deps)
        mesh=evaluated.to_mesh()
        coords.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
        evaluated.to_mesh_clear()
    return coords


def aim(obj, point):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()


def studio(scene, objects, upright):
    scene.render.engine='CYCLES'
    scene.cycles.samples=48
    scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    scene.world=bpy.data.worlds.new('Education studio '+scene.name);scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.80,.86,.94,1);bg.inputs[1].default_value=.4
    bpy.ops.object.camera_add(location=(2.7,-8,4.2) if upright else (3.2,-6,6.4))
    camera=bpy.context.object;camera.name='Preview camera';camera.data.type='ORTHO';scene.camera=camera
    coords=bounds(objects);center=Vector(tuple((min(v[i] for v in coords)+max(v[i] for v in coords))/2 for i in range(3)))
    camera.location+=center;aim(camera,center);bpy.context.view_layer.update()
    inverse=camera.matrix_world.inverted();projected=[inverse@v for v in coords]
    lo=[min(v[i] for v in projected) for i in (0,1)];hi=[max(v[i] for v in projected) for i in (0,1)]
    camera.location+=camera.matrix_world.to_quaternion()@Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,0))
    camera.data.ortho_scale=max(hi[i]-lo[i] for i in (0,1))*1.15
    for name,location,energy,size in [('Large softbox',(-3,-4,6),380,4),('Fill',(4,-1,3.5),220,3),('Rim',(1,4,5),260,3)]:
        bpy.ops.object.light_add(type='AREA',location=location)
        light=bpy.context.object;light.name=name;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;aim(light,center)


# Each source file is self-contained and can be opened or edited without the generator.
metadata=[]
for key, build in BUILDERS.items():
    if options.only and key!=options.only:
        continue
    scene=bpy.data.scenes.new('Education / '+key);bpy.context.window.scene=scene
    build()
    objects=[obj for obj in scene.objects if obj.type=='MESH']
    import bmesh
    for obj in objects:
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
    bpy.context.view_layer.update()
    coords=bounds(objects)
    low=[min(v[i] for v in coords) for i in range(3)];high=[max(v[i] for v in coords) for i in range(3)]
    offset=Vector((-(low[0]+high[0])/2,-(low[1]+high[1])/2,-low[2]))
    for obj in objects:obj.location+=offset
    root=bpy.data.objects.new('education-'+key,None);scene.collection.objects.link(root)
    root['asset_id']='education-'+key;root['placement']='floor';root['units']='meters'
    for obj in objects:obj.parent=root
    bpy.context.view_layer.update()
    coords=bounds(objects);lo=[min(v[i] for v in coords) for i in range(3)];hi=[max(v[i] for v in coords) for i in range(3)]
    # Export native geometry only, before studio lights/camera are added.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root,*objects]:obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    glb=SOURCE/'models'/(key+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,
                             export_extras=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    studio(scene,objects,key in ('addition','square-root','fractions'))
    blend=SOURCE/(key+'.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True)
    scene.render.filepath=str(RENDERS/(key+'.png'))
    bpy.ops.render.render(write_still=True)
    triangles=0
    deps=bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles();triangles+=len(mesh.loop_triangles);evaluated.to_mesh_clear()
    metadata.append({'id':'education-'+key,'name':key,'source':str(blend.relative_to(ROOT)),
                     'model':str(glb.relative_to(ROOT)),'preview':f'assets/3d/education-props/{key}.webp',
                     'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]],
                     'footprint':[hi[0]-lo[0],hi[1]-lo[1]],'triangles':triangles,'origin':'bottom-center','up':'Y','units':'meters'})
    print('EDUCATION_PROP_DONE',key,triangles,flush=True)
    # Avoid bundling all previously built scenes into every individual source file.
    for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.scenes.remove(scene)

catalog_path=SOURCE/'catalog.json'
if options.only and catalog_path.exists():
    old=json.loads(catalog_path.read_text())['objects']
    updated={entry['name']:entry for entry in metadata}
    metadata=[updated.get(entry['name'],entry) for entry in old]
catalog_path.write_text(json.dumps({'generator':'scripts/3d/build-education-props.py','palette':PALETTE,
                                   'purpose':'Trail artwork; reusable models for future room decorations, not shop listings.',
                                   'objects':metadata},indent=2)+'\n')
