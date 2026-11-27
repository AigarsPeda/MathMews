# Math Mews puzzle style guide

The bar is Duolingo Math. A seven-year-old looks at the screen and knows, without reading, what the numbers are, what to do and why the answer is right. Every puzzle family follows this guide in Play, Picture help and the checked explanation.

Status (2026-11-27): all 16 families pass at 96 or higher on both review lenses, Learning & Simplicity and Visual, Brand & Motion. The history is in `docs/puzzle-redesign-handover.md`. When this guide and older notes disagree, this guide wins. When this guide and the owner disagree, the owner wins: record the ruling here.

---

## 1. Owner rules

These come from the owner's reviews of real screens. Each one fixed a screen the owner rejected. They are not open to trade-offs.

| # | Rule | What it replaced |
|---|---|---|
| 1 | **One model, at most one short caption, one equation**, plus the answer row. | Two strips, a detail row, a group counter and a caption on one equivalent-fractions proof ("complicated and unfriendly"). |
| 2 | **No outlines, borders or thin lines.** Pieces are plain rounded fills. | Borders around grids, tapes, tables and strips; thin guide lines and dark seams in bar charts. |
| 3 | **Bright fills, never darkened.** Teal `#4FB5CC`, violet `#9C7BD4`, amber `#F5B651`. | Fills darkened for contrast ("the cat had a nicer color before"). |
| 4 | **Big numbers.** Digits on pieces are at least 24 pt, and 28 pt on primary tiles. Labels are at least 18 pt. | 22 pt digits in large route cells. |
| 5 | **The model fills the width and is centred**, on its own painted bounds, within 4 pt. | Small models in a mostly empty stage; reference strips pushed to one side. |
| 6 | **Labels go inside their piece, or in a lane reserved in every state.** Use one label grammar per row. Never float a label at a model's end. | A "516" chip floating above a tape end; "Keep 20" printed bare beside chipped goods. |
| 7 | **A miss is the same model with ONE amber difference.** | Extra apple cards, tiles and a −€2 block on a money miss ("too much and too complicated"). |
| 8 | **The keypad and choices are docked** above Check. They never scroll and never cover the model. | A keypad the child had to scroll to. |
| 9 | **Affordances only on things that move.** Lips, lift, idle hints and shadows go only on pieces the child can tap or drag. | An idle hint over a static bow on a raised card. |
| 10 | **Even and aligned.** Gaps between parts are 4 pt. Groups in a row are equal in height, on one baseline. Number tiles keep at least 12 pt clear on each side. | Bottle groups of different heights; a "198" tile with its digits touching the edges. |

Smaller rulings that follow from these:
- Round pieces get a **crescent lip**: a darker disc offset downward, never a flat band across a circle.
- **A band is exactly as wide as what it measures.** A total, sale or kept band spans its segments and nothing more.
- **No loose operator signs** between stacked tiles.
- **A path never strikes through a number.** A walked route becomes solid cells joined by wide bridges.
- **Small differences have a floor.** An amber difference segment is at least 56 pt wide, never a sliver, with its amount inside (§7).

---

## 2. The settled screen

At settle, a child can point to:
1. **one model**, the same one they worked on, transformed in place;
2. **at most one short caption** (replace it when the next step lands, never stack captions);
3. **one equation** in the equation slot;
4. **their submitted answer** with its ✓ or ✗.

There is no second strip, detail lane, counter, legend or lingering step text. A model with clear labels can drop the caption. When in doubt, cut.

**Worked example (equivalent fractions).** Shade three fifths of one bar. Split each fifth into four parts while the bar's width and shaded area stay fixed. Finish with `3/5 = 12/20`. The rejected version made the child compare two bars, read "5 groups of 4 · 1", inspect four more tiles and follow a numbered selector. [Owner's example](assets/user-10-equivalent-too-complex.png)

**Givens are in the picture.** A child who can't read the prompt can still see the quantities, the goal and the unknown. The "?" sits on the thing being asked, for example one apple's price tag.

**No answers before Check.** Show no running totals, net prices or subtotals.

---

## 3. Colour (`constants/puzzle-theme.ts`)

Never write a hex value in a puzzle component. Use `Ink`, `Quantity`, `Shape`, `PuzzleColors` and `ProofMotion`.

