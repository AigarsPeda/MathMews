# Room-stage clock stalls, 24 October 2026

PetStage was rerendering every five seconds even when its only clock-derived input, the day period, was unchanged. The visible room and the cat's room each incurred this work. The new `useWorldPeriod` hook retains its reading for unchanged periods and still delivers morning, day, evening, and night transitions to the existing activity scheduler.

Production changes are limited to the new hook and PetStage's clock import/call. The polling interval, room visibility/cat-presence rules, editing pause, activity planning, room transitions, scene mounting, and navigation callbacks remain unchanged. The hook pauses with the app/screen and reads the current period before committing when it resumes or receives a changed clock.

## Simulator findings

Used the existing BrainPet Furniture Smoothness QA simulator, iOS 27, Expo development build with React Compiler, Kitchen scene, and 42 coins. Collected a baseline from the running pre-change code, reloaded the changed code, let startup settle, and captured again. Both foreground captures include one ordinary game-state update. The 30-second CPU windows are shorter than the React captures.

| Measurement | Before, 60.20 seconds | After, 74.16 seconds |
| --- | ---: | ---: |
| PetStage renders | 28 | 4 |
| Clock-only PetStage renders | 24 | **0** |
| PetStage renders from game props | 4 | 4 |
| PetStage inclusive time across all renders | 1,785.60 ms | 245.15 ms |
| Home content renders | 1 | 1 |
| NativeRoomScene renders | 4 | 4 |
| JS frame gaps >100 ms | 13 | 1 |
| JS frame interval p95 | 16.73 ms | 16.71 ms |
| Longest JS frame gap | 428.24 ms | 795.37 ms |

The remaining Home update took 249.05 ms inclusive. Its stage renders came from changed game props, not the period timer. This fix removes the repeated clock-triggered work; it does not eliminate the more expensive real-state update. Inclusive component durations overlap and must not be added across parent and child components.

A separate 15-second Home idle sample with profilers disabled recorded 900 callbacks, a 16.72 ms p95, a 24.96 ms maximum, and zero gaps over 100 ms. This is a short observation, not a release-device FPS benchmark. The larger maximum gap in the longer after capture is retained in the table rather than hidden by the improved count.

In the separate 30-second Hermes samples, development `createTask` self-sampled time fell from about 690 ms to 70 ms. These sampled windows do not include the same care-update phase, and development instrumentation contributes to their costs. Do not interpret this as a production speedup percentage. The initial post-reload CPU recording had an invalid zero start timestamp and was discarded; the saved CPU recordings have valid approximately 30-second durations.

A 74.15-second Store-covered capture recorded **zero HomeContent, PetStage, NativeRoomScene, and NativeRoomSurface renders** across two game-context updates and three catalog refreshes. The small HomeScreen subscriber rendered twice, with a maximum of 1.48 ms. There were no JS frame gaps above 100 ms. Returning Home showed the current clock, updated hunger, the same Kitchen, and 42 coins.

## Regression validation

`npm run test:backend` passes all **137 tests**, including 22 screen/mood/stage cases. The four new cases run with React Compiler on and off and execute the real PetStage and period hook with native views and the activity scheduler replaced by test boundaries. They verify:

- Five unchanged clock polls cause no stage renders. Both assertions fail against the saved original PetStage, which renders five extra times.
- All four day-period boundaries reach the scheduler.
- Covered/background screens and empty hidden rooms stop polling; the cat's room continues while browsing elsewhere.
- Focus, visibility, editing exit, clock presets, speed changes, and removal of the clock produce the current expected period.

Typecheck, targeted ESLint, world-clock checks, room-transition checks, and multi-room cat task-chain checks pass. No navigation tests or expected navigation behavior were changed. Hash verification confirms every file that was already modified at the start of this task still has its original contents.

Two older standalone checks fail in the existing checkout, reproduced against the saved original PetStage:

- `check-room-decoration-motion.mjs:305` expects a rotation callback result that is undefined.
- `check-pet-speech-anchor.mjs` is missing a `roomSupportGroup` test mock.

Only their clock mock imports were updated for the new hook. Their assertions and unrelated fixtures were left unchanged.

## Evidence

- [Summary with component counts, commit changes, frame intervals, and CPU samples](summary.json).
- Raw React captures: [before](before-react.json.gz), [after](after-react.json.gz), [Home covered by Store](covered-react.json.gz).
- Hermes CPU captures: [before](before.cpuprofile.gz), [after](after.cpuprofile.gz).
- [Home idle frame intervals](after-idle-frames.json).
- [React capture setup](start-react-capture.js), [frame capture setup](start-frame-capture.js), and [source hashes](source-sha256.txt).

Use the debugger connection and capture procedure in the [original report](../README.md). No purchases, furniture edits, or room-navigation actions were performed. All profiling wrappers are restored after collection.
