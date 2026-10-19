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

# Catalog performance

Shop and decoration pickers use two-column virtualized lists, starting with six cards. Catalog pictures are still images; opening a detail preview mounts its native scene. The splash loader downloads catalog images and warms the Expo Image memory/disk cache. Decoded startup thumbnails have a 12-million-pixel budget, about 46 MiB for RGBA pixels. Larger images stay on disk. Native scene models remain bounded and load on demand.