| Role | Token | Values | Use |
|---|---|---|---|
| Paper | `PuzzleColors.background` | `#FFFFFF` | Canvas; the white gaps between parts |
| Ink | `Ink.text` | `#24314B` | Numbers, symbols, labels |
| Soft ink | `Ink.soft` | `#526176` | Secondary labels, axis numbers |
| Empty face | `Shape.empty` / `Shape.emptyLip` | `#DDE3EC` / `#C5CEDA` | Unshaded parts, empty cells, rails beyond a limit |
| Teal | `Quantity.teal` | fill `#4FB5CC`, edge `#2B7F93`, soft `#E3F4F7`, light `#A8DCE8` | The given or first quantity; most models |
| Violet | `Quantity.violet` | fill `#9C7BD4`, edge `#6A4A9C`, soft `#F0EAF8`, light `#C9B6EC` | The second quantity, the child's built part, reference bands, hops |
| Amber | `Quantity.amber` | fill `#F5B651`, edge `#9A6517`, soft `#FFF3DC`, light `#FAD9A0` | The asked-for thing, and **the one miss difference** |
| Action | `PuzzleColors.primary` (berry) | `#C32468` on `#FFF0F6` | Buttons, the current selection, the active slot. Never a data colour. |
| Correct | `PuzzleColors.success` | `#267324` on `#EEFBDE` | Only after Check, always with ✓ |
| Mistake | `PuzzleColors.incorrect` | `#C82E39` on `#FFF0F0` | Only after Check, always with ✗ |

Rules:
- **Keep fills bright.** Definition comes from white gaps and the darker lip, never from darker fills. This overrides the earlier fill-contrast rule.
- **Each hue keeps its meaning** through the task and its proof. A quantity does not change colour when it moves.
- **A miss is amber.** Use `amber.fill` for a single piece and `amber.light` for a soft zone covering several pieces. Don't use amber for anything else in a miss frame.
- **Never name a colour in copy** ("the blue part"); say "the shaded part" or label it. Hue is never the only cue: pair it with a label, position or mark.
- **Text contrast** is at least 4.5:1. Labels sit in navy on paper, on a soft tint or on a fill whose `onFill` passes.

---

## 4. Pieces, shape and space

**A piece** is a rounded fill with zero stroke and a 3 pt darker lower lip (`Shape.lip`) inside its bounds. The lip uses the hue's `edge`, or `emptyLip` for empty parts.

**Round pieces** (dots, tokens, coins, pie wholes) get a crescent lip: a darker disc offset down by about 3 pt behind the face.

**Spacing** (`Shape.space`):
- 4 pt white gaps between adjacent parts of a whole;
- 4 pt between loose pieces;
- 8 pt between groups.

Stacked bar segments are separated by 4 pt white gaps, and only the bottom of the stack carries the lip.

**No lines.** There are no outlines, hairline frames, rules, decorative ticks, seams or bordered cells.
- **Guide or reference lines** become soft rounded bands at least 10 pt thick (14 pt in charts), or are removed.
- **Number-line rails** are solid 12 pt bands, and limit rails 20 pt.
- **Hops** are bands at least 8 pt thick.
- **Areas** are separated by soft tinted zones (`soft` tints, `Ink.tray`), not lines.

**Radii:**

| Token | Rule |
|---|---|
| `Shape.tile(s)` | 18% of the short side, 3–8 pt |
| `Shape.barTop(w,h)` | 16% of bar width, up to 4 pt and at most a quarter of the height; square foot at zero |
| `Shape.stripEnd(h)` | 30% of thickness, up to 6 pt; interior cuts stay square |
| `Shape.tray(s)` / `Shape.card(s)` | 12% / 16%, 12–16 pt |
| `Shape.coin(d)` | half the diameter |

Draw joined rods, rows and tapes with `UnitRun` (`UnitRunGlyph` inside a Skia canvas). Every part has a rounded face, a 3 pt lip and 4 pt white gaps, and nothing outlines the parts or the whole. Pie slices share one centre.

**Equal groups.** Groups in a row are the same height, with pieces on one baseline, and tag lanes are reserved in every group even when one is empty.

---

## 5. Numbers and labels

| Text | Size (Large) | Weight |
|---|---|---|
| Primary number tiles and route cells | 28 pt | 800 |
| Digits on any piece (tile, cell, bar, segment, chip, token) | ≥ 24 pt | 800 |
| Model labels: axis numbers, tick labels, side lengths, A/B/C, mat titles | 18–20 pt (`DenseLabel` role `title` = 18 pt) | 700–800 |
| Stacked fractions in models and equations | 26 pt | 800 |
| Captions (`Caption`, `ProofCaption`) | ≥ 18 pt | 700 |

