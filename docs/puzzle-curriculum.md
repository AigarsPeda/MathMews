# Topic based puzzle learning

Math Mews now uses difficulty → topic → lesson → puzzle. Each difficulty initially has six topics and twelve lessons. The catalog has 144 practice puzzles, eighteen boss missions containing fifty-four stages, and eleven optional challenges. That is 209 puzzles per language, with complete English and Latvian content.

## Choosing what to learn

Children choose Easy, Medium or Hard, then a topic and a lesson. Every topic starts independently. Lessons within a topic unlock after completing the previous lesson's practice. A boss or challenge never gates the next lesson.

| Difficulty | Topics |
| --- | --- |
| Easy | Addition, subtraction, numbers and order, patterns, equal groups, fractions |
| Medium | Addition, subtraction, equal groups, sharing and division, fractions, number routes |
| Hard | Number routes, fractions, patterns, percentages, measurement and estimation, reasoning |

Puzzle interactions vary by lesson. Introductory number lines appear in Easy and Medium. Expression building appears in Medium and Hard. Estimation appears in Hard's measurement lessons. New topics do not require every interaction, or a corresponding topic at every difficulty.

The lesson screen shows progress through practice puzzles and boss stages, with available, locked and completed puzzle states. Finishing a practice puzzle continues within its lesson. Finishing the practice returns to its overview, where the child can choose a special level or another lesson. A lesson with a boss is complete only after every boss stage is cleared. Choosing a different difficulty returns to that difficulty's topics.

## Boss missions and challenges

Bosses are named missions with their own descriptions, a gold presentation and three visible checkpoints. Every successful stage saves immediately. Leaving and reopening resumes at the first unfinished stage. Replaying a completed mission starts at stage one and uses replay rewards. A wrong answer never removes earlier checkpoints.

Every topic at each difficulty has exactly one uniquely named boss. It is the final level of the final lesson, after any optional challenge. Each mission follows its own story and uses the topic's skills across linked stages. The main lesson button offers the boss after practice, while the challenge remains available separately. Boss stages use the existing task renderers and their own stable puzzle IDs.

| Difficulty | Topic | Boss mission |
| --- | --- | --- |
| Easy | Addition | The cat picnic |
| Easy | Subtraction | Rescue the paper boats |
| Easy | Numbers and order | The midnight train |
| Easy | Patterns | Wake the music box |
| Easy | Equal groups | The toy workshop |
| Easy | Fractions | Mend the festival kite |
| Medium | Addition | The festival ticket desk |
| Medium | Subtraction | The mountain supply lift |
| Medium | Equal groups | The firefly theatre |
| Medium | Sharing and division | The parcel station |
| Medium | Fractions | Restore the mosaic fountain |
| Medium | Number routes | Light the lantern trail |
| Hard | Number routes | Restart the observatory |
| Hard | Fractions | The garden plan |
| Hard | Patterns | The distant signal tower |
| Hard | Percentages | Open the toy shop |
| Hard | Measure and estimate | Build the rooftop shelter |
| Hard | Reasoning | The archive vault |

Challenges have a separate purple presentation and five interactions reserved for optional activities. They offer whole-board goals, room to revise a plan and no time limits. Not every interaction appears at every difficulty.

| Interaction | Difficulty and topic | Goal |
| --- | --- | --- |
| Pair hunt | Easy addition, Medium addition, Hard reasoning | Collect every valid pair, ignoring decoys. |
| Basket sorting | Easy numbers | Place every number below ten or at least ten; the boundary belongs in the upper basket. |
| Fraction post office | Medium fractions | Sort six differently written fractions by their equivalent values. |
| Pattern repair | Easy patterns, Medium multiplication, Hard patterns | Fill two gaps using a tile bank with decoys. Difficulty rises from counting in fives, through multiples of seven, to powers of three. |
| Number maze | Medium and Hard number routes | Choose adjacent squares that transform a running number. Medium uses four moves; Hard requires a six-move detour. No square can be reused and every intermediate value must be a nonnegative whole number. Undo is free. |
| Budget planning | Hard percentages | Choose two supplies after discounts while leaving an exact pretend balance. Both valid shopping plans are accepted. No real game coins are spent. |

