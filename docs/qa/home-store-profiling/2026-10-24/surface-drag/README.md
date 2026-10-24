# Stable furniture grabs and supporting surfaces

The bed/fireplace bounce came from magnetic collision corrections changing the drag anchor. Tabletop placement had an additional problem: choosing a surface could change the item's projected anchor, and edge crossings could alternate between floor and furniture support.

Each native drag now captures its original pose and resolves placement from the requested screen anchor. Collision feedback can reject a position without pulling the visible item away from the finger. Small surface-placeable objects retain the selected board and height until their base moves beyond a six-point exit margin. That margin prevents edge flicker but never makes an overhanging drop legal. Surface changes preserve the projected grab point. Explicit grid placement remains available on release.

The bed continues to be floor furniture. Dragging it through the fireplace shows an invalid preview; it does not become a tabletop item. Collision, boundary, access and save validation remain in place. Position-only movement still avoids React feedback updates.

Room-navigation code was left untouched. Home and the camera/transition hooks match HEAD. Navigation declarations, readiness handlers, camera setup and activity wiring in PetStage match the snapshot taken before this fix.

## Regression validation

All 166 backend tests pass. Typecheck, targeted ESLint, room picking/editing, room-transition and cat task-chain checks pass. The added cases cover:

- Bed movement through fireplace collision and snapping edges, with zero anchor correction and invalid release rejection.
- Surface entry, motion and exit, including delayed feedback after the native pointer advances.
- Edge retention without accepting overhangs; stable selection among overlapping surfaces.
- Rotated supports and rotated/resized items at multiple zoom levels; carried objects excluded as support candidates.
- Real PetStage drag/release/cancel behavior with React Compiler on and off, including no position-only rerenders on the same surface.

The bed regression also exercises the old magnetic resolver and confirms that the tested path previously corrected the requested anchor.

## Running-app verification

The existing iOS 27 simulator ran the Expo development build with React Compiler after a full reload. An automated drag placed the lava lamp on the fireplace mantel. Its recorded placement samples preserved the requested anchor to floating-point precision. The initial manual capture moved the bed and exposed that the first surface-only fix did not cover the reported fireplace bounce. The final implementation covers large furniture as well.

The recording scripts wrap only the development placement resolver and restore it on finish. They record requested/resolved screen anchors, supporting surfaces and invalid support attempts. The existing native transform probe provides a software latency measurement; it excludes touch hardware, GPU completion and display scanout.

The final manual bed/fireplace drag ran for 11.184 seconds. All 121 placement-feedback samples preserved the requested screen anchor within 0.0000001 points. The largest numerical difference was 2.85e-14 points. This confirms that collision feedback stopped changing the grab anchor.

| Native timing | Samples | Median | 95th percentile | Maximum |
| --- | ---: | ---: | ---: | ---: |
| First transform for each distinct pointer sequence | 573 | 18 ms | 18 ms | 20 ms |
| All transforms, including subsequent corrections | 584 | 18 ms | 19 ms | 51 ms |

The app retained invalid-placement feedback and a disabled Place button after the user's final drop. That attempt was rejected by the exit-access check. No new room-picking errors occurred. The user's manual furniture placements and current editing preview were retained. The lava lamp remains on the mantel from the placement check. Measurement flags are off and the wrapped resolver has been restored.

This verifies the drag anchor correction, not the separate post-drop save/access-check stalls reported in the preceding profiling pass.

## Evidence

- [Final bed/fireplace capture](bed-fireplace-capture.json) and [summary](summary.json)
- [Initial lamp placement and bed diagnostic capture](initial-lamp-and-bed-capture.json)
- [Capture setup](start-capture.js), [capture finish](finish-capture.js), [source hashes](source-sha256.txt)
