# Puzzle redesign: coordinator handover (for a ChatGPT coordinator if the Claude allowance runs out)

Owner instruction (2026-11-23): if the Claude agents run out, switch completely to ChatGPT agents and continue the work.

## Goal
Every puzzle family must reach a score of at least 96 from all three council members.

## Read first
The working files are in the session scratchpad: `/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/54d8d47a-301a-4ea9-b32b-cb77d747b962/scratchpad/`. Copy the key files into docs/ if that folder disappears.
- process-v2.md: the team, family order, council and automatic checks.
- standard-self-explanatory.md: owner standards, namely friendly and clear at a glance, no hairline frames, no fine elements, no outlines on pieces, and centring.
- council-brief.md: the end sections are binding owner decisions (simplicity, answer input, clear at a glance).
- round7/keypad-dock.md: the docked keypad rules.
- council/friendly/user/: the owner's screenshots of rejected designs, used to calibrate.
- resume-queue.md: the state at the last pause.
- docs/PUZZLE_STYLE_GUIDE.md and constants/puzzle-theme.ts in the repo.

## Team (T3 delegated threads, all GPT)
- **Integrator I** (GPT-6.2 Astra), thread `thread:delegated-task:command%3Amcp%3A07955679-3066-44a3-86f0-5ccd66522d4d%3Adelegate-task%3Ab77d1c8a-e35e-499d-9074-fbf12b5ed72e`. Owns Play, the dock and keypad, the kit, locales and catalogs. Simulators: B 5E47DCCE-E2DA-44EB-A73A-0CCC88207EDF and main 9E0EC1C4-9025-4974-A9DA-CC99F98A86EF.
- **Builder Q** (GPT-6.2 Astra), thread `…delegate-task%3A5d309a9b-8be4-4090-93a6-86185a32b682`. Order: 02 quantity scenes → 16 text MC → 13 shapes. Simulator 94C10AEF-3FCF-40B4-B745-C4EF5009EB2F.
- **Builder F** (GPT-6.2 Sol), thread `…delegate-task%3Af8fe9eb4-8393-4d12-bd16-d9e66fed979b`. Order: 06 place value (redesign in progress) → 04 strips → 03 pies → 05 decimals → 07 number lines. Simulator CBB93C43-F9DA-4D4D-8665-6531E580FE11.
- **Builder E** (GPT-6.2 Astra), thread `…delegate-task%3Aa98b0f7e-922e-4f94-a0b3-8a900dbdc3df`. Order: 10 clocks (fixing council blockers) → 09 capacity → 11 money → 14 operations → 12 grids → 01 balance → 15 patterns → 08 bars. Simulator B3052E6E-767A-40D0-B063-B7F7892288F4.
- **K, tooling** (GPT-6.2 Astra), thread `…delegate-task%3Aeb242b6b-65ff-47bf-9360-8d7d776c11ac`. Owns scripts/native/check-screen-rules.mjs. Borrows simulator B in short windows; the integrator releases it.

## Council (three members, one family at a time)
- **Learning & Simplicity**: now **GPT-6.2 Astra**. It was Claude Opus 5.5 until the Claude limit was hit on 2026-11-24 around 01:30; keep using GPT.
- **Visual, Brand & Motion**: GPT-6.2 Sol.
- **Accessibility**: GPT-6.1 Terra.

Each vote uses the brief pattern in council/fam10/brief.md and writes `council/famNN/vote/ROLEID.json` with a score and `blocking_for_96`.

## Loop per family
1. The builder says "<family> ready".
2. K runs check-screen-rules on that family, at Large and XL, with correct and wrong answers.
3. Record with scratchpad/vidcap.sh, using `AUTO=correct` or `AUTO=wrong` and `puzzle-layout-qa?autoAnswer=…`.
4. The council votes.
5. Merge the blockers and send them back to the builder.
6. Repeat until all three members score 96 or higher, then move to the next family.

