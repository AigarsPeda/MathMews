# Shop purchase latency, 24 October 2026

The updated app still takes roughly 2.2–2.6 seconds to show a purchased item in the room in this simulator. Removing the wallet confirmation wait did not eliminate the visible pause.

## Setup and method

Used the existing BrainPet Reward Contact QA simulator, iOS 27.0, with the Expo development build and Metro serving this checkout on port 8081. The existing living room has numerous decorations and native 3D rendering enabled. No test fixture or mocked wallet was used.

The developer menu showed Fast Refresh disabled. Explicitly pressed Reload before the Blue Shelf and Green Bed samples. The first Striped runner recording predates that reload and is excluded from the updated-build results. It is not a controlled before/after benchmark.

Recorded the native simulator display with `simctl io recordVideo` while activating the real Buy controls through accessibility. Read presentation timestamps using AVFoundation and visually inspected the frames. Simulator recording has variable frame intervals, so results are rounded estimates, not millisecond-precise instrumentation. One sample per item is not enough to estimate percentiles or physical-device release performance.

## Updated-build observations

| Purchase | Flow | Time until item visible in room |
| --- | --- | --- |
| Green Bed, 6 coins | Buy directly on shop card | About 2.2 seconds |
| Blue Shelf, 6 coins | Buy from room preview sheet | About 2.5 seconds, approximately 2.4–2.6 |

Green Bed raw recording timestamps: button pressed appearance at 9.883 s; coin count and ownership updated by 10.562 s; room transition starts at 12.092 s; green bed visible around 12.111 s; shop fully offscreen by 12.183 s. The bed is partially occluded by the Blue Shelf, but its green ring and selected-item controls are visible. This leaves about 1.5 seconds between the locally reflected purchase and the room transition.

Blue Shelf raw timestamps: preview still open at 6.258 s; purchase dismissal visible at 6.410 s; coin count and ownership updated by 6.823 s; room begins appearing at 8.785 s; shelf visible at 8.802 s. Its preview Buy button has no pressed visual style, so tap timing is less exact than the bed sample. The shelf was already loaded in the preview before purchasing. A brief white sheet is visible during dismissal.

Both purchases selected the new item in decorating mode. Each reduced the balance by the expected six coins. The waiting-to-sync notice was still visible in the shop near navigation, consistent with confirmation happening independently. Most visible delay occurs before the room transition; these videos do not identify which local save, render, or navigation work causes it. CPU and persistence timing are the next useful measurements.

## Recordings

Clips preserve playback speed and are compressed to 720p. Their start offsets relative to the raw timestamps above are:

- `green-bed-updated.mp4`: 9.5 seconds.
- `blue-shelf-updated.mp4`: 5.8 seconds.
- `striped-runner-before-reload.mp4`: 4.8 seconds. Approximately 4.6–4.7 seconds from pressed appearance to room display, excluded from updated-build results.

Original recordings are retained locally in `/tmp/brainpet-purchase-latency-originals/`.

The test spent 20 existing in-game coins total, including the 8-coin pre-reload runner. Striped runner and Blue Shelf remain placed, and Green Bed replaced the equipped Red Bed. The simulator was left on Home with decorating finished, with Metro and the simulator still running. No application source changes were made during this measurement.
