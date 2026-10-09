"""Extend the approved Blender icon study into the native app's shared icon family.
Run Blender --background --python scripts/3d/render_app_icons.py.
"""
import math
import os
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
os.environ['BRAINPET_ICON_OUTPUT'] = str(ROOT / 'docs/art/app-icons')
sys.path.insert(0, str(Path(__file__).parent))
import render_icon_study as study
art, bpy = study.art, study.bpy


def stroke(name, points, color='teal', radius=.075):
    return art.curve(name, [(x, -.08, z) for x, z in points], radius, color)


def text_symbol(label, color='cream', size=.85, position=(0, -.19, .80)):
    data = bpy.data.curves.new('Raised symbol', 'FONT')
    data.body = label
    data.align_x = data.align_y = 'CENTER'
    data.size, data.extrude, data.bevel_depth = size, .025, .008
    obj = bpy.data.objects.new('Raised symbol '+label, data)
    bpy.context.collection.objects.link(obj)
    obj.location, obj.rotation_euler.x = position, math.pi/2
    art.finish(obj, obj.name, color)


def tile(label, color='teal'):
    art.box('Soft math tile', (0, 0, .8), (1.25, .30, 1.25), color, .16)
    text_symbol(label, size=.53 if len(label)>1 else .85)


def heart(broken=False):
    pts=[]
    for i in range(80):
        t=math.tau*i/80
        pts.append((16*math.sin(t)**3/22, (13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))/22+.87))
    study.extruded_shape('Rounded coral heart', pts, 'coral', .3)
    if broken:
        crack=stroke('Heart crack',[(.05,1.4),(-.1,1.07),(.13,.85),(-.08,.46)],'cream',.045)
        crack.location.y=-.13


def coin():
    art.cylinder('Golden coin',(0,0,.8),.7,.19,'gold',rotation=(math.pi/2,0,0))
    art.torus('Coin raised rim',(0,-.105,.8),.59,.04,'orange',rotation=(math.pi/2,0,0))
    text_symbol('+','cream',.8,(0,-.14,.8))


def sparkle():
    for x,z,r,color in [(0,.75,.68,'gold'),(.70,1.36,.25,'lilac'),(-.57,1.38,.17,'coral')]:
        pts=[(x+math.cos(i*math.pi/4)*(r if i%2==0 else r*.26),z+math.sin(i*math.pi/4)*(r if i%2==0 else r*.26)) for i in range(8)]
        study.extruded_shape('Sculpted sparkle',pts,color,.18)


def flame():
    study.extruded_shape('Coral flame',[(-.6,.52),(-.45,1.05),(-.18,.85),(.04,1.72),(.32,1.27),(.58,.79),(.53,.36),(0,.13)],'coral',.25)
    study.extruded_shape('Golden flame core',[(-.25,.37),(-.17,.68),(0,1.04),(.24,.64),(.22,.35),(0,.24)],'gold',.06,(0,-.17,0))


