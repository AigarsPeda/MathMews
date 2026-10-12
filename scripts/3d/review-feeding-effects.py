"""Render the shipped effect GLBs beside their feeders for motion review."""
from pathlib import Path
import bpy, sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/3d'))
from feeding_effects import FEEDING_EFFECT_IDS

scope = {'__file__': str(ROOT / 'scripts/3d/render_assets.py'), '__name__': '__feeding_review__'}
exec(compile((ROOT / 'scripts/3d/render_assets.py').read_text(), scope['__file__'], 'exec'), scope)
OUT = Path('/tmp/brainpet-feeding-effects')
OUT.mkdir(exist_ok=True)
for id in FEEDING_EFFECT_IDS:
    selected = [arg.split('=', 1)[1] for arg in sys.argv if arg.startswith('--id=')]
    if selected and id not in selected:
        continue
    scene = scope['setup'](224)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f'assets/3d/native/{id}.glb'))
    parts = [obj for obj in scene.objects if obj.type == 'MESH']
    scope['frame_camera'](parts, 1.75)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f'assets/3d/native/{id}-eating-effect.glb'))
    scene.render.fps = 24
    for i in range(24):
        frame = 1 + i / 23 * 96
        scene.frame_set(int(frame), subframe=frame % 1)
        scope['render'](OUT / f'{id}-{i:02}.png')
    print('REVIEW_EFFECT', id, flush=True)
