# Crowded-room fixes and validation

This follows the [initial crowded-room failure](../README.md). The multi-second geometry freeze did not recur. Selected-item visibility and placement feedback passed the repeated scenarios. Brief placement hitches remain; this is not a sustained 60 FPS sign-off.

## Changes

- Snapping no longer searches thousands of mesh contacts for every pointer update. Kitchen cabinets and islands use worktop faces for magnets. Other detailed furniture ranks nearby solid-part pairs, with at most 32 pairs per neighbor and 24 distinct screen-space corrections per search. Deep overlaps stay under the pointer instead of triggering an expensive search for an escape position. Full structural geometry still validates every accepted placement and identifies blocked parts.
- Collision validation and feedback use the existing spatial index. Translating collision templates avoids nested array allocations.
- A fixed, scrollable control dock has its own visible area. The room fits above it while keeping its logical viewport and saved coordinates unchanged. Selection, rejection messages and tool changes do not resize the room. Gesture deltas and pinch focal points account for the fitted scale, including scales below 1.
- The outline, message and Place button share placement status. Geometrically clear positions say “Checking space…” until access has been checked. A blocked cat exit produces “Not placed” and disables Place. A new drag or nudge clears the previous warning. Valid releases still commit automatically.
- Unchanged wallet polls no longer publish a new save state and repaint the preloaded rooms. Changed balances and deliveries still update normally. The stage's ambient clock polling pauses during decorating; the visible clock continues updating independently.

## Automated verification

Passed TypeScript and scoped ESLint. Behavioral checks cover detailed furniture collisions, curved and asymmetric shapes, tabletop support, tight cabinet joins, wall placement, save/reload, cancelled drafts, selected-item capture through the sofa, stale layout checks, and normal/fitted gesture coordinates.

The wallet client suite passes all 40 tests, including a new check that repeated unchanged refreshes preserve the save reference and a changed balance is still applied. Camera checks verify that phone/tablet editing frames fit between the toolbar and dock, and that pinch preserves the point under the fingers in the fitted frame. Existing decoration-controls and simple-graphics checks also pass.

The performance regression now includes sanitized furniture-only fixtures from both rooms, rather than only the previous synthetic scene. It checks each difficult destination at three zoom levels and verifies exact legality for every accepted preview. In the recorded local run, the worst per-position median was 18.08 ms across 30 kitchen cases and 20.22 ms across 15 living-room cases. See [local-benchmarks.json](local-benchmarks.json). These Node/VM timings are regression evidence, not phone frame times.

## Simulator method

Used BrainPet Furniture Smoothness QA, an isolated iPhone 18 Pro / iOS 27 simulator with the existing 19-object kitchen and 16-object living room. The Expo development build was loaded from Metro. Device Hub access was coordinated with the cat-animation chat. No purchases were made. Cancel and Undo restore the test furniture, verified against the original furniture arrays in the local save.

Early reruns caught a second expensive case in the chair at the fitted editing zoom, after the sink-specific improvement. That led to the bounded contact search and the living-room regression fixture. The final simulator results are recorded below.

The recordings preserve playback speed. JavaScript callback intervals include UI automation and inspection overhead; they are neither native render FPS nor touch-to-display latency. Development tooling, recording and other host work affect timings. Physical-device release-build testing remains necessary before claiming sustained 60 FPS.

## Development-build rerun

Repeated five living-room chair drags and five kitchen island/sink drags after bounding the generic magnet search. Selected furniture remained above the dock, including the foreground island. The chair could be re-grabbed through a sofa overlap and returned without moving the sofa. Cat-exit failures showed orange “Not placed,” a matching warning, and a disabled Place button. Wall and furniture collisions identified the blocked edge/parts. Valid recovery committed; Cancel and Undo restored both rooms’ furniture arrays and bed settings exactly.

| JavaScript callback interval | Living room | Kitchen |
| --- | ---: | ---: |
| Duration | 38.44 s | 41.31 s |
| Median | 16.67 ms | 16.67 ms |
| 95th percentile | 17.20 ms | 16.83 ms |
| 99th percentile | 54.04 ms | 55.98 ms |
| Longest gap | 990.09 ms | 1,167.16 ms |
| Gaps over 100 ms | 14 | 15 |
| Gaps over 500 ms | 2 | 2 |

See [development-timings.json](development-timings.json) and the raw [living-room](living-development-frames.json) / [kitchen](kitchen-development-frames.json) samples. The kitchen capture also ran the Hermes CPU profiler. The original five-second geometry stall did not recur, but this development-build result is **not a clean smoothness pass**. The new profile’s largest non-idle costs were React development task creation, component-render instrumentation, and garbage collection. A separate production-JavaScript comparison follows below.

## Production-JavaScript comparison

Ran a separate Metro server with `--no-dev --minify`, verified `__DEV__ === false`, and explicitly kept `EXPO_PUBLIC_APP_ENVIRONMENT=sandbox`. Cleared Metro’s transform cache so the comparison used the sandbox save and backend. This uses the same installed native development binary, **not a native Release build**. Fast Refresh was off, the other simulator was shut down, and no CPU profiler ran during these captures. Repeated five drags per room.

| JavaScript callback interval | Living room | Kitchen |
| --- | ---: | ---: |
| Duration | 31.75 s | 39.75 s |
| Median | 16.67 ms | 16.67 ms |
| 95th percentile | 16.76 ms | 16.76 ms |
| 99th percentile | 21.80 ms | 21.85 ms |
| Longest gap | 404.23 ms | 361.29 ms |
| Gaps over 100 ms | 6 | 9 |
| Gaps over 500 ms | 0 | 0 |

The short moves were substantially more responsive than the initial crowded-kitchen failure, and the old multi-second hold did not recur. The recordings and callback samples still show a brief hitch around valid placement/commit. These results do not support a claim that every drag and release is perfectly smooth.

- [Kitchen recording](kitchen-production-js.mp4): island moved to the foreground boundary, recovered into the room, then sink moved through the island and against the wall. The selected island remains fully above the dock.
- [Living-room recording](living-production-js.mp4): chair moved into the center, through the sofa/window, recovered, then adjusted across the rug. Cat-exit rejection stays orange and Place stays disabled; the sofa never needs to move.
- [Derived timings](production-js-timings.json), [living-room samples](living-production-js-frames.json), and [kitchen samples](kitchen-production-js-frames.json).
- [Layout restoration checks](layout-restoration.json): furniture, beds, transforms and layer order match the original fixture in both rooms after Cancel/Undo.

## Remaining validation limits

The bounded dock is a native scroll view. Its measured content height grows beyond its viewport with long warnings, without moving or covering the room. Automated swipes did not scroll it; the same generated swipe and wheel actions also failed in the existing native item chooser. That comparison is inconclusive for physical-touch scrolling. Speculative gesture-handler/responder changes and temporary instrumentation were removed. Scrolling the lower tools needs a real-touch check.

These were short automated gestures, not continuous physical-finger tracking. The next performance acceptance check is the same two rooms in a native Release build on a phone, including repeated valid commits, sustained drags, pinch zoom, and dock scrolling. Keep the short commit hitch visible in that assessment rather than treating median callback time as a smoothness pass.

The dedicated simulator and extra Metro server were stopped after validation, and Device Hub was released to the cat-animation chat. TypeScript, scoped ESLint, geometry/placement, camera, picking, editing, decoration-controls, native-room, simple-graphics and wallet-client checks passed; `git diff --check` is clean.
