"""Close-up collectible cat films. Render actors once, then 18 world stages.
The offline edit adds scene-specific camera moves and comic holds.

The same authored cat GLB used in the game supplies the skin and facial rig.
No puzzle scenes, source animations, or progression data are modified.
"""
from pathlib import Path
import sys, math, json, time, hashlib, shutil
import bpy
import numpy as np
from mathutils import Vector, Euler, Matrix
from mathutils.bvhtree import BVHTree
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'scripts/3d'))
# Load geometry helpers without executing the general asset export entry point.
scope = {'__file__': str(ROOT/'scripts/3d/render_assets.py'), '__name__': 'reward_helpers'}
exec(compile(Path(scope['__file__']).read_text(), scope['__file__'], 'exec'), scope)
box, sphere, cylinder, torus, curve, empty, setup, aim = [scope[k] for k in ('box','sphere','cylinder','torus','curve','empty','setup','aim')]
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT = Path('/tmp/brainpet-reward-studio') / ('previews' if '--preview' in ARGS else '')
KINDS = ('bridge','book','loom','clock','balloon','sorter','boat','fountain','beacon','trophy')
WORLDS = list(dict.fromkeys(s['world'] for s in json.loads((ROOT/'data/lesson-boss-scenes.json').read_text())))
COUNT = 48
CAT_SOURCE = OUT/'cat-source.glb'

def smooth(a,b,t):
    u = max(0,min(1,(t-a)/(b-a)))
    return u*u*(3-2*u)

def arc(a,b,t):
    return math.sin(math.pi*smooth(a,b,t))

def show(obj, yes=True, scale=1):
    obj.scale = (scale if yes else .00001,)*3

def studio():
    scene = setup(768)
    scope['MATS'].clear()
    scene.render.resolution_y = 672
    scene.camera.location = (1.4,-10,4.4)
    aim(scene.camera,(0,0,1.5))
    scene.camera.data.ortho_scale = 4.3
    if hasattr(scene,'eevee'): scene.eevee.taa_render_samples = 32
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
    scene.objects['Warm key'].data.energy = 350
    scene.objects['Fill'].data.energy = 130
    return scene

