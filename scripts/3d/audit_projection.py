"""Open every editable scene and verify room-aligned camera axes and item variants."""
import bpy, json, math, os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
LIBRARY=Path(os.environ.get('BRAINPET_BLENDER_ASSET_DIR',str(ROOT.parent/'BrainPet-blender-assest')))
DIRECTION=Vector((8,-8,6.1)).normalized()
GROUPS=[['chairOfficeA','chairOfficeB'],['chairClassicA','chairClassicB','chairClassicC','chairClassicD'],['chairGamingA','chairGamingB','chairGamingC','chairGamingD'],['deskWoodA','deskWoodB'],['sofaA','sofaB'],['computerNewImacA','computerNewImacB'],['computerOldImacA','computerOldImacB'],['computerOldPcA','computerOldPcB'],['computerRotationScreenA','computerRotationScreenB','computerRotationScreenC']]
ROTATIONS={id:i*90 for group in GROUPS for i,id in enumerate(group)}
entries=json.loads((ROOT/'scripts/3d/inventory.json').read_text())['entries']
results=[]
for entry in entries:
    id=entry['id'];kind=entry['kind']
    bpy.ops.wm.open_mainfile(filepath=str(LIBRARY/('rooms' if kind=='room' else 'items')/(id+'.blend')))
    scene=bpy.context.scene;scene.frame_set(1);camera=scene.camera
    direction=(camera.matrix_world.to_quaternion()@Vector((0,0,1))).normalized()
    assert direction.dot(DIRECTION)>1-1e-6, f'{id}: camera does not match room'
    inv=camera.matrix_world.inverted().to_3x3()
    x,y=inv@Vector((1,0,0)),inv@Vector((0,1,0))
    assert abs(abs(x.x)-abs(y.x))<1e-5, f'{id}: unequal isometric axes'
    assert abs(abs(x.y/x.x)-abs(y.y/y.x))<1e-5, f'{id}: floor edge slopes differ'
    degrees=0
    if kind!='room':
        root=scene.objects[id+' orientation'];degrees=round(math.degrees(root.rotation_euler.z))
        assert degrees==ROTATIONS.get(id,0), f'{id}: expected {ROTATIONS.get(id,0)}, got {degrees}'
        if 'window' in id.lower():assert degrees==0, f'{id}: style variant turned off the wall'
    results.append({'id':id,'kind':kind,'rotationDegrees':degrees,'xSlope':round(x.y/x.x,6),'ySlope':round(y.y/y.x,6)})
(ROOT/'docs/art/room-projection-audit.json').write_text(json.dumps({'cameraDirection':[8,-8,6.1],'checkedScenes':len(results),'results':results},indent=2)+'\n')
print('PROJECTION_AUDIT_OK',len(results),'scenes, all wall styles and all rotation variants')
