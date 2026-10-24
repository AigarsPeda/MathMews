# Bed access, sleep and exit

Historical QA notes. Demonstration images and recordings were deleted at the user’s request; referenced media below is no longer retained.

Tested in the existing BrainPet Reward Contact QA simulator, UDID `66F7AF87-9A43-4BD2-AEC0-0242E902E215`, with the existing room and object menus. No simulator or test screen was created. Reloaded Metro 8081 builds because Fast Refresh was disabled.

## Navigation

Round pet beds now search every side for an approach, instead of the sofa's restricted front angles. Floor-route, cushion-entry and exit-arc collision checks remain in place. The focused regression exercises all six bed colors with a blocked front, a reachable side, a complete sleep/exit route and a fully obstructed negative case. The previous approach search fails the open-side fixture.

The simulator had Green Bed equipped, rather than the screenshot's Red Bed. Tested it beside the fireplace and temporarily centered on the rug. Both placements completed the approach, held sleep and return-to-spot commands without a blocked-route warning. The six-color automated checks cover Red Bed as well. These native tests validate the current saved room, not an exact reconstruction of the screenshot.

## Visual changes found during testing

The first recording showed an upright tail during sleep. Added a gradual tail fold to the baked `curlUp` and `curlSleep` clips. This exposed tip vertices that were partially weighted to the body because the hook extends forward past the original tail-weight cutoff. Corrected those upper-tail weights, rebuilt orange/grey/white GLBs and updated the editable orange Blender file.

The transition from uncurling into `wakeStretch` now blends for 220 ms. The previous 120 ms blend moved the tail too abruptly. The existing outgoing stretch blend remains 220 ms.

Reviewed the final native recording at four frames per second around contact and exit. The tail lowers with the resting body, remains down during held sleep, and rises during waking. The cat turns on the cushion before leaving, lands on the floor, and walks back to its spot. No visible tail spike or cushion penetration was found in those reviewed frames.

`bed-cycle.mp4` and `bed-cycle.gif` show the final native run at normal speed. The preview joins source intervals 124–139 seconds and 172.5–182 seconds, removing the longer held sleep and command-menu interaction. Source recording: `/tmp/brainpet-bed-native/bed-final.mp4`. The initial recording is `/tmp/brainpet-bed-native/bed-cycle.mp4`. The app returned to the iOS home screen during an earlier setup attempt; the complete final sequence was verified after reopening it.

The temporary bed movement was reversed after testing. Simulator left in normal Living room mode, bed beside the fireplace, and released to the shop chat.

## Validation

- `node scripts/check-room-activities.mjs`: passed, including all six round beds, four rotations, side entry and safe exit.
- `node scripts/check-cat-waking.mjs`: passed on orange/grey/white at 30/60/120 FPS. Added checks for a lowered tail, cushion clearance, matching curl/sleep endpoints, seamless looping and bounded tail motion during waking. The old asset fails the lowered-tail assertion.
- `node scripts/check-cat-tail-contact.mjs`: passed, including chair-rest contacts and pause behavior for all coats and frame rates.
- `node scripts/check-cat-jumps.mjs`: passed for all coats, supported turns, sofa finishes/orientations, interruptions and Reduce Motion.
- `node scripts/check-cat-restarting.mjs`: passed for all coats and frame rates.
- Blender mesh checks from `scripts/3d/review-native-cat.py`: passed for 53 clips with five samples each on the final orange export, including the new sleeping-tail mesh-height check.
- Compared the exported principal body, head, paw and tail animation channels with pre-change GLBs. Only `curlUp` and `curlSleep` changed for all three coats. Tail vertex weights also changed as described above.
- TypeScript, scoped ESLint and diff whitespace checks passed. The complete game suite was not rerun.
