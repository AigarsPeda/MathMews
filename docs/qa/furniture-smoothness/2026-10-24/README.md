# Crowded-room simulator test, 24 October 2026

Follow-up: [implemented fixes and repeated simulator validation](fix-validation/README.md). The report below preserves the original failure evidence.

Result: **smoothness does not pass yet**. Living-room moves were usable, but the denser kitchen reproduced a long pause while moving a sink counter. The recording shows the preview and in-game clock holding still for about five seconds. A JavaScript animation-frame sample recorded a 5,489 ms gap. The CPU profile identifies substantial synchronous placement work during this part of the run.

## Setup and coverage

Used a separate iPhone 18 Pro / iOS 27 simulator named BrainPet Furniture Smoothness QA, running the Expo development build through Metro. Copied the existing room save without authentication credentials or pending wallet transactions. No purchases were made. Device Hub access was coordinated with the cat-animation chat, which left the UI alone during this run. Another simulator and other host work remained active.

Tested five chair drags in the living room with 16 room objects and four attempted drags in the kitchen with 19. These were short automated gestures, including occupied destinations, recovery, a cross-room move and a small adjustment. This was not a sustained finger-tracking or physical-device benchmark.

The living-room chair could be moved out of a sofa overlap without moving the sofa. Two valid moves committed. Invalid drops stayed uncommitted. Cancel and two Undo actions restored the chair. Kitchen drafts were cancelled; no kitchen move was committed. The isolated simulator was shut down afterward and Device Hub was released to the other chat.

## Problems reproduced

1. **Long kitchen pause.** Moving the selected sink counter toward the center caused a visible stall before its preview changed. In [kitchen-freeze.mp4](kitchen-freeze.mp4), the in-game clock holds at 02:22 and then jumps to 02:28. This clip starts at second 38 of the original recording and preserves playback speed.
2. **The editing dock hides the target.** After dragging the kitchen island toward the foreground, its controls covered most of it. An attempt to grab its visible upper edge selected the sink counter instead. The selected-outline priority does not solve this dock obstruction.
3. **Contradictory validity feedback.** Chair drops displayed green “Ready to place” or “Aligned” while the dock reported that the position may block the cat's way out. The move remained uncommitted. The first case appears in [living-room-drag.mp4](living-room-drag.mp4), which starts at second 7 of the original recording and preserves playback speed.

## Timing and profile

Intervals below are between JavaScript `requestAnimationFrame` callbacks, sampled using `performance.now()`. They include gestures, idle periods and automation inspection. They are not native render FPS or measured touch-to-display latency.

| Sample | Living room | Kitchen |
| --- | ---: | ---: |
| Duration | 57.62 s | 49.58 s |
| Callback intervals | 2,519 | 2,045 |
| Median | 16.67 ms | 16.67 ms |
| 95th percentile | 17.08 ms | 16.99 ms |
| 99th percentile | 385.13 ms | 88.99 ms |
| Longest gap | 952.32 ms | 5,489.10 ms |
| Gaps over 100 ms | 36 | 18 |

The median and 95th percentile hide the intermittent long stalls. Raw samples are in [living-frames.json](living-frames.json) and [kitchen-frames.json](kitchen-frames.json); derived values are in [timings-summary.json](timings-summary.json).

The 44.99-second Hermes [CPU profile](kitchen.cpuprofile) captured 3,644 samples. Inclusive sampled time under `preview` was 4.99 seconds, including 4.54 seconds under `snapObject`. `acceptable` accounted for 3.50 seconds and `movingBoxes` for 2.46 seconds. These are nested totals and must not be added. During profile seconds 41–43, nearly all sampled time was inside `preview` / `snapObject`. This identifies an application bottleneck beyond UI automation overhead.

The relevant path in `utils/room-item-placement.ts` repeatedly validates snap candidates and translates their structural collision boxes. The earlier 24-position desktop benchmark did not cover this expensive crowded-kitchen case. React development rendering and garbage collection also appear in the profile. Development tooling, CPU profiling, recording and concurrent host work can amplify timings, so these numbers do not predict release-build performance on a phone.

## Next validation target

Fix the expensive candidate-validation path using this kitchen arrangement as a regression case, then repeat the same moves. Keep the selected item visible above the dock and make the preview label agree with commit-time access checks. A release build on a physical phone is still needed before claiming consistently smooth dragging. This test changed no application source.
