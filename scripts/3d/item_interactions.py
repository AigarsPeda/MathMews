"""Give store models real moving parts, shared with the runtime capability catalog."""
import json, math
from pathlib import Path
import bpy
from mathutils import Vector

PROFILES = json.loads((Path(__file__).resolve().parents[2] / 'data/item-interactions.json').read_text())

def rig_item_interactions(id, h):
    profile = PROFILES.get(id, {})
    before = set(bpy.context.scene.objects)
    objects = [o for o in before if o.type in ('MESH', 'CURVE', 'EMPTY')]
    parts = []
    box, empty = h['box'], h['empty']

    def drop(obj):
        if obj in objects: objects.remove(obj)
        bpy.data.objects.remove(obj, do_unlink=True)

    def named(*prefixes):
        return [o for o in objects if any(o.name == p or o.name.startswith(p + '.') for p in prefixes)]

    def bounds(items):
        bpy.context.view_layer.update()
        points = [o.matrix_world @ Vector(c) for o in items for c in o.bound_box if o.type in ('MESH', 'CURVE')]
        return ([min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)])

    def attach(items, pivot, angle=0, axis=(0, 0, 1), offset=(0, 0, 0), mode='open'):
        if not items: return
        group = empty('Interaction part ' + str(len(parts)), pivot)
        bpy.context.view_layer.update()
        for obj in items:
            matrix = obj.matrix_world.copy()
            obj.parent = group
            obj.matrix_world = matrix
        # Coordinates exported by glTF are Y-up, with the front at +Z.
        yup = lambda v: [v[0], v[2], -v[1]]
        parts.append({'node': group.name, 'pivot': yup(pivot), 'axis': yup(axis),
                      'angle': angle, 'offset': yup(offset), 'mode': mode})
        return group

    def hollow(obj):
        lo, hi = bounds([obj]); thickness = .045
        color = obj.data.materials[0] if obj.data.materials else 'wood'
        x, y, z = [(a+b)/2 for a,b in zip(lo,hi)]
        w, d, height = [b-a for a,b in zip(lo,hi)]
        for side in (-1, 1):
            box('Storage inner side', (x+side*(w-thickness)/2, y, z), (thickness, d, height), color, .008)
        box('Storage inner back', (x, hi[1]-thickness/2, z), (w, thickness, height), color, .008)
        for zz in (lo[2]+thickness/2, hi[2]-thickness/2):
            box('Storage inner floor', (x,y,zz), (w,d,thickness), color, .008)
        # A shelf and folded towels make the opening readable.
        box('Storage interior shelf', (x,y,z), (w-.09,d-.08,.035), color, .008)
        box('Stored folded linen', (x,y,z+.08), (w*.48,d*.58,.10), 'cream', .025)
        drop(obj)

    opening = profile.get('open')
    if opening in ('doors', 'drawers', 'oven', 'microwave', 'lid'):
        for obj in named('Cabinet carcass','Cabinet','Modern cabinet carcass','Modern base cabinet',
                         'Modern island cabinetry','Sage island cabinetry','Vanity cabinet','Microwave casing',
                         'Linen chest','Storage box','First aid kit'):
            hollow(obj)
        for obj in named('Cabinet door shadow','Sink door shadow backing','Drawer shadow backing',
                         'Island drawer shadow backing'):
            drop(obj)
        objects = [o for o in objects if o.name in bpy.data.objects]

    if opening == 'doors':
        # Glass cabinets use rails instead of solid leaves. Split their long rails.
        if id == 'kitchenWallCabinetGlass':
            for obj in named('Glass door rail'):
                for side in (-1,1):
                    box('Glass leaf rail', (side*.43,obj.location.y,obj.location.z), (.84,.06,.055),'wood',.012)
                drop(obj)
            objects = [o for o in objects if o.name in bpy.data.objects] + [o for o in bpy.context.scene.objects if o.name.startswith('Glass leaf rail')]
        leaves = named('Cabinet door','Handleless sink cabinet door','Flat handleless cabinet door','Wall cabinet door','Island cupboard door')
        trims = named('Brass handle','Wardrobe door handle','Inset oak panel','Door handle','Cabinet handle',
                      'Oak door panel border','Inset oak door panel','Glass door mullion','Glass door reflection','Glass leaf rail')
        if id == 'kitchenIsland': trims=[o for o in trims if o.location.z < .8]
        if id == 'kitchenWallCabinetGlass': leaves = [o for o in trims if o.location.x != 0]
        for side in (-1,1):
            group = [o for o in leaves+trims if (o.matrix_world.translation.x < 0) == (side < 0)]
            group = list(set(group))
            if not group: continue
            lo, hi = bounds(group)
            attach(group, (lo[0] if side<0 else hi[0], (lo[1]+hi[1])/2, lo[2]), side*math.radians(95))
        # The island also has two independent shallow drawers above its doors.
        if id == 'kitchenIsland':
            for obj in named('Island drawer'):
                group = [obj]+[o for o in trims if abs(o.location.z-.91)<.03 and abs(o.location.x-obj.location.x)<.03 and o.parent is None]
                attach(group, tuple(obj.location), offset=(0,-.38,0))

    if opening in ('drawers','drawer'):
        faces = named('Drawer face','Handleless kitchen drawer','Handleless island drawer','Vanity drawer','Drawer front')
        handles = named('Brass handle','Drawer knob','Pull','Recessed drawer pull','Recessed island drawer pull')
        surfaces = []
        for obj in faces:
            if opening == 'drawer' and profile.get('initiallyOpen'):
                for part in named('Drawer','Drawer front','Pull'):part.location.y += .30
                bpy.context.view_layer.update()
            lo, hi = bounds([obj]); x=(lo[0]+hi[0])/2; y=(lo[1]+hi[1])/2; z=(lo[2]+hi[2])/2
            width=hi[0]-lo[0]; height=hi[2]-lo[2]; depth=.50 if width<1 else .62
            group = [obj] + [o for o in handles if abs(o.location.x-x)<width*.45 and abs(o.location.z-z)<height*.55]
            if opening=='drawer':
                for solid in named('Drawer'):drop(solid)
            floor = box('Drawer tray floor',(x,y+depth/2,lo[2]+.018),(width-.05,depth,.035),'wood',.008)
            group.append(floor)
            for side in (-1,1):
                group.append(box('Drawer tray side',(x+side*(width-.09)/2,y+depth/2,z),(.035,depth,height*.82),'wood',.008))
            group.append(box('Drawer tray back',(x,y+depth-.02,z),(width-.05,.035,height*.82),'wood',.008))
            distance=depth*.90
            attach(group,(x,y,z),offset=(0,-distance,0))
            surfaces.append([x,lo[2]+.06,-(y+depth/2-distance)])
        if surfaces:
            # The top tray has clear space above the cat's head.
            profile_surface=max(surfaces,key=lambda p:p[1])
        else: profile_surface=None
    else: profile_surface=None

    if opening == 'panel':
        hinge=next(iter(named('Cabinet hinge')),None)
        if hinge:hinge.rotation_euler.z=0
        attach(named('Cabinet panel','Pull'),(-.38,0,0),math.radians(95))
    elif opening == 'oven':
        group=named('Oven front','Oven window','Oven black glass face','Oven window reflection','Slim oven handle','Oven handle mount')
        group += [o for o in named('Brass handle') if o.location.z>.7]
        # Legacy range cabinet leaves sit behind the oven front, not beside it.
        if id=='kitchenRange':
            for obj in named('Cabinet door'):drop(obj)
            for obj in named('Brass handle'):
                if obj.location.z<.7:drop(obj)
        if group:
            lo,hi=bounds(group);attach(group,(0,lo[1],lo[2]),math.radians(85),(1,0,0))
    elif opening == 'microwave':
        group=named('Microwave glass','Glass reflection')
        if group:
            lo,hi=bounds(group);attach(group,(lo[0],lo[1],lo[2]),-math.radians(95))
    elif opening == 'lid':
        group=named('Chest lid','Folded quilt','Box lid','Medical cross v','Medical cross h')
        if id=='officeMedicalKitAni':group.append(box('Medical kit front',(0,-.18,.40),(1.0,.025,.73),'cream',.025))
        if group:
            lo,hi=bounds(group);attach(group,(0,hi[1],lo[2]),-math.radians(95),(1,0,0))
    elif opening == 'window':
        group=named('Window muntin','Window crossbar','Window center mullion','Window sash','Brass window latch',
                    'Arched center mullion','Arched transom bar','Brass inner ring','Sliding panel','Shoji lattice','Blind slat')
        # Keep the outside sky fixed in the wall opening. Move a real sash in front.
        panes=named('Window glass','Sky blue glass','Arched glass lower pane','Round sky glass')
        if panes:
            lo,hi=bounds(panes);w=hi[0]-lo[0];height=hi[2]-lo[2];y=lo[1]-.04
            for x in (lo[0],hi[0]):group.append(box('Opening sash upright',(x,y,(lo[2]+hi[2])/2),(.04,.045,height),'cream',.008))
            for z in (lo[2],hi[2]):group.append(box('Opening sash rail',((lo[0]+hi[0])/2,y,z),(w,.045,.04),'cream',.008))
            # Outer frame crossbars should remain stationary on authored modern windows.
            if id in ('windowWhiteClassic','windowOakWide'):group=[o for o in group if not o.name.startswith('Window crossbar')]
            attach(group,(lo[0],y,lo[2]),-math.radians(65))
    elif opening == 'door':
        if id.startswith('japanese'):
            hinge=next(iter(named('Door hinge')),None)
            if hinge:hinge.rotation_euler.z=0
            group=named('Door leaf','Door lattice','Door handle')
        else:group=named('Door slab','Door glass frame','Door glass bar','Lower door panel','Barn door plank','Barn horizontal brace','Diagonal barn brace','Recessed oak panel','Panel inset','Door handle plate','Door lever','Sky blue glass','Window light reflection','Roller strap','Door roller')
        if group:
            lo,hi=bounds(group);sliding='Sliding' in id or 'sliding' in id
            attach(group,(lo[0],(lo[1]+hi[1])/2,lo[2]),0 if sliding else -math.radians(95),offset=(hi[0]-lo[0],0,0) if sliding else (0,0,0))
    elif opening == 'screen':
        # Rolling a projection screen is a vertical translation into its housing.
        attach(named('Projection screen'),(0,0,1.5),offset=(0,0,1.05))
    elif opening == 'laptop':
        group=named('Laptop lid','Monitor','Screen','Screen content')
        if id=='computerMacbookClosed':
            # All laptop variants share the same usable screen behind their lid.
            for obj in group:drop(obj)
            group=[box('Monitor',(0,.34,.58),(1.5,.11,.88),'dark',.06),box('Screen',(0,.279,.58),(1.37,.016,.76),'blue',.02)]
        # Authored upright is open; reset to closed around the rear edge.
        pivot=(0,.34,.14)
        group_node=attach(group,pivot,math.radians(90),(1,0,0))
        if group_node:
            # Bake the shut pose into the children so runtime starts from identity.
            from mathutils import Matrix
            for obj in group:obj.matrix_local=Matrix.Rotation(-math.pi/2,4,'X') @ obj.matrix_local

    power=profile.get('power')
    if power:
        glow=named('Screen','Screen content','TV screen','TV sun','TV landscape','Game screen','Power indicator','Blue power line',
                   'Cooling fan','Display','Projector lens','Control panel','Digital clock','Oven clock display','Etched induction zone',
                   'Induction touch control','Burner ring','Flame','Fire flame','Carved triangle eye','Pumpkin smile')
        if power=='fire':glow += [o for o in objects if o.name.startswith(('Flame','Dancing flame','Fire flame','Cauldron bubble'))]
        for obj in set(glow):
            if obj.type!='MESH':continue
            for slot in obj.material_slots:
                if not slot.material:continue
                mat=slot.material.copy();mat.name='Interaction glow '+obj.name
                mat.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=1
                slot.material=mat
        if power=='water':
            outlets=[]
            if id.startswith('kitchenModernSink'):outlets=[(-.25,.10,1.55,.99)]
            elif id in ('bathroomDoubleVanity','kitchenSinkCabinet'):outlets=[(x,.02,1.28,1.055) for x in ((-.49,.49) if id=='bathroomDoubleVanity' else (0,))]
            elif id=='officeWaterDispenserAni':outlets=[(-.14,-.42,1.10,.87)]
            else:outlets=[(0,-.30,.45,.12)]
            for x,y,top,bottom in outlets:
                stream=h['cylinder']('Interaction water',(x,y,(top+bottom)/2),.017,top-bottom,'blue')
                attach([stream],(x,y,bottom),mode='water')
        if power=='mixer':
            if id=='kitchenMixerStand':attach(named('Whisk spindle','Whisk wire'),(-.20,-.025,.49),axis=(0,0,1),mode='spin')
            else:
                attach(named('Beater shaft','Beater loop'),(0,-.015,.23),axis=(0,0,1),mode='spin')
        # Small status LEDs make power visible on devices without a display.
        if power in ('machine','mixer','console','fan','heat'):
            meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith('Interaction')]
            lo,hi=bounds(meshes)
            led=box('Interaction power LED',(lo[0]+(hi[0]-lo[0])*.18,lo[1]-.009,lo[2]+(hi[2]-lo[2])*.70),(.035,.015,.035),'teal',.006)
            mat=led.data.materials[0].copy();mat.name='Interaction glow status'
            mat.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=1
            led.data.materials[0]=mat
    return parts, profile_surface, list(set(bpy.context.scene.objects)-before)
