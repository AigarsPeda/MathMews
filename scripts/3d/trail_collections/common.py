"""Editable geometry and materials shared by the approved 60 trail models."""
import math
import random
import importlib.util
import bisect
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('legacy',ROOT/'scripts/3d/build-trail-props.py')
legacy=importlib.util.module_from_spec(spec); spec.loader.exec_module(legacy)
PI=math.pi; TAU=math.tau
COLORS={'wood':'DFC39B','cream':'F1E7D0','sage':'ACBFA7','teal':'7FA9A5','lavender':'B9A1D0','pink':'DCAEB6','coral':'DC9C86','gold':'C6A365','navy':'405461','slate':'7D94A5','plum':'967790','ink':'33434C','white':'F8F3E5','brown':'AC815C','orange':'DDB07F'}

def mat(name,kind='paint'):
    key=f'{name}:{kind}'
    old=bpy.data.materials.get(key)
    if old:return old
    color=COLORS.get(name,name)
    m=legacy.material(key,color,.80 if kind=='paint' else .94,wood=kind=='wood',fabric=kind in ['felt','cloth'])
    b=m.node_tree.nodes.get('Principled BSDF')
    if kind=='metal': b.inputs['Metallic'].default_value=.55; b.inputs['Roughness'].default_value=.38
    if kind=='glass':
        b.inputs['Transmission Weight'].default_value=.86; b.inputs['Roughness'].default_value=.13
        b.inputs['IOR'].default_value=1.45; b.inputs['Specular IOR Level'].default_value=.4
        # A restrained transparent blend keeps miniature glass readable on alpha.
        nodes=m.node_tree.nodes;links=m.node_tree.links
        clear=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=.20
        links.new(clear.outputs[0],mix.inputs[1]);links.new(b.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
    if kind=='cloth':
        n=m.node_tree.nodes; links=m.node_tree.links
        a=n.new('ShaderNodeTexWave'); a.wave_type='BANDS'; a.bands_direction='X'; a.inputs['Scale'].default_value=95
        c=n.new('ShaderNodeTexWave'); c.wave_type='BANDS'; c.bands_direction='Y'; c.inputs['Scale'].default_value=95
        mix=n.new('ShaderNodeMath'); mix.operation='MULTIPLY'; links.new(a.outputs['Fac'],mix.inputs[0]); links.new(c.outputs['Fac'],mix.inputs[1])
        bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.25; bump.inputs['Distance'].default_value=.012
        links.new(mix.outputs[0],bump.inputs['Height']); links.new(bump.outputs[0],b.inputs['Normal'])
    return m

def assign(obj,name,material):
    obj.name=name; obj.data.materials.append(material); return obj

def smooth(obj):
    for face in obj.data.polygons:face.use_smooth=True
    return obj

def box(name,loc,size,material,bevel=.06,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Soft crafted edges','BEVEL'); b.width=min(bevel,min(size)*.46); b.segments=5
        o.modifiers.new('Face normals','WEIGHTED_NORMAL')
    o.rotation_euler=rot
    return assign(o,name,material)

def ball(name,loc,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=36,ring_count=24,location=loc)
    o=bpy.context.object; o.scale=scale; return smooth(assign(o,name,material))

def cyl(name,loc,radius,depth,material,axis=(0,0,1),vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object; o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    b=o.modifiers.new('Rounded rim','BEVEL'); b.width=min(.025,depth*.15); b.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); return assign(o,name,material)

def rod(name,a,b,radius,material):
    a,b=Vector(a),Vector(b); return cyl(name,(a+b)/2,radius,(b-a).length,material,b-a)

def line(name,points,radius,material):return legacy.curve(name,points,radius,material)

def ring(name,loc,major,minor,material,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=64,minor_segments=12,location=loc,rotation=rot)
    return smooth(assign(bpy.context.object,name,material))

def poly(name,xy,z,depth,material,bevel=.025):
    n=len(xy); v=[(x,y,zz) for zz in [z,z+depth] for x,y in xy]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    if bevel:
        b=o.modifiers.new('Hand rounded edges','BEVEL');b.width=bevel;b.segments=3
    o.modifiers.new('Normals','WEIGHTED_NORMAL');return o

def text(name,body,loc,size,material,front=False):
    d=bpy.data.curves.new(name,'FONT');d.body=body;d.align_x='CENTER';d.align_y='CENTER';d.size=size;d.extrude=.001
    d.font=bpy.data.fonts.load(str(ROOT/'assets/fonts/nunito/Nunito-900.ttf'))
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc
    if front:o.rotation_euler.x=PI/2
    d.materials.append(material);return o

def group(name,objects,loc=(0,0,0),rot=(0,0,0),scale=1):
    root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root)
    for o in objects:o.parent=root
    root.location=loc;root.rotation_euler=rot;root.scale=(scale,)*3;return root

def capture(fn,*args,**kwargs):
    before=set(bpy.context.scene.objects);fn(*args,**kwargs);return list(set(bpy.context.scene.objects)-before)

def lathe(name,profile,material,loc=(0,0,0),segments=64):
    v=[(r*math.cos(TAU*j/segments)+loc[0],r*math.sin(TAU*j/segments)+loc[1],z+loc[2]) for r,z in profile for j in range(segments)]
    f=[]
    for k in range(len(profile)-1):
        for j in range(segments):a=k*segments+j;b=k*segments+(j+1)%segments;f.append((a,b,b+segments,a+segments))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    return smooth(assign(o,name,material))

def gridpaper(loc=(0,0,.025),size=(1.4,1.5),angle=0):
    objects=[box('Cream graph paper',loc,(*size,.035),mat('cream'),.025)]
    for axis in [0,1]:
        extent=size[axis];other=size[1-axis]
        for i in range(1,int(extent/.12)):
            p=-extent/2+i*.12;a=[-other/2,-other/2,loc[2]+.020];b=[other/2,other/2,loc[2]+.020]
            a[axis]=b[axis]=p;a[1-axis]=-other/2;b[1-axis]=other/2
            objects.append(line('Fine paper grid',[a,b],.0016,mat('sage')))
    return group('Graph paper',objects,rot=(0,0,angle))

def ticks(center,radius,count,material,front=False,z=0):
    for i in range(count):
        a=TAU*i/count; inner=radius-(.065 if i%5==0 else .028)
        if front:p=[(center[0]+r*math.sin(a),center[1],center[2]+r*math.cos(a)) for r in [inner,radius]]
        else:p=[(center[0]+r*math.sin(a),center[1]+r*math.cos(a),z) for r in [inner,radius]]
        line('Engraved dial mark',p,.006,material)

def leaf(name,loc,scale,material,angle=0):
    o=ball(name,loc,(scale*.55,scale,.035),material);o.rotation_euler.z=angle
    line('Leaf vein',[(loc[0]-.6*scale*math.sin(angle),loc[1]-.6*scale*math.cos(angle),loc[2]+.035),(loc[0]+.6*scale*math.sin(angle),loc[1]+.6*scale*math.cos(angle),loc[2]+.035)],.008,mat('cream'))
    return o

def stitches(points,material= None):
    material=material or mat('cream','cloth')
    for i in range(0,len(points)-1,2):line('Cotton stitch',[points[i],points[i+1]],.008,material)

def finish_handmade_surfaces():
    """Visible woven normals and real loose wool fibres, also on legacy geometry."""
    fabrics=[]
    for material in list(bpy.data.materials):
        if not material.use_nodes:continue
        nodes=material.node_tree.nodes;links=material.node_tree.links
        bsdf=nodes.get('Principled BSDF')
        if not bsdf:continue
        if bsdf.inputs['Sheen Weight'].default_value < .2:continue
        fabrics.append(material)
        base=material.diffuse_color[:3]
        tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=52;tex.inputs['Detail'].default_value=4;tex.inputs['Roughness'].default_value=.75
        is_cloth='cloth' in material.name
        ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*[v*(.84 if is_cloth else .76) for v in base],1);ramp.color_ramp.elements[1].color=(*[min(1,v*1.10) for v in base],1)
        links.new(tex.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],bsdf.inputs['Base Color'])
        height=tex.outputs['Fac']
        if 'cloth' in material.name:
            waves=[]
            for axis in ['X','Y','Z']:
                wave=nodes.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction=axis;wave.inputs['Scale'].default_value=18;wave.inputs['Distortion'].default_value=.65;waves.append(wave)
            mix=nodes.new('ShaderNodeMath');mix.operation='MULTIPLY';links.new(waves[0].outputs['Fac'],mix.inputs[0]);links.new(waves[1].outputs['Fac'],mix.inputs[1])
            add=nodes.new('ShaderNodeMath');add.operation='ADD';links.new(mix.outputs[0],add.inputs[0]);links.new(waves[2].outputs['Fac'],add.inputs[1]);height=add.outputs[0]
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.32;bump.inputs['Distance'].default_value=.006 if is_cloth else .012
        links.new(height,bump.inputs['Height']);links.new(bump.outputs[0],bsdf.inputs['Normal'])
        bsdf.inputs['Roughness'].default_value=.96
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();rng=random.Random(421)
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH' or not any(m in fabrics for m in obj.data.materials):continue
        # The yarn already has thousands of modelled plies; do not duplicate them.
        if any(token in obj.name.lower() for token in ['winding','wool core','wrap']):continue
        material=next(m for m in obj.data.materials if m in fabrics)
        evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
        matrix=obj.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
        vertices=[matrix@v.co for v in mesh.vertices];normals=[(normal_matrix@v.normal).normalized() for v in mesh.vertices]
        triangles=[];areas=[];area=0
        for triangle in mesh.loop_triangles:
            ids=triangle.vertices;a,b,c=[vertices[i] for i in ids];size=(b-a).cross(c-a).length/2
            if size<1e-9:continue
            area+=size;areas.append(area);triangles.append(tuple(ids))
        if area < .015:evaluated.to_mesh_clear();continue
        is_cloth='cloth' in material.name
        count=min(2400,int(area*(450 if is_cloth else 2400)));data=bpy.data.curves.new('Loose curled wool fibres','CURVE');data.dimensions='3D';data.bevel_depth=.0007 if is_cloth else .0010;data.bevel_resolution=0
        data.materials.append(material)
        for _ in range(count):
            ids=triangles[bisect.bisect_left(areas,rng.random()*area)];u=math.sqrt(rng.random());v=rng.random();weights=[1-u,u*(1-v),u*v]
            point=sum((vertices[i]*w for i,w in zip(ids,weights)),Vector());normal=sum((normals[i]*w for i,w in zip(ids,weights)),Vector()).normalized()
            tangent=normal.cross(Vector((0,0,1)))
            if tangent.length<.01:tangent=normal.cross(Vector((1,0,0)))
            tangent.normalize();other=normal.cross(tangent);angle=rng.random()*TAU;length=rng.uniform(.002,.006) if is_cloth else rng.uniform(.007,.019)
            spline=data.splines.new('POLY');spline.points.add(6)
            for k in range(7):
                t=k/6;theta=angle+t*TAU*.65
                p=point+length*(tangent*(math.cos(theta)-math.cos(angle))+other*(math.sin(theta)-math.sin(angle)))+normal*(.002+.004*math.sin(t*PI))
                spline.points[k].co=(*p,1)
        fibre=bpy.data.objects.new('Surface wool fibres '+obj.name,data);bpy.context.collection.objects.link(fibre);evaluated.to_mesh_clear()

