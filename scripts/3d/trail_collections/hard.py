from common import *

def microscope():
    teal=mat('teal');ivory=mat('cream');dark=mat('ink')
    box('Microscope base',(0,0,.12),(1.15,.85,.22),teal,.13)
    box('Column',(0,.20,.70),(.24,.35,1.05),ivory,.10)
    rod('Curved upper arm',(0,.20,1.15),(0,-.12,1.60),.13,ivory)
    box('Stage',(0,-.20,.72),(.68,.60,.08),dark,.035)
    box('Glass slide',(0,-.28,.78),(.28,.16,.02),mat('F0F6F0','glass'),.01)
    axis=(0,.32,1);cyl('Optical tube',(0,-.08,1.50),.14,.56,ivory,axis);cyl('Black eyepiece',(0,.01,1.79),.12,.20,dark,axis)
    cyl('Objective revolver',(0,-.18,1.18),.17,.09,dark)
    for x in [-.11,0,.11]:cyl('Objective lens',(x,-.22,1.04),.045,.18,mat('slate','metal'))
    cyl('Focus knob',(.20,.19,1.06),.15,.15,teal,(1,0,0));cyl('Illuminator',(0,-.22,.34),.18,.15,dark)

def drafting():
    gridpaper((0,0,.025),(1.5,1.5),-.1)
    line('Drawn circle',[(.48*math.cos(TAU*i/96),.48*math.sin(TAU*i/96),.05) for i in range(97)],.003,mat('slate'))
    for x in [-.45,.45]:
        rod('Compass steel leg',(0,.24,1.50),(x,-.12,.16),.035,mat('slate','metal'))
        rod('Compass point',(x,-.12,.16),(x,-.16,.055),.012,mat('ink'))
    ball('Compass hinge',(0,.24,1.50),(.10,.08,.12),mat('wood','wood'))
    rod('Compass top grip',(0,.24,1.54),(0,.24,1.82),.038,mat('teal'))
    cyl('Hinge screw',(0,.15,1.50),.044,.025,mat('teal'),(0,1,0))

def calculator():
    box('Calculator body',(0,0,.12),(1.05,1.60,.22),mat('slate'),.10)
    box('Recessed screen',(0,.49,.242),(.83,.36,.025),mat('ink'),.035)
    box('Dark quiet display',(0,.49,.258),(.73,.26,.018),mat('navy'),.025)
    labels=['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+']
    for i,l in enumerate(labels):
        x=-.345+(i%4)*.23;y=.15-(i//4)*.23
        box('Tactile calculator key',(x,y,.27),(.18,.18,.07),mat('gold' if l=='+' else 'cream' if i%4<3 else 'teal'),.035)
        text('Key legend',l,(x,y,.309),.075,mat('ink'))
    for i in range(5):box('Scientific function key',(-.36+i*.18,.29,.265),(.13,.08,.035),mat('teal'),.018)

def polyhedra():
    # Platonic solids are real meshes, not illustrative textures.
    verts=[(-.33,-.33,0),(.33,-.33,0),(.33,.33,0),(-.33,.33,0),(0,0,.72)]
    mesh=bpy.data.meshes.new('Pyramid');mesh.from_pydata(verts,[],[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)]);mesh.update();o=bpy.data.objects.new('Maple pyramid',mesh);bpy.context.collection.objects.link(o);o.location=(-.55,-.20,.035);assign(o,'Maple pyramid',mat('wood','wood'))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.44);ico=bpy.context.object
    centers=[f.center.normalized()*.44 for f in ico.data.polygons];faces=[]
    for vertex in ico.data.vertices:
        normal=vertex.co.normalized();u=normal.cross(Vector((0,0,1)))
        if u.length<.01:u=normal.cross(Vector((1,0,0)))
        u.normalize();v=normal.cross(u)
        adjacent=[f.index for f in ico.data.polygons if vertex.index in f.vertices]
        faces.append(sorted(adjacent,key=lambda i:math.atan2(centers[i].dot(v),centers[i].dot(u))))
    mesh=bpy.data.meshes.new('Dodecahedron');mesh.from_pydata(centers,[],faces);mesh.update();bpy.data.objects.remove(ico,do_unlink=True)
    o=bpy.data.objects.new('Plum dodecahedron',mesh);bpy.context.collection.objects.link(o);o.location=(.23,.30,.46);assign(o,'Plum dodecahedron',mat('plum','wood'))
    v=[(.42,0,0),(-.42,0,0),(0,.42,0),(0,-.42,0),(0,0,.55),(0,0,-.55)];f=[(a,b,c) for c in [4,5] for a,b in [(0,2),(2,1),(1,3),(3,0)]]
    mesh=bpy.data.meshes.new('Octahedron');mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new('Slate octahedron',mesh);bpy.context.collection.objects.link(o);o.location=(.48,-.42,.55);assign(o,'Slate octahedron',mat('slate','wood'))

