# Editable original game cat

`cat-orange.blend` contains the original cartoon cat, its connected skin and 36 animation clips. It opens in standing idle. Choose the `sit` NLA track for sofa sitting.

`scripts/3d/original_cat.py` constructs the sealed body, rounded head and paws, short neck, triangular ears and hooked tail. It creates the anatomical rest skeleton and normalized skin weights in that same pose. `scripts/3d/game_cat.py` paints the coats, attaches expressions and collar, solves two-segment limb IK and bakes the existing game actions. No downloaded mesh or purchased assets are used.

Run `scripts/3d/export-native.py -- --cats` through Blender to refresh all three native GLBs and this orange rig. Grey/white editable intermediates stay under `/tmp`. Review the shipped GLB through `scripts/3d/review-native-cat.py`, since the native game loads GLB rather than the authoring file.

After editing proportions, rebind or regenerate weights and review standing, sitting, walking, sleep and jump poses. Shape changes and the rig must share a rest pose. The runtime moves the root and advances the walk by distance; the baked stance moves paws backward at the same rate. Furniture avoidance and tail collision correction remain part of the native world.
