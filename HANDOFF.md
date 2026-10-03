# Math Mews handoff

Updated: 2026-10-03. Project: `/Users/aigarspeda/Desktop/BrainPet`.

## Goal

Keep the equivalent game working with modern Blender-rendered 3D art: expressive cat reactions, room decorating, puzzles, rewards, pet care, sleep, inventory and saved progress. The user approved the cream dumpling cat and requested a 3× close-up, panning, upright ears, correct item facing, clean branding and simple loading progress.

## Current progress

- Replaced all 288 catalog assets: 15 rooms and 273 placeable beds, toys and decorations. Catalog IDs, prices, ownership and saves remain compatible. Old pixel assets were removed after verification; previous versions remain in Git history.
- Created 313 editable Blender scenes in `/Users/aigarspeda/Desktop/BrainPet-blender-assest`. Runtime assets remain in the repository. Do not move the Blender sources back into the app bundle.
- Rebuilt orange, grey and white cats: 22 clips per coat, 66 clips and 4,356 frames. Ears are now closed, cupped meshes with raised rims and recessed pink interiors.
- Added 1×/2×/3× zoom and clamped horizontal/vertical panning. The user confirmed manual panning works. Editing remains at 1×; camera movement does not change saved item positions.
- Audited all room/item projections and rotation variants. Added “Face other wall” for 75 additional directional items, including the cat portrait. This changes the existing `wallFlipped` save field; players still move the item to the desired position.
- Fixed black app-icon padding with transparent contain padding before compositing onto cream. Native branding uses `assets/images/splash-brand.png`.
- Removed “Drag to explore” and all visible loading asset names, counts and status messages. Loading shows cat, title and one progress bar.
- Changed rendering to prevent whole-cat flashes: a single Canvas survives clip changes, and a shared descriptor retains the last visible image and coordinates until the next texture loads. Gameplay uses a fixed 3× drawing resolution, so zoom only transforms the room. Regression checks pass; visual confirmation remains pending. Natural eye-blink animations remain.
- Added initial safe-area metrics, with a window-frame/zero-inset fallback, so the root provider can render the loading screen immediately instead of waiting with empty children. Native inset updates remain enabled.
- Missing/invalid production RevenueCat configuration now disables purchases without crashing gameplay. Release builds still reject Test Store keys.

Changes are uncommitted. Preserve the user’s current changes and saved game.

## Approved art and reproduction

Reference: `docs/art/cat-approved-concept.png`, also copied into the external Blender library’s `reference/` folder. The concept image guides the model; gameplay uses rendered frames.

- Silhouette: oversized nearly spherical head, squat pear body, no visible neck, short thick paws and rounded haunches. Keep the cream dumpling proportions.
- Face: glossy near-black round eyes with catchlights, curved caramel brows, tiny coral triangular nose, small readable mouth/tongue and large rosy cheeks. Features follow the head curvature.
- Coat: ivory face/chest/belly/paws, apricot crown patches around a tapered cream forehead blaze, three caramel stripes, warm paw marks and a short curved tail with a cream tip. Grey/white variants share geometry and animation.
- Ears: rounded upright triangular shells, convex backs, plump rims and real recessed cups. Roots are head-local `(±0.46, -0.075, 0.435)`, rest pitch `0.14` radians, six outline rings, approximately `0.39` depth and subdivision level 2. Preserve this pitch during ear animation. `sculpted_ear` in `scripts/3d/cat_model.py` is the exact definition.
- Cat palette: ivory `#FFF5E5`, apricot `#EFA45E`, stripes `#B47C50`, cheeks `#F09AAE`, inner ears `#D9798E`, nose `#EA8B7B`, eyes `#201A18`, mouth `#672F30`, tongue `#EC8593`. UI remains cream `#FFF5EB`, coral `#FF6B6B`, teal `#4ECDC4`, gold `#F7B731`; rooms use dusty rose, sage, powder blue and pale wood.
- Materials: smooth matte/velvet surfaces, subtle bump and sheen, glossy eyes. Avoid individual hair strands, heavy texture noise and pixel filtering. Fur roughness `0.78`, sheen `0.20`, noise scale `145`, bump strength `0.08`, distance `0.004`.
- Coordinates: front −Y, up +Z. Head radii `(0.70, 0.55, 0.63)` at `(0, -0.035, 1.10)`; body radii `(0.46, 0.39, 0.45)` at `(0, 0.08, 0.44)`; front paw radii `(0.16, 0.21, 0.20)` at `(±0.23, -0.31, 0.18)`. Cat camera `(3.2, -10, 4.0)` aims at `(0.04, 0, 0.94)`, orthographic scale `2.70`.
- Animation: quick anticipation, readable peak/hold and recovery; squash on hop landings, delayed ears/tail/paws and continuous loop endpoints. Wrong answers use curiosity and encouraging recovery. Resting stays open-eyed; sleep is closed-eyed. Correct lasts 2.5 s, incorrect 2 s, feeding/dance 3 s, idle 4 s, lying down 2 s and settling to sleep 2.5 s. Reverse clips stand/wake the cat.