## Status at handover time (updated 2026-11-24 ~01:40)
- **10 clocks:** DONE, scored 97/97/97.
- **09 capacity:** DONE (2026-11-24). Final: Accessibility 96, Learning & Simplicity 97, Visual/Brand/Motion 97.
- **02 quantity scenes:** DONE (2026-11-24). Final: Accessibility 97, Learning & Simplicity 97, Visual/Brand/Motion 96.
- **04 fraction strips:** round-1 vote in progress. Scores so far: Accessibility 91 (2 blockers) and Visual/Brand/Motion 90 (7 blockers). The Learning & Simplicity vote (GPT) is pending. Afterwards, merge the blockers into a list for F.
- **06 place value:** F's next job is K's failure list (XL fit, arrival, equation AX).
- **11 money:** vote 1 on 2026-11-24 scored Accessibility 93, Learning & Simplicity 89 and Visual/Brand/Motion 87. E is fixing M1–M7 (scratchpad council/fam11/fix-list.md), then re-records to verified-v2 for the re-vote. Operations is paused until then.
- **O2 is retired.** E owns 14, 12, 01, 15 and 08. Q's no-outline kit for quantity and geometry is done; Q is on 16.
- **Integrator "round 8" messages are superseded by process v2.** Don't run the 86-route council.
- **16 text MC:** Q's next job.
- **Open shared items for the integrator:**
  - PracticeAffordances strokes (dashed drop target, StoryHost bubble);
  - hide the header measurement probes from AX.
- **Open items for F:** Russian sort_buckets clips at XL (598 pt board in a 417 pt region); fraction_equivalent at XL (family 03).
- **Rulings:**
  - Answer cards, the verdict chip and replay keep the Duolingo outline with a lip; the no-border rule applies to the visualizations.
  - Wrong answers in counting and place value are retry-only.
  - After Check, only the submitted chip is shown.

## Rules for the coordinator
- Relay owner feedback to the file owner with a screenshot copied into council/friendly/user/.
- Keep at most 5 simulators booted.
- Never let two agents share a simulator without a released window.
- Don't commit unless the owner asks.
- Report to the owner in plain language, with score tables.

## Paused 2026-11-24: ChatGPT usage limit hit (resume queue)
1. **E, money v2.** Fix M1–M7 (council/fam11/fix-list.md), using the integrator's shopping-heading handoff (work/friendly-I/round7/money-retained-heading). Record to verified-v2, rebuild the sheets, then re-vote all three members. After that, resume 14 operations.
2. **F.** The family 04 XL line and story retakes, then the Visual-only re-vote. Then family 06 retakes, waiting on the integrator. Then 03 pies.
3. **Integrator.** Compact the XL place-value choices for bundle and split, and add fraction_equivalent to the mechanicIntro exclusion. Do NOT change the fill tokens (owner ruling).
4. **Q.** 16 text MC, then 13 shapes.
- **Where E stopped:** M5 for afford is done (groups of five visible apples, with the mismatch shown on the shopping model), and Play keeps the shopping heading through Check. E had started a fresh six-variant run, which was cut off. On resume, check `git diff` and re-run.
- **Where F stopped:** F was converting the remaining outlines in five files to fills, 4 pt gaps and 3 pt lips. Re-check those on resume.

## 2026-11-25: fix-without-council mode (owner decision)
Councils are paused because they cost too much. Builders fix every remaining family against scratchpad/selfcheck/README.md, the 11-item Learning & Simplicity and Visual/Brand/Motion checklist. Each family has a pack, selfcheck/<NN>-<family>.json, built from the round-7 simplicity audit and the revote-1 blockers. Builders verify with K's checker plus their own sheets, write selfcheck/<NN>-done.md, and continue with no council waits.

| Builder | Order |
|---|---|
| E | 11 → 14 → 12 → 01 → 15 → 08 |
| F | 04 → 06 → 03 → 05 → 07 |
| Q | 16 → 13 |

