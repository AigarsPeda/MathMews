# Puzzle objects

`puzzle-objects.blend` keeps editable Blender scenes for the counting objects in `assets/3d/puzzle-objects`.

Rebuild the complete set with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/3d/build-puzzle-objects.py
```

Use `-- --only ribbon-blue,ribbon-red` to rebuild the bows while preserving the other saved scenes and PNGs. Run `node scripts/check-puzzle-objects.mjs` afterward.

The ribbon is a tied fabric bow: two softly textured felt loops with a darker inner fold, a rounded wrapped knot and two V-notched tails. It uses a front-facing orthographic camera so its silhouette stays recognizable at the 48-point puzzle-caption size and in smaller counting trays. Teal and raspberry versions share the same geometry. Inspect both against white, including at the displayed size; preserve the empty space between the tails.

Counting stars use an upright front-facing camera, a rounded five-point silhouette and a small upper-left highlight. Gold and coral share the same outline and framing. Their colors must stay distinct on white at 24-point counting size, with enough separation to count each star. Rebuild just these scenes with `-- --only star,star-red`.

The three counting paw scenes share a left-facing ivory mitten and the orange, grey or white foreleg of the selected cat. Rebuild all three with `-- --only paw-orange,paw-grey,paw-white`. Their transparent 3:1 framing keeps the toe at the same anchor during the side push and overhead pickup.
