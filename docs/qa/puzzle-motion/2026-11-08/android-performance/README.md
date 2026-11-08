# Android puzzle animation performance

The progress bar translates fixed-size rounded layers instead of animating percentage width. The puzzle scroll view stays mounted and resets immediately to the top; only task content remounts. Its 280 ms, 28-point arrival starts after layout at 85% opacity, keeping the question readable. Reduce Motion starts content fully visible and undisplaced.

The optimized Android 16/API 36 emulator bar comparison reduced native deadline misses from 39/304 frames to 29/377, or 12.83% to 7.69%. This is about a 40% reduction in the missed-deadline fraction. `comparison.json` retains the summarized measurements and `checks.json` retains the functional checks. These emulator results do not certify physical-device 60 FPS.

The multi-second result-sheet handoff found during this investigation was subsequently isolated to Filament listener cancellation and fixed. See [the handoff fix](../android-handoff/README.md) for the cause, native regression and final measurements.

Temporary A/B fixtures, recordings, raw traces and rejected experiments were removed at the user's request. The retained code and regression tests are the reproducible implementation record.
