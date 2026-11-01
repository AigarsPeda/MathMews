from common import *

def yarn():legacy.yarn()

def cat_head(loc=(0,0,0),scale=1,awake=False):
    before=set(bpy.context.scene.objects)
    fur=mat('cream','felt');pink=mat('pink','felt')
    ball('Round felt cat head',(0,0,.34),(.35,.28,.28),fur)
    for x in [-.23,.23]:
        legacy.soft_triangle('Cream soft cat ear',[(x-.12,-.02,.46),(x+.12,-.02,.46),(x,-.01,.78)],.13,fur)
        legacy.soft_triangle('Pink inner ear',[(x-.065,-.027,.50),(x+.065,-.027,.50),(x,-.02,.68)],.015,pink)
    for x in [-.13,.13]:
        if awake:ball('Tiny cat eye',(x,-.265,.38),(.035,.021,.040),mat('ink'))
        else:line('Sleeping embroidered eye',[(x-.055,-.258,.38),(x,-.28,.40),(x+.055,-.258,.38)],.010,mat('ink'))
        for j in [-1,1]:line('Cotton whisker',[(x*1.15,-.27,.28+j*.02),(x*2.05,-.27,.28+j*.05)],.006,mat('brown'))
    ball('Blush nose',(0,-.289,.29),(.032,.022,.025),pink)
    line('Embroidered mouth',[(0,-.29,.27),(0,-.29,.23),(.045,-.28,.22)],.006,mat('brown'))
    return group('Cat head placement',list(set(bpy.context.scene.objects)-before),loc,scale=scale)

def sleepingcat():
    fur=mat('orange','felt');body=ring('Curled ginger cat body',(.06,.08,.27),.43,.23,fur);body.scale=(1.13,.92,1.0)
    ball('Tucked inner cat body',(.10,.12,.20),(.32,.28,.20),mat('cream','felt'))
    cat_head((-.28,-.20,.05),.95)
    points=[(.11+.60*math.cos(a),.06+.45*math.sin(a),.17) for a in [TAU*i/96 for i in range(97)]]
    line('Ginger tail wrapped around cat',points,.12,fur)
    ball('Tucked cream paw',(-.15,-.34,.18),(.20,.12,.11),mat('cream','felt'))

def mouse():
    felt=mat('sage','felt');ball('Upright mouse body',(0,0,.43),(.35,.27,.43),felt)
    ball('Cream belly patch',(0,-.23,.39),(.22,.055,.29),mat('cream','felt'))
    ball('Mouse head',(-.06,-.03,.92),(.30,.27,.25),felt)
    for x in [-.28,.22]:
        ball('Round felt ear',(x,.035,1.15),(.19,.085,.21),felt);ball('Blush ear interior',(x,-.038,1.15),(.13,.025,.15),mat('pink','felt'))
    ball('Pointed snout',(-.14,-.28,.88),(.20,.16,.13),felt);ball('Mouse pink nose',(-.14,-.452,.91),(.045,.025,.036),mat('pink'))
    for side in [-1,1]:
        for z in [.85,.90]:line('Fine mouse whisker',[(-.14+side*.05,-.45,z),(-.14+side*.29,-.43,z+.04*side)],.004,mat('ink'))
    for x in [-.21,.10]:ball('Embroidered eye',(x,-.245,1.00),(.025,.020,.028),mat('ink'))
    for x in [-.18,.18]:ball('Mouse foot',(x,-.13,.08),(.13,.16,.08),felt)
    legacy.rope('Blush cotton tail',[Vector((.25+.70*i/80,.11+.23*math.sin(i/80*TAU),.07)) for i in range(81)],[mat('pink','cloth')],.027)
    stitches([(.23*math.sin(a),-.285,.40+.29*math.cos(a)) for a in [TAU*i/40 for i in range(41)]])

