# Automatic startup cat artwork

`startup-cat-native.png` is generated from the shipped orange GLB. The historical filename is retained, but it is no longer a simulator capture. Do not replace it by hand or edit an app screen to generate branding.

## Regeneration

Run `npm run assets:cat-stills` to refresh all cat artwork from the current GLBs. This needs Blender and the project's Node dependencies, not Metro, a simulator, or a device. Set `BLENDER` to override the Blender executable. `npm run assets:cat-stills -- -- --skin=orange` regenerates only the orange coat's outputs. Repeat `--skin=` to select multiple coats.

`scripts/3d/export-native.py` invokes that same renderer after `export_cats` succeeds. An all-coat export refreshes all three shop thumbnails. An orange-only export refreshes its thumbnail and all branding; a grey/white-only export refreshes only those thumbnails and their provenance. No separate branding or thumbnail command is needed after an export. Keep cat exports inside the shared `/tmp/brainpet-cat-export.lock` as usual.

The orange pipeline writes:

- `docs/art/startup-cat-native.png`, a transparent 576 × 576 first-idle-frame portrait.
- `assets/3d/cat-splash.png`, its exact 192 × 192 resize for the JS fallback.
- `assets/images/splash-brand.png` and `splash-launch.png`, including the title and native loading track.
- `assets/3d/cat-preview.png`, the 512 × 512 icon source, and the iOS/Android app-icon images derived from it.
- `assets/3d/cat-shop-orange.png`. Other exported coats produce their corresponding 256 × 256 shop thumbnails.

The renderer updates `scripts/3d/branding-source.json` only after rendering and Node branding generation both succeed. It hashes each selected GLB before rendering and checks it again afterward, so a concurrent model replacement cannot be recorded as a successful refresh. Untouched coats retain their own hashes. Avoid concurrent standalone regeneration and exports; a detected model change requires rerunning `npm run assets:cat-stills` after the export finishes.

`npm run branding` remains the low-level image-composition command. It does not assert that an old portrait belongs to a new GLB or update provenance. The legacy `npm run assets:cat-thumbnails` command also uses the unified renderer. `npm run test:startup` checks required provenance entries, hashes for all three models and all derived stills, the exact portrait resize, native layout, and startup readiness/recovery. A stale or missing entry directs developers to `npm run assets:cat-stills`.

## Calibration

Camera and lighting constants are documented beside `load_idle`, `setup_portrait`, and `tone_map` in `scripts/3d/render-native-branding.py`. The imported `idle` action is evaluated at its first frame, not the importer's last-selected animation. The orthographic camera matches `NativeCatDisplay`: Filament position `[3.2, 4, 10]`, target `[.04, .94, 0]`, and a 2.7-unit square become Blender position `[3.2, -10, 4]` and target `[.04, 0, .94]`. Startup remains a fixed 192-point viewport. Never trim or automatically fit this portrait.

The renderer decodes the actual environment cubemap bundled with `react-native-filament`, uses an unoccluded diffuse environment plus a downward sun, and applies an AP1 ACES-style tone curve rather than Blender's default AgX. Calibration uses world strength `.45`, sun energy `.26`, and exposure `1.3`. These are neutral scene-level settings, not per-coat corrections or captured pixels. They continue to apply when the model, materials or idle pose change. Recalibrate if `NativeCatDisplay`'s camera or Filament's default lighting/color pipeline changes.

On November 15, 2026, calibration against the iPhone 15 first live frame measured matching 289-pixel silhouette widths, height within one pixel, and position within one pixel at 3×. The rebuilt and installed app's recorded last-still/first-live pair measured position changes of 0.67 points on each axis and size changes of 0.34 points or less at the 192-point display size. Mean absolute RGB error over opaque cat pixels was 4.0 on a 0–255 scale; the 95th-percentile channel error was 14. The original direct-render comparison was about 5.4/255.

The portrait is not pixel-identical to Filament. Specular highlights, antialiasing, the diffuse approximation, small tone-map details and native image processing still differ. Two rebuilt-app launch recordings contained no old-design cat frames. One post-install launch also contained a single 15 ms blank portrait frame at the native handoff; the following relaunch did not. This is a readiness/compositor issue separate from stale artwork. Startup preserves its existing readiness gate and timeout behavior; no application screen or startup timer is modified for generation.

## Native launch resources

After regeneration, `npm run preios` copies the updated artwork into the iOS Expo splash catalog and `LaunchImages/MewsLaunch{,@2x,@3x}.png` through the existing launch-image plugin. `npm run preandroid` regenerates the Android splash drawables and launcher icons through Expo. Both commands are also npm lifecycle hooks for `npm run ios` and `npm run android`.

Prebuild updates source resources, not an installed binary. Rebuild and reinstall the iOS and Android apps for OS-level launch artwork and app icons to change. Metro reloads or OTA JavaScript updates can update the JS fallback and GLB, but cannot replace launch images compiled into an already installed app. Release the GLBs, fallback artwork and rebuilt native app together to avoid a mixed-generation launch. Android's system splash constraints can affect placement independently of the JS viewport.
