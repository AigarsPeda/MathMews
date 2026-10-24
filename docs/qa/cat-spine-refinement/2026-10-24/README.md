# Spine and shoulder refinement — 24 October 2026

Historical QA notes. Demonstration images and recordings were deleted at the user’s request; referenced media below is no longer retained.

The former torso pass counter-transformed all four upper legs and the neck. This protected contacts but largely pinned the shoulder line. The revised pass lets the shoulders and hips move above the original paw paths, with a two-bone solve retaining each pad position and orientation. It runs after gait and turn contact placement, before object reaches.

Chest compression follows foot loading, the hips trail a change of direction, and alternating swats add anticipatory back rounding and support-side lean. The neck follows part of the chest displacement while retaining gaze rotation. Landing recovery suppresses the downward gait flex until the supported first stride finishes. Interrupted turns and launches subtract the previous overlay when capturing their base height.

## Visual evidence

- `existing-simulator.gif`: 15 seconds from the existing **BrainPet Puzzle QA** iPhone 18 Pro/iOS 27 simulator, using the normal Home room and Metro 8081. Includes walking toward the ball and pawing. Real-time 12 FPS recording excerpt; no temporary game screen or new simulator. Recorded before the final landing-only guard; the walking/play code is identical.
- `walk-comparison.gif`, `turn-comparison.gif`, `play-comparison.gif`: previous implementation on the left, updated on the right. These are Blender close-ups of bone matrices captured from the actual native actor and shipped orange GLB, not simulator screenshots. The camera follows the root/heading so the torso is easier to compare. Roughly real-time 7.5 FPS. The clips loop with a reset at the end.
- `rig-metrics.json`: 45 comparisons against the spine overlay disabled, across three coats, 30/60/120 FPS and walk/run/turn/jump/play. These numbers measure the overlay, not the difference from the previous implementation.

The clearest visual difference is the shoulder lowering and back curve during a reach. Walking remains subtle on this short, large-headed character. Close-ups were inspected at multiple phases, and the native room recording was reviewed for walk/turn/play continuity and contact.

## Validation

Passed: `check-cat-spine`, `check-cat-turning`, `check-cat-paw-contact`, `check-cat-jump-anatomy`, `check-cat-fluid-motion`, `check-cat-room-flow`, `check-cat-landing-walk`, `check-cat-motion-flow`, and `check-native-room`, plus TypeScript and focused ESLint. All scripts are in `scripts/` with `.mjs` suffixes. The spine check now requires measurable shoulder movement and verifies preserved paw paths, gaze rotation, root motion, pause/resume, settling, crawl and Reduce Motion. Landing and interrupted-turn thresholds were retained; the transition issues found by those checks were fixed in the actor.

## References

[Little Kitty, Big City animator's account](https://www.gamedeveloper.com/art/deep-dive-how-little-kitty-big-city-rejects-realism-to-achieve-authenticity) informed the emphasis on whole-body rhythm and judging motion in the game. [Feline lumbar kinematics](https://pubmed.ncbi.nlm.nih.gov/30184992/) supports keeping ordinary walking quieter than galloping. [Shoulder-girdle kinematics during walking](https://pubmed.ncbi.nlm.nih.gov/8714697/) supports allowing shoulder movement over the supporting limb. The amplitudes and timing here are stylized animation choices, not measurements taken from those papers.