def brain():
    furrow = art.material('Brain fold purple', '80699E')
    folds = [
        [(.03,.40),(-.10,.36),(-.09,.26),(-.24,.22),(-.29,.10)],
        [(.22,.31),(.13,.25),(.17,.15),(.08,.09),(.10,-.02)],
        [(-.32,.02),(-.20,.08),(-.10,.02),(-.15,-.08),(-.04,-.13)],
        [(.24,-.07),(.15,-.12),(.19,-.23),(.08,-.29),(.10,-.39)],
        [(-.28,-.22),(-.16,-.19),(-.08,-.28),(-.13,-.37)],
    ]
    def on_surface(mesh, x, z):
        inverse = mesh.matrix_world.inverted()
        hit, point, normal, face = mesh.ray_cast(
            inverse @ study.Vector((x,-2,z)),
            (inverse.to_3x3() @ study.Vector((0,1,0))).normalized(),
        )
        if not hit:
            raise ValueError(f'Brain fold extends beyond the cortex at {x:.3f}, {z:.3f}')
        point = mesh.matrix_world @ point
        return (x, point.y, z)

    divide_surfaces = []
    art.sphere('Short brain stem', (0,.06,.40), (.10,.13,.12), 'lilac')
    for side in [-1, 1]:
        center_x = side * .30
        hemisphere = art.sphere('Brain hemisphere', (center_x,0,.90), (.40,.29,.46), 'lilac')
        parts = [hemisphere]
        for x,z in [(.12,.32),(.30,.15),(.30,-.08),(.15,-.29),(-.10,.32)]:
            parts.append(art.sphere('Cortex rounded lobe', (center_x+side*x,0,.90+z),
                                    (.17,.25,.18), 'lilac'))
        bpy.ops.object.select_all(action='DESELECT')
        for part in parts:
            part.select_set(True)
        bpy.context.view_layer.objects.active = hemisphere
        bpy.ops.object.join()
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        remesh = hemisphere.modifiers.new('Continuous cortex surface', 'REMESH')
        remesh.mode = 'VOXEL'
        remesh.voxel_size = .025
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        smooth = hemisphere.modifiers.new('Soft cortex contours', 'SMOOTH')
        smooth.factor, smooth.iterations = 1, 4
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        for polygon in hemisphere.data.polygons:
            polygon.use_smooth = True
        bpy.context.view_layer.update()
        divide_surfaces.append([on_surface(hemisphere, 0, .70+.40*i/16) for i in range(17)])
        fold_points = [[on_surface(hemisphere, center_x-side*x, .90+z) for x,z in fold] for fold in folds]
        for points in fold_points:
            # Embed the darker folds in the surface to keep their relief subtle.
            art.curve('Shaded cortex furrow', [(x,y+.012,z) for x,y,z in points], .030, furrow)
    points = [min(samples, key=lambda point: point[1]) for samples in zip(*divide_surfaces)]
    art.curve('Brain hemisphere divide', points, .022, furrow)


def lightbulb():
    globe = art.sphere('Warm golden bulb', (0,0,1.20), (.53,.37,.53), 'gold')
    subdivision = globe.modifiers.new('Smooth rounded glass', 'SUBSURF')
    subdivision.levels = 2
    bpy.ops.object.modifier_apply(modifier=subdivision.name)
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=.22, radius2=.40,
                                    depth=.35, location=(0,0,.77))
    neck = art.finish(bpy.context.object, 'Tapered bulb neck', 'gold')
    bpy.ops.object.select_all(action='DESELECT')
    globe.select_set(True)
    neck.select_set(True)
    bpy.context.view_layer.objects.active = globe
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    remesh = globe.modifiers.new('Continuous bulb silhouette', 'REMESH')
    remesh.mode, remesh.voxel_size = 'VOXEL', .02
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = globe.modifiers.new('Soft glass contours', 'SMOOTH')
    smooth.factor, smooth.iterations = 1, 8
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    for polygon in globe.data.polygons:
        polygon.use_smooth = True

    art.cylinder('Lavender bulb socket', (0,0,.46), .23, .28, 'lilac')
    for z in [.36,.44,.52]:
        art.torus('Rounded screw thread', (0,0,z), .225, .025, 'purple')
    art.sphere('Socket contact', (0,0,.28), (.13,.15,.06), 'purple')
    filament = [(-.13,1.01),(-.19,1.16),(-.08,1.13),(0,1.20),(.08,1.13),(.19,1.16),(.13,1.01)]
    points = [(x, -.37*math.sqrt(1-(x/.53)**2-((z-1.20)/.53)**2)-.01, z) for x,z in filament]
    art.curve('Warm filament', points, .026, 'orange')
    art.sphere('Soft glass highlight', (-.21,-.32,1.42), (.065,.025,.105), 'cream')