def fish():
    cloth=mat('teal','felt');ball('Padded fish body',(0,0,.36),(.58,.19,.34),cloth)
    ball('Cream fish face',(.38,-.02,.36),(.24,.195,.29),mat('cream','felt'))
    o=poly('Fish tail',[(-.48,.34),(-.98,.69),(-.94,.05)],-.06,.12,cloth,.06);o.rotation_euler.x=PI/2
    for x,z in [(-.18,.66),(-.10,.07)]:ball('Soft fish fin',(x,.02,z),(.20,.09,.14),cloth)
    ball('Stitched fish eye',(.46,-.207,.45),(.025,.014,.026),mat('ink'))
    line('Fish smile',[(.42,-.211,.30),(.49,-.205,.27),(.54,-.18,.30)],.008,mat('brown'))
    stitches([(.24,-.20,.11+i*.024) for i in range(22)])
    for x in [-.34,-.14,.06]:
        for z in [.27,.45]:line('Embroidered scale',[(x+.025,-.19,z-.035),(x-.025,-.205,z),(x+.025,-.19,z+.035)],.006,mat('cream'))

def paw():
    before=set(bpy.context.scene.objects)
    # One continuous padded backing, with inset pink toe and palm patches.
    pts=[(-.56,-.22),(-.62,.02),(-.53,.22),(-.37,.25),(-.39,.45),(-.25,.59),(-.08,.56),(0,.67),(.17,.63),(.27,.48),(.42,.48),(.56,.34),(.56,.13),(.66,-.01),(.62,-.22),(.42,-.47),(0,-.54),(-.34,-.48)]
    poly('Cream padded paw backing',pts,.04,.14,mat('cream','felt'),.06)
    for x,y,sx,sy in [(-.40,.16,.105,.13),(-.19,.40,.12,.15),(.14,.43,.12,.15),(.40,.22,.105,.13),(0,-.16,.25,.22)]:ball('Pink felt paw pad',(x,y,.22),(sx,sy,.065),mat('pink','felt'))
    for j,p in enumerate(pts):
        q=pts[(j+1)%len(pts)]
        for k in range(3):
            t=k/3;u=t+.11
            line('Lavender blanket stitch',[(.94*(p[0]*(1-t)+q[0]*t),.94*(p[1]*(1-t)+q[1]*t),.19),(.87*(p[0]*(1-u)+q[0]*u),.87*(p[1]*(1-u)+q[1]*u),.19)],.009,mat('lavender','cloth'))
    group('Tilted felt paw',list(set(bpy.context.scene.objects)-before),rot=(.65,0,-.06))

def books():
    for j,c in enumerate(['pink','sage','lavender']):
        z=.12+j*.24;objs=[]
        for zz in [z-.075,z+.075]:objs+=capture(box,'Cloth book board',(0,0,zz),(1.15,.78,.04),mat(c,'cloth'),.035)
        objs+=capture(box,'Cream page block',(.025,0,z),(1.06,.71,.12),mat('cream'),.025)
        objs+=capture(box,'Book cloth spine',(-.55,0,z),(.07,.78,.17),mat(c,'cloth'),.03)
        for k in range(4):objs+=capture(line,'Page line',[(-.45,-.358,z-.04+k*.025),(.51,-.358,z-.04+k*.025)],.0025,mat('wood'))
        if j==2:objs+=capture(box,'Lavender bookmark',(.24,-.40,z+.10),(.12,.34,.018),mat('lavender','cloth'),.007)
        group('Book stack placement',objs,rot=(0,0,[-.12,.07,-.03][j]))

def blocks():
    for j,(x,y,s,c,ch,a) in enumerate([(-.40,.24,.86,'wood','+',-.08),(.31,.20,.72,'sage','−',.10),(.53,-.44,.67,'lavender','=',-.03)]):
        objects=capture(box,'Rounded arithmetic block',(0,0,s/2),(s,s,s),mat(c,'wood'),.12)
        objects+=capture(box,'Inset face',(0,-s/2-.001,s/2),(s*.76,.009,s*.76),mat(c,'wood'),.08)
        objects+=capture(text,'Carved math symbol',ch,(0,-s/2-.013,s/2),s*.95,mat('plum' if c!='sage' else 'teal'),True)
        group('Arithmetic block placement',objects,(x,y,.025),(0,0,a))

