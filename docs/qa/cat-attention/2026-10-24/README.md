# Command acknowledgment review

Reviewed the production Home screen in the existing BrainPet Puzzle QA iPhone simulator, using the existing Metro server on port 8081. No simulator, server or temporary game screen was created for this pass.

- `native-acknowledgment.gif`: the toy command menu closes and the cat's brief ear/head response settles. The native menu overlaps the beginning of the gesture, so this capture is not an input-latency measurement.
- `native-departure.gif`: a later excerpt from the same recording shows the cat walking toward the toy. These are separate excerpts, not a continuous timing comparison.
- `metrics.json`: 36 production-actor comparisons, three coats at 30/60/120 FPS across idle, walking, jumping and Reduce Motion. `firstEar` measures seconds after publishing the cue to the drawing state, not physical tap latency. Matrix deltas show the response is present; they are not anatomical angle measurements.

Native frame review found a restrained acknowledgment and a successful departure to the toy. Automated rapid-retap coverage caught a head snap while walking; keeping the slower head blend through the cue's onset and recovery removed that discontinuity. The final captures use that correction.

Passed: command-attention, queued task chains, expression, supported-turn, command-motion, connected-motion and room/native-animation checks; lint and whitespace checks. Whole-project type checking remained blocked by concurrent puzzle changes; the last run reported an incompatible `optionA` payload in `utils/puzzle-practice.ts:8`. No puzzle files were changed by this pass.

Reproduce the focused checks with `node scripts/check-cat-command-attention.mjs` and `node scripts/check-cat-task-chains.mjs`. The command-attention check is also registered in `test:game`.
