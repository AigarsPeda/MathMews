from common import *

def notebook():
    box('Sage notebook cover',(0,0,.09),(1.35,1.65,.15),mat('sage','cloth'))
    box('Cream page block',(.02,0,.18),(1.24,1.53,.09),mat('cream'))
    gridpaper((0,0,.24),(1.22,1.50))
    for y in [-.66+i*.19 for i in range(8)]:ring('Spiral binding',(-.65,y,.22),.09,.014,mat('gold','metal'),(PI/2,0,0))
    rod('Mechanical pencil',(.33,-.66,.30),(.50,.62,.30),.045,mat('sage'))
    rod('Steel pencil point',(.32,-.82,.30),(.33,-.66,.30),.018,mat('slate','metal'))
    rod('Pencil clip',(.52,.32,.33),(.56,.55,.33),.009,mat('slate','metal'))

def geometry():
    w=mat('wood','wood'); t=mat('teal')
    outer=[(-.75,.70),(.70,.70),(-.75,-.60)]
    # Three separate rails preserve the open triangular center.
    for a,b in zip(outer,outer[1:]+outer[:1]):rod('Set square rail',(*a,.08),(*b,.08),.085,w)
    # Separate ring segments avoid a self-crossing ngon across the open center.
    for i in range(48):
        a=PI*i/48;b=PI*(i+1)/48
        poly('Protractor arc segment',[(r*math.cos(q),-.38+r*math.sin(q)) for r,q in [(.70,a),(.70,b),(.42,b),(.42,a)]],.12,.055,t,.001)
    box('Straight protractor base',(0,-.38,.147),(1.40,.07,.055),t,.012)
    for i in range(19):
        a=PI*i/18
        line('Angle tick',[(r*math.cos(a),-.38+r*math.sin(a),.184) for r in [.59,.67]],.005,mat('ink'))
    for i in range(12):line('Set square tick',[(-.68+i*.1,.68,.17),(-.68+i*.1,.61,.17)],.004,mat('brown'))

def tangram():
    before=set(bpy.context.scene.objects)
    pieces=[([(-.65,-.7),(.65,-.7),(0,-.04)],'lavender'),([(-.65,-.7),(-.65,.1),(0,-.04)],'wood'),([(-.65,.1),(-.02,.80),(.65,-.05),(.65,-.7),(0,-.04)],'sage'),([(-.02,.76),(-.38,1.09),(.02,1.41),(.38,1.07)],'wood'),([(-.38,1.13),(-.38,1.67),(.02,1.45)],'lavender'),([(.02,1.45),(.38,1.67),(.38,1.11)],'coral'),([(.65,-.05),(.65,.50),(1.10,.95),(1.10,.38)],'coral')]
    for pts,c in pieces:
        center=Vector((sum(p[0] for p in pts)/len(pts),sum(p[1] for p in pts)/len(pts)))
        poly('Tangram cat piece',[tuple(center+(Vector(p)-center)*.990) for p in pts],.04,.10,mat(c,'wood'),.018)
    group('Standing tangram cat',list(set(bpy.context.scene.objects)-before),(0,0,.72),(PI/2,0,0))

def stopwatch():
    steel=mat('slate','metal');cyl('Stopwatch case',(0,0,.78),.65,.18,steel,(0,-1,0))
    cyl('Ivory dial',(0,-.105,.78),.59,.025,mat('cream'),(0,-1,0))
    ring('Raised dial rim',(0,-.13,.78),.60,.022,steel,(PI/2,0,0));ticks((0,-.125,.78),.54,60,mat('ink'),True)
    for i,s in enumerate(['60','10','20','30','40','50']):
        a=i*TAU/6;text('Stopwatch number',s,(.43*math.sin(a),-.145,.78+.43*math.cos(a)),.11,mat('ink'),True)
    rod('Minute hand',(0,-.16,.78),(.30,-.16,1.10),.014,mat('ink'));rod('Second hand',(0,-.17,.78),(-.12,-.17,.56),.009,mat('gold','metal'))
    cyl('Crown',(0,0,1.50),.09,.16,steel);rod('Top button',(-.42,0,1.26),(-.52,0,1.42),.07,steel)
    ring('Folded fabric strap',(.66,.28,.50),.30,.050,mat('sage','cloth'),(PI/2,.3,0))