def abacus():
    wood=mat('wood','wood')
    for x in [-.66,.66]:box('Abacus side frame',(x,0,.65),(.14,.22,1.30),wood,.045,rot=(0,.035 if x<0 else -.025,0))
    for z in [.10,1.22]:rod('Abacus crossbar',(-.66,0,z),(.66,0,z),.065,wood)
    for row,c in enumerate(['gold','teal','sage','pink']):
        z=.27+row*.24;rod('Maple bead rod',(-.60,0,z),(.60,0,z),.025,wood)
        for j in range(5):ball('Matte painted bead',(-.44+j*.21,0,z),(.085,.105,.115),mat(c,'wood'))

def pencils():
    objs=capture(legacy.pencils)
    for o in list(objs):
        if o.name=='Paper scrap':objs.remove(o);bpy.data.objects.remove(o,do_unlink=True)
    roots=[o for o in objs if not o.parent]
    group('Diagonal pastel pencils',roots,rot=(0,0,PI/2))

def pencilroll():
    linen=mat('cream','cloth');box('Soft linen roll',(0,0,.055),(1.30,1.25,.10),linen,.06)
    for x,c in [(-.32,'lavender'),(-.08,'sage')]:
        rod('Short colored pencil',(x,-.25,.18),(x,.53,.18),.040,mat(c,'wood'))
        bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.041,radius2=0,depth=.18,location=(x,.62,.18));o=bpy.context.object;o.rotation_euler.x=-PI/2;assign(o,'Sharpened cedar tip',mat('wood','wood'))
    box('Linen pocket panel',(0,-.27,.20),(1.20,.58,.045),linen,.035)
    for x in [-.50,-.25,0,.25,.50]:stitches([(x,-.50+i*.025,.227) for i in range(21)])
    cyl('Rolled fabric edge',(.61,0,.13),.10,1.24,linen,(0,1,0))
    legacy.rope('Cotton tie',[Vector((.58+.35*i/70,-.55+.16*math.sin(i/70*TAU),.035)) for i in range(71)],[mat('cream','cloth')],.018)
    for j in range(3):leaf('Embroidered leaf',(.30+j*.04,-.22+j*.09,.24),.055,mat('sage'),.4)

def ruler():
    wood=mat('wood','wood');box('Maple school ruler',(0,.10,.07),(1.65,.30,.13),wood,.04,rot=(0,0,.15))
    marks=[]
    for i in range(29):marks+=capture(line,'Engraved ruler graduation',[(-.72+i*.05,.23,.139),(-.72+i*.05,.13 if i%5==0 else .18,.139)],.004,mat('brown'))
    group('Ruler graduation placement',marks,rot=(0,0,.15))
    box('Pink rubber eraser',(.40,-.34,.08),(.44,.25,.15),mat('pink','felt'),.04,rot=(0,0,-.2))

def chalkboard():
    w=mat('wood','wood');before=set(bpy.context.scene.objects)
    box('Rounded maple frame',(0,0,.09),(1.45,1.08,.18),w,.11)
    box('Inset dusty slate',(0,0,.19),(1.20,.84,.025),mat('526F65','felt'),.07)
    for points in [[(-.19,0,.21),(.19,0,.21)],[(0,-.19,.21),(0,.19,.21)]]:line('Chalk plus',points,.021,mat('cream'))
    group('Tilted slate',list(set(bpy.context.scene.objects)-before),rot=(.60,0,0))
    rod('Chalk stub',(.35,-.63,.05),(.65,-.55,.05),.035,mat('cream'))

