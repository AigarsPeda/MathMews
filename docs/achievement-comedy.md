# Achievement films

Finishing all three boss stages earns a six-second cat film. Learning checkpoints, completion IDs, rewards and saves keep their existing behavior. The current direction replaces the distant machinery scenes with close-up performances using the actual game cat. See the [research and critique](reward-design-research.md).

The collection has full-width cards, a Collected filter, grayscale locked previews and colored punchline posters. Locked copy teases the setup. Opening a locked card explains the requirement and links to its lesson. Earned films have pause, replay and native GIF sharing. Only the open film animates; backgrounding pauses it and Reduce Motion uses the poster. Sharing rechecks completion and never changes coins, lives or progress.

## The films

| Title | Setup, action and payoff |
| --- | --- |
| Nailed the landing | The cat jumps onto a cushion. The cushion compresses and feathers burst from its seams. |
| Catch of the day | A book opens, launches a fish and the cat catches it on both paws, below its face. |
| Purrito | A paw taps the yarn; five continuous turns wind a striped scarf around the seated cat. |
| Totally planned | An alarm rattles its bells off. One lands on the cat, followed by a deadpan stare. |
| Unexpected takeoff | A taut ribbon pulls the cat upward; surprise replaces its confident pose. |
| Special delivery | The cat clears the delivery-box rim, lands inside and makes the flaps tremble. |
| Captain Quack | The cat boards a duck float, with ducklings as its tiny crew. |
| Ah... ah... ACHOO! | Water grows a giant flower. Visible pollen drifts to the cat, which sneezes the petals away. |
| Disco whiskers | A disco ball starts a dance, ending with a star held out to the audience. |
| Best. Cat bed. Ever. | The cat discovers that a trophy is an excellent place to sit. |

These are ten authored films across 18 world-stage variants, not 180 independently written stories. The clock is the deadpan, meme-like exception to the physical comedy. English and Latvian titles, teasers and descriptions accompany every film.

## Rebuild

The authoring tools are Blender and Gifsicle. Gifsicle must be on PATH, or `GIFSICLE_BIN` must name its executable. Neither is an application dependency.

1. `npm run assets:achievement-scenes` renders 48 transparent actor frames per film to `/tmp/brainpet-reward-studio`. Selective rendering accepts `-- --id loom,clock`, including scene IDs such as `train-loom`. `--preview` renders five storyboard poses into a separate `previews/` directory so it cannot overwrite the production frames.
2. `npm run assets:achievement-stages` renders the 18 static stages using the identical camera.
3. `npm run test:achievement-contact` evaluates all ten films at 95 times each (every frame and midpoint). It checks skin/prop penetration, constant cat scale, stage clearance, resting-prop support and both paws touching the caught fish. Positive/negative geometry controls also exercise the checker.
4. `node scripts/check-achievement-render.mjs` checks all 480 actor frames for visible content and a four-pixel safety margin. Inspect storyboards and moving films as well; this framing check does not judge contact, acting or humor.
5. `npm run assets:achievements` composites each film over its world stage and writes its GIF, color poster and gray preview. `-- --id train-loom` packages a subset. GIFs retain 512×448 resolution, a 256-color palette, transparency and a six-second duration. Gifsicle optimizes the animation with a small lossy tolerance of 10.
6. `npm run test:achievements` validates all 180 registered assets, grayscale, dimensions, duration, motion, transparency and storage budgets.

The 46 moving frames use 80 ms each; opening and closing holds use 500 ms and 1,820 ms. GIF optimization can merge identical frames. The cat GLB is copied into the render directory when no snapshot exists. All subsequent renders reuse that snapshot so concurrent game-cat changes cannot silently alter a batch; `--refresh-cat` deliberately replaces it. Source SHA-256 is recorded in `source.json`.

## Verification

Use the dedicated Achievements QA simulator with `node scripts/native/check-puzzle-drag.mjs --achievements --device 66F7AF87-9A43-4BD2-AEC0-0242E902E215`. The isolated fixture covers the production screen, English, 320-point Latvian, locked guidance, empty Collected state, pause/replay, native GIF share/cancel, and unchanged wallet/progress. The native tests capture the opening, held punchlines, and the fish/scarf endings. A pixel comparison verifies that Pause preserves the displayed movie frame. Fresh simulator setup dismisses Expo developer screens without completing game onboarding.

The asset checks enforce 120 MiB for the collection and 1 MiB per share. Only the selected film animates; lists use static WebP posters. Measured storage for each revision is recorded with its QA results.

Evidence and measured storage are in `docs/qa/reward-studio/2026-10-24/results.json`. The simulator checks do not establish physical-device performance, Android rendering or children's engagement. A useful child playtest is to hide the captions, ask what happened, then observe which reward they voluntarily replay or choose to show someone.


## Contact revision after screenshot review

The earlier framing checks passed while visible contact errors remained. User screenshots showed front legs crossing the scarf and a fish crossing the face. The follow-up audit found that `Actor.pose()` reset the root after some scene positions had been assigned. It also found guessed grip offsets, size changes during jumps, floating props and raised stage ornaments that were unsafe to composite behind an actor.

The reward rig now positions the root after sampling its pose, uses two-bone paw IK for holds, and measures the deformed skin for ground placement and attachments. Container jumps rise before crossing the rim and keep a constant cat size. The scarf is revealed along a continuous external path instead of expanding through the body; its rear contour clears the tail. The fish follows a path in front of the face and rests on both paws. The duck has an open seat, the clock rocks on its feet, and the balloon ribbon follows an actual paw surface. Stage decorations are flush inlays.

The contact checker measures bidirectional vertex penetration against evaluated meshes, confirms inside/outside with ray parity and allows 0.018 world units (roughly two output pixels) for surface contact. It is not a rigid-body solver or exhaustive triangle/self-collision proof. Full-frame visual review remains required, especially for timing, readable support, secondary-prop contact and the joke itself.

The contact revision and decoded-GIF checks are recorded in [contact-review/results.json](qa/reward-studio/2026-10-24/contact-review/results.json), alongside all ten reviewed storyboards and native screenshots. The final GIF collection is 85.14 MiB. Native review also exposed a Pause reset: changing Expo Image’s `autoplay` prop reloaded the image. Playback now keeps that prop fixed and uses the native start/stop methods after load and on activity changes.
