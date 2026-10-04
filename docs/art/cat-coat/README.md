# Plush cat coat

The shared cat model uses a matte, directional short-fur grain on every coat surface, including the cheeks, inner ears, ivory limbs, and muzzle. Glossy eyes, the nose, mouth, and whiskers retain their existing materials. Texture coordinates come from the local object surface, so the grain moves with the head and body rather than sliding across them as the camera or cat turns.

Furred spheres use denser geometry to remove the polygon shading visible on the jaw and body. The animation controls, proportions, shape keys, camera, and timings remain the same. All three coats and all 35 animation families are rebuilt from this model, including the separate toy occlusion layers.

`comparison.png` shows the old and new surfaces at the same scale. The eight expression renders and editable review scenes are in `../cat-faces`. The app's cat icon now uses the same model's head. Store portraits, the startup idle sheet, launch images, and platform app icons are regenerated from the new renders.

Gameplay pages use WebP quality 83 with alpha quality 100. This keeps the visible grain and whisker edges while preserving the existing page sizes and mobile texture budget.

The completed rebuild refreshed all 1,500 gameplay pages plus 84 toy pages. The packed set measures 112.35 MiB, below the existing 120 MiB limit, and decoded pages remain at most 9 MiB. The idle and petting surfaces were checked in the native iPhone app at 3× zoom. Both native projects were regenerated with the new icon and launch artwork; those system images take effect in the next native build.

## Rebuild

```sh
blender --background --python-exit-code 1 --python scripts/3d/render_assets.py -- --only cat --refresh
blender --background --python-exit-code 1 --python scripts/3d/render_assets.py -- --only preview
blender --background --python-exit-code 1 --python scripts/3d/render_cat_faces.py
blender --background --python-exit-code 1 --python scripts/3d/render_app_icons.py -- --only cat
node scripts/3d/pack.mjs
node scripts/generate-branding.mjs
node scripts/3d/review-cat-faces.mjs
npm run assets:icons
```

Use the face, care, play, and room-motion Blender checks plus `npm run assets:verify`, `npm run test:game`, and `npm run test:startup` to validate a rebuild.