def satchel():
    cloth=mat('sage','cloth');box('Padded school satchel',(0,0,.58),(1.17,.54,1.10),cloth,.15)
    box('Rounded front flap',(0,-.31,.79),(1.10,.10,.65),cloth,.12)
    box('Cream cat patch',(0,-.372,.83),(.46,.025,.36),mat('cream','felt'),.09)
    for x in [-.12,.12]:line('Cat patch closed eye',[(x-.025,-.393,.86),(x,-.395,.84),(x+.025,-.393,.86)],.006,mat('brown'))
    line('Cat patch stitched mouth',[(-.045,-.398,.77),(0,-.398,.75),(.045,-.398,.77)],.006,mat('brown'))
    for x in [-.16,.16]:
        line('Patch cat ear',[(x-.05,-.398,.92),(x,-.398,1.00),(x+.05,-.398,.92)],.008,mat('pink','cloth'))
        for z in [.78,.81]:line('Patch whisker',[(x*.65,-.398,z),(x*1.2,-.398,z+.015)],.005,mat('brown'))
    for x in [-.37,.37]:
        box('Cream fastening strap',(x,-.39,.44),(.13,.055,.55),mat('cream','cloth'),.035)
        ring('Small brass buckle',(x,-.43,.53),.070,.015,mat('gold','metal'),(PI/2,0,0))
        line('Canvas shoulder strap',[(x,.20,.90),(x,.44,.92),(x,.52,.30),(x,.28,.16)],.044,cloth)
    line('Satchel handle',[(-.20,0,1.14),(-.17,0,1.34),(.17,0,1.34),(.20,0,1.14)],.040,cloth)
    stitches([(-.48+i*.025,-.369,1.03) for i in range(39)])

def fractions():legacy.fractionpie()

def rings():
    w=mat('wood','wood');cyl('Rounded ring base',(0,0,.08),.52,.15,w)
    rod('Maple peg',(0,0,.12),(0,0,1.24),.075,w)
    for j,c in enumerate(['pink','sage','teal','lavender']):ring('Soft painted ring',(.015*math.sin(j),0,.25+j*.20),.37-j*.065,.09,mat(c,'wood'),(.03*math.sin(j),.02*math.cos(j),0))
    ball('Peg cap',(0,0,1.24),(.075,.075,.055),w)

def flowers():
    before=set(bpy.context.scene.objects)
    for x,y,r,c in [(-.30,.25,.24,'lavender'),(.38,-.10,.20,'pink')]:
        rod('Wrapped felt flower stem',(x-.12,y-.65,.055),(x,y,.08),.028,mat('sage','felt'))
        for k in range(5):
            a=TAU*k/5;petal=ball('Wool flower petal',(x+r*math.sin(a),y+r*math.cos(a),.12),(.13,.21,.095),mat(c,'felt'));petal.rotation_euler.z=-a
        for k in range(7):
            a=TAU*k/6;ball('Golden wool flower center',(x+(.065*math.sin(a) if k<6 else 0),y+(.065*math.cos(a) if k<6 else 0),.21),(.043,)*3,mat('gold','felt'))
        leaf('Felt flower leaf',(x-.15,y-.40,.08),.17,mat('sage','felt'),-.65)
    group('Upright felt flowers',list(set(bpy.context.scene.objects)-before),rot=(.70,0,0))

def stars():
    before=set(bpy.context.scene.objects)
    for k,(x,y,r,c,a) in enumerate([(-.30,.25,.40,'lavender',.12),(-.48,-.38,.33,'gold',-.15),(.36,-.25,.35,'sage',.1)]):
        pts=[(x+r*(1 if j%2==0 else .48)*math.cos(PI/2+j*PI/5+a),y+r*(1 if j%2==0 else .48)*math.sin(PI/2+j*PI/5+a)) for j in range(10)]
        poly('Padded felt star',pts,.05,.09,mat(c,'felt'),.035)
        seam=[]
        for j in range(10):
            p,q=Vector(pts[j]),Vector(pts[(j+1)%10]);center=Vector((x,y))
            for step in range(5):v=center+((p*(1-step/5)+q*(step/5))-center)*.84;seam.append((v.x,v.y,.149))
        stitches(seam+[seam[0]],mat('cream','cloth'))
    group('Tilted padded stars',list(set(bpy.context.scene.objects)-before),rot=(.65,0,0))

