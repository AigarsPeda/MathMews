# Home and Store live profiling, 24 October 2026

Follow-up: [Home stall fixes and live validation](fix-validation/README.md). The measurements below describe the earlier capture.

Next investigation: [room-stage clock stalls and validation](room-stages/README.md).

The targeted rerender reductions are verified in the running iOS simulator. Home still has intermittent JavaScript stalls, including with the profilers disabled. This is not an overall smoothness pass or a before/after frame-rate benchmark.

## Connection and setup

Used the existing **BrainPet Furniture Smoothness QA** simulator, iOS 27.0, app `com.mathmews.app`, and Metro on port 8081. Reloaded the current checkout through React Native DevSettings before recording. Runtime checks confirmed `__DEV__ === true`, a memoized GameHeaderStats export, completed puzzle IDs supplied to both headers, and the Store FlatList receiving catalog revision `extraData`. This is an Expo development binary with React Compiler enabled, not a physical-device Release build.

The debugger disconnect came from an Origin mismatch. React Native accepted `http://localhost:8081`, but Expo's additional origin check expected the exact configured host `127.0.0.1:8081` and terminated the connection. Connecting to the discovered `webSocketDebuggerUrl` with `Origin: http://127.0.0.1:8081` fixed it. No security checks or application code were changed. Hermes accepted `Profiler.start` and `Profiler.stop`; it does not implement `Profiler.enable` in this runtime.

Used the installed React DevTools renderer interfaces to collect commit durations and change descriptions. Temporarily wrapped the loaded `computePetWisdom` module export to count calls; restored it at the end of each capture. Collected two approximately 45-second Hermes CPU samples and longer React/animation-frame samples around them. Captured separate 15-second idle animation-frame samples after both profilers had stopped. All UI actions used the simulator's accessibility controls.

## Verified behavior

| Observation | Live result |
| --- | --- |
| Home, enter and finish decorating without moving anything | 18 Home renders across the 65.22-second React capture; zero wisdom calls, zero GameHeaderStats or HomeAchievementsStat renders |
| Store, open and close three furniture previews | Six preview-state commits; zero FlatList or product-card renders in those commits |
| Store, unrelated game-context update | Store rendered once without rerendering product cards |
| Store, two catalog revision updates | Two FlatList commits, each with `extraData` as the changed prop; six visible cards rendered each time |

The Store preview-state commits occurred at approximately 4.01, 7.28, 13.96, 18.15, 30.20, and 33.30 seconds. Catalog updates were separate commits at 26.47 and 56.37 seconds. The whole Store capture therefore contains 12 card renders, all associated with catalog invalidation. Price-dependent rows were not frozen by memoization.

The Home capture also includes the prefetched Store, so its Store/card totals must not be interpreted as foreground Store interaction counts. CPU and React capture windows differ; compare each only within its stated window.

The earlier regression tests established four wisdom computations per Home render before the change. This live session verifies cached reuse after the change. It does not re-run the old application bundle or measure a physical-device speedup.

## Remaining costs

During the Store capture, the mounted Home screen rendered three times. Its longest inclusive render was **507.97 ms** on a game-context update. The two catalog-triggered Home renders took **330.74 ms** and **293.15 ms**. These commits include work below Home in its room tree; inclusive component durations overlap and must not be added together. Reducing covered-Home updates and avoiding unnecessary catalog invalidations are useful next investigation targets. No room navigation, preloading, or scene behavior was changed here.

The largest named non-root self cost in the CPU samples was the development `createTask` host function: about **3.78 seconds** in Home and **1.87 seconds** in Store across the respective 45-second samples. Garbage collection, React rendering, native-prop diffing, and profiling instrumentation also appear. Development and profiler overhead make these unsuitable for predicting release performance.

### Animation-frame intervals

These measure gaps between JavaScript `requestAnimationFrame` callbacks, not native/GPU FPS or touch latency. Interactive captures include accessibility automation and profiler overhead. Short idle samples may miss periodic work and are not directly comparable to the interactive captures.

| Capture | Duration | Median | p95 | p99 | Longest gap | Gaps >100 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home, interaction + profilers | 65.22 s | 16.67 ms | 16.82 ms | 28.15 ms | 2,252.12 ms | 19 |
| Store, previews + profilers | 56.65 s | 16.67 ms | 17.36 ms | 33.26 ms | 1,187.49 ms | 12 |
| Home idle, profilers off | 15.01 s | 16.67 ms | 16.79 ms | 26.80 ms | 356.36 ms | 3 |
| Store idle, profilers off | 15.01 s | 16.66 ms | 17.47 ms | 17.88 ms | 24.93 ms | 0 |

## Evidence and reproduction

- [Derived summary, component counts, commit changes, and CPU self samples](summary.json).
- Raw React captures: [Home](home-react.json.gz), [Store](store-react.json.gz).
- Hermes CPU profiles: [Home](home.cpuprofile.gz), [Store](store.cpuprofile.gz). Decompress before importing into a CPU profile viewer.
- Raw idle intervals: [Home](home-idle-frames.json), [Store](store-idle-frames.json).
- [React capture setup](start-react-capture.js) and [15-second frame capture setup](start-frame-capture.js), evaluated in the running development runtime through CDP.
- [Profiled source hashes](source-sha256.txt).

Discover the target through `http://localhost:8081/json/list`, connect with the matching Origin above, and enable the Runtime domain. Evaluate the React setup once, perform the interactions, then evaluate `__homeStoreProfile.finish()` with `returnByValue: true` to obtain the capture and restore the wrapper. Start and stop Hermes sampling on the same WebSocket session. For idle sampling, evaluate the frame setup and read `__idleFrames` only once its `done` field is true. The Hermes Runtime in this build did not await the Promise returned by `Runtime.evaluate`, even with `awaitPromise: true`.

All profilers and temporary runtime wrappers were stopped/restored after collection. The simulator was returned to Home in the same Kitchen, decorating off, with the same 42-coin balance. No purchases or furniture edits were made. This profiling task changed only these QA artifacts; application source and concurrent room-navigation changes remain untouched.

Follow-up: [Home game-state room-stage caches and live verification](game-updates/README.md).