Pair hunts count reversed pairs once, forbid pairing a tile with itself and permit a tile to join different pairs. Incorrect or duplicate additions receive immediate feedback. All challenge edits remain available after an unsuccessful submission; retry does not wipe the board. Leaving an unfinished challenge clears its unsaved work. Only completed boss stages are checkpoints.

Number ordering, basket sorting and pattern repair use native drag and drop. In ordering puzzles, dropping a number onto a position inserts it there and shifts the numbers in between; the learner checks the answer separately. Tiles follow the finger, the current destination gets a teal outline, and releases outside a destination preserve the previous placement. Sorted tiles live inside their baskets and can be dragged between baskets or back to the tile bank. Moving between filled pattern gaps swaps the tiles; a tile from the bank replaces the old tile, which returns to the bank. The surrounding puzzle scroll view pauses during a tile gesture and unlocks after release or cancellation. VoiceOver and TalkBack users can choose destinations through each tile's accessibility actions.

Both special kinds become available after the practice in their lesson. Bosses are required for the lesson and topic completion marks; challenges are optional. Neither kind blocks another topic or the next lesson. Help remains free. Three shared lives limit incorrect attempts across practice, bosses and challenges. Rewards use ordinary difficulty rates for each completed puzzle or boss stage. There is no additional client-only mission bonus.

## Three shared lives

The player has three lives across all difficulties, topics and lesson kinds. A submitted incorrect answer uses one life. Incorrect fraction-card matches and submitted invalid pair-hunt pairs also use one life because those interactions check the answer immediately. Editing a draft, using picture help, finding a valid pair, or submitting a correct answer costs no life. Duplicate submissions cannot consume a second life, and selecting tiles does not expose whether an unsubmitted pair is correct.

At zero lives, answer checking pauses. Instant matching controls also pause, while ordinary draft work and free worked examples stay available. Closing and reopening keeps the remaining lives and the regeneration deadline. One free life regenerates every 30 minutes, up to three; later mistakes do not restart that timer. The existing coin refill can restore a life at its current catalog price. Correct answers retain their ordinary first-clear or replay rewards, including double boss-stage rewards.

The play screen shows three hearts beside the lesson title, explains the cost before submission and offers recovery actions at zero. The game operation enforces the same limit using current saved state, so a stale UI callback cannot complete or reward a task after lives run out. Older five-life saves normalize to the three-life cap. This uses the existing saved-life fields and wallet refill, so no database migration or reward RPC change is needed.

The curriculum checks cover depletion, save/reopen, duplicate attempts, zero-life blocking, regeneration, refill and reward preservation for all three difficulties and level kinds. The experience checks include instant matching and pair-hunt mistakes. Native checks use the actual play screen inside an isolated in-memory provider, without writing player progress or spending real game coins. Run `node scripts/native/check-puzzle-drag.mjs --lives --device <simulator-UDID>`. See the [native results](qa/three-lives/2026-10-19/native-results.json).

## Variety within lessons and missions

All 36 practice lessons use independently authored examples for their four activities. Each lesson has at least three interaction types. Addition, subtraction, multiplication, division, fractions, operations, percentages, measurement and reasoning use different operands, quantities or fractions across the activities. Small numbers can recur naturally, but the same calculation is not reused to supply later answers.

Pattern lessons mix next-number sequences, rule machines and missing-number questions. Their four activities use different rules. Easy includes increasing and decreasing steps; Hard mixes multiplication, division, addition and subtraction. For example, the first Hard set uses ×3, ÷4, ÷3 and −7. Questions leave those rules for the learner to discover. The two pattern missions also change rules between stages while passing a quantity from one stage into the next.

Every three-stage boss mission includes at least two interaction types. The toy workshop, lantern trail and toy shop now use different interactions within their existing stories. Connected story quantities still agree with the Blender scenes. Practice percentages cover 10%, 20%, 25% and 50%, with separate animated help examples for each. Measurement estimates round the total to the nearest ten.