class Actor:
    def __init__(self, scene):
        old = set(bpy.data.actions)
        bpy.ops.import_scene.gltf(filepath=str(CAT_SOURCE))
        self.arm = next(o for o in scene.objects if o.type=='ARMATURE')
        for o in list(scene.objects):
            if 'Game prop' in o.name: bpy.data.objects.remove(o,do_unlink=True)
            elif o.animation_data:
                for track in o.animation_data.nla_tracks: track.mute = True
        actions = {a.name.split('.')[0]:a for a in set(bpy.data.actions)-old}
        self.poses = {}
        for state in ('idle','surprised','puzzleProud','puzzleThink','puzzleHighPaw','dance','sit','hop','yarnRoll'):
            action = actions[state]
            self.arm.animation_data_create()
            self.arm.animation_data.action = action
            self.arm.animation_data.action_slot = action.slots[0]
            for n in range(33):
                frame = action.frame_range[0]+(action.frame_range[1]-action.frame_range[0])*n/32
                scene.frame_set(int(frame),subframe=frame%1)
                bpy.context.view_layer.update()
                self.poses[state,n] = {b.name:b.matrix_basis.copy() for b in self.arm.pose.bones}
        for o in [self.arm,*self.arm.children]: o.animation_data_clear()
        self.skin = next(o for o in self.arm.children if o.name == 'Game cat skin')
        self.root = empty('Reward cat')
        self.arm.parent = self.root
    def pose(self, state='idle', phase=0, reaction=None, blend=0):
        def sample(name,t):
            n=max(0,min(32,t*32)); lo=int(n); hi=min(32,lo+1)
            return {k:m.lerp(self.poses[name,hi][k],n-lo) for k,m in self.poses[name,lo].items()}
        values=sample(state,phase)
        other=sample(reaction[0],reaction[1]) if reaction else values
        for bone in self.arm.pose.bones: bone.matrix_basis=values[bone.name].lerp(other[bone.name],blend)
        # Slightly larger heads keep expressions readable at phone size.
        self.arm.pose.bones['head'].scale *= 1.16
        self.root.location=(0,0,.13);self.root.rotation_euler=(0,0,.1);self.root.scale=(1,1,1)
    def turn_head(self, x=0,y=0,z=0):
        bone=self.arm.pose.bones['head']
        bone.rotation_quaternion=bone.rotation_quaternion @ Euler((x,y,z)).to_quaternion()
    def face(self, mood, amount=1):
        bones=self.arm.pose.bones
        for side in ('L','R'):
            eye=bones['eye.'+side];glint=bones['eye.'+side+'.glint']
            closed=mood in ('joy','sleep') or (mood=='wink' and side=='R')
            height=.08 if closed else {'shock':1.8,'deadpan':.38,'wink':1.15,'proud':1.1}.get(mood,1)
            for bone in (eye,glint):bone.scale.y *= 1+(height-1)*amount
            if mood=='shock':eye.scale.x *= 1+.3*amount
            bones['brow.'+side].location.y += (.055 if mood=='shock' else .035 if mood=='deadpan' and side=='L' else -.012 if mood=='sleep' else 0)*amount
            lid=bones['lid.'+side]
            lid.scale=lid.scale.lerp(Vector((1 if closed else .00001,)*3),amount)
        mouth=bones['mouth.open']
        opened=(1.55,2.8,1.2) if mood=='shock' else (1.3,1.6,1) if mood=='joy' else (.00001,)*3
        mouth.scale=mouth.scale.lerp(Vector(opened),amount)
        bones['mouth.smile'].scale=bones['mouth.smile'].scale.lerp(Vector((1,)*3 if mood in ('joy','wink','proud','sleep') else (.00001,)*3),amount)
        bones['mouth.frown'].scale=bones['mouth.frown'].scale.lerp(Vector((.00001,)*3),amount)
    def point(self, bone, offset=(0,0,0)):
        bpy.context.view_layer.update()
        return self.arm.matrix_world @ self.arm.pose.bones[bone].matrix @ Vector(offset)
    def ground(self, height=.09):
        """Place the evaluated soles on their support, including pose deformation."""
        bpy.context.view_layer.update()
        mesh=self.skin.evaluated_get(bpy.context.evaluated_depsgraph_get())
        low=min((mesh.matrix_world @ v.co).z for v in mesh.data.vertices)
        self.root.location.z += height-low
        bpy.context.view_layer.update()
    def paw(self, side, target):
        """Reward-only two-bone IK. The prop and the paw share one world target."""
        names=[side+'.forelegjoint0',side+'.forelegjoint1',side+'.front.paw']
        bones=self.arm.data.bones
        bpy.context.view_layer.update()
        shoulder=self.arm.pose.bones[names[0]].matrix.translation.copy()
        toe=self.arm.matrix_world.inverted() @ Vector(target)
        a,b,c=[bones[n].head_local for n in names]
        upper,lower=(b-a).length,(c-b).length
        direction=toe-shoulder; distance=max(.001,min(direction.length,upper+lower-.0001));direction.normalize()
        along=(upper*upper-lower*lower+distance*distance)/(2*distance)
        bend=Vector((0,1,0));bend-=direction*bend.dot(direction)
        elbow=shoulder+direction*along+bend.normalized()*math.sqrt(max(0,upper*upper-along*along))
        toe=shoulder+direction*distance
        rotations=[(b-a).rotation_difference(elbow-shoulder).to_matrix(),(c-b).rotation_difference(toe-elbow).to_matrix(),Matrix.Identity(3)]
        for name,pos,rot in zip(names,(shoulder,elbow,toe),rotations):
            self.arm.pose.bones[name].matrix=Matrix.Translation(pos) @ rot.to_4x4() @ bones[name].matrix_local.to_3x3().to_4x4()
            bpy.context.view_layer.update()
    def surface_near(self, point):
        bpy.context.view_layer.update()
        mesh=self.skin.evaluated_get(bpy.context.evaluated_depsgraph_get())
        tree=BVHTree.FromPolygons([mesh.matrix_world @ v.co for v in mesh.data.vertices],[p.vertices for p in mesh.data.polygons])
        return tree.find_nearest(Vector(point))[0]
    def crown(self):
        """Find the actual head surface between the ears, rather than guessing height."""
        center=self.point('head',(0,.3,0))
        mesh=self.skin.evaluated_get(bpy.context.evaluated_depsgraph_get())
        verts=[mesh.matrix_world @ v.co for v in mesh.data.vertices]
        tree=BVHTree.FromPolygons(verts,[p.vertices for p in mesh.data.polygons])
        hit=tree.ray_cast(Vector((center.x,center.y,5)),Vector((0,0,-1)))[0]
        return hit if hit is not None else center
    def head_point(self, offset):
        bpy.context.view_layer.update()
        return self.arm.matrix_world @ self.arm.pose.bones['head'].matrix @ Vector(offset)

def yarnball(parent, loc, radius=.36):
    p=empty('Wound yarn ball',loc,parent)
    sphere('Yarn core',(0,0,0),(radius,)*3,'coral',p)
    for n in range(7):
        o=torus('Wound strands',(0,0,0),radius*.98,.014,'red',p)
        o.rotation_euler=(n*.42,n*.37,n*.19)
    return p

def duck(parent, scale=1):
    p=empty('Rubber duck',parent=parent)
    sphere('Duck body',(0,0,.22),(.38,.3,.26),'gold',p)
    sphere('Duck head',(0,-.2,.52),(.23,.21,.23),'gold',p)
    sphere('Duck beak',(0,-.43,.47),(.17,.13,.065),'coral',p)
    for x in [-.105,.105]:
        sphere('Duck eye',(x,-.375,.57),(.026,.024,.035),'ink',p)
        sphere('Duck glint',(x-.006,-.397,.582),(.008,)*3,'white',p)
    for x in [-.3,.3]:sphere('Duck wing',(x,.015,.3),(.1,.19,.12),'orange',p)
    p.scale=(scale,)*3
    return p