def orrery():
    cyl('Orrery base',(0,0,.08),.66,.15,mat('wood','wood'));cyl('Brass axle',(0,0,.41),.075,.66,mat('gold','metal'))
    ball('Amber sun',(0,0,1.12),(.25,)*3,mat('gold'))
    data=[(.36,.13,.75,'cream'),(.50,1.05,.93,'coral'),(.68,2.30,.87,'teal'),(.83,3.4,.96,'slate'),(.98,5.1,1.03,'wood'),(.76,4.4,1.11,'plum'),(.90,.45,.85,'teal'),(.65,5.9,.79,'brown')]
    for i,(r,a,z,c) in enumerate(data):
        x,y=r*math.cos(a),r*math.sin(a);line('Orrery bent arm',[(0,0,.40+i*.06),(x,y,.40+i*.06),(x,y,z)],.018,mat('gold','metal'))
        ball('Planet',(x,y,z),(.075+min(i,4)*.015,)*3,mat(c))
        if i==4:ring('Saturn ring',(x,y,z),.22,.025,mat('cream'),(.12,.1,0))

def molecule():
    positions=[((0,0,.65),'teal',.21),((-.48,-.12,.88),'teal',.18),((.30,.32,1.10),'plum',.15),((.49,-.27,.53),'plum',.16),((-.50,-.20,.32),'cream',.16),((-.05,-.48,.22),'teal',.18),((-.12,.13,1.35),'plum',.15),((.50,.12,1.19),'cream',.16),((.47,-.34,.10),'cream',.15)]
    for i,(p,c,r) in enumerate(positions):ball('Molecular atom',p,(r,)*3,mat(c))
    for a,b in [(0,1),(0,2),(0,3),(1,4),(4,5),(5,0),(0,6),(0,7),(3,8)]:rod('Molecular bond',positions[a][0],positions[b][0],.040,mat('wood','wood'))

def circuit_board(size=1):
    box('Wood circuit backing',(0,0,.065),(1.35,.95,.12),mat('wood','wood'))
    box('Teal printed board',(0,0,.14),(1.22,.82,.035),mat('teal'),.035)
    box('Integrated circuit',(0,0,.20),(.37,.30,.08),mat('ink'),.015)
    for x in [-.23,.23]:
        for y in [-.10,-.03,.04,.11]:rod('Chip leg',(x*.75,y,.22),(x,y,.17),.008,mat('gold','metal'))
    for x,y in [(-.43,.25),(.35,-.25)]:
        rod('Resistor',(x-.12,y,.23),(x+.12,y,.23),.035,mat('cream'))
        for dx in [-.06,0,.06]:ring('Resistor stripe',(x+dx,y,.23),.036,.005,mat('coral'),(0,PI/2,0))
    cyl('Capacitor',(.42,.20,.25),.095,.20,mat('ink'));cyl('Capacitor top',(.42,.20,.355),.080,.012,mat('slate','metal'))
    rod('LED lead',(-.40,-.23,.17),(-.40,-.23,.38),.010,mat('gold','metal'));ball('Amber LED',(-.40,-.23,.43),(.070,.07,.095),mat('gold'))
    for j in range(4):line('Circuit trace',[(-.52,-.3+j*.16,.16),(-.31,-.3+j*.16,.16),(-.31,.20-j*.08,.16),(.52,.20-j*.08,.16)],.006,mat('gold','metal'))
    for x in [-.53,.53]:
        for y in [-.33,.33]:ring('Board mounting eyelet',(x,y,.168),.023,.008,mat('gold','metal'))

