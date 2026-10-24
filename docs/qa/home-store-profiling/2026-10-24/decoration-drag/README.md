# Decoration dragging, 24 October 2026

Two sources of drag work were removed:

- PetStage now reuses stationary furniture JSX and saved anchors, updating only the selected target's preview position. Editing targets no longer build unused context menus or depend on the changing selected-item menu factory. Options remain in the selected-item dock.
- The placement overlay caches the selected model's footprint and structural Skia paths, translating their drawing groups during movement. Rotation, scale, model, collidability, and viewport changes rebuild the geometry. The original-position outline is cached separately. Blockers, boundaries, status labels, and release validation still use current feedback.

Placement utility changes only narrow input types to the fields the geometry routines already read. Collision rules, save/drop logic, native drag capture, room navigation, transitions, and activity scheduling remain unchanged.

## Simulator verification

Used the existing iOS 27 Furniture Smoothness QA simulator and Expo development build with React Compiler. The initial trace records a short bed drag rejected by exit validation and its cancellation. The final trace records an out-of-bounds bed drag, a second movement of the pending preview, and cancellation.

| Observed operation | Stage inclusive render | Furniture target renders | Native scene renders |
| --- | ---: | ---: | ---: |
| Initial source: first drag/rejection | 51.78 ms | 16 | 0 |
| Initial source: cancel | 27.60 ms | 16 | 0 |
| Final source: first preview/rejection | 36.63 ms | 1 | 0 |
| Final source: move existing preview | 11.94 ms | 1 | 0 |
| Final source: cancel | 12.18 ms | 1 | 0 |

The first preview still mounts its diagnostics and takes longer than a frame. The tests establish zero stationary-target renders across repeated moves; the simulator confirms the selected target remains live and accurately aligned. Out-of-bounds placement stayed disabled, red room boundaries and the bed outline remained correctly positioned, and Cancel removed the preview.

These are short development traces, not a controlled speedup percentage. The initial room was zoomed in; reload restored default zoom. Additional live interaction changed the bed's saved position between captures. That later layout was retained. Initial Fast Refresh captures still contained the previous callback dependencies and were excluded; final evidence followed a full reload and dependency inspection.

No navigation actions or purchases were performed. The app was left in decoration mode with the bed selected, no pending preview, and 42 coins. Profiling wrappers were restored and temporary debugger globals removed.

## Regression validation

Four added cases run with React Compiler on and off:

- Real PetStage: drag start, twelve preview updates, invalid drop, and cancellation do not rerender stationary furniture or native scenes. The selected target follows movement, previews do not save layouts, cancellation restores its saved anchor, and selecting another object updates both selections. The two cache assertions fail on the original stage source.
- Real placement overlay with a Skia boundary: footprint and structural path identities survive translation. Every footprint vertex and a structural vertex match the existing projection math, including elevation changes. Rotation, scale, and model changes invalidate paths.

Full backend suite: **151 tests pass**. Typecheck, targeted ESLint, room-editing checks, room-transition checks, and cat task-chain checks pass. `git diff --check` passes. Room-navigation files and handlers were left untouched.

## Evidence

- [Commit summary](summary.json)
- Raw React traces: [before](before-react.json.gz), [after](after-react.json.gz)
- [Capture setup](start-react-capture.js) and [source hashes](source-sha256.txt)

See the [original report](../README.md) for the simulator debugger connection procedure.