def globe():
    ball('Teal globe',(0,0,.93),(.61,)*3,mat('teal'))
    def xyz(lon,lat,r=.617):
        a,b=math.radians(lon),math.radians(lat);return (r*math.cos(b)*math.sin(a),-r*math.cos(b)*math.cos(a),.93+r*math.sin(b))
    for lat in [-60,-30,0,30,60]:line('Latitude',[xyz(lon,lat) for lon in range(-180,181,4)],.0025,mat('cream'))
    for lon in range(-180,180,30):line('Longitude',[xyz(lon,lat) for lat in range(-90,91,3)],.0025,mat('cream'))
    continents=[ [(-115,60),(-65,65),(-48,46),(-75,16),(-95,22),(-120,40)], [(-78,12),(-48,6),(-35,-12),(-62,-52),(-75,-20)], [(-15,36),(18,37),(42,10),(29,-35),(10,-25),(-17,12)], [(-10,40),(15,65),(60,70),(130,52),(150,5),(100,10),(70,27),(40,38)],[(112,-12),(148,-15),(153,-35),(118,-37)] ]
    for shape in continents:
        v=[xyz(a,b,.622) for a,b in shape];center=tuple(sum(p[k] for p in v)/len(v) for k in range(3));v=[center]+v
        mesh=bpy.data.meshes.new('Continent');mesh.from_pydata(v,[],[(0,i+1,(i+1)%len(shape)+1) for i in range(len(shape))]);mesh.update()
        import bmesh
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=9,use_grid_fill=True)
        for vertex in bm.verts:vertex.co=Vector((0,0,.93))+(vertex.co-Vector((0,0,.93))).normalized()*.625
        bm.to_mesh(mesh);bm.free();mesh.update()
        o=bpy.data.objects.new('Cream landmass',mesh);bpy.context.collection.objects.link(o);assign(o,'Cream landmass',mat('cream'));smooth(o)
    line('Maple meridian arc',[(.73*math.sin(a),.02,.93+.73*math.cos(a)) for a in [PI*i/64 for i in range(65)]],.035,mat('wood','wood'))
    cyl('Globe stem',(0,0,.20),.06,.35,mat('wood','wood'));cyl('Maple globe base',(0,0,.055),.40,.10,mat('wood','wood'))

def binoculars():
    for x in [-.39,.39]:
        cyl('Textured barrel',(x,0,.35),.29,.85,mat('sage','cloth'),(0,1,.18))
        cyl('Black objective rim',(x,-.44,.27),.26,.10,mat('ink'),(0,1,.18))
        cyl('Deep optic',(x,-.50,.26),.205,.02,mat('navy','glass'),(0,1,.18))
        cyl('Eyepiece',(x,.46,.44),.17,.18,mat('ink'),(0,1,.18))
    box('Bridge',(0,.05,.43),(.40,.30,.15),mat('sage'));cyl('Focus wheel',(0,.25,.51),.11,.20,mat('ink'),(1,0,0))
    line('Canvas neck strap',[(-.59,.25,.32),(-.85,.70,.12),(-.55,1.04,.08),(.55,1.04,.08),(.86,.70,.12),(.59,.25,.32)],.055,mat('sage','cloth'))

def compass():
    box('Folded cream map',(0,.15,.025),(1.6,1.30,.035),mat('cream'),.025,rot=(0,0,-.15))
    for j in range(5):line('Map contour',[(x/20-.7,.15+j*.17+.05*math.sin(x*.6+j),.048) for x in range(29)],.004,mat('sage'))
    cyl('Compass brass case',(0,-.10,.15),.49,.17,mat('gold','metal'))
    cyl('Compass green face',(0,-.10,.245),.44,.025,mat('sage'));ring('Compass brass bezel',(0,-.1,.27),.45,.018,mat('gold','metal'))
    ticks((0,-.1),.39,32,mat('cream'),z=.262)
    for body,x,y in [('N',0,.22),('S',0,-.42),('E',.32,-.1),('W',-.32,-.1)]:text('Cardinal',body,(x,y,.278),.10,mat('cream'))
    poly('Coral compass needle',[(-.045,-.1),(.045,-.1),(.07,.22)],.28,.018,mat('coral'))
    poly('Cream compass needle',[(-.045,-.1),(.045,-.1),(-.07,-.42)],.28,.018,mat('cream'))
    ring('Compass hanging loop',(0,.48,.21),.12,.026,mat('gold','metal'))

