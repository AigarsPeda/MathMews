# Difficulty trail collections

As of 2026-11-02, the level tracks display no decorations. These sources and exports are retained for future use; the path no longer loads them.

Sixty editable Blender scenes recreate the three approved concept sheets. Each difficulty has twenty independent props. These are decorative trail images; they do not replace lesson controls, alter rewards, or become room inventory.

The exact approved sheets are preserved in `references/`. The IDs below match their positions, read left to right and top to bottom. Easy uses the supplied `exec-56f9d753` sheet, including its front-facing arithmetic symbols.

| ID | Easy · wool, felt and classroom | Medium · making and exploration | Hard · science and engineering |
| --- | --- | --- | --- |
| 01 | Lavender yarn | Graph notebook and pencil | Microscope |
| 02 | Curled sleeping cat | Set square and protractor | Drafting compass |
| 03 | Felt mouse | Tangram cat | Calculator |
| 04 | Stitched fish | Stopwatch | Geometric solids |
| 05 | Stitched paw patch | Globe | Orrery |
| 06 | Cloth books | Binoculars | Molecular model |
| 07 | Arithmetic blocks | Compass and map | Circuit board |
| 08 | Wooden abacus | Balance and weights | Glass prism |
| 09 | Colored pencils | Interlocking puzzle cube | Caliper |
| 10 | Linen pencil roll | Wooden glider | Sundial |
| 11 | Ruler and eraser | Telescope | Truss bridge |
| 12 | Chalk slate | Lavender camera | Wooden gears |
| 13 | Cat satchel | Terrarium | Möbius model |
| 14 | Fraction pieces | Watercolor box | Wire cat sculpture |
| 15 | Stacking rings | Origami crane | Star chart and divider |
| 16 | Felt flowers | Dominoes | Architectural model |
| 17 | Stitched stars | Chess pieces | Sliding shape puzzle |
| 18 | Wool counting tray | Metronome | Robot rover |
| 19 | Kitten reading | Magnifier and specimen | Hourglass |
| 20 | Wicker toy basket | Canvas puzzle pouch | Coordinate string board |

## Sources and exports

- `easy/e01.blend` … `easy/e20.blend`, and equivalent `medium/mNN` and `hard/hNN` scenes contain actual editable meshes and curves, procedural materials, a camera and studio lights. They do not use a reference sheet as a model-facing image plane.
- Each `renders/` directory contains 640 × 640 transparent PNGs. Soft offset/contact shadows are included in their alpha; no rectangular background is baked into the sprite.
- `assets/3d/trail-collections/` contains the app's 384 × 384 WebP exports. The generated `constants/trail-collection-images.ts` gives Metro static asset references.
- `manifest.json` records all sixty IDs, builder names, mesh counts and packed byte sizes.
- `scripts/3d/trail_collections/` contains the editable geometry builders. Wool has modelled loose fibres; fabric uses a procedural weave; wood uses directional grain. Low specularity and broad lighting keep them matte.

## Rebuild

From the repository root:

```sh
npm run assets:trail-collections
```

The command runs Blender for all three collections, packs the sprites, builds comparison sheets and validates the results. It uses `BLENDER_BIN`, a `blender` executable on PATH, or `/Applications/Blender.app/Contents/MacOS/Blender`.

To change selected models:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 3 --python-exit-code 1 \
  --python scripts/3d/build-trail-collections.py -- --collection medium --only 3 9
node scripts/3d/pack-trail-collections.mjs
npm run review:trail-collections
npm run test:trail-collections
```

`--samples` controls Cycles samples (default 48). `--resume` skips existing renders and is only for interrupted runs, not geometry/material revisions.

## Track assignment and review

`utils/topic-path-layout.ts` assigns five props to each of the eighteen actual difficulty/topic tracks. Every collection member appears in a real ten-level layout. Longer tracks draw from the remaining assets without repeating a prop. Both topic and difficulty invalidate the scenery memo. Decorations remain outside tile hit areas and the current lesson caption; Reduce Motion disables their small scroll drift.

The review sheets in `docs/qa/trail-collections/2026-11-01/` put the approved images beside the Blender renders. The comparison pass corrected framing, the tangram silhouette, interlocking cube geometry, glass transparency, cat poses, cloth/wool surfaces, arithmetic and puzzle symbols, and the basket weave. These are authored interpretations of the concept illustrations: small construction details and lighting are not pixel-identical.

The native verification uses the real puzzle screen with an isolated in-memory save, tours all eighteen tracks, checks current/locked levels, narrow Latvian, the finish marker and replay into a puzzle. Generated images are reviewed separately so all sixty receive visual inspection even when only a few are visible in a phone viewport. The validation record lists the checks actually completed and their limits.