def ball():
    art.sphere('Teal play ball',(0,0,.7),(.65,.65,.65),'teal')
    art.torus('Cream ball stripe',(0,0,.7),.654,.046,'cream',rotation=(math.pi/2,0,0))
    art.torus('Coral ball stripe',(0,0,.7),.654,.037,'coral',rotation=(.6,.7,0))


def feather():
    study.extruded_shape('Soft feather',[(-.18,.2),(-.4,.66),(-.34,1.19),(.1,1.65),(.41,1.2),(.34,.7),(.08,.28)],'lilac',.12)
    stroke('Feather shaft',[(-.21,.07),(.06,.69),(.17,1.43)],'cream',.039)
    for z in [.54,.79,1.04]: stroke('Feather vane',[(-.28,z+.15),(.06,z)],'purple',.018)


def box():
    art.box('Toy box',(0,0,.52),(1.15,.94,.94),'wood',.05)
    art.box('Empty opening',(0,0,1),(1,.78,.04),'brown',.025)
    for x in [-.62,.62]:
        lid=art.box('Open box flap',(x,0,1.06),(.45,.93,.06),'paper',.025)
        lid.rotation_euler.y=x*.55
    art.box('Box paw label',(0,-.49,.55),(.37,.04,.29),'cream',.025)


def mouse():
    art.sphere('Toy mouse',(0,0,.47),(.60,.35,.34),'lilac')
    art.sphere('Mouse nose',(-.58,-.04,.40),(.13,.10,.09),'pink')
    for y in [-.21,.21]:
        art.sphere('Round mouse ear',(-.24,y,.79),(.19,.08,.21),'purple')
        art.sphere('Pink mouse ear',(-.26,y-.045,.80),(.12,.03,.13),'pink')
    art.sphere('Mouse eye',(-.42,-.29,.58),(.035,.025,.04),'ink')
    art.curve('Toy mouse tail',[(.5,0,.45),(.82,.1,.18),(1.03,-.05,.12),(.9,-.26,.13)],.04,'pink')


def cat():
    rig = art.cat('orange')
    art.cat_pose(rig, 'idle', 0)
    # Use the actual companion's head so coat and expression changes reach icons.
    for obj in list(bpy.context.scene.objects):
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        ancestor = obj
        while ancestor is not None and ancestor != rig['head']:
            ancestor = ancestor.parent
        if ancestor is None:
            bpy.data.objects.remove(obj, do_unlink=True)


def peanut():
    for z in [.50,1.14]: art.sphere('Peanut shell',(0,0,z),(.38,.29,.44),'wood')
    for z in [.34,.56,.86,1.13,1.35]: art.torus('Peanut shell ridge',(0,0,z),.29,.017,'gold')
    for x in [-.14,0,.14]: stroke('Peanut shell groove',[(x,.22),(x,-.02+.83),(x,1.48)],'gold',.014)


def film():
    art.box('Teal movie slate',(0,0,.65),(1.25,.26,.87),'teal',.10)
    art.box('Clapper top',(0,0,1.22),(1.3,.28,.23),'dark',.04)
    for x in [-.42,0,.42]:
        b=art.box('Cream clapper stripe',(x,-.15,1.22),(.16,.025,.22),'cream',.01);b.rotation_euler.y=-.3
    study.extruded_shape('Play on slate',[(-.16,.4),(.27,.65),(-.16,.90)],'cream',.06,(0,-.17,0))


def parent():
    for x,z,r,color in [(-.33,1.25,.28,'teal'),(.39,.89,.21,'gold')]:
        art.sphere('Family head',(x,0,z),(r,r*.65,r),'cream')
        art.sphere('Family shoulder',(x,0,z-r*1.8),(r*1.35,r*.65,r*1.35),color)


def lock():
    art.torus('Lock loop',(0,0,1.04),.35,.105,'gold',rotation=(math.pi/2,0,0))
    art.box('Lock body',(0,-.04,.56),(.96,.33,.78),'teal',.14)
    art.sphere('Keyhole',(0,-.23,.63),(.085,.025,.085),'cream')
    art.box('Keyhole stem',(0,-.23,.51),(.10,.04,.18),'cream',.03)


