"""Render startup stills from the same shipped GLB and camera as NativeCatDisplay."""
from pathlib import Path
import hashlib
import json
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
existing_actions = set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d/native/cat-orange.glb'))
scene = bpy.context.scene
idle = next(a for a in bpy.data.actions if a not in existing_actions and (a.name == 'idle' or a.name.startswith('idle.')))
for obj in scene.objects:
    if obj.animation_data:
        # glTF import selects an arbitrary last action. Startup always uses idle.
        if idle and obj.type == 'ARMATURE':
            for track in obj.animation_data.nla_tracks:
                track.mute = True
            obj.animation_data.action = idle
scene.frame_set(1)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.world.color = (.65, .65, .65)
for name, position, energy, size in [('Key', (3, -5, 7), 700, 5), ('Fill', (-4, -2, 4), 400, 5), ('Rim', (0, 4, 5), 500, 4)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    light = bpy.context.object
    light.name = name
    light.data.energy, light.data.shape, light.data.size = energy, 'DISK', size
    light.rotation_euler = (Vector((0, 0, .94))-light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(3.2, -10, 4))
camera = bpy.context.object
camera.rotation_euler = (Vector((.04, 0, .94))-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 2.7
scene.camera = camera
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
for filename, size in [('cat-splash.png', 192), ('cat-preview.png', 512)]:
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(ROOT/'assets/3d'/filename)
    bpy.ops.render.render(write_still=True)
files = ['assets/3d/native/cat-orange.glb', 'assets/3d/cat-splash.png', 'assets/3d/cat-preview.png']
(ROOT/'scripts/3d/branding-source.json').write_text(json.dumps({file: hashlib.sha256((ROOT/file).read_bytes()).hexdigest() for file in files}, indent=2)+'\n')
