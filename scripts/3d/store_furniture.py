"""Authored room furniture and friendly Halloween props, shared by PNG and GLB exports."""
import math
import bpy
from home_details import HOME_DETAIL_IDS, build_home_detail
from wall_spotlights import WALL_SPOTLIGHT_IDS, build_wall_spotlight
from kitchen_additions import KITCHEN_ADDITION_IDS, build_kitchen_addition
from bathroom_additions import BATHROOM_ADDITION_IDS, build_bathroom_addition, add_bathroom_controls

STORE_FURNITURE_IDS = {
    'sofaBlueClassic', 'sofaRoseTufted', 'sofaTanLeather', 'sofaCreamCloud',
    'kitchenFridge', 'kitchenRange', 'kitchenSinkCabinet', 'kitchenDiningTable',
    'kitchenMicrowave', 'kitchenBreadBasket',
    'bedroomDoubleBed', 'bedroomDresser', 'bedroomNightstand', 'bedroomWardrobe',
    'bedroomFloorLamp', 'bathroomDoubleVanity', 'bathroomShowerCabin',
    'bathroomLaundryHamper', 'bathroomTowelStand', 'halloweenPumpkin',
    'halloweenGhostLantern', 'halloweenBatGarland', 'halloweenWitchHat',
    'halloweenCauldron',
}
STORE_FURNITURE_IDS.update(HOME_DETAIL_IDS)
STORE_FURNITURE_IDS.update(WALL_SPOTLIGHT_IDS)
STORE_FURNITURE_IDS.update(KITCHEN_ADDITION_IDS)
STORE_FURNITURE_IDS.update(BATHROOM_ADDITION_IDS)


