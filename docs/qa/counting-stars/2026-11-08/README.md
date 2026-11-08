# Counting stars

Rebuilt gold and coral stars in Blender with matching upright, rounded silhouettes, fuller centers, saturated colors and a short upper-left highlight. Both PNGs keep their transparent 256 × 256 bounds, so counting layouts and animation positions are unchanged.

Source: `scripts/3d/build-puzzle-objects.py`, saved scenes in `prototypes/puzzle-objects/puzzle-objects.blend`.

Regenerate with Blender using `-- --only star,star-red`. `node scripts/check-puzzle-objects.mjs` passed for all 221 illustrated puzzles and nine renders, including exact counts, non-overlapping positions and equal object sizes.

- Gold: [before](before-gold.png), [after](after-gold.png).
- Coral: [before](before-coral.png), [after](after-coral.png).

[Native iPhone 15 preview](iphone-15.png): production `PlaySession` for `v2-easy-subtraction-take-4`, with six gold and two coral stars. Verified their silhouette and highlight at actual counting size against the white board.
