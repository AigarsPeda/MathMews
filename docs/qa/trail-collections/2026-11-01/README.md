# Trail collection review

All sixty Blender scenes are implemented and assigned across eighteen difficulty/topic tracks. The [asset guide](../../../../prototypes/trail-collections/README.md) lists every model and the rebuild commands. [results.json](results.json) records verification and its limits.

| Difficulty | Twenty Blender renders | Full approved sheet beside renders | Native tracks |
| --- | --- | --- | --- |
| Easy | [Gallery](easy-blender.png) | [Comparison](easy-reference-and-blender.png) | [Six tracks](native-easy.png) |
| Medium | [Gallery](medium-blender.png) | [Comparison](medium-reference-and-blender.png) | [Six tracks](native-medium.png) |
| Hard | [Gallery](hard-blender.png) | [Comparison](hard-reference-and-blender.png) | [Six tracks](native-hard.png) |

[Three difficulty examples](tracks-preview.png) show the integrated props, soft shadows and dashed trail. [Narrow Latvian](native/blender-trail-320-lv.png) shows the current-level caption and surrounding decorations. The raw captures retain the Expo development gear and fixture controls.

The render comparison led to several revisions: real wool fibres, restrained cloth fuzz, an enclosed tangram silhouette, an interlocking cube without camera clipping, clearer glass, distinct sliding-puzzle symbols, a woven basket and a seamless Möbius surface. Each subject is modeled as editable geometry. They preserve the approved subjects and palette, while fine details, some proportions and lighting remain simplified relative to the concept artwork.

Passing checks: type checking, lint, puzzle experience regressions covering 1,800 authored puzzles, sixty unique alpha sprites, all twenty props placed per difficulty, 5,940 trail layouts, and the native eighteen-track tour with narrow Latvian, locking, finish and replay checks. The final Möbius revision also passed a focused Hard Fractions native check. Android and physical-device performance were not tested.
