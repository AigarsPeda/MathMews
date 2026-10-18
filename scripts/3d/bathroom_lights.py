"""Four wall-mounted bathroom lights, shared by store thumbnails and native models."""
import math

BATHROOM_LIGHT_IDS = {'bathroomLightGlobe', 'bathroomLightVanity', 'bathroomMirrorBacklit', 'bathroomLightStrip'}


def build_bathroom_light(id, h):
    box, sphere, cylinder, torus = (h[k] for k in ('box', 'sphere', 'cylinder', 'torus'))
    chrome = h['material']('Bathroom brushed chrome', 'BCC7CF', .30, .65)
    opal = h['material']('Bathroom opal glass', 'FFF2D8', .48)
    if id == 'bathroomLightGlobe':
        cylinder('Globe wall plate', (0, 0, .34), .12, .045, chrome, rotation=(math.pi / 2, 0, 0))
        box('Globe support arm', (0, -.11, .28), (.055, .22, .055), chrome, .018)
        cylinder('Globe collar', (0, -.24, .23), .085, .08, chrome)
        sphere('Frosted globe diffuser', (0, -.24, .39), (.18, .18, .18), opal)
    elif id == 'bathroomLightVanity':
        box('Vanity backplate', (0, 0, .22), (.66, .045, .13), chrome, .035)
        box('Vanity light housing', (0, -.10, .22), (1.10, .17, .18), chrome, .055)
        box('Vanity opal diffuser', (0, -.193, .22), (1.01, .045, .12), opal, .035)
        for x in (-.53, .53):
            box('Vanity end cap', (x, -.10, .22), (.05, .18, .18), chrome, .025)
    elif id == 'bathroomMirrorBacklit':
        cylinder('Mirror wall housing', (0, 0, .60), .52, .065, chrome, rotation=(math.pi / 2, 0, 0))
        torus('Mirror illuminated rim', (0, -.045, .60), .485, .035, opal, rotation=(math.pi / 2, 0, 0))
        glass = h['material']('Bathroom mirror glass', 'B4CDDA', .14, .80)
        cylinder('Round mirror glass', (0, -.057, .60), .45, .016, glass, rotation=(math.pi / 2, 0, 0))
        # Broad pale reflections keep the glass readable in the store thumbnail.
        reflection = h['material']('Bathroom mirror reflection', 'DDE9EC', .24, .50)
        line = box('Mirror reflection', (-.15, -.069, .67), (.025, .006, .40), reflection, .01)
        line.rotation_euler.y = -.30
    elif id == 'bathroomLightStrip':
        box('Indirect strip backplate', (0, 0, .14), (1.90, .045, .14), chrome, .025)
        box('Indirect strip channel', (0, -.07, .14), (1.90, .12, .12), 'white', .025)
        box('Indirect strip diffuser', (0, -.08, .073), (1.80, .10, .025), opal, .01)
        for x in (-.93, .93):
            box('Indirect strip end cap', (x, -.07, .14), (.04, .12, .12), chrome, .012)
    else:
        raise ValueError('Unknown bathroom light: ' + id)
