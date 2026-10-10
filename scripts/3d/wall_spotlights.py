"""Wall lights with a fixed backplate and a ball joint for two-axis aiming."""
import math
import bpy

WALL_SPOTLIGHT_IDS = {
    'wallSpotCylinderBlack', 'wallSpotCylinderWhite',
    'wallSpotBellBrass', 'wallSpotBellRose',
    'wallSpotBarOak', 'wallSpotBarChrome',
}


def build_wall_spotlight(id, h):
    box, cylinder, sphere = (h[k] for k in ('box', 'cylinder', 'sphere'))
    finish = id.removeprefix('wallSpotCylinder').removeprefix('wallSpotBell').removeprefix('wallSpotBar')
    color = {'Black': 'ink', 'White': 'white', 'Brass': 'gold',
             'Rose': 'pink', 'Oak': 'wood', 'Chrome': 'silver'}[finish]
    metal = h['material']('Spotlight ' + finish, h['PALETTE'][color], .32,
                          .65 if finish in ('Brass', 'Chrome') else .08)
    bar = 'Bar' in id
    bell = 'Bell' in id
    if bar:
        box('Wall backplate', (0, 0, .30), (.42, .055, .16), metal, .025)
    else:
        cylinder('Wall backplate', (0, 0, .30), .14, .055, metal, rotation=(math.pi / 2, 0, 0))
    # The fixed stem reaches the exact aiming pivot. A spherical connection
    # stays seated in the housing through both tilt and swivel; fixed side
    # hinges would detach when the head turns away from their shared axis.
    box('Spotlight support arm', (0, -.20, .30), (.055, .40, .055), metal, .015)
    sphere('Spotlight ball joint', (0, -.40, .30), (.075, .075, .075), metal)
    pivot = h['empty']('Spotlight head', (0, -.40, .30))
    if bar:
        head = box('Picture light housing', (0, -.40, .30), (.80, .16, .20), metal, .045)
        lens = box('Spotlight lens', (0, -.40, .194), (.72, .13, .012), 'cream', .012)
    elif bell:
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=.16, radius2=.075, depth=.22, location=(0, -.40, .30))
        head = h['finish'](bpy.context.object, 'Bell spotlight shade', metal)
        for face in head.data.polygons:
            face.use_smooth = True
        lens = cylinder('Spotlight lens', (0, -.40, .184), .135, .012, 'cream')
    else:
        head = cylinder('Cylinder spotlight housing', (0, -.40, .30), .10, .24, metal)
        lens = cylinder('Spotlight lens', (0, -.40, .174), .084, .012, 'cream')
    # Store previews show the downward head. Native rooms apply the saved tilt.
    bpy.context.view_layer.update()
    for obj in (head, lens):
        world = obj.matrix_world.copy()
        obj.parent = pivot
        obj.matrix_world = world