def trash():
    art.box('Coral waste bin',(0,0,.63),(.86,.64,1.05),'coral',.09)
    art.box('Bin lid',(0,0,1.19),(1.01,.76,.14),'cream',.055)
    art.box('Bin handle',(0,0,1.32),(.34,.15,.13),'teal',.035)
    for x in [-.23,0,.23]: stroke('Bin grooves',[(x,.27),(x,.96)],'cream',.029)


def magnify(sign=None):
    art.torus('Magnifier rim',(0,0,.94),.45,.09,'teal',rotation=(math.pi/2,0,0))
    stroke('Magnifier handle',[(.32,.62),(.76,.16)],'wood',.12)
    if sign: text_symbol(sign,'teal',.65,(0,-.05,.94))


def palette():
    art.sphere('Cream painter palette',(0,0,.8),(.68,.18,.55),'cream')
    for x,z,color in [(-.40,.94,'coral'),(-.13,1.18,'gold'),(.22,1.14,'teal'),(.44,.85,'lilac')]:
        art.sphere('Paint dab',(x,-.17,z),(.12,.05,.12),color)
    stroke('Wood brush',[(-.34,.27),(.36,.85)],'wood',.046)
    art.sphere('Brush bristles',(.43,-.08,.91),(.12,.08,.14),'purple')


def arrow(direction):
    pts=[(-.18,.14),(.18,.14),(.18,.90),(.52,.90),(0,1.47),(-.52,.90),(-.18,.90)]
    angle={'up':0,'down':math.pi,'left':math.pi/2,'right':-math.pi/2}[direction]
    pts=[(x*math.cos(angle)-(z-.8)*math.sin(angle),.8+x*math.sin(angle)+(z-.8)*math.cos(angle)) for x,z in pts]
    study.extruded_shape('Rounded direction arrow',pts,'teal',.20)


def chevron(direction):
    pts=[(-.56,1.12),(-.43,1.24),(0,.81),(.43,1.24),(.56,1.12),(0,.56)]
    angle={'down':0,'up':math.pi,'right':math.pi/2}[direction]
    pts=[(x*math.cos(angle)-(z-.9)*math.sin(angle),.9+x*math.sin(angle)+(z-.9)*math.cos(angle)) for x,z in pts]
    study.extruded_shape('Rounded chevron',pts,'dark',.13)


def check():
    study.extruded_shape('Rounded check',[(-.57,.85),(-.40,1.02),(-.14,.74),(.48,1.39),(.66,1.22),(-.14,.39)],'teal',.20)

def warning():
    study.extruded_shape('Golden warning triangle',[(-.70,.20),(.70,.20),(0,1.51)],'gold',.24)
    text_symbol('!','dark',.85,(0,-.17,.71))


def circular_arrow(reverse=False):
    points=[(.51*math.cos(math.radians(40+i*280/36)),.8+.51*math.sin(math.radians(40+i*280/36))) for i in range(37)]
    if reverse: points=[(-x,z) for x,z in points]
    stroke('Rounded circular arrow',points,'teal',.075)
    x,z=points[-1];sign=-1 if reverse else 1
    study.extruded_shape('Circular arrow head',[(x-.30,z-.16),(x+.27,z-.13),(x+sign*.07,z+.36)],'teal',.17)


def save():
    study.extruded_shape('Teal bookmark',[(-.48,1.45),(.48,1.45),(.48,.2),(0,.5),(-.48,.2)],'teal',.20)
    stroke('Bookmark stripe',[(-.25,1.18),(.25,1.18)],'cream',.04)


def pause():
    for x in [-.27,.27]: art.box('Pause bar',(x,0,.8),(.29,.23,1.1),'teal',.06)


def play_video(): study.extruded_shape('Video play triangle',[(-.48,.18),(.63,.8),(-.48,1.42)],'teal',.23)

