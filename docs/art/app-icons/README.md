# Math Mews icons

The app uses 87 original Blender renders with the room's materials, soft edges, and warm lighting. UI symbols use a front-facing orthographic camera so arrows stay horizontal or vertical and status icons remain upright. Furniture and other volumetric objects keep the room's isometric camera. The family covers care, native menus, currency, store categories, editing controls, math topics, and counted puzzle objects. Store and stats art are repackaged from the app's existing Blender renders.

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

The life heart uses a closed, smoothly shaded mesh with rounded front and back faces in `render_app_icons.py`. Its `heart` scene is saved in `source/icons.blend`; the render is copied to `assets/icons/heart.png` by the icon packaging step. To rebuild only the heart, run `blender --background --python scripts/3d/render_app_icons.py -- --only heart`, then `npm run assets:icons` and the verification commands above.

The cat icon uses the companion's shared Blender head, including its plush coat and whiskers. To rebuild that icon while preserving the other saved scenes, run `blender --background --python scripts/3d/render_app_icons.py -- --only cat`, then `npm run assets:icons`.

The verification checks transparent borders, dimensions, the 3 MiB compressed budget, translated inline images, preservation of math notation, and coverage of every illustration marker in both puzzle locales. The Blender orientation check verifies level symbol axes and all four arrow directions in the saved scenes. Native menu tests also check original-color images and disabled/destructive action behavior.

The timed challenge uses `challenge-timer`, a lavender stopwatch with gold controls. Boss missions use `boss-badge`, a gold crown above a teal paw shield. Both are front-facing scenes in `source/icons.blend`, authored in `render_app_icons.py`, and registered in `constants/app-icons.ts`. Rebuild with `render_app_icons.py -- --only challenge-timer,boss-badge`, then `npm run assets:icons`. Their runtime PNGs use palette compression to keep the full icon family below the existing 3 MiB budget; full-color source renders remain here. The saved-source orientation audit covers 55 upright UI symbols.


The topic lesson list uses `practice-book`, a rounded workbook with four raised exercise tiles, and `lesson-medal`, a gold completion medal with a teal check and ribbons. Both are front-facing Blender scenes in `source/icons.blend`. Rebuild only these icons with `render_app_icons.py -- --only practice-book,lesson-medal`, then run `npm run assets:icons`, `node scripts/check-app-icons.mjs`, and the saved-source orientation audit. Runtime PNGs use palette compression. The existing stopwatch and crowned paw shield identify the challenge and boss columns.

The clock's Morning choice uses `weather-sunrise`, a golden half sun with raised rays, a teal horizon and an upward arrow. Evening uses `weather-sunset`, a lower orange sun, coral side rays, a lavender horizon and a downward arrow. Shape and direction distinguish them as well as color. Both are editable front-facing Blender scenes in `source/icons.blend`, created by `horizon_sun` in `render_app_icons.py`. Rebuild with `render_app_icons.py -- --only weather-sunrise,weather-sunset`, then `npm run assets:icons`. Palette compression keeps the complete icon family within its 3 MiB budget. The same icons appear in the home clock tile and expanded clock reading when their period is active.

Clock speeds use three distinct Blender scenes: `clock-real-time`, a standing teal clock; `clock-fast`, a teal speedometer with a coral needle; and `clock-very-fast`, a coral rocket with a gold flame. Rebuild with `render_app_icons.py -- --only clock-real-time,clock-fast,clock-very-fast`, then `npm run assets:icons`. Full-color renders and editable scenes stay in this art directory. Runtime assets use palette compression and share a 44 × 36-point slot in the clock menu. All three speed icons use a 36-point canvas. Selected checkmarks and the existing clock-speed behavior remain unchanged.

Fast uses a broad speedometer housing, a cream face, raised gold rim, five graduations, a coral fast sector and one bold needle. Its compact gauge silhouette replaces the rabbit concept.
