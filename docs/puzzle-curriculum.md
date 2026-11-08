# Topic based puzzle learning

Math Mews uses difficulty → topic → lesson → puzzle. Each difficulty has eleven regular topics with ten lessons each, plus three Cat plans. The current catalog has 339 lessons and 3,390 puzzles per language in English, Latvian and Russian. Lessons follow ten-step paths with a timed or untimed final stretch at step eight. The original puzzle identities and earned progress are preserved. Earlier sections below describe the historical story-mission structure; `constants/puzzle-path.ts` defines current navigation.

## Current rewards and task kinds, November 8, 2026

The current catalog has 339 ten-task lessons and 3,390 puzzles per language. All untimed puzzles use ordinary difficulty rewards: 4/7/9 coins for a first clear and 2/3/4 for a replay, in Easy/Medium/Hard order. Choosing the timer at step eight and finishing the remaining three tasks before the deadline pays twice those ordinary rates. Choosing untimed play never grants the timer bonus. Pending timed progress pays only after the entire run succeeds; expiry clears the pending reward.

The shipped catalog contains only practice and challenge kinds. Retired mission labels, story metadata, scene components, collection/share helpers and their localized messages are removed from the app. Original puzzle IDs and grouped-route IDs remain for saved progress and old links. Historical authoring/art sources and previously applied database migrations remain archival material.

The matching server reward migration is `supabase/migrations/20261108153000_regular_puzzle_rewards.sql`. All 540 affected rates were updated and verified on the hosted server. Regular first clears/replays and all 339 timer scopes passed transaction-only acceptance checks in sandbox and production. See `supabase/deployments/2026-11-08-regular-puzzle-rewards.json`. Existing ledger entries are retained.

## Everyday math categories — November 7, 2026

Time and schedules, Data and graphs, Shapes and spatial reasoning, Money and shopping, and Capacity and volume each add ten lessons at every difficulty: 150 lessons and 1,500 puzzles. These lessons use `format: "path"`, seven practice steps, a challenge entry at step eight, and two review steps. They reuse the existing answer, lives, timed-session and save systems. They do not add archived boss achievements.

Author these categories in `scripts/puzzles/everyday-topics.mjs`, then run `npm run puzzles:build`. The builder writes localized questions and diagrams into the shared puzzle assets and twelve daily-review variants per lesson into `data/everyday-reviews.json`. The renderer supports clocks, bar charts, polygons, transformation grids, pretend price tags, graduated vessels and box dimensions. Each puzzle has a worked example with different givens. Canonical units are integer minutes, cents and millilitres; displayed decimals follow the selected language.

`npm run test:puzzles` checks all new answer keys independently from their diagram givens, localized answers, varied examples, progression and original save identities. Run `node scripts/native/check-puzzle-drag.mjs --everyday --device <simulator-UDID>` for native diagram, retry, answer-selection and help-sheet checks, including 320-point Latvian and Russian layouts. Additive reward and timed-run registrations live in `supabase/migrations/20261107230000_everyday_puzzle_catalog.sql`.

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

Every lesson at each difficulty has exactly one uniquely named boss. It is the final level of its lesson, after the optional challenge. The original eighteen topic finales remain in lesson ten with their existing IDs and stories. Each boss has a bilingual backstory explaining the character’s problem and motivation, shown on its gold card and before its first task. A new Blender crown and paw-shield badge identifies boss missions. Each mission follows its own story and uses the topic's skills across linked stages. The main lesson button offers the boss after practice, while the challenge remains available separately. Boss stages use the existing task renderers and their own stable puzzle IDs.

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

Challenges have a separate purple presentation with a Blender stopwatch icon. Every lesson has a timed optional challenge. All 47 previously authored challenges retain their IDs; introductory Easy fraction boards now use matching quantities before equivalence; 133 added challenges fill the remaining lessons. Limits are three minutes on Easy, four on Medium and five on Hard. They offer whole-board goals and room to revise a plan within the attempt. Not every interaction appears at every difficulty.

