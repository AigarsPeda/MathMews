"""Kitchen storage, counter seating, mixers, dining chairs and cozy living-room pieces."""
import math
import bpy

KITCHEN_ADDITION_IDS = {
    'kitchenWallCabinetSage', 'kitchenWallCabinetOak', 'kitchenWallCabinetGlass',
    'kitchenIsland', 'kitchenBarStoolOak', 'kitchenBarStoolMetal',
    'kitchenBarStoolVelvet', 'kitchenMixerStand', 'kitchenMixerHand',
    'kitchenChairWindsor', 'kitchenChairMint', 'kitchenChairUpholstered',
    'kitchenChairBistro', 'chairRockingOak', 'livingFireplaceCream',
}


def build_kitchen_addition(id, h):
    box, sphere, cylinder, torus, curve = (h[k] for k in ('box', 'sphere', 'cylinder', 'torus', 'curve'))

    def handle(x, y, z, width=.19, color='gold'):
        box('Cabinet handle', (x, y, z), (width, .05, .035), color, .012)

    def splayed_legs(seat_height, color, spread=.30):
        for x in (-1, 1):
            for y in (-1, 1):
                curve('Splayed chair leg', [(x * spread, y * spread, .03), (x * spread * .80, y * spread * .80, seat_height)], .033, color)

    if id.startswith('kitchenWallCabinet'):
        glass = id == 'kitchenWallCabinetGlass'
        color = 'sage' if id == 'kitchenWallCabinetSage' else 'wood'
        width, depth, height = 1.72, .47, 1.00
        box('Cabinet back', (0, .19, .54), (width, .10, height), color, .04)
        for x in (-width / 2, width / 2):
            box('Cabinet side', (x, 0, .54), (.10, depth, height), color, .022)
        for z in (.05, 1.03):
            box('Cabinet top and bottom', (0, 0, z), (width + .10, depth, .10), color, .025)
        if glass:
            box('Display cabinet backing', (0, .127, .54), (1.59, .018, .88), 'blue', .01)
            box('Center display shelf', (0, -.01, .52), (1.61, .41, .04), 'wood', .01)
            for x in (-.46, .42):
                for z in (.10, .55):
                    for i in range(3):
                        cylinder('Stacked porcelain plate', (x, -.04, z + .04 + i * .025), .17, .021, 'cream')
                    torus('Plate rim', (x, -.04, z + .11), .14, .011, 'cream')
            for x in (-.85, 0, .85):
                box('Glass door mullion', (x, -.245, .54), (.055, .06, .93), 'wood', .012)
            for z in (.08, 1.0):
                box('Glass door rail', (0, -.245, z), (1.72, .06, .055), 'wood', .012)
            for x in (-.61, .21):
                highlight = box('Glass door reflection', (x, -.257, .76), (.025, .012, .29), 'cream', .008)
                highlight.rotation_euler.y = -.17
            handle(-.11, -.29, .50, .09)
            handle(.11, -.29, .50, .09)
        else:
            for x in (-.43, .43):
                box('Wall cabinet door', (x, -.255, .54), (.81, .07, .92), color, .035)
                if id == 'kitchenWallCabinetOak':
                    box('Oak door panel border', (x, -.297, .55), (.66, .026, .75), 'paper', .02)
                    box('Inset oak door panel', (x, -.315, .55), (.56, .015, .64), 'wood', .015)
                handle(x / 3, -.312 if color == 'sage' else -.341, .40, .12)

    elif id == 'kitchenIsland':
        box('Island recessed plinth', (0, 0, .075), (1.78, .88, .15), 'wood', .035)
        box('Sage island cabinetry', (0, 0, .60), (1.98, 1.04, .99), 'sage', .07)
        box('Thick stone worktop', (0, -.06, 1.16), (2.30, 1.30, .14), 'cream', .045)
        for x in (-.51, .51):
            box('Island drawer', (x, -.546, .91), (.93, .05, .24), 'sage', .02)
            box('Island cupboard door', (x, -.546, .45), (.93, .05, .61), 'sage', .025)
            handle(x, -.595, .91, .22)
            handle(x / 2, -.595, .65, .14)
        box('Chopping board', (.60, .22, 1.26), (.49, .34, .045), 'wood', .045)
        box('Board handle', (.90, .22, 1.26), (.15, .13, .035), 'wood', .025)
        cylinder('Cream countertop bowl', (-.61, .10, 1.29), .15, .12, 'white')
        torus('Bowl rim', (-.61, .10, 1.36), .14, .02, 'white')
        sphere('Green apple', (-.61, .10, 1.39), (.08, .08, .085), 'green')

    elif id.startswith('kitchenBarStool'):
        if id == 'kitchenBarStoolMetal':
            cylinder('Wide stool base', (0, 0, .055), .31, .11, 'silver')
            cylinder('Pedestal stool stem', (0, 0, .47), .047, .78, 'silver')
            torus('Circular footrest', (0, 0, .29), .24, .020, 'silver')
            cylinder('Mint bar stool seat', (0, 0, .91), .32, .14, 'teal')
            box('Low mint stool back', (0, .25, 1.09), (.56, .11, .28), 'teal', .09)
        else:
            upholstered = id == 'kitchenBarStoolVelvet'
            color = 'pink' if upholstered else 'wood'
            splayed_legs(.87, 'gold' if upholstered else 'wood', .29)
            for x in (-.245, .245):
                box('Bar stool foot rail', (x, 0, .30), (.035, .51, .035), 'gold' if upholstered else 'wood', .010)
            for y in (-.245, .245):
                box('Bar stool cross rail', (0, y, .31), (.51, .035, .035), 'gold' if upholstered else 'wood', .010)
            cylinder('Rounded bar stool seat', (0, 0, .91), .32, .12, color)
            if upholstered:
                box('Velvet bar stool back', (0, .255, 1.13), (.57, .15, .39), 'pink', .10)
                for x in (-.19, .19):
                    cylinder('Back support', (x, .255, .96), .018, .33, 'gold')

    elif id == 'kitchenMixerStand':
        box('Mixer rounded base', (0, 0, .07), (.78, .51, .13), 'pink', .09)
        box('Mixer upright motor stand', (.24, .10, .37), (.24, .32, .59), 'pink', .09)
        box('Mixer motor head', (-.035, .08, .68), (.73, .32, .23), 'pink', .10)
        box('Mixer silver nose band', (-.36, .08, .68), (.045, .32, .18), 'silver', .02)
        cylinder('Mixing bowl base', (-.20, -.025, .18), .21, .14, 'silver')
        sphere('Mixing bowl', (-.20, -.025, .25), (.245, .22, .17), 'silver')
        cylinder('Bowl opening', (-.20, -.025, .353), .19, .016, 'grey')
        torus('Mixing bowl rim', (-.20, -.025, .36), .21, .020, 'silver')
        cylinder('Whisk spindle', (-.20, -.025, .49), .016, .24, 'silver')
        for a in (0, math.pi / 2):
            curve('Whisk wire', [(-.20 + .07 * math.cos(a), -.025 + .07 * math.sin(a), .49), (-.20, -.025, .34), (-.20 - .07 * math.cos(a), -.025 - .07 * math.sin(a), .49)], .006, 'silver')
        handle(.25, -.072, .53, .10, 'silver')
        box('Mixer speed markings', (.22, -.072, .58), (.09, .006, .018), 'cream', .004)

    elif id == 'kitchenMixerHand':
        box('Hand mixer motor housing', (0, 0, .46), (.56, .28, .26), 'teal', .11)
        grip = torus('Mixer carry handle', (0, 0, .64), .13, .03, 'teal', rotation=(math.pi / 2, 0, 0))
        grip.scale.x = 1.55
        box('Hand mixer speed switch', (.13, -.015, .685), (.10, .06, .035), 'cream', .012)
        for x in (-.12, .12):
            cylinder('Beater shaft', (x, -.015, .23), .012, .29, 'silver')
            for a in (0, math.pi / 2):
                curve('Beater loop', [(x + .055 * math.cos(a), -.015 + .055 * math.sin(a), .20), (x + .06 * math.cos(a), -.015 + .06 * math.sin(a), .08), (x, -.015, .04), (x - .06 * math.cos(a), -.015 - .06 * math.sin(a), .08), (x - .055 * math.cos(a), -.015 - .055 * math.sin(a), .20)], .006, 'silver')
        for x in (-.17, -.09, -.01):
            box('Mixer ventilation slot', (x, -.144, .46), (.028, .009, .095), 'sage', .008)

    elif id.startswith('kitchenChair'):
        padded = id == 'kitchenChairUpholstered'
        metal = id == 'kitchenChairMint'
        color = 'cream' if padded else 'teal' if metal else 'wood'
        splayed_legs(.55, 'silver' if metal else 'wood')
        cylinder('Dining chair seat', (0, 0, .59), .36, .13, color).scale.y = .89
        if id == 'kitchenChairWindsor':
            for x in (-.26, -.13, 0, .13, .26):
                cylinder('Windsor back spindle', (x, .26, .97), .018, .65, 'wood')
            curve('Curved Windsor crest', [(-.35, .26, 1.23), (-.20, .29, 1.34), (0, .30, 1.38), (.20, .29, 1.34), (.35, .26, 1.23)], .040, 'wood')
        elif id == 'kitchenChairBistro':
            curve('Bentwood outer back', [(-.31, .25, .55), (-.31, .29, 1.15), (0, .34, 1.39), (.31, .29, 1.15), (.31, .25, .55)], .032, 'wood')
            curve('Bentwood inner back', [(-.16, .28, .67), (-.16, .31, 1.04), (0, .33, 1.18), (.16, .31, 1.04), (.16, .28, .67)], .021, 'wood')
            torus('Chair leg brace', (0, 0, .25), .25, .016, 'wood')
        else:
            for x in (-.25, .25):
                cylinder('Dining chair back support', (x, .27, .91), .022, .68, 'silver' if metal else 'wood')
            back = box('Rounded dining chair back', (0, .28, 1.05), (.67, .14 if padded else .085, .55), color, .10)
            back.rotation_euler.x = -.08
            if padded:
                for x in (-.13, .13):
                    sphere('Upholstery button', (x, .197, 1.05), (.018, .009, .018), 'paper')

    elif id == 'chairRockingOak':
        for x in (-.34, .34):
            curve('Curved rocking runner', [(x, -.72, .16), (x, -.38, .065), (x, 0, .04), (x, .43, .08), (x, .76, .19)], .045, 'wood')
            for y in (-.24, .25):
                cylinder('Rocker seat support', (x, y, .30), .032, .48, 'wood')
            box('Rocking chair armrest', (x, -.045, .83), (.10, .73, .09), 'wood', .035)
            cylinder('Armrest post', (x, -.27, .68), .026, .29, 'wood')
            curve('Rocker back side', [(x, .27, .53), (x, .33, 1.30)], .038, 'wood')
        box('Oak rocker seat', (0, 0, .55), (.72, .71, .11), 'wood', .055)
        box('Soft sage seat pad', (0, -.035, .64), (.61, .61, .10), 'sage', .08)
        for x in (-.22, -.11, 0, .11, .22):
            curve('Rocker back spindle', [(x, .28, .61), (x, .33, 1.28)], .017, 'wood')
        curve('Rocker crest', [(-.35, .33, 1.27), (0, .35, 1.38), (.35, .33, 1.27)], .045, 'wood')

    elif id == 'livingFireplaceCream':
        box('Stone hearth', (0, -.065, .06), (1.77, .77, .12), 'paper', .045)
        box('Fireplace rear wall', (0, .19, .74), (1.52, .18, 1.28), 'cream', .025)
        box('Dark firebox recess', (0, .087, .53), (.99, .025, .80), 'dark', .035)
        for x in (-.64, .64):
            box('Cream stone pillar', (x, -.025, .70), (.26, .41, 1.22), 'cream', .035)
            for z in (.37, .62, .87, 1.12):
                box('Stonework joint', (x, -.234, z), (.23, .010, .013), 'paper', .003)
        box('Fireplace arch lintel', (0, -.025, 1.16), (1.52, .41, .21), 'cream', .035)
        box('Broad fireplace mantel', (0, -.045, 1.37), (1.79, .59, .13), 'white', .04)
        box('Mantel trim', (0, -.065, 1.27), (1.63, .49, .08), 'paper', .025)
        for y, a in ((-.16, .10), (-.035, -.12)):
            log = cylinder('Firewood log', (0, y, .22), .07, .75, 'brown', rotation=(0, math.pi / 2, a))
            for x in (-.37, .37):
                cylinder('Log end grain', (x, y, .22), .048, .016, 'wood', rotation=(0, math.pi / 2, 0))
        glow = h['material']('Warm fireplace flame', 'F3B85F')
        shader = glow.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Emission Color'].default_value = (*glow.diffuse_color[:3], 1)
        shader.inputs['Emission Strength'].default_value = .65
        for x, height in ((-.22, .29), (0, .45), (.22, .33)):
            vertices = []
            rings = [(0, .075), (.28, .10), (.65, .055), (1, .002)]
            for t, radius in rings:
                for i in range(16):
                    a = i * math.tau / 16
                    vertices.append((x + .05 * t * t + radius * math.cos(a), -.13 + radius * .55 * math.sin(a), .25 + t * height))
            faces = [(r * 16 + i, r * 16 + (i + 1) % 16, (r + 1) * 16 + (i + 1) % 16, (r + 1) * 16 + i) for r in range(3) for i in range(16)]
            faces += [tuple(range(15, -1, -1)), tuple(range(48, 64))]
            mesh = bpy.data.meshes.new('Soft teardrop flame')
            mesh.from_pydata(vertices, [], faces)
            mesh.update()
            obj = bpy.data.objects.new('Soft teardrop flame', mesh)
            bpy.context.collection.objects.link(obj)
            h['finish'](obj, obj.name, glow)
            for face in mesh.polygons:
                face.use_smooth = True
        for x in (-.39, -.20, 0, .20, .39):
            box('Fireplace grate bar', (x, -.31, .23), (.024, .026, .21), 'dark', .008)
        box('Fireplace grate rail', (0, -.31, .28), (.89, .026, .025), 'dark', .008)
    else:
        raise ValueError('Missing kitchen addition builder: ' + id)
