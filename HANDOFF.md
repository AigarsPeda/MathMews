# Math Mews handoff

Updated: 2026-10-06. Project: `/Users/aigarspeda/Desktop/BrainPet`.

## Goal and user decisions

Build a native iOS/Android math game with an expressive rigged 3D companion, room decorating, puzzles, rewards, pet care, sleep, inventory, and saved progress.

Latest fixes: startup portraits and native launch images now render from the shipped orange GLB using `render-native-branding.py`. Cat exports also regenerate branding; `branding-source.json` and startup checks reject stale portraits. `use-room-camera.ts` provides continuous focal-point pinch zoom from 1× to 3× and bounded panning. The zoom/reset button has been removed; pinch inward to return to 1×. Menus remain enabled when zoomed. Native iOS taps opened the sofa options at 1.4× and 2.36×. The user confirmed one-finger panning works after pinching. The screenshot is `docs/art/native-cat-rebuild/ios-pinch-object-menu.png`.

The sofa tail solver now refines clearing angles continuously and follows a local solution when the anchored root cannot clear a collider. It avoids exhaustive per-frame searches and switching axes. Narrow sofas seat the fixed-size cat along the cushion to clear the idle tail attachment. A 1,200-frame shipped-skeleton check covers five sofa sizes, requires no blocked idle contacts and limits consecutive tip movement below .02 units. Other full-body poses remain authored; tail rotation alone cannot always free a root enclosed by furniture. The actor memoizes joints by the native asset handle and retains its worklet across UI renders. Room callbacks and collider centers are stable, and the room scene is memoized.

Validation on 2026-10-06: game/startup checks, TypeScript, lint, asset coverage, both Hermes exports and both native debug builds pass. iOS cold launch displayed the current GLB portrait, and the final sofa sitting pose is captured in `docs/art/native-cat-rebuild/ios-sofa-continuity.png`. Native Android interactions and physical-device performance remain unverified.

The user does not want to pay for a cat model. The cat is now original Blender geometry from `original_cat.py`, with a fused sealed body, rounded head/paws, short neck, triangular ears and an upright hooked tail. Its anatomical rest skeleton and normalized skin weights are generated in the same rest pose. `game_cat.py` adds expressions, coat textures and all 36 game actions. Belly weights are restricted away from the leg regions; elbows use stable backward poles and rear knees use forward poles. The collar is painted on the deforming skin so it cannot float away in seated poses. The editable result is `prototypes/cat-model/cat-orange.blend`. The downloaded J-Toastie source and its study script are superseded.

- The app will not be used on the web. Use native menus wherever practical.
- Follow the latest compact cartoon cat proportions, game coat colors, pastel room style, upright cupped ears, and continuous 1×–3× pinch zoom with panning. Real-cat reference photos guide torso anatomy.
- Use the app's original colorful Blender icons across the interface and native menus.
- All four Play activities are free, including at zero coins and 100% happiness.
- Facial expressions, whiskers, and plush surfaces must match across all coats and animations.
- Keep the room visible. Casual speech is brief; loading shows the cat, title, and one honest progress bar.

Current original cat update on 2026-10-06: all three coats now use an original 32,182-vertex connected surface and 36 clips. Final game/startup checks, TypeScript, lint and asset verification pass. The actual orange GLB passed five deformation samples for every clip, and a full walk was rendered to `docs/art/native-cat-rebuild/original-walk.gif`. New regressions verify stable anatomical elbow/knee poles through walking and sitting, in addition to distance-matched planted paws and 1,200 consecutive sofa-tail frames. Native iOS walked the original cat to the sofa and held its seated pose; see `ios-original-sofa.png`. The furniture avoidance radius now covers the wider head. Current media is 74.2 MiB; native GLBs are 40.1 MiB. Android interaction and real-device performance remain unverified.