| Interaction | Difficulty and topic | Goal |
| --- | --- | --- |
| Pair hunt | Easy addition, Medium addition, Hard reasoning | Collect every valid pair, ignoring decoys. |
| Basket sorting | Easy numbers | Place every number below ten or at least ten; the boundary belongs in the upper basket. |
| Fraction post office | Medium fractions | Sort six differently written fractions by their equivalent values. |
| Pattern repair | Easy patterns, Medium multiplication, Hard patterns | Fill two gaps using a tile bank with decoys. Difficulty rises from counting in fives, through multiples of seven, to powers of three. |
| Number maze | Medium and Hard number routes | Choose adjacent squares that transform a running number. Medium uses four moves; Hard requires a six-move detour. No square can be reused and every intermediate value must be a nonnegative whole number. Undo is free. |
| Budget planning | Hard percentages | Choose two supplies after discounts while leaving an exact pretend balance. Both valid shopping plans are accepted. No real game coins are spent. |

Pair hunts count reversed pairs once, forbid pairing a tile with itself and permit a tile to join different pairs. Incorrect or duplicate additions receive immediate feedback. Challenge edits remain available after an unsuccessful submission while the clock is still running. A timeout ends that attempt and uses one life, without awarding coins or completion. Try again starts a fresh board and full timer; at zero lives it offers recovery instead. Leaving an unfinished challenge clears its unsaved draft, while its saved deadline continues running. Only completed boss stages are checkpoints.

Number ordering, basket sorting and pattern repair use native drag and drop. In ordering puzzles, dropping a number onto a position inserts it there and shifts the numbers in between; the learner checks the answer separately. Tiles follow the finger, the current destination gets a teal outline, and releases outside a destination preserve the previous placement. Sorted tiles live inside their baskets and can be dragged between baskets or back to the tile bank. Moving between filled pattern gaps swaps the tiles; a tile from the bank replaces the old tile, which returns to the bank. The surrounding puzzle scroll view pauses during a tile gesture and unlocks after release or cancellation. VoiceOver and TalkBack users can choose destinations through each tile's accessibility actions.

Both special kinds become available after the practice in their lesson. Bosses are required for the lesson and topic completion marks; challenges are optional. Neither kind blocks another topic or the next lesson. Help remains free. Three shared lives limit incorrect attempts across practice, bosses and challenges. Rewards use ordinary difficulty rates for each completed puzzle or boss stage. There is no additional client-only mission bonus.

## Three shared lives

The player has three lives across all difficulties, topics and lesson kinds. A submitted incorrect answer uses one life. Incorrect fraction-card matches and submitted invalid pair-hunt pairs also use one life because those interactions check the answer immediately. Editing a draft, using picture help, finding a valid pair, or submitting a correct answer costs no life. Duplicate submissions cannot consume a second life, and selecting tiles does not expose whether an unsubmitted pair is correct.

At zero lives, ordinary answer checking pauses. **Learn with the cat** stays available from the puzzle browser and the play screen. It provides three supported steps, free retries, concrete counters or fraction pieces where appropriate, and repeatable examples in English and Latvian. It never awards coins, restores lives, clears ordinary puzzles, or unlocks lessons. Leaving an active timed challenge for learning keeps its deadline running. Instant matching controls also pause, while ordinary draft work and free worked examples stay available. Closing and reopening keeps the remaining lives and the regeneration deadline. One free life regenerates every 30 minutes, up to three; later mistakes do not restart that timer. The existing coin refill can restore a life at its current catalog price. Correct answers retain their ordinary first-clear or replay rewards, including double boss-stage rewards.

The play screen shows three hearts beside the lesson title, explains the cost before submission and offers recovery actions at zero. The game operation enforces the same limit using current saved state, so a stale UI callback cannot complete or reward a task after lives run out. Older five-life saves normalize to the three-life cap. This uses the existing saved-life fields and wallet refill, so no database migration or reward RPC change is needed.

The curriculum checks cover depletion, save/reopen, duplicate attempts, zero-life blocking, regeneration, refill and reward preservation for all three difficulties and level kinds. The experience checks include instant matching and pair-hunt mistakes. Native checks use the actual play screen inside an isolated in-memory provider, without writing player progress or spending real game coins. Run `node scripts/native/check-puzzle-drag.mjs --lives --device <simulator-UDID>`. See the [native results](qa/three-lives/2026-10-19/native-results.json).

## Variety within lessons and missions

