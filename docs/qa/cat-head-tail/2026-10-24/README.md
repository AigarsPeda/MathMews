# Head and tail follow-through, 24 October 2026

The head now retains a small delayed response to the rendered chest pitch, yaw and roll. The tail base follows hip rotation and back flex, then passes a slower response to the distal joints. These offsets use the torso's current pose and frame-time damping. They settle when walking stops, persist across room transfers and pause with the actor. The existing gaze, command acknowledgment, jump expressions and tail collision correction still run.

The first tuning was too quiet, so the final response is stronger. In the 60 FPS walking check the added head rotation peaks at about 2 degrees. Paw trajectories are unchanged by the head and tail additions. Crawling, bed and bathroom poses exclude the new response, and Reduce Motion suppresses it.

[Before and after](comparison.gif) shows Blender renders of the actual native actor matrices using the same model and route. The left side is the preceding shoulder/back implementation; the right side adds head and tail follow-through. The camera follows the root and heading, and playback is approximately real time.

[Native simulator recording](native-walking.gif) shows 12 seconds of daytime walking, turning and settling in the existing BrainPet Puzzle QA simulator (iPhone 18 Pro, iOS 27, UDID `85A0697F-2C5B-43EC-91BC-77CC3DBCE9D5`). It is a room crop of the screen recording, sampled at 12 FPS and played at real time. Reviewed the walking and turn frames for head continuity, tail shape and planted paws. The new head response remains small at normal room scale; the comparison render makes it easier to inspect.

The initial nighttime attempt encountered a stalled bed routine and rejected floor commands. Reloading the existing app after game morning restored floor walking. That routing issue was not changed by this animation work; the saved clip is from the subsequent daytime test.

## Checks

The expanded `check-cat-spine.mjs` checks restrained head rotation, nonzero tail-tip response, delayed tip motion, bounded changes between frames, settled rest, paw retention, pause/resume, crawling and Reduce Motion across all three coats at 30/60/120 FPS. [Metrics](metrics.json) compare the complete torso overlay against disabled torso offsets.

The focused fluid-motion, tail-contact, command-attention, room-flow, turning, landing-to-walk and exploration checks passed. TypeScript, ESLint and whitespace checks passed. This change uses the existing GLBs and does not rebuild the assets.
