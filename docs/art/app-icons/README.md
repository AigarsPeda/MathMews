# Math Mews icons

The app uses 68 original Blender renders with the room's materials, soft edges, and warm lighting. UI symbols use a front-facing orthographic camera so arrows stay horizontal or vertical and status icons remain upright. Furniture and other volumetric objects keep the room's isometric camera. The family covers care, native menus, currency, store categories, editing controls, math topics, and counted puzzle objects. Store and stats art are repackaged from the app's existing Blender renders.

The runtime assets are transparent 256 × 256 PNGs in `assets/icons`. `constants/app-icons.ts` statically registers every file for Metro. Use `AppIcon` for standalone art and `IconText` for translated inline markers. Mathematical text and diagrams remain native text and drawings. Counts, rewards, saved progress, and room behavior remain governed by the existing game logic.

Native iOS menus load the bundled images through `expo-asset` and place local images inside SwiftUI labels. Android uses native Compose dropdowns with `tint={null}` to preserve the PNG colors. The control supplies its localized accessibility label; decorative images do not create extra focus targets.

## Rebuild

Run from the repository root with Blender installed:

```sh
blender --background --python scripts/3d/render_icon_study.py
blender --background --python scripts/3d/render_app_icons.py
npm run assets:icons
node scripts/check-app-icons.mjs
blender --background --python-exit-code 1 --python scripts/3d/check-icon-orientation.py
```

On macOS, Blender's executable may be `/Applications/Blender.app/Contents/MacOS/Blender`.

Both renderers accept a comma-separated `--only` list and preserve the other saved scenes. For example, use `render_icon_study.py -- --only paw,settings` for starter icons and `render_app_icons.py -- --only arrow-left,arrow-right,heart,brain` for extended icons. Camera choices live in `FRONT_ICONS` in `render_icon_study.py`.

Editable sources are `../icon-study/source/starter-icons.blend` and `source/icons.blend`. Each icon has a named scene. `review.png` contains the complete family. Blender sources and review images stay outside the app bundle.

The cat icon uses the companion's shared Blender head, including its plush coat and whiskers. To rebuild that icon while preserving the other saved scenes, run `blender --background --python scripts/3d/render_app_icons.py -- --only cat`, then `npm run assets:icons`.

The verification checks transparent borders, dimensions, the 3 MiB compressed budget, translated inline images, preservation of math notation, and coverage of every illustration marker in both puzzle locales. The Blender orientation check verifies level symbol axes and all four arrow directions in the saved scenes. Native menu tests also check original-color images and disabled/destructive action behavior.
