# Home stall fixes: live validation, 24 October 2026

Covered Home updates are eliminated from the expensive content/room tree in this capture. The running app also no longer rebuilds Home for unchanged mood polls or the bedtime routine's five-second clock. Room navigation, transition handlers, scene preloading, and the concurrent native-room changes were left untouched.

## Changes

- A small Home subscriber forwards the latest game state to memoized content while Home is active. Covered updates are deferred until focus returns; loading/onboarding transitions still clear the previous game. Rooms remain mounted.
- The saving-goal hint subscribes to its selected price itself, so catalog refreshes do not invalidate Home and its rooms. Price is an explicit input to the goal formatter, including under React Compiler.
- The mood hook publishes a new reading only when its inputs or derived mood/phase change, stops polling while covered, and catches up before committing on focus. Pure mood calculations remain independent of native/navigation imports.
- The unchanged bedtime routine runs in a small child component. Its clock ticks no longer render the parent room tree. A preliminary live trace identified this second clock after the mood fix: four Home renders in 21.22 seconds, each approximately 380 ms inclusive. The final capture below includes the isolation fix.

## Running-app results

Same iOS 27 simulator, Expo development binary, React Compiler, Kitchen scene, and 42-coin balance as the [earlier profile](../README.md). Reloaded the final source before profiling. Used React DevTools commit data and Hermes CPU sampling via the existing debugger connection. No purchases or furniture changes were made.

| Observation | Before | Final capture |
| --- | --- | --- |
| Home content while covered by Store | Three renders in 56.65 s, 293–508 ms inclusive | **Zero HomeContent, PetStage, NativeRoomScene, or NativeRoomSurface renders in 65.86 s** |
| Game-context updates while shopping | Reached the room tree | Two small HomeScreen wrapper renders, **0.69 ms maximum**, 1.29 ms total |
| Store preview open/close | No product-card rerenders | Six preview commits, still **zero product-card/FlatList renders** in these commits |
| Catalog refreshes while shopping | Also rendered covered Home | Three FlatList refreshes, six cards each; **zero Home content renders** |
| Home routine clock | Rebuilt Home every five seconds | 13 tiny bedtime-child renders, 1.02 ms total; **one Home content render** in 63.77 s, on a game prop update |
| Home idle, profilers disabled | 15 s, maximum JS frame gap 356.36 ms; three gaps >100 ms | 15 s, maximum **94.29 ms**; **zero gaps >100 ms** |

The final Store capture includes context updates at 2.09 and 62.09 seconds; catalog updates at 2.27, 32.25, and 62.85 seconds; and three preview open/close cycles between 4.18 and 21.66 seconds. All 18 card renders belong to catalog commits. Home's focus catch-up was also checked in the simulator: returning displayed the current clock and decayed hunger (24%), the same Kitchen, and the unchanged balance.

The foreground Home capture contains one content render taking 245.08 ms inclusive and 32 PetStage renders driven by work within the retained scene trees. There were zero wisdom computations and zero header renders. The prefetched Store is also present in Home's capture; its counts are not foreground shopping interactions. React's memo wrapper and its inner component share inclusive duration and must not be added together.

## Remaining costs and measurement limits

This is development-mode simulator evidence, not Release-device FPS. The short idle samples are observations, not a controlled before/after benchmark. Scene-local clocks, native updates, and development instrumentation still create work; they were not changed as part of the room-navigation constraint.

With React and CPU profiling enabled, Home's 63.77-second capture still had 19 JS frame gaps over 100 ms (maximum 1,553.97 ms). Store's 65.86-second capture had eight (maximum 1,177.69 ms). Both had a 16.67 ms median. These are JavaScript requestAnimationFrame intervals, not GPU frame times. Removing the Home rerenders does not establish that every stall has been fixed.

The Store CPU sample spans roughly 45 seconds during the React capture and preview interactions. Home's final CPU sample is a separate 45-second foreground idle run after returning from Store, with React profiling disabled. The initial Home CPU recording had an invalid zero start timestamp and a machine-uptime-sized delta; it was discarded and recaptured. Do not treat these CPU windows as a direct timing comparison.

## Regression validation

- `npm run test:backend`: **133 passed**, including **18 screen/mood tests** run with and without React Compiler.
- New coverage verifies covered-state deferral and focus catch-up, the Store decoration handoff, readiness transitions, selected-price refresh without room renders, unchanged mood ticks, hidden timers, night/dawn transitions, dog sleep, stale completion callbacks, and bedtime-clock isolation.
- The six initial performance assertions fail against the saved pre-change Home/mood sources. The two bedtime-isolation assertions fail against the intermediate source: five clock ticks cause 20 extra room renders before the isolation, zero afterward.
- Typecheck and targeted ESLint pass. `check-game-systems.mjs`, `check-world-clock.mjs`, and `check-cat-bedtime.mjs` pass.
- `check-cat-play.mjs` reaches an existing failure at line 262: it expects Shop to preserve decoration mode, while the pre-existing handler clears it. Reproduced with the saved pre-change Home source. Updated only the harness's memo/component support, moved-hook mock, and missing game fixture fields; left its navigation assertions and the application navigation behavior unchanged.

## Evidence

- [Summary and commit change descriptions](summary.json).
- Raw React captures: [Home](home-react.json.gz), [Store](store-react.json.gz).
- Hermes CPU samples: [Home](home.cpuprofile.gz), [Store](store.cpuprofile.gz).
- [Home idle frame intervals](home-idle-frames.json).
- [React capture setup](start-react-capture.js), [frame capture setup](start-frame-capture.js), [profiled source hashes](source-sha256.txt).

Debugger setup and reproduction steps are in the [original report](../README.md). All instrumentation was stopped and temporary runtime wrappers restored after recording. The simulator was left on Home in Kitchen, decorating off, with 42 coins.
