# iPhone 15 puzzle layout review

393 × 852 logical points, default iOS text size (`large`). The review renders the production `PlaySession`, including its safe areas, header, help and fixed answer dock, using disposable local progress.

The native fixture selects the longest prompt and densest payload for every puzzle layout variant, in English, Latvian and Russian. Measurements compare the scroll content height with its actual available viewport. A one-point tolerance accommodates native rounding. This is a representative stress review, not a claim that every authored puzzle and every interaction state was rendered.

Run with an isolated iPhone 15 simulator and an installed development build connected to Metro:

```sh
node scripts/native/check-puzzle-drag.mjs --layout --device <SIMULATOR-UDID>
```

The result bundle attaches `iPhone15-layout-measurements.json`. The fixture never persists player progress. For a single-screen visual inspection, temporarily use the fixture route with `?single=<case-index>`.

Additional verification covers fraction-frame touch boundaries, responsive answer cards, completed/edited models, and larger text with scrolling still available. The full initial-screen audit is measured at default text size; accessibility sizes are checked for reachability, not forced into one screen.

## Result

The final audit passed all **379 cases across 76 layout variants and 32 puzzle types**, in three languages. None exceeded the available viewport by more than the one-point rounding allowance. The initial audit had 163 overflowing cases.

- Measurements: [before](before.ndjson), [after](after.json).
- [Full iPhone 15 fraction strip with even frame padding](fraction-strip-frame.png).
- Native layout result: `brainpet-native-drag-04Hugb/result.xcresult` (2026-11-08).

Questions retain the original 24/32-point styling. Compact answer buttons remain at least 52 points high; numeric adjustment controls remain at least 48 points. Large text can expand and scroll.

The native fraction-model suite passed (`brainpet-native-drag-fcPr94/result.xcresult`): strip add/remove/reset, alternate equivalent partitions, first/middle/last inset-aware taps, number-line points, corrections and disabled completed boards in English and Latvian.

A separate native accessibility check passed at iOS `accessibility-large` on the Russian sharing task (`brainpet-native-drag-b3PYcE/result.xcresult`). The full-size text scrolls; all three answers and picture help remain reachable, selecting an answer enables the fixed Check button. Screenshots: [question](large-text-top.png), [answer controls](large-text-controls.png).

Additional production-screen snapshots: [Latvian place value](place-value.png), [Russian budget](budget.png), [Russian geometry](geometry.png).