**Nothing in a model is below 18 pt.** Use Nunito via `PuzzleText` or `FaceText`, with tabular figures for numbers.

**Placement:**
- **Inside the piece** when it fits: a segment's amount, a tile's number, a price on its tag.
- **Otherwise in a reserved lane:** an axis lane, a lane above the hops, or a side lane hugging a shape's edge with an 8 pt gap. The lane exists in entry, proof and miss, so nothing reflows when a label appears.
- **One grammar per row.** If one item in a row is labelled on a chip, every item is.
- **No floating end labels.** A total is a band exactly the width of what it measures; a value on a reference band goes in the axis lane at the band's height.
- **No path or arc crosses a label,** and no label overhangs the model's edge.
- **Tiles size to their text** with at least 12 pt clear on each side, using the same font across a row.
- **Don't let auto-fit shrink a digit inside a piece.** `adjustsFontSizeToFit` collapsed route labels to dots and shrank "+2" in a 44 pt segment. Size the piece to the text instead.

**Notation:** coordinates `(x, y)`; money `€1.50` / `50 c`; time `h:mm`; fractions stacked.

---

## 6. Layout

**Order (iPhone 15, 393 × 852 pt).** From top to bottom: the question, the model stage, then the dock (keypad or choices, then Check). The dock is fixed and never covers content.

**Fill and centre.** The model grows into the stage between the question and the dock, fills the width with 16 pt side margins, and is centred on its painted bounds. Rows of 4–6 tiles use 56–64 pt tiles. Mats and charts fill the stage height. Don't leave the lower half empty while the model is cramped.

**One size, one place, through Check.** The proof transforms the entry model at the same size and origin. Play keeps the entry stage for these misses (`sameModelMiss` in `app/play.tsx`) and, for grids, correct verdicts too (`sameModelStage`). Rules for a model:
- **Read the stage from `useModelStage()`.** Its height is the entry stage, which already reserves the checked dock and is kept through playback.
- **Reserve the miss dock in every state.** The miss dock (verdict, Watch again, Try again, Back to path) is about 32 pt taller than the checked dock. A model that fills the stage height (grids, bar charts) subtracts that extra, plus a 12 pt clearance gap, in every state. Never shrink a model only on the miss.
- **Reserve receiving positions from the first frame:** trays, wells, rows, lanes. Nothing jumps when a proof finishes or a control appears.

**Questions.**
- **Judge puzzles keep the entry question in every state.** The claim lives in the dock and the verdict chip, never in the question.
- **XL:** at XL text size, after Check, the question collapses to one 44 pt row with a book icon, so the model keeps its room.

**Answer input.**
- **Keypad:** a compact 3×4 grid. The child types into the equation's own "?".
- **Choices:** three short answers sit in three equal columns; otherwise use one column. Labels never break inside a word.
- At most one instruction is shown.

**Touch targets** are at least 48 pt (44 pt minimum in dense grids). Every drag has a tap alternative (tap a piece, then its destination), with announced state.

---

## 7. Check, proof and miss

**Correct.**
- The proof plays on the entry model and lands on the settled screen (§2).
- After Check, only the submitted chip is shown with its ✓.
- The equation appears in the equation slot.

**Miss: the same model, one amber difference.**
- **The child's amount goes on the variant's own picture,** with the shortfall or overshoot as ONE amber zone. Never add tiles, blocks, bars, chips or a generic comparison bar.
  - A wrong tile or token turns amber.
  - A wrong count shows the difference bars as one `amber.light` zone. For example, if the child builds 0 of 0.8, the 8 missing tenths are soft amber and the other 2 stay grey.
  - A short total marks the uncounted top of the last bar amber, inside the bar. An over-count caps above it.
- **Small-difference grammar** (`components/puzzle/kit/difference-bar.ts`). When the difference is a tiny share of a bar (258 vs 260 of 520; 54 vs 55 of 92):
  - its amber segment is at least 56 pt wide, taken from its neighbour, so it isn't drawn to scale;
  - the amount sits inside at the same size as the neighbouring labels;
  - 4 pt white gaps on both sides, and no chip above;
  - the bar keeps its entry width and position.
- **If the difference can't be drawn honestly,** for example 18 seedlings in groups of 4, freeze the model and let the equation say it: `18 ≠ 20`.
- **Retry-only misses.** Counting and place-value gesture misses may show only the verdict and Try again, with the board frozen.

**Verdict row:** the submitted chip with ✓/✗, one hint line at most, Watch again, then the primary action.

---

## 8. Interaction and affordances