All 180 practice lessons have four activities. The introductory addition and fraction pilot deliberately repeats some structures and amounts while the child learns the controls. Most lessons have at least three interaction types. The twenty Easy addition and fraction lessons use a deliberate exception: early tasks repeat familiar controls so a new interaction does not compete with a new mathematical idea. Addition, subtraction, multiplication, division, fractions, operations, percentages, measurement and reasoning use different operands, quantities or fractions across the activities. Small numbers can recur naturally, but the same calculation is not reused to supply later answers.

Pattern lessons mix next-number sequences, rule machines and missing-number questions. Their four activities use different rules. Easy includes increasing and decreasing steps; Hard mixes multiplication, division, addition and subtraction. For example, the first Hard set uses ×3, ÷4, ÷3 and −7. Questions leave those rules for the learner to discover. The two pattern missions also change rules between stages while passing a quantity from one stage into the next.

Most three-stage boss missions include at least two interaction types. The revised Easy addition and fraction introductions keep controls stable where that supports the skill sequence. The toy workshop, lantern trail and toy shop now use different interactions within their existing stories. Connected story quantities still agree with the Blender scenes. Practice percentages cover 10%, 20%, 25% and 50%, with separate animated help examples for each. Measurement estimates round the total to the nearest ten.

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

The source for the new content is [build-content.mjs](../scripts/puzzles/build-content.mjs). It writes [the curriculum manifest](../data/puzzle-curriculum.json) and three shared puzzle JSON files under `assets/puzzles/`, one per difficulty. Each puzzle stores its ID, quantities, answer key and learning metadata once. Translated display fields contain adjacent `en`, `lv` and `ru` strings; identical text and mathematical expressions remain shared. Generated files are checked in for Metro to bundle. Edit the authoring source and rebuild, rather than hand-editing generated files.

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

## Retired story presentations

Boss story copy and original puzzle IDs remain in the curriculum for saved-progress and reward compatibility. Current lessons use ordinary ten-task paths with a timed final section. They do not display boss scenes or achievement movies. The obsolete 3D dioramas, 2D picnic pilot, reward GIF collection and decorative trail sprites were removed with their generators and dedicated tests on November 8, 2026.

Keep `scripts/puzzles/boss-stories.mjs`, `scripts/puzzles/lesson-boss-stories.mjs` and `data/lesson-boss-scenes.json` when editing compatible content. These still supply the curriculum builder. Puzzle object illustrations and instructional animations remain active, with checks in `npm run test:puzzle-art` and `npm run test:action-motion`. `npm run test:topic-path-layout` verifies route geometry without decorative assets.

## Server reward registration

Boss stages now pay twice the regular difficulty reward: 8 / 14 / 18 coins on first clear and 4 / 6 / 8 on replay for Easy / Medium / Hard. Each of a mission’s three saved stages pays separately. Practice and optional challenge rates remain unchanged. The client derives the reward kind from the authored curriculum, and the question badge uses the same reward policy as local crediting.

The forward-only [boss reward migration](../supabase/migrations/20261019162832_boss_coin_rewards.sql) was applied to the hosted project on 19 October 2026. All 54 stage registrations matched the new rates. Before and after deployment, rollback-only acceptance checks verified first clears, replays and duplicate attempts for every stage in both environments. A database assertion verified that non-boss rates did not change. Test accounts were rolled back, and the existing 1,000-coin daily limit remains in place. The acceptance query uses a separate temporary account per difficulty so that testing every reward does not exhaust that limit. See [deployment evidence](../supabase/deployments/2026-10-19-boss-double-rewards.json) and [the acceptance query](../supabase/tests/puzzle-rewards.sql).


The additive [curriculum migration](../supabase/migrations/20261019095912_learning_curriculum.sql) registers the original 165 replacement puzzle IDs. The [topic finale migration](../supabase/migrations/20261019102550_puzzle_catalog.sql) adds the 36 new boss stages with their difficulty's first-clear and replay rewards. Both retain historical catalog entries and wallet records. Apply pending migrations through the normal Supabase migration process before relying on live coin rewards for the new catalog.

Both migrations were applied to the MathMews hosted project on 19 October 2026. All 201 puzzle registrations matched the app rates. Transactional hosted checks verified first clears, replays and duplicate attempts for all 54 boss stages in both environments, then rolled back every test fixture. See [deployment evidence](../supabase/deployments/2026-10-19-puzzle-rewards.json) and the reusable [acceptance query](../supabase/tests/puzzle-rewards.sql).

