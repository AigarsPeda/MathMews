# Math Mews puzzle visual system

A child should be able to point to each given, act on the model, and see how the checked answer follows. Use the same shapes in Play, Picture help and the checked explanation. Before Check, Picture help uses different operands. Keep the companion outside the measured diagram.

## 1. Simplicity

At settle, a seven-year-old should be able to point to **one model that changes in place, at most one short caption, one equation and their submitted answer**. Keep the answer and its mark visible. Give each landing one current phrase. Replace that phrase when the next change happens. Let long captions and equations wrap at the chosen text size so every operand and the result stay visible. A model with clear labels can dispense with the caption.

For equivalent fractions, shade three fifths of one bar. Split each fifth into four while its width and shaded area stay fixed. Finish with `3/5 = 12/20`. The rejected screen made the child compare two bars, interpret “5 groups of 4 · 1”, inspect four more tiles and follow a numbered selector. [Product owner’s example](assets/user-10-equivalent-too-complex.png)

At large text sizes, a child can choose to inspect a group in the model’s own space and return to the whole. Keep the math legible and preserve its orientation. Reserve separate rows for playback and the result action only when needed.

## 2. Tokens (`constants/puzzle-theme.ts`)

Never write a hex value in a puzzle component. Use `Ink`, `Quantity`, `Shape` and `ProofMotion`. Existing drawings can still import `Stroke`, `Radius` and `Motion`.

### Colour roles

| Role | Token | Hex | Use |
|---|---|---|---|
| Paper | `PuzzleColors.background` | `#FFFFFF` | Canvas and label backing |
| Ink | `Ink.text` | `#24314B` | Numbers, symbols, labels (13:1) |
| Soft ink | `Ink.soft` | `#526176` | Axis numbers, secondary labels |
| Line | `Ink.line` | `#798698` | Neutral lines on paper (3.7:1) |
| Guide | `Ink.guide` | `#E3E8EF` | Incidental guides |
| Tray | `Ink.tray` / `trayEdge` | `#F5F7FB` / `#D7DDE8` | Neutral work surface |
| Quantity A — teal | `Quantity.teal` | fill `#4FB5CC`, edge `#2B7F93`, soft `#E3F4F7`, grid `#4E9DB1` | First/given quantity, geometry, measurement, liquid |
| Quantity B — violet | `Quantity.violet` | fill `#9C7BD4`, edge `#6A4A9C`, soft `#F0EAF8`, grid `#8C6CC8` | Fractions, shaded part, second quantity |
| Quantity C — amber | `Quantity.amber` | fill `#F5B651`, edge `#9A6517`, soft `#FFF3DC`, grid `#B07A22` | Decimals, money/coins, third quantity |
| Action / selection | `PuzzleColors.primary` | `#C32468` on `#FFF0F6` | Buttons, the learner's current selection, the focused slot. **Never** a data colour or a passive unknown. |
| Correct | `PuzzleColors.success` | `#267324` on `#EEFBDE` | Only after Check, always with a ✓ mark |
| Mistake | `PuzzleColors.incorrect` | `#C82E39` on `#FFF0F0` | Only after Check, always with a ✗ mark |
| Removed | ghost | Empty face and neutral inner marks | Removed glyphs keep their silhouettes |

Mathematical marks such as ticks and axes need at least 3:1 contrast against their surface. Use `grid` on paper, `edge` on a soft tint and `onFill` on a quantity fill. Separate countable pieces with the white gaps specified below.

Rules:
- One hue keeps one meaning through the whole task and its reveal. A quantity does not change colour when it moves.
- Place labels in navy on paper or a soft tint. Give a label a white backing when it crosses a quantity fill.
- Never name a colour in copy ("the blue part"); say "the shaded part" or label it.
- Hue is never the only cue: pair it with a label, position, outline style or mark.

### Lines, corners and spacing

Keep one set of mathematical coordinates for the drawing and its hit tests. Apply the following radii to the paint. All dimensions are in points. Every radius stops at half the available side.

