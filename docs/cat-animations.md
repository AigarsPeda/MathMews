# Adding cat animations and room interactions

The exporter and app both read `scripts/3d/clips.json`. Each entry is `[frameCount, fps]`. A new key automatically becomes a `CatAnimationId` and can be used by a room activity step. All three cat skins must contain the same clips.

1. Add the clip's frame count and rate to `scripts/3d/clips.json`.
2. Author its pose in `scripts/3d/game_cat.py`. Use `scripts/3d/cat_model.py` for procedural controls and expressions. Keep the cat's root stationary; room navigation controls translation, heading and jump height. Recover to a compatible pose at the end of a one-shot clip.
3. Use the clip in `utils/room-activities.ts`. A step declares its animation, duration, movement and target. Add a one-shot clip to `ROOM_ONE_SHOT_CLIPS` in `constants/cat-room-motion.ts`; other room clips loop until their step ends.
4. For a new furnishing interaction, add one entry to `constants/room-commands.ts`, its target predicate and its plan builder. This registry supplies the cat menu, furnishing menu, icon, section and activity type. Add its label to both locale files. Menu eligibility must stay cheap; solve navigation when the command starts.
5. Rebuild the three native cats:

   ```sh
   BRAINPET_BLENDER_ASSET_DIR=/tmp/brainpet-native-blends \
     /Applications/Blender.app/Contents/MacOS/Blender --background \
     --python-exit-code 1 --python scripts/3d/export-native.py -- --cats
   npm run assets:cat-thumbnails
   ```

   Follow the native startup capture workflow in `docs/native-room-engine.md` if the cat's idle appearance changes. Keep launch artwork synchronized with the shipped GLB.
6. Run `npm run animations:check`, `npm run typecheck` and `npm run lint`. Add a regression for the interaction's rendered arrival, interruption, background pause and Reduce Motion. Check it on the iPhone simulator, including a rotated/scaled furnishing beside a wall.

An activity step can use any authored clip directly:

```ts
{ position, mood: "idle", animation: "wash", durationMs: 6000 }
```

The room scheduler owns completion. Native steps wait for the visible cat to finish, rather than letting a JavaScript timer advance ahead of rendering. Callbacks that award food or other care effects must only run after a successful command. Each departure step keeps its source furnishing's instance ID when the next command targets something else.

For a command initiated by a menu, pass the timestamp returned by `onRoomInteraction` into `startActivity`. This prevents a delayed save-context render from treating the command's own tap as a cancellation.

# Contextual walking, trotting and running

`constants/cat-gaits.json` shares stride lengths, stance proportions and paw offsets between the Blender exporter and native playback. `trot` and `run` are native locomotion clips added by `game_cat.py`; activity plans continue to request `walk`. The native planner chooses a maximum pace from the task and distance. Sleep and return-home trips walk, longer ordinary trips trot, and long toy/mouse approaches can run. Actual clearance and curvature limit speed locally. The first stride and final approach stay at walking speed, with smooth acceleration and braking between them.

Animation phase follows distance traveled. Gait changes preserve phase, outgoing clips follow the same distance clock, and hysteresis prevents repeated switching near a speed threshold. Planted paws use world contacts; an adjustment step lifts a foot before it overextends during a blend. Turning uses its original launch stride even after the locomotion stride changes. The running pose adds restrained shoulder/pelvis flex and a trailing tail. Reduce Motion retains a stable walking pose.

The references informed these choices rather than supplying animation assets:

- [Muybridge, cat trotting and changing to a gallop, plate 717](https://commons.wikimedia.org/wiki/File:Cat_trotting,_changing_to_a_gallop_(rbm-QP301M8-1887-717).jpg): photographic footfall order, gathered/extended running poses and tail changes.
- [Rybak et al., 2024, cat locomotion](https://pmc.ncbi.nlm.nih.gov/articles/PMC11473106/): contact duration decreases as speed increases. Game thresholds are tuned to our stylized model rather than treated as measured biological speeds.
- [BlueTwelve's Stray interview](https://www.unrealengine.com/developer-interviews/28-people-and-two-cats-inside-the-making-of-stray): repeated iteration on movement and transitions, balancing feline movement with responsive play.
- [Micah Breitweiser, Little Kitty, Big City animation](https://www.gamedeveloper.com/art/deep-dive-how-little-kitty-big-city-rejects-realism-to-achieve-authenticity): study real reference, then adapt the whole-body rhythm to the character's proportions.

Run `node scripts/check-cat-gaits.mjs --poses` to test all coats at 30/60/120 FPS and two sizes, including fixed contacts, acceleration/braking, exact arrival, task replacement, pauses, corridor clearance and Reduce Motion. It writes comparison poses and timing metrics under `/tmp/brainpet-gait-*`. `scripts/3d/render-cat-gaits.py` renders the baked clips; add `-- --runtime` to render the actual actor matrices against a floor grid. These checks are included in `npm run test:game`. After rendering, `python3 scripts/3d/compare-cat-gaits.py` (Pillow required) builds a side-by-side GIF and a pose contact sheet under `/tmp/brainpet-cat-gaits`. The comparison uses an in-room route to avoid triggering the wall-contact constraints with synthetic out-of-bounds movement.

# Sofa takeoff and landing

Native jumps line up with their destination before takeoff. They keep the same heading through flight and landing, then use a supported paw-stepping turn when the next resting step requests another direction. Jump-off uses the same preparation on the cushion. A repeated command for the same landing preserves the airborne phase and remaining flight instead of restarting a crouch.

Direct furnishing jumps carry horizontal momentum through their flight window. Collision prediction uses that same path. Tight backrest traversal retains its validated lift-first envelope. The authored native jump clips share a standing start/end pose, a planted preparation, tucked paws, forepaw-first contact, hind-paw follow-through and landing compression. They do not contain root translation or yaw.

The reference choices are deliberate:

- [Little Kitty, Big City animator Micah Breitweiser](https://www.gamedeveloper.com/art/deep-dive-how-little-kitty-big-city-rejects-realism-to-achieve-authenticity) describes whole-body rhythm, frame-by-frame reference study and blended states. Here that means a continuous head/body/tail response and compatible jump endpoints.
- [Epic's Motion Warping documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine) describes aligning motion to targets within selected animation windows. Our native implementation separates supported alignment from the flight window, keeping yaw out of airborne motion.
- [Contributions of Limb Joints to Energy Absorption during Landing in Cats](https://pmc.ncbi.nlm.nih.gov/articles/PMC6721424/) measures successive fore/hind contact and limb flexion during impact absorption. The stylized pose follows that order; its timing is tuned for this model rather than copied from measured animal speeds.

`node scripts/check-cat-jumps.mjs` exercises the shipped rig and all coats at 30/60/120 FPS, four rotations and three furniture sizes, plus every sofa finish, mirrored placement, pauses, command replacement and Reduce Motion. `--preview` records one sofa sequence to `/tmp/brainpet-jump-poses-after.json`; `--poses` records it during the full checks. `scripts/3d/render-cat-jumps.py` renders those native matrices with the actual sofa. Capture `--baseline` before changing the animation code. It records the current checkout; the comparison renderer uses that saved baseline rather than reconstructing old motion.

# Catalog performance

Shop and decoration pickers use two-column virtualized lists, starting with six cards. Catalog pictures are still images; opening a detail preview mounts its native scene. The splash loader downloads catalog images and warms the Expo Image memory/disk cache. Decoded startup thumbnails have a 12-million-pixel budget, about 46 MiB for RGBA pixels. Larger images stay on disk. Native scene models remain bounded and load on demand.
