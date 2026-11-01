# Math Mews education props

Nine original Blender models based on the approved rounded, brightly colored concept. No loose cubes, beads, wedges, characters or scene platforms. The book, pencil and set square are independent models. The book stack has four covers in Berry, sunshine, mint and violet.

- `*.blend`: individual editable source scenes, with named model parts and a preview camera/light rig.
- `models/*.glb`: geometry and PBR materials only, with one named placement root per model. No camera, lights or external textures. Y-up; origin at the horizontal bounds center and floor height zero.
- `renders/*.png`: transparent 512-pixel Blender renders.
- `catalog.json`: stable asset identities, model bounds, floor footprints and triangle counts. This is an art manifest, not the purchasable-item catalog.
- `../../assets/3d/education-props/*.webp`: 384-pixel transparent previews retained for future decoration work.
- `../../docs/art/education-props/collection.png`: contact sheet of the actual rendered geometry.

Rebuild from the project root:

```sh
npm run assets:education-props
npm run test:education-props
```

A single source can be rebuilt with Blender's `-- --only book-stack` argument, followed by `node scripts/3d/pack-education-props.mjs`. The generator uses the bundled Nunito font for numerals and converts text to geometry for export. All materials use the puzzle palette, with supplementary paper, wood and metal colors.

## Trail use

The trail now uses subtle geometric outlines instead of these glossy props. The models and previews are retained for future room/shop use; they are not displayed beside level tiles.

## Later room/shop use

The GLBs and Blender sources can be reused for corner or floor decorations. They are not currently listed for sale, registered with the wallet service, or included in the native room model registry. Room integration still needs a chosen display scale, placement/collision configuration, shop thumbnails and localized copy, and server-authoritative prices/catalog entries. Verify contact, rotation and material appearance in the native room before shipping those listings. The preview lighting is intentionally separate from the geometry so the room can light each object naturally.