The [optional challenge migration](../supabase/migrations/20261019104853_puzzle_catalog.sql) was also applied on 19 October 2026. It registers the eight added activities, bringing the curriculum to 209 reward IDs. Hosted rollback checks verified all eleven challenge rewards in both environments, including first clears, replays and duplicate attempts. See [challenge deployment evidence](../supabase/deployments/2026-10-19-challenge-rewards.json) and the [challenge acceptance query](../supabase/tests/challenge-rewards.sql).

For subsequent additions, run `node scripts/backend/generate-wallet-catalog.mjs` to produce a forward-only migration for new IDs. Its number-line registrations now use the authored difficulty instead of forcing Hard rewards. Apply the new migration through the same deployment process.

On 19 October 2026, local curriculum, game-system, type, interaction and wallet/store checks passed. Native inspection confirmed the topic and lesson screens. Live database registration requires an authenticated deployment session; the CLI in this workspace was not authenticated during implementation.


## Timed attempt persistence

The challenge introduction explains the time limit and life cost before the Start challenge button begins the attempt. The actual question and draft controls appear after starting. During an attempt, a persistent countdown sits above the scrolling work area and turns red for the final thirty seconds. Picture help remains available; opening it or leaving the route does not pause the clock. The fixed action dock keeps Start, Try again, and lives recovery reachable above the home indicator.

One timed attempt may run at a time. Opening another challenge offers Resume active challenge. Its attempt ID, authored duration and absolute deadline are saved with progress. Storage normalization, foreground ticks and answer handling settle overdue attempts before regenerating lives or granting rewards. Expiry is idempotent, uses at most one available life at the original deadline, and ignores stale callbacks from an earlier attempt. Answering at or after the deadline is rejected. A completed attempt stops expiring.

All 180 challenges have model checks for ready, resume, exact deadlines, retry, duplicate callbacks, offline reopening and rewards. Native iOS checks exercise the real screen with isolated saves, including expiry after reopening, one-life loss, successful retry, Latvian copy, one active attempt, zero-life recovery, ten lessons and both special cards across all difficulties. Run `node scripts/native/check-puzzle-drag.mjs --timed-challenges --device <simulator-UDID>`. See [curriculum expansion evidence](qa/curriculum-expansion/2026-10-20/native-results.json).

The additive [expansion migration](../supabase/migrations/20261020080901_puzzle_catalog.sql) was applied on 20 October 2026. It registers the 612 added puzzle IDs and preserves historical registrations. The hosted verification matched all 821 active first-clear and replay reward entries, including the existing doubled boss rates. The saved query is named **Puzzles - 10 Lessons per Topic and Reward Verification**, with a description of its scope and safe rerun behavior. See [deployment evidence](../supabase/deployments/2026-10-20-curriculum-expansion.json).


## Special levels in every lesson

Each of the 180 lessons contains four practice puzzles, one optional timed challenge and one three-stage boss. Practice opens both special levels. The boss is required for that lesson’s completion; its challenge remains optional. Completing practice still unlocks the next lesson without requiring the boss or challenge first. The lesson list shows both special-level labels, and progress includes the lesson’s three boss stages.

The 162 added bosses now each have their own named character, bilingual problem and outcome, Blender scene and animation. Nine character and mechanism families appear across eighteen places, with individual staging and motion for each mission. Existing finales retain their original plots and quantities. Saved checkpoints, double rewards and free picture help remain available. New boss stages use independent examples and at least two interaction types. New challenge boards vary within each topic and retain three/four/five-minute limits, durable deadlines and one-life timeout settlement.

The per-lesson expansion preserved all 785 previous level records and 821 previous puzzles. The later individual-boss artwork update replaces the 162 added episode stories and scene references while retaining level IDs, puzzle IDs, mathematical tasks, rewards and completions. The [per-lesson reward migration](../supabase/migrations/20261020085218_puzzle_catalog.sql) adds the 619 new reward IDs. The saved SQL query is named **Puzzles - Challenge and Boss in Every Lesson**. See [native and preservation checks](qa/lesson-specials/2026-10-20/results.json).


## Visual lesson progress

The topic's lesson list now groups each lesson in a white card with a rounded peach outline and cream space between cards. Each card shows three separate activities: Practice, Challenge and Boss. Each has a Blender icon, exact count, and one segment per puzzle or checkpoint. Filled segments show completed work. A check confirms a complete activity; a lock marks unavailable work. Short lesson labels distinguish Not started, In progress, Boss left, Challenge left and All done. Locked lessons keep disabled navigation. The challenge column is always marked Optional. Required completion and next-lesson unlocks retain their previous rules.

