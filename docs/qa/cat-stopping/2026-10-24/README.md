# Walking to rest, 24 October 2026

The torso releases more gradually after the final stride. The head keeps following the decaying chest movement, and the tail tip keeps following its base instead of both being sent directly to neutral. The travel tail wave settles progressively more slowly toward the tip. Idle head tilts and tail flicks fade in, preventing an idle gesture already in progress from appearing on the first stopped frame.

[Simulator recording](native-stopping.gif) is a six-second room crop from the existing BrainPet Puzzle QA simulator, iPhone 18 Pro on iOS 27. It plays at real time, sampled at 20 FPS. The cat walks toward the front of the bedroom, stops, settles and starts moving again. Reviewed the arrival frames for head continuity, tail follow-through and a stationary standing pose.

The new `scripts/check-cat-stopping.mjs` exercises normal arrival and interruptions at three stride phases across orange, grey and white coats at 30, 60 and 120 FPS. It checks bounded head/tail movement, unchanged root position during settling, convergence within three seconds, and pause/resume. A stop during an active idle tail flick reproduces a pose discontinuity in the preceding implementation and passes with the new blend.

The spine, fluid-motion, command-attention and tail-contact checks also passed, along with TypeScript, ESLint and whitespace checks. [Stopping metrics](metrics.json) report the maximum follower angular speed and head/tail displacement between frames, plus residual tail motion a quarter-second after stopping. The existing models and navigation paths are unchanged by this pass.
