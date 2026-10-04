# Math Mews 3D assets

This collection replaces the previous pixel art with original Blender models, rounded forms, matte materials, and the game's cream, coral, teal, gold and dusty pastel palette.

The app uses rendered images rather than a live 3D scene. This keeps its existing room placement, dragging, layering, rotation, mirroring, store categories and save format.

## Editable sources

The 316 editable Blender scenes live in `/Users/aigarspeda/Desktop/BrainPet-blender-assest`, outside the app repository. Paths below are relative to that folder.

- `cat.blend` is the cat model with named, parented body parts.
- `idle.blend`, `correct.blend`, `incorrect.blend`, `lieDown.blend`, `restSleep.blend`, `sleep.blend`, `eating.blend` and the other clips contain editable transform keyframes. These use a hierarchy of parts rather than an armature.
- `items/` contains 273 furniture, bed and toy models. Animated objects include keyframes.
- `rooms/` contains all 15 room scenes.
- `store.blend` and `stats.blend` contain the matching app graphics.

`migration-sha256.json` records the size and SHA-256 checksum of every scene when it was moved. The copy matched the original files before the project copies were removed. Checksums describe that migration, so they will change when you edit a scene.

Orange, grey and white coats use the same model and animation. The approved expressive cat's geometry, procedural materials and poses are defined in `scripts/3d/cat_model.py`; `scripts/3d/render_assets.py` renders the collection. The approved concept is in `docs/art/cat-approved-concept.png`, and `HANDOFF.md` describes its proportions, palette, expressions and exact recreation settings. The external library also contains `reference/cat-approved-concept.png` and `reference/CAT_DESIGN.md`.

## Rebuilding

Run from the repository root with Blender installed:

```sh
npm run assets:3d
npm run assets:3d -- --refresh
npm run assets:verify
```

The first command skips existing renders. The second rebuilds everything. Set `BLENDER_BIN` if Blender is installed elsewhere.

The renderer and verifier default to the sibling folder `../BrainPet-blender-assest`. To use another source folder, set `BRAINPET_BLENDER_ASSET_DIR` to its absolute path. Rendered PNGs, WebP pages and atlases always stay in `assets/3d/` inside the app repository.

On a fresh clone, copy the external Blender library beside the repository, or regenerate it with `npm run assets:3d -- --refresh`. Asset verification requires the editable library as well as the runtime images.

To rebuild only the cat's 75 clips and branding, run `npm run assets:3d -- --only cat --refresh`. Rooms, furniture and their item IDs stay as they are. The cat scenes include editable transform keyframes for its brows, mouth, frown, ears, eyes, catchlights, paws and tears.

The short front and back legs overlap the torso and paws in every pose. Their transforms are keyed along with the paw controls, so waving and lying down keep those connections. Check all procedural poses with Blender running `scripts/3d/check-cat-leg-connections.py`. For interrupted renders, the renderer accepts `--skin grey --clips sleep,dance --refresh` to rebuild selected clips.

The three box clips use `create_cat(..., boxed=True)` and play in order: `box1` brings the box in from the left while the cat lifts clear, then jumps and hides; `box2` peeks and hides again; `box3` emerges, settles, hops clear while the box slides left, and lands in the normal sitting pose. Their hidden joins match. The tail curls inward before ducking and emerges through the opening. Its points and both Bezier handles are keyed to blend back to the normal tail on exit; keying only point coordinates leaves stale AUTO handles in saved playback. Paws clear the moving walls and stay inside the opening when seated.

The `excited` clip is the petting reaction: side-to-side wriggles, head nuzzles, alternating paw lifts and a relaxed expression. Eating includes a half-second bowl entrance from the left, three seconds of munching/food spills, and a half-second exit to the left after the cat lifts its head. Spilled pieces stay on the floor and shrink away during cleanup. Both actions start/end with no visible prop and the normal sitting pose. Rebuild these 15 clips with the renderer's `--only cat --clips excited,box1,box2,box3,eating --refresh`, then run `node scripts/3d/pack.mjs --clips excited,box1,box2,box3,eating`. The packer's optional clip filter preserves all other textures.

Check the posed box geometry with Blender running `scripts/3d/check-cat-box-containment.py`, and story joins/food trajectories with `scripts/3d/check-cat-care-actions.py`. Append `-- --baked` to check the saved orange scenes. `node scripts/3d/review-cat-box.mjs` produces the story contact board, and `node scripts/3d/review-cat-care.mjs` creates looping GIF previews for all three coats from the actual packed gameplay textures.

The free Play menu has Ball toss, Box peekaboo, Yarn roll and Feather chase. The button/menu include toy icons and text labels, with no prices or coin icons. Playing never changes the coin balance, including when it is zero. Playing remains available at 100% happiness; boosts cap at 100%. Every activity wakes/stands the cat first if needed and uses the existing care cooldown. The new `ballToss` and `featherChase` clips last 5 seconds; `yarnRoll` lasts 4 seconds. Toys enter and leave at the left sprite-frame edge, and all three clips recover to the normal sitting pose. Their orange `.blend` files contain keyed cat and toy controls.

