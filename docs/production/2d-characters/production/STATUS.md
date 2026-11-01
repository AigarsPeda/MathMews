# Implemented pilot

1 November 2026. Batches 1 through 4 are implemented for Cat and Boba. Alder and Ada remain expansion proposals.

The selected level is `easy-addition-explore-5-lesson-5-boss`, using its original `picnic-balloon` scene ID. The displayed title is A picnic with Boba / Pikniks ar Bobu. Puzzle IDs, answers, saved checkpoints, reward rules and lives are unchanged.

Active boss exercises now omit the decorative mission panel and mistake portrait. The existing result sheet shows one scene and localized story text after a correct answer. Continue remains available throughout playback. Other boss scenes retain their existing media.

## Outputs

- `characters/cat/` and `characters/boba/`: layered SVG masters, rig metadata, 2048-square SVG/PNG model sheets, six expressions and three clips per character.
- `scenes/picnic-boba-2d/`: scene source, four checkpoints, three composite atlases, timelines and 32 frame PNGs. Character clips add 64 frames, 96 in total.
- `preview.html`: character sheets, 96 px previews, checkpoints and replayable clips.
- `assets/2d/bosses/picnic-boba-2d/`: runtime orange, grey and white variants. Total compressed shipping media is 975,414 bytes, below the provisional 2 MiB budget.
- `constants/boss-scene-2d-assets.ts`: separate generated Metro registrations; the 3D registry stays intact.

Rebuild from the project root with `npm run assets:2d-pilot`. Run `npm run test:2d-pilot`. The single deterministic authoring source is `scripts/2d/build-pilot.mjs`; the animation does not redraw characters independently per frame. Scene endpoints match the checkpoint geometry; the check allows one premultiplied antialias color level of atlas rounding.

## Verification

Passed TypeScript, lint, curriculum generation/checks, puzzle experience, result dismissal and 2D media checks. Media checks cover dimensions, alpha, safe bounds, real motion, shared named parts, first/last scene poses and the shipping budget.

The iOS simulator test `testFlatPicnicPilot` passed with all three coats, wrong-answer retry, three result stages, immediate Continue, replay interruption, duplicate taps, Latvian, saved-phase presentation and background/foreground. It also rendered the real `PlaySession` in a memory-only game context: the question, balance board and first answer were visible without scrolling, and a correct answer opened the picnic result. Long answer lists remain scrollable. No player save was edited by the fixture. Screenshots are in `docs/qa/boss-2d/2026-11-01/`.

The full `test:game` run stopped at an unrelated existing `check-room-depth.mjs` mock failure: `react.memo is not a function`. That check and the room code were not changed. Android, physical-device profiling and a dedicated system Reduce Motion run remain unverified. Reduce Motion uses the existing renderer's destination-still behavior.

## Next task

The original prompts in `../AGENT_PROMPTS.md` document the production batches. Do not rerun Batch 1 over these masters. If expansion is requested, use:

> Read START_HERE.md, asset-plan.json and production/STATUS.md. Add only Alder and Ada using the same palette, source, rig and export conventions as the implemented Cat/Boba pilot. Produce editable masters and model sheets first. Keep the existing pilot and game behavior intact. Stop before new story kits or native integration, and report the exact outputs and checks.

The concept board and planning PDF remain the original 31 October design proposals; the generated masters and this status describe the implemented pilot.
