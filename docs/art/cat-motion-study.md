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

The subsequent visual review still found the stationary pivot hesitant. `native-cat-turn.ts` now alternates diagonal support in two staggered beats per quarter-turn. The inside forepaw starts first, followed shortly by the opposite hind paw; the other diagonal then steps through. A 90-degree turn uses four placements in 0.64 seconds, previously eight in 1.04 seconds. A 180-degree turn uses eight placements in 1.12 seconds, previously sixteen in 1.84 seconds.

The body lowers by 0.18 rig units during the turn to keep the larger steps within limb reach. Lowering blends over the first 16% of the turn; recovery begins at 82% and finishes at the endpoint. This longer recovery removed the abrupt rise seen in the first native iteration. Head anticipation blends over 22% to preserve continuity when a new command interrupts the faster turn. Planted paws retain their world position and sole orientation. The root stays within the original supported footprint, and the existing overlap into the first walking step remains active.

The native before/after comparison (preview removed) shows the same repeated half-turn in the existing simulator, aligned at the start of anticipation and played at real speed. This is a stylized animation choice, not a claim to reproduce every feline turning strategy. All three shipped rigs retain reachable contacts, diagonal support, level soles, interruption continuity and pause behavior at 30/60/120 FPS and two scales. A separate rhythm check counts the actual paw-lift events rather than accepting a faster root rotation alone.

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
