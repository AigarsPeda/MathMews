# Achievement films

Finishing all three boss stages earns a six-second cat film. Learning checkpoints, completion IDs, rewards and saves keep their existing behavior. The current direction replaces the distant machinery scenes with close-up performances using the actual game cat. See the [research and critique](reward-design-research.md).

The collection has full-width cards, a Collected filter, grayscale locked previews and colored punchline posters. Locked copy teases the setup. Opening a locked card explains the requirement and links to its lesson. Earned films have pause, replay and native GIF sharing. Only the open film animates; backgrounding pauses it and Reduce Motion uses the poster. Sharing rechecks completion and never changes coins, lives or progress.

## The films

| Title | Setup, action and payoff |
| --- | --- |
| Nailed the landing | The cat jumps onto a cushion. Feathers burst from its seams; the cat checks the damage and winks. |
| Catch of the day | A book launches a fish onto both paws. The fish wriggles; the cat does a double take before posing with its catch. |
| Purrito | A paw taps the yarn; the cat follows five turns with its head, then peeks out of the scarf with a wink. |
| Totally planned | An alarm rattles its bells off. One lands on the cat, followed by a deadpan stare. |
| Unexpected takeoff | A taut ribbon pulls the cat upward. Its free paw paddles and its back legs kick for the missing ground. |
| Special delivery | The cat clears the delivery-box rim, lands inside, then peeks over the edge with a little paw wave. |
| Captain Quack | The cat boards a duck float; three ducklings parade past while the new captain nods. |
| Ah... ah... ACHOO! | Water grows a giant flower. Pollen prompts two held inhalations, a sneeze and a surprised look at the bare flower. |
| Disco whiskers | A disco ball starts a twisting dance, ending in a freeze, an oversized star wand and a wink. |
| Best. Cat bed. Ever. | The cat climbs into the trophy, yawns, fights two sleepy head drops, then gives in to a nap. |

These are ten authored films across 18 world-stage variants, not 180 independently written stories. The clock is the deadpan, meme-like exception to the physical comedy. English and Latvian titles, teasers and descriptions accompany every film.

## Rebuild

The authoring tools are Blender and Gifsicle. Gifsicle must be on PATH, or `GIFSICLE_BIN` must name its executable. Neither is an application dependency.

1. `npm run assets:achievement-scenes` renders 48 transparent 768×672 actor frames per film to `/tmp/brainpet-reward-studio`. Selective rendering accepts `-- --id loom,clock`, including scene IDs such as `train-loom`. `--preview` renders five storyboard poses into a separate `previews/` directory so it cannot overwrite the production frames.
2. `npm run assets:achievement-stages` renders the 18 static stages using the identical camera.
3. `npm run test:achievement-contact` evaluates all ten films at 95 times each (every frame and midpoint). It checks skin/prop penetration, constant cat scale, stage clearance, resting-prop support and both paws touching the caught fish. Positive/negative geometry controls also exercise the checker.
4. `node scripts/check-achievement-render.mjs` checks all 480 source frames for visible content and six-pixel margins, then projects the evaluated cat skin through every camera crop and requires eight output pixels of clearance. Inspect storyboards and moving films as well; this framing check does not judge contact, acting or humor.
5. `npm run assets:achievements` composites each film over its world stage and writes its GIF, color poster and gray preview. `-- --id train-loom` packages a subset. GIFs retain 512×448 resolution, a 192-color palette, transparency and a six-second duration. Gifsicle optimizes the animation with a lossy tolerance of 45, checked against the rendered source.
6. `npm run test:achievements` validates all 180 registered assets, grayscale, dimensions, duration, motion, transparency and storage budgets.

The shared editor in `scripts/3d/achievement-film-edit.mjs` gives each film its own hesitation, impact and reaction holds. Moving frames use 70 ms, with a 360 ms opening and a final hold that keeps the whole film at six seconds. The same editor crops the actor and stage together, moving from an establishing shot to a close reaction without changing perspective or contact. GIF optimization can merge identical frames. The cat GLB is copied into the render directory when no snapshot exists. All subsequent renders reuse that snapshot so concurrent game-cat changes cannot silently alter a batch; `--refresh-cat` deliberately replaces it. Source SHA-256 is recorded in `source.json`.