- **The visual is the input.** The child taps, drags or shades the model itself wherever possible.
- **Movable pieces** have a lip and lift when picked. **Static pieces** are flat tinted zones with no lip, shadow, lift or idle hint.
- **A dashed target appears only on an active drop zone,** while a piece can land there. There are no dashed ghosts.
- **The model builds in on entry** (`EntryBuild`). On the first encounter, an idle cue (`IdleHint`, `StoryIdleCue`) nudges the piece to move.
- **Story questions go through `StoryHost`:** the flat cat with a speech bubble.
- **Selection** uses a stronger tint plus a lift or move, never a rim.

---

## 9. Motion

Drive each checked proof with `useRevealBeats` inside `RevealSurface`, with an explicit lead, hold and minimum. **Every beat teaches a step of the maths.** Nothing moves just for show, one thing moves at a time, and nothing clips during a transition at either text size.

| Token | ms | Use |
|---|---:|---|
| `lead`, `press` | 100, 80 | Identify the source; compress the pressable shell |
| `travel`, `countStride` | 180, 100 | Move one object; space successive counts |
| `group`, `sweep` | 240, 360 | Move a group; trace a continuous measure |
| `settle`, `fade`, `reward` | 120 each | Hold the final count; cross-fade; show the result mark |
| `repeatHold` | 200 | Read the count between repeated deals |
| `inspection` | 360 | Hold the last dense landing or an indivisible exchange |

**Budgets:**
- standard proofs 2800 ms, including the finale;
- symmetry 3500 ms;
- dense proofs 4500 ms;
- nothing over 4.5 s.

Repeated rounds use `proofTempo({ rounds, dense, kind })`: later rounds share 1500 ms, clamped to 100–240 ms each. A short proof starts within 200 ms of the first paint.

**Landings.** `ProofLanding` gives a loose piece a 140 ms contact (1.06 × width, 0.94 × height) and returns it to its counted size. `ProofCaption` and `ProofFinale` scale the settled text 0.94 → 1.04 → 1 over 240 ms. Commit the mark, count, caption and announcement on the same landing.

**Playback controls.**
- The reserved row shows Pause and Skip while a proof plays, and Watch again once it settles; the model never moves when they switch.
- Pausing freezes the beat. Skip commits the final state once. Watch again replays the submitted arrangement.

**Reduce Motion.** Keep every landing, count and caption. Draw static states from `landed` and cross-fade over 120 ms. Drop travel, springs and stagger. A paused child can step through.

**Paint handshake.** Play retires the frozen entry model on `onInitialModelPainted(runId)`. A Skia or asynchronous model passes `awaitInitialPaint: true` and acknowledges after its progress-zero drawing (`useInitialModelPaint`). When a mounted proof still needs layout, pass `null` to `useRevealBeats` until the beat count is ready.

**Speech.** The clock's `announce(message, delayMs)` replaces pending speech; there is one speech owner per landing.

---

## 10. Shared kit (`components/puzzle/kit/`)

Build from these and extend them. Don't restyle locally.

| Component | Meaning |
|---|---|
| `ModelStage` / `useModelStage()` | The measured stage; gives the model its width and entry height. `keepOrigin` pins a model's origin through Check (opt-in). |
| `UnitRun` | Joined rods, rows and tapes: rounded parts, 3 pt lips, 4 pt gaps. |
| `ValueChip` | A given number printed in the model: flat, no lip, never looks tappable. |
| `UnknownWell` | An unknown "?": a soft zone; `active` gets the berry tint while being filled. |
| `NumberTile` | A tappable or draggable number: rounded face, lip that compresses on press. |
| `DropTargetOutline` | The one dashed element: an active drop zone only. |
| `EntryBuild`, `IdleHint`, `StoryIdleCue` | Build-in on entry; first-encounter nudge. |
| `StoryHost` | The cat and speech bubble for story prompts. |
| `DenseLabel`, `useMeasuredLabels`, `valueToken` | Measured single-line labels (roles `axis`, `value`, `title`, `readout`, `sequence`), with value and unit kept together. |
| `difference-bar.ts` | Widths for the small-difference grammar (§7). |
| `RevealSurface`, `useRevealBeats` | The proof surface and its single clock (§9). |
| `ProofLanding`, `ProofFinale`, `ProofGeometry` | Landing squash, settled-text finale, 120 ms geometry tween. |
| `ResultMark` | ✓ / ✗ drawn from strokes; shown with every verdict. |
| `DiagramIcon` | The only way to draw a real-world object in a model: a recognisable silhouette filling about 85% of its box, with at most two identifying features, the same in source, travel and destination. |

