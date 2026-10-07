"""Original rugs, wall fixtures, lighting and an L-shaped sofa."""
import math
import bpy

HOME_DETAIL_IDS = {
    'rugBraidedRound', 'rugGeometricTeal', 'rugStripedRunner', 'rugFlowerPink',
    'windowWhiteClassic', 'windowOakWide', 'windowArched', 'windowRoundPorthole',
    'doorOakPanel', 'doorMintGlass', 'doorBarnSliding',
    'lampFloorArc', 'lampFloorTripod', 'lampFloorPaper',
    'lampTableMushroom', 'lampTableCeramic', 'lampTableBanker',
    'curtainRoseTieback', 'curtainBlueDrape', 'curtainCreamLinen', 'sofaCornerSage',
}


def build_home_detail(id, h):
    box, sphere, cylinder, torus, curve = (h[k] for k in ('box', 'sphere', 'cylinder', 'torus', 'curve'))

    def cone(name, loc, bottom, top, height, color):
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=bottom, radius2=top, depth=height, location=loc)
        obj = bpy.context.object
        for face in obj.data.polygons:
            face.use_smooth = True
        return h['finish'](obj, name, color)

    def pane(x, z, width, height, color='blue'):
        box('Sky blue glass', (x, .015, z), (width, .045, height), color, .02)
        highlight = box('Window light reflection', (x - width * .20, -.012, z + height * .12), (.045, .008, height * .48), 'cream', .01)
        highlight.rotation_euler.y = -.20

    def window_frame(width, height, color):
        for x in (-width / 2, width / 2):
            box('Window upright', (x, -.045, height / 2 + .10), (.085, .13, height), color, .025)
        for z in (.10, height + .10):
            box('Window crossbar', (0, -.045, z), (width + .085, .13, .085), color, .02)
        box('Deep window sill', (0, -.13, .055), (width + .24, .30, .10), color, .025)

    def curtain_panel(x, color, tied):
        columns, rows, width, height = 24, 12, .51, 1.65
        verts = []
        for side in (0, 1):
            for row in range(rows + 1):
                v = row / rows
                waist = 1 - (.35 * math.exp(-((v - .47) / .19) ** 2) if tied else 0)
                for col in range(columns + 1):
                    u = col / columns
                    xx = x + (u - .5) * width * waist
                    yy = -.045 + math.cos(u * math.tau * 4) * .033 + side * .025
                    zz = .13 + v * height + (1 - v) ** 9 * .025 * math.cos(u * math.tau * 4)
                    verts.append((xx, yy, zz))
        stride = columns + 1
        count = stride * (rows + 1)
        faces = []
        for row in range(rows):
            for col in range(columns):
                p = row * stride + col
                faces.append((p, p + 1, p + stride + 1, p + stride))
                faces.append((p + count + stride, p + count + stride + 1, p + count + 1, p + count))
        for row in range(rows):
            for col in (0, columns):
                p = row * stride + col
                faces.append((p, p + stride, p + stride + count, p + count))
        for col in range(columns):
            for row in (0, rows):
                p = row * stride + col
                faces.append((p, p + count, p + count + 1, p + 1))
        mesh = bpy.data.meshes.new('Folded curtain fabric')
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new('Folded curtain fabric', mesh)
        bpy.context.collection.objects.link(obj)
        h['finish'](obj, obj.name, color)
        for face in mesh.polygons:
            face.use_smooth = True
        if tied:
            box('Curtain tieback', (x, -.085, .13 + height * .47), (.36, .11, .065), 'gold', .022)
            curve('Tieback tassel', [(x + .12, -.12, .91), (x + .15, -.13, .78), (x + .13, -.13, .68)], .014, 'gold')

    if id == 'rugBraidedRound':
        cylinder('Braided rug backing', (0, 0, .025), .95, .05, 'paper')
        for i in range(11):
            torus('Braided rug ring', (0, 0, .052), .045 + i * .084, .038, ['paper', 'wood', 'cream'][i % 3])
        # Small radial stitches make this read as woven, rather than a target.
        for i in range(24):
            a = i * math.tau / 24
            stitch = box('Rug outer stitch', (.88 * math.cos(a), .88 * math.sin(a), .08), (.055, .018, .013), 'cream', .005)
            stitch.rotation_euler.z = a

    elif id == 'rugGeometricTeal':
        box('Woven rectangle rug', (0, 0, .026), (2.20, 1.55, .05), 'teal', .055)
        box('Cream rug border', (0, 0, .055), (2.02, 1.37, .018), 'cream', .035)
        box('Teal patterned field', (0, 0, .068), (1.84, 1.19, .013), 'teal', .025)
        for x in (-.59, 0, .59):
            diamond = box('Woven diamond', (x, 0, .080), (.34, .34, .010), 'cream', .012)
            diamond.rotation_euler.z = math.pi / 4
            center = box('Diamond center', (x, 0, .087), (.14, .14, .006), 'gold', .01)
            center.rotation_euler.z = math.pi / 4
        for side in (-1, 1):
            for y in (-.60, -.45, -.30, -.15, 0, .15, .30, .45, .60):
                box('Rug fringe', (side * 1.15, y, .03), (.15, .03, .018), 'cream', .006)

    elif id == 'rugStripedRunner':
        box('Runner backing', (0, 0, .025), (.85, 2.50, .05), 'cream', .065)
        for i in range(11):
            box('Woven runner stripe', (0, -1.10 + i * .22, .057), (.82, .11, .015), ['sage', 'pink', 'gold'][i % 3], .015)
        for side in (-1, 1):
            for x in (-.32, -.16, 0, .16, .32):
                box('Runner fringe', (x, side * 1.30, .03), (.03, .15, .018), 'paper', .006)

    elif id == 'rugFlowerPink':
        for i in range(8):
            a = i * math.tau / 8
            petal = cylinder('Flower rug petal', (.49 * math.cos(a), .49 * math.sin(a), .030), .35, .06, 'pink')
            petal.scale.x = 1.08
            petal.rotation_euler.z = a
        cylinder('Flower rug center', (0, 0, .07), .35, .035, 'gold')
        torus('Flower center seam', (0, 0, .09), .30, .012, 'cream')

    elif id in ('windowWhiteClassic', 'windowOakWide'):
        width, height, color = (1.13, 1.35, 'white') if id == 'windowWhiteClassic' else (1.90, 1.18, 'wood')
        pane(0, height / 2 + .10, width, height)
        window_frame(width, height, color)
        box('Window center mullion', (0, -.055, height / 2 + .10), (.065, .12, height), color, .018)
        box('Window sash', (0, -.065, height / 2 + .10), (width, .12, .065), color, .018)
        box('Brass window latch', (0, -.135, height / 2 + .10), (.13, .03, .035), 'gold', .01)

    elif id == 'windowArched':
        width, shoulder, radius = 1.30, 1.08, .65
        box('Arched glass lower pane', (0, .025, .59), (width, .045, .98), 'blue', .02)
        # The upper half of the pane is a closed semicircle in the wall plane.
        pts = [(radius * math.cos(a), shoulder + radius * math.sin(a)) for a in [i * math.pi / 32 for i in range(33)]]
        verts = [(x, .025 + side * .04, z) for side in (0, 1) for x, z in pts]
        n = len(pts)
        faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
        mesh = bpy.data.meshes.new('Arched sky glass')
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        glass = bpy.data.objects.new('Arched sky glass', mesh)
        bpy.context.collection.objects.link(glass)
        h['finish'](glass, glass.name, 'blue')
        outline = [(-radius, -.04, .10), (-radius, -.04, shoulder)]
        outline += [(radius * math.cos(math.pi - i * math.pi / 24), -.04, shoulder + radius * math.sin(math.pi - i * math.pi / 24)) for i in range(25)]
        outline.append((radius, -.04, .10))
        curve('Arched oak frame', outline, .045, 'wood')
        box('Arched window sill', (0, -.12, .07), (1.53, .30, .10), 'wood', .025)
        box('Arched center mullion', (0, -.06, .91), (.055, .10, 1.60), 'wood', .012)
        box('Arched transom bar', (0, -.06, shoulder), (1.30, .10, .055), 'wood', .012)

    elif id == 'windowRoundPorthole':
        cylinder('Round sky glass', (0, .02, .66), .56, .065, 'blue', rotation=(math.pi / 2, 0, 0))
        torus('Round white window frame', (0, -.015, .66), .58, .065, 'white', rotation=(math.pi / 2, 0, 0))
        torus('Brass inner ring', (0, -.085, .66), .51, .018, 'gold', rotation=(math.pi / 2, 0, 0))
        for i in range(8):
            a = i * math.tau / 8
            sphere('Porthole rivet', (.58 * math.cos(a), -.073, .66 + .58 * math.sin(a)), (.018, .012, .018), 'gold')
        box('Porthole reflection', (-.18, -.023, .81), (.045, .009, .33), 'cream', .014)

    elif id.startswith('door'):
        barn = id == 'doorBarnSliding'
        color = 'teal' if id == 'doorMintGlass' else 'wood'
        box('Door slab', (0, .01, 1.03), (1.10, .10, 1.98), color, .035)
        for x in (-.60, .60):
            box('Door jamb', (x, -.025, 1.05), (.09, .19, 2.10), 'cream' if color == 'teal' else 'brown', .022)
        box('Door lintel', (0, -.025, 2.10), (1.29, .19, .10), 'cream' if color == 'teal' else 'brown', .025)
        box('Door threshold', (0, -.06, .032), (1.28, .25, .065), 'paper', .02)
        if id == 'doorMintGlass':
            pane(0, 1.39, .81, .89)
            for x in (-.425, .425):
                box('Door glass frame', (x, -.08, 1.39), (.04, .09, .93), 'cream', .01)
            for z in (.93, 1.39, 1.85):
                box('Door glass bar', (0, -.08, z), (.86, .09, .045), 'cream', .012)
            box('Lower door panel', (0, -.06, .46), (.79, .045, .54), 'sage', .025)
        elif barn:
            for x in (-.42, -.21, 0, .21, .42):
                box('Barn door plank', (x, -.065, 1.04), (.18, .025, 1.88), 'wood' if x != 0 else 'brown', .012)
            for z in (.26, 1.81):
                box('Barn horizontal brace', (0, -.10, z), (.99, .06, .075), 'paper', .014)
            brace = box('Diagonal barn brace', (0, -.105, 1.03), (.075, .06, 1.74), 'paper', .014)
            brace.rotation_euler.y = .50
            box('Sliding door rail', (0, .02, 2.23), (1.75, .09, .075), 'dark', .015)
            for x in (-.40, .40):
                box('Roller strap', (x, -.08, 2.02), (.07, .055, .31), 'dark', .012)
                cylinder('Door roller', (x, -.08, 2.23), .08, .07, 'dark', rotation=(math.pi / 2, 0, 0))
        else:
            for x in (-.25, .25):
                for z, height in ((.51, .67), (1.43, .85)):
                    box('Recessed oak panel', (x, -.061, z), (.39, .026, height), 'paper', .03)
                    box('Panel inset', (x, -.079, z), (.30, .016, height - .09), 'wood', .022)
        box('Door handle plate', (.39, -.09, 1.02), (.09, .035, .18), 'gold' if not barn else 'dark', .018)
        box('Door lever', (.33, -.14, 1.05), (.19, .055, .035), 'gold' if not barn else 'dark', .015)

    elif id.startswith('curtain'):
        color = {'curtainRoseTieback': 'pink', 'curtainBlueDrape': 'blue', 'curtainCreamLinen': 'cream'}[id]
        tied = id != 'curtainCreamLinen'
        rod = cylinder('Curtain rod', (0, .005, 1.91), .027, 1.94, 'gold')
        rod.rotation_euler.y = math.pi / 2
        for x in (-.99, .99):
            sphere('Rod finial', (x, .005, 1.91), (.06, .055, .055), 'gold')
        for x in (-.60, .60):
            curtain_panel(x, color, tied)
            for dx in (-.20, -.10, 0, .10, .20):
                torus('Curtain hanging ring', (x + dx, 0, 1.87), .045, .009, 'gold', rotation=(0, math.pi / 2, 0))
        if id == 'curtainBlueDrape':
            curve('Soft draped valance', [(-.85, -.07, 1.82), (-.42, -.08, 1.59), (0, -.07, 1.78), (.42, -.08, 1.59), (.85, -.07, 1.82)], .095, 'blue')

    elif id == 'lampFloorArc':
        cylinder('Heavy arc lamp base', (-.30, 0, .06), .30, .12, 'white')
        curve('Brass arch stem', [(-.30, 0, .12), (-.30, 0, 1.27), (-.13, 0, 1.91), (.30, 0, 2.04), (.72, 0, 1.78)], .026, 'gold')
        cone('Arc lamp shade', (.72, 0, 1.61), .28, .14, .35, 'cream')
        cylinder('Warm shade interior', (.72, 0, 1.441), .24, .018, 'gold')
        sphere('Warm bulb', (.72, 0, 1.42), (.06, .06, .075), 'cream')

    elif id == 'lampFloorTripod':
        for i in range(3):
            a = i * math.tau / 3
            curve('Tripod oak leg', [(.37 * math.cos(a), .37 * math.sin(a), .035), (.10 * math.cos(a), .10 * math.sin(a), 1.34)], .035, 'wood')
        cylinder('Tripod collar', (0, 0, 1.29), .13, .12, 'gold')
        cone('Sage lampshade', (0, 0, 1.56), .43, .31, .47, 'sage')
        torus('Shade cream piping', (0, 0, 1.325), .43, .016, 'cream')

    elif id == 'lampFloorPaper':
        cylinder('Paper lamp base', (0, 0, .06), .27, .12, 'wood')
        cylinder('Lantern pole', (0, 0, .88), .022, 1.70, 'gold')
        sphere('Rice paper lantern', (0, 0, 1.34), (.38, .38, .52), 'cream')
        for i in range(11):
            dz = -.45 + i * .09
            radius = .38 * math.sqrt(1 - (dz / .52) ** 2)
            torus('Paper lantern rib', (0, 0, 1.34 + dz), radius, .008, 'paper')
        cylinder('Lantern top cap', (0, 0, 1.86), .07, .03, 'wood')

    elif id == 'lampTableMushroom':
        cylinder('Mushroom lamp base', (0, 0, .055), .22, .11, 'cream')
        cylinder('Mushroom lamp stem', (0, 0, .25), .085, .40, 'cream')
        sphere('Mushroom shade', (0, 0, .49), (.38, .38, .20), 'coral')
        cylinder('Shade warm underside', (0, 0, .38), .30, .022, 'gold')
        sphere('Mushroom lamp button', (.17, -.09, .119), (.035, .035, .015), 'gold')

    elif id == 'lampTableCeramic':
        cylinder('Ceramic lamp foot', (0, 0, .04), .17, .08, 'teal')
        sphere('Rounded ceramic base', (0, 0, .23), (.18, .18, .21), 'teal')
        cylinder('Lamp neck', (0, 0, .43), .034, .14, 'gold')
        cone('Linen table lampshade', (0, 0, .64), .30, .19, .35, 'cream')
        torus('Shade woven edge', (0, 0, .465), .30, .012, 'wood')

    elif id == 'lampTableBanker':
        cylinder('Desk lamp oval base', (0, 0, .055), .23, .11, 'gold').scale.y = .78
        curve('Banker lamp stem', [(0, .06, .10), (0, .06, .51), (0, -.02, .61)], .025, 'gold')
        for x in (-.24, .24):
            box('Shade brass bracket', (x, 0, .58), (.035, .04, .12), 'gold', .012)
        sphere('Green glass shade', (0, -.015, .65), (.33, .19, .13), 'green')
        box('Glass shade lit underside', (0, -.025, .574), (.50, .25, .023), 'cream', .045)
        curve('Lamp pull chain', [(.23, -.035, .57), (.23, -.035, .37)], .005, 'gold')
        sphere('Pull chain bead', (.23, -.035, .355), (.018, .018, .023), 'gold')

    elif id == 'sofaCornerSage':
        # The chaise extends along the right side; the middle remains an open
        # approach to the standard .70-high seat used by the cat's animations.
        for x, y in ((-1.03, -.43), (-1.03, .40), (1.01, .40), (1.01, -1.37), (.48, -1.37)):
            cylinder('Corner sofa oak foot', (x, y, .10), .055, .20, 'wood')
        box('Corner sofa main base', (0, 0, .37), (2.40, 1.12, .32), 'sage', .13)
        box('Extended chaise base', (.76, -.88, .37), (.88, 1.22, .32), 'sage', .13)
        box('Corner sofa back', (0, .43, .97), (2.40, .28, .88), 'sage', .13)
        box('Left sofa arm', (-1.09, -.02, .64), (.30, 1.10, .57), 'sage', .12)
        box('Corner side back', (1.09, .03, .94), (.26, .89, .82), 'sage', .12)
        box('Long chaise arm', (1.09, -.90, .64), (.26, 1.08, .57), 'sage', .11)
        for x in (-.62, .0):
            box('Corner sofa seat cushion', (x, -.10, .59), (.58, .86, .22), 'sage', .09)
            box('Corner sofa back cushion', (x, .235, 1.02), (.58, .20, .59), 'sage', .08)
        box('Long chaise cushion', (.74, -.51, .59), (.62, 1.68, .22), 'sage', .10)
        box('Chaise back cushion', (.67, .23, 1.02), (.64, .20, .59), 'sage', .08)
        box('Cream corner pillow', (.87, -.91, .87), (.16, .30, .28), 'cream', .065)
    else:
        raise ValueError('Missing home detail builder: ' + id)
