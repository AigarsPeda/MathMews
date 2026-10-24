"""Evaluate reward mesh contact offline, at every encoded pose and midpoint.

Signed closest-surface tests in both directions detect skin inside props and
props inside skin. This is a penetration regression check, not a rigid-body
simulation, self-collision test, or proof that a gag reads well in motion.
"""
import runpy, json, sys, time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
r=runpy.run_path(str(ROOT/'scripts/3d/render-achievement-comedy.py'),run_name='contact_check')
OUT=r['OUT'];KINDS=r['KINDS'];COUNT=95
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if '--id' in args:KINDS=args[args.index('--id')+1].split(',')
# About two pixels at output size. Surface contact is allowed; visible crossings are not.
TOLERANCE=.018

def geometry(obj,dg):
    evaluated=obj.evaluated_get(dg)
    mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
    verts=[evaluated.matrix_world @ v.co for v in mesh.vertices]
    faces=[t.vertices[:] for t in mesh.loop_triangles]
    tree=BVHTree.FromPolygons(verts,faces,all_triangles=True)
    evaluated.to_mesh_clear()
    return np.array(verts),tree

def inside(point,tree):
    # Nearest normals alone misclassify the hole of a curved tube near its cap.
    # Confirm membership with ray parity before reporting penetration.
    direction=Vector((.937,.271,.219)).normalized();origin=point.copy();crossings=0
    for _ in range(64):
        hit=tree.ray_cast(origin,direction)[0]
        if hit is None:return crossings%2==1
        crossings+=1;origin=hit+direction*.00001
    raise RuntimeError('Unresolved mesh parity')

def depth(points,tree,bounds):
    candidates=points[np.all((points>=bounds[0])&(points<=bounds[1]),axis=1)]
    maximum=0
    for p in candidates:
        point=Vector(p);hit,normal,_,distance=tree.find_nearest(point)
        if hit is not None and distance>TOLERANCE and (point-hit).dot(normal)<0 and inside(point,tree):
            maximum=max(maximum,distance)
    return maximum

# Positive and negative controls prevent an accidentally disabled contact check.
scene=r['studio']()
fixture=r['box']('Contact control',(0,0,0),(1,1,1),'teal',0)
bpy.context.view_layer.update()
points,control=geometry(fixture,bpy.context.evaluated_depsgraph_get())
assert depth(np.array([[.1,.1,.1]]),control,(points.min(axis=0),points.max(axis=0)))>.3
assert depth(np.array([[2,0,0]]),control,(points.min(axis=0),points.max(axis=0)))==0
ring=r['torus']('Hollow control',(0,0,0),1,.1,'teal')
bpy.context.view_layer.update()
points,control=geometry(ring,bpy.context.evaluated_depsgraph_get())
assert not inside(Vector((0,0,0)),control), 'A hollow opening is not a solid obstacle'
assert inside(Vector((1,0,0)),control)
results=[]
for kind in KINDS:
    scene,pose=r['make_film'](kind);cat=pose.actor
    cat_objects={cat.arm,*cat.arm.children_recursive}
    candidates=[o for o in scene.objects if o.type in ('MESH','CURVE') and o not in cat_objects and o.name not in ('Soft toy shadow','Prop shadow') and not all(c.hide_render for c in o.users_collection)]
    violations={};start=time.monotonic();scale=None;constraints=[]
    for n in range(COUNT):
        t=n/(COUNT-1);pose(t);dg=bpy.context.evaluated_depsgraph_get()
        vertices,tree=geometry(cat.skin,dg);bounds=(vertices.min(axis=0),vertices.max(axis=0))
        if scale is None:scale=cat.root.scale.copy()
        assert (cat.root.scale-scale).length<.00001, f'{kind}: cat changes size'
        assert vertices[:,2].min()>=.085, f'{kind}: cat penetrates stage'
        if n==COUNT-1:
            resting={'bridge':'Velvet cushion','book':'Book cover','loom':'Yarn core','clock':'Clock foot','sorter':'Box bottom','boat':'Duck float ring','fountain':'Terracotta pot','trophy':'Cup foot'}
            if kind in resting:
                surface,_=geometry(scene.objects[resting[kind]],dg)
                gap=float(surface[:,2].min()-.085)
                assert -.003<=gap<=.018, f'{kind}: resting prop is not on the stage: {gap}'
                constraints.append({'contact':resting[kind]+' rests on stage','gap':round(gap,5)})
        if n==COUNT-1 and kind in ('book','fountain','beacon'):
            prop_name,sides={'book':('Fish body',('L','R')),'fountain':('Can handle',('L',)),'beacon':('Star handle',('R',))}[kind]
            _,held_prop=geometry(scene.objects[prop_name],dg)
            for side in sides:
                group=cat.skin.vertex_groups[side+'.front.paw']
                indices=[v.index for v in cat.skin.data.vertices if any(g.group==group.index and g.weight>.5 for g in v.groups)]
                gap=min(held_prop.find_nearest(Vector(vertices[i]))[3] for i in indices)
                assert gap<.018, f'{prop_name} is detached from {side} paw: {gap}'
                constraints.append({'contact':side+' paw touches '+prop_name,'gap':round(gap,5)})
        for obj in candidates:
            if obj.hide_render or min(obj.matrix_world.to_scale())<.001:continue
            pts,prop_tree=geometry(obj,dg)
            if len(pts)==0:continue
            low,high=pts.min(axis=0),pts.max(axis=0)
            if np.any(high<bounds[0]) or np.any(low>bounds[1]):continue
            penetration=max(depth(vertices,prop_tree,(low,high)),depth(pts,tree,bounds))
            if penetration>TOLERANCE:
                previous=violations.get(obj.name,{'maxDepth':0,'samples':[]})
                previous['maxDepth']=round(max(previous['maxDepth'],penetration),4)
                previous['samples'].append(n);violations[obj.name]=previous
    result={'kind':kind,'samples':COUNT,'violations':violations,'contacts':constraints,'constantScale':True,'aboveStage':True,'passed':not violations}
    results.append(result);print('CONTACT',kind,json.dumps(violations),round(time.monotonic()-start,1),flush=True)
report={'samplesPerFilm':COUNT,'toleranceWorldUnits':TOLERANCE,'method':'Bidirectional signed mesh penetration with ray-parity confirmation; evaluated skin and visible props','controlsPassed':True,'films':results,'passed':all(x['passed'] for x in results)}
(OUT/'contact-check.json').write_text(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