The list removes generic lesson descriptions, the repeated long required-progress sentence and the special-level status sentence. Those descriptions remain inside each lesson. The topic's overall required count is labeled Practice + bosses, with a visible peach progress track. Narrow rows put the activity labels below their icons and allow the lesson status to wrap. Each row's screen-reader label gives all three counts, states and the optional-challenge explanation.

The former lesson-list display derived its state from saved IDs. Its unused display helper has been removed; current topic trails use `constants/puzzle-path.ts`. Accepted answers, including a first mistake, record `attemptedPuzzleIds`; starting a timed challenge also records its puzzle ID. This history survives reopening and remains when another timed run begins. Parsing filters unknown IDs and duplicates, seeds prior completed IDs, and clears attempt history on a curriculum reset. Existing mistakes that were never stored with a puzzle ID cannot be reconstructed. These started markers do not grant coins, solve a puzzle, unlock a lesson or collect an achievement.

The old lesson-list icon exports have been retired. `node scripts/check-curriculum.mjs` verifies current path progression, optional completion and persisted first mistakes. Run `node scripts/native/check-puzzle-drag.mjs --lesson-progress --device <UDID>` for real English/Latvian screens and isolated saves. The runner removes its temporary route. See [research and design rationale](qa/lesson-progress/2026-10-20/research.md), [native results](qa/lesson-progress/2026-10-20/results.json) and [finish review](qa/lesson-progress/2026-10-20/finish-review.md).


## Learning progression and evidence

