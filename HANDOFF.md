# Math Mews 3D art migration

## Goal

Replace the pixel-art cat, rooms, furniture and animations with a modern 3D appearance while keeping the equivalent game working. The user wanted Blender assets that retain the game's palette and approved deleting the old assets after their replacements were created. Preserve puzzles, rewards, pet care, sleep, room decorating, inventory and saved progress.

## Current progress

The migration is complete and the updated app is running in the iPhone 18 Pro simulator.

- Replaced all 288 catalog items: 15 rooms, 13 beds, eight toys and 252 decorations. Existing item IDs, store categories, display sizes, prices, quantities, rotations, layering, wall mirroring and save data remain compatible.
- Created orange, grey and white cats with 22 animation clips per coat, 66 clips in total. Added distinct correct and incorrect reactions, lying down, resting and the transition from resting to sleep. Retained feeding, dancing, tap reactions, blinking, coin reactions and chained box play.
- Created eight-frame loops for 24 furniture items and four small toys.
- Updated cat sampling to linear filtering with fractional scaling. Frames are 192 px, rather than 32 px.
- Result reactions play once and return to idle. Correct reactions last 1.2 seconds; incorrect reactions last 1.5 seconds.
- Healthy cats settle down after three minutes without interaction. Lying down is distinct from sleeping. The existing 30-minute sleep timing remains. Care actions stand the cat up or wake it before their reaction.
- Updated app branding, animated splash, store and statistics graphics.
- Retained 313 editable Blender scenes, including all items and rooms, the cat model, animation clips and branding. Animation scenes contain named part hierarchies and transform keyframes, rather than skeletal armatures.
- Removed the 578 old cat asset files after verification. Removed six obsolete frame-list modules and three unused sprite renderers. Previous versions remain recoverable through Git history.
- Added `npm run assets:3d`, `npm run assets:verify`, the asset instructions in `assets/3d/README.md`, and Metro exclusions for Blender sources and intermediate frames.

## Art direction and source locations

Use rounded forms, matte materials, pale wood, soft upholstery and the established warm palette. UI colours remain cream `#FFF5EB`, coral `#FF6B6B`, teal `#4ECDC4` and gold `#F7B731`. Room themes include dusty rose, sage and powder blue. Orange, grey and white coats share the same model and animation.

Blender 5.2.2 LTS is installed at `/Applications/Blender.app/Contents/MacOS/Blender`.

- `assets/3d/blender/cat.blend`: editable cat model.
- `assets/3d/blender/*.blend`: editable animation and branding scenes.
- `assets/3d/blender/items/`: furniture, beds and toys, including animation keyframes.
- `assets/3d/blender/rooms/`: all room scenes.
- `scripts/3d/render_assets.py`: original model builders, materials, camera, lights and poses.
- `scripts/3d/inventory.json`: stable catalog IDs, display sizes and animation flags.
- `scripts/3d/clips.json`: clip frame counts and playback rates.
- `scripts/3d/pack.mjs`: animation atlas packing and generated cat asset catalog.
- `scripts/3d/verify.mjs`: catalog, texture, motion and state checks.

This is Blender-rendered 3D art displayed through the existing image renderer. The app does not load a live 3D engine or `.blend` files. Each active cat clip uses a separate texture to avoid decoding one giant atlas. Intermediate frames are ignored by Git and can be regenerated. Editable Blender scenes are retained in Git.

Manual Blender changes should be rendered from the edited scene. Running the procedural model generator recreates the scene from its Python definitions.

## What worked and verification

- `npm run assets:verify` passed for every retained item ID, editable model, texture dimension, cat frame, cat silhouette boundary, animation motion, correct/incorrect playback, reverse waking/standing, WC mirroring and rest/sleep state transitions.
- `npx tsc --noEmit` passed.
- The changed cat renderer, mood derivation, result overlay and asset scripts passed targeted ESLint checks.
- `git diff --check` passed.
- A production iOS export succeeded after deleting the obsolete assets. Output: `/tmp/brainpet-modern-ios-export`.
- The final native simulator build succeeded with zero errors and one warning. Log: `/tmp/brainpet-3d-ios-final.log`.
- Verified the new room, cat, store previews, persisted owned furniture, incorrect-answer feedback, correct-answer feedback, rewards, repeated result playback, feeding, action blocking and subsequent recovery in Device Hub. Also observed resting after inactivity and standing before a tap reaction.
- Feeding deducted 10 virtual coins and restored 25 fullness points. Local simulator verification completed three additional puzzles and deliberately submitted one wrong answer. The test profile is named `Ios28`; its progress changes were kept.
- Metro remains running on port 8081. Current session: 51255; log: `/tmp/brainpet-metro-final.log`.
- Simulator: iPhone 18 Pro, iOS 27.0, UDID `85A0697F-2C5B-43EC-91BC-77CC3DBCE9D5`. Bundle ID: `com.mathmews.app`.

The earlier iOS dependency work is already present in the project: Expo 57.0.26, React Native 0.86.3, iOS 16.4 deployment target, CocoaPods resource target fix and Xcode 27 scene support. Its prior Expo Doctor run passed all 21 checks.

## What did not work, and fixes

- Blender initially crashed in the restricted sandbox because graphics access was unavailable. Rendering worked through an approved escalated Blender CLI call.
- The first cat framing cropped ears during a jump. The silhouette checks caught this; the final clips use wider framing and pass the boundary checks.
- The initial furniture pass made some objects too similar. Consoles, cabinet components, posters and plants were refined and rerendered.
- Rendering thousands of intermediate PNGs repeatedly refreshed Metro. Its configuration now excludes render frames and Blender scenes.
- `Simulator.app` is unavailable in this Xcode installation. Use Device Hub. The final Expo build installed and opened the app successfully.
- The repository-wide `expo lint` still reports 19 pre-existing errors and eight warnings. Its findings include older UI hooks and remain outside this asset migration. The current cat renderer, new mood logic, result overlay and asset scripts pass their targeted checks.

## Next steps

No required migration work remains. The changes are uncommitted and ready for review.

For further art changes, read `assets/3d/README.md`, edit a Blender scene or the procedural builders, regenerate the relevant images, and run `npm run assets:verify`. Use `npm run assets:3d -- --refresh` to rebuild the entire collection. Physical-device and Android runs were not part of this simulator verification.

Suggested commit message:

```text
feat: replace pixel art with Blender 3D assets and animations
```