def balance():
    w=mat('wood','wood');g=mat('gold','metal');cyl('Scale base',(0,0,.07),.43,.12,w);rod('Scale post',(0,0,.12),(0,0,1.25),.055,w)
    rod('Balance beam',(-.70,0,1.12),(.70,0,1.12),.055,w);box('Central hinge',(0,0,1.12),(.17,.14,.25),mat('sage'))
    for x in [-.63,.63]:
        lathe('Brass pan',[(0,.41),(.25,.41),(.29,.48)],g,(x,0,0))
        for a in [0,TAU/3,2*TAU/3]:rod('Pan suspension',(x,0,1.10),(x+.26*math.cos(a),.26*math.sin(a),.47),.009,g)
    for x,z in [(.55,.13),(.82,.20)]:cyl('Brass weight',(x,-.38,z),.10,z*1.6,g);cyl('Weight grip',(x,-.38,z*1.9),.045,.06,g)

def puzzlecube():
    remaining={(x,y,z) for x in range(3) for y in range(3) for z in range(3)};rng=random.Random(8);index=0
    while remaining:
        cell=sorted(remaining)[rng.randrange(len(remaining))];piece=[cell];remaining.remove(cell)
        while len(piece)<3:
            neighbors=sorted({(x+dx,y+dy,z+dz) for x,y,z in piece for dx,dy,dz in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]}&remaining)
            if not neighbors:break
            cell=neighbors[rng.randrange(len(neighbors))];piece.append(cell);remaining.remove(cell)
        vertices=[];faces=[];lookup={}
        for x,y,z in piece:
            for d,corners in [((1,0,0),[(1,0,0),(1,1,0),(1,1,1),(1,0,1)]),((-1,0,0),[(0,0,0),(0,0,1),(0,1,1),(0,1,0)]),((0,1,0),[(0,1,0),(0,1,1),(1,1,1),(1,1,0)]),((0,-1,0),[(0,0,0),(1,0,0),(1,0,1),(0,0,1)]),((0,0,1),[(0,0,1),(1,0,1),(1,1,1),(0,1,1)]),((0,0,-1),[(0,0,0),(0,1,0),(1,1,0),(1,0,0)])]:
                if (x+d[0],y+d[1],z+d[2]) in piece:continue
                face=[]
                for a,b,c in corners:
                    key=(x+a,y+b,z+c)
                    if key not in lookup:lookup[key]=len(vertices);vertices.append(((key[0]-1.5)*.36,(key[1]-1.5)*.36,key[2]*.36))
                    face.append(lookup[key])
                faces.append(face)
        mesh=bpy.data.meshes.new('Interlocking polycube');mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new('Single interlocking wood piece',mesh);bpy.context.collection.objects.link(o);assign(o,'Single interlocking wood piece',mat('lavender' if index%2 else 'wood','wood'))
        bevel=o.modifiers.new('Rounded puzzle joints','BEVEL');bevel.width=.018;bevel.segments=4;o.modifiers.new('Piece normals','WEIGHTED_NORMAL');index+=1

def glider():
    w=mat('wood','wood');poly('Tapered fuselage',[(-.09,-1),(.09,-1),(.06,.75),(-.06,.75)],.18,.12,w)
    poly('Long glider wing',[(-1,-.12),(1,-.12),(.87,.24),(-.87,.24)],.31,.045,w)
    poly('Tailplane',[(-.39,.55),(.39,.55),(.30,.79),(-.30,.79)],.29,.035,w)
    for x in [-.91,.91]:box('Coral wing tip',(x,.045,.335),(.17,.32,.025),mat('coral','wood'),.035)
    tail=poly('Upright tail fin',[(-.03,.49),(.28,.78),(-.03,.78)],0,.05,w);tail.rotation_euler=(PI/2,0,PI/2);tail.location=(0,.12,.32)

def telescope():
    before=set(bpy.context.scene.objects)
    t=mat('teal');axis=Vector((0,1,.25));cyl('Cream telescope tube',(0,0,1.15),.20,1.25,mat('cream','wood'),axis)
    cyl('Objective hood',(0,-.65,.99),.23,.16,t,axis);cyl('Dark objective glass',(0,-.745,.965),.18,.025,mat('navy','glass'),axis)
    cyl('Eyepiece',(0,.70,1.325),.09,.20,t,axis);ball('Tripod mount',(0,0,.82),(.16,)*3,t)
    for a in [0,TAU/3,2*TAU/3]:rod('Wood tripod leg',(0,0,.82),(.48*math.cos(a),.48*math.sin(a),.05),.04,mat('wood','wood'))
    group('Sideways telescope view',list(set(bpy.context.scene.objects)-before),rot=(0,0,PI/2))