The 4 November Easy and Medium audit covers all 120 lessons, including their bosses, challenges, path reviews and daily checks. The topic sequence remains in place, but the generated quantities now follow explicit lesson ranges. [England's mathematics programme](https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study) provides a reference for building from concrete groups and familiar multiplication facts toward broader multiplication, division and mixed operations. This is a content review, not a classroom assessment or a certification of the displayed age ranges.

| Track | Finding and revision |
| --- | --- |
| Easy numbers | The first challenge used numbers up to 27 while practice focused on small numbers. The complete first path now stays within 10; later paths stay within 20. Range questions, including the train finale, now have only one valid choice. |
| Easy addition | The first two lessons repeated the same practice facts, and later bosses reused practice facts. The second lesson and boss variants now use different examples. The existing sequence through counting on, making ten, missing parts and error repair remains. |
| Easy subtraction | Retained the existing progression from taking away within 10 to reaching and crossing 10, finding missing amounts, checking and repairing. Repeated facts across these representations are intentional practice. |
| Easy patterns | Early practice, bosses, challenges and reviews now use steps of 1 or 2. Later lessons introduce larger steps and both directions. Challenge boards use distinct examples. |
| Easy equal groups | The opening lessons now use visible arrays with twos and fives before machine rules, claims and missing factors. Later lessons introduce tens, threes and fours, followed by mixed practice and the existing finale. |
| Easy fractions | Retained the whole/half introduction, then simplified lessons 5–10. Comparisons use matching denominators; symbolic equivalence splits or joins pairs, with no denominator above eight. Later sorting challenges use four cards and familiar amounts. |
| Medium addition | Retained the place-value introduction. Subsequent practice uses two-digit quantities and totals below 100 before later lessons cross 100. Bosses and reviews follow the same ranges; original story contexts remain. |
| Medium subtraction | Retained exchanging tens and ones with blocks. Later symbolic tasks stay within 100 and use different quantities for each role in the path. |
| Medium equal groups | Replaced the changing table selection with a sequence through familiar facts, threes/fours, sixes/eights, sevens/nines, then elevens/twelves and mixed review. Daily checks no longer jump to products such as 23 × 8. |
| Medium division | Every task in the first lesson divides exactly. Remainders follow in the second lesson. Challenges now test sharing instead of jumping to descending powers; visual sharing stays within five plates and 35 counters. Symbolic work extends through the later multiplication tables. |
| Medium fractions and decimals | The opening two lessons reuse Easy fractions within eight parts, then introduce larger equivalents and comparisons gradually. Decimal lessons retain tenths, hundredths and exchanges; their daily checks test decimal place value. |
| Medium number routes | The first three paths use addition/subtraction before multiplication, division and mixed expressions. Short routes precede navigation challenges. Daily checks follow the same operation sequence. |

The revision preserves all puzzle IDs, skill IDs, path positions, timers, rewards and earned completions. Hard content is unchanged by this audit. `scripts/puzzles/check-foundations.mjs` checks every Easy/Medium path in English, Latvian and Russian, including range-answer validity after shuffling, visual sharing limits, prerequisite operations and 22 daily-check variants per lesson. The full curriculum suite also checks mathematical answers, independent practice examples, challenge solutions, model geometry and save compatibility. Child observation is still needed to judge reading load, frustration and the pace of progression.

The later Easy fraction review covers all 60 positions in lessons 5–10. Equivalence progresses from halves to thirds and quarters, then joining pairs and mixed practice. The lesson-six strip tasks offer only partitions that can represent the target exactly, and number lines use the same subdivisions as the named fraction. Hints and worked examples stay within eight parts; daily checks include a picture and avoid improper-fraction distractors. The kite finale retains its two-sixths patch and four-sixths remainder, with explicit guidance to join sixths into thirds. `scripts/puzzles/check-easy-fractions.mjs` checks these limits in all three languages, including shuffled answers and 33 daily-check variants per lesson.

The Easy-to-Medium fraction transition now keeps both opening Medium paths within eight parts, including bosses, challenges, reviews and help. Lesson two uses familiar amounts on strips and number lines; every offered partition can represent the target exactly. Lesson three compares single pieces with different denominators, lesson four compares equal numbers of pieces, and lessons five and six compare with one half. Equivalence expands from splitting or joining pairs to factors of three, then four. Maximum denominators across the six paths are 8, 8, 12, 12, 18 and 24. Sorting stays at four cards through lesson three, then increases to six. Daily checks retain fraction pictures and proper-fraction choices. `scripts/puzzles/check-fraction-transition.mjs` checks all 60 positions and 33 daily variants per lesson in English, Latvian and Russian, including mathematical answers and method-specific visual help. Puzzle identities, rewards, progression and decimal lessons remain unchanged.

The Medium-to-Hard transition reconnects the Medium finale to decimal work with `0.6 = 6/10 = 3/5`, then uses related denominators for comparison. Its equivalence challenge and daily reviews stay within 24 parts, and the fountain story retains its blue three eighths and remaining five eighths. Hard starts with unit fractions of small collections and interactive equal groups. Lesson two introduces several groups with visual support on the first example; later applications remove that support. Quantity limits across the first four Hard paths are 20, 25, 32 and 40; equivalence denominators stay within 12, 16, 20 and 24. The daily checks follow these limits and remain within 64 items thereafter, replacing the previous hundreds-sized unit-fraction questions. Help now demonstrates unit fractions of a collection and comparison with a common denominator. `scripts/puzzles/check-hard-fraction-transition.mjs` verifies the finale, all 40 opening Hard tasks and 33 daily variants per Hard lesson in all three languages. Saved identities, story quantities and rewards remain stable. These content checks still need learner observation to confirm the pace.

The 4 November Hard reasoning revision replaces all 20 whole-number sorting tasks with multiple-choice reasoning. Early replacements combine bounds, divisibility and parity; later replacements work backwards through two operations or find a quantity from a total and difference. Bosses use different values, and the archive finale combines the bounds with an even multiple of seven. Hints explain the method, and explanations check the result. English, Latvian and Russian share the same quantities and answer keys. Six existing “which amount is impossible?” questions had more than one valid choice; the revised distractors leave exactly one valid answer throughout that question family. Puzzle IDs, skill IDs, rewards and saved completions stay unchanged. Regression checks solve each replacement independently and verify every choice after shuffling. This addresses the sorting mismatch; it does not establish that all Hard tasks suit every player aged 10–12.

The 24 October revision keeps all 1,440 puzzle IDs per language and content version 2. Easy addition now introduces joining, symbols, counting on, making ten, missing parts, equal totals, checking, repair, application and review. Easy fractions introduce equal pieces and halves before quarters, unit fractions, magnitude, comparison and equivalence. Topic finales retain their scene-specific quantities. Lesson and puzzle metadata records skill dependencies and the intended representation.

Comparison answers balance left and right in the authored catalog and shuffle at runtime. Pure numeric three-choice practice answers vary their numeric rank; 90 are smallest, 88 middle and 97 largest. Existing authored errors are retained as distractors where they fit. Independent review questions also vary value rank and position. Hard pattern-repair examples no longer repeat the same multiplier every three lessons.

Saved learning evidence is separate from earned completion. A correct first submission without prior help or a saved previous attempt counts as independent evidence for that puzzle. Helped solutions and retries remain supported evidence. Existing players keep completion and rewards; old completions are not retrospectively called independent successes.

Automatic next-lesson and review recommendation cards were removed on 26 October 2026. Players choose topics and lessons directly. Review questions provide another topic check, and do not by themselves establish transfer or mastery.

The separate Learn with the cat mode was removed on 26 October 2026, including its activities, entry points and support recommendations. Picture help remains available within puzzles. Loading older saves ignores retired guided-session fields while preserving puzzle progress and rewards.

Review checks accept one submission per lesson per UTC day, use the existing life cost on a mistake, and award no coins or ordinary completion. Save/reopen cannot retry an exposed check for independent credit. An overdue challenge is settled before checking review eligibility. Questions crossing midnight must be reopened.

Run `node scripts/check-curriculum.mjs` for bilingual content, progression, persistence and learning invariants, including compatibility with saves made before the guided mode was removed.

The research and remaining evaluation work are recorded in [the progression study](puzzle-progression-study-2026-10-24.md). Skip-ahead placement and untimed copies of scored challenges remain separate proposals. Educator review, fluent Latvian review and observation with children remain necessary before expanding the pilot or claiming a learning benefit.

## Action-led animation, November 7, 2026

Sharing now uses one tap per object, stopping at the last full round and leaving the remainder in the pool. Place-value exchanges animate ten stable unit tokens between the ones column and a ten rod. The mathematical state updates immediately; animation does not defer checking, reset or continuation. Corrections use the existing modest nod rather than a random success gesture.

The rewards collection and optional result performances were retired on November 8. Brief feedback and instructional object movement remain.

Run `npm run test:action-motion` for object conservation, animation interruption, reduced motion, correction selection, all three cat coats and immediate result dismissal. Run `node scripts/native/check-puzzle-drag.mjs --action-motion --device <simulator-UDID>` for sharing, regrouping, corrections and immediate continuation using isolated in-memory progress.

## Cat plans and simpler lessons, November 8, 2026

The app uses ordinary ten-task paths with a timed final section. Boss story data and original puzzle IDs remain for saved-progress and reward compatibility; they do not create boss screens, gates or result movies. The rewards collection and its home, Settings and topic links are removed. Old collection links return to topics. Cat-care coins and existing timer rewards remain unchanged.

Cat plans adds Prepare a picnic, Make a reading corner and Plan a cat party at each difficulty, with 90 new tasks in English, Latvian and Russian. Each plan uses seven preparation tasks followed by the existing three-task timer choice, with separate worked examples and daily reviews. The result describes the prepared activity rather than unlocking a collectible. Authoring lives in `scripts/puzzles/cat-plans.mjs`; rebuild with `npm run puzzles:build`. Run `node scripts/puzzles/check-cat-plans.mjs` or `npm run test:game` for content, server registrations and removal checks. The forward-only migration `20261108010000_cat_plans.sql` registers the new normal coin amounts and timed runs. It is deployed and all 90 reward entries and nine timer lists are verified; see [deployment evidence](../supabase/deployments/2026-11-08-cat-plans.json).

The GitHub failure at commit `85615ebe` was the localization assertion for the Time topic: abbreviated equations were identical in English and Latvian. The generator now labels elapsed time and finish time in each language while preserving the numbers and answers. The localization assertion remains enabled.

Cat plans is an optional section after the regular subjects, separated by a divider. Each of its nine plans grants one placeable decoration on first completion, alongside normal coins. Stable item mappings live in `constants/cat-plan-rewards.ts`. `grantCatPlanRewards` saves the inventory increment and `catPlanRewardsClaimed` receipt together. Both timer modes qualify; pending or expired timed runs do not. Replays and learning resets preserve the receipt, and loading a previously completed plan grants its missing item once. These free furnishings use the existing pet inventory and cloud-save JSON; no additional database schema or wallet debit is needed. The result previews the item and routes Place in house through `requestRoomDecoration` after sheet dismissal.
