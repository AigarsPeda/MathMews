"""Check each shipped coat's deformed mesh at five poses in every baked clip.

Run with Blender --background --python-exit-code 1 --python this-file.py.
The native-worklet recorders separately cover additive ear reactions/blends.
"""
from pathlib import Path
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
for coat in ('orange', 'grey', 'white'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d/native'/f'cat-{coat}.glb'))
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    body = next(o for o in bpy.context.scene.objects if o.name == 'Game cat skin')
    head_group = body.vertex_groups['head'].index
    jaw = [v for v in body.data.vertices if v.co.y < -.78 and .98 <= v.co.z <= 1.18]
    assert jaw, 'Sample the lower face, where neck weights previously distorted the chin'
    assert all(sum(g.weight for g in v.groups if g.group == head_group) > .999 for v in jaw), (coat, 'chin must follow the skull')
    arm.animation_data.action = None
    for track in arm.animation_data.nla_tracks:
        for other in arm.animation_data.nla_tracks:
            other.mute = other != track
        strip = track.strips[0]
        resting = track.name.startswith(('restLoaf', 'restCrescent', 'restSide'))
        phases = [i/40 for i in range(41)] if resting and track.name.endswith(('Enter', 'Wake')) else (0, .25, .5, .75, 1)
        for phase in phases:
            frame = strip.frame_start+(strip.frame_end-strip.frame_start)*phase
            bpy.context.scene.frame_set(int(frame), subframe=frame-int(frame))
            evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
            mesh = evaluated.to_mesh()
            points = np.empty(len(mesh.vertices)*3)
            mesh.vertices.foreach_get('co', points)
            points = points.reshape((-1, 3))
            edges = np.array([edge.vertices[:] for edge in mesh.edges], dtype=np.int32)
            assert np.isfinite(points).all(), (coat, track.name, phase, 'nonfinite skin')
            assert np.max(np.abs(points)) < 3.5, (coat, track.name, phase, 'exploded skin')
            longest = np.linalg.norm(points[edges[:, 0]]-points[edges[:, 1]], axis=1).max()
            assert longest < .35, (coat, track.name, phase, 'stretched seam', longest)
            if resting:
                assert points[:, 2].min() > -.01, (coat, track.name, phase, 'sleeping skin penetrates its support', points[:, 2].min())
            evaluated.to_mesh_clear()
    print('SKIN_CHECK', coat, len(arm.animation_data.nla_tracks), 'clips, five poses each; 41 per sleep entry/wake; skull-bound chin', flush=True)