def normalize_and_studio(out,quality=48):
    finish_handmade_surfaces()
    scene=bpy.context.scene
    for obj in scene.objects:
        if obj.type=='CURVE':obj.data.use_fill_caps=True
    bpy.context.view_layer.update()
    objects=[o for o in scene.objects if o.type in ['MESH','CURVE','FONT']]
    coords=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    lo=Vector([min(v[i] for v in coords) for i in range(3)]);hi=Vector([max(v[i] for v in coords) for i in range(3)])
    scale=2.05/max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z)
    roots=[o for o in scene.objects if not o.parent]
    root=group('Asset placement',roots)
    root.scale=(scale,)*3;root.location=(-(lo.x+hi.x)*scale/2,-(lo.y+hi.y)*scale/2,-lo.z*scale+.035)
    height=(hi.z-lo.z)*scale;target=(0,0,height*.42)
    scene.render.engine='CYCLES';scene.cycles.samples=quality;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=3
    scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    scene.world=bpy.data.worlds.new('Soft warm studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.83,.87,.84,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
    bpy.ops.object.camera_add(location=(3,-6.5,5.2));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=3.05;legacy.aim(cam,target);scene.camera=cam
    bpy.context.view_layer.update()
    camera_inverse=cam.matrix_world.inverted()
    projected=[camera_inverse@o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    cam.data.ortho_scale=max(3.05,2.22*max(max(abs(v.x),abs(v.y)) for v in projected))
    for loc,power,size in [((-3,-4,7),330,4),((4,-1,5),210,3),((1,4,6),150,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;legacy.aim(o,target)
    legacy.contact_shadow('Broad transparent shadow',(1.18,.90),.62,-.018,(-.23,-.16))
    legacy.contact_shadow('Dark contact shadow',(.73,.52),.58,-.014,(-.02,-.05))
    scene.render.filepath=str(out)
