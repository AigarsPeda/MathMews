"""Review exported notification clips with the native portrait camera.

Blender --background --python-exit-code 1 --python scripts/3d/review-puzzle-reactions.py
Add -- --motion for a 12 FPS review, or --authored to review new poses before export.
"""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/3d'))
import render_assets as art
from puzzle_reactions import PUZZLE_REACTIONS
from game_cat import create_controls, pose_controls, pose

OUT = ROOT / 'docs/qa/puzzle-reactions/2026-10-19'
OUT.mkdir(parents=True, exist_ok=True)
FRAMES = Path('/tmp/brainpet-puzzle-reactions-frames')
FRAMES.mkdir(parents=True, exist_ok=True)
authored = '--authored' in sys.argv
if authored:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'prototypes/cat-model/cat-orange.blend'))
    scene = bpy.context.scene
else:
    scene = art.setup(256)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/3d/native/cat-orange.glb'))
scene.render.resolution_x = scene.render.resolution_y = 256
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8
scene.camera.location = (3.2, -10, 4)
art.aim(scene.camera, (.04, 0, .94))
scene.camera.data.ortho_scale = 2.7
arm = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
arm.animation_data.action = None
if authored:
    for track in arm.animation_data.nla_tracks:
        track.mute = True
    before = set(scene.objects)
    driver = create_controls('orange')
    pose_controls(driver, 'idle', 0)
    idle = {'head': driver['head'].location.copy(), 'body_height': driver['body'].location.z,
            **{key: [obj.location.copy() for obj in driver[key]] for key in ('feet','back_feet')}}
    pose_controls(driver,'walk',0)
    idle['standing_height'] = driver['body'].location.z
    for obj in set(scene.objects)-before:
        obj.hide_render = True
    for bone in arm.pose.bones:
        if bone.name.startswith('prop'):
            bone.scale = (0,0,0)
clips = json.loads((ROOT/'scripts/3d/clips.json').read_text())
def set_phase(clip, phase):
    if authored:
        desired = pose(arm, driver, clip, phase, idle)
        for bone in arm.pose.bones:
            if bone.name not in desired:
                continue
            parent = bone.parent
            bone.matrix_basis = bone.bone.convert_local_to_pose(desired[bone.name],bone.bone.matrix_local,
                parent_matrix=desired[parent.name] if parent else Matrix.Identity(4),
                parent_matrix_local=parent.bone.matrix_local if parent else Matrix.Identity(4),invert=True)
        bpy.context.view_layer.update()
    else:
        strip = next(track for track in arm.animation_data.nla_tracks if track.name == clip).strips[0]
        frame = strip.frame_start + (strip.frame_end-strip.frame_start)*phase
        scene.frame_set(int(frame),subframe=frame%1)
checks = []
for clip in PUZZLE_REACTIONS:
    track = next(track for track in arm.animation_data.nla_tracks if track.name == clip)
    for other in arm.animation_data.nla_tracks:
        other.mute = authored or other != track
    strip = track.strips[0]
    # Check the deformed body rather than the rest bounds. High paws and
    # airborne poses must fit the same square used by the result sheet.
    for sample in range(25):
        phase = sample / 24
        set_phase(clip,phase)
        deps = bpy.context.evaluated_depsgraph_get()
        for obj in scene.objects:
            if obj.hide_render or obj.type != 'MESH' or not any(mod.type == 'ARMATURE' for mod in obj.modifiers) or 'Game prop' in obj.name:
                continue
            evaluated = obj.evaluated_get(deps)
            mesh = evaluated.to_mesh()
            points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
            # Inactive care/play props are collapsed by their authored bones.
            if not points or max((point - points[0]).length for point in points) < .0001:
                evaluated.to_mesh_clear()
                continue
            for point in points:
                screen = world_to_camera_view(scene, scene.camera, point)
                assert .01 < screen.x < .99 and .01 < screen.y < .99, (clip, phase, obj.name, tuple(screen), 'portrait clipping')
            evaluated.to_mesh_clear()
    duration = clips[clip][0]/clips[clip][1]
    if not authored:
        assert abs((strip.frame_end-strip.frame_start)/scene.render.fps-duration) < .002, (clip, 'exported duration does not match the authored clip')
    samples = [min(1,i/(duration*12)) for i in range(round(duration*12)+1)] if '--motion' in sys.argv else [.18,.42,.72]
    for index, phase in enumerate(samples):
        set_phase(clip,phase)
        scene.render.filepath = str(FRAMES / f'{clip}-{index:02}.png')
        bpy.ops.render.render(write_still=True)
    checks.append({'clip': clip, 'duration': duration, 'frames': len(samples), 'reviewFps': 12 if '--motion' in sys.argv else None, 'portraitSamples': 25, 'source': 'authoring controls' if authored else 'shipped GLB'})
    print('PUZZLE_REACTION_REVIEW', clip, flush=True)
(OUT / 'blender-review.json').write_text(json.dumps(checks, indent=2) + '\n')