These revisions preserve puzzle IDs, lesson positions, saved completion, rewards and content version 2. They update the existing English and Latvian question content rather than resetting learning progress. The [variety review](qa/practice-variety/2026-10-19/review.json) lists the current questions and activity types. `npm run test:puzzles` checks per-lesson operand and interaction diversity, distinct pattern rules, missing-number solutions and uniquely solvable rule machines. Run `node scripts/native/check-puzzle-drag.mjs --variety --device <simulator-UDID>` for real iOS answer selection and progression through the revised practice sets and pattern missions.

## Animated task models

Four task families now show the actual quantities in interactive animations: addition joins two counter groups; subtraction moves the marked counters away; multiplication and area tasks arrange counters into equal rows; fair sharing deals one counter to every group per tap. Sharing stops before an incomplete round and leaves the leftovers in the pool. Learners can reset and try the model again before submitting an answer. The model never selects an answer, awards coins or writes progress.

The initial coverage is ten arithmetic tasks across Easy, Medium and Hard, plus all four fair-sharing tasks, including the two division boss stages. Larger arrays grow vertically so individual counters stay separate. Counters use contrasting red and blue, with position and text explaining the action as well. Animations run on Reanimated's UI thread, have no repeating autoplay, and honor system Reduce Motion. English and Latvian captions describe the current state for screen readers. Controls lock after answer submission.

`taskVisual` is optional authored metadata on a puzzle, independent of `visualHelp`, which remains a different worked example. Add a `join`, `take_away` or `array` model through the authoring helper and run `npm run puzzles:build`. The current join/take-away scenes are intended for small quantities up to twenty. Arrays support the larger rows used by multiplication and measurement tasks. Fair sharing derives its model directly from the structured task payload. No translated question text is parsed, and no puzzle IDs, answer keys or save versions change.

Seventeen tasks now use Blender-made objects that match their stories: toy mice, red and blue ribbons, paper stars, cookies, parcels, square planting spaces and train carriages. Numeric mouse and carriage comparisons show the actual quantities directly in the existing answer cards, with equal-size objects and no inner frames. The structured `object` field on quantity models or comparison/sharing payloads chooses the illustration in both locales. Existing counter movement and Reduce Motion behavior remain in place. The nine transparent renders are bundled in `assets/3d/puzzle-objects/`; the editable multi-scene library is `prototypes/puzzle-objects/puzzle-objects.blend`. Rebuild it with `npm run assets:puzzle-objects`, then check counts, spacing, locale parity and asset crops with `node scripts/check-puzzle-objects.mjs`.

`npm run test:puzzles` verifies that each authored model matches its answer and both locales, counter identities remain stable, counters stay separate and on the board, and sharing preserves every item through equal rounds and leftovers. For real iOS controls and screenshots, connect a development build to Metro and run `npm run test:puzzles:scenes:ios -- --device <simulator-UDID>`. Like the drag tests, this uses a temporary development-only route with no progress or wallet writes and removes it afterward.

Native verification on 2026-10-19 passed both animated-scene scenarios on the iPhone 18 Pro simulator running iOS 27. Coverage includes join/reset, take-away, small and twelve-row arrays, locked controls, equal sharing through several interrupted animations, leftovers and reset. See [native results](qa/animated-task-scenes/2026-10-19/test-result.json), [joining counters](qa/animated-task-scenes/2026-10-19/addition-joined.png), [large array](qa/animated-task-scenes/2026-10-19/large-array-built.png), and [sharing with leftovers](qa/animated-task-scenes/2026-10-19/sharing-leftovers.png).

## Hard questions and answer visibility

Hard questions state the goal and required facts without prescribing the calculation sequence or naming a hidden rule. Keep legitimate constraints such as fixed number order, rounding precision, legal route moves and tile reuse. Optional Picture help and feedback after an attempt remain available.

The 19 October 2026 review covered all 70 Hard tasks in English and Latvian, rewrote 12 questions and corrected pre-answer guidance or visibility across 19 tasks. The garden path task uses `payload.hideTarget` so the unknown complementary fraction is not displayed before success. General multiplication claims use `payload.hideStatement` to withhold their counterexample until success. Hard story illustrations retain their objects but omit the arithmetic expression, and Hard operator tasks omit the precedence reminder. That review preserved Easy and Medium content and every Hard answer definition; the later variety revision changes the examples as described above. See the [task-by-task review](qa/hard-question-review/2026-10-19/review.json) and [native checks](qa/hard-question-review/2026-10-19/native-results.json). Re-run native coverage with `node scripts/native/check-puzzle-drag.mjs --hard-questions --device <simulator-UDID>`.

