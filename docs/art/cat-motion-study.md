# Cat movement study, 23 October 2026

This review covers room pathfinding, walking/trotting/running, moving turns, jumps between supports, crawling, planted paws, secondary motion, interruptions and room handoffs. The game already implements much of the relevant animation practice. The changes from this study address predictive speed control and gaze, plus the acceleration discontinuities at the beginning and end of a walk.

## What the references support

| Primary source | Relevant finding | Decision for BrainPet |
| --- | --- | --- |
| [BlueTwelve, making Stray](https://www.unrealengine.com/developer-interviews/28-people-and-two-cats-inside-the-making-of-stray), 2022, and [the studio's PlayStation account](https://blog.playstation.com/?p=367025) | Animator and programmer repeatedly refined basic movement, jumps and transitions using real cats as reference. The published accounts describe priorities, not a reproducible navigation algorithm. | Judge complete journeys and interruptions. Keep dependable landing targets and exact completion while refining how the cat gets there. We do not claim to reproduce Stray's solver. |
| [Little Kitty, Big City animator Micah Breitweiser](https://www.gamedeveloper.com/art/deep-dive-how-little-kitty-big-city-rejects-realism-to-achieve-authenticity), 2024 | Frame-by-frame reference, whole-body rhythm and adaptation to the character's proportions matter more than literal realism. The pose between key poses contributes to the impression of weight. | Keep the stylized cat and its authored gait/jump poses. Improve the timing between poses and the head's anticipation instead of adding exaggerated motion everywhere. |
| [Little Kitty, Big City creator Matt T. Wood](https://www.gamedeveloper.com/design/how-little-kitty-big-city-was-designed-to-steal-hearts-and-fish), 2024 | Wood describes combining handmade animation with dynamic bone movement to obtain curved feline motion in changing situations. | Continue the existing hybrid of authored clips, procedural spine/head/tail motion and contact correction. Give the head a farther route target than the body. |
| [Craig Reynolds, steering behaviors](https://www.red3d.com/cwr/steer/gdc99/) and [arrival demonstration](https://www.red3d.com/cwr/steer/Arrival.html), 1999 | Steering separates navigation intent from the means of locomotion. Arrival accounts for limited agility and reduces speed before reaching the goal. | Propagate upcoming corner and clearance restrictions backward along the safe path. Speed up gradually after passing the restriction. Collision-safe geometry still determines where the cat may move. |
| [Tobias Karlsson, On All Fours](https://www.gdcvault.com/play/1023433/On-All-Fours-Creating-Realistic), GDC 2016 | The session abstract explains why a circle alone poorly describes an elongated quadruped in narrow passages. | Audit whole-body traversal and conservative clearance, not only root positions. Existing swept crawl/jump tests remain essential. The full talk was unavailable during this review because GDC Vault redirected to maintenance; no undocumented algorithm is inferred from it. |
| [Epic, distance matching](https://dev.epicgames.com/documentation/en-us/unreal-engine/distance-matching-in-unreal-engine) and [stride warping](https://dev.epicgames.com/documentation/unreal-engine/pose-warping-in-unreal-engine) | Animation playback or stride can follow actual displacement, including distance to a landing surface. | Retain the game's distance-driven gait phase. Slower travel must also slow the paw cycle; independently easing only the visible root would cause skating. |
| [Epic, motion warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine) | Target alignment belongs to defined animation windows. | Preserve supported launch alignment, the validated flight envelope and explicit landing recovery. New gaze anticipates floor turns without moving the root or changing a landing target. |
| [Daniel Holden, Spring-It-On](https://www.theorangeduck.com/page/spring-roll-call), 2021 | Fixed per-frame interpolation depends on frame rate. Exponential damping and spring formulations offer time-based smoothing and transition continuity. | Keep exponential damping for gaze and secondary motion. For scheduled root travel, integrate cubic velocity ramps analytically so starts and stops have continuous acceleration and still finish at the scheduled endpoint. This polynomial is our implementation choice, not Holden's spring algorithm. |
| [Xu et al., adaptive feline landings](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2022.836043/full), 2022 | Cats adjust landing posture and absorb impact through limb flexion; forelimb and hindlimb contact occur in sequence. | Retain hind-leg propulsion, gathered flight, forepaw reach, shoulder compression and later hind-paw contact. Test both ascent and descent, then the supported transition into walking. Biological sequencing informs the pose, but our amplitudes and timings are stylized. |

## Audit of the game

| System | Existing behavior and review result |
| --- | --- |
| Room navigation | Grid search, line-of-sight simplification, collision-checked corner rounding and moving-route joins. Planning occurs when a route changes. Keep collision checks on every rounded chord. |
| Gaits | Task-dependent maximum pace, clearance/curvature restrictions, distance phase and gait hysteresis. The gap was that a local restriction could demand a large speed change within one sample interval. |
| Starts and stops | The integrated linear velocity ramp preserved position and velocity, but switched acceleration abruptly at launch, cruise and arrival. |
| Turning and attention | Supported turns already step their paws. Moving gaze used the same short prediction as the body, making the head mostly react to an existing heading error. |
| Jumps | Shared collision/playback trajectory, arc-dependent duration, separate takeoff and touchdown windows, supported alignment and landing-to-walk recovery. Preserve these and rerun the shipped-rig tests. |
| Contacts and spine | World-space paw contacts, corrective steps before overextension, and spine offsets that preserve limb/gaze frames. Any timing change must pass the actual contact checks. |
| Other room behaviors | Crawling uses head/body clearance; rubbing and jumps defer interruption to safe exits. Resting looks, ear reactions, tail balance and waking already have separate clocks and gating. |
| Lifecycle | The renderer owns completion. Room entry carries gait, speed, phase, spine and tail state. Pause and Reduce Motion affect the whole pose. Preserve these contracts. |

## Implemented changes

`utils/native-cat-locomotion.ts` now integrates a cubic velocity transition during acceleration and braking. Its area matches the previous ramp, so the existing duration and doorway exit-rate calculation remain valid. Initial and final rates still carry momentum across route replacements and room thresholds. A zero-length ramp returns finite linear progress.

After computing local curvature and clearance limits, `catWalkTiming` makes backward and forward passes over the path. Each pass can only lower speed. Because playback interpolates time per distance, the planner bounds the acceleration of that interpolation, including its faster endpoint. A short bisection solves the bound when necessary. This work runs during route preparation, never per rendered frame. Braking uses 6 and acceleration uses 5 world units per second squared multiplied by cat scale. These are game settings, not measured feline physiology.

The native actor keeps its existing 100 ms body prediction and samples a separate gaze target 350 ms ahead. Head yaw is limited to about 22 degrees and fades near arrival. Existing exponential damping smooths direction changes. Supported stepping turns and crawls retain their own pose handling; Reduce Motion disables the additional gaze. Direct floor routes and walking legs inside traversal routes use the same prediction.

No animation assets or rig weights changed. The existing jump mechanics remain in place and were revalidated with the new approach/departure timing.

### Walking direction changes

The follow-up review found that standing departures always used a supported pivot when their heading changed by more than 0.35 radians. The pivot schedules four individual paw placements for each 45-degree increment, so a half-turn can take sixteen placements before walking. That is useful for precise support alignment but looks hesitant on open floor.

Standing idle/completed-walk departures now use the collision-checked steering path when the trip is at least 2.5 cat-scale units. Moving route replacements also support reversals on trips of at least 3.5 cat-scale units. A reversal uses two cubic curves with a shared sideways tangent; a single cubic can fold back into a cusp for a destination directly behind the cat. If furniture blocks the preferred shoulder, the planner tries the opposite side. Every new chord and the join back to the original route must clear the normal body envelope. The requested endpoint is unchanged; timing is recomputed for the actual curve.

These departures use the ordinary distance-driven gait and planted-paw correction. Standing starts accelerate from zero; moving replacements retain speed and foot phase. Seated poses, short repositioning, perches, jumps, contact passes, complex traversal routes and blocked curves retain supported alignment. Reduce Motion keeps its existing behavior. Zero-time redraws of unchanged commands now retain the displayed pose instead of re-solving contact IK on resume.

`scripts/check-cat-walking-turns.mjs` exercises left/right quarter-turns and half-turns from standing and moving states on three skins at 30/60/120 FPS. It checks continuous translation, bounded frame-to-frame yaw, fixed contacts, obstacle-side fallback, exact endpoint/completion, pause/resume and excluded actions. Reproduce the rendered walking turns (preview removed) with this check followed by `render-cat-gaits.py -- --walking-turns`.

### Supported pivot footwork

The plush mesh exposed excessive reach in the earlier 90-degree paw placements. Supported pivots now alternate diagonal support in placements of at most 30 degrees. The same 0.64-second quarter-turn and 1.12-second half-turn clocks drive the faster cadence. The body lowers by at most 0.055 rig units rather than 0.18. The rhythm check also measures the rendered shoulder-to-paw reach, body drop and separation between paired mittens, with limits of 0.22, 0.07 and 0.30 rig units respectively. Planted paw positions and sole headings remain fixed.

Walking curves now use a local stride limit derived from path curvature, with a minimum stride of 0.36 rig units. The actor preserves phase while changing stride and restores normal stride gradually after the corner. Path timing also limits angular speed. Contact correction remains active after the first step even while stride length is reduced, and lifts a supporting paw before its shoulder crosses too far sideways. Torso steering bend is capped at 0.22 radians before the spine response. Standing curved departures choose the inside forepaw as the lead, avoiding the previous right-turn crowding caused by always choosing the left lead.

The turn-to-walk regression exposed the authored walk's concentrated quintic swing after its first touchdown. Supported-turn departures now spread 40% of that quintic swing into a cubic profile, preserving endpoints and stance velocity while lowering peak paw speed. This applies through subsequent walking swings so there is no correction discontinuity at the end of launch. Straight starts retain the authored gait. Idle-to-walk commands also retain pose recovery so residual head and tail motion cannot pop when the first step starts.

The production-actor checks cover all three coats at 30/60/120 FPS, exact arrival, continuous touchdown, interruptions, pause/resume and Reduce Motion. Walking-turn regressions now measure paw side ordering, mitten footprint clearance and lateral reach throughout both standing and moving turns.

## Measurement and review

A controlled 12-body-length straight running route has a narrow patch at its midpoint. At cat scale 0.4, the original local pace field demanded a peak acceleration magnitude of 68.57 body lengths per second squared. The new field peaks at 6.00. The full scheduled duration changes from 4.161 to 4.678 seconds. These are analytical measurements of the planned local pace field, not physical-device performance or a claim that every runtime transition is bounded by the same number. Incoming route momentum and the outer start/stop ramp also affect actual acceleration.

`scripts/check-cat-anticipation.mjs` checks boundary velocity and acceleration, monotonic progress, braking before the narrow patch, acceleration bounds between samples, angular wraparound, and exact arrival. Its production-actor checks run direct and linked routes on all three coats at 30/60/120 FPS, measuring planted-paw drift, head anticipation, pause/resume and Reduce Motion. It is included in `npm run test:game`.

The rendered sequence (preview removed) uses the shipped orange skin and matrices from the actual actor test. The [metrics](../qa/cat-motion/2026-10-23/metrics.json) retain the numeric results. Rendered frames show the gaze leading the bend and the paws remaining supported as the body turns. They do not substitute for a native renderer or physical-device performance test.

Reproduce the isolated sequence with:

```sh
node scripts/check-cat-anticipation.mjs
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 2 \
  --python-exit-code 1 --python scripts/3d/render-cat-gaits.py -- --anticipation
```

The renderer writes frames under `/tmp/brainpet-anticipation-review`. Detailed validation results are recorded in [the QA note](../qa/cat-motion/2026-10-23/README.md).

### Jump follow-up

A native before/after review found that the short airborne phase still resembled a raised standing pose. The authored jump clips now separate the hind-driven launch, tucked flight and reaching poses more clearly. Both pairs of paws fold beneath the torso, the wrists/hocks unfold before contact, and the tail trails the launch with delayed tip recovery. The existing root arc and fore/hind contact schedule remain intact. This applies the whole-body silhouette and sequencing principles above; amplitudes are adjusted for our short stylized cat and checked in the existing simulator. See the jump recording in `docs/qa/cat-motion/2026-10-23/`.

### Connecting the actions

The next pass applies those principles to complete sequences. The approach aims into the takeoff and begins loading during the last step; jump playback continues that same pose. Landing gaze anticipates the next route, and a short recovery step gives the support feet time to release before a walking curve. Smaller jumps use lighter authored actions rather than blending the airborne skeleton toward an idle stance. Small supported turns use shorter timing and lower paw clearance, while keeping diagonal support. Clearance failures retain the existing supported fallback. See the connected-movement section in the QA record for measurements and native recordings.

## Cartoon leg and gait review, 15 November 2026

The visual target is a rounded cartoon companion. Evaluate appealing silhouettes, readable weight changes and smooth action transitions; an anatomical similarity percentage does not measure those qualities. Keep the large head, compact torso, coat designs and rounded paws. The reported problem is the appearance of the leg bends, especially while moving.

### Reference findings and application

- [Micah Breitweiser, Little Kitty, Big City animation breakdown](https://www.gamedeveloper.com/art/deep-dive-how-little-kitty-big-city-rejects-realism-to-achieve-authenticity) describes using continuous body curves and expressive poses with a simple skeleton and foot IK. Our application is to refine the existing character's silhouette and movement, with visibly different support and swing poses. Increasing rig complexity alone does not establish appeal.
- [Matt T. Wood on Little Kitty, Big City's development](https://www.gamedeveloper.com/design/how-little-kitty-big-city-was-designed-to-steal-hearts-and-fish) describes combining handmade animation with dynamic bone motion. Our baked paw poses and runtime body, gaze and tail responses already use that division. Changes must be reviewed with the runtime overlays active, rather than only in the authoring scene.
- [Don Kim's quadruped walk tutorial](https://www.animationmentor.com/blog/tutorial-how-to-animate-a-quadruped-walk-cycle/) distinguishes the front paw's ankle/toe break from the rear foot, and connects support shifts to the shoulders and hips. The tutorial uses a dog; we apply its posing workflow to our cat rather than adopting its gait literally. The exported cat previously discarded the paw rotations calculated by its controls. Walk, trot and run now retain the airborne curl and return to level pads during stance.
- [Steve Cady's quadruped workflow](https://www.animationmentor.com/blog/how-to-animate-quadruped-walk-cycles-with-a-jurassic-world-animator/) starts with full-stride and passing poses, then refines the body before secondary movement. Review our side and three-quarter views at contact, passing and extension, followed by complete journeys. A smoother interpolation curve alone cannot rescue a poor pose.
- [Kitbull director Rosana Sullivan's interview](https://www.animationscoop.com/interview-writer-director-rosana-sullivan-and-producer-kathryn-hendrickson-discuss-pixars-kitbull/) emphasizes eyes and body language for a simplified character. Preserve our face and readable head direction while adjusting the legs; the character's expression is part of the result.

These are animation references, not imported meshes, rigs or clips. The game's character remains original. No numerical match to another game's animation has been measured.

### Implementation and review criteria

The leg mesh now distinguishes the fuller upper leg, tapered lower leg and round paw. The front elbow and rear knee sit slightly higher, and skin-weight blending follows the revised bend height. The two-segment authoring solver also respects the minimum reachable distance for unequal limb lengths.

Walking uses a slightly higher body position and less lateral roll. This reduces the permanently crouched, deeply folded appearance without changing navigation speed or the footfall sequence. The paw swing matches the stance's velocity and acceleration at its endpoints. Front paws curl more than rear paws during the airborne part of the stride; support pads remain level. Runtime foot placement, gaze and tail follow-through remain active.

Acceptance checks cover the shipped skins, pose deformation, walking/trotting/running support contacts, starts and stops, turning, jumps, resting, interruptions, pause and Reduce Motion. Native review must exercise actual furniture and toy commands. Inspect the legs both at normal game size and in close-up. Review captures stay in temporary storage.

### Validation outcome

All three rebuilt coats pass the gait, spine, start/stop/restart, fluid motion, paw contact, jump, landing, sleep and wake checks at 30/60/120 FPS. The exported mesh check samples all 62 clips per coat, with 41 samples through each sleep entry and wake, and reports no stretched seams or support penetration in those resting poses. Regression checks now catch lowered bend proportions and discarded airborne paw rotation. Type checking, lint, `animations:check`, asset verification and the startup suite also pass.

The iPhone 15 simulator on iOS 27.2 was used for normal Home-screen commands: toy play, bed approach/settle/wake, sofa approach/jump, and jump-down into toy play. Recorded frames were reviewed alongside close-up side views driven by the actual actor matrices. The startup portrait was recaptured with production `NativeCatDisplay`, and all shop previews and branding were regenerated. Temporary capture code and review media were removed. This is a simulator and pose review; physical-device performance and numerical similarity to another game's animation were not measured.

## Plush stepping audit, 15 November 2026

The follow-up uses the production actor harness at 60 FPS, not only sampled clips. It records straight walk/trot/run requests, a 0.6-body-length reposition, moving quarter/half turns and a supported quarter-turn followed by walking. Here one body length is explicitly 1.6 rig units, with world scale 0.4. A three-body-length run request reaches only trot under the existing acceleration planner; a longer diagonal runway additionally exercises actual running. Navigation timing and exact endpoints are not changed to force a run on the short route.

The dominant walk defect was a false rescue step. A valid forepaw contact reaches about 0.685 rig units on a 0.695-unit limb. The previous 0.022 reserve rejected it at 0.673 and inserted a 0.14-second hop immediately after touchdown. The recorded straight journey contains 41 corrective swings and 22 swings shorter than 0.15 units. For example, left forepaw frames 59–67 lift again but travel only 0.0046 units; their pad stays almost level. The release check also measured three-dimensional displacement, so increasing legitimate vertical clearance could itself trigger another rescue. Planted-contact sliding was already negligible and was not the cause of the strange gait.

The authored positive wrist rotation pointed the toes down during recovery. That leaves the front edge of a 0.37-long mitten close to the floor even when its ankle lifts. The new trajectory peels the heel before lifting the toes, with nominal ankle arcs of 0.105/0.115/0.160 for walk/trot/run. A 0.02-unit fore/hind airborne separation bias vanishes with zero velocity and acceleration at support. Shorter trot/run strides and revised running contacts address same-side crowding. Conservative oriented boxes use the supplied 0.30 width, 0.37 length, 0.20 height and ankle offset; their overlap is not a mesh-intersection measurement.

The runtime now distinguishes supported overreach from natural release, ignores vertical lift when testing horizontal contact disagreement, and releases stale blend contacts before they produce delayed catch-up steps. The existing supported-pivot angle increments, body drop, route curvature calculation and navigation timing remain unchanged. Short launch height and paw rotation scale down together. The walking-turn footprint assertion remains intact; its failure message now identifies skin, frame rate and turn case.

This pass exports orange only. Grey and white must be rebuilt before treating cross-coat gait checks as current. All review scripts, raw frame recordings and rendered comparison media live outside the repository in the task's `scratchpad/astra-steps` directory. The before and after matrices should be rendered on the same current orange mesh to avoid mistaking concurrent collar/model edits for an animation change. This audit does not certify the owner's above-96 quality threshold or physical-device playback.

### Measured outcome and remaining limits

All 2,208 matched before/after frames retain exactly the same root position and heading. Whole-journey corrective swing counts change as follows:

| Journey | Before | After |
| --- | ---: | ---: |
| Straight walk | 41 | 0 |
| Trot request | 26 | 7 |
| Long run, including acceleration/braking | 38 | 13 |
| Short reposition | 3 | 0 |
| Moving 90-degree turn | 47 | 14 |
| Moving 180-degree turn | 77 | 27 |
| Pivot followed by walking | 33 | 0 |

The new orange-only regression passes at 30/60/120 FPS. Over 240 samples per authored cycle, the conservative mitten boxes clear each other by at least 0.0161, 0.0225 and 0.0531 rig units for walk, trot and run. Their corners also remain above the floor within the 0.005 export/IK tolerance. Steady walk recovery now lifts fore toes about 24 degrees and hind toes about 18 degrees, instead of pointing them downward. Walk chest bob remains 0.0305 units peak-to-peak while head bob is 0.0096; the fix does not claim a body-motion improvement.

There are remaining defects, not a completed above-96 acceptance. The short reposition retains two small right-forepaw height excursions: frames 19–21 peak at 0.0190 units and frames 38–43 at 0.0167. The half-turn retains three forepaw adjustments shorter than 0.15 units. At long-run frame 175, during the return to trot, the enclosing same-side paw boxes nearly touch, with a 0.000093-unit negative separation. That is not proof of rounded-mesh penetration, but it leaves no conservative clearance margin. Gathered running limbs still look crowded in the side strip. One-frame contact-boundary velocity changes also remain appreciable; the recordings do not support claiming perfectly soft contacts.

All 22 requested check scripts were run. Nineteen pass. The default gait and starting checks stop on stale grey clips; both pass separately with `--orange`, without weakening assertions. `check-cat-jump-anatomy` stops on the new orange `jumpOff` tail-trail assertion: the sampled displacement is -0.1544, against a required displacement below -0.30. This pass changes no jump or tail posing code and leaves that assertion intact. The new stepping regression passes, as do the full all-coat turning and walking-turn checks after the short-step and lateral-release fixes. A final all-coat export and review are still required.


## Locomotion load and silhouette pass, 15 November 2026

This pass records 2,497 production-actor frames at 60 FPS. The fixtures include walk, trot, a short run request that reaches only trot, a diagonal runway that reaches run, starts and stops, a short reposition, moving 90/180-degree turns, and stationary 90/180-degree pivots followed by walking. Scale is 0.4. Measurements below use the actual world matrices, with heights divided by scale and angles relative to idle bone axes. Steady gait samples exclude blends and use at least 90% of nominal speed. Ranges are maximum minus minimum, not amplitudes.

The implementation improves the motion but does not meet the owner's above-96 acceptance threshold. The scores below are the implementer's visual judgment of recorded actor poses and rendered strips, not an independent review or a physical-device performance assessment.

### What changed

| File | Change and reason |
| --- | --- |
| `utils/native-cat-spine.ts` | Separate fore/hind load waves in walk, a shared diagonal loading wave in trot, and staggered run landing loads. Reduce trot axial twist so its diagonal spring differs from walking. The authored clip owns the run's principal chest/pelvis pitch; runtime retains a small filtered middle-back response. |
| `utils/native-cat-turn.ts` | Explicit shoulder and pelvis preparation at 100/150 ms, a small supporting-side shift, and up to 0.24 radians of toe-up recovery. Root timing, 30-degree placements, diagonal support and the 0.055 maximum crouch remain intact. |
| `components/pet/native/NativeCatActor.tsx` | Apply the pivot sequence while retaining incoming torso yaw during interruptions. Counter 85% of neck translation. Carry natural release discrepancies through the existing swing, preserve its vertical clearance, and retain actual rescue steps when a stale blend contact threatens spacing. Tight curves add at most 0.0099 units of body settling; lateral release occurs at 0.12 units, bounded by the unchanged footprint/reach checks. Rescue steps also roll their toes upward. |
| `utils/native-cat-gaits.ts` | Release near the beginning of authored lift at 0.0015 units and acquire contacts at 0.001. Natural-release corrections use the remaining swing interval, capped at 140 ms, without an added lift. Genuine rescue lift scales with displacement. |
| `scripts/3d/cat_gaits.py` | Trot compresses on diagonal contact and rises during passing. Run forepaw lift is 0.18 units and hind lift 0.145, separating the gathered limbs vertically while retaining the existing ankle roll and stride. |
| `scripts/3d/game_cat.py`, restricted `pose()` lines | Run gather is centered at phase 0.65. Chest/pelvis bend by +0.22/-0.26 radians, translate toward one another, and form a rounded middle back. Extension opens that shape with a smaller hollow. Gait head offsets compensate for chest movement and allow a small gathered head dip. |
| `scripts/check-cat-turning.mjs` | The previous assertion required flat airborne pivot soles. It now checks the exact toe-up recovery orientation with the same tolerance, retaining the original planted orientation. |
| `docs/cat-animations.md` and this study | Record ownership of authored versus runtime motion, measurements, validation and remaining limits. |

Stride lengths, stance fractions, footfall offsets, navigation speeds and clip durations retain their incoming values. Orange was exported under the shared lock; the exporter also regenerated its normal stills. Grey and white remain stale until the owner's final export. No jump, coat, face, sleep, acting or collar authoring was edited by this pass. Other agents' concurrent edits remain in the shared workspace.

### Torso measurements

Vertical travel in rig units:

| Gait | Chest before → after | Pelvis before → after | Head before → after |
| --- | ---: | ---: | ---: |
| walk | 0.0305 → 0.0568 | 0.0122 → 0.0327 | 0.0096 → 0.0169 |
| trot | 0.0177 → 0.0580 | 0.0192 → 0.0516 | 0.0281 → 0.0026 |
| run | 0.0308 → 0.0457 | 0.0641 → 0.0707 | 0.0437 → 0.0347 |

Angular travel in degrees. Chest/pelvis values are paired in that order:

| Gait | Pitch before → after | Roll before → after | Yaw before → after | Head pitch before → after |
| --- | ---: | ---: | ---: | ---: |
| walk | 6.29 / 3.87 → 6.20 / 4.49 | 13.46 / 6.76 → 13.46 / 6.76 | 11.88 / 5.60 → 11.64 / 5.51 | 1.69 → 1.27 |
| trot | 5.35 / 3.31 → 2.26 / 2.02 | 11.67 / 5.69 → 4.94 / 2.53 | 9.49 / 4.08 → 3.75 / 1.49 | 1.07 → 0.30 |
| run | 14.34 / 9.91 → 22.93 / 32.08 | 1.49 / 0.61 → 0.52 / 0.21 | 1.35 / 0.37 → 0.43 / 0.12 | 1.82 → 1.86 |

The phase plots and their expandable table include absolute chest, hip and head heights, chest/hip pitch, roll and yaw, and head pitch in eighth-cycle bins. The plotted height curves subtract each bone's cycle mean so their vertical excursions can be compared.

Pivot onset is the first 60 FPS sample exceeding two degrees from its initial orientation:

| Pivot | Head/chest/pelvis onset before, ms | Head/chest/pelvis onset after, ms | Head lead after, ms |
| --- | ---: | ---: | ---: |
| 90° | 33 / 100 / 117 | 33 / 133 / 183 | 100 |
| 180° | 50 / 133 / 183 | 50 / 133 / 183 | 83 |

The pelvis starts about 50 ms after the chest in both fixtures. Pivot toe-up recovery reaches about 13.75 degrees, compared with effectively zero before. The quarter-turn still takes 0.64 seconds and the half-turn 1.12 seconds.

### Contacts and continuity

A natural-release correction carries a horizontal offset through a swing that already exists. It is counted separately below from an added rescue lift. Total correction events include both categories; separating them must not be mistaken for removing every correction.

| Journey | Added rescue lifts before → after | Natural-release carries after | Total correction events before → after | Worst contact-boundary velocity change before → after, rig units/s |
| --- | ---: | ---: | ---: | ---: |
| walk | 0 → 0 | 0 | 0 → 0 | 3.96 → 3.34 |
| trot | 7 → 7 | 0 | 7 → 7 | 6.02 → 6.07 |
| run-long | 13 → 9 | 5 | 13 → 14 | 7.28 → 7.29 |
| short | 0 → 0 | 0 | 0 → 0 | 2.62 → 2.32 |
| turn90 | 14 → 10 | 4 | 14 → 14 | 4.28 → 3.89 |
| turn180 | 27 → 17 | 9 | 27 → 26 | 4.01 → 3.39 |
| pivot-walk | 0 → 0 | 0 | 0 → 0 | 3.96 → 3.34 |
| pivot180-walk | 0 → 0 | 0 | 0 → 0 | 3.96 → 3.34 |

All 2,497 matched frames retain exactly the same root position and heading. Maximum movement of a retained contact in these recordings is 0.00000111 rig units. Contact-boundary values use the same 0.008-unit height classification and 60 FPS finite differences as the earlier audit. Trot and run remain abrupt at some boundaries; this pass does not claim those contacts are solved.

The walk fixture's steady same-side mitten-box clearance is 0.0169 rig units; the minimum across its entire journey is 0.0113. The trot fixture's steady same-side mitten-box clearance is 0.0227 rig units; the minimum across its entire journey is 0.0088. The run-long fixture's steady same-side mitten-box clearance is 0.0365 rig units; the minimum across its entire journey is 0.0134. The boxes use the supplied mitten dimensions and orientations; they are conservative bounds, not a rounded-mesh intersection test.

The turn90 fixture still has a minimum same-side box separation of -0.0390 at frame 120. The turn180 fixture still has a minimum same-side box separation of 0.0013 at frame 11. The short reposition retains small right-forepaw excursions of 0.0133 units at frames 19–21, 0.0167 units at frames 38–43. These and the remaining moving-turn adjustments prevent a finished-quality claim.

### Visual judgment

| Motion | Score / 100 | What still holds it back |
| --- | ---: | --- |
| Walk | 92 | Readable alternating loads and planted paws, but some contact changes remain brisk. |
| Trot | 91 | A clearer diagonal spring and steady head; gathered mittens still obscure portions of the leg rhythm. |
| Run | 90 | Gather and extension now differ in back shape and limb collection; fast contacts and gathered-paw crowding still need work. |
| Starts/stops | 90 | Exact arrival and retained first contacts; short repositioning still contains small ankle excursions. |
| Moving turns | 88 | Fewer added hops, but repeated corrections and conservative same-side paw overlap remain. |
| Pivots | 92 | Head/shoulder/hip sequencing and toe recovery are readable; the fast supporting-side transfer remains subtle. |

### Reproduction and review files

All temporary scripts, recordings, phase data, check logs and strips are in `/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/`.

- [Interactive phase plots and before/after gait strips](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/review.html)
- [Before actor matrices](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/before.json)
- [After actor matrices](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/after.json)
- [Before gait side strips](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/before-side.png)
- [After gait side strips](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/after-side.png)
- [Before pivot top strips](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/before-pivot.png)
- [After pivot top strips](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/after-pivot.png)
- [Before start/stop/reposition/moving-turn strips](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/before-motion/strip.png)
- [After start/stop/reposition/moving-turn strips](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/after-motion/strip.png)
- [Final check results](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/checks-final.json)

The before and after gait strips use the same final orange mesh. The recordings remain the original before/after actor matrices; the render does not substitute clip-only poses. Review media and throwaway scripts are outside the repository.


### Final validation for this pass

All 23 requested check scripts pass on the final implementation. `check-cat-gaits` and `check-cat-starting` use `--orange`; the other scripts use their normal coat selection. TypeScript and lint pass. Earlier intermediate failures were resolved or disappeared after the concurrent authoring changes were exported; they are not counted as final failures. Grey and white still need the owner's final export for the revised authored gait poses. The known old `check-close-furniture-jumps` failure was not part of the requested rerun list.

| Check | Result |
| --- | --- |
| [check-cat-stepping](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-stepping.log) | Pass |
| [check-cat-starting --orange](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-starting.log) | Pass |
| [check-cat-paw-contact](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-paw-contact.log) | Pass |
| [check-cat-pivot-rhythm](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-pivot-rhythm.log) | Pass |
| [check-cat-motion-flow](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-motion-flow.log) | Pass |
| [check-cat-anticipation](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-anticipation.log) | Pass |
| [check-cat-command-motion](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-command-motion.log) | Pass |
| [check-cat-locomotion](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-locomotion.log) | Pass |
| [check-cat-jumps](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-jumps.log) | Pass |
| [check-cat-exploration](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-exploration.log) | Pass |
| [check-furniture-perches](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-furniture-perches.log) | Pass |
| [check-native-room](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-native-room.log) | Pass |
| [check-cat-gaits --orange](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-gaits.log) | Pass |
| [check-cat-restarting](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-restarting.log) | Pass |
| [check-cat-turning](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-turning.log) | Pass |
| [check-cat-walking-turns](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-walking-turns.log) | Pass |
| [check-cat-landing-walk](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-landing-walk.log) | Pass |
| [check-cat-fluid-motion](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-fluid-motion.log) | Pass |
| [check-cat-command-attention](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-command-attention.log) | Pass |
| [check-cat-spine](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-spine.log) | Pass |
| [check-cat-jump-anatomy](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-cat-jump-anatomy.log) | Pass |
| [check-furniture-transfers](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-furniture-transfers.log) | Pass |
| [check-catalog-furniture-jumps](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/check-catalog-furniture-jumps.log) | Pass |
| [npx tsc --noEmit](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/tsc.log) | Pass |
| [npm run lint](/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-loco2/lint.log) | Pass |

The affected gait, stepping, motion-flow, restart and spine checks were repeated after the final forepaw contact adjustment. Pivot recovery assertions retain their original tolerances. No assertion was loosened to obtain a pass. No commits, branches or pushes were made, and temporary review files remain outside the repository.