Rebuild them with Blender running `scripts/3d/render_assets.py -- --only cat --clips ballToss,yarnRoll,featherChase --refresh`, followed by `node scripts/3d/pack.mjs --clips ballToss,yarnRoll,featherChase`. `scripts/3d/check-cat-play.py` checks toy floor clearance, hidden endpoints, idle recovery and the saved controls. `node scripts/check-cat-play.mjs` checks the actual Home handlers and display engine without touching saved coins. `node scripts/3d/review-cat-play.mjs` creates `docs/art/cat-play-{orange,grey,white}.gif` from the packed runtime pages.

`pack.mjs` extracts `cat-splash.png` directly from the first orange idle atlas cell. The launch logo and the loading animation use that same pose. Run `node scripts/check-splash-continuity.mjs` after packing to check pixel identity and startup readiness.

To render one object directly:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/3d/render_assets.py -- --only sofaA --refresh
node scripts/3d/pack.mjs
```

The renderer uses Blender 5.2.2 LTS and Eevee. `--cycles` selects Cycles. Preserve the camera, framing and lighting when editing a source scene so replacements align with the existing collection. The procedural script rebuilds its models; manual Blender edits must be rendered from the edited `.blend` scene instead of running the model generator again.

## Runtime format

- The cat has a single cream pear-shaped torso, a centered tail attachment, and a coat-matched tail with no white tip. The orange coat uses warm brown for its tail; forehead stripes and the white blaze fade before reaching the rear of the head. The optional belly patch is left cream. All clips share these materials and geometry in `scripts/3d/cat_model.py`.
- Room movement uses five standing walk views, mirrored for leftward travel, plus separate one-shot jump-on and jump-off clips. Sofa jumps crouch for 180 ms, fly for 450 ms, and recover on landing for 270 ms. The runtime supplies the curved flight path while the baked paws tuck in flight; commands and touches received midair wait until landing. The four-beat gait plants each paw for 64% of the cycle. `constants/cat-room-motion.ts` matches floor travel to the half-unit Blender stride, camera projection, rendered cat size and playback cadence. These movement clips use 384 px cells, twelve frames per 1536×1152 page, so the complete 24-frame clip stays in the current/next pair. Rebuild with the renderer's `--only cat --clips walk,walkAway,walkToward,walkAwayDiagonal,walkTowardDiagonal,jumpOn,jumpOff --refresh`, then pack those same clips. Check foot contact and pose joins with `scripts/3d/check-room-cat-motion.py`; `node scripts/3d/review-cat-walk.mjs` previews matched floor travel from the packed textures. `node scripts/3d/review-sofa-jump.mjs` previews both sofa orientations with the planner coordinates and jump timing.
- Static furniture, beds and scratching posts are 256 px transparent PNGs.
- Rooms are 1024 px PNGs.
- Cat gameplay cells are 768 px at 24 fps. Four cells fit into each 1536×1536 WebP page. Only the current/next pair is decoded, with a theoretical RGBA budget of 18 MiB before GPU overhead/transient replacements.
- The 25 cat clips run at 24 fps, with 5,544 frames across all coats. Idle lasts 4 seconds, correct/petting 2.5 seconds, incorrect 2 seconds, feeding 4 seconds including prop slides, and the complete box story 7.5 seconds. The splash uses a separate full 192 px idle sheet.
- Cat wake-up and standing scenarios reuse the reverse `sleepy`/`lieDown` clips at 72 fps, taking about 0.83/0.67 seconds before care actions. Forward sleep/rest animations retain 24 fps.
- Furniture and small-toy loops use eight frames at 12 fps.
- Cat sprites use smooth linear sampling and fractional scaling. Reanimated advances frames on the UI thread; background/covered screens pause. Reduce Motion freezes loops. Gameplay can zoom to 3× without writing placement offsets.
- Cat WebP pages use quality 90 and alpha quality 100. The current 1,386 pages total 112,668,618 bytes, about 107.4 MiB. Props intentionally cross the left cell edge during entry/exit; other cell borders and stationary/action phases remain transparent. See `docs/art/cat-texture-metrics.json` for current and earlier measurements.
- Individual render frames and Blender backups are ignored by Git. Metro excludes source scenes and intermediate frames. Editable `.blend` files live outside the repository and are not bundled into the app. Back up the external folder to preserve manual Blender edits; the previous scenes remain recoverable from Git history.

`npm run assets:verify` checks all 288 retained item IDs, texture dimensions/page budgets, nonempty cat frames, unclipped cat silhouettes, motion, forward/reverse completion, page-loading stalls, mirroring and rest/sleep/wake transitions.

All placeable items use the room projection direction `(8,-8,6.1)`. Window style changes keep the wall plane unchanged; wall mirroring is independent. Rotation variants share colours. Audit every scene with Blender running `scripts/3d/audit_projection.py`; regenerate labelled contact boards with `node scripts/3d/review-assets.mjs`. Results/research are in `HANDOFF.md` and `docs/art/room-projection-audit.json`.