## The cat between tasks

The existing answer-result sheet is now a larger character moment, with the player's named cat and equipped skin, a speech bubble, the mathematical explanation or hint, and any earned coins. It uses the existing Continue action, so no extra interstitial tap is added. Continue and Home remain fixed below the scrollable content. Native dismissals share a one-action guard with those buttons, preventing a second continuation after tapping or a Home choice from advancing a puzzle.

The cat celebrates a correct answer with one animation and then settles to idle. After a mistake it stays calm and offers another approach. Messages vary for ordinary progress, every five newly solved puzzles, trying again, success after a retry, practice completion, boss stages, boss completion, optional challenges and replays. Practice completion does not claim a boss was cleared. Replay messages cannot generate new-solve milestones. All message selection uses the frozen puzzle-entry progress and local retry count, and performs no reward or save writes. English and Latvian are supported. The speech bubble exposes the cat's name and message as one screen-reader utterance; the portrait is decorative. Existing native cat playback and the bubble respect Reduce Motion.

Message selection and milestone rules are checked by `npm run test:puzzles`. The native result-sheet checks run with `npm run test:puzzles:companion:ios -- --device <simulator-UDID>`. The temporary fixture uses the production result sheet, companion and selector, without answering real puzzles or changing the player's language, wallet or saved progress.

Native verification on 2026-10-19 passed on the iPhone 18 Pro simulator running iOS 27. The scenario checks the personalized milestone bubble, supportive retry, boss completion, Latvian text, double-tap continuation deduplication, Home without advancing, and long hints with fixed actions before and after scrolling. The initial long-hint test exposed an unbounded React subtree inside the native sheet. The result body is bounded to the sheet viewport, leaving its actions outside the scroll view. See [native results](qa/puzzle-companion/2026-10-19/test-result.json), [cat encouragement](qa/puzzle-companion/2026-10-19/cat-progress.png), [Latvian](qa/puzzle-companion/2026-10-19/cat-latvian.png), and [long hint](qa/puzzle-companion/2026-10-19/cat-long-hint.png).

The sheet-spacing follow-up removes Expo's default outer content padding, paints the full native sheet with the game background, and sizes expanded React content from `RNHostView.onLayout` rather than a screen-height estimate. iOS no longer adds a second home-indicator inset; content keeps its normal internal margins. Picture help retains a readable inner margin. The native regression scenario verifies that the result body spans the sheet, the actions no longer have the extra bottom gap, long hints scroll, and the exact boss-stage message is translated. See [spacing results](qa/puzzle-companion/2026-10-19/sheet-spacing/test-result.json) and [updated boss stage](qa/puzzle-companion/2026-10-19/sheet-spacing/cat-boss-stage.png).

The i18next setup now merges current resources into an already initialized instance during Fast Refresh without resetting the selected language. Cold initialization and refresh of a stale instance were checked with real i18next for both boss-stage translations, selected-language preservation, and retention of existing keys.

## Progress and the curriculum reset

Completion uses `completedPuzzleIds` as its single source of truth. Topic and lesson completion use `getRequiredIds`, which includes practice puzzles and boss stages and excludes challenges. Unlocking the next lesson still uses `getPracticeIds`. Completing subtraction cannot advance addition, and Easy does not advance Medium. Special-level completion and boss checkpoints use their own IDs. Aggregate difficulty counts are actual completed puzzle counts, not an index into a global path. Existing saves recalculate these completion marks without resetting solved puzzles.

`PUZZLE_CONTENT_VERSION` is now 2. Loading a save from an earlier curriculum deliberately starts puzzle progress, learning streaks, unlocked help and learning statistics fresh. The cat's puzzle-earned level starts at one. The wallet, coin transaction history, pending wallet delivery, pet identity, room layouts and owned items remain available.

Keep the curriculum version unchanged when adding topics, lessons or puzzles. Increment it only when an intentional new learning reset is wanted. The game save format remains version 1; ordinary saves and cloud restores run the same normalization.

## Authoring and extension

