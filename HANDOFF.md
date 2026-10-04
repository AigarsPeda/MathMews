# Math Mews handoff

Updated: 2026-10-04. Project: `/Users/aigarspeda/Desktop/BrainPet`.

## Goal and user decisions

Build a native iOS/Android math game with an expressive Blender-rendered companion, room decorating, puzzles, rewards, pet care, sleep, inventory, and saved progress.

- The app will not be used on the web. Use native menus wherever practical.
- Keep the approved cream dumpling cat, pastel room style, upright cupped ears, and 1×/2×/3× zoom with panning.
- Use the app's original colorful Blender icons across the interface and native menus.
- All four Play activities are free, including at zero coins and 100% happiness.
- Facial expressions, whiskers, and plush surfaces must match across all coats and animations.
- Keep the room visible. Casual speech is brief; loading shows the cat, title, and one honest progress bar.

## Start here

The working tree contains many uncommitted code and generated-art changes. Inspect its current diff before editing; preserve work from other chats. Do not assume an older Release package contains the current source or artwork.

Protect the existing game: profile `Ios28`, save `fc4fbe64-9d64-4dc6-a144-ec42cd02afdf`, user `f1c08daf-2037-4a26-a738-36a4b2b72247`. A one-time 100,000-coin test grant was already applied. Preserve the live balance, progress, placement, and inventory; do not repeat the grant or restore a historical balance. The last observation in this chat was 99,592 coins, not a target balance.

The previous handoff is preserved in [the historical archive](docs/handoff/2026-10-04-before-organization.md). It contains detailed geometry notes, older build logs, recordings, and hash reports. Those reports are historical, and temporary paths may have expired.

## Current progress

### Native controls and icons

Play, Cat actions, and room-item menus share `NativeActionMenu`. iOS uses SwiftUI `Host`/`Menu`; Android uses Compose `DropdownMenu`. Measure the React Native trigger wrapper with `onLayout` and supply explicit dimensions. Preserve disabled/destructive behavior, accessibility labels, and furniture drag responders.

The family contains 68 transparent 256×256 PNG icons. iOS loads local bundled raster images into SwiftUI labels; Android uses `tint={null}` to preserve color. Use `AppIcon` for standalone images and `IconText` for translated inline markers. Keep math notation and diagrams as native text/drawings. The cat icon uses the shared production cat head.

See [icon documentation and rebuild instructions](docs/art/app-icons/README.md) and [the family review](docs/art/app-icons/review.png).

### Cat art and animation

All three coats share the same geometry and facial rig. Six tapered whiskers follow the head; expressions include a content smile, happy crescent eyes, sleepy lids, curiosity, surprise, and gentle disappointment with encouraging recovery. Existing mouth, tongue, brows, tears, and eye highlights remain.

The shared plush material covers coat, ivory limbs/muzzle, cheeks, and inner ears. It uses local Generated coordinates, directional noise, roughness `0.90`, sheen `0.40`, noise scale `130`, bump strength `0.38`, and distance `0.012`. Furred spheres use denser geometry to remove visible faceting. Eyes remain glossy. Preserve proportions, animation controls, camera framing, and timing.

Current source/asset counts checked during this organization:

| Item | Current count |
| --- | ---: |
| Cat animation families per coat | 35 |
| Clips across orange, grey, and white | 105 |
| Cat frames across all coats | 6,336 |
| Cat WebP pages | 1,500 |
| Separate play-prop WebP pages | 84 |
| Combined compressed cat/prop pages | 112.35 MiB |
| Largest decoded RGBA page | 9 MiB |
| Catalog assets | 288: 15 rooms and 273 placeables |

Cat pages use WebP quality `83`, alpha quality `100`. The combined compressed limit is 120 MiB. Standard cells are 768 px, four per 1536×1536 page. Room movement uses 384 px cells, twelve per 1536×1152 page. Each active layer retains current/next pages; this is not a measured total app-memory budget.

The bowl and box slide through the left sprite edge. Feeding is four seconds; `box1 → box2 → box3` lasts 7.5 seconds with matching hidden joins. Ball toss and Feather chase last five seconds; Yarn roll lasts four. Actions recover to the normal sitting pose. Reverse wake/stand clips run at 72 fps, about 0.83/0.67 seconds; forward sleep/rest retains 24 fps.

The room supports standing walk views, sofa jumping/sitting/sleeping, toy interactions, interruption/return-home handling, and queued commands during jumps. Room props have separate synchronized layers. Camera movement preserves saved placement; editing stays at 1×. The shop waits for the active cat to return before navigating.

