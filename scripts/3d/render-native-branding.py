"""Regenerate cat stills from shipped GLBs, without a simulator.

Portrait coordinates mirror NativeCatDisplay: Filament (x, y, z) becomes
Blender (x, -z, y). The 2.7-unit orthographic square is exactly 192 points;
do not trim or auto-fit the startup portrait. Frame zero is glTF idle time 0.
Lighting calibration lives in setup_portrait and tone_map. All coats use it.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SKINS = ('orange', 'grey', 'white')
SOURCE_FILE = ROOT/'scripts/3d/branding-source.json'
ENVIRONMENT = ROOT/'node_modules/react-native-filament/assets/RNF_default_env_ibl.ktx'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def selected_skins(args):
    skins = list(dict.fromkeys(arg.split('=', 1)[1] for arg in args if arg.startswith('--skin='))) or list(SKINS)
    if any(skin not in SKINS for skin in skins):
        raise ValueError(f'Unknown cat coat: {skins}')
    return skins


def load_idle(skin):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d/native'/f'cat-{skin}.glb'))
    scene = bpy.context.scene
    idle = next(action for action in bpy.data.actions if action.name == 'idle')
    for obj in scene.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = True
            obj.animation_data.action = idle if obj.type == 'ARMATURE' else None
    scene.frame_set(int(idle.frame_range[0]))
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    scene.world = bpy.data.worlds.new('Portrait environment')
    bpy.ops.object.camera_add(location=(3.2, -10, 4))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((.04, 0, .94))-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type, camera.data.ortho_scale = 'ORTHO', 2.7
    scene.camera = camera
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    return scene


def setup_portrait(scene):
    """Match RNF DefaultLight using its actual bundled R11G11B10F cubemap.

    Calibrated against iPhone 15 startup frames on 2026-11-15. World strength
    .45, downward sun .26, exposure 1.3 and the AP1 tone curve approximate
    Filament's 25,000 IBL / 10,000 lux sun at f/16, 1/125, ISO 100. Filament's
    diffuse SH is unoccluded; disable Cycles self-occlusion for that match.
    The camera needs no fitted scale or translation correction.
    """
    data = ENVIRONMENT.read_bytes()
    header = struct.unpack_from('<13I', data, 12)
    if data[:12] != b'\xabKTX 11\xbb\r\n\x1a\n' or header[0] != 0x04030201 or header[4] != 0x8c3a or header[10] != 6:
        raise ValueError('DefaultLight cubemap format changed; recalibrate the startup renderer.')
    size = header[6]
    packed = np.frombuffer(data, dtype='<u4', count=size*size*6, offset=64+header[12]+4).reshape(6, size, size)

    def unpack_float(values, bits):
        exponent = values >> bits
        mantissa = values & ((1 << bits)-1)
        return np.where(exponent == 0, mantissa/(1 << bits)*2**(-14),
                        (1+mantissa/(1 << bits))*np.exp2(exponent.astype(float)-15))

    cube = np.stack([unpack_float(packed & 2047, 6), unpack_float((packed >> 11) & 2047, 6),
                     unpack_float(packed >> 22, 5)], axis=-1)
    height, width = 256, 512
    longitude = (.5-(np.arange(width)+.5)/width)*2*np.pi
    latitude = (np.arange(height)+.5)/height*np.pi
    direction = np.stack(np.broadcast_arrays(np.sin(latitude[:, None])*np.cos(longitude),
                         np.cos(latitude[:, None]), -np.sin(latitude[:, None])*np.sin(longitude)), axis=-1)
    major = np.argmax(np.abs(direction), axis=-1)
    faces = major*2+(np.take_along_axis(direction, major[..., None], axis=-1)[..., 0] < 0)
    pixels = np.ones((height, width, 4), dtype=np.float32)
    for face in range(6):
        mask = faces == face
        coordinates = direction[mask]
        horizontal, vertical, depth = coordinates.T
        scales = np.abs(coordinates[:, face//2])
        uv = [(-depth, -vertical), (depth, -vertical), (horizontal, depth),
              (horizontal, -depth), (horizontal, -vertical), (-horizontal, -vertical)][face]
        columns = np.clip(((uv[0]/scales+1)*.5*size).astype(int), 0, size-1)
        rows = np.clip(((uv[1]/scales+1)*.5*size).astype(int), 0, size-1)
        pixels[mask, :3] = cube[face, rows, columns]
    environment = bpy.data.images.new('Filament environment', width, height, float_buffer=True)
    environment.pixels.foreach_set(pixels[::-1].ravel())
    scene.world.use_nodes = True
    tree = scene.world.node_tree
    texture = tree.nodes.new('ShaderNodeTexEnvironment')
    texture.image = environment
    tree.links.new(texture.outputs['Color'], tree.nodes['Background'].inputs['Color'])
    tree.nodes['Background'].inputs['Strength'].default_value = .45
    bpy.ops.object.light_add(type='SUN')
    bpy.context.object.data.energy = .26
    bpy.context.object.data.angle = .05
    for obj in scene.objects:
        if obj.type == 'MESH':
            obj.visible_shadow = False
            obj.visible_diffuse = False


def tone_map(scene, path, size):
    """AP1 RRT/ODT fit with ACESLegacy's 1/.6 brightness and dim surround.

    Standard sRGB alone clips highlights and makes the orange coat too red.
    These neutral matrices/curves apply equally to future coats and geometry;
    no captured pixels, masks, per-material recoloring or fitted warps are used.
    The tiny ACES glow/red modifiers and Filament's GPU LUT are not reproduced.
    """
    source = bpy.data.images.load(str(path), check_existing=False)
    pixels = np.array(source.pixels[:], dtype=np.float32).reshape(-1, 4)
    colors = pixels[:, :3]
    colors = np.where(colors <= .04045, colors/12.92, ((colors+.055)/1.055)**2.4)
    rgb_xyz = np.array([[.412456, .357576, .180438], [.212673, .715152, .072175], [.0193339, .119192, .950304]])
    ap1_xyz = np.array([[.6624541811, .1340042065, .156187687], [.2722287168, .6740817658, .0536895174],
                        [-.0055746495, .0040607335, 1.0103391003]])
    rgb_ap1 = np.linalg.inv(ap1_xyz) @ rgb_xyz
    luminance = np.array([.272229, .674082, .0536895])
    colors = colors @ rgb_ap1.T
    colors = np.maximum(0, colors*.96+(colors @ luminance)[:, None]*.04)*1.3/.6
    colors = (colors*(2.785085*colors+.107772))/(colors*(2.936045*colors+.887122)+.806889)
    colors *= np.maximum(colors @ luminance, 1e-8)[:, None]**(-.0189)
    colors = colors*.93+(colors @ luminance)[:, None]*.07
    pixels[:, :3] = np.clip(colors @ np.linalg.inv(rgb_ap1).T, 0, 1)
    mapped = bpy.data.images.new('Tone-mapped portrait', size, size, float_buffer=True)
    mapped.pixels.foreach_set(pixels.ravel())
    mapped.save_render(str(path), scene=scene)
    bpy.data.images.remove(source)
    bpy.data.images.remove(mapped)


def render(scene, relative_path, size):
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(ROOT/relative_path)
    bpy.ops.render.render(write_still=True)
    tone_map(scene, ROOT/relative_path, size)


def regenerate(skins):
    models = {f'assets/3d/native/cat-{skin}.glb': digest(ROOT/f'assets/3d/native/cat-{skin}.glb') for skin in skins}
    outputs = []
    for skin in skins:
        scene = load_idle(skin)
        setup_portrait(scene)
        thumbnail = f'assets/3d/cat-shop-{skin}.png'
        render(scene, thumbnail, 256)
        outputs.append(thumbnail)
        if skin == 'orange':
            for filename, size in [('assets/3d/cat-preview.png', 512), ('docs/art/startup-cat-native.png', 576)]:
                render(scene, filename, size)
                outputs.append(filename)
    if 'orange' in skins:
        subprocess.run(['node', str(ROOT/'scripts/generate-branding.mjs')], cwd=ROOT, check=True)
        outputs.extend(['assets/3d/cat-splash.png', *[f'assets/images/{name}.png' for name in
                        ('icon', 'android-icon-foreground', 'android-icon-monochrome', 'splash-brand', 'splash-launch')]])
    for filename, expected in models.items():
        if digest(ROOT/filename) != expected:
            raise RuntimeError('Cat GLB changed during rendering. Run npm run assets:cat-stills again under the export lock.')
    sources = json.loads(SOURCE_FILE.read_text())
    sources.update(models)
    sources.update({filename: digest(ROOT/filename) for filename in outputs})
    SOURCE_FILE.write_text(json.dumps(sources, indent=2)+'\n')
    print('CAT_STILLS', ', '.join(skins), flush=True)


if __name__ == '__main__':
    regenerate(selected_skins(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []))
