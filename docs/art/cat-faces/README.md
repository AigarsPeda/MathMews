# Cat facial rig

The existing dumpling cat now has six tapered whiskers, a closed content smile, happy crescent eyelids, and relaxed sleeping eyelids. The existing open mouth, tongue, eyebrows, frown, tears, and glossy eyes remain part of the rig.

Expressions use the existing animation states and timings:

| State | Face |
| --- | --- |
| Idle / walking / resting | Glossy eyes and a small closed smile; natural blinks |
| Correct / dance / petting | Crescent eyes and a broad open smile |
| Waiting | One raised brow and a curious head tilt |
| Surprised | Wider eyes, raised brows, and a small O mouth |
| Incorrect | Brief gentle frown and concerned brows, then a content face for retry |
| Sleep / curled sleep | Relaxed closed eyelids, hidden catchlights, small content smile |
| Eating / play | Mouth motion follows munches and activity beats |

The whisker fans are parented to the head and follow its movement, rotation, and scale. Happy expressions lift them slightly; disappointment lowers them. Both eyelid sets, the smile, and both fans are included in `animated_parts` so their transforms are baked into the editable clips. All three coats share this geometry. Body motion, coats, camera framing, and runtime clip timings are preserved.

Gameplay pages use WebP quality 83 with alpha quality 100 to accommodate the plush coat and facial detail within the existing 120 MiB compressed texture budget. Page dimensions and decoded memory limits remain unchanged. See `../cat-coat` for the shared surface treatment.

The rebuilt collection contains 105 cat clips across three coats. Its 1,584 cat/toy pages measure 112.35 MiB compressed, with a maximum decoded page size of 9 MiB. Happy petting, neutral recovery, and curled sleep were also checked in the native iPhone app.

`review.png` shows eight representative poses. `source/facial-expressions.blend` contains named review scenes. Production motion scenes are rebuilt by the existing renderer in the configured Blender asset library (by default `../BrainPet-blender-assest`).

## Rebuild and verify

```sh
blender --background --python-exit-code 1 --python scripts/3d/render_cat_faces.py
node scripts/3d/review-cat-faces.mjs
blender --background --python-exit-code 1 --python scripts/3d/render_assets.py -- --only cat --refresh
node scripts/3d/pack.mjs
blender --background --python-exit-code 1 --python scripts/3d/check-cat-faces.py -- --baked
blender --background --python-exit-code 1 --python scripts/3d/check-cat-care-actions.py -- --baked
blender --background --python-exit-code 1 --python scripts/3d/check-cat-play.py
node scripts/3d/verify.mjs
npm run test:game
```

The face check covers six head-attached whiskers, actual tapered-curve framing through all 35 pose families, distinct expression visibility, encouraging wrong-answer recovery, and facial control keyframes. With `--baked`, it also inspects expression peaks in the saved production clips. The existing care/play checks protect animation joins and synchronized props.
