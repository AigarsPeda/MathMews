"""Small still shop previews from each shipped cat skin. No native view per card."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
for skin in ('orange', 'grey', 'white'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d/native'/f'cat-{skin}.glb'))
    scene = bpy.context.scene
    idle = next(action for action in bpy.data.actions if action.name == 'idle' or action.name.startswith('idle.'))
    for obj in scene.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = True
            if obj.type == 'ARMATURE':
                obj.animation_data.action = idle
    scene.frame_set(1)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    scene.world = bpy.data.worlds.new('Thumbnail environment')
    scene.world.color = (.65, .65, .65)
    for position, energy in [((3, -5, 7), 700), ((-4, -2, 4), 400), ((0, 4, 5), 500)]:
        bpy.ops.object.light_add(type='AREA', location=position)
        light = bpy.context.object
        light.data.energy, light.data.shape, light.data.size = energy, 'DISK', 5
        light.rotation_euler = (Vector((0, 0, .94))-light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(location=(3.2, -10, 4))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((.04, 0, .94))-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type, camera.data.ortho_scale = 'ORTHO', 2.7
    scene.camera = camera
    scene.render.resolution_x = scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = str(ROOT/'assets/3d'/f'cat-shop-{skin}.png')
    bpy.ops.render.render(write_still=True)
