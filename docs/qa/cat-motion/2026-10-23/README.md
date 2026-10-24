# Cat motion validation, 23 October 2026

The [movement study](../../../art/cat-motion-study.md) explains the references, audit and implementation decisions.

## Automated checks

Passed:

- `node scripts/check-cat-anticipation.mjs`
- `node scripts/check-cat-locomotion.mjs`
- `node scripts/check-cat-gaits.mjs`
- `node scripts/check-cat-jumps.mjs`
- `node scripts/check-cat-jump-anatomy.mjs`
- `node scripts/check-cat-landing-walk.mjs`
- `node scripts/check-cat-turning.mjs`
- `node scripts/check-cat-fluid-motion.mjs`
- `node scripts/check-cat-spine.mjs`
- `node scripts/check-cat-exploration.mjs`
- `node scripts/check-cat-command-motion.mjs`
- `node scripts/check-cat-task-chains.mjs`
- `node scripts/check-cat-room-flow.mjs`
- `npm run animations:check`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`

After the final duplicate-waypoint guard and already-safe-pace optimization, anticipation, locomotion, gait and room-flow checks were rerun, along with type checking and lint. The full unrelated puzzle/backend suite was not run for this change.

The new actor regression covers 18 combinations: three coats, three frame rates and direct versus linked routes. The head leads the body by at least 0.099 radians before the chosen corner while body yaw is still below 0.03 radians. Maximum measured drift of a continuously planted paw is about 0.00000142 cat-scale units. These results come from the production worklet running against the shipped skeletons in the test environment. [Numeric results](metrics.json).

The repeated waypoint case verifies identical pace on both copies. The velocity tests check nonzero incoming/outgoing rates, no backward movement, continuous acceleration at ramp boundaries and finite progress with a disabled ramp. The route tests verify braking before a narrow patch and the interpolation's acceleration bound at two scales for every gait.

Existing regressions cover scaled/rotated furniture, source and destination supports, forepaw/hind-paw landing order, moving command replacement, clearance, complete-pose pause/resume, Reduce Motion, safe crawl/rub interruption and four-room handoffs. The new code does not replace these checks with endpoint-only assertions.

## Visual review

[Turn sequence](turn-sequence.png): Blender renders of production actor matrices and the shipped orange skin. Frames run from 1.2 to 4.0 seconds, left to right, top to bottom. The head begins looking into the bend before the body follows; foot support and the existing spine/tail response remain visible. Reproduce with `check-cat-anticipation.mjs` and `render-cat-gaits.py -- --anticipation`.

Native review used the existing **BrainPet Puzzle QA**, an iPhone 18 Pro simulator running iOS 27.0, with the normal Home screen and the workspace's Metro server. No temporary screen or save fixture was added to the repository. A separate simulator initially created for isolation was removed at the user's request before the completed native review.

- [Sofa approach and arrival](native-sofa-sequence.png): the real Sofa menu's Sit action walked from the fireplace side, approached the sofa, jumped onto the cushion and reached the seated pose. Frames are at 27 through 34 seconds in the recording.
- [Sofa departure and floor movement](native-departure-sequence.png): the Blue Ball menu's Play action caused the cat to leave the cushion, land, and continue toward the toy. Frames are at 6, 6.5, 7, 7.5, 8, 9, 10 and 12 seconds in the recording.

Frame review showed continuous approach, supported seating and departure into floor movement, without an error screen or visible teleport in these sequences. The raw recordings are `/tmp/brainpet-cat-polish-native.mp4` and `/tmp/brainpet-cat-polish-departure.mp4`. The image grids crop only the room from those recordings.

This is simulator and deterministic rig validation. Physical iOS/Android frame time, device thermals and Android visual behavior were not measured. The conservative floor footprint remains a known limitation for very tight passages; this change does not introduce a full orientation-aware quadruped planner.

## Follow-up: stop-and-shuffle direction changes

The actor now uses walking curves for ordinary standing departures and collision-safe U-turns for longer reversals. Supported pivots remain for tight spaces, short moves and precise interaction alignment.

`check-cat-walking-turns.mjs` passed all 54 combinations of three coats, 30/60/120 FPS, standing/moving starts and -90/90/180-degree changes. Translation began within 0.009 seconds in every case, with no stopped frame inside the turn. Maximum continuously planted paw drift was 0.00000122 cat-scale units; maximum measured heading change per second was 4.18 radians. These are deterministic production-worklet measurements, not native frame-time measurements. [Full metrics](walking-turns-metrics.json).

The check also verifies blocked-side reversal fallback, complete blockage, short moves, perches, jump alignment, resumed routes, seated starts, Reduce Motion, exact endpoint/completion and pause/resume. It is registered in `test:game`.

After this follow-up, walking-turn, locomotion, fluid-motion, command-motion, anticipation, supported-turn, landing-to-walk, room-flow and task-chain checks all passed, along with type checking, lint and `git diff --check`.

[Walking turn poses](walking-turns-sequence.png) show the shipped orange rig: a quarter-turn at 0/0.6/1.2/1.8 seconds in the first row, then a half-turn at 0 through 4.2 seconds in 0.6-second increments. The camera follows the root, so use the grid and paw poses to judge support. Reproduce with `node scripts/check-cat-walking-turns.mjs` and `render-cat-gaits.py -- --walking-turns`.

[Native departure](native-walking-turn-sequence.png) shows the existing BrainPet Puzzle QA simulator running the normal Blue Ball → Play with a toy interaction. Frames run from 4 to 7.5 seconds in half-second intervals, covering the response, direction change and movement toward the toy. The source recording is `/tmp/brainpet-walking-turn-native.mp4`. No simulator, app fixture or Metro instance was created for this follow-up.

## Supported pivot revision

The walking-curve change above left stationary footwork untouched. The subsequent revision replaces that footwork with staggered diagonal steps, deeper body lowering to keep the larger steps reachable, slower head blending during interruptions and a longer settling motion.

| Turn | Previous placements / duration | Revised placements / duration |
| --- | --- | --- |
| 90 degrees | 8 / 1.04 s | 4 / 0.64 s |
| 180 degrees | 16 / 1.84 s | 8 / 1.12 s |

The [native comparison](pivot-before-after.gif) is a three-second loop at 20 FPS. Left is the old supported pivot; right is the final revision. The recordings use the same existing BrainPet Puzzle QA simulator and normal Home renderer. A temporary repeated-heading fixture and visible BEFORE/AFTER label confirmed which code was loaded. Both were removed after capture, and the app was restarted into normal gameplay. Early unlabelled captures were discarded because they did not reliably show the edited build. Daytime lighting was selected through the existing room clock for the final recording.

The comparison takes frames 65–124 from `/tmp/brainpet-pivot-before-confirmed.mp4` and 60–119 from `/tmp/brainpet-pivot-final-confirmed.mp4`, sampled at 20 FPS. Both crops include a short rest before anticipation, aligned within one sampled frame. Playback speed is unchanged. The crop is enlarged equally on both sides; it does not move with the cat.

The final settling adjustment passed `check-cat-turning.mjs` on orange/grey/white at 30/60/120 FPS and scales 0.3/0.8. Checks retain exact target reach, planted sole orientation, opposite-corner support, head continuity, short first strides, turn-to-walk overlap, interruption and pause/resume. `check-cat-pivot-rhythm.mjs` counts actual lift events, checks the supported footprint and is registered in `test:game`. [Rhythm metrics](pivot-rhythm-metrics.json).

Landing-to-walk, command-motion, type checking, lint and whitespace checks passed after the final adjustment. Jump anatomy and walking-curve regressions also passed during this revision. Blender review used the actual production matrices and shipped skin; the preview now preserves the first skeletal entity when eye meshes share bone names, matching the native actor.

After the clean restart, the normal Sofa → Sit interaction completed from the toy area: direction change, walking approach, cushion jump and seated arrival. [Approach frames](pivot-sofa-approach.png) are at 13, 13.5, 14, 14.5, 15, 16, 17 and 18 seconds in `/tmp/brainpet-pivot-normal-final.mp4`; the seated arrival is visible by 20 seconds and remains stable through the end of the recording. The app is left in normal gameplay with the final implementation loaded. [Final rig poses](pivot-rig-sequence.png) provide a closer view of the revised quarter- and half-turns.

## Jump pose refinement

The follow-up changes are authored in `scripts/3d/game_cat.py` and baked into the three native GLBs plus `prototypes/cat-model/cat-orange.blend`. The upward preparation loads the haunches more, the flight gathers both pairs of legs more tightly, the wrists/hocks fold and unfold, and the tail trails the jump with delayed tip recovery. Downward jumps keep their shallower load and downward reach. Root travel and contact clocks are unchanged.

`jump-before-after.gif` compares ordinary Sofa → Sit commands in **BrainPet Puzzle QA**, the existing iOS simulator, before/after the asset rebuild. Both halves use the same fixed crop at 2× enlargement and 20 FPS, with 50 ms per frame (2 seconds total, normal speed). The clips are aligned at takeoff; their earlier walking/turning approaches differ. The altered tail silhouette confirms the rebuilt asset is being displayed. No temporary renderer fixture or extra simulator was used for this jump review.

Raw recordings are `/tmp/brainpet-jump-polish/before-native.mp4` (excerpt 10.4–12.4 s) and `after-native.mp4` (14.6–16.6 s). `final-down-native.mp4` records the corrected Sofa → Blue Ball, including cushion departure, fore/hind landing and the following walk. `jump-down-sequence.png` samples that recording; labels are relative to its 21.1-second mark. All three jump clips were also inspected as actual actor matrices rendered in Blender with the real sofa, using a baseline saved before these edits.

The visible improvement is strongest in flight: the cat draws its legs beneath itself and its tail follows the arc instead of remaining upright. Contact and recovery retain the existing fore-first sequence.

The first pass exposed a 0.015-unit hind-paw displacement at downward takeoff in the anatomy test. Restoring the shallow pre-takeoff pitch corrected that overextension; the stronger airborne tuck and trailing tail remain. This correction affects jump-down preparation only, so the recorded jump-up comparison remains representative.

Final validation passed: `check-cat-jump-anatomy.mjs`, `check-cat-jumps.mjs`, `check-cat-landing-walk.mjs`, `check-cat-command-motion.mjs`, `check-cat-walking-turns.mjs`, `npm run animations:check`, `node scripts/3d/verify.mjs`, typecheck and lint. Task-chain checks also passed during the pose revision. The full animation suite exposed a route-array prototype assumption in the earlier steering work; `movingCatRoute` now copies shared route coordinates into plain arrays before its JS-side helpers. Its existing serialized-array rerouting regression passes.

`jump-pose-metrics.json` records the final nine clip/coat combinations, including source-paw contact error, gathered paw heights and tail trailing distance. The final simulator pass verified the corrected jump-down followed by ordinary walking/play; no temporary preview code remains.

## Connected movement: approach, recovery, effort and compact turns

This pass connects the actions and adjusts their effort:

- The planner tries a safe arrival curve facing the jump. Aligned walks load the jump during their final 180 ms and hold that pose across delayed JS dispatch; the jump continues at phase 0.08. Eighteen production-actor cases (three coats, three frame rates and two approach sides) measured a maximum handoff paw displacement of 0.0000000052 cat-scale units. These are rig measurements, not native pixel measurements. [Approach metrics](motion-flow-metrics.json).
- Queued floor journeys can follow collision-checked curves after landing. A forward recovery step precedes the bend, preserving reach for planted feet. The landing head turn carries into the first stride. The initial immediate-curve version failed the planted-paw regression; the forward step corrects that failure. Short or obstructed departures retain a supported pivot.
- New `jumpOnLight`/`jumpOffLight` actions are baked into all three native GLBs and the orange Blender source. Low-effort jumps use 58% of the main pose offsets and a 10% shorter requested duration, subject to the existing timing limits. The same arc and contact phases remain. Tests verify actual light-clip selection, smaller flight gathering, and fixed supporting paws through takeoff and touchdown.
- Small supported turns use continuous angle-dependent timing and lower foot lifts. A 45-degree adjustment takes 0.40 seconds (previous pass: 0.64); 90/180-degree turns retain 0.64/1.12 seconds and four/eight placements. Minimum anticipation/loading times removed the head discontinuity found during interrupted small turns. [Compact-turn metrics](compact-turn-metrics.json).

`check-cat-motion-flow.mjs` is registered in `test:game`. It covers complete prepared approaches, dispatch delays, exact jump arrival/completion, light-clip contacts/selection, curved landing departures and the first-frame head handoff for orange/grey/white at 30/60/120 FPS. The final flow, landing-to-walk, walking-turn, supported-turn, pivot-rhythm, command-motion, jump, jump-anatomy, task-chain, furniture-perch, furniture-transfer, close-jump and rocking-chair checks passed. `animations:check`, native asset verification, TypeScript, lint and whitespace checks passed as well.

Native review used the same **BrainPet Puzzle QA** simulator and Metro on port 8081. Normal Sofa → Sit, Blue Ball → Play, and Oak rocking chair → Sit interactions exercised complete approaches, jumps, supported turns and departures. No simulator or review screen was created. The final [six-second native loop](connected-movement.gif) and [quarter-second frames](connected-movement-sequence.png) show floor recovery, reorientation, the next takeoff and supported cushion arrival. They use 23.5–29.5 seconds from `/tmp/brainpet-motion-flow/final-sofa.mp4`, at 20 FPS with a fixed 2× crop and unchanged playback speed. These are current-build footage, not a before/after comparison.

Other raw review recordings are `/tmp/brainpet-motion-flow/up-native.mp4`, `down-native.mp4` and `chair-down-final.mp4`. The chair recording preceded the final head-carry adjustment; the final sofa loop includes it. The review found readable crouch/push/gather/reach poses and supported turns without repeated microsteps. Tight paths still use deliberate supported alignment where a curve cannot fit.
