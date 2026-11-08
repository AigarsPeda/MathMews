# Android puzzle animation performance

The retained changes reduce progress-fill layout work and keep the scroll container mounted between puzzles. Puzzle content enters after its first layout, starting at 85% opacity so it remains readable while native drawing catches up. Its 28-point arrival takes 280 ms. The progress fill keeps its rounded caps, inset highlight and 420 ms cubic deceleration. Both respect Reduce Motion.

The fill now translates two fixed-size materials within clipped windows instead of animating percentage width. Saved progress renders correctly before the first measured layout. Rapid updates continue from the current animated value. Puzzle changes reset the existing scroll view to the top without scrolling animation, key only the task content, and preserve the header and answer dock.

## Method

Optimized release APK, Hermes, Android 16/API 36 arm64 emulator at 1080 × 2424, host GPU on an Apple M1 Max. All three Android animation scales were 1 for performance runs. No Metro, development overlays, screen recording or accessibility polling during active animation windows. A disposable AVD and an in-memory replay fixture kept player data unchanged.

The same APK contains the previous progress/play implementation and the revised one. Bar batches alternate before/after/after/before. Each batch has seven 10% increments, with the first excluded from UI frame samples as warm-up. `gfxinfo` totals include that first increment in both variants. Production play runs solve the same first four puzzles using the real shared Check and native result sheet. Final runs use after/before order; earlier full runs also use reversed order. Warmed shaders, host scheduling and native surface teardown make single maximum values noisy.

`gfxinfo` captures whole answer/sheet windows and native deadline misses. Reanimated frame samples capture only the arrival/bar intervals after tracing starts; they can miss an initial blocked frame. These measures are different. Idle or variable-frame-rate screen recordings are used for visual review only, never to claim FPS.

## Findings and limits

Progress-bar deadline misses consistently decreased across the retained implementation's repeated runs. The full layout-ready comparison was 39/305 frames before, 28/377 after, or 12.79% versus 7.43%. The final rerun was 39/304 versus 29/377, or 12.83% versus 7.69%, about 40% fewer deadline misses as a fraction of rendered frames. Both variants' sampled UI callbacks were near 16.67 ms in that run. See `layout-ready-comparison.json`; `comparison.json` records the final rerun.

The occasional long transition hitch is not resolved. Across repeated experiments, a roughly 383 ms UI callback gap still occurred. Native frame timestamps place long waits in buffer submission/presentation, with layout itself around 0.05–0.5 ms. Depending on the run, waiting appears before command submission or in `SwapBuffers`/GPU completion. This supports a native rendering/surface handoff bottleneck, but does not identify a proven driver or library defect. Whole-window deadline misses remain substantial in this emulator. The revised task entrance improves readable first paint and reduces remount work; these results do not establish a consistent reduction in the longest transition stall.

Two experiments were reverted:

- Static clock/shape/cuboid SVG images instead of Skia preserved appearance but did not consistently improve pacing. `vector-final/` contains the negative comparison.
- Pausing the result's Filament renderer before closing its native sheet did not consistently remove the hitch. `portrait-pause-final/` contains that comparison and the reverted patch. No portrait lifecycle changes are retained.

The final visual review also found a variable delay after the result sheet moves offscreen and before its completion callback advances the task. A raw-ADB-tap capture with seven seconds of no accessibility polling still shows that delay. It is recorded as an unresolved native sheet-handoff limitation, not an arrival-animation duration. Consequently the play-run accessibility polls, which resume after a 1.4-second quiet window, may overlap a late handoff. Treat whole-flow frame statistics as emulator diagnostics, not isolated animation benchmarks. The bar measurements do not have this modal handoff.

No physical Android device was connected. These measurements do not certify physical-device 60 FPS. The previous Screens and Reanimated crash/settled-prop backports remain in place, documented separately in `../android-fix/`.

## Evidence

- `final/`: final native bar/play comparisons, native frame stats, first-paint screenshots and crash buffer.
- `captures/`: final normal/reduced-motion bar and task arrival captures, pixel analysis and settings.
- `build.json`: exact tested source/APK hashes and emulator configuration. The measured APK is QA-only and was removed from the standard release output. A separate clean production release was built after fixture removal.
- `reproduction/`: temporary fixture and baseline sources archived as text, plus local automation and summarizers. The production app contains no QA route.
- Root, `candidate-1/` and `quiet-control/`: earlier retained-code trials. `vector-final/` and `portrait-pause-final/` are rejected experiments, not the final app.

Functional checks cover cumulative fill surviving idle and typing, header/dock bounds, painted clock/shape artwork, empty answer state, scroll reset and repeated native sheet dismissal. Unit checks cover interrupted fill updates, resize, first-layout progress, one arrival per puzzle and Reduce Motion. The final check record lists command outcomes.