def circuit():circuit_board()

def prism():
    box('Prism maple base',(0,0,.08),(1.25,.8,.15),mat('wood','wood'))
    obj=poly('Glass optical prism',[(-.54,0),(.54,0),(0,.96)],-.25,.5,mat('F2F7F7','glass'),.014);obj.rotation_euler.x=PI/2;obj.location.z=.17
    edge=mat('white','glass')
    for y in [-.25,.25]:line('Prism polished edge',[(-.54,y,.17),(.54,y,.17),(0,y,1.13),(-.54,y,.17)],.008,edge)
    for x,z in [(-.54,.17),(.54,.17),(0,1.13)]:line('Prism depth edge',[(x,-.25,z),(x,.25,z)],.006,edge)
    for j,c in enumerate(['coral','gold','sage','teal','lavender']):
        material=mat(c)
        beam=material.copy();beam.name='Translucent spectral light '+c
        nodes=beam.node_tree.nodes;links=beam.node_tree.links;bsdf=nodes.get('Principled BSDF')
        clear=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=.40
        links.new(clear.outputs[0],mix.inputs[1]);links.new(bsdf.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
        z=.69-j*.028
        mesh=bpy.data.meshes.new('Spectral beam');mesh.from_pydata([(-.20,-.27,z),(.98,-.27,z-.33),(.98,-.27,z-.36),(-.20,-.27,z-.028)],[],[(0,1,2,3)]);mesh.update();o=bpy.data.objects.new('Prism rainbow light',mesh);bpy.context.collection.objects.link(o);assign(o,'Prism rainbow light',beam)

def caliper():
    metal=mat('slate','metal');box('Caliper beam',(0,0,.25),(1.80,.16,.08),metal,.015)
    box('Fixed jaw',(-.70,-.20,.21),(.10,.62,.18),metal,.015)
    box('Sliding block',(.10,0,.28),(.40,.26,.16),metal,.025)
    box('Moving jaw',(.02,-.22,.21),(.10,.65,.18),metal,.015)
    for x in [-.70,.02]:box('Inside measuring tip',(x,.18,.27),(.06,.32,.09),metal,.015)
    cyl('Adjustment wheel',(.16,.13,.37),.055,.055,mat('ink'))
    for i in range(25):line('Beam graduation',[(-.60+i*.058,-.05,.30),(-.60+i*.058,.015 if i%5 else .05,.30)],.0035,mat('ink'))
    cyl('Measured wood cylinder',(-.34,-.34,.23),.25,.40,mat('wood','wood'))

def sundial():
    cyl('Maple sundial',(0,0,.09),.72,.17,mat('wood','wood'));ticks((0,0),.62,24,mat('brown'),z=.182)
    g=poly('Slate triangular gnomon',[(0,0),(.55,0),(0,.70)],-.025,.05,mat('slate'),.008);g.rotation_euler.x=PI/2;g.location.z=.19

def bridge():
    box('Teal bridge deck',(0,0,.28),(1.70,.65,.09),mat('teal'))
    for y in [-.33,.33]:
        bottom=[(-.8+i*.4,y,.34) for i in range(5)];top=[(-.60+i*.4,y,.83) for i in range(4)]
        for i in range(4):rod('Truss diagonal',bottom[i],top[i],.035,mat('wood','wood'));rod('Truss diagonal',top[i],bottom[i+1],.035,mat('wood','wood'))
        rod('Truss upper chord',top[0],top[-1],.035,mat('wood','wood'));rod('Lower chord',bottom[0],bottom[-1],.035,mat('wood','wood'))
        for p in bottom+top:ball('Wood joint',p,(.055,)*3,mat('wood','wood'))
    for x in [-.65,.65]:box('Bridge foot',(x,0,.12),(.23,.8,.24),mat('wood','wood'))

def gear(name,x,y,z,r,teeth,material):
    pts=[]
    for i in range(teeth*4):
        a=TAU*i/(teeth*4);radius=r*(1 if i%4 in [1,2] else .85);pts.append((radius*math.cos(a),radius*math.sin(a)))
    o=poly(name,pts,-.065,.13,material,.012);o.rotation_euler.x=PI/2;o.location=(x,y,z)
    cyl('Brass gear axle',(x,y-.10,z),.075,.09,mat('gold','metal'),(0,1,0))

def gears():
    box('Gear display base',(0,0,.06),(1.65,.65,.12),mat('wood','wood'))
    for x,z,r,n,c in [(-.43,.70,.48,16,'wood'),(.28,.97,.29,10,'plum'),(.41,.45,.34,12,'sage')]:gear('Intermeshing wooden gear',x,0,z,r,n,mat(c,'wood'))

def mobius():
    # A closed thick surface swaps both width and shell side at the half-twist.
    # This avoids the visible normal seam produced by solidifying an open strip.
    verts=[];n=128;m=12
    def index(i,j,side):
        if i==n:return (m-j)*2+(1-side)
        return (i*(m+1)+j)*2+side
    for i in range(n):
        a=TAU*i/n;ca=math.cos(a);sa=math.sin(a);ch=math.cos(a/2);sh=math.sin(a/2)
        for j in range(m+1):
            w=-.38+.76*j/m;r=.62+w*ch
            point=Vector((r*ca,r*sa,w*sh))
            tangent=Vector((-.5*w*sh*ca-r*sa,-.5*w*sh*sa+r*ca,.5*w*ch));across=Vector((ch*ca,ch*sa,sh));normal=tangent.cross(across).normalized()
            for side in [0,1]:verts.append(point+normal*((side*2-1)*.013))
    faces=[]
    for i in range(n):
        for j in range(m):
            for side in [0,1]:
                face=(index(i,j,side),index(i,j+1,side),index(i+1,j+1,side),index(i+1,j,side));faces.append(face if side else face[::-1])
        for j in [0,m]:faces.append((index(i,j,0),index(i,j,1),index(i+1,j,1),index(i+1,j,0)))
    mesh=bpy.data.meshes.new('Seamless thick Mobius surface');mesh.from_pydata(verts,[],faces);mesh.update()
    import bmesh
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    o=bpy.data.objects.new('Mobius strip',mesh);bpy.context.collection.objects.link(o);assign(o,'Mobius strip',mat('teal','wood'));smooth(o);o.rotation_euler=(.15,0,-.4);o.location=(0,0,.62)
    cyl('Mobius base',(0,0,.07),.52,.13,mat('wood','wood'));rod('Sculpture support',(0,0,.1),(0,0,.42),.04,mat('wood','wood'))

def wirecat():
    base=mat('gold','metal');box('Cat plinth',(0,0,.065),(.95,.60,.12),mat('wood','wood'))
    pts=[(-.28,0,.16),(-.33,0,.75),(-.18,0,1.12),(-.29,0,1.55),(-.10,0,1.40),(.12,0,1.42),(.30,0,1.61),(.32,0,1.15),(.17,0,.99),(.36,0,.44),(.30,0,.16),(-.28,0,.16)]
    line('Angular cat outline',pts,.018,base)
    line('Rear wire frame',[(x,y+.16,z) for x,y,z in pts],.014,base)
    for i in [0,1,2,3,6,7,8,9,10]:rod('Wire frame depth',pts[i],(pts[i][0],pts[i][1]+.16,pts[i][2]),.012,base)
    for a,b in [(0,2),(1,8),(2,8),(2,5),(3,6),(4,7),(5,8),(8,10),(0,8),(1,9),(7,4)]:rod('Geometric cat facet',pts[a],pts[b],.012,base)
    line('Angular curled tail',[(.3,0,.16),(.62,0,.20),(.76,0,.46),(.64,0,.54),(.56,0,.42)],.018,base)
    for x in [-.12,.14]:ball('Subtle geometric eye',(x,-.025,1.28),(.022,.015,.022),base)

def starmap():
    box('Folded navy star chart',(0,0,.025),(1.70,1.05,.045),mat('navy','cloth'),.025)
    stars=[(-.68,.21),(-.49,.32),(-.27,.14),(-.10,.37),(.13,.20),(.30,.37),(.55,.23),(.68,.38),(-.61,-.25),(-.39,-.14),(-.17,-.32),(.07,-.17),(.30,-.30),(.57,-.12)]
    for i,(x,y) in enumerate(stars):cyl('Star point',(x,y,.055),.011 if i%3 else .018,.004,mat('cream'))
    for a,b in [(0,1),(1,2),(2,3),(4,5),(5,6),(6,7),(8,9),(9,10),(10,11),(11,12),(12,13)]:line('Constellation',[(stars[a][0],stars[a][1],.052),(stars[b][0],stars[b][1],.052)],.002,mat('cream'))
    for x in [-.27,.27]:rod('Brass chart divider',(.52,-.15,.23),(.52+x,-.73,.10),.016,mat('gold','metal'))
    ball('Divider hinge',(.52,-.15,.23),(.035,)*3,mat('gold','metal'))

def architecture():
    gridpaper((0,0,.02),(1.7,1.3))
    wood=mat('wood','wood');box('House lower volume',(-.20,.03,.35),(.82,.65,.62),wood,.02)
    box('House upper volume',(.12,.16,.84),(.67,.62,.46),wood,.018)
    for x,angle in [(-.07,-.65),(.31,.65)]:box('Slate pitched roof',(x,.16,1.18),(.52,.76,.055),mat('slate'),.012,rot=(0,angle,0))
    for x,z in [(-.39,.40),(-.01,.40),(.12,.85)]:box('Recessed window',(x,-.305,z),(.17,.02,.23),mat('navy'),.01)
    box('Front door',(.16,-.31,.23),(.16,.025,.36),mat('brown'),.01)
    ball('Model tree foliage',(.70,.20,.55),(.14,.14,.27),mat('sage'));rod('Tree trunk',(.70,.20,.05),(.70,.20,.40),.025,wood)

def sliding():
    box('Maple sliding puzzle frame',(0,0,.07),(1.45,1.45,.13),mat('wood','wood'))
    box('Recessed playing tray',(0,0,.144),(1.27,1.27,.025),mat('brown'),.035)
    symbols=['○','△','◇','★','=','□','⬡','◒']
    for i,s in enumerate(symbols):
        x=-.42+(i%3)*.42;y=.42-(i//3)*.42
        box('Sliding tile',(x,y,.19),(.38,.38,.09),mat('cream','wood'),.035)
        brown=mat('brown')
        if i in [0,7]:
            angles=[TAU*j/48 for j in range(49)] if i==0 else [PI/2+PI*j/48 for j in range(49)]
            line('Circular inlay',[(x+.105*math.cos(a),y+.105*math.sin(a),.241) for a in angles],.009,brown)
            line('Fraction dividing line',[(x,y-.105,.241),(x,y+.105,.241)],.007,brown)
        elif i==1:poly('Triangle inlay',[(x-.10,y-.08),(x+.10,y-.08),(x,y+.11)],.237,.005,brown,.002)
        elif i==2:box('Diamond inlay',(x,y,.24),(.14,.14,.008),brown,.002,rot=(0,0,PI/4))
        elif i==3:poly('Star inlay',[(x+(.12 if j%2==0 else .052)*math.sin(TAU*j/10),y+(.12 if j%2==0 else .052)*math.cos(TAU*j/10)) for j in range(10)],.237,.005,brown,.002)
        elif i==4:
            for dy in [-.07,0,.07]:box('Three-bar inlay',(x,y+dy,.24),(.20,.025,.008),brown,.002)
        elif i==5:
            box('Square inlay',(x,y,.24),(.20,.20,.008),brown,.002)
            line('Square diagonal',[(x-.10,y-.10,.246),(x+.10,y+.10,.246)],.008,mat('cream'))
        else:poly('Hexagon inlay',[(x+.11*math.cos(TAU*j/6),y+.11*math.sin(TAU*j/6)) for j in range(6)],.237,.005,brown,.002)

def rover():
    box('Rover chassis',(0,0,.32),(1.04,.85,.25),mat('sage'),.10)
    for x in [-.63,.63]:
        cyl('Rubber wheel',(x,0,.30),.30,.20,mat('ink'),(1,0,0));cyl('Wood hub',(x+(-.11 if x<0 else .11),0,.30),.17,.02,mat('wood','wood'),(1,0,0))
        for i in range(18):
            a=TAU*i/18;box('Wheel tread',(x,.30*math.sin(a),.30+.30*math.cos(a)),(.21,.055,.035),mat('ink'),.008,rot=(a,0,0))
    board=capture(circuit_board);group('Small rover circuit',board,(0,0,.46),scale=.53)
    box('Sensor upright',(0,.20,.85),(.56,.25,.32),mat('cream'),.06)
    for x in [-.16,.16]:cyl('Ultrasonic sensor',(x,.052,.87),.10,.09,mat('slate','metal'),(0,-1,0));cyl('Sensor aperture',(x,-.001,.87),.075,.015,mat('ink'),(0,-1,0))
    line('Circuit cable',[(-.3,.2,.55),(-.37,.3,.75),(-.21,.3,.90)],.016,mat('coral'))

def hourglass():
    wood=mat('wood','wood')
    for z in [.08,1.42]:cyl('Hourglass wood cap',(0,0,z),.44,.12,wood)
    for a in [0,TAU/3,2*TAU/3]:rod('Frame upright',(.35*math.cos(a),.35*math.sin(a),.14),(.35*math.cos(a),.35*math.sin(a),1.36),.035,wood)
    profile=[(.28,.16),(.28,.30),(.20,.52),(.07,.69),(.025,.75),(.07,.81),(.20,.98),(.28,1.20),(.28,1.34)]
    glass=lathe('Hourglass glass',profile,mat('F4F6ED','glass'));glass.modifiers.new('Thin glass wall','SOLIDIFY').thickness=.008
    lathe('Sand lower pile',[(0,.16),(.26,.16),(.23,.20),(.03,.36),(0,.38)],mat('E3B970'))
    lathe('Upper sand',[(.025,.76),(.11,.86),(.20,1.03),(0,1.03)],mat('E3B970'));rod('Falling sand',(0,0,.38),(0,0,.76),.006,mat('E3B970'))

def curveboard():
    box('Coordinate pegboard',(0,0,.79),(1.30,.13,1.48),mat('wood','wood'))
    box('Pegboard stand',(0,0,.07),(1.47,.58,.14),mat('wood','wood'))
    for i in range(7):
        for j in range(7):cyl('Grid hole',(-.51+i*.17,-.073,.24+j*.17),.014,.006,mat('brown'),(0,1,0))
    points=[(x/40-.55,-.12,.28+3.0*(x/40-.55)**2) for x in range(45)]
    line('Parabolic cord',points,.018,mat('plum','felt'))
    for x in [-.51,-.34,0,.34,.51]:ball('Curve peg',(x,-.13,.28+3*x*x),(.045,.035,.045),mat('plum'))
    for x in [-.51,.51]:
        for z in [.24,1.26]:ball('Coordinate corner peg',(x,-.12,z),(.045,.035,.045),mat('teal'))

BUILDERS=[microscope,drafting,calculator,polyhedra,orrery,molecule,circuit,prism,caliper,sundial,bridge,gears,mobius,wirecat,starmap,architecture,sliding,rover,hourglass,curveboard]
