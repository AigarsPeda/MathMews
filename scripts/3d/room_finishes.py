"""Deterministic, UV-mapped room finishes shared by PNG and native GLB exports.

Patterns and grain are baked into small packed images. No runtime shader,
additional wall geometry, or per-frame texture work is required on mobile.
"""
import math
import json
from pathlib import Path
import bpy
import numpy as np

# One definition supplies the Blender finishes, shop metadata and initial price.
FINISHES = {room['id']: room for room in json.loads((Path(__file__).resolve().parents[2] / 'data/room-catalog.json').read_text())}


def rgb(hexcolor):
    return np.array([int(hexcolor[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def packed_image(name, pixels, non_color=False):
    height, width = pixels.shape[:2]
    image = bpy.data.images.new(name, width=width, height=height, alpha=False)
    if non_color:
        image.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(pixels, 0, 1)
    image.pixels.foreach_set(rgba.ravel())
    image.pack()
    return image


def texture_material(name, pixels, relief, roughness=.88):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    color = nodes.new('ShaderNodeTexImage')
    color.image = packed_image(name + ' color', pixels)
    links.new(color.outputs['Color'], shader.inputs['Base Color'])
    # A tangent-space normal texture survives glTF export, unlike Noise/Bump nodes.
    dy, dx = np.gradient(relief)
    normals = np.stack((-dx, -dy, np.ones_like(dx)), axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    normal = nodes.new('ShaderNodeTexImage')
    normal.image = packed_image(name + ' normal', normals * .5 + .5, True)
    mapping = nodes.new('ShaderNodeNormalMap')
    links.new(normal.outputs['Color'], mapping.inputs['Color'])
    links.new(mapping.outputs['Normal'], shader.inputs['Normal'])
    return material


def wall_material(room_id):
    index = int(room_id[4:]) - 1
    finish = FINISHES[room_id]['wall']
    pattern, base, ink = (finish[key] for key in ('pattern', 'base', 'ink'))
    rng = np.random.default_rng(4100 + index)
    y, x = np.mgrid[0:512, 0:768].astype(float)
    u, v = x / 768, y / 512
    # Fine paper/fabric grain plus broad tonal variation gives even plain walls depth.
    grain = rng.normal(0, .008, x.shape)
    cloud = .008 * np.sin(u * 29 + np.sin(v * 18)) * np.cos(v * 27 - u * 9)
    weave = .007 * (np.sin(x * math.pi * .72) + np.sin(y * math.pi * .8))
    amount = np.zeros_like(x)
    relief = grain * 2 + weave
    if pattern in ('linen', 'grasscloth', 'plaster'):
        if pattern == 'grasscloth':
            weave += .018 * np.sin(y * 2.1 + np.sin(x * .025))
        if pattern == 'plaster':
            cloud *= 3
        relief += cloud * 3 + weave * 2
    elif pattern == 'stripe':
        phase = (u * 18) % 1
        amount = np.where(phase < .43, .65, np.where(phase < .49, .2, 0))
    elif pattern in ('sprig', 'botanical'):
        # Staggered stems with paired pointed leaves, in a repeat sized for a dollhouse.
        cx = ((u * 12 + (np.floor(v * 5) % 2) * .5) % 1 - .5)
        cy = (v * 5) % 1 - .5
        stem = np.abs(cx - .07 * np.sin(cy * 6)) < .013
        mask = stem & (np.abs(cy) < .36)
        for side, level in [(-1, -.23), (1, -.09), (-1, .07), (1, .23)]:
            lx = cx - side * .12
            ly = cy - level
            leaf = ((lx * .82 + side * ly * .58) / .15) ** 2 + ((ly * .82 - side * lx * .58) / .06) ** 2 < 1
            mask |= leaf
        amount = mask.astype(float) * (.72 if pattern == 'botanical' else .45)
    elif pattern in ('scallop', 'deco'):
        row = np.floor(v * 9)
        cx = (u * 15 + (row % 2) * .5) % 1 - .5
        cy = (v * 9) % 1
        radius = np.sqrt(cx * cx + cy * cy)
        amount = (np.abs(radius - .65) < .025).astype(float) * .7
        if pattern == 'deco':
            amount += (np.abs(radius - .48) < .018).astype(float) * .5
    elif pattern == 'diamond':
        cx, cy = (u * 13) % 1 - .5, (v * 8) % 1 - .5
        amount = (np.abs(np.abs(cx) + np.abs(cy) - .46) < .025).astype(float) * .65
    elif pattern == 'trellis':
        cx = (u * 12 + (np.floor(v * 6) % 2) * .5) % 1 - .5
        cy = (v * 6) % 1 - .5
        amount = ((np.abs(cx) / .33 + np.abs(cy) / .42 < 1) &
                  (np.abs(cx) / .21 + np.abs(cy) / .30 > 1)).astype(float) * .55
    elif pattern in ('panel', 'beadboard'):
        phase = (u * (14 if pattern == 'panel' else 32)) % 1
        amount = np.where(phase < .045, .8, np.where(phase < .085, .25, 0))
        weave += .016 * np.sin(x * .7 + np.sin(y * .018) * 2)
        relief += amount * 1.5
    elif pattern in ('brick', 'tile'):
        rows = 14 if pattern == 'brick' else 12
        cols = 10 if pattern == 'brick' else 20
        row = np.floor(v * rows)
        px = (u * cols + (row % 2) * .5) % 1
        py = (v * rows) % 1
        amount = ((px < .035) | (py < .06)).astype(float)
        # Subtle per-brick/tile color differences without a costly geometry grid.
        cloud += .018 * np.sin(np.floor(u * cols + (row % 2) * .5) * 19 + row * 47)
        relief -= amount * 1.8
    elif pattern == 'stars':
        cx = (u * 14 + (np.floor(v * 7) % 2) * .5) % 1 - .5
        cy = (v * 7) % 1 - .5
        amount = ((np.abs(cx) + np.abs(cy) < .14) |
                  ((np.abs(cx) < .022) & (np.abs(cy) < .24)) |
                  ((np.abs(cy) < .022) & (np.abs(cx) < .24))).astype(float)
    elif pattern == 'daisy':
        cx = (u * 9 + (np.floor(v * 5) % 2) * .5) % 1 - .5
        cy = (v * 5) % 1 - .5
        angle = np.arctan2(cy, cx)
        radius = np.sqrt(cx * cx + cy * cy)
        amount = (radius < .23 + .065 * np.cos(angle * 8)).astype(float) * .75
        amount[radius < .085] = .2
    elif pattern == 'tropical':
        cx = (u * 7 + (np.floor(v * 3) % 2) * .5) % 1 - .5
        cy = (v * 3) % 1 - .5
        lx, ly = cx + cy * .32, cy
        leaf = (lx / .29) ** 2 + (ly / .43) ** 2 < 1
        cuts = (np.sin(ly * 57 + np.abs(lx) * 17) > .55) & (np.abs(lx) > .07)
        amount = (leaf & ~cuts).astype(float) * .85
    elif pattern == 'waves':
        row = np.floor(v * 8)
        cx = (u * 13 + (row % 2) * .5) % 1 - .5
        cy = (v * 8) % 1
        radius = np.sqrt(cx * cx + cy * cy)
        amount = np.zeros_like(x)
        for ring in [.28, .42, .56, .70, .84]:
            amount = np.maximum(amount, (np.abs(radius - ring) < .023).astype(float) * .85)
    elif pattern == 'redbrick':
        row = np.floor(v * 12)
        px, py = (u * 8 + (row % 2) * .5) % 1, (v * 12) % 1
        amount = ((px < .035) | (py < .07)).astype(float)
        cloud += .045 * np.sin(np.floor(u * 8 + (row % 2) * .5) * 19 + row * 47)
        relief -= amount * 2
    elif pattern == 'concrete':
        cloud *= 4
        amount = .08 + .08 * np.sin(u * 12 + np.sin(v * 17))
        amount += ((u * 4) % 1 < .006).astype(float) * .3
        amount += ((v * 3) % 1 < .006).astype(float) * .3
        relief += cloud * 4
    elif pattern in ('arches', 'rainbow'):
        cx = (u * 8) % 1 - .5
        cy = (v * 4) % 1
        radius = np.sqrt(cx * cx + np.maximum(cy - .42, 0) ** 2)
        if pattern == 'arches':
            amount = ((radius < .42) & (radius > .27)).astype(float) * .9
        else:
            amount = np.where((radius < .44) & (radius > .34), .9,
                     np.where((radius < .31) & (radius > .22), .55,
                     np.where((radius < .19) & (radius > .10), .3, 0)))
    elif pattern == 'terrazzo':
        for _ in range(190):
            cx, cy = rng.random(2)
            sx, sy = rng.uniform(.003, .014, 2)
            chip = np.abs((u - cx) / sx) + np.abs((v - cy) / sy) < 1
            amount[chip] = rng.uniform(.25, .95)
    elif pattern == 'quatrefoil':
        cx, cy = (u * 13) % 1 - .5, (v * 8) % 1 - .5
        radius = np.sqrt(cx * cx + cy * cy)
        outline = .31 + .075 * np.cos(np.arctan2(cy, cx) * 4)
        amount = (np.abs(radius - outline) < .024).astype(float) * .9
    elif pattern == 'gingham':
        vertical, horizontal = (u * 22) % 1 < .5, (v * 13) % 1 < .5
        amount = vertical.astype(float) * .3 + horizontal.astype(float) * .3
    elif pattern == 'wainscot':
        phase = (u * 22) % 1
        panel = np.where(phase < .045, .95, .72)
        amount = np.where(v < .37, panel, np.where(v < .39, 1, 0))
        relief += amount * 1.5
    elif pattern == 'honeycomb':
        cx = (u * 16 + (np.floor(v * 9) % 2) * .5) % 1 - .5
        cy = (v * 9) % 1 - .5
        edge = np.maximum(np.abs(cx), np.abs(cx) * .5 + np.abs(cy) * .86)
        amount = (np.abs(edge - .43) < .018).astype(float) * .8
    elif pattern == 'mushroom':
        cx = (u * 10 + (np.floor(v * 5) % 2) * .5) % 1 - .5
        cy = (v * 5) % 1 - .5
        cap = ((cx / .23) ** 2 + (cy / .23) ** 2 < 1) & (cy > .025)
        stem = (np.abs(cx) < .045) & (cy > -.2) & (cy < .03)
        amount = cap.astype(float) * .9 + stem.astype(float) * .5
        amount[(np.sin(cx * 70) * np.cos(cy * 60) > .8) & cap] = .1
    elif pattern == 'nautical':
        amount = np.where(v < .36, .78, ((v * 12) % 1 < .34).astype(float) * .85)
        amount[(v < .36) & ((u * 26) % 1 < .035)] = 1
        amount[(v >= .36) & (v < .38)] = 1
    pixels = rgb(base) + (rgb(ink) - rgb(base)) * amount[:, :, None]
    pixels += (grain + cloud + weave)[:, :, None]
    return texture_material('Room %d %s wallpaper' % (index + 1, pattern), pixels, relief)


def floor_material(room_id):
    index = int(room_id[4:]) - 1
    finish = FINISHES[room_id]['floor']
    if finish['pattern'] != 'classicOak':
        return collection_floor_material(room_id)
    base, ink = finish['base'], finish['ink']
    rng = np.random.default_rng(8100 + index)
    y, x = np.mgrid[0:768, 0:768].astype(float)
    # Staggered oak boards with seams, knots and fine lengthwise grain.
    column = np.floor(x / 96)
    cross = (y + (column % 3) * 128) % 384
    seam = ((x % 96 < 1.6) | (cross < 1.6)).astype(float)
    grain = .012 * np.sin(x * .85 + np.sin(y * .018) * 2)
    grain += .013 * np.sin(x * .16 + np.sin(y * .009) * 4)
    grain += rng.normal(0, .004, x.shape)
    board = .025 * np.sin(column * 17 + np.floor((y + (column % 3) * 128) / 384) * 31)
    amount = .12 + seam * .48
    pixels = rgb(base) + (rgb(ink) - rgb(base)) * amount[:, :, None]
    pixels += (grain + board)[:, :, None]
    return texture_material('Room %d oak floor' % (index + 1), pixels, grain * 2 - seam, .8)


def collection_floor_material(room_id):
    index = int(room_id[4:]) - 1
    finish = FINISHES[room_id]['floor']
    style, base, ink = (finish[key] for key in ('pattern', 'base', 'ink'))
    rng = np.random.default_rng(8100 + index)
    y, x = np.mgrid[0:768, 0:768].astype(float)
    u, v = x / 768, y / 768
    grain = rng.normal(0, .006, x.shape)
    amount = np.zeros_like(x)
    relief = grain * 2
    roughness = .85
    if style in ('oak', 'bamboo'):
        width = 48 if style == 'bamboo' else 96
        column = np.floor(x / width)
        seam = ((x % width < 1.5) | ((y + (column % 3) * 128) % 384 < 1.5)).astype(float)
        grain += .018 * np.sin(x * .3 + np.sin(y * .012) * 3)
        amount = .1 + seam * .5 + .05 * np.sin(column * 17)
        relief -= seam
    elif style in ('checker', 'slate', 'stone', 'mosaic'):
        count = 10 if style == 'mosaic' else 6
        col, row = np.floor(u * count), np.floor(v * count)
        seam = (((u * count) % 1 < .015) | ((v * count) % 1 < .015)).astype(float)
        if style == 'checker':
            amount = ((col + row) % 2) * .85
            roughness = .55
        elif style == 'mosaic':
            cx, cy = (u * count) % 1 - .5, (v * count) % 1 - .5
            amount = (np.abs(cx) + np.abs(cy) < .32).astype(float) * .8
        else:
            amount = .12 + .12 * np.sin(col * 19 + row * 31)
            grain += .015 * np.sin(u * 73 + np.sin(v * 38))
        amount += seam * .4
        relief -= seam
    elif style == 'tatami':
        col, row = np.floor(u * 3), np.floor(v * 2)
        seam = (((u * 3) % 1 < .035) | ((v * 2) % 1 < .025)).astype(float)
        amount = .1 + seam * .85 + .03 * ((col + row) % 2)
        grain += .025 * np.sin(y * 2.7)
        relief += grain * 2 - seam
    elif style == 'parquet':
        col, row = np.floor(u * 6), np.floor(v * 6)
        vertical = (col + row) % 2 == 0
        across = np.where(vertical, u, v) * 18
        along = np.where(vertical, v, u) * 6
        seam = (((across % 1) < .025) | ((along % 1) < .012)).astype(float)
        amount = .1 + .12 * np.sin(np.floor(across) * 7 + np.floor(along) * 19) + seam * .5
        grain += .015 * np.sin(across * 24 + np.sin(along * 5))
        relief -= seam
    elif style in ('terrazzo', 'cork'):
        for _ in range(650 if style == 'terrazzo' else 1400):
            cx, cy = rng.random(2)
            sx, sy = rng.uniform(.002, .013, 2)
            chip = np.abs((u - cx) / sx) + np.abs((v - cy) / sy) < 1
            amount[chip] = rng.uniform(.2, .9)
        roughness = .6 if style == 'terrazzo' else .95
    elif style == 'concrete':
        grain += .018 * np.sin(u * 39 + np.sin(v * 28)) * np.cos(v * 35)
        amount = .12 + .02 * np.sin(u * 9 - v * 7)
    pixels = rgb(base) + (rgb(ink) - rgb(base)) * amount[:, :, None]
    pixels += grain[:, :, None]
    return texture_material('Room %d %s floor' % (index + 1, style), pixels, relief, roughness)


def map_surface(obj, surface):
    """Keep repeats at a consistent physical scale on both walls and the floor."""
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new()
    for polygon in obj.data.polygons:
        for loop_index in polygon.loop_indices:
            point = obj.matrix_world @ obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            if surface == 'floor':
                coords = ((point.x + 2.5) / 5, (point.y + 2.5) / 5)
            else:
                distance = point.y + 2.5 if surface == 'left' else 2.5 - point.x
                coords = (distance / 5, point.z / 2.8)
            uv.data[loop_index].uv = coords