---

## 11. Family recipes

| Family | Components | Must be true |
|---|---|---|
| **01 Balance & equations** | `BalanceScale` (`wide`), `EquationBoardModel`, `BalanceModel` | One bright teal beam, violet pivot, two equal bright trays on short posts. The proof uses the same wide scale as entry and miss. x tiles are about 36 pt; unit tiles at least 32 pt with 18 pt digits. Level means equal; tilt only for a resolved inequality (2.5°–8°). |
| **02 Quantity scenes** | `CountingBoard`, `QuantityTaskScene` | Objects in exact rows or groups (rows of five, ten-frames, true arrays). Objects keep their identity from question to proof. |
| **03 Pies & fraction build** | `FractionPieChart`, `TappableFractionPie`, `EquivalentBar` | Equal sectors with white gaps; shaded parts teal, unshaded `Shape.empty`. 26 pt stacked fractions under the model. Equivalence splits one bar in place; the twentieths fold 2×2 within each fifth so a single amber cell reads. |
| **04 Strips & fraction lines** | `FractionStrip`, `FractionLineRail`, `FractionGroupTape` | Strips fill W; built parts violet. ±1 keys are soft teal cards with 22 pt text. Fraction lines: 12 pt rail, 20 pt labels, 28 pt dots, hop bands with labels in a lane above. Group tapes keep their whole ("48") as the header in every state. |
| **05 Decimals & percent** | `DecimalGridTask`, `DecimalPlaceMat`, `DecimalTenths`, `PercentageShareBar` | 10×10 square fills W. Mats fill the stage height: tenths as teal rods, hundredths as violet squares (at least 28 pt), 18 pt titles. Tenths bars span W. Percent bar inside 16 pt margins; misses use the small-difference grammar. |
| **06 Place value** | `PlaceValueMat`, `PlaceValuePiece`, `PlaceValueTask` | Tens/Ones mats fill the stage height; teal rods and about 32 pt cubes; 18 pt titles; "Total" as a band. Regrouping is animated, not cut. Misses are retry-only or one amber difference. |
| **07 Number lines** | `LandmarkLine`, `NumberLineTrack`, signed line | Solid 12 pt rail, 20 pt labels, 28 pt dots, hop labels above their arcs. The miss dot sits on the rail like the teal dot. |
| **08 Bar charts** | `BarChart` | Plot at least 55% of the stage; 20 pt A/B/C and ticks. Reference (mean, most, least) is one 14 pt violet band exactly the plot width, with its value chip in the y-axis lane. The answer bar is amber; the others stay bright teal. Misses add no bars and no chips. |
| **09 Capacity** | `JugPour` | Vessel drawn to its capacity; level, tick and caption come from one value; a total never overflows the vessel. |
| **10 Clocks** | `ClockDiagram` | Flat dial with 12 numerals; exact hands; elapsed time as a soft sector. |
| **11 Money** | `MoneyStage`, `MoneyTape`, `MoneyCoin` | Two zones: equal goods cards on one baseline, and a purse with the coins inside. Prices sit on their tags. Totals and sale bands are full-width bands exactly as wide as they measure. A miss draws the child's amount on the price tape, with the gap as one amber zone. |
| **12 Grids & coordinates** | `GridDiagram`, `GridAnswerChoices`, `CoordinateGrid`, `RouteGridSurface` | The board fills W up to the stage height minus the miss reserve (about 270 pt, cells about 52 pt); 42 pt tokens with 20 pt letters; the mirror is a 14 pt band; 18 pt axis labels; cells paint on the first frame. Route grid: 72 pt cells, 28 pt numbers, walked cells solid and joined by 28 pt bridges. |
| **13 Shapes & measure** | `ShapeDiagram`, `GeometryMeasureTask`, `PerimeterTape`, `VolumeBox` | Solid shapes, no outlines. 20 pt side labels in a lane hugging each side. "Area" or "Perimeter" as one soft band. Tape chips are 32 pt with 20 pt digits, and a 1-unit side is a chip, never a sliver. Box labels are 18 pt, inside 16 pt margins. |
| **14 Operations** | `OperationsReveal`, `TargetBuildTask`, `PairSumTask`, route grid | Rows fill W with 24–28 pt digits; operator keys 52 pt. The wrong pair shows in amber. Misses keep the entry stage. |
| **15 Patterns & ordering** | `PatternNextTask`, `ChallengeTasks`, `OrderNumbersTask`, `SortBucketsTask` | Tiles of 56–64 pt with 28 pt digits on one y in every state. Hops are bands with their label in a lane above. No grip dots and no floating chips. Amber marks only the miss tile. |
| **16 Text MC & stories** | `StoryHost`, `StoryGivens`, `PuzzleContextObjects` | The cat asks in a bubble. Rate tiles are 64 pt. Difference tapes use the small-difference grammar. Limit lines are one 20 pt rail: grey for the range, teal up to the limit, no ticks. |