The cartoon references came from [Anko3d's cat/dog pack](https://www.turbosquid.com/3d-models/3d-model-cute-cartoon-dog-cat-1351428). Use the renders only as visual proportion references. The user explicitly rejected buying models, and the current mesh was built independently in Blender. No paid asset or downloaded mesh is needed. Keep the native engine and existing room interactions; further art refinement should use the editable original rig.

## Start here

The native Filament migration, connected cat rebuild and cleanup are present in the working tree and have not been committed. Do not discard uncommitted changes. The last pre-migration art commit was `de929a8`; its sprite pipeline is superseded. Read [native engine notes](docs/native-room-engine.md) and [asset instructions](assets/3d/README.md) for the current architecture.

Protect the existing game: profile `Ios28`, save `fc4fbe64-9d64-4dc6-a144-ec42cd02afdf`, user `f1c08daf-2037-4a26-a738-36a4b2b72247`. A one-time 100,000-coin test grant was already applied. Preserve the live balance, progress, placement, and inventory; do not repeat the grant or restore a historical balance. The last observation in this chat was 99,592 coins, not a target balance.

The previous handoff is preserved in [the historical archive](docs/handoff/2026-10-04-before-organization.md). It contains detailed geometry notes, older build logs, recordings, and hash reports. Those reports are historical, and temporary paths may have expired.

## Current progress

### Native controls and icons

Play, Cat actions, and room-item menus share `NativeActionMenu`. iOS uses SwiftUI `Host`/`Menu`; Android uses Compose `DropdownMenu`. Measure the React Native trigger wrapper with `onLayout` and supply explicit dimensions. Preserve disabled/destructive behavior, accessibility labels, and furniture drag responders.

The family contains 68 transparent 256×256 PNG icons. iOS loads local bundled raster images into SwiftUI labels; Android uses `tint={null}` to preserve color. Use `AppIcon` for standalone images and `IconText` for translated inline markers. Keep math notation and diagrams as native text/drawings. The cat icon uses the shared production cat head.

See [icon documentation and rebuild instructions](docs/art/app-icons/README.md) and [the family review](docs/art/app-icons/review.png).

### Cat art and animation

All three coats use the same original connected surface and 36 clips. The cat has a large rounded head, short neck, compact torso and thicker legs. Normal idle preserves its standing shape; sofa resting uses the separate `sit` clip. Preserve action meanings and facial expressions. Native GLB skin padding must point zero-weight slots at a valid influencing joint: pointing them at a hidden zero-scale prop caused black shading in Filament. Current review renders are in `docs/art/native-cat-rebuild/`.

Filament renders the full cat world. Bullet handles movable toys; the cat navigates around furniture, approaches seats and waits for landing before queued actions. Its size stays constant with an orthographic camera, and walk cadence follows distance. Doors remain closed, stationary and aligned to their wall. React Native retains accessible menus, controls, store/editor UI and the save format. Sofa physics now uses 13 source-mesh boxes, and `native-cat-contact.ts` adjusts the four-joint tail plus its end marker against those shapes before skinning. It preserves bone lengths and works with Reduce Motion. The centered seat anchor and sideways orientation keep the tail base in the open cushion space. This does not add whole-body ragdoll or per-vertex collision for other limbs.

The native catalog contains 292 GLBs (288 inventory items, three cats, airflow), totaling 40.1 MiB under a 60 MiB limit. All game media totals 74.2 MiB under a 100 MiB limit. Static catalog images and 26 small animated strips remain for UI thumbnails; supported dog videos and branding inputs remain. Cleanup removed obsolete cat sprite pages, separate raster play props, the early native animation lab and prototype assets, unused graphics/videos, and superseded sprite review files, freeing about 2.7 GB.

`catModelRegistry` is skin-independent; native displays choose the coat model separately. `clips.json` supplies authored timing to the registry and renderer. `useAnimationActivity` shares focus, background and Reduce Motion policy; `useSpriteClock` now only advances animated UI thumbnails. Thumbnail packing deletes intermediate frames after successful output.

Feeding lasts four seconds; `box1 → box2 → box3` lasts 7.5 seconds. Ball toss and Feather chase last five seconds, Yarn roll four. Wake/stand reuses authored clips in reverse at 3× speed. Preserve existing care, free-play, interruption, return-home and wallet behavior. The shop waits for the cat to return before navigating.

### Speech and rendering

`usePetSpeech` shows contextual reminders for 3.5 seconds and action responses for 2.8 seconds by default. Action feedback takes priority; its expiry does not restore the reminder. Timers clear when Home loses focus, and returning uses the latest context.

The bubble has a 170 pt scaled maximum width, reduced padding, and a brief opacity fade that respects Reduce Motion. Text stays at native screen size in a viewport overlay. The projected tail follows the cat during zoom, panning, and dragging; measured height accommodates wrapped text. Speech does not intercept room touches and is hidden during room activities/decorating.

Native models keep their scene and animator through clip changes. Playback pauses while backgrounded/covered; Reduce Motion holds loops while still completing semantic actions. The old sprite page-loading implementation is removed.

### Startup, branding, and purchases

`with-ios-launch-image` must stay before `expo-splash-screen` in the plugin list because Info.plist mods execute in reverse order. iOS system launch uses ordinary bundled `MewsLaunch{,@2x,@3x}.png` files with `UILaunchScreen`; Expo's storyboard supplies the React-root cover. Both use the same 320 pt launch artwork containing the 240 pt brand and loading track.

React startup uses a 240×240 pt branding image and a 192×192 pt portrait, with explicit dimensions and clipping. The retained still portrait stays until the native cat reports readiness. Initial safe-area metrics permit immediate rendering. Loading reflects actual asset/local-save/auth/cloud readiness; after a timeout, local gameplay can continue without pretending pending work completed.

The patched iOS and Android clients built on 2026-10-05. Rebuild/reinstall when native dependencies, system app icons or launch artwork change; JavaScript cleanup uses the existing development client.

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
| Display engine and native playback | `pet-display/engine/`, `pet-display/registry/cat-model-registry.ts`, `components/pet/native/` |
| Native world and shared playback policy | `utils/native-room-world.ts`, `hooks/use-animation-activity.ts` |
| Blender generation | `scripts/3d/export-native.py`, `game_cat.py`, `original_cat.py`, `render_assets.py`, `clips.json` |
| Packing/branding | `scripts/3d/pack.mjs`, `scripts/generate-branding.mjs` |
| Startup | `plugins/with-ios-launch-image.js`, `components/branding/SplashGate.tsx`, `lib/init-game-asset-prefetch.ts`, `utils/prefetch-game-assets.ts` |
| Save synchronization | `hooks/use-cloud-save-sync.ts`, `services/cloud-save/` |
| Operation-path puzzle | `components/puzzle/OperationPathTask.tsx`, `scripts/check-operation-path.mjs` |

Production editable Blender scenes live in `/Users/aigarspeda/Desktop/BrainPet-blender-assest`, outside the runtime bundle. `BRAINPET_BLENDER_ASSET_DIR` overrides that location. Back up the library separately from Git. Editable icon review scenes remain under `docs/art/*/source/`; they are not runtime assets.

The Python generator recreates scenes and overwrites manual changes. Update the builder first, or render hand-edited `.blend` scenes directly. Runtime GLB and UI PNG assets stay in this repository; Metro excludes source scenes and intermediate render frames.

## What worked and verification

Latest completed checks on 2026-10-05:

- Game, startup, TypeScript, lint and bundled asset verification passed during the native migration and cat torso correction. Cleanup game, TypeScript, lint and asset checks also pass; iOS and Android Hermes exports also pass. The cleaned iOS client cold-launched, completed feather play, restored its controls and kept the wallet unchanged.
- All three coats passed connected-skin, normalized weight and bone-parent checks. The actual orange GLB passed 35 clips at five deformation samples each. Game checks execute the real render worklet at 30/60/120 FPS and cover obstacle navigation, furniture/seat contact, doors, pause, Reduce Motion and existing care/economy/menu behavior.
- Native iOS checks exercised feeding, room travel, sofa landing and feather play. Android built and launched; full Android interactions and device performance remain outstanding.
- Thumbnail generation skips retained outputs and no longer recreates cat pages. Asset verification does not require the external Blender library.

Successful practices: share model/clip sources across coats; inspect the actual exported GLB; test action/navigation behavior with deterministic clocks; measure native trigger wrappers; use packaged cold launches for system splash claims. Keep Babel's nested worklet processing and the pinned Filament physics patch.

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

1. Test full Android interactions and native menus on a device; profile older supported iPhone/Android hardware before making FPS, memory or battery claims.
2. Check packaged cold launch on a physical iPhone after native/system artwork changes.
3. Configure real store purchases before release. Preserve live saves and wallet values during UI testing.
4. Keep the working tree and this handoff aligned with future changes. Historical sprite reports in the archive describe removed outputs and are not current regeneration instructions.

## Commands and environment

Run checks from the project root:

```sh
npm run test:game
npm run test:startup
npm run typecheck
npm run lint
npm run assets:verify
```

Regenerate only the assets affected by art changes:

```sh
npm run assets:native
npm run assets:3d -- --only sofaA --refresh
npm run assets:icons
```

See `assets/3d/README.md` for cat-only GLB export and editable-rig output. `cat_model.py` and procedural pose checks remain useful authoring dependencies; do not remove them because the old sprite renderer is gone. The obsolete `--only cat` raster build now rejects use. New model review uses `scripts/3d/review-native-cat.py`.

Environment: Expo 57.0.26, React Native 0.86.3, React 19.2.3, Skia 2.6.2, Reanimated 4.5.1; iOS minimum 16.4 with scene support. App ID: `com.mathmews.app`. Blender executable: `/Applications/Blender.app/Contents/MacOS/Blender`. Native UI checks used Device Hub with iPhone 18 Pro / iOS 27 Simulator. `npm run ios` runs prebuild before launching the iOS app.

The original-cat iOS and Android debug clients rebuilt successfully on 2026-10-06. iOS installation preserves the existing app data; Android interaction and physical-device performance remain unverified.