def scale():
    stroke('Scale stand',[(0,.23),(0,1.43)],'teal',.065)
    stroke('Scale base',[(-.38,.22),(.38,.22)],'teal',.075)
    stroke('Scale balance beam',[(-.64,1.20),(.64,1.20)],'wood',.055)
    for x in [-.55,.55]:
        for dx in [-.27,.27]: stroke('Scale suspension',[(x,1.2),(x+dx,.72)],'gold',.022)
        art.sphere('Scale pan',(x,0,.67),(.35,.22,.09),'gold')


def apple():
    art.sphere('Apple left',(-.19,0,.69),(.45,.39,.53),'coral')
    art.sphere('Apple right',(.19,0,.69),(.45,.39,.53),'coral')
    stroke('Apple stem',[(0,1.13),(.06,1.47)],'wood',.057)
    leaf=art.sphere('Apple leaf',(.28,0,1.38),(.27,.075,.11),'sage')
    leaf.rotation_euler.y=-.45


def cookie():
    art.cylinder('Golden cookie',(0,0,.8),.67,.19,'gold',rotation=(math.pi/2,0,0))
    for x,z in [(-.32,.94),(.20,1.20),(.36,.65),(-.21,.47),(.02,.8)]:
        art.sphere('Chocolate chip',(x,-.12,z),(.09,.034,.08),'brown')


def cupcake():
    art.cylinder('Cupcake paper',(0,0,.43),.43,.67,'lilac')
    for z,r in [(.85,.50),(1.03,.38),(1.18,.25)]:
        art.sphere('Cream frosting',(0,0,z),(r,r,.18),'cream')
    art.sphere('Coral cherry',(0,0,1.40),(.13,.13,.13),'coral')
    for x in [-.25,0,.25]: stroke('Cupcake paper fold',[(x,.20),(x,.70)],'purple',.018)


def balloon():
    art.sphere('Coral balloon',(0,0,1.13),(.45,.33,.57),'coral')
    study.extruded_shape('Balloon knot',[(-.07,.63),(.07,.63),(.12,.5),(-.12,.5)],'coral',.1)
    stroke('Balloon string',[(0,.56),(.03,.34),(-.08,.10),(.08,-.10)],'wood',.023)


def shell():
    pts=[(-.25,.22),(-.66,.66),(-.60,1.14),(-.37,1.42),(0,1.52),(.37,1.42),(.60,1.14),(.66,.66),(.25,.22)]
    study.extruded_shape('Pearl shell',pts,'pink',.22)
    for x in [-.48,-.24,0,.24,.48]:
        rib=stroke('Shell rib',[(x,1.20),(.5*x,.65),(x*.15,.27)],'cream',.03);rib.location.y=-.06


def sheep():
    for x,z in [(-.35,.58),(0,.58),(.35,.58),(-.35,.87),(0,.92),(.35,.87)]:
        art.sphere('Sheep fleece',(x,0,z),(.27,.30,.26),'cream')
    art.sphere('Sheep head',(-.53,-.17,1.0),(.24,.22,.30),'dark')
    for y in [-.28,.02]: art.sphere('Sheep ear',(-.52,y,1.25),(.13,.07,.16),'dark')
    art.sphere('Sheep eye',(-.64,-.36,1.07),(.04,.026,.043),'cream')
    for x in [-.32,.32]: art.box('Sheep leg',(x,0,.22),(.12,.16,.34),'dark',.045)


def teddy():
    art.sphere('Teddy body',(0,0,.59),(.42,.28,.49),'wood')
    art.sphere('Teddy head',(0,0,1.19),(.41,.28,.36),'wood')
    for x in [-.34,.34]:
        art.sphere('Round teddy ear',(x,0,1.48),(.16,.13,.17),'wood')
        art.sphere('Teddy arm',(x*1.40,0,.82),(.21,.20,.30),'wood')
        art.sphere('Teddy foot',(x,-.12,.22),(.23,.25,.19),'wood')
        art.sphere('Teddy eye',(x*.5,-.27,1.26),(.035,.022,.04),'ink')
    art.sphere('Teddy belly',(0,-.25,.59),(.28,.045,.33),'cream')
    art.sphere('Teddy muzzle',(0,-.26,1.11),(.18,.075,.13),'cream')
    art.sphere('Teddy nose',(0,-.34,1.17),(.05,.025,.037),'ink')