def star(parent, loc, radius, color='gold'):
    verts=[]
    for y in [-.065,.065]:
        for n in range(10):
            a=math.pi/2+n*math.pi/5;r=radius*(1 if n%2==0 else .48)
            verts.append((math.cos(a)*r,y,math.sin(a)*r))
    faces=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(n,(n+1)%10,(n+1)%10+10,n+10) for n in range(10)]
    mesh=bpy.data.meshes.new('Five-point star');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Prize star',mesh);bpy.context.collection.objects.link(o)
    o.location=loc;o.parent=parent;o.data.materials.append(scope['material'](color))
    bevel=o.modifiers.new('Soft star edges','BEVEL');bevel.width=.035;bevel.segments=3
    o.modifiers.new('Star normals','WEIGHTED_NORMAL')
    return o

def clock_prop():
    p=empty('Clock',(-1,0,.64))
    body=cylinder('Alarm clock body',(0,0,0),.43,.22,'teal',p,(math.pi/2,0,0))
    cylinder('Ivory clock face',(0,-.125,0),.36,.025,'paper',p,(math.pi/2,0,0))
    for n in range(12):
        a=n*math.tau/12
        tick=box('Clock hour',(math.sin(a)*.29,-.147,math.cos(a)*.29),(.025,.025,.055),'ink',.006,p)
        tick.rotation_euler[1]=a
    hand=empty('Clock hands',parent=p)
    box('Minute hand',(0,-.17,.1),(.035,.035,.21),'ink',.01,hand)
    box('Hour hand',(.075,-.17,0),(.16,.04,.04),'coral',.01,hand)
    bells=[]
    for x in [-.3,.3]:
        bell=empty('Flying bell',(x,0,.42),p);sphere('Clock bell',(0,0,0),(.21,.17,.12),'gold',bell)
        bells.append(bell)
        sphere('Clock foot',(x,0,-.4),(.08,.1,.14),'teal',p)
    return p,hand,bells

