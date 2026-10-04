"""Verify saved UI symbols have level axes and arrows point in their named direction."""
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/3d'))
from render_icon_study import FRONT_ICONS

checked = set()
arrows = {'left': (-1, 0), 'right': (1, 0), 'up': (0, 1), 'down': (0, -1)}
for library in ['icon-study/source/starter-icons.blend', 'app-icons/source/icons.blend']:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'docs/art' / library))
    for scene in bpy.data.scenes:
        if not scene.name.startswith('Icon '):
            continue
        name = scene.name.removeprefix('Icon ')
        if name not in FRONT_ICONS:
            continue
        checked.add(name)
        bpy.context.window.scene = scene
        bpy.context.view_layer.update()
        assert scene.camera.data.type == 'ORTHO', name
        assert scene.get('icon_view') == 'front', name
        camera_space = scene.camera.matrix_world.inverted().to_3x3()
        horizontal = camera_space @ Vector((1, 0, 0))
        vertical = camera_space @ Vector((0, 0, 1))
        assert horizontal.x > .99999 and abs(horizontal.y) < 1e-6, f'{name}: horizontal axis tilted'
        assert vertical.y > .99999 and abs(vertical.x) < 1e-6, f'{name}: vertical axis tilted'
        if name.startswith('arrow-'):
            arrow = next(obj for obj in scene.objects if obj.name.startswith('Rounded direction arrow'))
            vertices = arrow.data.vertices
            tip = arrow.matrix_world @ vertices[4].co
            tail = arrow.matrix_world @ ((vertices[0].co + vertices[1].co) / 2)
            direction = (camera_space @ (tip - tail)).xy.normalized()
            expected = Vector(arrows[name.removeprefix('arrow-')])
            assert direction.dot(expected) > .99999, f'{name}: arrow points in the wrong direction'

assert checked == FRONT_ICONS, f'Missing front-facing scenes: {FRONT_ICONS - checked}'
print(f'Verified {len(checked)} upright UI symbols and all four arrow directions in saved Blender scenes.')
