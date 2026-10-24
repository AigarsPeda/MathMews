# Interrupted stops and restarts

Historical QA notes. Demonstration images and recordings were deleted at the user’s request; referenced media below is no longer retained.

Quick idle/walk reversals preserve the displayed crossfade weight, source times and stride phase. First-step timing follows that retained phase. Floor stops carry the actual local contact/launch offsets into a 180 ms recovery; another command captures the current recovery pose. Stationary departures use zero route-entry speed while secondary motion settles.

## Automated validation

`node scripts/check-cat-restarting.mjs` uses the production worklet and shipped GLB skeletons with crossfades enabled. Orange, grey and white pass at 30/60/120 FPS. Cases interrupt full strides and first steps after pauses from one frame to 240 ms, include an angled restart, and check root/pose continuity, bounded frame movement, floor clearance, pause/resume and exact final arrival.

The same check against the pre-change actor snapshot fails at the first interrupted sequence: 0.07957 model units of zero-time displacement at 30 FPS. The updated sequence's maximum is 0.0002833 across all rates; see `metrics.json`. This measures command-boundary continuity, not subjective animation quality.

Focused starting, stopping, turning, landing-to-walk, fluid-motion, command-attention and room-flow checks passed. TypeScript, scoped ESLint and diff whitespace checks passed. The new regression check is included in `test:game`; the entire game suite was not rerun.

## Existing simulator review

Used the already running BrainPet Reward Contact QA simulator (66F7AF87-9A43-4BD2-AEC0-0242E902E215), the existing Home/Decorate/object menus and Metro 8081. Reloaded because Fast Refresh was off. Set daytime for the review. The living-room layout blocked both the shelf approach and room exit; repositioned only the cat with the existing Decorate drag control, then sent it to Bedroom. No simulator or test screen was created and no furniture was moved.

Reviewed native recording frames for a bedroom investigation approach, stop, and subsequent restart. The short preview `native-restart.gif` shows the resumed walk and settling. It is a native integration/visual check, not a native reproduction of the one-frame interruption cases; those use the automated actual-actor checks above. The frames show a continuous first step and head/tail settling without an obvious pose snap. The simulator was left in ordinary room mode and released to the shop chat after recording.

Full setup recording is at `/tmp/brainpet-restarting/native.mp4`; the preview covers 337–344 seconds at 20 FPS. Temporary files are not required for the regression test.
