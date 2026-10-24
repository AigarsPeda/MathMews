# Adding cat animations and room interactions

See the [23 October movement study](art/cat-motion-study.md) for the latest source review, predictive speed control, smoother starts/stops, route-leading gaze and validation.

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

# Continuing from a landing into a walk

A queued walking step can take over at jump phase 0.88, after forepaw and hind-paw contact, while the upper body finishes recovering. Resting landings still play their full recovery. The activity scheduler supplies this intent explicitly; obstacle routes shorten only hop legs followed by an ordinary floor walk and retain the original flight clock.

The first stride captures the rendered paw positions, sole angles and body height. Each paw stays in place until its own lift-off. First-step targets use the standing stance, avoiding an overshoot at touchdown; brief JS dispatch delays retain the departure-ready pose. Landing recovery holds the impact posture until the hind paws can step, then rises into the walking pose. It skips the extra crouch used by turn-to-walk launches. Large direction changes retain the supported turning sequence.

`node scripts/check-cat-landing-walk.mjs` checks all coats at 30/60/120 FPS, two cat sizes, straight and turning departures, delayed JS handoffs, pauses, body recovery, ground contacts and linked obstacle routes. `--preview` records the sofa handoff. Render it with `scripts/3d/render-cat-jumps.py -- --landing-walk` and assemble the comparison with `scripts/3d/compare-cat-jumps.py --landing-walk`. The before render requires a separately recorded `--baseline` from the earlier checkout.

# Jump mechanics study and revision — 18 October 2026

The earlier animation returned from its crouch before flight, moved the torso as a rigid block and used almost the same pose for jumping up and down. Small paw offsets did not clearly separate push-off, gathering and reaching. Direct furnishing jumps also used a fixed 900 ms clock regardless of their clearance arc.

## Reference findings

