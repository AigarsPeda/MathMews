"""Bedroom furniture and a quilt whose named parent lifts around a sleeping cat."""
import math
import bpy

BEDROOM_ADDITION_IDS = {'bedroomBedRose', 'bedroomBedLilac', 'bedroomVanity', 'bedroomBench',
                        'bedroomQuiltChest', 'bedroomSlippers', 'bedroomRug'}

def add_bed_quilt(h, color='sage'):
    # Keep the edge flat while raising the middle. The same parent deforms the
    # stitched grid, so the quilt and its seams never separate during snuggling.
    h['box']('Quilt padded hem', (0, -.34, .65), (1.69, 1.43, .10), color, .04)
    pivot = h['empty']('Bed cover lift', (0, 0, .70))
    pivot.scale.z = .15
    def point(x, y):
        rise = .48 * max(0, 1 - (x / .85)**2)**1.4 * max(0, 1 - ((y + .32) / .72)**2)**.7
        return (x, y, rise)
    nx, ny = 24, 24
    vertices = [point(-.84 + 1.68*i/nx, -1.04 + 1.40*j/ny) for j in range(ny+1) for i in range(nx+1)]
    faces = [(j*(nx+1)+i, j*(nx+1)+i+1, (j+1)*(nx+1)+i+1, (j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
    mesh = bpy.data.meshes.new('Soft quilt cloth');mesh.from_pydata(vertices, [], faces);mesh.update()
    obj = bpy.data.objects.new('Soft quilt cloth', mesh);bpy.context.collection.objects.link(obj)
    h['finish'](obj, 'Soft quilt cloth', color, pivot)
    for face in mesh.polygons: face.use_smooth = True
    # Thickness stays in the mattress when flat and gives the hem a soft edge.
    solid = obj.modifiers.new('Quilt thickness', 'SOLIDIFY');solid.thickness=.035
    for x in (-.56, -.28, 0, .28, .56):
        h['curve']('Quilt stitching', [(a,b,c+.008) for a,b,c in [point(x,-1.02+1.36*i/24) for i in range(25)]], .006, 'cream', pivot)
    for y in (-.86, -.58, -.30, -.02, .26):
        h['curve']('Quilt stitching', [(a,b,c+.008) for a,b,c in [point(-.82+1.64*i/24,y) for i in range(25)]], .006, 'cream', pivot)
    return pivot

def build_bedroom_addition(id, h):
    box, sphere, cylinder = (h[k] for k in ('box','sphere','cylinder'))
    if id.startswith('bedroomBed'):
        color = 'pink' if id.endswith('Rose') else 'lilac'
        for x in (-.72,.72):
            for y in (-.94,.94):cylinder('Oak bed leg',(x,y,.13),.07,.26,'wood')
        box('Oak bed frame',(0,0,.30),(1.78,2.22,.27),'wood',.07)
        box('Upholstered headboard',(0,1,.90),(1.84,.18,1.38),color,.09)
        for x in (-.60,-.30,0,.30,.60):box('Headboard channel',(x,.89,1.02),(.018,.018,.72),'cream',.006)
        box('Mattress',(0,-.02,.49),(1.65,2.06,.27),'cream',.10)
        for x in (-.42,.42):box('Bed pillow',(x,.66,.68),(.67,.40,.18),'white',.08)
        add_bed_quilt(h,color)
    elif id=='bedroomVanity':
        for x in (-.59,.59):
            for y in (-.22,.22):cylinder('Vanity leg',(x,y,.43),.04,.86,'wood')
        box('Vanity tabletop',(0,0,.88),(1.4,.64,.12),'paper',.04)
        box('Vanity drawer',(0,-.05,.73),(.78,.51,.18),'wood',.025)
        sphere('Drawer knob',(0,-.32,.73),(.035,.025,.035),'gold')
        box('Mirror frame',(0,.23,1.40),(.85,.10,.88),'wood',.12)
        box('Vanity mirror',(0,.17,1.40),(.71,.018,.72),'silver',.10)
        cylinder('Perfume bottle',(.49,-.04,1.01),.065,.15,'pink')
        sphere('Perfume stopper',(.49,-.04,1.11),(.045,.045,.035),'gold')
    elif id=='bedroomBench':
        for x in (-.65,.65):
            for y in (-.20,.20):cylinder('Bench leg',(x,y,.22),.055,.44,'wood')
        box('Bench oak base',(0,0,.42),(1.55,.62,.13),'wood',.04)
        box('Tufted bench cushion',(0,0,.54),(1.54,.65,.20),'sage',.09)
        for x in (-.49,0,.49):sphere('Tuft button',(x,0,.642),(.023,.023,.009),'green')
    elif id=='bedroomQuiltChest':
        box('Linen chest',(0,0,.30),(1.12,.64,.58),'wood',.06)
        box('Chest lid',(0,0,.62),(1.17,.68,.10),'paper',.04)
        for x in (-.37,.37):box('Chest strap',(x,-.327,.31),(.055,.015,.48),'gold',.009)
        for i,color in enumerate(('lilac','cream','pink')):box('Folded quilt',(0,0,.72+i*.09),(.77,.48,.095),color,.035)
    elif id=='bedroomSlippers':
        for x in (-.15,.15):
            sphere('Slipper sole',(x,0,.045),(.12,.26,.04),'paper')
            sphere('Slipper toe',(x,-.09,.10),(.12,.17,.095),'pink')
            sphere('Pom pom',(x,-.11,.19),(.055,.055,.045),'cream')
    elif id=='bedroomRug':
        box('Woven bedroom rug',(0,0,.025),(1.80,1.30,.035),'paper',.025)
        for x in (-.75,.75):box('Rug border',(x,0,.046),(.09,1.18,.008),'lilac',.003)
        for y in (-.51,.51):box('Rug border',(0,y,.046),(1.46,.07,.008),'lilac',.003)
        for i in range(18):
            for y in (-.68,.68):h['curve']('Cotton fringe',[(-.82+i*.096,y-.04,.025),(-.82+i*.096,y+.04,.025)],.012,'cream')
