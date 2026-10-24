# Furniture editing implementation and QA — 24 October 2026

This implements the decorating study’s core interaction and transaction changes for a broad audience, including adults. The design reference is `docs/research/furniture-placement-study-2026-10-24.md`.

## Shipped behavior in this checkout

- Buy responds with a pending message and suppresses repeated taps while the durable purchase is saving. Buying grants ownership without inserting furniture into the saved room. The editor stages a unique instance. Cancel leaves it in storage; a new bed does not replace the saved bed until placement commits.
- A live footprint, symbol, text, boundary markers and named blockers explain whether placement is valid. Invalid drops remain visibly uncommitted. Another drag, tap-to-destination, directional nudges or Cancel can recover. Ordinary valid drags still save on release.
- Snapping uses the same visible candidate at release, with screen-scaled hysteresis. Fine nudges bypass magnets. A board that cannot hold the object’s base produces a surface-fit error instead of silently choosing the floor.
- Replacement lists all affected items before putting them away. It validates the complete move and removal, then commits them together. One Undo restores the prior arrangement.
- In room and Stored tabs provide pictures, available counts, search, retained tab/query/scroll position, group selection and Place another. Repeated placement consumes only owned copies.
- Supported objects save their parent, local position and local heading. Moving or rotating the support carries its contents. The whole set is validated. Resizing preserves the supported objects’ own sizes and checks their fit. Removing the support includes its dependent items in the storage confirmation.
- Optional cat interaction warnings run after the pointer rests. Essential exit checks run at commit; the cat’s saved floor position is repaired to free space. Ordinary collision handling never moves neighboring furniture.
- Gestures retain their captured target. Empty-space drags pan, while interrupted/multitouch object drags cannot commit. Tap-to-destination provides a deliberate Place/Cancel alternative.
- Commit guards check the room, layout version and remaining ownership. Pending purchase placements are recorded for rejection cleanup. Revocation cannot be undone into existence. Restoring a saved layout respects copies already used in another named room.

The three new purchase stages are separately observable: ownership granted locally, ownership durably saved, and placement committed. `utils/decoration-timing.ts` retains up to 30 local timing samples; it sends no telemetry.

## Automated checks

Passed during this implementation:

- TypeScript (`npx tsc --noEmit --pretty false`) and scoped ESLint for changed application files.
- `node --test scripts/backend/test-wallet-client.mjs`: 39 tests, including offline delivery, delayed confirmation, duplicate debit prevention, crash recovery, rejection, Undo protection, and placing a pending purchase in another named room.
- `node scripts/check-room-editing.mjs`: storage counts, staging/cancel, atomic replacement, bed preservation, support translation/rotation/reload, invalid support recovery, asynchronous suggestion cancellation, stale and duplicate commits, rejected drafts, saved-layout budgets, surface fit, essential exits and clustered small-target selection.
- `node scripts/check-room-item-placement.mjs`: existing detailed furniture geometry, surfaces, rugs, walls, snapping, rotation, resizing and save/reload cases.
- `node scripts/check-room-picking.mjs`, `check-room-decoration-controls.mjs`, `check-simple-graphics-layout.mjs`, and `check-store-placement-flow.mjs`.
- `node scripts/check-native-room.mjs`: native rendering, picking, previews, activities, and the updated draft-only suggestion effect. An earlier run caught the retired auto-placement effect’s test assumptions; those tests now exercise the actual staging effect and cancellation.
- `node scripts/check-room-performance.mjs`: crowded-kitchen routing and placement checks, yielding/cancelled search, preview model reuse, cleanup and bounded caches. Desktop observations were 49–84 ms for the tested navigation cases and 141 ms for detailed placement setup/release. These are Node/VM regression checks, not device frame-time results.

## Simulator scenarios

Used the existing **BrainPet Reward Contact QA** iOS 27.0 simulator and the real Expo development build. Fast Refresh remained off; changes were loaded with explicit Reload. The existing crowded living room and real test wallet were used.

1. Opened the owned drawer and staged a stored Blue Shelf. Its available preview and Place/Cancel controls appeared.
2. Dragged the shelf into the sofa/window area. The drop stayed uncommitted, Place was disabled, and the feedback named Sofa and Wide oak window. Neither neighbor moved.
3. Opened replacement. The confirmation named both affected items. Confirmed it, then used one Undo: the original sofa and window returned together and the shelf returned to storage.
4. Bought an additional Blue Ball for six in-game coins. It entered a placement draft. Cancelling preserved ownership and removed only the draft; the room’s original ball remained.
5. Bought a second additional Blue Ball for the refined timing sample. Enabled Tap to move, tapped a different floor destination, and pressed Place. One Undo removed that placed instance while preserving the original ball.
6. Explicitly reloaded the final source with Fast Refresh off. The original room rendered without an error overlay, with the sofa, window, green bed and original ball intact. The Stored drawer still offered Blue Ball and Blue Shelf. This implementation’s two purchase tests spent 12 in-game coins, leaving four; the purchased copies remain owned.