| Source | Observation | Application here |
| --- | --- | --- |
| [Zajac, Zomlefer & Levine, 1981: hindlimb kinetics and kinematics](https://doi.org/10.1242/jeb.91.1.73) | Maximum-height jumps have a preparation followed by a roughly 150 ms launch. Hip/knee extension and later ankle extension contribute to propulsion. | Show weight loading on the haunches, front-paw release and a distinct hind-leg push before gathering the legs. This maximum-effort experiment supplies sequencing, not a duration to copy onto every furniture hop. |
| [Xu et al., 2022: adaptive feline landings](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2022.836043/full) | High-speed video and force measurements at 60–120 cm separate first forelimb contact from subsequent flexion. Landing mechanics change with height; the wrist, elbow and shoulder share cushioning. Figure 1 illustrates the forward/downward landing posture. | Reach the forepaws toward the support, then compress the shoulders while the hind paws follow. Keep the feet supported through recovery. Our much shorter, stylized cat does not reproduce measured force values or extreme falls. |
| [Little Kitty, Big City: animator Micah Breitweiser's account](https://www.gamedeveloper.com/art/deep-dive-how-little-kitty-big-city-rejects-realism-to-achieve-authenticity) | The creator emphasizes frame-by-frame reference, nose-to-tail rhythm, the paths and timing between poses, and repeated in-game assessment. | Use restrained chest/pelvis flex, a destination-directed head and a quieter tail; inspect rendered sequences rather than judging only pose names or successful arrival. |
| [Stray: BlueTwelve's developer interview](https://www.unrealengine.com/developer-interviews/28-people-and-two-cats-inside-the-making-of-stray) | Its animator and programmer iterated on basic movement for years, prioritizing efficient, dependable traversal. | Preserve reliable target alignment and task transitions while refining the motion. The interview does not disclose a proprietary jump solver, so we make no claim to reproduce one. |
| [Epic: Distance Matching](https://dev.epicgames.com/documentation/en-us/unreal-engine/distance-matching-in-unreal-engine) | Landing poses can follow distance to the ground, keeping extension synchronized with changing movement speed. | Our predetermined flight uses one shared clock for root position, pose sampling and scheduling. Arc-dependent duration changes do not desynchronize the paw-contact events. This is a small custom implementation, not Unreal's runtime. |

## Implementation and review criteria

`constants/cat-jump.json` shares takeoff, forepaw contact, hind-paw contact and walking-ready phases between the authored poses and native movement. `game_cat.py` authors a deeper upward load and nose-led push; downward departures use a shallower preparation and forward/downward posture. Hind legs trail briefly after push-off, then gather beneath the belly. Forelimbs reach before impact. Chest and pelvis flex without axial twisting, and the head retains a quieter version of the body's pitch.

Flight duration follows the validated arc height relative to cat size, with a horizontal-speed allowance and bounded game timing. High destinations require an arc that meets the support while descending. The scheduler receives that same duration. Playback and collision prediction continue to use the identical trajectory; tight obstacle hops retain their lift-first envelope. Arrival heading, midair command refreshes and supported turns remain intact. The later revision below moves the walking handoff to phase 0.88.

Review the anticipation, takeoff, gathered flight, reach, forepaw contact, hind-paw contact and recovery separately. In the first revision, downward pitch raised the pelvis enough to pull a hind paw off its support early; the final preparation keeps it planted. The head targets are absolute bone transforms, so counter-rotating them inverted the intended gaze. The revised head follows a smaller amount of body pitch instead.

`node scripts/check-cat-jump-anatomy.mjs` samples the shipped rigs at 30/60/120 FPS. It checks planted hind paws before takeoff, front-paw release, gathered hind legs, reaching, successive contacts, shoulder compression, supported recovery, distinct up/down preparation, arc-dependent duration and descending seat arrival. The existing jump, landing-to-walk, furniture, tail-contact and task-chain tests cover interruptions and scene constraints. Visual comparisons use saved native bone matrices with the actual sofa, at the same camera and elapsed time; a shorter jump therefore completes earlier rather than being stretched to match the baseline.

Validation for the 18 October revision passed: `npm run test:game`, `npm run typecheck`, `npm run lint` and `git diff --check`. That run included all three coats at 30/60/120 FPS, 112 furniture/rotation arrangements, task transitions and tail contacts. Native sofa arrival and sofa-to-rocking-chair transitions were also checked in the iPhone simulator after reloading the assets. At that revision, all 39 non-jump skeletal animations retained identical channel data. The denser bake described below resamples those channels without changing their authored poses.

# Furniture perches

Furniture perches use mesh-derived seats and dry tabletops from `constants/cat-furniture-surfaces.json`. Office, classic and gaming chairs, bar stools, the bedroom bench, tables and desks expose "Jump up and sit". The planner fits the seated animation's four paw pads on the support polygon, checks body/head space and both flights, and tries exposed parts of occupied tables. It selects an arc that clears seat/table edges and tries side approaches to tall backs, with extra takeoff distance when needed. Playback uses that exact arc and retains it through midair command refreshes. Miniatures and surfaces beyond direct jumping reach remain unavailable. Other seated activities, beds and cat platforms share compact flight clearance while floor approaches retain their walking clearance.

Regenerate the furniture data after changing these models with `node scripts/3d/build-cat-furniture.mjs`. `node scripts/check-furniture-perches.mjs` checks the data against the shipped meshes, every store chair, rotated furniture, occupied tops, headroom, small/high seats, interrupted exits and the actual seated paw positions at 30/60/120 FPS. It runs in `npm run test:game`.

# Direct furniture jumps

Native furniture commands first try a direct flight from the current support to the requested chair, sofa or tabletop. The cat stands up if curled, turns before takeoff and uses the existing jump/landing clips. The destination's chosen seat stays attached to subsequent rest and exit steps. Repeating the same command retains that seat. A later floor task still gets down normally.

`findFurnitureTransfer` fits all four round paw pads on the source and destination polygons and sweeps the same flight that playback will use. The cat keeps its landing heading for the next rest instead of making an unnecessary turn to the furniture's default direction. Straight landings take priority. If none fits, the planner tries a landing adjustment of at most 30 degrees to either side. Shared `catJumpAim` drives both the collision sweep and playback: the head leads a smooth adjustment after takeoff, which finishes before contact. Ordinary jumps retain their fixed heading. Cushions, backrests, armrests, table edges, neighboring objects and room boundaries participate. The limit is four cat body units horizontally and 1.65 vertically. The destination must retain a clear floor exit connected to the room's home position, excluding isolated pockets behind furniture. When a direct flight is unsafe, the router keeps the normal jump-down/walk/jump-up sequence. Simple graphics keeps its established floor route.

Small seats use `catSupportStance` to gather the paws beneath the body. The same fore/aft spacing drives support checks, landing candidates and the actor's leg IK during supported turns, takeoff and landing recovery. Feet release that constraint smoothly in flight; sole orientation stays intact. Sofa support polygons bridge only narrow seams between aligned cushions, retaining the outer seat edges and larger openings. This permits the rocking-chair-to-sofa jump in the reported living room while keeping the armrest and neighboring furniture in the flight checks.

`jumpFromInstanceId` preserves both support identities for collision checks and rocking-chair contact. A descending furniture transfer still lands on a support, so queued commands must retain its seat intent. A changed room is checked again before takeoff; a now-blocked flight uses the existing unreachable-item notice. Paused or already airborne movement retains its original clock and trajectory.

`node scripts/check-furniture-transfers.mjs` checks twelve rotated sofa/chair/table arrangements, occupied tops, barriers, headroom, range, sleeping departures, live invalidation, repeated commands and actual rig playback in all coats at 30/60/120 FPS. `check-room-activities.mjs` also runs direct and queued descending transfers through the real scheduler, including pause/resume, stale completion callbacks, Reduce Motion and later floor returns. For a visual review, the transfer test writes `/tmp/brainpet-furniture-transfers.json`; render it with `scripts/3d/render-cat-jumps.py -- --transfer`.

`node scripts/check-close-furniture-jumps.mjs` reproduces the furnished living room and checks manual and autonomous chair-to-sofa jumps, followed by the reverse jump from the chosen sofa landing. Actual playback checks planted contacts during supported turns, stationary preparation, bounded continuous heading adjustments, continuous paws, exact arrival and no extra turn after landing on all three coats at 30/60/120 FPS. The chair-to-sofa departure is also checked at a narrower phone width. Its bone recordings can be rendered with `scripts/3d/render-cat-jumps.py -- --nearby`. Both directions were also checked in the running iPhone simulator.

Awake daytime cats also choose perch visits alongside wandering and toy play. After an automatic sitting pause, `continueFurnitureExploration` tries nearby unvisited chairs, sofas and tables through the same direct-jump router. It checks the live room again before each flight. The cat rests for 6–10.5 seconds between transfers, visits at most three furnishings in an outing and then gets down. It never revisits a support during that outing. If no safe transfer exists, the original floor exit continues.

Autonomous transfers stop when the cat is hungry or asleep, at night, while the room is hidden, with Reduce Motion or in Simple graphics. A user command takes priority, waiting for an airborne cat to land before switching tasks. Commanded rests remain held. The furniture-transfer tests cover autonomous choices and limits; the room scheduler tests start from idle without a command and cover perch discovery, rest/flight/exit sequencing, live obstacles, pause/resume, care priorities and commands during autonomous flight.

# Narrow supports and successive contacts — 19 October 2026

The follow-up study distinguishes measured animal behavior from our animation choices:

- [Accurate stepping on a narrow path (2015)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4644224/) reports limb adduction and closer lateral paw placement in cats walking along a 5 cm path. Applying that strategy to a narrow furniture landing is our engineering inference; this experiment did not measure jumping onto shelves.
- [Kinetic analysis of felines landing from different heights (2019)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6857581/) observes forelimb-first contact and initial central-pad loading in 30–90 cm landings. The animation now separates reaching, shoulder absorption, hind-paw contact and hip recovery. Forelimbs make first contact; they do not absorb every landing alone.
- [Limb joint energy absorption (2019)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6721424/) supports successive limb contacts and flexion, with a greater hindlimb role at larger drops. We use the sequence without copying forces or timings from high falls onto short game hops.
- [Epic Distance Matching](https://dev.epicgames.com/documentation/en-us/unreal-engine/distance-matching-in-unreal-engine) and [Motion Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine) inform target/contact synchronization. Our existing shared trajectory and animation phases provide that synchronization without adding an engine dependency.

Upward jumps now extend the hips while the hind pads remain supported. The forelegs release first, airborne paws gather laterally, and shoulders absorb the first contact before the hips settle. Downward jumps retain a smaller push. All clips are baked at 48 samples per second to reduce between-key paw drift; non-jump pose authoring is unchanged. A bounded foot-contact correction keeps recovering legs within reach of planted paws during the first walking stride.

`catSupportWidth` shares lateral paw gathering between support checks and native leg IK. It changes joint placement, not mesh scale or pad radius. Fore/aft gathering remains independent. The source releases its stance smoothly in flight and the destination stance gathers before contact. Central landings take priority, and a direct departure validates intermediate supported turn headings as well as its final launch heading. A narrow support that cannot accommodate that turn keeps the floor fallback.

The mesh registry now includes 38 chair, stool, bench, desk, table, shelf, dresser, wardrobe, vanity and chest models. Closed cupboards/worktops and uncovered mattress surfaces can participate in direct routes. Covered-bed exits and bedtime behavior retain their existing sequence. Small cushion seams join in either local axis only when the cushion edges align; this does not fill corner-sofa openings. Shelves below the floor, open furniture, blocked tops, insufficient headroom and disconnected floor exits cannot provide a landing. The nightstand's vase/books and quilt chest's folded quilts currently leave no clear four-paw patch at the audited size.

`check-catalog-furniture-jumps.mjs` audits 57 catalog variants through both commands and autonomous exploration, checking four rotations, later exits and rejection of unsafe layouts. It also drives the shipped rig onto a narrow shelf and checks the entire circular pad of all four rendered paws at 30/60/120 FPS. The test records its coverage in `/tmp/brainpet-catalog-jump-audit.json`. `check-furniture-perches.mjs` separately covers 152 model/rotation combinations, props, headroom, miniature seats and interrupted exits. These checks join the existing jump anatomy, continuous movement, real scheduler and room-to-room task-chain tests in `npm run test:game`.

Validation passed: the full game suite, type checking, lint and whitespace checks. Final focused checks also cover cupboard-top exits retaining their roof contact, existing drawer/cupboard hiding and manual requests for open tops reporting a failure. All three coats pass narrow standing, sitting and paw-raising gestures at 30/60/120 FPS. Sofa arrival and both sofa/rocking-chair commands were checked in the reloaded iPhone simulator. Native matrices were rendered for the sofa before/after comparison and the narrow-shelf fixture; use `check-catalog-furniture-jumps.mjs --narrow` followed by `render-cat-jumps.py -- --narrow` to reproduce the latter. The fixture isolates a shelf from the room walls for visibility; it does not change a saved room.

# Secondary motion and awake attention

The jump now adds a small landing-directed head pitch and a delayed tail bend. Longer or higher jumps get more tail movement; short hops get less. The tail base moves first and the distal bend follows. Both return to the authored pose at the animation endpoints. Tail collision correction still runs afterward. Root travel, contact legs, landing headings and activity completion use their existing clocks and geometry.

The design follows [Micah Breitweiser's account of Little Kitty, Big City](https://www.gamedeveloper.com/art/deep-dive-how-little-kitty-big-city-rejects-realism-to-achieve-authenticity), which emphasizes a fluid rhythm through the character and the motion between poses. [Epic's AnimDynamics documentation](https://dev.epicgames.com/documentation/unreal-engine/animation-blueprint-animdynamics-in-unreal-engine?lang=en-US) describes secondary animation layered over a skeletal action. Our implementation uses bounded curves rather than a physics simulation or a new dependency.

A held awake sitting command previously stopped sampling after the first four-second clip. It now continues the authored breathing, blinking and paw gestures while retaining the same held task. Occasional quiet looks select a nearby toy, plant or window in front of the cat. Head turns ease in and yield to movement; small tail-tip flicks have quiet intervals between them. Sleep, care, play, covered-bed poses and Reduce Motion keep their existing animation behavior. Pausing the actor freezes the expression clock too.

`utils/native-cat-expression.ts` defines the small additive curves. `NativeCatActor` applies them on the drawing thread without React updates. Fast Refresh can retain older shared state, so new expression fields initialize before any native transform is written. The rig now has separate `ear.L` and `ear.R` joints with blended weights across the fused shell and pink inserts.

`node scripts/check-cat-expression.mjs` checks all coats at 30/60/120 FPS, continued blinking after the initial held clip, attention toward an actual nearby toy, continuous head/tail movement, fixed root positions, pause/resume, command handoff, older shared state, sleep/care/play and Reduce Motion. It also compares sampled poses across frame rates. `--preview` captures the orange cat to `/tmp/brainpet-expression-rest.json`; `render-cat-jumps.py -- --rest` renders a close-up. The rig recorder and renderer both choose skeletal eye entities before identically named meshes so previews show the actual eye animation.

# Ear reactions and waking

All three shipped coats have independent ear joints parented to the head. The base weights fade into the fused head rather than moving a detached ear mesh. The pink inserts use the same spatial weight curve. Small ear swivels lead an awake look, brief flicks occur separately on each side, and turns/running add bounded attention or a backward tuck. Authored sleep poses relax the ears; jump flight tucks them back. Drawing-thread offsets ease between commands, freeze during pause and stay disabled with Reduce Motion. The interpretation of interested versus flattened ears follows [Cats Protection's body-language guide](https://www.cats.org.uk/help-and-advice/cat-behaviour/cat-body-language); the small angles and timing are our animation choices.

`wakeStretch` is a 2.5-second non-looping bow. The chest and head lower while all four pads retain their standing contacts, then recover to the idle pose. Keeping the hind legs slightly bent avoids the pad drift found in the first version. General waking uses reversed sleepy settling followed by the stretch. Bed, sofa and chair naps include it after uncurling; covered beds uncover first and use the exposed mattress contact. A supported command may interrupt it. The outgoing stretch keeps its 0.22-second crossfade during first-step IK, fixing the upper-body snap found when that path previously suppressed animation blending.

`node scripts/check-cat-waking.mjs` checks real native matrices for all coats at 30/60/120 FPS, including sleep/uncurl/stretch/idle transitions, four planted paws, fixed roots, pause/resume, interruption into walking and jumping, Reduce Motion and agreement across frame rates. `check-cat-expression.mjs` also checks actual ear movement relative to the head, so a head turn alone cannot pass. Room-activity tests cover waking on all ten beds at four rotations, quilt exits, offscreen dawn, chair/sofa departures and later room travel. `scripts/3d/check-cat-skin-deformation.py`, run with Blender, samples five poses in all 43 clips on each shipped coat and rejects nonfinite vertices, exploded skin and excessively stretched edges.

Validation passed: the full game suite, type checking, lint and whitespace checks. The skin-deformation check passed all 645 sampled poses. Pre-hop turns now use the route turn phase for ear anticipation; the turn regression covers finite joints and exact pause/resume matrices. The reloaded iPhone simulator completed a sofa nap, waking departure and a later rocking-chair command.

For a rendered waking preview, run `node scripts/check-cat-waking.mjs --preview`, then `render-cat-jumps.py -- --wake`. The rest preview also includes independent ears. Both use recorded native bone matrices and the shipped GLB skin.

# Continuous steering and travelling tail

A revised destination previously started another stationary stepping turn even while the cat was walking. `movingCatRoute` now builds a cubic departure curve from the rendered heading and position, rejoins the requested path with a matching tangent, and checks every chord with the ordinary swept-body collision test. It runs once on the JS thread. The drawing thread trims any samples passed before publication, retains foot contacts and stride phase, and starts the new travel clock at the incoming speed. The original source path remains available for delayed-resume matching. Short journeys, reversals, blocked curves, bed crawls, elevated contacts and jump preparations keep their supported-turn fallback. Ordinary planned floor corners can use a wider rounding radius when the entire curve clears furniture.

This follows the separation of steering target, angular speed and acceleration described in [Unity's NavMeshAgent documentation](https://docs.unity.com/en-us/engine/7000.0/script-reference/unityengine/ai/navmeshagent). Our game retains its existing navigation and drawing clocks rather than introducing Unity. [Cats Protection](https://www.cats.org.uk/cats-blog/why-do-cats-have-tails) describes the tail's counterweight role. The bounded amplitudes and delays here are animation choices, not measured feline joint angles.

The travelling tail adds a delayed balance wave through all four joints, driven by distance rather than wall time. A broad wave spans three strides. Turns produce a small opposite bend; faster travel lowers and pitches the tail more. New offsets ease in and out, stay rooted at the pelvis, and run before collision correction. The jump now adds a delayed distal curl alongside its existing base and middle follow-through. Walking gaze also eases toward the upcoming path. Pause and Reduce Motion retain their existing behavior. A delayed resume with no drawing time now preserves the exact displayed pose, avoiding repeated leg solving at the same timestamp.

`check-cat-fluid-motion.mjs` exercises all coats and 30/60/120 FPS through actual walk, trot and run clips before a changed destination. It checks nonzero speed through the handoff, safe floor positions, planted paw contacts, continuous body/tail poses, exact arrival, full-pose pause/resume and reversal/blocked-curve rejection. It also checks the integrated velocity ramp against its requested incoming rate. Metrics and native poses are recorded to `/tmp/brainpet-fluid-metrics.json` and `/tmp/brainpet-fluid-poses.json`. Add `--preview` for orange at 60 FPS, then run `render-cat-gaits.py -- --fluid` with Blender to render the shipped skin using those matrices.

Validation passed for continuous steering: the full game suite, focused native/command checks after the zero-time resume fix, type checking, lint and whitespace checks. The native matrices were rendered for walk/trot/run and sofa jumps; the live simulator completed a window-watching command without a runtime error.

# Task chains and room thresholds

Room departures now retain walking speed at the threshold instead of braking to idle. The completion callback carries speed in body lengths per second, stride phase, gait and tail offsets into the destination actor. Entry converts that speed to the new room's scale and heads toward the selected task. The transfer is transient; it is not saved to the pet record. Ordinary task arrivals still slow down for their interaction, and blocked paths retain their failure handling.

A command delivered with room entry builds its approach directly from the incoming edge. A later command can redirect an ordinary native floor entry from its reported position without first visiting the saved home spot. Airborne transitions still finish their supported landing before replacing the task. Timer playback and Reduce Motion retain their existing queued entry behavior. Configured placed doors expose the existing localized room-travel action, open before departure and transfer the cat as well as the room view.

`check-cat-room-flow.mjs` drives the shipped skeletons across four fresh room actors at alternating viewport scales, for all three coats, walk/trot/run and 30/60/120 FPS. It checks nonzero threshold speed, transferred stride and tail state, no inserted idle clip, exact arrival, pause/resume and one completion despite delayed dispatch. `check-cat-task-chains.mjs` checks the real Home/scheduler handoff, direct entry-to-task routing, commands replaced mid-entry, physical doors and their actual menu callback, alongside its existing cold-room, interrupted jump and cross-room task matrix.

Validation on 19 October passed all 21 focused cat/room checks, type checking, lint and whitespace checks. The full game suite encountered unrelated puzzle-test failures during concurrent curriculum work: the operation-path harness did not support a new JSON import, and the game-systems check still required number-line puzzles to appear only in Hard. Live simulator verification was interrupted by concurrent puzzle testing; the transition results above come from the isolated native renderer and scheduler checks.


## Simulator follow-up, 19 October

Live testing continued on a separate iPhone 18 Pro simulator with an isolated Metro server and a test save. Recordings covered all four rooms, an island departure, a sofa task, a bedroom quilt task and a replacement room command during arrival. Reviewing the camera changes frame by frame exposed a brief empty destination and an initial default-facing pose; scheduler and skeleton checks alone did not catch these presentation gaps.

Cached native rooms now prepare their own cat model while keeping it out of the scene when absent. The arriving actor reuses that model and waits for its first entry route before appearing. Each arrival has its own readiness identity, so an earlier visit cannot release a later one. Following the cat holds the outgoing room until the destination has drawn the newly posed cat. Home exposes only the outgoing buffer during that hold. The obsolete slide transform was removed: its independent drawing-thread update could move that buffer offscreen before the React visibility commit. Both buffers now keep their native position during readiness, avoiding the empty destination flash and blank inter-frame gap. Ordinary browsing keeps its immediate cached-room behavior.

A native entry can prepare behind the outgoing view even without a pending destination task. This prevents a readiness deadlock found during live testing. Reduce Motion and timer playback retain their prior entry scheduling. Regression tests cover that plain journey, stale callbacks from repeat visits, model reuse, first-route visibility, the outgoing-only visibility commit, absence of an independent readiness transform and later task completion.

The final isolated recording completed an island jump-down → walking departure → Kitchen → Bathroom chain. Frame review at 75 ms intervals around the room change showed the cat on the first destination frame, with no empty-room flash, blank frame or return to the outgoing room. The preceding recording also completed Bathroom → Kitchen. The outgoing scene still holds briefly while the native arrival pose prepares; this pass does not claim to eliminate native loading latency. No sliding was apparent in the reviewed movement handoffs. Earlier recordings also exercised Living room → Kitchen → Bathroom, sofa arrival, island exit, a command replaced during entry and the bedroom quilt task.

Focused native-room, command-motion, room-flow, activity, task-chain, room-transition and room-performance checks passed, as did type checking, lint and whitespace checks. The startup suite separately reported stale branding source hashes for previously changed cat GLBs; startup loading and status-bar checks passed. This follow-up did not regenerate branding assets.

# Catalog performance

Shop and decoration pickers use two-column virtualized lists, starting with six cards. Catalog pictures are still images; opening a detail preview mounts its native scene. The splash loader downloads catalog images and warms the Expo Image memory/disk cache. Decoded startup thumbnails have a 12-million-pixel budget, about 46 MiB for RGBA pixels. Larger images stay on disk. Native scene models remain bounded and load on demand.

## Exploratory movement and jump refinement, 19 October

Daytime exploration can now change from walking to a short run, pass through a clear low opening, or slow down to brush a cheek and shoulder along sturdy furniture. These choices yield to care and commands, stay disabled at night, and use the existing Reduce Motion suppression. Rubbing excludes open cupboards, lamps and movable props. The approach and departure retain ordinary walking clearance; only the contact section uses the narrower body envelope.

Crawling uses the placed model's separate supports and overhead panels, including open-door collision boxes. A swept head/body envelope rejects low ceilings, legs, neighboring furniture and room boundaries. The head lowers before entering and the tail stays below the panel. Small stationary obstacles can also contribute jump links when the complete flight and landing are clear. This does not grant arbitrary passage through furniture: scaled-down openings can remain too small.

Jump clips now load the hips more deeply and continue hind-leg extension through takeoff. On landing, the shoulders absorb the first impact while the pelvis and hind paws follow later. Existing trajectory heading, gathered paws, landing-to-walk blending and tail balance remain in use. The stronger compression exposed a small interpolated paw penetration at 48 FPS, so clips are now baked at 60 FPS. The exporter derives its frame range from the longest clip; this prevents longer play clips from being cut short by the increased bake rate. All three coats contain 45 complete clips.

Commands and room departures wait for a crawl or furniture-contact pass to reach its safe exit. Pausing retains that route and elapsed native time. A regression test caught a resume path that tried to rebuild a rubbing pass from its midpoint; resuming now preserves the prepared pass, and the next room task starts from its exit.

The landing choices draw on the successive forelimb/hindlimb contacts and forelimb impact absorption described in [Adaptive Motion Adjustment Strategies During Feline Landings](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2022.836043/full). The rig angles and timing are animation choices, rather than measured values from that study. [Little Kitty, Big City's animation account](https://www.gamedeveloper.com/art/deep-dive-how-little-kitty-big-city-rejects-realism-to-achieve-authenticity) supports judging the movement's rhythm and transitions alongside individual poses. Furniture rubbing follows the familiar-object marking behavior described by [Cats Protection](https://www.cats.org.uk/help-and-advice/cat-behaviour/pheromone-therapy).

Validation: all 23 focused cat/room checks passed. The new exploration check exercises actual native actor matrices for all three coats at 30/60/120 FPS, walking/crawling transitions, head/tail clearance, rubbing clips, exact completion and full-pose pause/resume. It also audits nine catalog table/desk models at four rotations. The real activity scheduler checks safe interruption of jumps, crawls and rubbing, including a queued room departure after resume. Blender deformation checks passed five poses in each of 45 clips for all three coats (675 samples). Type checking, lint, startup checks and whitespace checks passed. The broader game suite stopped at an unrelated puzzle navigation assertion in `check-pet-stat-animation.mjs` (`dismissTo` versus `path`) during concurrent navigation work.

A separate iPhone 18 Pro simulator and isolated Metro server were used to record sofa jumps, walking/running, desk crawling and sofa-edge rubbing with the production native renderer. Frame review included side-by-side jump poses before and after the refinement. The simulator fixture manually selected these sequences; autonomous selection and task priority were covered by scheduler tests. Temporary capture screens were removed afterward and the normal Home view was verified. The native startup portrait was refreshed against the new orange GLB, with its existing capture and branding pipeline.

To reproduce geometry and pose checks, run `node scripts/check-cat-exploration.mjs --preview` and `node scripts/check-cat-jump-anatomy.mjs`. The exploration recorder writes `/tmp/brainpet-exploration-{brush,crawl}.json`; `scripts/3d/render-cat-jumps.py` accepts `--exploration=brush` or `--exploration=crawl` after Blender's `--` separator to render those native poses.

## Back flexion, 19 October

The native actor now bends the existing weighted middle-back, chest and pelvis joints independently. Walking has a small sideways shoulder/hip sway, running adds stronger extension and flexion, and jump gathering rounds the middle back. Turns bend the chest toward the new direction while the hips follow. The stride clock drives gait flexion, and drawing-thread damping smooths changes of speed, direction and activity. The offsets settle after stopping, stay out of crawling and bed/bath interactions, and are disabled by Reduce Motion.

The first implementation re-solved the legs after rotating their parents. Pose comparisons caught a changed running swing near full extension. The final version counter-transforms the authored limb frames and neck before the existing contact IK runs. This retains the original navigation root, paw paths, soles and gaze while the torso skin bends above them. Room departures carry the current back offsets into the next actor alongside gait, stride and tail state; a fresh room does not begin with a rigid-back frame. This is a runtime addition, so it does not change the rig, GLBs or startup artwork.

Walking is deliberately quieter than running. The distinction is consistent with [English's study of the feline lumbar spine](https://onlinelibrary.wiley.com/doi/10.1002/jmor.1051650106), which describes the spine's different roles in symmetric stepping and faster asymmetric gaits. The chosen amplitudes are stylized animation settings, not measured anatomical angles.

`node scripts/check-cat-spine.mjs` compares the actual native actor with and without the added motion, for all three coats at 30/60/120 FPS. It checks back deformation, the curve into a moving turn, unchanged navigation/paw paths and gaze, full-pose pause and zero-time resume, settling after stopping, crawl clearance and Reduce Motion. The room-flow check also asserts that every transferred back offset survives the first frame at a different room scale. Focused gait, turn, jump, landing-to-walk, exploration, fluid-motion and task-chain checks cover the surrounding blends.

The spine check writes `/tmp/brainpet-spine-poses.json` and `/tmp/brainpet-spine-metrics.json`. Run `scripts/3d/render-cat-gaits.py -- --spine` with Blender to render close-up before/after comparisons of those native matrices. Side views expose the back silhouette; three-quarter views show lateral bending.

Validation passed for the new spine check and the focused gait, fluid-motion, turn, jump, landing-to-walk, exploration, room-flow and task-chain checks, plus type checking, lint and whitespace checks. Native simulator review used the normal Home screen on the isolated Cat QA server. Its recording showed floor exploration, the sofa approach and jump, a later chair visit and the return to floor movement without a runtime error. The sofa jump was inspected at 250 ms intervals. Close-up Blender comparisons used the same native bone matrices to inspect the back silhouette while the head and paw trajectories stayed fixed. No temporary game screen was added for this pass.

## Puzzle reactions, 19 October

Six notification performances are authored in `scripts/3d/puzzle_reactions.py` and baked by the Blender cat exporter onto all three coats. The revised acting pass gives each its own anticipation, held thought and recovery. `puzzleHighPaw` makes eye contact, shifts weight to three supporting paws, offers a higher paw with a wrist greeting, then slow-blinks. `puzzleProud` opens the chest, gives one deliberate nod and settles into a contented blink. `puzzleBounce` gathers weight on four planted paws, springs, absorbs the landing and makes a smaller rebound. `puzzleOops` briefly widens its eyes before looking down and reconnecting with the player. `puzzleThink` searches the clue, raises one brow, tilts its head and swivels an ear before a recognition lift. `puzzleRecover` lowers its posture, closes its eyes for an exhale, then lifts its chest and nods. Mistakes use concern without tears. Each performance lasts 3.25 to 4 seconds, plays once and returns to idle. The orange authoring rig, including the six editable NLA actions, is saved in `prototypes/cat-model/cat-orange.blend`.

Most happy beats retain open eyes. Closed crescents belong to particular smiles and slow blinks. Gaze, brows, whiskers, chest/pelvis, the offered wrist and the distal tail joints have separate authored offsets. Explicit eased poses and pauses replace repeated sine-wave gestures. The head leads emotional changes; ears and tail recover later. The native portrait camera stays fixed, and the gestures fit its existing crop.

`getPuzzleCompanionMessage` selects the clip from the puzzle and its entry progress snapshot. Retry attempts cycle through the three gentle reactions. High-paw wording selects the matching gesture, and milestones use the bounce. `PuzzleCatPortrait` shares playback between the result sheet and the inline mistake hint. The next/retry actions remain usable throughout playback. The native actor retains pause and Reduce Motion behavior, and simple graphics retains the existing still fallback.

Rebuild with `npm run assets:native`. Run `node scripts/check-puzzle-reactions.mjs` for selection, distinct poses, planted support paws, recovery, one-shot completion and Reduce Motion on every coat at 30/60/120 FPS. `scripts/3d/check-cat-skin-deformation.py` checks all 51 clips per coat. The notification iOS suite includes all six reactions, localized messages and repeated dismissal/navigation. All three native tests passed on the iOS 27 simulator. A comparison with the previous GLB found identical values in all 5,940 skeletal channels of the 45 existing clips.

For the visual review, run `scripts/3d/review-puzzle-reactions.py` in Blender with `-- --motion`, then `node scripts/3d/pack-puzzle-reaction-review.mjs`. Add `--authored` to inspect revised controls on the saved weighted rig before rebuilding GLBs. The review checks the portrait bounds at 25 times per clip and writes temporary rendered frames under `/tmp`. The animated comparison plays at 12 FPS with the actual clip durations, followed by a short rest, so anticipation and recovery remain visible. The compact animation, comparison image and native screenshots are in `docs/qa/puzzle-reactions/2026-10-19/`. The startup native still was also recaptured from the rebuilt orange model using paused production `NativeCatDisplay` playback, and the branding assets were regenerated from it.

## Jump silhouette refinement — 23 October 2026

`game_cat.py` now gives the upward push a deeper haunch load and a stronger nose-up extension. In flight, the forepaws retract while the hind paws gather higher beneath the belly; wrists and hocks fold, then flatten before contact. The tail trails the launch and its tip follows with a delay, returning during recovery. Jump-down retains its shallower preparation and downward reach. These changes are baked into all three native coats and the editable orange Blender source.

The root arc, flight duration, takeoff/contact phases and landing-to-walk handoff stay synchronized with the existing collision-checked routes. Review both sofa ascent and departure in the existing iOS simulator, and use `check-cat-jump-anatomy.mjs` plus the jump/landing/command regression suites to check support contacts and transitions.

## Connected movement refinement — 23 October 2026

Furniture approaches now try a collision-checked arrival curve that faces the takeoff. During the final 180 ms, a suitably aligned approach blends into the authored jump preparation and holds that pose across scheduler delay. The next jump continues at phase 0.08, preserving the loaded paws instead of restarting preparation. Blocked or short approaches retain supported alignment.

Queued floor movement can depart a landing through a safe curve. A short forward recovery step precedes the bend so the remaining planted paws stay within reach. The head anticipates the next route during landing and carries that gaze into the first stride. Tight or obstructed departures retain the supported turn.

The three native coats include `jumpOnLight` and `jumpOffLight`. Low-effort jumps select these separately baked poses, with less crouch, tuck and tail excursion; their requested duration is 10% shorter before the existing duration bounds. Height, distance, cat scale and required clearance determine effort. High jumps retain the full pose and every jump retains its validated arc and contact phases.

Supported turns now scale duration continuously with angle. A 45-degree adjustment takes 0.40 seconds, while 90/180-degree turns remain 0.64/1.12 seconds. Short placements lift less and use less body lowering. Minimum head/loading times preserve continuity when commands interrupt a small turn.

`check-cat-motion-flow.mjs` covers complete approaches, delayed prepared handoffs, light-clip support contacts and selection, curved landing departures, head continuity and exact completion on all three coats at 30/60/120 FPS. It is included in `test:game`. Native recordings and measurements are in `docs/qa/cat-motion/2026-10-23/`.

## Command acknowledgment — 24 October 2026

Explicit furniture commands now publish a brief directional acknowledgment independently of the movement scheduler. The ears perk and turn first, followed by a small head glance when the current pose permits it. Commands queued during a jump receive the ear response immediately; the head keeps its landing aim. Supported turns, crawling and contact performances retain their own head poses. A newer tap blends toward its target without restarting the travel clock or moving the support paws.

The cue fades after about 1.25 seconds. Pausing freezes it, stale cues do not replay on room mount, and Reduce Motion suppresses it. Ambient routines do not trigger the gesture. The existing jump completion and latest-command queue behavior remain in use. This is a runtime overlay on the existing rigs and does not rebuild the GLBs.

`node scripts/check-cat-command-attention.mjs` compares acknowledged and baseline native actor poses for all three coats at 30/60/120 FPS. Its 36 cases cover idle, walking, jumping and Reduce Motion, with rapid retargeting, unchanged root/paw matrices and activity clocks, completion, pause/resume and stale cues. Task-chain checks also exercise acknowledgment while a command waits for landing. Native review used the existing BrainPet Puzzle QA simulator, ordinary Home controls and Metro on port 8081. Captures and measurements are in `docs/qa/cat-attention/2026-10-24/`.

## Paw contact refinement, 24 October 2026

Object reaches now ease into a short contact and withdraw smoothly. Each forepaw aims at the object's near surface with a small pad clearance and elbow bend. The wrist retains its authored orientation. A swat commits to one point, so rolling balls and falling leaves can escape the paw instead of pulling the arm along. Losing the last leaf still allows the current reach to finish. Supported turns retain their planted paws.

Floor toys publish their current physical center to the cat. Approaches use reachable, collision-checked pawing positions. Ball impulses now require a moving paw to cross the contact surface; body proximity and periodic timers no longer launch them. The physical cat collider covers the torso, while navigation retains its larger head/tail clearance. Hanging toys receive directional impulses transformed into their own rotated frame. Stationary, retreating and teleported paws cannot repeatedly kick an object.

`check-cat-paw-contact.mjs` exercises the actual actor and all three shipped coats at 30/60/120 FPS. It compares complete support-paw matrices and wrist orientations against unmodified playback, bounds reach speed, verifies surface contact, committed swats, lost-leaf recovery, pause/resume and Reduce Motion. `check-native-room.mjs` couples the real cat and object callbacks to verify floor-ball hits and rejects proximity-only or stationary kicks; it also covers hanging toys, plant leaves, rotated/scaled objects and corners. The Bullet check tests that the torso leaves a nearby ball still before the paw impulse, then verifies rolling, rebounds and settling.

## Shoulder-supported back motion, 24 October 2026

The earlier back overlay counter-transformed each upper leg and the neck, leaving the shoulder line almost fixed. The revised pass runs after gait/turn foot placement and re-solves the legs to retain the original pad positions and sole orientations while allowing the chest and hips to move. The neck follows part of that translation while preserving gaze rotation. The existing weighted rig and all three GLBs remain in use.

Walking adds restrained support compression; the chest leads turns and the hips follow with slower damping. Toy swats now load the support side and round the back before the reaching paw arrives. Rest poses settle, and crawl/bed/bath exclusions and Reduce Motion remain. Captured turn/launch heights exclude the previous overlay so it cannot be applied twice. Landing-to-walk recovery suppresses downward gait arch until the supported first stride finishes.

Actual-rig comparisons, native simulator footage, research references and validation are in [the spine refinement review](qa/cat-spine-refinement/2026-10-24/README.md). The native review used the existing BrainPet Puzzle QA simulator and Metro 8081. The expanded spine test checks shoulder displacement as well as retained contacts; focused turn, jump, landing, room and object-contact checks passed.

## Alternating walking shoulders, 24 October 2026

The walking refinement adds alternating chest roll and forward shoulder travel, followed by a delayed pelvis twist. Stronger middle-back flex and support compression follow the stride. The legs retain their original pad positions and sole orientations through IK, while the neck counter-rotates to retain the gaze. The added walking alternation fades as running speed increases and settles at rest.

Blender skin weights now concentrate spine influence in the middle of the torso. Chest and pelvis influence increases toward the ends, making the back curve more visible. All three native coats and the editable orange source were rebuilt with unchanged skeletal animation channels. Generated branding assets were refreshed by the canonical export pipeline.

The final model was reviewed in the existing BrainPet Puzzle QA simulator with ordinary room commands. The [walking review](qa/cat-walking-shoulders/2026-10-24/README.md) includes a comparison with the previous implementation, native footage and validation results. The expanded spine check covers alternating shoulder loading, paw retention and full head orientation. All 795 sampled authored poses and 30 additional runtime walking poses passed mesh deformation checks.

## Head and tail follow-through, 24 October 2026

The neck now keeps a small delayed response to chest pitch, yaw and roll after stabilizing the gaze. The tail base follows hip yaw and back flex; the distal joints respond later. These offsets follow the rendered back pose, settle after movement, and transfer with the spine state between rooms. Existing attention and airborne expressions remain in use. Crawl, bed and bathroom motion exclude the added response, and Reduce Motion suppresses it.

The [head and tail review](qa/cat-head-tail/2026-10-24/README.md) records the comparison and focused checks. The spine check now requires head response and tail-tip delay while bounding amplitude and frame-to-frame changes. Paw paths, tail collision handling, room handoffs and pause/resume remain covered by the actor checks.

### Walking to rest

The head and tail retain their connection to the relaxing torso after the last stride. The head settles before the distal tail joints, and idle tilts and flicks blend in instead of appearing immediately. The stopping check covers normal arrival, interrupted strides and pause/resume on all three coats at 30/60/120 FPS. See the [existing simulator recording and QA notes](qa/cat-stopping/2026-10-24/README.md).

### Standing to walking

Ordinary floor departures capture the standing paws and release them into the first stride. The support pose follows those paw targets, the idle clip eases into walking over 0.22 seconds, and head/tail follow-through builds during the first step. Scripted routes and moving handoffs retain their existing contact handling. See the [first-step checks and simulator recording](qa/cat-starting/2026-10-24/README.md).

### Interrupted stops and restarts

A quick idle/walk reversal now retains the currently displayed clip mixture and stride phase. Stopping preserves the rendered contact and first-step offsets, then releases those local pose corrections over 180 ms. Another interruption captures that partially recovered pose. A stationary restart uses zero route-entry speed even while the back/head/tail response is still settling, and captures the current paws for its first step. Published paw positions include the final correction.

`check-cat-restarting.mjs` runs the production actor and shipped skeletons across all three coats at 30/60/120 FPS. It interrupts full strides and first steps after pauses from one frame to 240 ms, checks zero-time pose/root continuity, frame movement, floor clearance, pause/resume and exact final arrival. The check is included in `test:game`. See the [measurements and native simulator preview](qa/cat-restarting/2026-10-24/README.md).


## Varied bed naps

The reference study uses [Cats Protection’s sleeping-position guide](https://www.cats.org.uk/cats-blog/what-do-cat-sleeping-positions-mean), its [sleep guide](https://www.cats.org.uk/help-and-advice/cat-behaviour/cats-and-sleep), and [Purina’s body-language guide with Cats Protection](https://www.purina.co.uk/articles/cats/behaviour/understanding-cats/cat-body-language). Common physical patterns are paws tucked beneath a relaxed loaf, limbs drawn close with the tail wrapped in a curl, and side lying with relaxed extended legs. A pose alone does not determine a cat’s mood. We use the anatomy as animation reference rather than assigning emotional scores to poses.

The native rig now has three authored pairs in `scripts/3d/sleep_poses.py`: `restLoafEnter/Sleep`, `restCrescentEnter/Sleep`, and `restSideEnter/Sleep`. The compact crescent accommodates this character’s large head; the side sleeper uses unequal leg reaches and a supported cheek. Hips lower before shoulders, wrists fold, and the head settles last. The tail wraps through its own joints. Each reversible entry joins its four-second breathing loop exactly. Root translation remains owned by room navigation.

An independent nap counter advances without being consumed by other activities or repeated held-sleep commands. Room plans choose `sleepPose` once per nap and carry it through native preparation, repeated commands and interrupted returns. Chairs and covered beds use the compact loaf; open beds and sofas rotate through all three. Settling and uncurling take 2.2 seconds, followed by the existing waking stretch and safe exit. The logical `curlUp/curlSleep` activity names remain stable for navigation and quilt behavior.

`node scripts/check-cat-sleeping.mjs` checks the exported clips and production worklet for distinct silhouettes, matched endpoints, breathing, pause and waking at 30/60/120 fps across all three coats. Room-activity regressions cover variant selection and retention. Native visual review uses the existing BrainPet simulator. The 2026-10-24 run checked all three poses on the green bed beside the fireplace, including repeat sleep and complete wake/stretch/exit cycles.

Demonstration media is disposable. Review captures in temporary storage and delete them after testing; do not retain new preview images or recordings in the repository. Previous cat demonstration media was removed at the user’s request.

The settling entry carries the head with the descending chest before adding the final nod. The neck follows that same motion directly instead of applying a second delayed blend. Hind paws tuck first, followed by the left and right front paws at separate times. Reversed entries retain the same supported sequence for waking. The sleep check bounds head-to-chest separation during descent and requires separate front-paw tuck timing.

Follow-up visual review of the revised entry used the existing simulator’s Green Bed. Reviewed the loaf descent at 0.2-second intervals, held rest, reversed rise, waking stretch and jump to the floor. All three variants and coats passed the animation checks; all 59 clips per coat passed five-sample skin-deformation checks. Temporary review media was deleted afterward.

Curled and side naps share the neck bend between chest and skull. The curled chest turns toward the head, while the head uses a smaller turn and the forearms retain cushion clearance during their tuck. Side sleep first lowers the torso, then rolls onto its flank; the head follows that roll, the legs reach farther from the belly, and the tail rests in a loose curve beside the haunches. Lower-face skin weights now keep the chin on the skull, with the neck blend behind the jaw.

Regression checks cover the order of lowering and rolling, neck/head roll agreement, the curled head turn, distinct tail placement, and skull-bound chin vertices. Mesh checks sample 41 frames through each sleep entry to catch intersections between the usual quarter-cycle samples.

The revised curled and side poses were tested on the Green Bed in the existing BrainPet Reward Contact QA simulator. Both completed settling, held sleep, waking, stretching and return to the floor using normal room commands. Close-up frame review confirmed the curled head and paw tuck, and the side sleeper's descent before rolling and unrolling before standing. Sleeping, waking, jump and skin-deformation checks passed for all three coats; TypeScript and the sleeping-check lint passed. Temporary recordings and preview images were deleted after review.

### Gentle waking

Completed naps use `restLoafWake`, `restCrescentWake` and `restSideWake`. These begin in the exact sleeping pose and lift the head over the first 0.53 seconds while the chest, hips and tucked paws stay supported. The eyes open during that lift. The body then unrolls and rises into the existing planted-paw stretch; the chin follows the shoulder bow and recovers slightly later, with a small tail response. The full rise still takes 2.2 seconds and the stretch takes 2.5 seconds before departure.

An interrupted settling motion continues to reverse its entry from the displayed pose. Repeated wake commands retain progress through the authored wake clip. The sleep regression checks the head lift in the exported clip and native playback, stationary body support during that lift, exact endpoints, pause/resume, repeated commands and interrupted tucks. Skin checks sample 41 frames through both settling and waking.

Simulator review exposed a timing race where a delayed sleeping position report could replace the new wake-up clock. Position reports now carry their command revision, and the RN receiver discards reports from earlier commands. The room scheduler also checks the activity key, covering the gap before React publishes a newly started step. Regressions delay delivery across both handoffs and verify that only the current wake reports update the clock.

Final visual review used normal room commands on the Green Bed in the existing BrainPet Reward Contact QA simulator. Loaf, curled and side naps each completed the head lift, rise, planted-paw stretch and exit to the floor. Dense frame review confirmed that side waking no longer skips the supported head lift and unroll. Sleeping and waking checks passed for all three coats at 30/60/120 FPS, all 62 clips per coat passed skin-deformation checks, and the native-room, room-activity, TypeScript and scoped lint checks passed. Temporary recordings, extracted frames and previews were deleted after review.

### Kitchen detours and low passages

The saved navy kitchen exposed a fridge approach failure: its six front-side destinations overlapped the island or dining chairs, even though a walking route around the island reached the hinge side. Fridge approaches now also sample beyond the open door tip, retaining the full door-swing clearance. Kitchen approach discovery can use the same furniture crawl and step connections as the route executor when floor-only searches fail.

Raised fridge doors expose straight crawl connections when their underside clears the authored crouch, including a headroom margin. The cat lowers before entering the swing area and stays low until it has cleared it. Crawl and flight checks include the moving door's vertical span; a jump cannot bypass the door check. The current saved kitchen's door is too low for this crouch, so that layout uses the walking detour without moving furniture or shrinking the cat.

The existing BrainPet Furniture Smoothness QA simulator completed fridge investigation and return to the cat's floor spot in the unchanged kitchen. Regression checks cover that layout at three viewport heights, collision clearance along the entire detour, kitchen destinations reachable only beneath furniture, both fridge hinges at four headings, and rejection of low gaps. Native actor checks verify head, back and tail clearance beneath a raised door in both directions for all three coats. Room activity, locomotion, exploration, fridge, performance, TypeScript and scoped lint checks passed. No new demonstration media was retained.

### Returning to a dining chair

The front padded chair beside the saved kitchen island was reachable on the floor, but its landing was rejected against the adjacent tabletop. Dining-chair jumps now distinguish the gathered legs from the wider torso above a low table edge. Clearance derives from the same compact stance used by the actor. Small cushion offsets are tried only when all four round paw pads remain supported, and both the incoming and outgoing jump must pass collision checks. Higher obstacles retain the full body clearance.

Chained fridge commands also preserve the chair's identity while waking and jumping down. Previously, the fridge-open requirement was incorrectly applied to those chair exit steps.

`node scripts/check-kitchen-chair-navigation.mjs` exercises fridge → front chair nap → wake → floor → fridge in the saved layout at three viewport heights. It checks actual actor completion, rendered landing pads against the cushion ellipse, continuity between steps, and occupied-seat rejection. The existing BrainPet Furniture Smoothness QA simulator completed the same sequence with normal object menus and unchanged furniture placement. Room-activity, rocking-chair, performance, TypeScript and scoped lint checks passed. Temporary debug files were deleted; no demonstration recordings were retained.
