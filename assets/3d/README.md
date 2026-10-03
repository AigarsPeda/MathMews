# Math Mews 3D assets

This collection replaces the previous pixel art with original Blender models, rounded forms, matte materials, and the game's cream, coral, teal, gold and dusty pastel palette.

The app uses rendered images rather than a live 3D scene. This keeps its existing room placement, dragging, layering, rotation, mirroring, store categories and save format.

## Editable sources

- `blender/cat.blend` is the cat model with named, parented body parts.
- `blender/idle.blend`, `correct.blend`, `incorrect.blend`, `lieDown.blend`, `restSleep.blend`, `sleep.blend`, `eating.blend` and the other clips contain editable transform keyframes. These use a hierarchy of parts rather than an armature.
- `blender/items/` contains each furniture, bed and toy model. Animated objects include keyframes.
- `blender/rooms/` contains all 15 room scenes.
- `blender/store.blend` and `blender/stats.blend` contain the matching app graphics.

Orange, grey and white coats use the same model and animation. Their materials are defined in `scripts/3d/render_assets.py`.

## Rebuilding

Run from the repository root with Blender installed:

```sh
npm run assets:3d
npm run assets:3d -- --refresh
npm run assets:verify
```

The first command skips existing renders. The second rebuilds everything. Set `BLENDER_BIN` if Blender is installed elsewhere.

To render one object directly:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/3d/render_assets.py -- --only sofaA --refresh
node scripts/3d/pack.mjs
```

The renderer uses Blender 5.2.2 LTS and Eevee. `--cycles` selects Cycles. Preserve the camera, framing and lighting when editing a source scene so replacements align with the existing collection. The procedural script rebuilds its models; manual Blender edits must be rendered from the edited `.blend` scene instead of running the model generator again.

## Runtime format

- Static furniture, beds and scratching posts are 256 px transparent PNGs.
- Rooms are 1024 px PNGs.
- Animation cells are 192 px. Atlases have eight columns, with one texture per cat clip and coat.
- The 22 cat clips run at 12–20 fps. Correct reactions last 1.2 seconds, incorrect reactions 1.5 seconds, and feeding 2 seconds.
- Furniture and small-toy loops use eight frames at 12 fps.
- Cat sprites use smooth linear sampling and fractional scaling.
- Individual render frames and Blender backups are ignored by Git. Metro excludes source scenes and intermediate frames. The editable `.blend` files are retained in Git and are not bundled into the app.

`npm run assets:verify` checks all 288 retained item IDs, texture dimensions, nonempty cat frames, unclipped cat silhouettes, motion, reaction playback, mirroring and rest/sleep/wake transitions.