def make_film(kind):
    scene=studio();cat=Actor(scene);prop=empty('Story prop');extras=[]
    # A small contact shadow anchors the transparent actor layer to every stage.
    shadow=sphere('Soft toy shadow',(0,.1,.105),(.72,.53,.018),'C8BEAC')
    if kind=='loom':
        ball=yarnball(prop,(-1.05,-.15,.39),.3)
        # A continuous strand is laid OUTSIDE the seated body, never scaled through it.
        wraps=empty('Scarf cocoon',parent=prop)
        coils=[]
        for n in range(5):
            points=[]
            for j in range(25):
                a=(n+j/24)*math.tau
                points.append((.57*math.cos(a),.08+.79*math.sin(a)+.2*max(0,math.sin(a))**2,.18+(n+j/24)*.124))
            coils.append(curve('Knitted scarf',points,.074,'coral' if n%3 else 'paper',wraps))
        tail=empty('Scarf fringe reveal',parent=wraps)
        box('Scarf tail',(.45,-.62,.43),(.19,.07,.44),'coral',.025,tail)
        for x in [.38,.43,.48,.53]:curve('Scarf fringe',[(x,-.62,.23),(x,-.62,.15)],.012,'paper',tail)
        strand=curve('Unspooling yarn',[(0,0,0)]*3,.021,'coral',prop)
    elif kind=='sorter':
        crate=empty('Delivery box',(-.55,.15,.07),prop)
        box('Box bottom',(0,0,.08),(1.3,1.75,.12),'wood',.04,crate)
        for x in [-.65,.65]:box('Box side',(x,0,.44),(.075,1.75,.72),'wood',.025,crate)
        for y in [-.85,.85]:box('Box wall',(0,y,.44),(1.3,.075,.72),'wood',.025,crate)
        box('Parcel label',(.1,-.894,.45),(.54,.018,.35),'paper',.015,crate)
        for x in [-.04,.04,.12]:box('Label mark',(x,-.91,.47),(.025,.015,.19),'brown',.003,crate)
        flaps=[]
        for sign in [-1,1]:
            f=empty('Box flap',(sign*.65,0,.8),crate)
            box('Cardboard flap',(sign*.19,0,0),(.38,1.75,.05),'wood',.015,f);flaps.append(f)
    elif kind=='clock':
        alarm,hand,bells=clock_prop()
    elif kind=='bridge':
        cushion=empty('Landing cushion',(.65,.05,.09),prop)
        box('Velvet cushion',(0,0,.14),(1.45,1.55,.28),'teal',.12,cushion)
        for x in [-.58,.58]:curve('Cushion seam',[(x,-.62,.15),(x,.62,.15)],.015,'paper',cushion)
        for n in range(9):
            f=empty('Escaping feather',parent=prop)
            sphere('Feather',(0,0,0),(.045,.025,.18),'paper',f)
            curve('Feather spine',[(0,-.025,-.14),(0,-.025,.14)],.007,'gold',f);extras.append(f)
    elif kind=='book':
        book=empty('Pop-up book',(-.85,-.3,.16),prop)
        box('Book cover',(0,0,0),(1.1,.85,.14),'teal',.045,book)
        box('Book pages',(0,0,.09),(1.02,.78,.09),'paper',.02,book)
        lid=empty('Opening cover',(-.55,0,.15),book)
        box('Upper cover',(.55,0,0),(1.1,.85,.07),'teal',.025,lid)
        star(lid,(.55,-.02,.06),.18).rotation_euler.x=math.pi/2
        fish=empty('Pop-up fish',parent=prop)
        sphere('Fish body',(0,0,0),(.35,.12,.18),'gold',fish)
        tail=box('Fish tail',(.36,0,0),(.21,.07,.21),'coral',.04,fish);tail.rotation_euler.y=math.pi/4
        sphere('Fish eye',(-.19,-.12,.04),(.055,.025,.065),'ink',fish)
        sphere('Fish eye shine',(-.205,-.145,.06),(.016,.01,.018),'paper',fish)
    elif kind=='balloon':
        balloon=empty('Balloon',(0,.2,2.35),prop)
        sphere('Balloon silk',(0,0,0),(.47,.38,.58),'coral',balloon)
        sphere('Balloon highlight',(-.2,-.32,.2),(.09,.025,.19),'paper',balloon)
        sphere('Balloon knot',(0,0,-.6),(.06,.05,.07),'coral',balloon)
        string=curve('Balloon ribbon',[(0,.2,1.75),(0,-.1,1),(0,-.5,.7)],.016,'gold',prop)
    elif kind=='boat':
        bigduck=empty('Duck float',parent=prop)
        torus('Duck float ring',(0,0,.16),.63,.16,'gold',bigduck).scale.y=1.25
        cylinder('Float seat',(0,.05,.12),.57,.12,'orange',bigduck).scale.y=1.25
        sphere('Duck head',(0,-.87,.62),(.25,.23,.27),'gold',bigduck)
        sphere('Duck beak',(0,-1.1,.56),(.18,.12,.065),'coral',bigduck)
        for x in [-.115,.115]:
            sphere('Duck eye',(x,-1.065,.68),(.027,.023,.037),'ink',bigduck)
            sphere('Duck eye shine',(x-.006,-1.087,.691),(.008,)*3,'paper',bigduck)
        for n in range(3):extras.append(duck(prop,.38))
    elif kind=='fountain':
        pot=empty('Flower pot',(-.8,-.25,.29),prop)
        cylinder('Terracotta pot',(0,0,0),.27,.4,'coral',pot)
        torus('Pot lip',(0,0,.2),.27,.035,'red',pot)
        cylinder('Pot soil',(0,0,.205),.23,.02,'brown',pot)
        flower=empty('Surprise flower',parent=pot)
        curve('Flower stem',[(0,0,.2),(-.05,0,.7),(0,0,1.1)],.035,'green',flower)
        for sign in [-1,1]:
            leaf=sphere('Flower leaf',(sign*.12,0,.65),(.18,.055,.09),'green',flower);leaf.rotation_euler.y=-sign*.4
        bloom=empty('Flower head',(0,0,1.15),flower)
        petals=[]
        for n in range(9):
            a=n*math.tau/9;o=sphere('Sunflower petal',(math.sin(a)*.23,-.03,math.cos(a)*.23),(.1,.055,.2),'gold',bloom);o.rotation_euler.y=a;petals.append(o)
            flying=empty('Flying petal',parent=prop)
            sphere('Loose petal',(0,0,0),(.1,.055,.2),'gold',flying);extras.append(flying)
        sphere('Flower center',(0,-.08,0),(.18,.08,.18),'brown',bloom)
        pollen=[]
        for n in range(3):
            puff=empty('Pollen mote',parent=prop);sphere('Pollen',(0,0,0),(.025,)*3,'gold',puff);pollen.append(puff)
        can=empty('Watering can',(0,-.65,.5),prop)
        cylinder('Can body',(0,0,0),.18,.28,'teal',can)
        torus('Can handle',(.3,0,.06),.15,.025,'teal',can,(math.pi/2,0,0))
        curve('Can spout',[(-.15,0,0),(-.36,0,.16)],.04,'teal',can)
        water=curve('Water pour',[(-.3,-.6,.5),(-.55,-.4,.6),(-.8,-.25,.55)],.025,'blue',prop)
    elif kind=='beacon':
        disco=empty('Disco ball',(0,.6,2.6),prop)
        sphere('Disco ball',(0,0,0),(.28,)*3,'teal',disco)
        for lat in range(-2,3):
            for n in range(10):
                a=n*math.tau/10;r=math.sqrt(.28**2-(lat*.09)**2)
                o=box('Mirror tile',(r*math.cos(a),r*math.sin(a),lat*.09),(.065,.025,.065),'paper' if n%2 else 'blue',.005,disco);o.rotation_euler.z=a-math.pi/2
        medal=empty('Star prize',parent=prop)
        star(medal,(.32,0,.36),.28)
        curve('Bent star wand',[(0,0,.06),(.16,0,.16),(.32,0,.24)],.025,'gold',medal)
        cylinder('Star handle',(0,0,.025),.025,.19,'gold',medal)
        for n in range(8):extras.append(star(prop,(0,0,0),.09,['gold','teal','coral'][n%3]))
    elif kind=='trophy':
        cup=empty('Trophy cup',(-.7,.15,.09),prop)
        cylinder('Cup foot',(0,0,.06),.37,.12,'gold',cup)
        cylinder('Cup stem',(0,0,.34),.09,.45,'gold',cup)
        # An open, thick-walled cup, with an actual interior for the cat.
        profile=[(0,.43),(.56,.43),(.75,.66),(.79,1.03),(.73,1.03),(.69,.68),(.52,.5),(0,.5)]
        verts=[(r*math.cos(n*math.tau/64),r*math.sin(n*math.tau/64),z) for r,z in profile for n in range(64)]
        faces=[(j*64+n,j*64+(n+1)%64,(j+1)*64+(n+1)%64,(j+1)*64+n) for j in range(len(profile)-1) for n in range(64)]
        mesh=bpy.data.meshes.new('Hollow cup');mesh.from_pydata(verts,[],faces);mesh.update()
        o=bpy.data.objects.new('Golden cup',mesh);bpy.context.collection.objects.link(o);o.parent=cup;o.data.materials.append(scope['material']('gold',roughness=.26,metallic=.45))
        for p in mesh.polygons:p.use_smooth=True
        for x in [-.81,.81]:torus('Cup handle',(x,0,.84),.23,.06,'gold',cup,(math.pi/2,0,0))
        star(cup,(0,-.75,.8),.17,'paper')

    resting_shadows={
        'bridge':((.65,.05,.094),(.72,.77,.009)),
        'book':((-.85,-.3,.094),(.55,.42,.009)),
        'loom':((1,.08,.094),(.25,.23,.009)),
        'clock':((-1,0,.094),(.46,.28,.009)),
        'sorter':((-.55,.15,.094),(.66,.87,.009)),
        'boat':((-.45,.05,.094),(.75,.92,.009)),
        'fountain':((-.8,-.25,.094),(.28,.28,.009)),
        'trophy':((-.7,.15,.094),(.38,.38,.009)),
    }
    prop_shadow=None
    if kind in resting_shadows:
        location,scale=resting_shadows[kind]
        prop_shadow=sphere('Prop shadow',location,scale,'C8BEAC')

    def pose(t):
        ready=smooth(.04,.2,t);act=smooth(.24,.66,t);react=smooth(.76,.94,t)
        cat.pose('idle',t*.25)
        shadow.scale=(.63,.48,.012)
        if kind=='loom':
            cat.pose('sit',.5)
            cat.root.scale=(.85,)*3;cat.root.rotation_euler.z=0;cat.ground()
            tap=arc(.03,.23,t)
            start=cat.point('R.front.paw');cat.paw('R',start.lerp(Vector((.62,.02,.36)),tap))
            winding=smooth(.25,.75,t);angle=winding*5*math.tau
            for n,o in enumerate(coils):
                progress=max(0,min(1,winding*5-n))
                o.hide_render=progress==0;o.data.bevel_factor_end=max(.00001,progress)
            show(tail,t>.73)
            end=Vector((.57*math.cos(angle),.08+.79*math.sin(angle)+.2*max(0,math.sin(angle))**2,.18+winding*.62))
            orbit=1.0
            ball_size=1-.25*winding
            ball.location=(orbit*math.cos(angle),.08+1.36*math.sin(angle),.09+.3*ball_size)
            ball.rotation_euler.y=angle;show(ball,True,ball_size)
            prop_shadow.location=(ball.location.x,ball.location.y,.094)
            prop_shadow.scale=(.25*ball_size,.23*ball_size,.009)
            start=ball.location.copy()
            for point,value in zip(strand.data.splines[0].bezier_points,(start,start.lerp(end,.5),end)):point.co=value
            show(strand,t<.75)
            cat.turn_head(y=.28*math.sin(angle)*(1-react),z=.16*math.sin(angle)*(1-react)-.19*react,x=.12*arc(.22,.75,t))
        elif kind in ('sorter','trophy'):
            # Rise clear of the rim, travel across the opening, then descend.
            # The cat keeps the same size throughout; no shrinking to hide collisions.
            lift=smooth(.16,.36,t);travel=smooth(.34,.57,t);land=smooth(.59,.8,t)
            cat.pose('idle',.1,('hop',.5),smooth(.13,.32,t)*(1-land))
            if land>0:cat.pose('hop',.5,('sit',.5),land)
            scale=.82 if kind=='sorter' else .76
            cat.root.scale=(scale,)*3;cat.root.rotation_euler.z=0
            destination=-.55 if kind=='sorter' else -.7
            cat.root.location=(1.04+(destination-1.04)*travel,.02 if kind=='sorter' else .15,0)
            floor=.22 if kind=='sorter' else .60
            cat.ground(.09+1.12*lift-(1.21-floor)*land)
            if kind=='trophy':
                # Two attempts to stay awake, then the trophy becomes a bed.
                nod=.14*arc(.79,.87,t)+.23*arc(.87,.94,t)+.26*smooth(.94,1,t)
                cat.turn_head(x=nod,z=-.16*react)
            else:
                cat.turn_head(y=.3*arc(.81,.91,t),z=-.22*react)
                wave=smooth(.81,.9,t)
                start_paw=cat.point('L.front.paw')
                cat.paw('L',start_paw.lerp(Vector((-.92-.08*math.sin(t*math.tau*8)*wave,-.35,1.02)),wave))
            if kind=='sorter':
                for n,f in enumerate(flaps):f.rotation_euler.y=(-1 if n==0 else 1)*(.28+.2*math.sin(t*math.tau*8)*arc(.77,.94,t))
        elif kind=='clock':
            cat.pose('puzzleThink',.35,('idle',.1),react)
            cat.root.location.x=.61;cat.root.scale=(.88,)*3;cat.ground()
            shake=arc(.2,.56,t);alarm.rotation_euler.y=.09*math.sin(t*math.tau*13)*shake
            alarm.location.z=.63+.3*abs(math.sin(alarm.rotation_euler.y))
            hand.rotation_euler.y=act*math.tau*4
            cat.turn_head(y=-.22*(1-smooth(.77,.88,t)),z=.09*react)
            for n,b in enumerate(bells):
                u=smooth(.4,.79,t)
                offset=Vector((-.3 if n==0 else .3,0,.42))
                departure=.09*math.sin(.4*math.tau*13)*arc(.2,.56,.4)
                launch=Matrix.Translation(Vector((-1,0,.63+.3*abs(math.sin(departure))))) @ Euler((0,departure,0)).to_matrix().to_4x4()
                bpy.context.view_layer.update()
                start=(alarm.matrix_world if t<.4 else launch) @ offset
                end=cat.crown()+Vector((0,0,.121)) if n==0 else Vector((-1.4,.4,.211))
                b.matrix_world=Matrix.Translation(start.lerp(end,u)+Vector((0,0,.9*math.sin(math.pi*u)))) @ Euler((0,math.tau*u,0)).to_matrix().to_4x4()
        elif kind=='bridge':
            jump=smooth(.2,.65,t);travel=smooth(.25,.51,t)
            cat.pose('idle',.1,('hop',.5),arc(.18,.68,t))
            cat.root.scale=(.78,)*3;cat.root.location=(-.85+1.5*travel,.05,0)
            squash=arc(.65,.78,t)
            cushion.scale=(1+.07*squash,1+.07*squash,1-.35*squash)
            top=.09+.28*cushion.scale.z
            cat.ground(.09+(top-.09)*jump+.93*math.sin(jump*math.pi))
            cat.turn_head(x=-.15*arc(.79,.91,t),z=-.24*react)
            for n,f in enumerate(extras):
                u=smooth(.66,.97,t);a=n*math.tau/9
                show(f,t>.66)
                # Feathers leave the outside seam, not the middle of the cat.
                f.location=(.65+(.8+.25*u)*math.cos(a)-.2*u,.05+(.8+.1*u)*math.sin(a)+.1*u,.3-.18*u+.55*math.sin(math.pi*u))
                f.rotation_euler=(u*math.pi/2,(1-u)*(n+u*3),u*2+n)
        elif kind=='book':
            cat.pose('sit',.5);cat.root.scale=(.85,)*3;cat.root.location=(.62,.13,0);cat.root.rotation_euler.z=0;cat.ground()
            reach=smooth(.33,.68,t)
            for side,dx in [('L',-.18),('R',.18)]:
                start=cat.point(side+'.front.paw');target=Vector((.62+dx,-.7,.44))
                cat.paw(side,start.lerp(target,reach))
            cat.turn_head(x=.24*arc(.79,.88,t)-.12*arc(.89,.97,t),y=-.28*(1-smooth(.28,.77,t)),z=-.12*(1-react)+.12*react)
            lid.rotation_euler.y=-1.8*smooth(.14,.32,t)
            flight=smooth(.28,.77,t)
            # The fish approaches in FRONT of the face and settles onto both paws.
            catch=Vector((.62,-.84,.66))
            fish.location=Vector((-.85,-.6,.44)).lerp(catch,flight)+Vector((0,-.53*math.sin(math.pi*flight),.93*math.sin(math.pi*flight)))
            fish.rotation_euler.y=math.tau*flight
            tail.rotation_euler.y=math.pi/4+.32*math.sin(t*math.tau*9)*arc(.79,.98,t)
            show(fish,t>.28)
        elif kind=='balloon':
            cat.pose('puzzleHighPaw',.5)
            cat.root.scale=(.88,)*3;cat.root.location=(-.35,.1,0)
            lift=.56*smooth(.28,.75,t);cat.ground(.09+lift)
            cat.turn_head(x=-.23*act,z=.14*math.sin(t*math.tau*3)*act)
            # The free paw paddles for solid ground as the balloon takes over.
            paddle=arc(.42,.98,t)
            start_paw=cat.point('L.front.paw')
            cat.paw('L',start_paw+Vector((-.18*paddle,-.1*paddle,.16*paddle*(1+math.sin(t*math.tau*5)))))
            for side,phase in [('L',0),('R',math.pi)]:
                bone=cat.arm.pose.bones[side+'.hindlegjoint1']
                bone.rotation_quaternion=bone.rotation_quaternion @ Euler((.28*math.sin(t*math.tau*5+phase)*act,0,0)).to_quaternion()
            end=cat.surface_near(cat.point('R.front.paw')+Vector((.2,-.12,.05)))+Vector((.003,-.002,0))
            # A constant-length taut tether lifts with the hand. It cannot cut through the head.
            start=end+Vector((.8,.05,.6))
            balloon.location=start+Vector((0,0,.6))
            for p,v in zip(string.data.splines[0].bezier_points,(start,start.lerp(end,.5),end)):p.co=v
            shadow.scale=(.63*(1-lift*.5),.48*(1-lift*.5),.012)
        elif kind=='boat':
            lift=smooth(.3,.47,t);travel=smooth(.45,.66,t);land=smooth(.67,.84,t)
            cat.pose('idle',.1,('hop',.5),lift*(1-land))
            if land>0:cat.pose('hop',.5,('sit',.5),land)
            cat.root.scale=(.8,)*3;cat.root.rotation_euler.z=0
            cat.root.location=(.95-1.4*travel,.13,0);cat.ground(.09+.7*lift-.52*land)
            bigduck.location=(-.45,.05,.09)
            cat.turn_head(x=.18*arc(.85,.93,t),y=-.22*react,z=.15*react)
            for n,d in enumerate(extras):
                # One shared path keeps the crew spaced apart; only their steps stagger.
                parade=smooth(.48,.96,t)
                d.location=(1.1-n*.32-1.5*parade,-1.02,.103+.035*arc(.55+n*.04,.79+n*.04,t));show(d,True,.32)
                d.rotation_euler.z=-.45-.5*parade
        elif kind=='fountain':
            cat.pose('idle',.1);cat.root.scale=(.88,)*3;cat.root.location=(.62,.1,0);cat.root.rotation_euler.z=0;cat.ground()
            cat.paw('L',(.24,-.65,.62))
            paw=cat.point('L.front.paw')+Vector((0,-.04,.03))
            can.matrix_world=Matrix.Translation(paw) @ Euler((0,-.6*arc(.12,.44,t),0)).to_matrix().to_4x4() @ Matrix.Translation(Vector((-.3,0,-.06)))
            start=can.matrix_world @ Vector((-.36,0,.16));end=Vector((-.8,-.25,.5))
            for p,v in zip(water.data.splines[0].bezier_points,(start,start.lerp(end,.5)+Vector((0,0,-.04)),end)):p.co=v
            show(water,.16<t<.4)
            show(flower,True,.2+.95*smooth(.25,.6,t))
            flower.location.z=.205-.2*flower.scale.z
            flower.rotation_euler.y=.08*arc(.58,.78,t)
            bloom.rotation_euler.y=.08*math.sin(t*math.tau*3)*arc(.58,.9,t)
            cat.turn_head(x=-.12*arc(.61,.68,t)-.2*arc(.68,.75,t)+.35*arc(.75,.83,t),y=-.25*react,z=-.13*react)
            bpy.context.view_layer.update()
            nose=cat.surface_near(cat.point('head')+Vector((0,-.6,.05)))+Vector((0,-.04,0))
            for n,puff in enumerate(pollen):
                u=smooth(.58+n*.025,.72+n*.025,t)
                show(puff,0<u<1)
                puff.location=Vector((-.8,-.4,1.5875)).lerp(nose,u)+Vector((0,-.15*math.sin(math.pi*u),.15*math.sin(math.pi*u)))
            sneeze=smooth(.75,.97,t)
            for n,(petal,flying) in enumerate(zip(petals,extras)):
                petal.hide_render=t>.75;show(flying,t>.75)
                a=n*math.tau/9
                start=Vector((-.8+1.15*math.sin(a)*.23,-.25-.0345,.265+1.15*(1.15+math.cos(a)*.23)))
                end=Vector((-.85+.6*math.cos(a),-.65+.34*math.sin(a),.145))
                flying.location=start.lerp(end,sneeze)+Vector((-.18*math.sin(math.pi*sneeze),-.3*math.sin(math.pi*sneeze),.25*math.sin(math.pi*sneeze)))
                flying.rotation_euler=(sneeze*math.pi/2,(1-sneeze)*a,a+sneeze*3)
        elif kind=='beacon':
            cat.pose('idle',.1,('dance',act),ready*(1-react))
            if react>0:cat.pose('dance',act,('puzzleHighPaw',.5),react)
            cat.root.scale=(.88,)*3;cat.root.rotation_euler.z=.26*math.sin(act*math.tau*2)*(1-react);cat.ground()
            cat.turn_head(z=.18*math.sin(act*math.tau*2)*(1-react)-.18*react)
            # Keep the readable face toward the audience; planted dance poses do the acting.
            disco.rotation_euler.z=t*math.tau
            start=cat.point('R.front.paw');cat.paw('R',start.lerp(Vector((.6,-.55,.68)),smooth(.65,.8,t)))
            catch=cat.surface_near(cat.point('R.front.paw')+Vector((.18,-.1,.1)))+Vector((.025,0,.07))
            u=smooth(.7,.89,t);show(medal,t>.7)
            medal.location=catch+Vector((.35*(1-u),-.55*(1-u),.45*math.sin(math.pi*u)))
            for n,o in enumerate(extras):
                a=n*math.tau/8+act
                show(o,t>.25)
                o.location=(1.35*math.cos(a),-.1,1.18+1.05*math.sin(a));o.rotation_euler.y=t*2+n
        # Reactions follow each gag, instead of every cat sharing the same smile.
        cat.face('shock',arc(.38,.75,t))
        endings={'bridge':'wink','book':'proud','loom':'wink','clock':'deadpan','balloon':'shock','sorter':'wink','boat':'proud','fountain':'shock','beacon':'wink','trophy':'sleep'}
        cat.face(endings[kind],react)
        if kind=='book':cat.face('shock',arc(.81,.94,t))
        if kind=='fountain':cat.face('sleep',arc(.7,.84,t))
        if kind=='trophy':cat.face('shock',arc(.82,.93,t))
        shadow.location=(cat.root.location.x,cat.root.location.y+.1,.095)
        bpy.context.view_layer.update()
    # Expose the actor for offline contact diagnostics, not runtime game logic.
    scene['reward_kind']=kind
    pose.actor=cat
    return scene,pose

