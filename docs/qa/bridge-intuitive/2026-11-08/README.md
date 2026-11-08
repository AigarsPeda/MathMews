# Equation and ratio clarity review

Reviewed the production lesson screen on an isolated iPhone 15 simulator, 393 × 852 points, on 8 November 2026. The fixture uses disposable in-memory progress and the real Check, retry and result flow. The small Review case button and gray development gear are test controls.

## What changed

Ratios ask for litres in identical bottles. Column headings explain every quantity, and there is one answer cell above the keypad. Up to six bottles are countable; larger counts use a numeral under the same heading. Feedback and the separate Picture help example use the same units.

Equations explain x, show only the current equation and balance, and use action words. Each action applies to both sides. Division appears only when every term divides without fractions. After x is isolated, the operation buttons are replaced by an explicit instruction to Check answer. Reset restores the original board and clears the action message.

The review removed floating arithmetic history and duplicate answer locations. Native checks then caught a dense bottle array, cramped action labels and a long Russian question. Those were corrected and rechecked.

## Validation

- 36 initial layouts passed: 12 scenarios in English, Latvian and Russian. All content, controls and Picture help fit at the default text size; Check stays in its fixed dock. Each `*-layout.json` contains the measured content and viewport heights.
- Nine ordinary solve flows passed, including a wrong ratio answer, an unfinished equation, correction, one-life costs, reset, zero, negative values, division and the actual result sheet.
- Two 320-point content layouts passed with controls and Check reachable.
- Three larger-text solve flows passed at iOS `accessibility-medium`. The test asserts a native font scale above 1.3. Scrolling remains available; the Check action remains visible. The simulator text setting was restored afterward.
- TypeScript, scoped ESLint, locale validation, catalog tests, curriculum checks and puzzle-experience checks passed. Content checks cover 3,390 puzzles, including unchanged mathematical answers and rewards.
- Independent agent reviews checked the learning model and retry language. A separate screenshot-only reviewer correctly identified the givens, unknown and next action for the basic ratio, 20-bottle ratio, basic equation and subtraction/zero case. This is a heuristic review, not a study with learners.

## Examples

- [Ratio question](en-ratio-easy-initial.png), [entered answer](en-ratio-easy-entered.png), [wrong answer](en-ratio-easy-incorrect.png)
- [Equation question](en-equation-easy-initial.png), [unfinished equation](en-equation-easy-unfinished.png), [ready to check](en-equation-easy-ready.png)
- [Dense equation](ru-equation-dense-initial.png), [multiple division choices](ru-equation-multiple-divide-initial.png), [negative quantity](en-equation-negative-initial.png)
- [Narrow layout](narrow-ru-equation-hard-initial.png), [larger-text ratio](large-en-ratio-dense-ready.png), [larger-text solved equation](large-ru-equation-dense-ready.png)

## Reproduce

Use an isolated simulator with the development build installed and Metro running. Run `node scripts/native/check-puzzle-drag.mjs --bridge-teaching --device <UDID> --test <method>`.

Methods: `testInitialScreens`, `testInteractionsAndNarrow`, `testDenseScreens`, and `testLargeText`. For `testLargeText`, first set that simulator's content size to `accessibility-medium`, then restore its previous setting after the run. The runner creates and removes its temporary route.

This review used the full initial run, a focused Russian-equation rerun after shortening the question, the interaction/narrow run, the dense-case run and the larger-text run. The saved measurements include the corrected states. Screenshots are from those review passes.