Scenes use named transform controls and keyframes, not skeletal armatures. Procedural materials are self-contained. The generator overwrites manual scene edits; render hand-edited scenes directly or update the Python builder first.

## Implementation and source map

- External library: `cat.blend`, animation `*.blend`, `items/`, `rooms/`, `reference/`. `BRAINPET_BLENDER_ASSET_DIR` overrides its default path. Back up this folder separately from Git.
- `scripts/3d/cat_model.py`, `render_assets.py`, `clips.json`, `inventory.json`: model, poses, timings and stable asset IDs.
- `scripts/3d/pack.mjs`, `verify.mjs`, `audit_projection.py`, `review-assets.mjs`: packing, checks, camera audit and review boards. Start with `assets/3d/README.md` for regeneration.
- `pet-display/media/sprite/`: UI-thread clock, bounded page loading and stable Canvas. Playback pauses when backgrounded/covered; Reduce Motion holds loops and still completes semantic actions.
- `components/pet/PetStage.tsx`: zoom/panning and room controls. PanResponder captures scene drags; shared values apply transforms without per-frame React state updates.
- `components/ui/ExpoUIHost.tsx`: RNHostView bridges React Native content into Expo UI; GestureHandlerRootView sits inside that bridge.
- `constants/decoration-variants.ts`: facing controls. Existing rotation groups/window styles stay separate from wall mirroring. All placeables use room camera direction `(8, -8, 6.1)`; styles must retain their colours when rotated.
- `components/branding/SplashGate.tsx`, `lib/init-game-asset-prefetch.ts`, `utils/prefetch-game-assets.ts`: real asset progress plus local-save/auth/cloud readiness. Minimum display 1.2 s; after 12 s, local gameplay can continue while pending network/assets finish. Deadlines never fake completed loads.
- `scripts/generate-branding.mjs`: icon/splash generation. Keep transparent contain padding (`#00000000`) to prevent black side bars.
- `docs/art/`: approved concept, expression/key-pose boards, celebration GIF, item review boards, projection audit and texture measurements.

Keep Blender sources and Skia sprites for the fixed camera. Cat cells are 768 px at 24 fps, packed four per 1536×1536 WebP page. The splash uses a smaller 192 px idle sheet. Current cat payload: 89,831,264 bytes across 1,089 pages. One decoded RGBA page is 9 MiB; steady current/next is 18 MiB. A clip handoff can retain one previous page temporarily (27 MiB theoretical), excluding GPU/native caches. Physical-device FPS, battery and Android performance are unmeasured. Live 3D is a future option if free camera rotation/lighting becomes necessary; its compatibility has not been verified here.

## Saved game and purchases

Preserve profile `Ios28`, save `fc4fbe64-9d64-4dc6-a144-ec42cd02afdf`, user `f1c08daf-2037-4a26-a738-36a4b2b72247`. The one-time testing grant of 100,000 coins is complete. Preserve the current balance and progress; do not grant again or restore an old backup.