def make_stage(world):
    scene=studio();i=WORLDS.index(world);accent=['teal','coral','blue','gold','lilac','sage'][i%6]
    base=cylinder('Collectible plinth',(0,.2,.04),1.78,.09,'paper');base.scale.y=.85
    edge=torus('Colored ceramic rim',(0,.2,.01),1.72,.025,accent);edge.scale.y=.85
    # Flush ceramic inlays identify the world without becoming obstacles. Raised
    # background props cannot be composited safely behind moving actors.
    for side in [-1,1]:
        p=empty('World inlay',(side*1.4,.6,.086))
        cylinder('Glazed seal',(0,0,0),.13,.004,accent,p)
        symbol=star(p,(0,0,.003),.083,'paper')
        symbol.rotation_euler.x=math.pi/2;symbol.scale.y=.025
    return scene

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    if '--backgrounds' in ARGS:
        for world in WORLDS:
            scene=make_stage(world);scene.render.filepath=str(OUT/f'{world}-stage.png');bpy.ops.render.render(write_still=True)
    else:
        selected=KINDS
        if '--id' in ARGS:selected=list(dict.fromkeys(i.split('-')[-1] if '-' in i else i if i in KINDS else 'trophy' for i in ARGS[ARGS.index('--id')+1].split(',')))
        if '--refresh-cat' in ARGS or not CAT_SOURCE.exists():
            shutil.copyfile(ROOT/'assets/3d/native/cat-orange.glb',CAT_SOURCE)
        for kind in selected:
            start=time.monotonic();scene,pose=make_film(kind);folder=OUT/kind;folder.mkdir(exist_ok=True)
            frames=[0,12,25,36,47] if '--preview' in ARGS else range(COUNT)
            blocking=[]
            for n in frames:
                pose(n/(COUNT-1))
                skin=pose.actor.skin.evaluated_get(bpy.context.evaluated_depsgraph_get())
                coords=np.empty(len(skin.data.vertices)*3,dtype=np.float32)
                skin.data.vertices.foreach_get('co',coords)
                points=np.column_stack((coords.reshape(-1,3),np.ones(len(skin.data.vertices))))
                projection=scene.camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(),x=768,y=672) @ scene.camera.matrix_world.inverted() @ skin.matrix_world
                clip=points @ np.array(projection).T
                pixels=(clip[:,:2]/clip[:,3:4]+1)*np.array([384,336]);pixels[:,1]=672-pixels[:,1]
                blocking.append({'frame':n,'catBounds':[float(pixels[:,0].min()),float(pixels[:,1].min()),float(pixels[:,0].max()),float(pixels[:,1].max())]})
                if '--blocking-only' not in ARGS:
                    scene.render.filepath=str(folder/f'frame-{n:02}.png');bpy.ops.render.render(write_still=True)
            (folder/'blocking.json').write_text(json.dumps(blocking))
            print('REWARD_DONE',kind,round(time.monotonic()-start,2),flush=True)
    if '--backgrounds' not in ARGS:
        (OUT/'source.json').write_text(json.dumps({'catSha256':hashlib.sha256(CAT_SOURCE.read_bytes()).hexdigest(),'frames':COUNT,'cameraScale':4.3,'width':768,'height':672,'headScale':1.16}))