def blue_dot(): art.sphere('Blue counting counter',(0,0,.7),(.58,.22,.58),'blue')


def power():
    points=[(.54*math.cos(math.radians(130+i*280/40)),.8+.54*math.sin(math.radians(130+i*280/40))) for i in range(41)]
    stroke('Teal power ring',points,'teal',.085)
    stroke('Gold power switch',[(0,1.02),(0,1.60)],'gold',.085)


def person():
    art.sphere('Person head',(0,0,1.20),(.27,.20,.27),'cream')
    art.sphere('Person shoulders',(0,0,.60),(.46,.24,.38),'teal')


def bedroom_bed():
    art.box('Wood bed frame', (0, 0, .26), (1.35, 1.95, .25), 'wood', .09)
    for x in [-.50, .50]:
        for y in [-.73, .73]:
            art.cylinder('Bed leg', (x, y, .11), .065, .20, 'wood')
    art.box('Sage headboard', (0, .89, .65), (1.42, .16, .85), 'sage', .10)
    art.box('Soft cream mattress', (0, -.03, .47), (1.28, 1.80, .27), 'cream', .11)
    art.box('Lilac blanket', (0, -.35, .61), (1.29, 1.10, .09), 'lilac', .05)
    art.box('Blanket folded edge', (0, .16, .66), (1.30, .15, .10), 'purple', .04)
    art.box('Cream pillow', (0, .56, .67), (.92, .43, .19), 'white', .09)


def cooking_pot():
    art.cylinder('Teal cooking pot', (0, 0, .49), .60, .68, 'teal')
    art.torus('Pot rim', (0, 0, .84), .57, .055, 'teal')
    art.cylinder('Cream pot lid', (0, 0, .86), .61, .09, 'cream')
    art.sphere('Lid knob', (0, 0, .99), (.12, .12, .10), 'wood')
    for side in [-1, 1]:
        art.curve('Wood pot handle', [(side*.55, -.18, .67), (side*.83, -.18, .67),
                                     (side*.83, .18, .67), (side*.55, .18, .67)], .065, 'wood')


def weather_sun(center=(0, 0, .85), radius=.40):
    x, y, z = center
    art.sphere('Golden sun', center, (radius, .17, radius), 'gold')
    for i in range(8):
        angle = i * math.tau / 8
        art.curve('Soft sun ray', [(x + math.cos(angle) * r, y, z + math.sin(angle) * r)
                                  for r in (radius * 1.35, radius * 1.75)], .045, 'orange')


def weather_cloud():
    for x, z, radius in [(-.42, 1.02, .28), (0, 1.18, .39), (.43, 1.04, .29)]:
        art.sphere('Soft weather cloud', (x, -.10, z), (radius, .22, radius), 'white')
    art.box('Cloud rounded base', (0, -.10, .91), (1.12, .35, .32), 'white', .15)


def weather_moon():
    outer = [(.68*math.cos(math.radians(58+i*244/40)), .68*math.sin(math.radians(58+i*244/40))) for i in range(41)]
    inner = [(.37+.51*math.cos(math.radians(-92-i*176/30)), .51*math.sin(math.radians(-92-i*176/30))) for i in range(31)]
    study.extruded_shape('Cool crescent moon', outer+inner, 'cream', .22, (0, 0, .79))
    for x,z,r in [(.51,1.10,.22),(.78,1.48,.11)]:
        points = [(x+math.cos(math.pi/2+i*math.pi/4)*(r if i%2==0 else r*.3),
                   z+math.sin(math.pi/2+i*math.pi/4)*(r if i%2==0 else r*.3)) for i in range(8)]
        study.extruded_shape('Blue night star', points, 'blue', .15)


