# Puzzle clarity review — 8 November 2026

Reviewed the authored question and hint templates across all 3,390 puzzles per language. The changes add pictured givens to 317 older word problems; extend the shared shopping, chart, mat and capacity diagrams; remove instructions that depended on retired story scenes; and teach reusable methods in hints. Worked examples retain different numbers.

- Full catalog/curriculum, puzzle interaction, drag and locale checks pass (10,170 localized puzzles).
- `node scripts/check-puzzle-clarity.mjs` checks 3,180 lesson/example diagrams, pictured story metadata, actual rendered pack quantities, labels and hints that do not give intermediate answers. It runs in the core game suite and `test:puzzles`.
- A structural comparison with the pre-change catalog confirms identical IDs, choices, answers, numeric operands, prices, discounts, grading and learning metadata for all 3,390 definitions.
- TypeScript, targeted ESLint, generated-content reproducibility and the object-art/counting checks pass.
- Native `testPuzzleClarity` passes on iPhone 15: six representative puzzles answered correctly, independent pack-price help, and EN/LV/RU captures including 320-point layouts. Screenshots use the isolated QA route with real production puzzle components and do not change player saves.
- Visual review moved receiving cups/bowls beside the jug to reduce vertical scrolling. Long translated questions remain scrollable.

Native result: `/var/folders/xc/s0pspdrj03d4l87l37mvyg4h0000gn/T/brainpet-native-drag-RCMWJQ/result.xcresult`.

This is a template/catalog audit plus representative native verification, not a screenshot review of every generated puzzle. Other uncommitted UI, artwork and room-care work in the shared workspace is outside this change.