## Timing evidence

The first instrumented Blue Ball sample, before the final persistence/render refinements, recorded:

| Milestone after the Buy handler starts | Time |
| --- | ---: |
| Local ownership grant | 485 ms |
| Durable local save | 1,112 ms |
| Navigation requested | 1,112 ms |
| Draft room effect started | 2,016 ms |
| Native scene painted | 3,514 ms |
| Starting-location suggestion ready | 3,532 ms |

`blue-ball-draft.mp4` preserves real playback speed, trimmed from raw recording time 4.8 seconds. The video and event timestamps measure different milestones: the room transition can expose the default model before the native scene reports its warmed first frame and before the suggestion is ready.

Following this sample, the implementation removed an unnecessary second outbox write for ownership-only grants, retained draft room references across unrelated parent renders, and published the initial preview/validity before the asynchronous suggestion finishes. Durable local storage is still required before navigation; server confirmation continues in the background.

The refined instrumented sample recorded:

| Milestone after the Buy handler starts | Time |
| --- | ---: |
| Local ownership grant | 404 ms |
| Durable local save | 642 ms |
| Navigation requested | 643 ms |
| Draft room effect started | 1,465 ms |
| Native scene painted | 2,086 ms |
| Initial preview callback | 2,506 ms |
| Starting-location suggestion ready | 2,509 ms |

The raw values are in [final-timings.json](final-timings.json). [blue-ball-refined.mp4](blue-ball-refined.mp4) preserves real playback speed and starts at raw recording time 3.8 seconds. The two instrumented runs are diagnostic samples, not a controlled benchmark or a p95 estimate. The proposed 500 ms warm movable-preview budget remains unmet. The scene-painted event is not proof of first accepted input; that milestone needs device profiling. The final pending-message and repeated-tap protection were added after this recording and checked by the store-flow test; final source was then reloaded successfully in the simulator.

## Limits of the evidence

These simulator observations do not establish physical-device p95 latency, sustained drag FPS, accessibility certification, or user comprehension. The study’s proposed participant comparison, larger-text/device matrix and 30-sample warm/cold timing runs remain validation work. The placed-item drawer remains the dependable path for occluded furniture; closely clustered small targets also offer a short picture chooser. The existing cat presentation owns its departure/landing animation; this change ensures a free saved destination and access diagnostics.

## Follow-up: hidden shelf and drag latency

The user's Shelving A screenshot exposed two gaps. Native picking selected the foreground sofa despite the shelf already being selected. Starting suggestions considered physical legality but not whether the result was obscured.

The editor now gives the selected model's projected outline priority, with an eight-point touch margin adjusted for zoom. Touches elsewhere still use native geometry, and tap-to-destination keeps its existing behavior. This also works after choosing an obscured item from the drawer. New-item suggestions prefer candidates with at least two thirds of nine projected sample points unobscured, including occupied wall space. This is a conservative placement-ranking heuristic, not a replacement for collision validation; cramped rooms fall back to the least obscured legal candidate.

A Node CPU profile identified the repeated structural-part loops in `objectSnapCandidates` and `penetration` as the main live-preview cost. Snapping now uses bounded spatial queries at both the object and structural-box levels, evaluates candidate groups only when needed, and tests an already held snap before doing a new search. The separating-axis collision test and snap priorities remain intact.

A 10-object, 24-position benchmark measured approximately 26.0 ms per preview before this change and 0.4–0.8 ms afterward. These are medians of three batch averages on this Mac, not physical-device frame rates or input-to-present latency. The bounded regression is `scripts/check-room-drag-performance.mjs`. Comparing against the pre-change resolver produced identical accepted/rejected results and snapped positions for all 24 positions.

Simulator verification used the existing owned Shelving A, with no purchase. Its suggestion appeared above the sofa. Dragging it down produced an uncommitted outline over the sofa; dragging that outline back up moved the shelf, kept the sofa fixed and saved the valid placement. One Undo returned the shelf to storage. The later occupied-wall scoring refinement was covered by code checks; the direct drag-through-sofa behavior was observed in the simulator.

Passed: TypeScript, scoped ESLint, detailed placement geometry, room editing regressions, native-room checks, gesture picking, crowded-room performance, and the new live-preview benchmark. The regression fixture explicitly verifies that an obscured starting shelf is physically legal before testing the improved suggestion, and executes the actual editor picking callback against a foreground-sofa native pick.