See [facial rig](docs/art/cat-faces/README.md), [plush coat](docs/art/cat-coat/README.md), [expression review](docs/art/cat-faces/review.png), and [coat comparison](docs/art/cat-coat/comparison.png). Care/play GIFs for all coats and walk/sofa GIFs are in `docs/art/`.

### Speech and rendering

`usePetSpeech` shows contextual reminders for 3.5 seconds and action responses for 2.8 seconds by default. Action feedback takes priority; its expiry does not restore the reminder. Timers clear when Home loses focus, and returning uses the latest context.

The bubble has a 170 pt scaled maximum width, reduced padding, and a brief opacity fade that respects Reduce Motion. Text stays at native screen size in a viewport overlay. The projected tail follows the cat during zoom, panning, and dragging; measured height accommodates wrapped text. Speech does not intercept room touches and is hidden during room activities/decorating.

Sprite rendering keeps one Canvas through clip changes and retains the last visible texture/coordinates until the next page is ready. Playback pauses while backgrounded/covered; Reduce Motion holds loops while still completing semantic actions. User confirmation of intermittent whole-cat flashing remains pending; intentional eye blinks are separate.

### Startup, branding, and purchases

`with-ios-launch-image` must stay before `expo-splash-screen` in the plugin list because Info.plist mods execute in reverse order. iOS system launch uses ordinary bundled `MewsLaunch{,@2x,@3x}.png` files with `UILaunchScreen`; Expo's storyboard supplies the React-root cover. Both use the same 320 pt launch artwork containing the 240 pt brand and loading track.

React startup uses a 240×240 pt branding image and a 192×192 pt portrait, with explicit dimensions and clipping. The portrait matches the first orange idle cell and stays until the Canvas is ready. Initial safe-area metrics permit immediate rendering. Loading reflects actual asset/local-save/auth/cloud readiness; after a timeout, local gameplay can continue without pretending pending work completed.

Plush artwork, portraits, splash sheets, and branding have been regenerated. Both native projects were prebuilt with the new artwork. Native app icons and system launch images require the next native build/install to take effect; gameplay artwork was checked through the development app.

Missing/invalid RevenueCat configuration disables purchases without crashing gameplay. Development uses Test Store; production needs real iOS/Android API keys and must reject Test Store keys in Release.

Cloud sync is local-first whole-save snapshots, with timestamp comparison on initial pull, a three-second upload debounce, and background upload. There is no live remote subscription. Editing only the remote wallet can be overwritten by a later local snapshot. Preserve the current save rather than editing remote balances for UI tests.

## Implementation map

| Area | Primary files |
| --- | --- |
| Home/care/free play | `app/index.tsx`, `constants/cat-play.ts`, `components/home/PlayMenuButton.tsx` |
| Native menu adapters | `components/ui/NativeActionMenu.ios.tsx`, `NativeActionMenu.tsx`, `NativeActionMenu.types.ts` |
| Shared icon system | `components/ui/AppIcon.tsx`, `IconText.tsx`, `constants/app-icons.ts`, `inline-icons.ts`, `assets/icons/` |
| Room controls/motion | `components/pet/PetStage.tsx`, `hooks/use-room-activity.ts`, `use-room-editor.ts`, `utils/room-activities.ts`, `constants/cat-room-motion.ts` |
| Speech | `hooks/use-pet-speech.ts`, `utils/pet-speech.ts`, `components/pet/PetSpeechBubble.tsx` |
| Display engine/sprites | `pet-display/engine/`, `pet-display/media/sprite/` |
| Blender generation | `scripts/3d/cat_model.py`, `render_assets.py`, `clips.json`, `inventory.json` |
| Packing/branding | `scripts/3d/pack.mjs`, `scripts/generate-branding.mjs` |
| Startup | `plugins/with-ios-launch-image.js`, `components/branding/SplashGate.tsx`, `lib/init-game-asset-prefetch.ts`, `utils/prefetch-game-assets.ts` |
| Save synchronization | `hooks/use-cloud-save-sync.ts`, `services/cloud-save/` |
| Operation-path puzzle | `components/puzzle/OperationPathTask.tsx`, `scripts/check-operation-path.mjs` |

Production editable Blender scenes live in `/Users/aigarspeda/Desktop/BrainPet-blender-assest`, outside the runtime bundle. `BRAINPET_BLENDER_ASSET_DIR` overrides that location. Back up the library separately from Git. Editable icon/face review scenes also live under `docs/art/*/source/`; they are not runtime assets.

The Python generator recreates scenes and overwrites manual changes. Update the builder first, or render hand-edited `.blend` scenes directly. Runtime PNG/WebP assets stay in this repository; Metro excludes source scenes and intermediate render frames.

