# Puzzle objects

`puzzle-objects.blend` keeps editable Blender scenes for the counting objects in `assets/3d/puzzle-objects`.

Rebuild the complete set with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/3d/build-puzzle-objects.py
```

Use `-- --only ribbon-blue,ribbon-red` to rebuild the bows while preserving the other saved scenes and PNGs. Run `node scripts/check-puzzle-objects.mjs` afterward.

The ribbon is a tied fabric bow: two continuous folded bands, a rounded wrapped knot and two V-notched tails. It uses a front-facing orthographic camera so its silhouette stays recognizable at the 48-point puzzle-caption size and in smaller counting trays. Blue and pink-red versions share the same geometry. Inspect both against white, including at the displayed size; preserve the empty space between the tails.

Counting stars use an upright front-facing camera, a rounded five-point silhouette and a small upper-left highlight. Gold and coral share the same outline and framing. Their colors must stay distinct on white at 24-point counting size, with enough separation to count each star. Rebuild just these scenes with `-- --only star,star-red`.
