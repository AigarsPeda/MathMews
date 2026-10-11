"""Hinged main fridge door and recessed interior, shared by native/shop builders."""
import bpy


def add_fridge_interior(h, width, depth, bottom, top, front, hinge_x, door_parts):
    box, cylinder = h['box'], h['cylinder']
    liner = h['material']('Fridge cool white liner', 'DCEAF0', roughness=.45)
    led = h['material']('Fridge cold LED', 'DCF3FF', roughness=.25)
    milk = h['material']('Fridge milk carton', 'FEFBEC', roughness=.65)
    juice = h['material']('Fridge juice carton', 'EFA45E', roughness=.65)
    bottle = h['material']('Fridge green bottle', '83AE88', roughness=.4)
    cap = h['material']('Fridge bottle cap', 'FEFBEC', roughness=.5)
    for material in (liner, led, milk, juice, bottle, cap):
        material.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value = 1
    center = (bottom + top) / 2
    height = top - bottom
    box('Fridge interior back', (0, depth / 2 - .055, center), (width - .10, .025, height), liner, .006)
    for x in (-width / 2 + .06, width / 2 - .06):
        box('Fridge interior side', (x, .015, center), (.025, depth - .11, height), liner, .008)
    for z in (bottom + .015, top - .015):
        box('Fridge interior floor ceiling', (0, .015, z), (width - .10, depth - .11, .03), liner, .008)
    for fraction in (.28, .53, .77):
        z = bottom + height * fraction
        box('Fridge interior shelf', (0, .015, z), (width - .14, depth - .16, .025), liner, .006)
        box('Fridge interior shelf lip', (0, front + .12, z + .018), (width - .14, .025, .045), liner, .008)
    box('Fridge interior LED', (0, front + .09, top - .048), (width - .22, .04, .026), led, .006)
    # Simple stocked shelves make the cavity readable at room scale.
    for x, color in ((-.22, milk), (.20, juice)):
        box('Fridge food carton', (x, -.15, bottom + height * .53 + .13), (.17, .17, .23), color, .014)
    for x in (-.25, -.08, .16):
        cylinder('Fridge juice bottle', (x, -.22, bottom + height * .28 + .13), .045, .22, bottle)
        cylinder('Fridge bottle cap', (x, -.22, bottom + height * .28 + .249), .03, .018, cap)
    panel = box('Fridge door liner', (0, front + .037, center), (width - .17, .025, height - .14), liner, .015)
    rack = box('Fridge door rack', (0, front + .105, bottom + .18), (width - .20, .14, .06), liner, .009)
    hinge = h['empty']('Fridge door hinge', (hinge_x, front, 0))
    for obj in [*door_parts, panel, rack]:
        obj.parent = hinge
        obj.location -= hinge.location