def weather_rain():
    weather_cloud()
    for x,z in [(-.43,.43),(0,.30),(.43,.43)]:
        study.extruded_shape('Blue raindrop', [(x,z+.22),(x-.10,z+.04),(x-.10,z-.05),
                              (x,z-.12),(x+.10,z-.05),(x+.10,z+.04)], 'blue', .12)


def weather_snow():
    weather_cloud()
    for x,z in [(-.43,.40),(0,.25),(.43,.40)]:
        for i in range(3):
            a = i * math.pi / 3
            art.curve('Snowflake arm', [(x + side*.16*math.cos(a), -.12, z + side*.16*math.sin(a))
                                       for side in (-1,1)], .032, 'blue')


def weather_leaves():
    for x,z,r,angle,color in [(-.30,1.18,.50,-.35,'orange'),(.33,.58,.46,.55,'gold')]:
        points = [(0,-r),(-r*.48,-r*.25),(-r*.50,r*.30),(0,r),(r*.50,r*.30),(r*.48,-r*.25)]
        turn = lambda p: (x+p[0]*math.cos(angle)-p[1]*math.sin(angle), z+p[0]*math.sin(angle)+p[1]*math.cos(angle))
        study.extruded_shape('Drifting autumn leaf', [turn(p) for p in points], color, .13)
        stroke('Leaf vein', [turn((0,-r*.85)),turn((0,r*.70))], 'wood', .023)


def weather_auto():
    weather_sun((-.32, .15, 1.36), .30)
    weather_cloud()


extra=[('heart',heart),('broken-heart',lambda:heart(True)),('coin',coin),('sparkle',sparkle),
       ('flame',flame),('brain',brain),('lightbulb',lightbulb),('ball',ball),('feather',feather),('box',box),('mouse',mouse),
       ('cat',cat),('nut',peanut),('film',film),('parent',parent),('lock',lock),('trash',trash),
       ('search',magnify),('zoom-in',lambda:magnify('+')),('zoom-out',lambda:magnify('-')),
       ('palette',palette),('check',check),('warning',warning),('rotate',circular_arrow),
       ('undo',lambda:circular_arrow(True)),('restore',circular_arrow),('save',save),
       ('pause',pause),('video-play',play_video),('scale',scale),
       ('bed',lambda:art.bed('bedA')),('bedroom-bed',bedroom_bed),('bathtub',lambda:art.bathroom('bathroomBathAni')),
       ('cooking-pot',cooking_pot),('plant',lambda:art.plant('plantA')),
       ('power',power),('teddy',teddy),('blue-dot',blue_dot),('apple',apple),('cookie',cookie),('cupcake',cupcake),('balloon',balloon),('shell',shell),
       ('sheep',sheep),('person',person),('chair',lambda:art.chair('chairA')),('book',lambda:art.book('bookA'))]
extra += [('arrow-'+d,lambda d=d:arrow(d)) for d in ['up','down','left','right']]
extra += [('chevron-'+d,lambda d=d:chevron(d)) for d in ['up','down','right']]
extra += [(name,lambda label=label,color=color:tile(label,color)) for name,label,color in [
    ('addition','+','teal'),('subtraction','−','coral'),('multiplication','×','gold'),
    ('division','÷','lilac'),('equality','=','teal'),('patterns','123','lilac'),
    ('fractions','½','coral'),('operations','±','gold')]]
extra += [('weather-sun',weather_sun),('weather-moon',weather_moon),('weather-rain',weather_rain),
          ('weather-snow',weather_snow),('weather-leaves',weather_leaves),('weather-auto',weather_auto)]
# The starter family has its own editable library and rebuild command.
extra = study.select_builders(extra, study.OUT, 'icons.blend')
study.render_set(extra, study.OUT, 256)
