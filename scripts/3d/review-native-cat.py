"""Render the shipped GLB, including its skin and baked clips, from useful angles."""
from pathlib import Path
import sys, bpy
import numpy as np
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/3d'))
scope={'__file__':str(ROOT/'scripts/3d/render_assets.py'),'__name__':'__native_cat_review__'}
exec(compile((ROOT/'scripts/3d/render_assets.py').read_text(),scope['__file__'],'exec'),scope)
OUT=ROOT/'docs/art/native-cat-rebuild'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=scope['setup'](640)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d/native/cat-orange.glb'))
arm=next(o for o in scene.objects if o.type=='ARMATURE')
# Sample every exported action, including extreme care/play poses. This catches
# spikes and disconnected joint weighting after glTF conversion.
body = next(o for o in scene.objects if o.name.startswith('Game cat skin'))
for track in arm.animation_data.nla_tracks:
    clip = track.name
    for other in arm.animation_data.nla_tracks: other.mute = other != track
    end = max(strip.frame_end for strip in track.strips)
    for frame in (1, end*.25, end*.5, end*.75, end):
        scene.frame_set(int(frame)); evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        points = np.empty(len(mesh.vertices)*3); mesh.vertices.foreach_get('co', points); points = points.reshape((-1, 3))
        assert np.isfinite(points).all(), clip+' contains a non-finite skin vertex'
        assert np.max(np.abs(points)) < 3.5, clip+' contains an exploded skin vertex'
        edges = np.array([edge.vertices[:] for edge in mesh.edges], dtype=np.int32)
        longest = np.linalg.norm(points[edges[:, 0]]-points[edges[:, 1]], axis=1).max()
        assert longest < .35, clip+' contains a stretched skin edge: '+str(longest)
        evaluated.to_mesh_clear()
print('POSE_CHECK', len(arm.animation_data.nla_tracks), 'clips, five samples each', flush=True)
scene.camera.data.ortho_scale=2.7
scene.camera.location=(5,-8,2.7)
scene.camera.rotation_euler=(Vector((0,0,1.05))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
for obj in scene.objects:
    if obj.type=='MESH':
        obj.hide_render=not obj.name.startswith('Game cat skin')
        for modifier in obj.modifiers:
            if modifier.type=='ARMATURE':modifier.show_render=False
scene.render.filepath=str(OUT/'unskinned.png');bpy.ops.render.render(write_still=True)
for obj in scene.objects:
    if obj.type=='MESH':
        obj.hide_render=False
        for modifier in obj.modifiers:
            if modifier.type=='ARMATURE':modifier.show_render=True
for label,clip,time,view in [('bind',None,0,(5,-8,2.7)),('front','idle',.05,(0,-10,2.2)),('side','idle',.05,(10,0,2.2)),('sit','sit',.05,(5,-8,2.7)),('walk-quarter','walk',.10,(5,-8,2.7)),('walk-side','walk',.4,(10,0,2.2)),('sleep','curlSleep',.4,(5,-8,2.7)),('jump','jumpOn',.45,(5,-8,2.7))]:
    for obj in scene.objects:
        if obj.animation_data:
            obj.animation_data.action=None
            for track in obj.animation_data.nla_tracks:
                track.mute=track.name!=clip
    scene.frame_set(round(time*24)+1)
    scene.camera.location=view
    scene.camera.rotation_euler=(Vector((0,0,1.05))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/(label+'.png'))
    bpy.ops.render.render(write_still=True)
    print('REVIEW',label,flush=True)
if '--motion' in sys.argv:
    # Review the actual skin through a full gait, rather than a static pose.
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.cycles.samples = 8
    scene.camera.location = (5, -8, 2.7)
    scene.camera.rotation_euler = (Vector((0, 0, 1.05))-scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != 'walk'
    track = next(t for t in arm.animation_data.nla_tracks if t.name == 'walk')
    end = max(s.frame_end for s in track.strips)
    directory = Path('/tmp/brainpet-original-cat-walk')
    directory.mkdir(exist_ok=True)
    for i in range(24):
        frame = 1+(end-1)*i/24
        scene.frame_set(int(frame), subframe=frame%1)
        scene.render.filepath = str(directory/(str(i).zfill(2)+'.png'))
        bpy.ops.render.render(write_still=True)
    print('WALK_FRAMES', directory, flush=True)
