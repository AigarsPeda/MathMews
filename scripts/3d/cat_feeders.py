"""Five original feeding surfaces, using the room's existing pastel materials."""
import math

CAT_FEEDER_IDS = {'feedingTile', 'feedingPebble', 'foodTrailTray', 'kibbleDispenser', 'lickingPad'}


def build_cat_feeder(id, h):
    box, sphere, cylinder, torus = (h[key] for key in ('box', 'sphere', 'cylinder', 'torus'))

    def kibble(x, y, z):
        sphere('Feeder kibble', (x, y, z), (.035, .029, .023), 'brown')

    if id == 'feedingTile':
        box('Nonslip tile base', (0, 0, .028), (.78, .78, .055), 'dark', .03)
        box('Ceramic feeding tile', (0, 0, .077), (.76, .76, .055), 'cream', .03)
        for x in (-.355, .355):
            box('Tile raised edge', (x, 0, .115), (.035, .72, .045), 'cream', .015)
        for y in (-.355, .355):
            box('Tile raised edge', (0, y, .115), (.72, .035, .045), 'cream', .015)
        for x, y, sx, sy in [(0, 0, .19, .15), (-.12, .06, .12, .1), (.13, -.04, .12, .09)]:
            sphere('Wet food spread', (x, y, .11), (sx, sy, .018), 'brown')
    elif id == 'feedingPebble':
        # One continuous stone surface with a shallow recessed center.
        bpy = h['bpy']
        profile = [(.29, .25, 0), (.39, .33, .035), (.41, .34, .07),
                   (.38, .32, .13), (.30, .245, .145), (.255, .20, .105), (.235, .18, .075)]
        vertices, faces, count = [(0, 0, 0)], [], 48
        for rx, ry, z in profile:
            for i in range(count):
                a = i * math.tau / count
                shape = 1 + .025 * math.sin(3 * a)
                vertices.append((rx * math.cos(a) * shape, ry * math.sin(a) * shape, z))
        for i in range(count):
            j = (i + 1) % count
            faces.append((0, 1 + j, 1 + i))
            for ring in range(len(profile) - 1):
                start = 1 + ring * count
                faces.append((start + i, start + j, start + count + j, start + count + i))
        top = len(vertices)
        vertices.append((0, 0, .075))
        start = 1 + (len(profile) - 1) * count
        for i in range(count):
            faces.append((start + i, start + (i + 1) % count, top))
        mesh = bpy.data.meshes.new('Continuous pebble shell')
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new('Smooth feeding pebble', mesh)
        bpy.context.collection.objects.link(obj)
        h['finish'](obj, 'Smooth feeding pebble', 'sage')
        for face in mesh.polygons:
            face.use_smooth = True
        sphere('Pebble food surface', (0, 0, .09), (.225, .17, .018), 'brown')
        for x, y in [(-.1, .02), (.09, .04), (.03, -.07), (-.04, .09)]:
            kibble(x, y, .114)
    elif id == 'foodTrailTray':
        box('Food trail tray base', (0, 0, .035), (1.08, .53, .07), 'wood', .035)
        for x, y in [(-.34, .06), (0, -.06), (.34, .06)]:
            cylinder('Trail feeding spot', (x, y, .083), .145, .03, 'cream')
            torus('Shallow spot rim', (x, y, .108), .127, .017, 'cream')
            for dx, dy in [(-.045, .02), (.04, .035), (0, -.035)]:
                kibble(x + dx, y + dy, .117)
    elif id == 'kibbleDispenser':
        sphere('Rolling dispenser body', (0, .08, .29), (.28, .28, .28), 'blue')
        torus('Dispenser seam', (0, .08, .29), .279, .012, 'cream', rotation=(math.pi / 2, 0, 0))
        cylinder('Refill cap', (0, .08, .565), .085, .02, 'cream')
        # The low outlet and loose kibble remain within the cat's floor reach.
        outlet = sphere('Kibble outlet', (0, -.165, .15), (.095, .021, .06), 'dark')
        outlet.rotation_euler.x = -.35
        for x, y in [(-.05, -.23), (.055, -.29), (-.075, -.36), (.025, -.42)]:
            kibble(x, y, .035)
    elif id == 'lickingPad':
        box('Licking pad base', (0, 0, .025), (.78, .67, .05), 'pink', .022)
        for x in (-.365, .365):
            box('Pad lip', (x, 0, .058), (.025, .62, .035), 'pink', .01)
        for y in (-.31, .31):
            box('Pad lip', (0, y, .058), (.73, .025, .035), 'pink', .01)
        for row in range(7):
            y = -.24 + row * .08
            box('Soft licking ridge', (0, y, .064), (.64, .027, .028), 'pink', .012)
            if 1 <= row <= 5:
                box('Food in pad groove', (.02 * math.sin(row), y + .032, .057),
                    (.30 + .07 * math.sin(row), .039, .012), 'brown', .005)
    else:
        raise ValueError(id)
