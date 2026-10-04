# Math Mews 3D assets

This collection replaces the previous pixel art with original Blender models, rounded forms, matte materials, and the game's cream, coral, teal, gold and dusty pastel palette.

The app uses rendered images rather than a live 3D scene. This keeps its existing room placement, dragging, layering, rotation, mirroring, store categories and save format.

## Editable sources

The 313 editable Blender scenes live in `/Users/aigarspeda/Desktop/BrainPet-blender-assest`, outside the app repository. Paths below are relative to that folder.

- `cat.blend` is the cat model with named, parented body parts.
- `idle.blend`, `correct.blend`, `incorrect.blend`, `lieDown.blend`, `restSleep.blend`, `sleep.blend`, `eating.blend` and the other clips contain editable transform keyframes. These use a hierarchy of parts rather than an armature.
- `items/` contains 273 furniture, bed and toy models. Animated objects include keyframes.
- `rooms/` contains all 15 room scenes.
- `store.blend` and `stats.blend` contain the matching app graphics.

`migration-sha256.json` records the size and SHA-256 checksum of every scene when it was moved. The copy matched the original files before the project copies were removed. Checksums describe that migration, so they will change when you edit a scene.

Orange, grey and white coats use the same model and animation. The approved expressive cat's geometry, procedural materials and poses are defined in `scripts/3d/cat_model.py`; `scripts/3d/render_assets.py` renders the collection. The approved concept is in `docs/art/cat-approved-concept.png`, and `HANDOFF.md` describes its proportions, palette, expressions and exact recreation settings. The external library also contains `reference/cat-approved-concept.png` and `reference/CAT_DESIGN.md`.

## Rebuilding

Run from the repository root with Blender installed:

```sh
npm run assets:3d
npm run assets:3d -- --refresh
npm run assets:verify
```

The first command skips existing renders. The second rebuilds everything. Set `BLENDER_BIN` if Blender is installed elsewhere.

The renderer and verifier default to the sibling folder `../BrainPet-blender-assest`. To use another source folder, set `BRAINPET_BLENDER_ASSET_DIR` to its absolute path. Rendered PNGs, WebP pages and atlases always stay in `assets/3d/` inside the app repository.

On a fresh clone, copy the external Blender library beside the repository, or regenerate it with `npm run assets:3d -- --refresh`. Asset verification requires the editable library as well as the runtime images.

To rebuild only the cat's 66 clips and branding, run `npm run assets:3d -- --only cat --refresh`. Rooms, furniture and their item IDs stay as they are. The cat scenes include editable transform keyframes for its brows, mouth, frown, ears, eyes, catchlights, paws and tears.

The short front and back legs overlap the torso and paws in every pose. Their transforms are keyed along with the paw controls, so waving and lying down keep those connections. Check all procedural poses with Blender running `scripts/3d/check-cat-leg-connections.py`. For interrupted renders, the renderer accepts `--skin grey --clips sleep,dance --refresh` to rebuild selected clips.

The three box clips use `create_cat(..., boxed=True)`: the tail rises inside the box before curling above the rim. All four paws stay tucked behind the walls and above the floor during body bobs; back-paw transforms are keyed too. Rebuild these nine clips with the renderer's `--only cat --clips box1,box2,box3 --refresh`, then run `node scripts/3d/pack.mjs`. Check the actual posed geometry with Blender running `scripts/3d/check-cat-box-containment.py`; append `-- --baked` to check every frame in the saved orange scenes. `node scripts/3d/review-cat-box.mjs` produces `docs/art/cat-box-keyposes.png` for all coats and clips.

`pack.mjs` extracts `cat-splash.png` directly from the first orange idle atlas cell. The launch logo and the loading animation use that same pose. Run `node scripts/check-splash-continuity.mjs` after packing to check pixel identity and startup readiness.

To render one object directly:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/3d/render_assets.py -- --only sofaA --refresh
node scripts/3d/pack.mjs
```

The renderer uses Blender 5.2.2 LTS and Eevee. `--cycles` selects Cycles. Preserve the camera, framing and lighting when editing a source scene so replacements align with the existing collection. The procedural script rebuilds its models; manual Blender edits must be rendered from the edited `.blend` scene instead of running the model generator again.

## Runtime format

- Static furniture, beds and scratching posts are 256 px transparent PNGs.
- Rooms are 1024 px PNGs.
- Cat gameplay cells are 768 px at 24 fps. Four cells fit into each 1536×1536 WebP page. Only the current/next pair is decoded, with a theoretical RGBA budget of 18 MiB before GPU overhead/transient replacements.
- The 22 cat clips run at 24 fps. Idle lasts 4 seconds, correct 2.5 seconds, incorrect 2 seconds, and feeding 3 seconds. The splash uses a separate full 192 px idle sheet.
- Furniture and small-toy loops use eight frames at 12 fps.
- Cat sprites use smooth linear sampling and fractional scaling. Reanimated advances frames on the UI thread; background/covered screens pause. Reduce Motion freezes loops. Gameplay can zoom to 3× without writing placement offsets.
- Cat WebP pages use quality 90 and alpha quality 100. The current 1,089 pages total 89,574,090 bytes, about 85.4 MiB. See `docs/art/cat-texture-metrics.json` for current and earlier measurements.
- Individual render frames and Blender backups are ignored by Git. Metro excludes source scenes and intermediate frames. Editable `.blend` files live outside the repository and are not bundled into the app. Back up the external folder to preserve manual Blender edits; the previous scenes remain recoverable from Git history.

`npm run assets:verify` checks all 288 retained item IDs, texture dimensions/page budgets, nonempty cat frames, unclipped cat silhouettes, motion, forward/reverse completion, page-loading stalls, mirroring and rest/sleep/wake transitions.

All placeable items use the room projection direction `(8,-8,6.1)`. Window style changes keep the wall plane unchanged; wall mirroring is independent. Rotation variants share colours. Audit every scene with Blender running `scripts/3d/audit_projection.py`; regenerate labelled contact boards with `node scripts/3d/review-assets.mjs`. Results/research are in `HANDOFF.md` and `docs/art/room-projection-audit.json`.