def build_store_furniture(id, h):
    before = set(bpy.context.scene.objects)
    box, sphere, cylinder, torus, curve = (h[k] for k in ('box', 'sphere', 'cylinder', 'torus', 'curve'))

    def cone(name, loc, bottom, top, height, color):
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=bottom, radius2=top, depth=height, location=loc)
        obj = bpy.context.object
        for face in obj.data.polygons:
            face.use_smooth = True
        return h['finish'](obj, name, color)

    def silhouette(name, points, y, color, thickness=.025):
        # An extruded silhouette keeps faces and wings readable in native 3D.
        n = len(points)
        vertices = [(x, y + dy, z) for dy in (0, thickness) for x, z in points]
        faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, n * 2))]
        faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return h['finish'](obj, name, color)

    def feet(width, depth, height=.16, color='wood'):
        for x in (-width / 2 + .12, width / 2 - .12):
            for y in (-depth / 2 + .12, depth / 2 - .12):
                cylinder('Furniture foot', (x, y, height / 2), .055, height, color)

    def handle(x, y, z, width=.25):
        box('Brass handle', (x, y, z), (width, .065, .04), 'gold', .015)

    def cabinet(width, depth, height, color, drawers=False):
        feet(width, depth)
        box('Cabinet carcass', (0, 0, .16 + height / 2), (width, depth, height), color, .05)
        if drawers:
            for z in (.16 + height / 6, .16 + height / 2, .16 + height * 5 / 6):
                box('Drawer face', (0, -depth / 2 - .016, z), (width - .10, .045, height / 3 - .035), color, .015)
                handle(0, -depth / 2 - .058, z)
        else:
            for x in (-width / 4, width / 4):
                box('Cabinet door', (x, -depth / 2 - .018, .16 + height / 2), (width / 2 - .055, .05, height - .07), color, .025)
                handle(x / 3, -depth / 2 - .066, .16 + height * .62, .13)

    def basin(x, y, z):
        cylinder('Basin recess', (x, y, z), .22, .025, 'grey')
        torus('Porcelain basin rim', (x, y, z + .018), .22, .04, 'white')
        cylinder('Drain', (x, y, z + .02), .035, .012, 'silver')
        curve('Gooseneck faucet', [(x, y + .26, z), (x, y + .26, z + .32), (x, y + .08, z + .32), (x, y + .07, z + .23)], .022, 'silver')
        sphere('Tap handle', (x + .09, y + .25, z + .06), (.055, .035, .025), 'gold')

    if id in WALL_SPOTLIGHT_IDS:
        build_wall_spotlight(id, h)
    elif id in BATHROOM_ADDITION_IDS:
        build_bathroom_addition(id, h)
    elif id in KITCHEN_ADDITION_IDS:
        build_kitchen_addition(id, h)
    elif id in HOME_DETAIL_IDS:
        build_home_detail(id, h)
    elif id.startswith('sofa'):
        color = {'sofaBlueClassic': 'blue', 'sofaRoseTufted': 'pink', 'sofaTanLeather': 'brown', 'sofaCreamCloud': 'cream'}[id]
        cloud = id == 'sofaCreamCloud'
        feet(2.4, 1.08, .20, 'gold' if id == 'sofaRoseTufted' else 'wood')
        box('Upholstered base', (0, 0, .37), (2.4, 1.12, .32), color, .15)
        # Every variant retains the open .70-high resting surface used by the cat.
        box('Sofa back', (0, .43, .97), (2.4, .28, .88), color, .13)
        for x in (-1.09, 1.09):
            if cloud:
                sphere('Cloud arm', (x, -.02, .63), (.19, .60, .29), color)
            else:
                box('Rolled arm', (x, -.02, .64), (.30, 1.10, .57), color, .13)
                if id == 'sofaTanLeather':
                    box('Wooden arm trim', (x, -.02, .83), (.31, 1.08, .065), 'wood', .03)
        count = 3 if cloud else 2
        for i in range(count):
            x = (i - (count - 1) / 2) * (1.86 / count)
            box('Seat cushion', (x, -.10, .59), (1.86 / count - .035, .86, .22), color, .10)
            box('Back cushion', (x, .235, 1.02), (1.86 / count - .035, .20, .59), color, .09)
        if id == 'sofaRoseTufted':
            for x in (-.73, -.24, .24, .73):
                for z in (.94, 1.16):
                    sphere('Tuft button', (x, .12, z), (.025, .014, .025), 'rose')
        if id == 'sofaBlueClassic':
            pillow = box('Striped accent pillow', (.78, .03, .90), (.24, .15, .32), 'cream', .07)
            pillow.rotation_euler.y = -.18
            for z in (.82, .91, 1.0):
                box('Pillow stripe', (.78, -.052, z), (.23, .009, .021), 'coral', .004)

    elif id == 'kitchenFridge':
        box('Retro fridge', (0, 0, 1.03), (1.10, .88, 2.04), 'teal', .13)
        for z, height in ((.72, 1.29), (1.71, .61)):
            box('Fridge door', (0, -.46, z), (1.02, .09, height), 'teal', .07)
        for z in (1.16, 1.60):
            box('Chrome fridge handle', (-.34, -.54, z), (.075, .085, .29), 'silver', .025)
        box('Fridge badge', (.16, -.517, 1.80), (.22, .018, .065), 'cream', .014)
        feet(1.1, .88, .07, 'dark')

    elif id == 'kitchenRange':
        cabinet(1.20, .94, .79, 'cream')
        box('Oven front', (0, -.515, .51), (1.04, .035, .56), 'grey', .04)
        box('Oven window', (0, -.54, .48), (.83, .016, .36), 'dark', .055)
        handle(0, -.59, .73, .68)
        box('Cooktop', (0, 0, .99), (1.23, .97, .08), 'silver', .035)
        for x in (-.29, .29):
            for y in (-.24, .24):
                cylinder('Burner', (x, y, 1.037), .16, .025, 'dark')
                torus('Burner ring', (x, y, 1.06), .11, .015, 'grey')
        for x in (-.38, -.13, .13, .38):
            cylinder('Oven knob', (x, -.54, .88), .045, .035, 'gold', rotation=(math.pi / 2, 0, 0))

    elif id in ('kitchenSinkCabinet', 'bathroomDoubleVanity'):
        width = 2.0 if id == 'bathroomDoubleVanity' else 1.45
        cabinet(width, .95, .77, 'sage' if id.startswith('kitchen') else 'teal')
        box('Stone counter', (0, 0, .98), (width + .08, 1.02, .10), 'white', .04)
        for x in (-.49, .49) if width == 2.0 else (0,):
            basin(x, -.05, 1.05)
        box('Soap bottle', (width / 2 - .12, .25, 1.15), (.11, .10, .22), 'pink', .035)
        box('Soap pump', (width / 2 - .12, .25, 1.28), (.11, .035, .03), 'gold', .01)

    elif id == 'kitchenDiningTable':
        cylinder('Round oak tabletop', (0, 0, .98), .95, .14, 'wood')
        for x in (-.48, .48):
            for y in (-.48, .48):
                box('Tapered table leg', (x, y, .46), (.10, .10, .92), 'wood', .025)
        cylinder('Ceramic fruit bowl', (0, 0, 1.10), .22, .10, 'white')
        torus('Bowl rim', (0, 0, 1.16), .20, .035, 'white')
        for x, y, color in ((-.09, 0, 'red'), (.08, .04, 'green'), (.02, -.08, 'orange')):
            sphere('Fruit', (x, y, 1.21), (.09, .09, .10), color)

    elif id == 'kitchenMicrowave':
        box('Microwave casing', (0, 0, .31), (1.05, .70, .60), 'cream', .055)
        box('Microwave glass', (-.10, -.356, .32), (.68, .025, .40), 'dark', .025)
        box('Glass reflection', (-.22, -.375, .36), (.37, .005, .03), 'grey', .006)
        box('Digital clock', (.37, -.364, .47), (.16, .025, .095), 'teal', .015)
        for z in (.22, .34):
            cylinder('Microwave dial', (.37, -.378, z), .038, .028, 'gold', rotation=(math.pi / 2, 0, 0))
        feet(1.05, .70, .04, 'dark')

    elif id == 'kitchenBreadBasket':
        box('Woven basket', (0, 0, .14), (.84, .57, .28), 'wood', .10)
        for z in (.08, .16, .24):
            box('Basket weave', (0, -.289, z), (.74, .018, .018), 'gold', .005)
        box('Linen napkin', (0, 0, .28), (.76, .49, .045), 'cream', .025)
        for x in (-.21, .14):
            sphere('Bread loaf', (x, 0, .37), (.17, .22, .12), 'gold')
            for y in (-.10, 0, .10):
                curve('Bread scoring', [(x - .08, y, .465), (x, y + .018, .485), (x + .08, y, .465)], .012, 'cream')

    elif id == 'bedroomDoubleBed':
        feet(1.78, 2.22, .18)
        box('Oak bed frame', (0, 0, .30), (1.78, 2.22, .27), 'wood', .07)
        box('Upholstered headboard', (0, .99, .79), (1.84, .15, 1.25), 'rose', .09)
        box('Mattress', (0, -.02, .49), (1.65, 2.06, .27), 'cream', .10)
        box('Sage duvet', (0, -.32, .64), (1.68, 1.50, .14), 'sage', .085)
        box('Folded duvet edge', (0, .34, .69), (1.69, .18, .085), 'green', .035)
        for x in (-.42, .42):
            box('Bed pillow', (x, .66, .68), (.67, .40, .18), 'white', .08)
        box('Knitted throw', (.49, -.60, .735), (.46, .95, .065), 'pink', .025)
        for y in (-.98, -.86, -.74, -.62, -.50, -.38, -.26):
            box('Throw stripe', (.49, y, .773), (.44, .024, .008), 'cream', .003)

    elif id in ('bedroomDresser', 'bedroomNightstand', 'bedroomWardrobe'):
        wardrobe = id == 'bedroomWardrobe'
        width, depth, height = (1.50, .75, 1.94) if wardrobe else ((1.48, .73, .97) if id == 'bedroomDresser' else (.70, .58, .53))
        cabinet(width, depth, height, 'wood', drawers=not wardrobe)
        box('Rounded cabinet top', (0, 0, .19 + height), (width + .06, depth + .05, .065), 'wood', .025)
        if wardrobe:
            for x in (-.39, .39):
                box('Inset oak panel', (x, -.425, 1.12), (.55, .02, 1.60), 'paper', .035)
                box('Wardrobe door handle', (x / 3, -.46, 1.13), (.04, .05, .28), 'gold', .012)
        else:
            box('Bedside book', (-.10, -.06, height + .24), (.32, .30, .045), 'blue', .01)
            cylinder('Small ceramic vase', (.18, .10, height + .31), .09, .20, 'pink')
            curve('Flower stem', [(.18, .10, height + .39), (.17, .10, height + .56)], .012, 'green')
            sphere('Little flower', (.17, .10, height + .58), (.09, .04, .09), 'gold')

    elif id == 'bedroomFloorLamp':
        cylinder('Lamp base', (0, 0, .07), .31, .13, 'wood')
        cylinder('Brass lamp stem', (0, 0, .85), .035, 1.55, 'gold')
        cone('Pleated lampshade', (0, 0, 1.63), .43, .26, .49, 'cream')
        torus('Shade bottom piping', (0, 0, 1.385), .43, .014, 'gold')
        torus('Shade top piping', (0, 0, 1.875), .26, .012, 'gold')
        for i in range(16):
            a = i * math.tau / 16
            curve('Shade seam', [(.43 * math.cos(a), .43 * math.sin(a), 1.40), (.26 * math.cos(a), .26 * math.sin(a), 1.86)], .005, 'paper')

    elif id == 'bathroomShowerCabin':
        box('Raised shower tray', (0, 0, .10), (1.32, 1.22, .20), 'white', .075)
        box('Shower floor', (0, -.03, .205), (1.15, 1.05, .018), 'paper', .025)
        cylinder('Shower drain', (0, 0, .22), .07, .012, 'silver')
        box('Frosted back panel', (0, .55, 1.18), (1.22, .05, 1.92), 'blue', .02)
        # Open front and thin rails keep the cabin readable without alpha sorting.
        for x in (-.62, .62):
            box('Shower upright', (x, .53, 1.18), (.055, .07, 1.98), 'silver', .014)
        box('Shower top rail', (0, .53, 2.16), (1.28, .07, .055), 'silver', .014)
        box('Side glass frame', (.62, 0, 2.16), (.055, 1.10, .055), 'silver', .014)
        box('Front upright', (.62, -.54, 1.18), (.055, .055, 1.98), 'silver', .014)
        curve('Shower pipe', [(0, .49, .85), (0, .49, 1.95), (0, .22, 2.0)], .023, 'silver')
        cylinder('Rain shower head', (0, .19, 1.99), .18, .06, 'silver')
        cylinder('Shower mixer', (0, .475, .95), .07, .07, 'silver', rotation=(math.pi / 2, 0, 0))
        box('Soap ledge', (-.38, .39, .94), (.25, .24, .05), 'white', .02)
        box('Shampoo bottle', (-.38, .40, 1.07), (.09, .09, .20), 'pink', .025)
        add_bathroom_controls('shower', h, (0, -.08, .22), outlet=(0, .19, 1.94))

    elif id == 'bathroomLaundryHamper':
        cylinder('Woven hamper', (0, 0, .39), .34, .76, 'wood')
        torus('Basket rim', (0, 0, .78), .33, .035, 'gold')
        for z in (.13, .23, .33, .43, .53, .63, .73):
            torus('Woven band', (0, 0, z), .341, .013, 'paper')
        for i in range(12):
            a = i * math.tau / 12
            curve('Basket rib', [(.338 * math.cos(a), .338 * math.sin(a), .08), (.338 * math.cos(a), .338 * math.sin(a), .73)], .008, 'gold')
        box('Blue folded towel', (-.06, 0, .80), (.43, .40, .11), 'blue', .055)
        box('Cream folded towel', (.04, .04, .89), (.39, .32, .09), 'cream', .045)

    elif id == 'bathroomTowelStand':
        for x in (-.40, .40):
            box('Stand foot', (x, 0, .055), (.10, .50, .11), 'wood', .035)
            cylinder('Towel upright', (x, 0, .63), .035, 1.22, 'wood')
        bar = cylinder('Towel rail', (0, 0, 1.23), .035, .86, 'wood')
        bar.rotation_euler.y = math.pi / 2
        box('Hanging bath towel', (-.09, -.035, .90), (.48, .065, .66), 'teal', .025)
        for z in (.62, .68):
            box('Towel border', (-.09, -.073, z), (.45, .008, .021), 'cream', .004)

    elif id == 'halloweenPumpkin':
        for i in range(9):
            a = i * math.tau / 9
            sphere('Pumpkin lobe', (.15 * math.cos(a), .15 * math.sin(a), .36), (.25, .25, .33), 'orange')
        cylinder('Pumpkin stem', (0, 0, .71), .055, .18, 'green')
        for x in (-.145, .145):
            silhouette('Carved triangle eye', [(x - .072, .43), (x + .072, .43), (x, .54)], -.386, 'brown')
        silhouette('Pumpkin smile', [(-.20, .32), (-.12, .23), (0, .20), (.12, .23), (.20, .32), (.08, .28), (0, .265), (-.08, .28)], -.398, 'brown')

    elif id == 'halloweenGhostLantern':
        cylinder('Lantern foot', (0, 0, .04), .29, .08, 'gold')
        sphere('Ghost body', (0, 0, .43), (.29, .24, .38), 'cream')
        for x in (-.22, -.11, 0, .11, .22):
            sphere('Scalloped ghost hem', (x, -.015, .13), (.09, .22, .11), 'cream')
        for x in (-.085, .085):
            sphere('Friendly ghost eye', (x, -.235, .50), (.027, .012, .037), 'dark')
        curve('Ghost smile', [(-.045, -.242, .41), (0, -.25, .385), (.045, -.242, .41)], .009, 'dark')
        torus('Lantern handle', (0, 0, .85), .09, .018, 'gold', rotation=(math.pi / 2, 0, 0))

    elif id == 'halloweenBatGarland':
        points = [(-1.1, 0, 1.15), (-.55, 0, 1.02), (0, 0, .97), (.55, 0, 1.02), (1.1, 0, 1.15)]
        curve('Garland cord', points, .015, 'gold')
        wing = [(-.31, .07), (-.23, .11), (-.10, .03), (-.055, .12), (-.02, .075), (.02, .075), (.055, .12), (.10, .03), (.23, .11), (.31, .07), (.25, -.055), (.19, -.025), (.15, -.10), (.09, -.055), (.05, -.12), (0, -.07), (-.05, -.12), (-.09, -.055), (-.15, -.10), (-.19, -.025), (-.25, -.055)]
        for x in (-.70, 0, .70):
            z = .83 + .12 * abs(x)
            curve('Bat hanging loop', [(x, 0, z + .10), (x, 0, z + .20)], .009, 'gold')
            silhouette('Little bat', [(x + dx, z + dz) for dx, dz in wing], -.02, 'purple', .065)
            for dx in (-.03, .03):
                sphere('Bat eye', (x + dx, -.028, z + .03), (.009, .007, .009), 'cream')
        for x in (-1.1, 1.1):
            sphere('Garland wall peg', (x, .01, 1.15), (.035, .03, .035), 'gold')

    elif id == 'halloweenWitchHat':
        brim = cylinder('Wide hat brim', (0, 0, .06), .48, .11, 'purple')
        brim.scale.y = .88
        cone('Pointed hat', (0, 0, .40), .29, .025, .72, 'purple')
        cone('Gold hat band', (0, 0, .20), .25, .22, .09, 'gold')
        box('Hat buckle', (0, -.25, .20), (.13, .025, .12), 'wood', .015)
        box('Buckle inset', (0, -.267, .20), (.065, .012, .055), 'purple', .007)

    elif id == 'halloweenCauldron':
        for x, y in ((-.22, -.18), (.22, -.18), (0, .23)):
            sphere('Cauldron foot', (x, y, .07), (.07, .07, .09), 'dark')
        sphere('Round cauldron', (0, 0, .32), (.37, .34, .29), 'dark')
        torus('Cauldron lip', (0, 0, .55), .29, .045, 'dark')
        cylinder('Mint potion', (0, 0, .555), .275, .018, 'teal')
        for x, y, radius in ((-.11, .06, .075), (.10, -.03, .055), (.01, .13, .045)):
            sphere('Potion bubble', (x, y, .59), (radius, radius, radius), 'green')
        for x in (-.37, .37):
            torus('Pot handle', (x, 0, .40), .095, .023, 'gold', rotation=(0, math.pi / 2, 0))
        star = [(math.sin(i * math.pi / 5) * (.10 if i % 2 == 0 else .043), .32 + math.cos(i * math.pi / 5) * (.10 if i % 2 == 0 else .043)) for i in range(10)]
        silhouette('Cauldron star', star, -.345, 'gold')
    else:
        raise ValueError('Missing store furniture builder: ' + id)

    # Curve control-point bounds can dwarf small detail strokes. Use their
    # actual beveled geometry for thumbnail framing and room collision bounds.
    for obj in set(bpy.context.scene.objects) - before:
        if obj.type == 'CURVE':
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target='MESH')
    for obj in set(bpy.context.scene.objects) - before:
        obj['store_furniture'] = True
