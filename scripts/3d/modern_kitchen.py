"""Coordinated modular kitchens, shared by shop thumbnails and native models."""
import math
import bpy
MODERN_KITCHEN_FINISHES = {
    'White': ('F0E9DF', 'EFE8DA', 'C1B9AD'),
    'Sage': ('91AA97', 'ECEDE4', 'C3C9BE'),
    'Navy': ('344B63', 'DDE0DE', 'A9B2B4'),
    'Charcoal': ('454A4A', 'D1C4B0', '998979'),
}
MODERN_KITCHEN_IDS = {
    'kitchenModern' + piece + finish
    for piece in ('Counter', 'FloorShelf', 'Sink', 'Induction', 'WallCabinet', 'Shelf', 'Fridge', 'Island')
    for finish in MODERN_KITCHEN_FINISHES
}


def build_modern_kitchen(id, h):
    box, cylinder, torus, curve = (h[k] for k in ('box', 'cylinder', 'torus', 'curve'))
    finish = next(name for name in MODERN_KITCHEN_FINISHES if id.endswith(name))
    front_hex, stone_hex, detail_hex = MODERN_KITCHEN_FINISHES[finish]
    front = h['material']('Modern ' + finish + ' matte cabinetry', front_hex, roughness=.64)
    stone = h['material']('Modern ' + finish + ' stone', stone_hex, roughness=.34)
    detail = h['material']('Modern ' + finish + ' stone markings', detail_hex, roughness=.42)
    recess = h['material']('Recessed shadow groove', '343B3C', roughness=.75)
    glass = h['material']('Black induction glass', '202C30', roughness=.19)
    etching = h['material']('Cooktop etched rings', '687578', roughness=.45)

    def stone_board(name, z, width, depth, y=0, x_offset=0, bevel=.018):
        box(name, (x_offset, y, z), (width, depth, .09), stone, bevel)
        top = z + .045
        if finish == 'Charcoal':
            # Small, deterministic terrazzo chips stay inside the slab edges.
            for i in range(18):
                x = x_offset + (((i * 7) % 19) / 18 - .5) * (width - .16)
                yy = y + (((i * 11) % 19) / 18 - .5) * (depth - .16)
                chip = box('Terrazzo chip', (x, yy, top + .0006),
                           (.025 + (i % 3) * .009, .014 + (i % 2) * .009, .001),
                           detail if i % 3 else 'cream', .004)
                chip.rotation_euler.z = i * .67
        elif finish == 'Sage':
            for i in range(16):
                x = x_offset + (((i * 5) % 17) / 16 - .5) * (width - .13)
                yy = y + (((i * 7) % 17) / 16 - .5) * (depth - .13)
                cylinder('Quartz fleck', (x, yy, top + .0006), .005, .001, detail)
        else:
            for i in range(3):
                x = x_offset + (i - 1) * width * .25
                bend = min(1, width / .9)
                vein = curve('Fine stone vein', [(x - .11 * bend, y - depth * .41, 0),
                      (x + .03 * bend, y - depth * .13, 0),
                      (x - .05 * bend, y + depth * .16, 0),
                      (x + .13 * bend, y + depth * .41, 0)], .0045, detail)
                vein.scale.z = .1
                vein.location.z = top + .0003

    if 'Sink' in id:
        metal = h['material']('Brushed stainless steel sink', 'A9B4B8', roughness=.29, metallic=.75)
        tap = h['material']('Chrome mixer tap', 'C4CFD2', roughness=.21, metallic=.82)
        box('Recessed kitchen plinth', (0, .055, .075), (1.64, .91, .15), recess, .012)
        for x in (-.8675, .8675):
            box('Sink cabinet side', (x, .01, .65), (.045, 1.05, 1.06), front, .012)
        box('Sink cabinet back', (0, .5125, .65), (1.69, .045, 1.06), front, .009)
        box('Sink cabinet bottom', (0, .01, .16), (1.69, 1.005, .08), front, .009)
        box('Sink door shadow backing', (0, -.521, .65), (1.75, .016, 1.02), recess, .004)
        for x in (-.437, .437):
            box('Handleless sink cabinet door', (x, -.552, .625), (.861, .045, 1.02), front, .009)
        box('Recessed sink door pull', (0, -.543, 1.144), (1.68, .018, .013), recess, .003)
        # Four real slabs leave the basin open, and expose only solid stone as supports.
        stone_board('Thick stone worktop', 1.185, .19, 1.12, x_offset=-.825, bevel=.004)
        stone_board('Thick stone worktop', 1.185, .69, 1.12, x_offset=.575, bevel=.004)
        for y in (-.445, .445):
            stone_board('Thick stone worktop', 1.185, .96, .23, y=y, x_offset=-.25, bevel=.004)

        def rounded_ring(width, depth, radius, z):
            hx, hy = width / 2, depth / 2
            corners = ((hx-radius, hy-radius), (-hx+radius, hy-radius),
                       (-hx+radius, -hy+radius), (hx-radius, -hy+radius))
            return [(-.25 + x + radius * math.cos((corner * 90 + step * 22.5) * math.pi / 180),
                     y + radius * math.sin((corner * 90 + step * 22.5) * math.pi / 180), z)
                    for corner, (x, y) in enumerate(corners) for step in range(5)]

        rings = [rounded_ring(1.02, .72, .06, 1.231), rounded_ring(.94, .64, .05, 1.224),
                 rounded_ring(.80, .50, .075, .99)]
        count = len(rings[0])
        faces = [(ring*count+i, ring*count+(i+1)%count,
                  (ring+1)*count+(i+1)%count, (ring+1)*count+i)
                 for ring in range(2) for i in range(count)]
        faces.append(tuple(range(2*count, 3*count)))
        mesh = bpy.data.meshes.new('Recessed sink bowl')
        mesh.from_pydata([point for ring in rings for point in ring], [], faces)
        mesh.update()
        bowl = bpy.data.objects.new('Recessed sink bowl', mesh)
        bpy.context.collection.objects.link(bowl)
        h['finish'](bowl, 'Recessed sink bowl', metal)
        cylinder('Sink drain', (-.25, 0, .994), .041, .008, recess)
        torus('Stainless drain rim', (-.25, 0, 1.001), .034, .004, metal)
        for x in (-.263, -.25, -.237):
            box('Drain strainer slot', (x, 0, 1.0005), (.003, .032, .001), metal, 0)
        cylinder('Mixer tap base', (-.25, .43, 1.244), .047, .028, tap)
        curve('Curved mixer tap', [(-.25, .43, 1.25), (-.25, .43, 1.57),
              (-.25, .36, 1.66), (-.25, .15, 1.66), (-.25, .10, 1.57)], .023, tap)
        cylinder('Tap aerator', (-.25, .10, 1.564), .025, .028, tap)
        box('Single lever mixer handle', (-.16, .43, 1.32), (.16, .032, .028), tap, .009)
    elif 'Fridge' in id:
        box('Built-in fridge housing', (0, .015, 1.36), (1.24, 1.05, 2.56), front, .018)
        box('Integrated fridge door shadow', (0, -.517, 1.21), (1.19, .012, 2.22), recess, .004)
        box('Integrated freezer door', (0, -.55, .42), (1.17, .045, .60), front, .009)
        box('Integrated fridge door', (0, -.55, 1.53), (1.17, .045, 1.55), front, .009)
        box('Over-fridge cabinet door', (0, -.55, 2.48), (1.17, .045, .28), front, .009)
        for z, height in ((.43, .49), (1.54, 1.39)):
            box('Integrated recessed door pull', (.50, -.574, z), (.027, .012, height), recess, .005)
        box('Recessed fridge ventilation plinth', (0, 0, .06), (1.13, .97, .12), recess, .009)
        for z in (.025, .05, .075, .10):
            box('Fridge ventilation grille', (0, -.491, z), (.99, .008, .006), front, .002)
    elif 'Island' in id:
        box('Recessed island plinth', (0, .03, .075), (2.05, .91, .15), recess, .012)
        box('Modern island cabinetry', (0, .01, .65), (2.30, 1.05, 1.06), front, .018)
        box('Island drawer shadow backing', (0, -.521, .65), (2.27, .016, 1.02), recess, .004)
        for x in (-.571, .571):
            for z, height in ((.98, .28), (.655, .33), (.29, .35)):
                box('Handleless island drawer', (x, -.552, z), (1.115, .045, height), front, .009)
                box('Recessed island drawer pull', (x, -.543, z + height / 2 + .009),
                    (1.06, .018, .013), recess, .003)
        stone_board('Thick stone worktop', 1.185, 2.58, 1.45, .12)
        for x in (-1.255, 1.255):
            box('Stone waterfall end panel', (x, .12, .60), (.07, 1.45, 1.20), stone, .014)
    elif 'WallCabinet' in id:
        box('Wall backplate', (0, .22, .45), (1.74, .02, .81), front, .005)
        box('Modern cabinet carcass', (0, 0, .45), (1.78, .42, .84), front, .018)
        box('Cabinet door shadow', (0, -.214, .45), (1.75, .012, .81), recess, .004)
        for x in (-.444, .444):
            box('Flat handleless cabinet door', (x, -.239, .46), (.864, .045, .79), front, .009)
        box('Recessed cabinet finger rail', (0, -.22, .045), (1.67, .03, .025), recess, .006)
    elif 'FloorShelf' in id:
        # A square footprint fits narrow gaps while sharing the counter height/depth.
        box('Recessed kitchen plinth', (0, .055, .075), (.92, .91, .15), recess, .012)
        for x in (-.5075, .5075):
            box('Open shelf side', (x, .01, .65), (.045, 1.05, 1.06), front, .012)
        box('Open shelf back', (0, .5125, .65), (.97, .045, 1.06), front, .009)
        for z in (.13, .65):
            box('Shelf', (0, .01, z), (.97, 1.005, .05), front, .009)
        stone_board('Thick stone worktop', 1.185, 1.12, 1.12)
    elif 'Shelf' in id:
        for z in (.07, .65):
            stone_board('Wall shelf', z, 1.80, .48, -.035)
            for x in (-.61, .61):
                box('Concealed shelf bracket', (x, .17, z - .015), (.06, .09, .10), front, .009)
        box('Wall backplate', (0, .225, .36), (1.75, .055, .70), front, .012)
    else:
        box('Recessed kitchen plinth', (0, .055, .075), (1.64, .91, .15), recess, .012)
        box('Modern base cabinet', (0, .01, .65), (1.78, 1.05, 1.06), front, .018)
        box('Drawer shadow backing', (0, -.521, .65), (1.75, .016, 1.02), recess, .004)
        stone_board('Thick stone worktop', 1.185, 1.84, 1.12)
        if 'Counter' in id:
            for z, height in ((.98, .28), (.655, .33), (.29, .35)):
                box('Handleless kitchen drawer', (0, -.552, z), (1.735, .045, height), front, .009)
                box('Recessed drawer pull', (0, -.543, z + height / 2 + .009),
                    (1.68, .018, .013), recess, .003)
        else:
            box('Induction glass plate', (0, -.025, 1.235), (1.36, .83, .014), glass, .018)
            for x in (-.34, .34):
                for y in (-.20, .17):
                    torus('Etched induction zone', (x, y, 1.244), .135, .003, etching)
            for x in (-.12, 0, .12):
                box('Induction touch control', (x, -.365, 1.244), (.028, .025, .002), etching, .005)
            box('Oven black glass face', (0, -.553, .65), (1.735, .045, .94), glass, .018)
            box('Oven control strip', (0, -.58, 1.02), (1.57, .018, .12), 'black', .007)
            box('Oven clock display', (0, -.592, 1.02), (.23, .007, .045), etching, .005)
            box('Oven window', (0, -.579, .59), (1.42, .012, .50), recess, .025)
            box('Oven window reflection', (-.51, -.587, .61), (.022, .004, .28), etching, .006)
            box('Slim oven handle', (0, -.635, .87), (1.24, .075, .045), 'silver', .011)
            for x in (-.53, .53):
                box('Oven handle mount', (x, -.60, .87), (.055, .06, .042), 'silver', .007)
