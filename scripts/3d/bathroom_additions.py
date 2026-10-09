"""Hollow freestanding baths and jetted tubs, shared by shop thumbnails and native 3D."""
import math
import bpy

BATHROOM_ADDITION_IDS = {
    'bathroomBathOvalWhite', 'bathroomBathOvalSage', 'bathroomBathOvalRose',
    'bathroomBathOvalCharcoal', 'bathroomBathClawfootCream',
    'bathroomBathClawfootNavy', 'bathroomJacuzziWhite', 'bathroomJacuzziSage',
}


def add_bathroom_controls(kind, h, contact, water_z=None, outlet=None):
    anchor = h['empty']('Bathroom contact', contact)
    anchor['bathroom_kind'] = kind
    if outlet:
        h['empty']('Bathroom water outlet', outlet)
        for i in range(8):
            spread = .045 if kind == 'bath' else .11
            drop = h['sphere']('Bathroom water drop ' + str(i + 1),
                               (outlet[0] + spread * math.sin(i * 2.4), outlet[1] + spread * math.cos(i * 2.4), outlet[2]),
                               (.012, .012, .055), 'blue')
            drop.hide_render = True
    if water_z is not None:
        for i in range(3):
            ripple = h['torus']('Bathroom wash ripple ' + str(i + 1),
                                (-.35 + i * .35, -.12, water_z + .008), .12 + i * .025, .010, 'white')
            ripple.hide_render = True


def build_bathroom_addition(id, h):
    box, sphere, cylinder, torus, curve = (h[k] for k in ('box', 'sphere', 'cylinder', 'torus', 'curve'))
    material, finish = h['material'], h['finish']
    jacuzzi = id.startswith('bathroomJacuzzi')
    clawfoot = id.startswith('bathroomBathClawfoot')
    color = ('sage' if id.endswith('Sage') else 'pink' if id.endswith('Rose')
             else 'dark' if id.endswith('Charcoal') else 'cream' if id.endswith('Cream')
             else '334F6C' if id.endswith('Navy') else 'white')
    ceramic = material('Bath exterior ' + color, h['PALETTE'].get(color, color), roughness=.28)
    porcelain = material('Bath porcelain', 'FFF9F0', roughness=.22)
    chrome = material('Bath chrome', 'BCC7CF', roughness=.24, metallic=.65)
    brass = material('Bath brass', 'D4AD69', roughness=.28, metallic=.5)
    water = material('Bath water', '91CEDA', roughness=.24)
    rectangular = id == 'bathroomBathAni'
    exponent = 6 if rectangular else 3.8 if jacuzzi else 2
    width, depth = (1, .53) if rectangular else (1.15, .95) if jacuzzi else (1.23, .61)
    base = .24 if clawfoot else .045
    segments = 64

    def outline(x, y, z, index):
        angle = math.tau * index / segments
        c, s = math.cos(angle), math.sin(angle)
        return (x * math.copysign(abs(c) ** (2 / exponent), c),
                y * math.copysign(abs(s) ** (2 / exponent), s), z)

    def profile_mesh(name, rings, colors):
        # Continuous outer shell, rounded lip and recessed liner. No solid box
        # covers the water; each ring is joined to its neighbour with quads.
        vertices = [outline(x, y, z, i) for x, y, z in rings for i in range(segments)]
        faces = []
        for r in range(len(rings) - 1):
            faces.extend((r * segments + i, r * segments + (i + 1) % segments,
                          (r + 1) * segments + (i + 1) % segments, (r + 1) * segments + i)
                         for i in range(segments))
        faces.append(tuple(range(segments - 1, -1, -1)))
        faces.append(tuple((len(rings) - 1) * segments + i for i in range(segments)))
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(ceramic)
        obj.data.materials.append(porcelain)
        for face in mesh.polygons:
            face.use_smooth = len(face.vertices) == 4
            face.material_index = colors[min(face.index // segments, len(colors) - 1)]
        return obj

    top = .735 if rectangular else base + (.80 if jacuzzi else .68)
    profile_mesh('Jetted tub shell' if jacuzzi else 'Clawfoot bath shell' if clawfoot else 'Oval bath shell', [
        (width * .76, depth * .76, base),
        (width * .86, depth * .86, base + .06),
        (width * .99, depth * .99, top - .09),
        (width, depth, top - .025),
        (width * .985, depth * .985, top),
        (width - .115, depth - .115, top),
        (width - .145, depth - .145, top - .05),
        (width * .73, depth * .67, base + .17),
    ], [0, 0, 0, 1, 1, 1, 1, 1])

    water_z = top - (.18 if jacuzzi else .145)
    water_x, water_y = width - .21, depth - .20
    vertices = [(0, 0, water_z)] + [outline(water_x, water_y, water_z, i) for i in range(segments)]
    mesh = bpy.data.meshes.new('Recessed bath water')
    mesh.from_pydata(vertices, [], [(0, i + 1, (i + 1) % segments + 1) for i in range(segments)])
    mesh.update()
    obj = bpy.data.objects.new('Recessed bath water', mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, obj.name, water)

    metal = brass if clawfoot else chrome
    faucet_y = depth * .86
    curve('Bath gooseneck faucet', [(0, faucet_y, top), (0, faucet_y, top + .32),
                                   (0, faucet_y - .21, top + .35), (0, faucet_y - .29, top + .22)], .027, metal)
    for x in (-.17, .17):
        cylinder('Bath tap base', (x, faucet_y, top + .018), .048, .035, metal)
        box('Bath tap handle', (x, faucet_y, top + .05), (.12, .035, .025), metal, .012)
    add_bathroom_controls('bath', h, (0, 0, water_z - .10), water_z,
                         (0, faucet_y - .29, top + .20))
    if rectangular:
        for i in range(3):
            torus('Water ripple', (-.30 + i * .30, 0, water_z + .015), .10 + i * .03, .012, 'cream')

    if clawfoot:
        for x in (-.79, .79):
            for y in (-.36, .36):
                curve('Curved clawfoot leg', [(x * .92, y * .92, base + .10),
                                             (x, y, .15), (x * 1.06, y * 1.08, .07)], .052, brass)
                sphere('Clawfoot paw', (x * 1.06, y * 1.08, .065), (.095, .08, .055), brass)
    elif not jacuzzi:
        cylinder('Recessed bath plinth', (0, 0, .035), .52, .07, ceramic).scale.x = 1.6

    if jacuzzi:
        for x in (-.71, .71):
            box('Jacuzzi seat ledge', (x, .10, water_z - .06), (.38, 1.10, .16), porcelain, .07)
            box('Jacuzzi headrest', (x, .77, top + .025), (.43, .15, .12), 'dark', .045)
            # Visible jet collars sit on the inner rear wall above the water.
            for dx in (-.10, .10):
                torus('Jacuzzi jet collar', (x + dx, depth - .15, water_z + .07), .043, .009,
                      chrome, rotation=(math.pi / 2, 0, 0))
                cylinder('Jacuzzi jet nozzle', (x + dx, depth - .147, water_z + .07), .027, .018,
                         'grey', rotation=(math.pi / 2, 0, 0))
            for y in (-.40, -.03, .34):
                ring = torus('Jacuzzi water bubbles', (x * .6, y, water_z + .006), .07, .007, 'white')
                ring.scale.y = .75
        box('Jacuzzi control panel', (.74, -.86, top + .014), (.26, .10, .022), 'dark', .015)
        for x in (.66, .74, .82):
            cylinder('Jacuzzi control button', (x, -.86, top + .03), .020, .012, 'silver')