def tray():
    w=mat('wood','wood');box('Maple counting tray',(0,0,.055),(1.65,.65,.10),w,.08)
    for x in [-.78,.78]:box('Tray end',(x,0,.17),(.10,.65,.22),w,.04)
    for y in [-.28,.28]:box('Tray side',(0,y,.17),(1.55,.09,.22),w,.035)
    for j,c in enumerate(['pink','lavender','teal','sage','gold']):ball('Soft wool counter',(-.59+j*.29,0,.24),(.13,.13,.16),mat(c,'felt'))

def readingcat():
    ball('Seated cream kitten',(0,.02,.43),(.32,.25,.39),mat('cream','felt'));cat_head((0,.01,.55),.92,True)
    line('Cat tail',[(.20,.12,.20),(.48,.24,.35),(.48,.20,.65)],.075,mat('cream','felt'))
    for side in [-1,1]:
        box('Lavender open book cover',(side*.31,-.33,.07),(.62,.67,.07),mat('lavender','cloth'),.035,rot=(0,side*.10,0))
        box('Open cream pages',(side*.30,-.33,.13),(.56,.61,.08),mat('cream'),.025,rot=(0,side*.10,0))
        ball('Kitten paw on book',(side*.20,-.22,.25),(.11,.13,.08),mat('cream','felt'))
        ball('Kitten forearm',(side*.20,-.14,.35),(.085,.10,.16),mat('cream','felt'))
        for j in range(4):line('Book story line',[(side*.10,-.52+j*.07,.18),(side*.46,-.52+j*.07,.18)],.003,mat('brown'))

def basket():
    w=mat('wood','wood');cyl('Basket base',(0,0,.06),.60,.10,w)
    for j in range(8):
        z=.13+j*.07;rx=.56+.06*j/7;ry=.38+.04*j/7
        verts=[]
        for i in range(128):
            a=TAU*i/128;ripple=.012*math.sin(a*12+j*PI)
            for zz in [z-.030,z+.030]:verts.append(((rx+ripple)*math.cos(a),(ry+ripple)*math.sin(a),zz))
        mesh=bpy.data.meshes.new('Wicker band');mesh.from_pydata(verts,[],[(2*i,2*i+1,(2*i+3)%256,(2*i+2)%256) for i in range(128)]);mesh.update();o=bpy.data.objects.new('Flat interwoven wicker band',mesh);bpy.context.collection.objects.link(o);assign(o,'Flat interwoven wicker band',w);o.modifiers.new('Wicker thickness','SOLIDIFY').thickness=.018
    for i in range(24):
        a=TAU*i/24;line('Woven upright strip',[((.56+.06*j/8+.012*math.sin(j*PI))*math.cos(a),(.38+.04*j/8+.012*math.sin(j*PI))*math.sin(a),.10+j*.07) for j in range(9)],.022,w)
    for x in [-.58,.58]:line('Basket handle',[(x,.23*math.cos(a),.55+.30*math.sin(a)) for a in [PI*i/32 for i in range(33)]],.040,w)
    # Wound yarn skein is real strands, reduced from the standalone model.
    objs=capture(legacy.yarn);group('Yarn in basket',objs,(-.18,.05,.46),scale=.39)
    objs=capture(fish);group('Fish in basket',objs,(.31,-.08,.59),(0,-.25,.15),.48)

BUILDERS=[yarn,sleepingcat,mouse,fish,paw,books,blocks,abacus,pencils,pencilroll,ruler,chalkboard,satchel,fractions,rings,flowers,stars,tray,readingcat,basket]
