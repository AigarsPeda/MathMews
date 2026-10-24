# Home game-state updates, 24 October 2026

Ordinary care updates recreated callbacks passed through Home to all four room stages. PetStage then rebuilt furniture gesture trees, lamp menus, and native scene props despite unchanged furniture. Its menu builders also depended on the complete stats object when they only needed feeding eligibility.

The fix stabilizes per-room edit/reward callbacks and offset handlers, makes sleep completion consult the latest pet without changing identity on every stat update, and caches furniture, lamp controls, and cat layers using their actual inputs. Feeding eligibility changes, replacement callbacks, furniture edits, and editing previews still invalidate the appropriate work. Editing anchors remain live on every editing render.

## Running-app verification

Captured the existing iOS 27 BrainPet Furniture Smoothness QA simulator in its Expo development build with React Compiler. The fresh baseline reproduced the earlier 249 ms problem. After reloading the final source and allowing startup to settle, three ordinary care updates took approximately 28 ms each, an approximately 89% reduction in this observed development render duration.

| Per ordinary care update | Before | After |
| --- | ---: | ---: |
| HomeContent inclusive render | 251.78 / 250.13 ms | 27.91 / 28.28 / 28.43 ms |
| Four PetStages, combined inclusive time | 249.69 / 246.25 ms | 25.51 / 25.78 / 25.91 ms |
| NativeRoomScene render entries | 4 | 0 |
| RoomActionMenu render entries | 63–64 | 0 |
| PetStatsPanel render entries | 4 | 4 |

Baseline capture: 120 seconds; final capture: 191 seconds. Care commits are identified by changed stage stats without room entry, visibility, command, interaction, or furniture changes. Both full captures also contain room/command activity; their aggregate frame statistics are retained in the summary but are not a controlled before/after comparison. Parent/child inclusive durations overlap. Some reused draggable fibers retain duration entries even when their parent work is skipped, so these entries are not used to estimate avoided furniture renders; the reconciler regression tests assert those render counts directly.

Separate 30-second Hermes CPU captures have valid timestamps. Their windows cover different activity phases and are supporting evidence, not a CPU speedup benchmark. A warmup recording was discarded before the final CPU capture.

With both profilers stopped, a separate 15-second Home sample recorded 899 frame intervals, p95 16.73 ms, maximum 33.81 ms, and zero gaps over 100 ms. The running app remained usable and showed Living room, current stats, and 42 coins. No purchases, furniture edits, or room-navigation actions were performed by this profiling session. Profiling wrappers and temporary globals were removed afterward.

The remaining approximately 28 ms development render still exceeds a 16.7 ms frame budget. Larger commits remain during room/command changes, including a 228 ms commit in this trace. Navigation behavior was deliberately preserved. These observations do not establish release-device FPS or eliminate every stall.

## Regression checks and preservation

All **147 backend tests pass**. Ten added cases (five with React Compiler on and five off) execute real Home/PetStage/mood code with native/activity test boundaries. They verify stable room callbacks, zero native scene rerenders during care updates, cached furniture/cat/lamp nodes, feeding threshold invalidation, fresh command callbacks, furniture invalidation, current optimistic edit versions, and current-pet sleep eligibility. Eight performance assertions fail against the saved pre-change source.

Typecheck, targeted ESLint, world-clock checks, room-transition checks, and multi-room cat task-chain checks pass. The task-chain fixture now supplies the extracted menu builder's new availability boolean; its assertions are unchanged. `git diff --check` passes.

All 32 other tracked files already dirty at the start remain byte-for-byte unchanged. AST comparison also confirms unchanged Home visit/arrival/command/acceptance/Store handlers and PetStage scene-ready/command handlers. The diff against the start-of-task source changes only callback stability, input-derived menu eligibility, and render caches, leaving navigation, transitions, scene mounting, and activity scheduling intact.

## Evidence

- [Summary and per-commit changes](summary.json)
- React traces: [before](before-react.json.gz), [after](after-react.json.gz)
- Hermes CPU traces: [before](before.cpuprofile.gz), [after](after.cpuprofile.gz)
- [Idle frame sample](after-idle-frames.json)
- [React capture setup](start-react-capture.js), [frame setup](start-frame-capture.js), [summary generator](summarize.py), [source hashes](source-sha256.txt)

Debugger connection procedure: [original report](../README.md). Previous period-timer fix: [room-stage report](../room-stages/README.md).