## What worked and verification

Latest completed checks in this chat on 2026-10-04:

- `npm run test:game`, `npm run typecheck`, and repository-wide `npm run lint` passed after the speech change. Older lint-failure statements in the archive are superseded by this result.
- Game checks cover puzzles/rewards, save/care behavior, page loading and continuity, room activities/depth/decorating, native menus, icons, free play, speech anchoring/timers, and texture budgets. Operation-path checks cover visible/editable choices, dependent results, and explicit submission.
- The preceding art rebuild passed full asset verification, startup checks, and Blender face/care/play/room-motion checks, including saved facial/care scenes. These were not rerun solely for this documentation edit.
- Native iPhone simulator checks covered happy petting, neutral/sleeping expressions, plush idle/petting at 3×, and compact petting speech disappearing without the reminder returning.
- An earlier packaged Release cold-launch recording showed continuous native/loading branding after the launch-image fix. The newly regenerated native artwork still needs build/install verification; physical-iPhone cold launch remains outstanding.

Successful practices: use the shared Blender model for every coat/clip; inspect actual packed pages in preview GIFs; test action/navigation behavior with deterministic clocks; measure native trigger wrappers; retain the last sprite frame during decoding; use packaged cold launches to assess system splash behavior.

## What did not work

- Asset-catalog-only launch images left a cream-only system snapshot. Use ordinary bundled PNGs with valid Xcode copy-phase references and `isBuildFile: true`. Removed custom early-window/storyboard-scene experiments did not solve the gap; keep normal `EXExpoAppSceneDelegate` behavior.
- Intrinsic sizing shrank native menu triggers and left accessibility labels empty. Keep explicit measured dimensions. Earlier community-menu implementations have been replaced by the current SwiftUI/Compose adapters.
- Speech inside the scaled scene became blurry and misplaced at 3×. Keep the screen-size overlay; zero-size wrappers also hid accessibility bounds.
- A permanent contextual fallback brought the reminder back after action speech. Keep the current timed lifecycle and action priority.
- Tail curves need keyed point coordinates and both Bezier handles; stale AUTO handles broke saved playback. Animated custom controls such as `box_activity` must start as floats, not integers.
- Automated simulator drags sometimes behaved as taps. The user's manual panning confirmation is the interaction evidence; deterministic tests cover transform math.
- Development reloads and mixed Debug/Release installs did not reliably reproduce system splash behavior. Verify the actual installed packaged build for cold-launch claims.
- Sandboxed Blender rendering lacked graphics access. Approved Blender CLI execution worked; keep source scenes/intermediate frames out of Metro.

## Next steps

1. Build/install current native artwork and check cold launch on a physical iPhone. Recheck after platform upgrades. Test Android native menus and artwork on a device; do not infer device results from source-level checks.
2. Get user confirmation that whole-cat flashing is gone during zoom and clip transitions.
3. Profile the oldest supported iPhone and Android hardware before claiming FPS, memory, or battery performance. Configure real store purchases before release.
4. Review the current shared diff and split work into coherent commits when requested. Do not use the archive's old Play-only commit suggestion for the whole current diff.
5. Synchronize external Blender reference notes and older general asset documentation when extending that work. `assets/3d/README.md` still contains historical clip/page/material descriptions; use `clips.json`, the current model/packer, and the focused art READMEs for current values.

## Commands and environment

Run checks from the project root:

```sh
npm run test:game
npm run test:startup
npm run typecheck
npm run lint
npm run assets:verify
```

Regeneration is only needed after art changes. The cat rebuild packs assets, generates branding, and verifies the collection:

```sh
npm run assets:3d -- --only cat --refresh
npm run assets:icons
```

For expressions/icons and their selective rebuilds, use the focused documentation linked above. A shared coat/face change must regenerate every coat/clip plus portraits, splash, the cat icon, and branding. Rebuild native projects afterward for system artwork. Geometry checks are in `scripts/3d/check-cat-{faces,care-actions,play,box-containment,leg-connections}.py` and `check-room-cat-motion.py`; saved-scene checks use `-- --baked` where supported.

Environment: Expo 57.0.26, React Native 0.86.3, React 19.2.3, Skia 2.6.2, Reanimated 4.5.1; iOS minimum 16.4 with scene support. App ID: `com.mathmews.app`. Blender executable: `/Applications/Blender.app/Contents/MacOS/Blender`. Native UI checks used Device Hub with iPhone 18 Pro / iOS 27 Simulator. `npm run ios` runs prebuild before launching the iOS app.