| Token | Rule |
|---|---|
| `Shape.tile(s)` | 18% of the short side, bounded to 3–8. |
| `Shape.barTop(w,h)` | 16% of bar width, up to 4 and at most a quarter of the height. Keep a level top and a square foot at zero. |
| `Shape.stripEnd(h)` | 30% of thickness, up to 6. Keep interior cuts square. |
| `Shape.vertex(edge)` | Round the inset face by 8% of the shorter incident edge, up to 3. Join the outline at the true vertex. |
| `Shape.tray(s)`, `Shape.card(s)` | 12% and 16% respectively, bounded to 12–16. Subtract the inset for a concentric inner corner. |
| `Shape.coin(d)`, `Shape.jug` | Use half the coin diameter. A jug heel uses 8% of chamber width, bounded to 4–12. Its rim uses 12% of rim width, bounded to 2–5. |
| `Shape.stroke` | Silhouette and active trace 3. Small glyphs under 24, axes, major ticks and unknown outlines 2. Use white gaps inside a measured whole. Piece faces have zero stroke. Use a 4/4 dash for unknowns and a 2 pt dotted dimension guide on a 6 pt pitch. |
| `Shape.space` | Leave 4 between loose pieces and 8 between groups. Separate adjacent parts by 4 pt of white space. |

