# Tasks for the next AI agent

Use one prompt per run. Attach the whole folder or point the agent to it. The plan and manifest are authoritative. Do not paste only the concept PNG and expect the agent to infer timing, scope, or integration requirements.

## First run

Read `START_HERE.md`, `asset-plan.json`, and `concepts/character-lineup.png` in this folder. Implement Batch 1 only. Produce original layered flat SVG masters and model sheets for Cat and Boba, plus a local preview at normal and 96 px character sizes. Preserve the identity features, exact palettes, three-quarter orientation, named layers, and source dimensions. Use real editable vector groups. The concept image is a visual proposal; remove its shading and do not embed the raster inside an SVG. Include front, three-quarter, side, silhouette, and the six specified face states on each sheet. Write each rig's group hierarchy and pivots as metadata. Do not produce animation, new characters, or app changes in this run. Check the outputs visually and report exact paths, any unresolved mismatch, and the next batch. Store generated assets in a new `production/` subfolder; leave the plan and original references intact.

## Second run

Use the Batch 1 Cat and Boba SVG masters without redrawing their geometry. Implement Batch 2 from `START_HERE.md`. Create `greet`, `acknowledge`, and `celebrate` for each character with deterministic keyframe transforms and face-state changes. Deliver the exact six atlases, six final stills, 64 PNG frames, source timelines, and a replayable preview described in the plan. Check every frame for clipping and attachment/contact errors, and check full-size and 320 px scene-width playback. Do not integrate with the app or change other characters. If source geometry must change, explain the change and regenerate all affected pilot outputs consistently.

## Third run

Implement Batch 3 only: the Boba picnic story kit. Reuse the two pilot rigs and useful poses from their animation library; author new deterministic choreography for the prop interactions. The scene action labels are feedback categories, not instructions to replay generic clips unchanged. Build the basket, blanket, and single lunch bundle as separate vector objects. Follow all four states and the three transition descriptions in `START_HERE.md`; do not introduce a balloon, tree rescue, numbers, or baked text. Export four checkpoint stills, three atlases, 32 frame PNGs, editable scene/timeline source, and a preview showing every state and transition. Verify that each transition's final frame matches its destination state. Do not rename existing levels or edit app code.

## Native integration run

Read the current repository instructions and working-tree status. Implement Batch 4 for one selected boss only, preserving unrelated edits, IDs, saved checkpoints, rewards, lives, and existing 3D home behavior. Inspect `app/play.tsx`, `ResultOverlay.tsx`, `BossStoryScene.tsx`, the asset registry and story generator before editing. The active puzzle must have no decorative story illustration. Reuse the existing result flow with one focal scene, immediate Continue, an accessible text equivalent, Reduce Motion stills, background handling, and a safe missing-media fallback. Update the selected mission's title/stage copy coherently in both English and Latvian if the picnic kit is adopted. Do not bulk replace all bosses. Verify the selected boss through start, mistake, success, next stage, final completion, resume, replay, early Continue, and repeated taps. Report native checks separately from static checks. Run the repository checks relevant to the changed files. Do not claim device performance from a browser preview.

## Expansion run

Implement only the requested part of Batch 5. Add Alder and Ada using their written definitions and the shared style. Reuse the same source/export conventions. Then create the footbridge and reading-nook kits if requested. Generate cat coat derivatives from tokens before a production release. Do not expand to the existing nine species or the full lesson catalog without a separate task.

## When tooling is missing

Inspect the tools installed in the execution environment. Prefer a deterministic SVG rasterizer and the existing image packer when available. Do not claim a generated PNG is a layered SVG, a preview is an animation file, or an MP4 is a transparent runtime atlas. If a required tool is unavailable, complete the independent source work, name the one missing capability, and explain the next executable step. Do not introduce a paid tool, service, or new native animation engine as an unannounced substitute.

## Result format for every run

State the completed batch, list the delivered paths, report the checks actually run, and identify remaining work. Save a short `production/STATUS.md` with the same information and the exact next prompt to use. Do not carry this chat's assumptions invisibly into the result.
