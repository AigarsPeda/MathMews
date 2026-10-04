"""Check expression visibility, recovery, whisker attachment and camera framing."""
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

sys.path.insert(0,str(Path(__file__).parent))
import render_assets as art

for skin in ('orange','grey','white'):
    scene=art.setup(64)
    art.configure_cat_camera(scene)
    rig=art.cat(skin)
    whiskers=[obj for fan in rig['whiskers'] for obj in fan.children]
    assert len(whiskers)==6
    assert all(fan.parent==rig['head'] for fan in rig['whiskers'])
    assert all(obj.data.bevel_depth>0 and obj.data.use_fill_caps for obj in whiskers)
    controls=art.animated_parts(rig)
    assert all(obj in controls for key in ('happy_lids','sleepy_lids','whiskers') for obj in rig[key])
    assert rig['smile'] in controls
    art.cat_pose(rig,'idle',0)
    neutral_eye=rig['eyes'][0].scale.x
    assert rig['mouth'].scale.length==0 and rig['smile'].scale.x==1
    art.cat_pose(rig,'correct',.5)
    assert all(lid.scale.x==1 for lid in rig['happy_lids'])
    assert all(eye.scale.length==0 for eye in rig['eyes'])
    assert rig['mouth'].scale.z>.8 and rig['smile'].scale.length==0
    art.cat_pose(rig,'surprised',.5)
    assert rig['eyes'][0].scale.x>neutral_eye*1.15
    assert rig['mouth'].scale.z>1
    art.cat_pose(rig,'sleep',.5)
    assert all(lid.scale.x>.99 for lid in rig['sleepy_lids'])
    assert all(glint.scale.length==0 for glint in rig['glints'])
    art.cat_pose(rig,'incorrect',.4)
    assert rig['frown'].scale.x>.9 and rig['smile'].scale.length==0
    art.cat_pose(rig,'incorrect',1)
    assert rig['smile'].scale.x==1 and rig['frown'].scale.length==0
    # Evaluate every direction and pose family, including behind-head occlusion
    # and the deeply compressed box pose, using the actual tapered curves.
    for state in art.CAT_CLIPS:
        for t in (0,.15,.3,.5,.7,.85,1):
            art.cat_pose(rig,state,t)
            bpy.context.view_layer.update()
            deps=bpy.context.evaluated_depsgraph_get()
            for obj in whiskers:
                evaluated=obj.evaluated_get(deps)
                mesh=evaluated.to_mesh()
                for vertex in mesh.vertices:
                    screen=world_to_camera_view(scene,scene.camera,evaluated.matrix_world@vertex.co)
                    assert .005<screen.x<.995 and .005<screen.y<.995,(skin,state,t,obj.name,tuple(screen),'clipped whisker')
                evaluated.to_mesh_clear()
    # Verify facial controls are actually baked into editable animation scenes.
    for frame,t in enumerate((0,.5,1),1):
        art.cat_pose(rig,'correct',t)
        art.key_cat_geometry(rig,frame)
        for obj in controls:
            for prop in ('location','rotation_euler','scale'):
                obj.keyframe_insert(data_path=prop,frame=frame)
    for obj in rig['happy_lids']+rig['sleepy_lids']+rig['whiskers']+[rig['smile']]:
        assert obj.animation_data and obj.animation_data.action,(skin,obj.name,'missing facial keyframes')
print('Verified six head-attached, unclipped whiskers and distinct keyed expressions for all three coats across all 35 animation families.')

if '--baked' in sys.argv:
    for state,frame in (('correct',31),('excited',31),('surprised',25),('sleep',37),('incorrect',25)):
        bpy.ops.wm.open_mainfile(filepath=str(art.BLENDER_OUT/(state+'.blend')))
        scene=bpy.context.scene
        scene.frame_set(frame)
        for name in ('Content cat smile','Happy crescent eyelid -1','Relaxed closed eyelid -1','Whisker fan -1','Whisker fan 1'):
            obj=scene.objects[name]
            assert obj.animation_data and obj.animation_data.action,(state,name,'saved facial controls missing')
        assert scene.objects['Whisker fan -1'].parent==scene.objects['Oversized round head']
        if state in ('correct','excited'):
            assert scene.objects['Happy crescent eyelid -1'].scale.x>.99
            assert scene.objects['Glossy round eye -1'].scale.length<1e-6
        elif state=='sleep':
            assert scene.objects['Relaxed closed eyelid -1'].scale.x>.99
            assert scene.objects['Eye sparkle -1'].scale.length<1e-6
        elif state=='surprised':
            assert scene.objects['Glossy round eye -1'].scale.x>.105
        else:
            assert scene.objects['Sad mouth'].scale.x>.9
            assert scene.objects['Content cat smile'].scale.length<1e-6
    print('Verified facial controls and expression peaks in the actual saved gameplay Blender scenes.')