The source for the new content is [build-content.mjs](../scripts/puzzles/build-content.mjs). It writes [the curriculum manifest](../data/puzzle-curriculum.json) and the six localized puzzle JSON files under `assets/puzzles/`. Generated files are checked in for Metro to bundle. Edit the authoring source and rebuild, rather than hand-editing generated files.

To add a topic, add a definition to `topics` with its stable ID, English/Latvian name and description, and an existing `AppIcon` name. Add one or more `lesson(...)` definitions for the difficulties that have suitable content. A topic appears automatically only at difficulties with lessons. Its position follows the topic definition order.

Each lesson defines a stable slug, its topic and difficulty, localized title and description, and its own tasks. Use the existing authoring helpers for related practice or author a different task sequence. A lesson's practice levels each contain one puzzle. Do not reorder the task array or reuse a slug to replace an existing task after release, because the helper derives puzzle IDs from the slug and position. Append a new lesson or use a new slug for a replacement.

`finale(...)` attaches a boss to a topic's last lesson. `challenge(...)` attaches one optional activity to that lesson. `special(...)` attaches a special level to a specific lesson and preserves the original missions' IDs. Every new difficulty/topic must have one boss; the build checks this and places it last, after optional challenges. Bosses contain ordered puzzle stages. Challenges use dedicated payloads and answer validators in [challenge-puzzles.ts](../utils/challenge-puzzles.ts), with editable task controls in [ChallengeTasks.tsx](../components/puzzle/ChallengeTasks.tsx). Topic IDs are strings, separate from the puzzle interaction union and broad statistical skill tags.

To introduce a new interaction, add its payload to `types/puzzle.ts`, its answer validation to `utils/puzzle-type.ts`, a task component and dispatch in `PuzzleTaskView`, and any new state/submission wiring in `app/play.tsx`. Include translated interaction labels, accessible instructions, independent picture help and meaningful validator checks. No difficulty-wide type list forces the interaction into other lessons.

The runtime queries, local unlock rules and deep-link validation are in [curriculum.ts](../constants/curriculum.ts). Invalid lessons, mismatched difficulties, locked levels and skipped boss stages redirect to topic selection before task components read a payload.

## Build and verify

```sh
npm run puzzles:build
npm run test:puzzles
npm run typecheck
node scripts/check-game-systems.mjs
node scripts/check-function-machine.mjs
node scripts/check-number-line.mjs
node scripts/check-operation-path.mjs
```

The curriculum check verifies one unique finale at the end of every difficulty/topic, localization, answer keys, fraction equivalence, expression comparison, patterns, routes, operation precedence, number-line bounds, independent worked help, topic/difficulty isolation, optional unlocks, every boss's resume stages, replay and attempt deduplication, reset isolation and reward registrations. Add independent mathematical checks for a new task family. Answer-key acceptance alone cannot establish correctness.

Challenge checks independently enumerate every valid maze route and shopping plan. They reject diagonal or wrapping moves, repeated cells, incomplete sorts, misplaced boundaries, wrong pattern repairs, repeated items and invalid indices. The budget challenge must retain multiple valid solutions. New challenge interactions remain absent from practice and boss levels.

`test:puzzles` also runs the native drag gesture callbacks in an isolated offline harness. It checks translated board coordinates, hover targets, valid releases, outside drops, cancellation, missing measurements, scroll unlocking, solved-board disabling and screen-reader actions. The curriculum tests separately check ordering moves in both directions, repeated values, invalid positions, tile replacement, swapping and return to the bank. These checks do not substitute for testing touch input on a native device.

To run real iOS touch tests, start Metro and connect an installed development build, then run `npm run test:puzzles:ios -- --device <simulator-UDID>`. Use `xcrun simctl list devices booted` to find the exact identifier; the runner deliberately requires it instead of selecting an ambiguous device name. This requires Xcode and CocoaPods' Ruby `xcodeproj` gem. The runner creates a temporary development route with the production puzzle components, uses XCUITest to drag tiles, and removes that route afterward. It does not submit puzzle progress or award coins, and it scopes English selectors to the test screen without changing the saved language. The log and `.xcresult` bundle, including screenshots, are saved in the temporary directory printed by the command.

