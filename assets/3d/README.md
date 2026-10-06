# Math Mews 3D assets

The live iOS/Android game uses Filament models for rooms, furniture, cats, toys and room previews. Catalog IDs and saved placement coordinates remain stable.

## Retained assets

- `native/`: 292 GLBs (288 catalog entries, three cat coats, and airflow), plus catalog metadata with compound sofa collision boxes derived from the source meshes. The native models have a checked 60 MiB budget.
- `decoration/`, `room/`, `scratcher/`, `sleep/`, `toy/`: transparent store/editor thumbnails. The two Japanese doors use their closed-pose thumbnail aliases.
- `atlases/`: 26 eight-frame furniture/toy thumbnail strips. These are UI assets; live room objects use their GLB animations.
- `cat-preview.png` and `cat-splash.png`: branding portraits rendered from the shipped orange GLB. Startup hands its still portrait over to the native cat renderer. Cat exports refresh these and the launch composites; startup checks verify their model/source hashes.

All game media, including icons and the supported dog videos, has a checked 100 MiB budget. Cat sprite pages, separate raster play props, old prototype models and intermediate renders are removed.

## Model sources

`scripts/3d/export-native.py` exports the procedural catalog from `render_assets.py` and the original connected cat from `original_cat.py` and `game_cat.py`. `cat_model.py` still supplies shared pose controls and app-icon geometry. `clips.json` is the timing source for 36 clips, including the 35 existing actions and a dedicated sofa sitting pose in all three coats and the native playback registry.

The current editable cat rig is [cat-orange.blend](../../prototypes/cat-model/cat-orange.blend). It opens on the finished connected skin, with authoring controls removed. Current deformation checks and review images are described in [native engine notes](../../docs/native-room-engine.md).

The original editable catalog library lives in `../BrainPet-blender-assest`. Set `BRAINPET_BLENDER_ASSET_DIR` to override that location. Generators recreate scenes; render manually edited scenes directly to preserve manual edits. Verification reads the bundled outputs and does not require the external library.

## Rebuilding

Run from the repository root with Blender installed:

```sh
npm run assets:native
npm run assets:3d -- --only sofaA --refresh
npm run assets:verify
```

The native command writes intermediate catalog blends under `/tmp/brainpet-native-blends`. To rebuild just cats, run:

```sh
BRAINPET_BLENDER_ASSET_DIR=/tmp/brainpet-native-blends /Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/3d/export-native.py -- --cats
```

Cat exports refresh the editable orange rig in `prototypes/cat-model/cat-orange.blend`; other coat intermediates stay in `/tmp/brainpet-cat-{coat}.blend`. The cat uses original Blender geometry and no third-party model files.

`assets:3d` builds UI thumbnails and skips existing outputs unless `--refresh` is given. Set `BLENDER_BIN` to override its executable. Its packer removes intermediate animation frames after producing each strip. It no longer renders cat sprite clips. Use `npm run assets:icons` for the icon family and `npm run branding` for launch artwork from retained branding inputs. Rebuild native clients after changing system launch images or icons.

## Verification

`npm run assets:verify` checks every catalog thumbnail, animation strips, branding, native playback semantics and asset budgets. `npm run test:game` checks all native models/coats, connected skin and bone parenting, real render worklets, navigation, furniture contact, room editing and existing care/game behavior. `npm run test:startup` checks launch artwork and the still-to-native handoff.

`node scripts/3d/review-assets.mjs` regenerates catalog review boards from bundled thumbnails. Cat review uses the actual GLB through `scripts/3d/review-native-cat.py`. Metro excludes editable blends and intermediate render frames.