## Verification

Use the dedicated Achievements QA simulator with `node scripts/native/check-puzzle-drag.mjs --achievements --device 66F7AF87-9A43-4BD2-AEC0-0242E902E215`. The isolated fixture covers the production screen, English, 320-point Latvian, locked guidance, empty Collected state, pause/replay, native GIF share/cancel, and unchanged wallet/progress. The native tests capture the opening, held punchlines, and the fish/scarf endings and the trophy nap close-up. A pixel comparison verifies that Pause preserves the displayed movie frame. Fresh simulator setup dismisses Expo developer screens without completing game onboarding.

The asset checks enforce 120 MiB for the collection and 1 MiB per share. Only the selected film animates; lists use static WebP posters. Measured storage for each revision is recorded with its QA results.

Evidence and measured storage are in `docs/qa/reward-studio/2026-10-24/results.json`. The simulator checks do not establish physical-device performance, Android rendering or children's engagement. A useful child playtest is to hide the captions, ask what happened, then observe which reward they voluntarily replay or choose to show someone.


## Contact revision after screenshot review

The earlier framing checks passed while visible contact errors remained. User screenshots showed front legs crossing the scarf and a fish crossing the face. The follow-up audit found that `Actor.pose()` reset the root after some scene positions had been assigned. It also found guessed grip offsets, size changes during jumps, floating props and raised stage ornaments that were unsafe to composite behind an actor.

The reward rig now positions the root after sampling its pose, uses two-bone paw IK for holds, and measures the deformed skin for ground placement and attachments. Container jumps rise before crossing the rim and keep a constant cat size. The scarf is revealed along a continuous external path instead of expanding through the body; its rear contour clears the tail. The fish follows a path in front of the face and rests on both paws. The duck has an open seat, the clock rocks on its feet, and the balloon ribbon follows an actual paw surface. Stage decorations are flush inlays.

The contact checker measures bidirectional vertex penetration against evaluated meshes, confirms inside/outside with ray parity and allows 0.018 world units for surface contact. It is not a rigid-body solver or exhaustive triangle/self-collision proof. Full-frame visual review remains required, especially for timing, readable support, secondary-prop contact and the joke itself.

The contact revision and decoded-GIF checks are recorded in [contact-review/results.json](qa/reward-studio/2026-10-24/contact-review/results.json), alongside all ten reviewed storyboards and native screenshots. That revision’s GIF collection was 85.14 MiB. Native review also exposed a Pause reset: changing Expo Image’s `autoplay` prop reloaded the image. Playback now keeps that prop fixed and uses the native start/stop methods after load and on activity changes.


## Closer framing and expressive acting

The next review found too much empty space and a nearly identical smile at the end of every film. Reward-only heads are now 16% larger. Cats in the trophy, box and duck float are respectively 29%, 24% and 23% larger in the scene, with constant size throughout each jump. These changes do not alter the gameplay cat asset.

Each film has an authored camera push toward its reaction. Final magnification ranges from 1.22× for the tall balloon scene to 1.85× for the fish and trophy. The cat remains fully inside the shot; peripheral scenery and the plinth may extend past its edges. A wide shot establishes cause and effect before the closer reaction.

The reactions now include a fish double take, yarn-tracking head turns, an asymmetric deadpan stare, airborne paddling, a box wave, a duckling parade, two sneeze anticipations, a dance freeze and a sleepy trophy nap. Camera and timing definitions are shared by packaging and decoded-GIF QA. Tests measure mesh contact and framing separately; neither test establishes whether a child finds the gag funny.

The current 180 GIFs occupy 109.34 MiB. Native review also found that long descriptions could push the action buttons below the sheet. The viewer now bounds its scrolling body above the measured footer, with native assertions covering full button visibility.

Current evidence is in [acting-review/results.json](qa/reward-studio/2026-10-24/acting-review/results.json).