Native verification on 2026-10-19 passed both basket and pattern scenarios on an iPhone 18 Pro simulator running iOS 27. Tests cover basket-to-basket transfers, return to the bank, outside releases, correct answer checks, dragging after scrolling, filled-gap swaps in both directions, replacement from the bank, and clearing a gap. The native run exposed a measurement race where queued shared-value writes discarded sibling drop targets. Drop measurements now accumulate on the JS thread before publishing the full list to the UI thread, and the offline harness reproduces that race. Evidence: [basket transfer](qa/native-puzzle-drag/2026-10-19/basket-transfer.png), [pattern swap](qa/native-puzzle-drag/2026-10-19/pattern-swap.png), [dragging after scrolling](qa/native-puzzle-drag/2026-10-19/after-scroll.png).

Navigation between Home, topics, lessons and puzzles reads the local curriculum. Browsing these screens no longer records a pet interaction: that previously updated the game provider, rerendered its consumers, and scheduled save persistence on every menu tap. Puzzle answers, picture help and pet care retain their interaction updates. Home prepares the puzzle menu and shop during idle time. The iOS stack uses `simple_push` with a 220 ms transition; `slide_from_right` resolves to the default iOS transition, which ignores a custom duration.

The native navigation check on 2026-10-19 completed three rounds through Home → topics → Numbers and order → first lesson → first puzzle, then back through the hierarchy, without submitting answers. The 24-action automation median fell from 2.33 s to 0.74 s. These measurements include XCTest tap and accessibility work, and are not release-device paint times. The first open after hot reload remained variable, including a slower first sample after the change. Raw samples and limitations are in [navigation timings](qa/navigation/2026-10-19/timings.json); [before](qa/navigation/2026-10-19/before-test-result.json) and [after](qa/navigation/2026-10-19/after-test-result.json) test results and the [native test source](qa/navigation/2026-10-19/NativeDragTests.swift) are retained alongside them. To reproduce, copy that Swift source to a temporary directory, generate its standalone project with `ruby scripts/native/puzzle-drag/create-project.rb <directory>`, and run the `NativeDragTests` scheme with an explicit simulator ID. The timing scenario uses an English test save whose first Numbers lesson is still in progress.

The follow-up Release build on the same simulator used optimized arm64 native code and an embedded Hermes bundle, with sandbox services and the existing save. Three process-cold launches reached interactive home controls in 8.85–9.13 s, with a median of 8.94 s. The first puzzle-menu open after each launch had a 0.69 s median; 24 warm navigation actions had a 0.46 s median. All 48 navigation actions, difficulty switches and native back swipe passed. These timings include XCTest launch/tap/accessibility overhead, and retain application data and OS caches. Cold startup remains the largest measured delay. The splash assets were freshly captured from the current native cat, the full startup suite passed, and all three launch PNGs inside the built app matched the regenerated artwork after reversing Apple's PNG optimization. Progress, coins, pet identity and saved room layouts matched the pre-test backup. See [Release timings](qa/navigation/2026-10-19/release/timings.json), [build verification](qa/navigation/2026-10-19/release/build.json), [packaged splash pixels](qa/navigation/2026-10-19/release/packaged-splash-pixels.json), and the separate [startup visual sequence](qa/navigation/2026-10-19/release/startup-sequence.png).

Native ordering verification on 2026-10-19 passed in the development build on the same iPhone 18 Pro simulator. The three native scenarios passed together: ordering, basket transfers and pattern repair. Ordering checks cover moving left and right, preserving intermediate order, outside releases, editing again after retry, correct and incorrect feedback, and disabling drags after submission. The temporary test route was removed afterward. See [test results](qa/native-puzzle-drag/2026-10-19/ordering/test-result.json), [move left](qa/native-puzzle-drag/2026-10-19/ordering/order-drag-left.png), [move right](qa/native-puzzle-drag/2026-10-19/ordering/order-drag-right.png), and [submitted answer](qa/native-puzzle-drag/2026-10-19/ordering/order-correct-locked.png).

## Boss mini-stories and Blender scenes