The integrator does the place-value XL choices, then a shared outline sweep. The coordinator spot-checks the settled frames.
- **2026-11-25: Claude design lead** (Sonnet 5.5, medium effort), thread `…delegate-task%3A2ab3d76d-f917-4a8b-bcfa-fd3c80de50b4`, writes binding one-page specs at scratchpad/design/specs/<NN>.md, in the order 14, 16, 03, 13, 12, 05, 01, 07, 15, 08. The inputs are cheap compact boards, design/boards/<NN>.jpg (entry, mid and settled frames per variant). ChatGPT builders implement the specs. Owner asked for more Claude design work at minimum cost.
- **2026-11-25: all five GPT threads hit an HTTP 400**, most likely because their contexts were too long. Each was restarted with `freshContext: true` and a self-contained brief: role, simulator, files to read, and queue. State lives in work/friendly-*/report.md and selfcheck/<NN>-done.md. Prefer fresh contexts going forward; they're cheaper too.
- **Done (self-check):** 11 money, 16 text MC (pending ModelStage and number-line sizing) and 04 strips. 06 place value is done except the wrong-grouping proof, which is with the integrator.
- **Integrator queue:** ModelStage, then the 06 grouping, then the 03 two-mask contract.
- **Coordinator fix:** I added Quantity to the theme mock in scripts/check-puzzle-drag.mjs; test:game exits 0.
- **2026-11-25:** PAUSED by the owner. Coordinator grades are in scratchpad/selfcheck/grades-2026-11-25.md. The resume queue is the integrator's generic `submitted` change, the open items in each <NN>-done.md, and families 01, 15 and 08.
- **Resume note (E, family 15):** at XL, pattern_next tiles truncate two-digit terms to "6.." on both verdicts. PatternProof uses fixed PATTERN_TILE widths, and Num disables FaceText's font fitting (OperationsReveal.tsx). Evidence: work/friendly-I/selfcheck-shared/checked-header-xl/15-tile-detail.png. The shared XL header passed 32/32.
- **Resume notes:** 06 place value is ready (XL clears the dock by 100–144 pt). For K: count the `decimal-tenths-board` Adjustable as an input. test:game is still blocked by the old equivalent-fraction assertion in check-answer-feedback.mjs:88; F should update it to the one-bar design.
- **2026-11-25 cleanup:** cancelled ~190 stale queued messages across E, F, I and Q; all queues are now empty. Lesson: thread_send in queue mode piles up while an agent is busy, and each item later fires a paid turn. On resume, send ONE fresh-context brief per agent and avoid queue mode.
- **2026-11-25 wave 2 started:** assignments are in scratchpad/selfcheck/wave2.md. A new Claude builder (Sonnet 5.5, high), thread `…delegate-task%3A747f0e77-68d5-4285-9340-01ce4ce8ab78` on simulator main, owns 01, 15 and 08. The integrator uses B only. All GPT agents were restarted with fresh context. After the wave: stop, then the coordinator grades from the boards.
- **Wave 2 done (2026-11-25):** all agents stopped. Grades are in scratchpad/selfcheck/grades-wave2.md. Next-wave candidates: the 9 thin-bar lint hits; small pieces in money, bars and patterns; the thin fraction line (04) and the line in 16; operations' true_false and operation_path lines; grid misses scrolling the question off; 08 XL clipping.
- **2026-11-25 wave 3 started:** the plan is scratchpad/design/wave3.md, by the Claude design lead (Sonnet, medium), plus coordinator overrides that keep the 03 one-bar design, the 05 percent bar and the 13 layered box, and skip the dock merge. Five builders are running: I on B, F on D, E on E, Q on C, the Claude builder on main. The owner's bow complaint (a static piece that looked draggable) is Q's top priority; the kit-side static and IdleHint guard belong to I.
- **Wave 3 restart:** the old GPT threads for I, F and E returned HTTP 400 even with a fresh context, so I replaced them with NEW threads at medium effort: I `…delegate-task%3Ab7fe38e4…`, F `…%3Ac322a9f2…`, E `…%3A2368d20d…`. Boards are now also split into board-part<N>.jpg (≤1100 px); GPT agents must never open board.jpg.
- **Wave 3 done (2026-11-25):** grades are in scratchpad/selfcheck/grades-wave3.md. Not landed: 14 true_false/operation_path bands, the 12 mini-grid on misses, the 04 fraction line, 08 XL clipping (needs the integrator's height cap), the 01 function_machine settle.
- **2026-11-26 wave 4 started:** the plan is scratchpad/design/wave4.md, written by the coordinator (Claude) as the designer. Fresh delegate threads: CB-A (Sonnet) on main for 14 true_false/operation_path and 01; CB-B (Sonnet) on C for 08; F (Astra medium) on D for the 04 fraction line; E (Astra medium) on E for 12 same-size misses and 11 shop picture on misses. The coordinator cut the Play "Not quite…" title so a miss shows one hint line. I and Q are idle.
- **2026-11-26:** the owner rejected the money layouts as cluttered and disorganised. Money moved from E to a new Claude builder, CB-M (Sonnet, simulator B), working to the layout grammar in scratchpad/design/11-money-wave4.md. Play now has `sameModelMiss` (grids and 4 money misses: fixed stage and origin, no hint row).
- **Wave 4 done (2026-11-26):** grades are in scratchpad/selfcheck/grades-wave4.md. Play gained `sameModelMiss` (grids, money ×5, true_false, operation_path, bars): the entry stage, scroll offset and question are kept, and the hint row is hidden. equation_board got one Reset back, shown only after the first move.
- **2026-11-26 wave 5 started:** the plan is scratchpad/design/wave5.md. CB-bars (Sonnet, C) owns 08; CB-balance (Sonnet, main) owns 01; E (Astra medium, E) owns the 12 MC grids; F (Astra medium, D) owns 05; Q (Astra medium, B) owns 16. sameModelMiss now also covers function_machine and equation_board.
- **Wave 5 done (2026-11-26):** grades are in scratchpad/selfcheck/grades-wave5.md. sameModelMiss now also covers storyModel, decimal_grid, decimal_place_value and percent amounts. GPT HTTP 400s were avoided by telling builders not to load skills and to keep tool output short.
- **2026-11-26 wave 6 started:** the plan is scratchpad/design/wave6.md, built from fresh boards of 13, 15, 03, 06 and 14. CB-A (Sonnet, main) owns 15; CB-B (Sonnet, C) owns small fixes in 01, 16, 08 and 11; F (Astra, D) owns 05, 06 and 03; Q (Astra, B) owns 13 and 14 ratio. sameModelMiss now also covers geometry, shapes and solid, the fraction tasks, fraction MC and the pattern tasks.
- **Wave 6 done (2026-11-26):** grades are in scratchpad/selfcheck/grades-wave6.md. GPT builders crashed with HTTP 400 at startup when asked to read wave6.md and README; an INLINE short brief (items written in the task, no file reading) worked on retry. Use inline briefs for GPT.
- **2026-11-26 wave 7 started:** the plan is scratchpad/design/wave7.md. CB-play (Sonnet, main) gives app/play.tsx an XL question collapse after Check. G (Astra, inline brief, C) owns 15 sort miss, the 03 halves entry and the 01 equation_board tiles. Fresh boards for 04 and 07 are on simulators B and D, for grading.
- **Wave 7 done (2026-11-26):** grades are in scratchpad/selfcheck/grades-wave7.md. At XL after Check, the question collapses to one 44 pt row with a book icon (CB-play). sameModelMiss now also covers fraction_strip, fraction_number_line, number_line, signed_line and estimate. The EquationBoardModel horizontal-scroll fallback became scale-to-fit.
- **Wave 8 (2026-11-26):**
  - Owner fixes: no floating "+" on the stacked equation board; money totals are a full-width band; the budget remainder cards use the goods-card grammar.
  - 04: big strips and the 1/2 reference strip. 06: solid amber misses and soft supply cards. 08: bars_missing fits at XL. 13: solid perimeter rectangles. 12: axis numbers in every state. 05: the mats fill the width.
- **Wave 9 (2026-11-26):**
  - Owner fixes: equal ratio bottle groups on one baseline; padded number tiles.
  - Play: no stage jump for place value and decimals; the signed_line question stays put.
  - 13: perimeter unroll tape. 14: identical tiles before and after Check. Number lines: thick arcs and rails. 04: equivalent cells slide under the 1/2 part.
- **Wave 10 (2026-11-26):**
  - 08: the last thin lines become soft bands.
  - 01: the balance rows on a wide tray, and the miss keeps its model.
  - 12: chunky path bands; the route_grid has no connectors.
  - 07/14: carried fixes. 03: the twentieths are grouped by fifths.
- Wave 11 (2026-11-26): big numbers (digits on pieces ≥24 pt, primary 28 pt), route grid as solid walked cells, money sale band exact width, equal percent gaps, pattern rows at one y, sort strips centred. Grades in the session scratchpad grades-wave11.md.
- Wave 12 (2026-11-26): big numbers in shapes, number lines, operation rows, fractions and decimal mats; op misses keep the entry stage.
- Wave 13 (2026-11-27): the bars have 14 pt bands with lane chips, 20 pt labels and an honest total miss; the choice grids are bigger and fit above the miss dock; the equation-board proof uses the entry scale; the mats fill the stage height; fraction amber is bright; judge prompts keep the entry question. Every family is at L&S ≥ 96; Vis ≥ 96 except decimals and text MC (95).
- Wave 14 (2026-11-27): small-difference grammar (44 pt amber segment, label inside, no chip) on the percent and difference bars; the 0.8 miss shows the missing tenths in soft amber; signed-line miss dot on the rail; target_build and missing_perimeter keep their size through Check. All 16 families are at ≥ 96 on L&S and Vis.
- Style guide polished (2026-11-27): docs/PUZZLE_STYLE_GUIDE.md rewritten from the owner rules and waves 1–14, with a review checklist and a device checklist. The amber small-difference minimum is aligned to the owner's 56 pt.