Cloud sync is local-first whole-save snapshots. It compares `client_updated_at` on initial pull, uploads after a three-second debounce on changes and on backgrounding, and has no live remote subscription. Pet care changes the save periodically. Editing only remote `save.wallet.coins` leaves the running client and timestamp unchanged; a later local upload can overwrite that edit. Sync behavior was not changed.

Development uses RevenueCat Test Store. Real purchases require `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`; do not allow test keys in Release. The provider now catches configuration failure, reports purchases unavailable and waits for successful configuration before Purchases.logIn.

## What worked and verification

- Full asset checks passed: all 288 IDs, 66 clips/4,356 frames, silhouette/cell bounds, motion, reverse standing/waking, loop boundaries and completion behavior. Projection audit passed all 288 scenes; 224 animated item frames passed boundary checks.
- Blender audits passed for 23 cat/model scenes with closed cupped ears and all 22 editable animation scenes with their controls, expressions, timing and materials.
- All 75 added facing controls passed catalog/persistence checks. The portrait was faced both ways and restored. Native icon and simplified loading UI were visually checked; the user confirmed panning.
- TypeScript and targeted ESLint passed for the final renderer, stage, startup and IAP changes. Repository-wide lint has pre-existing failures; do not claim it is clean.
- `node scripts/check-startup-loading.mjs` passed failure counts, unique assets, deadline recovery, continued loading and subscription cleanup.
- `node scripts/check-sprite-continuity.mjs` passed against the actual renderer: stable Canvas, retained frame during delayed clip/page loads and atomic image/coordinate changes.
- Final Release build succeeded: `/tmp/brainpet-refinement-release10.log`. Its binary was installed and hash-checked against `/tmp/brainpet-final-safe-area/MathMews.app`. Native configuration introspection passed. Earlier gameplay checks covered puzzles/rewards, feeding, rest/wake, care recovery, zoom and retained furniture.

## What did not work

- CUA simulator drags behaved like taps; the user’s manual panning confirmation is the valid interaction check.
- Debug/Release build replacements interrupted startup verification. Check the installed binary and use a packaged cold launch; development reloads do not reliably reproduce native splash behavior.
- A brief native blank launch was observed before the final safe-area change. Clearing launch snapshots and explicit storyboard sizing did not resolve it. Temporary native scene/cover experiments were removed. Do not reintroduce them without evidence; final cold-launch verification remains below.
- Rendering in the sandbox lacked graphics access; approved Blender CLI execution worked. Intermediate render frames/Blender files are excluded from Metro to avoid repeated refreshes.

## Next steps

1. Verify the final safe-area startup change on the intended packaged Release binary, then an iPhone: native branding → cat/title/progress bar → game, with no blank gap or stuck overlay. Final post-install observation was interrupted by another build/session; do not mark this check complete.
2. Confirm the user’s intermittent whole-cat flashing is gone during zoom and clip transitions. The rendering fix and regression check pass; distinguish intentional eye blinking from disappearance.
3. Profile the oldest supported iPhone and Android device before making FPS/memory/battery claims. Production coin purchases also need real store configuration.
4. Review/commit the current changes. Keep the external Blender reference notes synchronized with this file.

Environment: Expo 57.0.26, React Native 0.86.3, React 19.2.3, Skia 2.6.2, Reanimated 4.5.1; iOS minimum 16.4 and Xcode 27 scene support. Blender: `/Applications/Blender.app/Contents/MacOS/Blender`. Simulator UI: Device Hub, iPhone 18 Pro/iOS 27, UDID `85A0697F-2C5B-43EC-91BC-77CC3DBCE9D5`; bundle `com.mathmews.app`.

Run from the project root:

```sh
npm run ios
npm run assets:3d -- --only cat --refresh
npm run assets:verify
node scripts/check-startup-loading.mjs
node scripts/check-sprite-continuity.mjs
npx tsc --noEmit
```

Suggested commit: `feat: refine cat assets, zoom and startup rendering`.