Every topic boss has a unique story with exactly three saved tasks. Story copy is authored in English and Latvian in `scripts/puzzles/boss-stories.mjs`, attached by `scripts/puzzles/build-content.mjs`, and shipped in the curriculum manifest. Each stage has a title, a prompt before solving, and a consequence after solving. The final outcome replaces the intermediate encouragement in the cat's speech bubble. The picnic carries its 13-guest count through all three tasks; the garden plans its beds and path before collecting seeds.

`BossStoryScene` shows the scene for the session's current checkpoint. Correct answers reveal the next state in the result sheet and play its cat reaction once. Incorrect answers keep the checkpoint and show the ordinary retry message. Resuming uses the saved next task and its still cat pose, without replaying a success reaction; replaying starts from the first scene even when all three puzzle IDs were already solved. A topic still requires the boss for completion, and bosses do not block entry to another lesson. Puzzle IDs and coin reward registration are unchanged.

The 18 dioramas use the same Blender materials, rounded geometry and lighting helpers as the room assets. Each scene now includes the shipped orange cat from `assets/3d/native/cat-orange.glb`, including its 89-bone rig, facial controls and existing animation clips. `scripts/3d/boss_cat.py` stages that character and its story tools, samples the rig's poses, and bakes them into each scene's editable timeline. Examples include riding the train and supply lift, carrying the kite string, watering flowers, performing on stage and resting at the completed shelter. The story's four bilingual `catActions` descriptions live in `scripts/puzzles/boss-cat-actions.mjs` and become native accessibility hints.

Editable sources are in `prototypes/boss-scenes/`. The Blender timeline runs from frame 1 to 36, with markers at 1, 2, 11 and 20 for entry, the first two cat reactions, and the mission outcome. Each scene bundles four 768 × 480 transparent PNG checkpoints, two eight-frame 2048 × 640 task-reaction atlases, and one sixteen-frame 2048 × 1280 ending atlas in `assets/3d/bosses/`. Task reactions last one second and the final animation lasts two seconds, at eight frames per second. Only the currently playing clip is decoded, about 5 MiB for a task reaction or 10 MiB for an ending. Skia advances frames on the native UI thread; clips hold the corresponding high-resolution checkpoint when finished. The ending offers replay. The result column uses the native sheet's explicit content-height bound so long stories scroll above the fixed actions. Continue stays available during playback. Backgrounding or covering the route pauses playback; Reduce Motion shows the checkpoint still.

Each `cat-staging.json` records the model hash, skeletal pose fingerprints, projected body bounds and visibility rays for every checkpoint and animation frame. Offline checks verify that the cat itself changes pose, remains large enough to see, stays inside the scene, and has an unobstructed head. The last frame matches the checkpoint's projected geometry, with a small floating-point tolerance, so switching from the clip to the still does not produce a visible jump.

Run `npm run assets:bosses` to rebuild all scenes and their static Metro registrations. To rebuild one scene, run Blender with `--python scripts/3d/build-boss-scenes.py -- --id train`, then `node scripts/3d/pack-boss-scenes.mjs --id train`. The optional Blender flag `--preview` renders only the four checkpoints. Run the packer only after a full render. Geometry and animation remain editable in each saved `.blend`; baked PNGs are generated outputs.

For a new topic boss, add its three puzzles and bilingual story, add a scene builder with four distinct states, cat blocking and tools, two task reactions and an ending, then rebuild the curriculum and assets. `npm run test:puzzles` checks all story fields, checkpoint/retry behavior, reward registrations, distinct rendered states, atlas dimensions, changing animation frames and retained Blender sources. `npm run test:puzzles:bosses:ios -- --device <UDID>` exercises all 36 task reactions, 18 endings and the real result sheet in a temporary native fixture without writing game progress, rewards or language preferences. The runner removes that route afterward. During the long boss run, the fixture temporarily disables Fast Refresh and restores the simulator's previous setting when it closes. This keeps unrelated source edits from resetting a mission halfway through verification.