def camera():
    box('Lavender camera body',(0,0,.47),(1.30,.44,.84),mat('lavender','cloth'),.11)
    cyl('Lens housing',(.14,-.30,.47),.32,.28,mat('ink'),(0,-1,0));cyl('Front lens',(.14,-.46,.47),.26,.025,mat('navy','glass'),(0,-1,0))
    ring('Lens silver ring',(.14,-.475,.47),.29,.014,mat('slate','metal'),(PI/2,0,0))
    for x in [-.42,-.15]:cyl('Top camera dial',(x,0,.92),.09,.06,mat('gold','metal'))
    box('Viewfinder',(-.43,-.23,.69),(.16,.025,.11),mat('ink'),.025)
    legacy.rope('Lavender camera strap',[Vector((-.7+.10*math.cos(a),-.15+.55*math.sin(a),.07)) for a in [TAU*i/90 for i in range(91)]],[mat('lavender','felt')],.025)

def terrarium():
    glass=mat('F4F6ED','glass');lathe('Open terrarium glass',[(.40,.04),(.54,.15),(.57,.65),(.45,.92),(.38,.98),(.38,1.08),(.35,1.08),(.35,.99),(.42,.91),(.53,.65),(.50,.16),(.39,.08)],glass)
    ring('Clear rolled glass rim',(0,0,1.08),.365,.014,mat('slate','metal'))
    cyl('Earth layer',(0,0,.18),.48,.18,mat('brown'));rng=random.Random(12)
    for i in range(48):
        a=rng.random()*TAU;r=.44*math.sqrt(rng.random());ball('Terrarium pebble',(r*math.cos(a),r*math.sin(a),.29),(.04,.035,.025),mat(['wood','cream','slate'][i%3]))
    rod('Seedling stem',(0,0,.30),(0,0,.81),.017,mat('sage'))
    for i in range(5):leaf('Seedling leaf',((-.12 if i%2 else .12),0,.45+i*.065),.18,mat('sage'),(-.7 if i%2 else .7))
    cyl('Cork lid beside jar',(.72,.06,.07),.34,.12,mat('wood','wood'))