Draw joined rods, rows and tapes with `UnitRun` (`UnitRunGlyph` inside a Skia canvas). Its width and height give the measured bounds, and `columns` sets the cells per row. Every part has a rounded face and a 3 pt lower lip inside its bounds. Empty parts use `Shape.empty` (#DDE3EC) and `Shape.emptyLip` (#C5CEDA). Shaded parts use their quantity fill and edge for the face and lip. Adjacent parts have a 4 pt white gap. Omit outlines on the parts and the whole. Use a distinct hue for each shaded face. Its lower lip must have at least 3:1 contrast against the white gap. Pie slices share a centre and matching drawn and touch angles.

### Type in diagrams

Nunito via `PuzzleText`. Main quantity 22–26 pt / 800. Measurements and model labels 16 pt / 700. Axis numbers and ticks 14 pt / 700, tabular figures. Nothing in a model below 14 pt. Labels sit beside the thing they describe, never on top of a mark they could hide.

## 3. Shared kit (`components/puzzle/kit/`)

Build models from these, extend them rather than restyling locally.

| Component | Meaning |
|---|---|
| `ModelTray` | Neutral surface behind a model. Not pressable. |
| `ValueChip` | A given number printed in the model. Flat, no lip. Optional quantity tone. |
| `UnknownWell` | A value not yet known. Passive = dashed grey well with "?"; `active` = the slot the learner is filling (solid berry ring). |
| `NumberTile` | A number the learner taps or drags. Rounded neutral face and 3 pt lower lip. The lip compresses on press. The selected face and lip use the berry selection colours. |
| `ResultMark` | ✓ / ✗ drawn from strokes, shown with every correct/incorrect state. |
| `DiagramIcon` | The only way to draw a real-world object inside a model (see §5). |
| `useRevealBeats` | The one clock for solution reveals (see §6). |
| `ChoiceButton` | Fixed hit frame with a pressed face, a selected rim and a checked result mark. |
| `RevealSurface` | Wraps every solution reveal. A reserved control row shows drawn **Pause/Play** and **Skip** icons while playing and **Watch again** once settled (the model never moves when they switch). The model ignores touches while playing. Reduce Motion cross-fades and can still replay. |
| `Focus` | Outlines the active part while the other operands remain readable. |
| `Caption` | The only explanatory text style inside a model: ≥14 pt, navy/soft ink on paper or soft fill. |

Use `RoundedTile` for loose pieces, `FriendlyPolygon` for true vertices and `PieWithCrust` for equal sectors. `PlateGlyph` draws the dish behind cookie slots. The family host owns selection, accessible actions and hit targets. `ProofCaption` replaces one short localized line. Check that the complete phrase fits at the supported font scales. Put a longer equation in the equation slot, where it can wrap at operators.

Containers have exactly one meaning each, everywhere:

| Container | Look | Meaning |
|---|---|---|
| Unknown well | dashed `Ink.soft` 2 pt on `Ink.tray`, "?" | A value the learner must find. **Dashed is reserved for this.** |
| Destination | solid 1.5 pt `Ink.trayEdge` on paper, empty | Where a piece will land (share trays, sort baskets, join slots). Gains a berry ring while a dragged piece hovers it. |
| Rack | `ModelTray` (tray fill, no outline emphasis) | Where available pieces wait (tile bank, sorting rack). |
| Given | `ValueChip`, flat | Fixed, printed value. |
| Target / goal | `ValueChip` with quantity tone | The number to reach. Never gold, never dashed. |

## 4. Family recipes

| Family | Component(s) | Must be true |
|---|---|---|
| Balance & equations | `BalanceScale`, `EquationBoardModel` | Flat front elevation: one teal beam with rounded ends, small triangular pivot, two identical flat trays on short posts. Loads are live text/tiles, upright. Level beam = equal. Tilt only for a resolved inequality, scaled with the difference (2.5°–8°). Equal loads settle level.. x tile and unit tile are distinct shapes. |
| Counting scenes | `CountingBoard`, `VisualPracticeBoard`, `QuantityTaskScene` | Objects in exact rows/groups (arrays are literally rows × columns; ten-frame or rows of five for counting). Two addends share the object but differ by tone; removed items become ghosts. Objects keep identity from question to reveal. |
| Fractions | `FractionPieChart`, `FractionGridChart`, strips, fraction number line | Violet. Equal parts exactly equal. Shaded = violet fill; unshaded = `Shape.empty` with white gaps and a bottom lip. Fraction numerals navy, outside the fill. |
| Decimals & percent | `DecimalGridTask`, `DecimalPlaceValueTask`, reveals | Amber. 10×10 hundred square, tenths as columns, hundredths as cells (never dots). Percent uses the same hundred square. |
| Place value | `PlaceValueTask`, `BaseTenGrid` | Same hue for ones, tens and hundreds (teal); a ten rod visibly contains ten unit squares; a place-value mat labels columns. Regrouping is animated, not a jump-cut. |
| Number lines | `NumberLineTrack`, signed line | Uniform spacing, 2 pt axis and major ticks; start marker at the stated start; the whole needed range is visible or scrolls to it. Hops trace a 3 pt arc to the exact tick. |
| Bar charts | `BarChart` | Use a shared zero baseline and the minor ticks required to read the givens. Keep tops unlabelled before Check. Place the unknown well outside the plot. |
| Capacity | `JugPour` | Vessel drawn to its capacity; liquid level, tick and caption derive from one value; a total never overflows the drawn vessel. |
| Clocks | `ClockDiagram` | Flat dial, 2 pt rim, minute ticks, 12 numerals; hands exact; elapsed time as a translucent sector. |
| Money | `MoneyCoin`, `MoneyReveal` | Amber coins with the denomination printed; prices formatted `€0.00` or `50 c`; shop items via `DiagramIcon`. |
| Spatial grids & coordinates | `GridDiagram`, `BridgeTask` | Grid lines `quantity.grid` on paper; shapes teal fill + edge; original shape kept as ghost when moved; coordinates `(x, y)` everywhere. |
| Shapes, area, perimeter, volume | `ShapeDiagram`, `GeometryMeasureTask`, `VolumeBox` | Flat polygons with a 3 pt true-edge outline. Perimeter shows unit ticks along edges, not an area grid. Area counts by rows. Volume fills by layers. |
| Operations | function machine, operation path, target build, ratio table | Givens are `ValueChip`s, unknowns are `UnknownWell`s, operators are `NumberTile`s. Measured pieces keep their lower lip in the proof. |
| Patterns & ordering | pattern, repair, order, sort, pairs, fix-mistake | Sequence on one baseline with even spacing; the gap is an `UnknownWell`; draggable items are `NumberTile`s. |

## 5. Objects (`DiagramIcon`)

Use a recognizable silhouette that fills about 85% of its 64-unit box. Add up to two identifying features, such as a biscuit's bite and chip cluster. Use 3 pt silhouette ink or 2 pt below a 24 pt display box. Keep the same size, features and operand tone in the source, during travel and at the destination. Ticks, denominations and equal subdivisions follow the data.

## 6. Motion

Drive each checked explanation with `useRevealBeats` inside `RevealSurface`. Supply `reducedSteps: true`, an explicit lead, hold and minimum. Use `ProofMotion.beat` for variant-specific durations. Durations below are in milliseconds.

| Token | Duration | Use |
|---|---:|---|
| `lead`, `press` | 100, 80 | Identify the source and compress the pressable shell. |
| `travel`, `countStride` | 180, 100 | Transfer one object and space successive count landings. |
| `group`, `sweep` | 240, 360 | Transfer a complete group or trace a continuous measure. |
| `settle`, `fade`, `reward` | 120 each | Hold the final count, cross-fade a committed state, or show the result mark. |
| `repeatHold` | 200 | Let the child read the count between repeated deals. |
| `inspection` | 360 | Hold the last dense landing or an indivisible exchange. |

Use `proofTempo({ rounds, dense, kind })` for repeated rounds. Later rounds use 1500 ms divided by the round count, clamped to 100–240 ms. A short proof spends its reading time in the action. Repeated deals hold for 200 ms between groups. Pours continue directly into the next round. Standard proofs budget 2800 ms including the finale, symmetry 3500 ms and explicitly dense proofs 4500 ms. Use `roundsAt(landed)` to draw and name every item in a batch.

`ProofLanding` gives loose pieces a 140 ms contact and recovery. At contact, the painted piece reaches 1.06 times its width and 0.94 times its height. It returns to its counted size. A calibrated waterline, bar top, marker or edge lands at its exact value. `ProofCaption` applies a 240 ms finale to the settled text, scaling from 0.94 to 1.04 to 1. For a separate equation chip use `ProofFinale`. Both effects use a 120 ms cross-fade under Reduce Motion. Gate optional landing ticks through the live Play feedback setting. Replay and QA stay silent.

At font scales of 1.2 and above, playback uses 44 pt icon buttons with localized accessibility labels. Measure the compact rows in the dock.

Start a short proof within 200 ms after initial paint. Aim for at least one second of trackable action. Pausing freezes the remaining lead, movement or inspection. Skip commits the final evidence once. Watch again restores the submitted arrangement.

Play identifies each immutable submission with `RevealPlayContext.attemptKey` and retires its frozen, accessibility-hidden model on `onInitialModelPainted(runId)`. A native-only surface waits for a measured starting model and a presentation frame. A Skia or asynchronous model passes `awaitInitialPaint: true` to the clock and calls `beats.onInitialModelPainted(beats.runId)` after its full progress-zero drawing is ready. `useInitialModelPaint(beats, modelReady, confirmPaint)` waits for the family’s renderer acknowledgment and cancels pending checks on replay or unmount. Replay acknowledges its own run. Wrap a part in `ProofGeometry` to interpolate a position or size change for 120 ms. Reduce Motion keeps its geometry static.

When a mounted proof needs layout, pass `null` to `useRevealBeats` until its beat count is ready. Keep pieces at full contrast and commit the count, caption and accessible state together. Replace the current caption in place at landing so its previous count clears immediately. Keep the final equation visible until the child continues. Under Reduce Motion, draw static states from `landed` and allow a paused child to step through each one. The clock’s `announce(message, delayMs)` replaces pending speech. Pause, Next step, Skip, replay and unmount cancel it. When editing a mounted proof, call `cancelAnnouncements()`. Keep one speech owner per landing. Restore the initial caption on replay.

Keep the press target fixed. Squash only its painted shell to 0.98 over 80 ms and restore it over 120 ms. A checked answer receives one outline/check or cross. Play owns the submission haptic. Hide task controls with `TaskLiveControls` while showing a checked proof, including its final frame.

## 7. Layout & accessibility

- iPhone 15 (393 × 852 pt): question → model → response, top to bottom; the fixed Check button never covers content. Give the model the space; don't leave the lower half empty while the model is cramped.
- Touch targets ≥ 48 pt (44 pt minimum for dense grids, with steppers as an alternative). Every drag has a tap alternative (tap a piece, then tap its destination), with announced state.
- **Adaptive model area:** the model grows into the space between the question and the response; dense models (seedlings, hundredths, base-ten units, coin reveals) are never drawn small while the lower third of the screen is empty. Short boards keep controls within thumb reach.
- **Three Play layouts.** Short boards: the task centres in the space between the question and the dock. Standard boards: question, model, response top to bottom. Dense boards: scroll, with ≥20 pt clear above the dock so Picture help is never covered.
- **Pieces stay put.** A receiving position (tray, well, row, exchange lane) is reserved from the first frame to the final caption; nothing jumps when a reveal finishes or a control appears.
- Answer cards keep equal prominence: three short answers in three equal columns, otherwise one column; never two narrow cards beside a double-width one.
- Answer labels never break inside a word ("Equal perimeters" wraps whole words or uses full width).
- Contrast: text ≥ 4.5:1, essential lines and graphical states ≥ 3:1 against their actual neighbour.
- Notation: coordinates `(x, y)`; money `€1.50` / `50 c`; time `h:mm`; fractions stacked in models.
- Accessibility labels describe the givens, never the answer.

## 8. Review checklist

- [ ] Uses tokens and kit components only; no raw hex, no bitmaps in the model.
- [ ] Truthful: every mark matches its number; placeholders imply nothing.
- [ ] Unknown / selected / given / pressable states follow §3.
- [ ] Reveal uses `useRevealBeats`, chunked, with a final equation and Reduce Motion path.
- [ ] Fits the iPhone 15 viewport; targets ≥ 48 pt; contrast checked.
- [ ] Captured on the simulator and compared side by side with two other families.

## Dense models and large text

1. Derive the required ticks, labels, givens and counts from the puzzle and its current answer or reveal state. Preserve them across text sizes. Check the rendered sets at font scales 1 and 2 with `scripts/check-dense-information.mjs`. Keep the unknown out of both visual and spoken givens.
2. Measure the stage with `onLayout` and the localized native labels with `useMeasuredLabels`. Reserve an axis lane, an external value lane with leaders, and one explanation lane through the longest reveal state. Allow 4 pt to the associated mark and 8 pt to other marks or labels. Grow or stack complete groups in reading order. Use one task scroll viewport between the measured header and dock, bring focused controls fully into view and leave at least 20 pt after the last item.
3. Format each signed or decimal quantity with its unit as one `valueToken`. Render it in a measured, single-line `DenseLabel`. Print the unit once per scale. Equations may wrap at operators.
4. Allow native Dynamic Type at every size. Use base sizes of at least 14 pt for ticks, 16 pt for measurements and annotations, and 22 pt for main readouts. Use `Caption` for reveal explanations. Verify 4.5:1 rendered text contrast and 3:1 for meaningful marks.
5. Declare the unit the child counts. Use `countabilityFloor` for at least 18 pt per simple cell, 20 pt per moving cell and 24 pt per illustrated object or accessibility-size cell. Allow 4 pt between independent pieces and draw shared boundaries within a whole. Reflow first. If the whole still falls below the floor, offer a child-controlled magnification that replaces the overview in place and can return to it. Keep one accessible quantity. `LinkedDetail` is deprecated for checked proofs.
6. Keep landed pieces and earlier counts at full contrast. Use motion or a mark to identify the active piece. Commit the mark, count, caption and announcement on the same landing. Each group transfer must match its displayed increment. Use the inspection duration in §6 for the final dense landing or an indivisible exchange.
7. Under Reduce Motion, preserve every landing, count and caption. Use `useRevealBeats` with `reducedSteps`, draw from `landed`, and cross-fade static states over `Motion.fade` (120 ms). Omit travel, springs and stagger. Keep playback controls available through the final hold. Paused playback offers Next step at either motion setting.
8. Test iOS at default and accessibility-extra-large in play and reveal. Use disjoint targets at least 44 × 44 pt, preferably 48 pt. Check edge taps and focus near the header and dock at intermediate and final scroll positions, especially in order numbers, fraction match, decimal grid and place value.