---

## 12. Large text and accessibility

- Allow native Dynamic Type at every size. Test at Large and accessibility-extra-large (XL), in Play and in the proof.
- Derive every tick, label, given and count from the puzzle and preserve them across text sizes (`scripts/check-dense-information.mjs`).
- **Countability floor** (`countabilityFloor`): at least 18 pt per simple cell, 20 pt per moving cell, and 24 pt per illustrated object or XL cell. Reflow first. If the whole still falls below the floor, offer child-controlled magnification in place.
- At font scales of 1.2 and above, playback uses 44 pt icon buttons with localised accessibility labels.
- Accessibility labels describe the givens, never the answer. The proof's model announces its equation.
- Contrast: text at least 4.5:1, and meaningful marks at least 3:1 against their actual neighbour.

---

## 13. Review checklist (every change)

- [ ] Uses tokens and kit components only: no raw hex, no bitmaps in the model, no `react-native-svg`.
- [ ] The settled frame has one model, at most one caption, one equation and the submitted answer.
- [ ] There are no outlines, hairlines, seams or decorative ticks; guides are bands of at least 10 pt.
- [ ] Fills are bright; definition comes from 4 pt gaps and 3 pt lips; round pieces have a crescent lip.
- [ ] Digits on pieces are at least 24 pt (28 pt on primary tiles); labels are at least 18 pt; nothing is auto-shrunk inside a piece.
- [ ] Labels are inside their piece or in a reserved lane, with one grammar per row and no floating end labels.
- [ ] The model fills W, is centred within 4 pt, and keeps its size and origin through Check.
- [ ] The miss is the same model with one amber difference; small differences are at least 56 pt with the label inside.
- [ ] Only movable pieces have lips, lift or idle hints; a dashed target appears only on an active drop zone.
- [ ] The proof uses `useRevealBeats`, teaches every beat, stays under 4.5 s and has a Reduce Motion path.
- [ ] `npx tsc --noEmit`, ESLint on changed files and `npm run test:game` pass; `scripts/puzzles/lint-friendly.mjs --changed` has no new findings.

---

## 14. Device checklist (before calling a family done)

Run on an iPhone 15 simulator (393 × 852 pt) with a cold restart: Fast Refresh is off in the dev build.

1. **Entry, Large.** The model builds in, fills the width, is centred, and the dock covers nothing. The question is readable, and the "?" sits on the asked-for thing.
2. **Interaction.** Every movable piece lifts and lands; the tap alternative works; static pieces don't respond; the first-encounter cue plays once.
3. **Correct, Large.** The proof plays on the same model with no jump, resize or swap. The settled frame passes §2. Watch again replays exactly.
4. **Wrong, Large.**
   - It's the same model at the same size and position, with ONE amber difference and no extra pieces or chips.
   - The verdict, Watch again and Try again all clear the model by at least 12 pt.
5. **XL, both verdicts.**
   - Text grows without clipping or truncation; the question collapses after Check.
   - The model keeps its entry size and origin.
   - Targets stay at least 44 pt and disjoint.
6. **Reduce Motion, both verdicts.** Every count and caption still lands; Next step works when paused.
7. **VoiceOver spot check.** The givens are announced, the answer isn't announced before Check, and the proof's equation is announced.
8. **Locales.** Run one variant each in `lv` and `ru` at XL: the longest labels fit their lanes.
9. **Automatic checks.**
   - Command: `run-family.sh <UDID> <NN>`. It is in the redesign's session tooling (`selfcheck/` in the scratchpad named in `docs/puzzle-redesign-handover.md`). It records videos of both verdicts, builds a board and runs `scripts/native/check-screen-rules.mjs` at Large and XL. Without that tooling, run the checker directly and record both verdicts by hand.
   - The checker must pass clearance, centring and first paint.
   - Its text-recognition flags on single letters and "−" are known false positives; confirm them by eye.
10. **Side by side.** Compare the board with two finished families. The piece sizes, label sizes, colours and spacing should look like one product.