def palette():
    box('Maple paint box',(0,0,.10),(1.5,.95,.18),mat('wood','wood'))
    box('Cream paint tray',(0,0,.20),(1.34,.78,.04),mat('cream'))
    for j,c in enumerate(['sage','teal','lavender','gold','coral','pink']):cyl('Watercolor pigment',(-.43+(j%3)*.43,-.21+(j//3)*.42,.235),.17,.025,mat(c))
    lid=capture(box,'Palette lid',(0,0,0),(1.50,.85,.09),mat('wood','wood'))
    lid+=capture(box,'Lid shallow inset',(0,-.015,-.051),(1.28,.66,.018),mat('wood','wood'),.045)
    group('Open lid',lid,(0,.72,.48),(1.05,0,0))
    rod('Brush wooden handle',(-.76,-.72,.055),(.50,-.65,.055),.022,mat('wood','wood'));rod('Brush ferrule',(.50,-.65,.055),(.68,-.64,.055),.03,mat('gold','metal'));ball('Brush bristles',(.77,-.63,.055),(.15,.035,.025),mat('brown'))

def crane():
    box('Lavender paper square',(0,0,.025),(1.25,1.1,.03),mat('lavender','cloth'),.015,rot=(0,0,-.12))
    verts=[(-.17,-.12,.16),(.17,-.12,.16),(0,.25,.36),(-.85,.25,.90),(.85,.25,.90),(0,-.42,.60),(0,-.50,.99),(0,-.72,.91),(0,.65,.72)]
    faces=[(0,1,2),(0,2,3),(1,4,2),(0,5,2),(1,2,5),(5,6,7),(0,2,8),(1,8,2)]
    mesh=bpy.data.meshes.new('Folded crane paper');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Origami crane',mesh);bpy.context.collection.objects.link(o);assign(o,'Origami crane',mat('sage','cloth'));o.modifiers.new('Paper thickness','SOLIDIFY').thickness=.012

def dominoes():
    for j,(x,y,a) in enumerate([(-.45,.05,-.18),(.43,.38,.16),(.57,-.55,-.22)]):
        objs=capture(box,'Domino',(0,0,.10),(.42,.82,.16),mat('cream'),.045)
        objs+=capture(line,'Domino divider',[(-.17,0,.185),(.17,0,.185)],.008,mat('sage'))
        for yy in [-.22,.22]:
            for xx,dy in [(-.10,-.10),(.10,.10),(0,0)][:2+(j%2)]:objs+=capture(cyl,'Recessed pip',(xx,yy+dy,.184),.033,.006,mat('sage'))
        group('Domino placement',objs,(x,y,0),(0,0,a))

def chess():
    w=mat('wood','wood');lathe('Knight turned base',[(0,0),(.32,0),(.34,.08),(.27,.15),(.20,.20),(.20,.32),(.29,.36)],w,(-.30,0,0))
    # Extruded horse silhouette with a muzzle, ears and mane.
    pts=[(-.54,.30),(-.46,.76),(-.62,1.02),(-.51,1.32),(-.34,1.45),(-.29,1.21),(-.04,1.05),(.12,.95),(.11,.80),(-.10,.78),(-.24,.91),(-.20,.52),(-.04,.30)]
    o=poly('Knight horse head',pts,-.12,.24,w,.045);o.rotation_euler.x=PI/2;o.location.z=.10
    ball('Carved knight eye',(-.27,-.15,1.16),(.026,.012,.026),mat('brown'))
    lathe('Lavender pawn',[(0,0),(.24,0),(.26,.07),(.20,.13),(.12,.20),(.10,.45),(.16,.52)],mat('lavender'),(.55,0,0));ball('Pawn head',(.55,0,.64),(.18,)*3,mat('lavender'))

def metronome():
    mesh=bpy.data.meshes.new('Metronome body');v=[(-.40,-.28,0),(.40,-.28,0),(.40,.28,0),(-.40,.28,0),(-.20,-.18,1.35),(.20,-.18,1.35),(.20,.18,1.35),(-.20,.18,1.35)]
    mesh.from_pydata(v,[],[(0,1,2,3),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0),(4,7,6,5)]);mesh.update();o=bpy.data.objects.new('Wood metronome',mesh);bpy.context.collection.objects.link(o);assign(o,'Wood metronome',mat('brown','wood'))
    box('Front dark recess',(0,-.24,.78),(.25,.035,.82),mat('ink'),.03,rot=(-.07,0,0))
    rod('Swing arm',(0,-.30,.35),(.20,-.25,1.28),.015,mat('gold','metal'));box('Sliding metronome weight',(.13,-.28,.95),(.12,.07,.15),mat('slate','metal'))
    for i in range(9):line('Tempo tick',[(-.07,-.265,.43+i*.08),(.04,-.265,.43+i*.08)],.003,mat('cream'))

def magnifier():
    box('Specimen card',(.35,.15,.025),(.70,1.0,.03),mat('cream'),.02,rot=(0,0,-.18))
    leaf('Pressed specimen',(.35,.15,.055),.32,mat('sage'),.30)
    ring('Magnifier brass rim',(-.27,-.04,.16),.36,.027,mat('gold','metal'))
    cyl('Magnifying glass',(-.27,-.04,.16),.34,.020,mat('F0F6F0','glass'))
    rod('Wood magnifier handle',(-.42,-.35,.12),(-.68,-.88,.06),.065,mat('wood','wood'))

def pouch():
    cloth=mat('cream','cloth');box('Canvas puzzle pouch',(0,.12,.38),(1.30,.58,.72),cloth,.16)
    box('Open pouch interior',(0,.12,.755),(1.08,.43,.055),mat('brown'),.12)
    line('Zip track',[(-.60,-.17,.66),(-.62,.12,.76),(-.53,.39,.73),(.53,.39,.73),(.62,.12,.76),(.60,-.17,.66)],.020,mat('gold','metal'))
    for j,c in enumerate(['lavender','teal','coral','gold']):
        poly('Puzzle tile',[(-.5+j*.27,.10),(-.28+j*.27,.10),(-.4+j*.27,.36)],.76,.045,mat(c,'wood'),.015)
    line('Embroidered cat outline',[(.06,-.185,.30),(.01,-.185,.42),(.04,-.185,.55),(.13,-.185,.48),(.28,-.185,.48),(.37,-.185,.55),(.38,-.185,.38),(.30,-.185,.28),(.06,-.185,.30)],.008,mat('sage','cloth'))
    for x in [.12,.28]:line('Cat embroidered eye',[(x-.025,-.19,.40),(x,-.19,.38),(x+.025,-.19,.40)],.005,mat('sage','cloth'))
    for x,c in [(-.55,'lavender'),(.0,'sage')]:poly('Loose triangle',[(x,-.82),(x+.4,-.82),(x+.20,-.42)],.025,.06,mat(c,'wood'))

BUILDERS=[notebook,geometry,tangram,stopwatch,globe,binoculars,compass,balance,puzzlecube,glider,telescope,camera,terrarium,palette,crane,dominoes,chess,metronome,magnifier,pouch]