Native verification on 19 October 2026 passed both boss-story scenarios in the iOS development build on the iPhone 18 Pro simulator. The first scenario loads all 18 endings, checks replay after one-shot playback, leaves during a replay, and verifies that both fixed actions stay fully above the home indicator. The second checks retries, the first two successful scene changes, restart, resumed scene presentation, Latvian text, and rapid continuation. Offline checks additionally exercise the real curriculum/session and reward logic for every boss. No fixture answers or rewards are persisted. All four checkpoints and every outcome frame pass the crop checks. The existing native cat-companion regression also passed after bounding the result column, including long hints and single continuation. See [all 18 scenes](qa/boss-stories/2026-10-19/all-boss-scenes.png), the [actual picnic task screen](qa/boss-stories/2026-10-19/native-picnic-start.png), [first completed task](qa/boss-stories/2026-10-19/native-stage-one.png), [vault ending](qa/boss-stories/2026-10-19/native-vault-outcome.png), and [native results](qa/boss-stories/2026-10-19/native-test-result.json).

The follow-up native cat run on 19 October 2026 passed both scenarios with all 36 task reactions and 18 endings. The tests check one-shot completion, unrestricted continuation, final replay, leaving during replay, retry, static resume poses, Latvian text and rapid continuation. The Blender audit opened all 18 saved sources and verified their skeletal timelines. See [cat story progress](qa/boss-stories/2026-10-19/cat-story-progress.png), [first reaction](qa/boss-stories/2026-10-19/native-cat-reaction-one.png), [garden ending](qa/boss-stories/2026-10-19/native-cat-garden-outcome.png), [native cat results](qa/boss-stories/2026-10-19/cat-native-test-result.json), and [Blender source audit](qa/boss-stories/2026-10-19/cat-blender-source-audit.json).

## Server reward registration

Boss stages now pay twice the regular difficulty reward: 8 / 14 / 18 coins on first clear and 4 / 6 / 8 on replay for Easy / Medium / Hard. Each of a mission’s three saved stages pays separately. Practice and optional challenge rates remain unchanged. The client derives the reward kind from the authored curriculum, and the question badge uses the same reward policy as local crediting.

The forward-only [boss reward migration](../supabase/migrations/20261019162832_boss_coin_rewards.sql) was applied to the hosted project on 19 October 2026. All 54 stage registrations matched the new rates. Before and after deployment, rollback-only acceptance checks verified first clears, replays and duplicate attempts for every stage in both environments. A database assertion verified that non-boss rates did not change. Test accounts were rolled back, and the existing 1,000-coin daily limit remains in place. The acceptance query uses a separate temporary account per difficulty so that testing every reward does not exhaust that limit. See [deployment evidence](../supabase/deployments/2026-10-19-boss-double-rewards.json) and [the acceptance query](../supabase/tests/puzzle-rewards.sql).


The additive [curriculum migration](../supabase/migrations/20261019095912_learning_curriculum.sql) registers the original 165 replacement puzzle IDs. The [topic finale migration](../supabase/migrations/20261019102550_puzzle_catalog.sql) adds the 36 new boss stages with their difficulty's first-clear and replay rewards. Both retain historical catalog entries and wallet records. Apply pending migrations through the normal Supabase migration process before relying on live coin rewards for the new catalog.

Both migrations were applied to the MathMews hosted project on 19 October 2026. All 201 puzzle registrations matched the app rates. Transactional hosted checks verified first clears, replays and duplicate attempts for all 54 boss stages in both environments, then rolled back every test fixture. See [deployment evidence](../supabase/deployments/2026-10-19-puzzle-rewards.json) and the reusable [acceptance query](../supabase/tests/puzzle-rewards.sql).

The [optional challenge migration](../supabase/migrations/20261019104853_puzzle_catalog.sql) was also applied on 19 October 2026. It registers the eight added activities, bringing the curriculum to 209 reward IDs. Hosted rollback checks verified all eleven challenge rewards in both environments, including first clears, replays and duplicate attempts. See [challenge deployment evidence](../supabase/deployments/2026-10-19-challenge-rewards.json) and the [challenge acceptance query](../supabase/tests/challenge-rewards.sql).

For subsequent additions, run `node scripts/backend/generate-wallet-catalog.mjs` to produce a forward-only migration for new IDs. Its number-line registrations now use the authored difficulty instead of forcing Hard rewards. Apply the new migration through the same deployment process.

On 19 October 2026, local curriculum, game-system, type, interaction and wallet/store checks passed. Native inspection confirmed the topic and lesson screens. Live database registration requires an authenticated deployment session; the CLI in this workspace was not authenticated during implementation.
