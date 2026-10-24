# Furniture motion independent of React, 24 October 2026

Furniture pointer movement now runs in a Gesture Handler UI worklet. Shared values feed the selected target, Skia outline and Filament model transform without waiting for JavaScript placement checks or a React commit. Filament applies the pointer pose before the other object callbacks, keeping supported children, lights and shadows on the same preview.

Collision/support feedback samples the latest pointer at most once every 80 ms and only publishes React state when diagnostics or shape change. Empty-space panning and cat movement retain frame-rate JavaScript updates. Release always validates the exact final position; saving, snapping, invalid-drop feedback and cancellation remain on the existing placement path. Expensive access checks wait until the furniture is released. Selection prepares the outline before movement.

Repeated drags detach Worklets Core host-object proxies once at capture before passing the previous preview to Reanimated. Live testing caught this native-runtime incompatibility, which plain JavaScript mocks do not reproduce. Final repeated-drag testing produced no new room-picking errors. Raw touch coordinates also retain short movements when the native pan recognizer supplies no useful translation before release.

## Running-app measurements

The existing iOS 27 Furniture Smoothness QA simulator ran an Expo development build with React Compiler, after a full reload. The development-only probe timestamps the UI touch callback and the native `setTransform` call. It is off by default and reports nothing for production gestures.

| Capture | Samples | Median | 95th percentile | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Continuous manual drag: first native response per pointer sequence | 686 | 18 ms | 18 ms | 21 ms |
| Continuous manual drag: all native updates, including later corrections | 691 | 18 ms | 19 ms | 51 ms |
| Five automated short drags: native pointer preview | 5 | 15 ms | — | 15 ms |
| Five automated short drags: validated drop pose | 5 | 98 ms | — | 98 ms |

The continuous pointer interval lasted 12.133 seconds. Repeated transforms for a single input are deduplicated using the earliest application time for the first-response row. The final validated pose in that capture took 51 ms. Short-drag native response ranged from 13–15 ms; validated drop poses ranged from 62–98 ms. Automated drags only exposed the final pointer sample, so the manual capture supplies the sustained-movement evidence.

These measurements start after the touch reaches the UI callback and an item is captured. They exclude hardware input delivery, initial picking delay, GPU completion and display scanout. They establish software responsiveness in this simulator, not physical finger-to-photon latency or a controlled before/after speedup. The first manual attempt was outside the recording window and is excluded; the user repeated it with recording enabled.

React diagnostics still update as the item crosses blockers and room boundaries. The continuous capture contains 48 overlay/control renders; typical visible-stage renders were 10–23 ms. A saved placement still produced a **232 ms React commit across the room stages** (the visible stage took 82 ms). That drop/save bottleneck remains; pointer movement no longer waits for that React work. The earlier automated capture also recorded a 240 ms save commit.

Five automated drags exercised rejection, recapturing an existing preview, successful placement and further rejected movements. The pending test preview was cancelled and the single saved automated move was undone. The user's later manual placements were retained. The app remains in decoration mode without an agent-created pending preview. Measurement flags are off and the temporary React profiler wrappers were restored.

## Regression checks

- 157 backend tests pass, including the real stage with React Compiler on and off: twelve position-only samples cause zero additional stage/control renders, shared pointer movement advances without a JS feedback call, and release/cancel preserve placement validation.
- Gesture adapter checks hold the RN queue while 120 UI samples advance, verify throttled feedback and exact release, and cover delayed picking, release-only drags, returning to the start, taps, stale/cancelled picks, background cleanup, camera pinch cooperation and normal empty-space pan frequency.
- Projection checks use the application's actual projection for floor and both wall planes. Group offsets, unchanged saved geometry, stale sessions, semantic feedback changes and detached nested preview references are covered.
- Typecheck, targeted ESLint, room-editing, room-transition, cat task-chain checks and `git diff --check` pass.

Room navigation was left untouched. The transition hook, camera hook and Home file match the starting commit; navigation/readiness declarations in PetStage match as well. The editor only registers simultaneous recognition with the existing camera gesture to preserve pinch behavior.

## Evidence and reproduction

- [Summary and commit timings](summary.json)
- [Continuous latency samples](latency-continuous.json), [short-drag samples](latency-short-drags.json)
- [Continuous React trace](continuous-react.json.gz), [short-drag React trace](after-react.json.gz)
- [Source hashes](source-sha256.txt)
- [Start latency capture](start-latency-capture.js), [finish latency capture](finish-latency-capture.js), [start React capture](start-react-capture.js)

Using the simulator debugger connection described in the parent QA report, evaluate the start script, drag a selected item, and evaluate the finish script **after** the drag. Pair samples by session and sequence; the raw `move` phase names the native pointer-preview path (including final touch-up coordinates), while `release` names the validated JS drop path. React profiling is optional and adds development overhead. Starting a capture resets the probe; finishing disables every mounted stage's measurement flag.
