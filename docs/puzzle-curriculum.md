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

Basket sorting and pattern repair use native drag and drop. Tiles follow the finger, the current destination gets a teal outline, and releases outside a destination preserve the previous placement. Sorted tiles live inside their baskets and can be dragged between baskets or back to the tile bank. Moving between filled pattern gaps swaps the tiles; a tile from the bank replaces the old tile, which returns to the bank. The surrounding puzzle scroll view pauses during a tile gesture and unlocks after release or cancellation. VoiceOver and TalkBack users can choose destinations through each tile's accessibility actions.

Both special kinds become available after the practice in their lesson. Bosses are required for the lesson and topic completion marks; challenges are optional. Neither kind blocks another topic or the next lesson. Help remains free and retries are unlimited. Rewards use ordinary difficulty rates for each completed puzzle or boss stage. There is no additional client-only mission bonus.

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

`test:puzzles` also runs the native drag gesture callbacks in an isolated offline harness. It checks translated board coordinates, hover targets, valid releases, outside drops, cancellation, missing measurements, scroll unlocking, solved-board disabling and screen-reader actions. The curriculum tests separately check tile replacement, swapping and return to the bank. These checks do not substitute for testing touch input on a native device.

To run real iOS touch tests, start Metro and connect an installed development build, then run `npm run test:puzzles:ios -- --device <simulator-UDID>`. Use `xcrun simctl list devices booted` to find the exact identifier; the runner deliberately requires it instead of selecting an ambiguous device name. This requires Xcode and CocoaPods' Ruby `xcodeproj` gem. The runner creates a temporary development route with the production challenge components, uses XCUITest to drag tiles, and removes that route afterward. It does not submit puzzle progress or award coins, and it scopes English selectors to the test screen without changing the saved language. The log and `.xcresult` bundle, including screenshots, are saved in the temporary directory printed by the command.

Native verification on 2026-10-19 passed both basket and pattern scenarios on an iPhone 18 Pro simulator running iOS 27. Tests cover basket-to-basket transfers, return to the bank, outside releases, correct answer checks, dragging after scrolling, filled-gap swaps in both directions, replacement from the bank, and clearing a gap. The native run exposed a measurement race where queued shared-value writes discarded sibling drop targets. Drop measurements now accumulate on the JS thread before publishing the full list to the UI thread, and the offline harness reproduces that race. Evidence: [basket transfer](qa/native-puzzle-drag/2026-10-19/basket-transfer.png), [pattern swap](qa/native-puzzle-drag/2026-10-19/pattern-swap.png), [dragging after scrolling](qa/native-puzzle-drag/2026-10-19/after-scroll.png).

Navigation between Home, topics, lessons and puzzles reads the local curriculum. Browsing these screens no longer records a pet interaction: that previously updated the game provider, rerendered its consumers, and scheduled save persistence on every menu tap. Puzzle answers, picture help and pet care retain their interaction updates. Home prepares the puzzle menu and shop during idle time. The iOS stack uses `simple_push` with a 220 ms transition; `slide_from_right` resolves to the default iOS transition, which ignores a custom duration.

The native navigation check on 2026-10-19 completed three rounds through Home → topics → Numbers and order → first lesson → first puzzle, then back through the hierarchy, without submitting answers. The 24-action automation median fell from 2.33 s to 0.74 s. These measurements include XCTest tap and accessibility work, and are not release-device paint times. The first open after hot reload remained variable, including a slower first sample after the change. Raw samples and limitations are in [navigation timings](qa/navigation/2026-10-19/timings.json); [before](qa/navigation/2026-10-19/before-test-result.json) and [after](qa/navigation/2026-10-19/after-test-result.json) test results and the [native test source](qa/navigation/2026-10-19/NativeDragTests.swift) are retained alongside them. To reproduce, copy that Swift source to a temporary directory, generate its standalone project with `ruby scripts/native/puzzle-drag/create-project.rb <directory>`, and run the `NativeDragTests` scheme with an explicit simulator ID. The timing scenario uses an English test save whose first Numbers lesson is still in progress.

## Server reward registration

The additive [curriculum migration](../supabase/migrations/20261019095912_learning_curriculum.sql) registers the original 165 replacement puzzle IDs. The [topic finale migration](../supabase/migrations/20261019102550_puzzle_catalog.sql) adds the 36 new boss stages with their difficulty's first-clear and replay rewards. Both retain historical catalog entries and wallet records. Apply pending migrations through the normal Supabase migration process before relying on live coin rewards for the new catalog.

Both migrations were applied to the MathMews hosted project on 19 October 2026. All 201 puzzle registrations matched the app rates. Transactional hosted checks verified first clears, replays and duplicate attempts for all 54 boss stages in both environments, then rolled back every test fixture. See [deployment evidence](../supabase/deployments/2026-10-19-puzzle-rewards.json) and the reusable [acceptance query](../supabase/tests/puzzle-rewards.sql).

The [optional challenge migration](../supabase/migrations/20261019104853_puzzle_catalog.sql) was also applied on 19 October 2026. It registers the eight added activities, bringing the curriculum to 209 reward IDs. Hosted rollback checks verified all eleven challenge rewards in both environments, including first clears, replays and duplicate attempts. See [challenge deployment evidence](../supabase/deployments/2026-10-19-challenge-rewards.json) and the [challenge acceptance query](../supabase/tests/challenge-rewards.sql).

For subsequent additions, run `node scripts/backend/generate-wallet-catalog.mjs` to produce a forward-only migration for new IDs. Its number-line registrations now use the authored difficulty instead of forcing Hard rewards. Apply the new migration through the same deployment process.

On 19 October 2026, local curriculum, game-system, type, interaction and wallet/store checks passed. Native inspection confirmed the topic and lesson screens. Live database registration requires an authenticated deployment session; the CLI in this workspace was not authenticated during implementation.
