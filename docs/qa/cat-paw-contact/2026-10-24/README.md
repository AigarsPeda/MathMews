# Paw contact review

The refinement changes the runtime reach and physical contact, using the existing cat rigs and room. No model export or new simulator was needed.

The original floor-toy logic could kick a ball from body proximity. The navigation-sized physics collider could also push it before a paw arrived. The revised collider covers the torso, and a swept paw contact supplies the impulse. Reaches ease toward the object's near surface, preserve the wrist curl and withdraw without chasing the moving object.

Native review exposed an additional grazing-contact failure in the saved living room. The paw arrived exactly at the collision boundary with nearly zero velocity, leaving the ball still. A small contact margin now registers the moving pad before the hold. `scripts/fixtures/paw-contact-room.json` reproduces that room without changing the simulator's saved layout.

Automated validation passed:

- `check-cat-paw-contact.mjs`: 27 full-rig comparisons across three coats and 30/60/120 FPS, plus nine saved-room cases across three viewport heights and frame rates. Checks surface reach, wrist orientation, unchanged supporting paws, bounded speed, moving-target release, a detached final leaf, pause/resume and Reduce Motion.
- `check-native-room.mjs`: actual cat/object callbacks, close floor-ball approaches, one impulse per swat, no proximity-only or stationary kicks, hanging toys, plant leaves, rotation/scale and corner placement.
- `check-ball-physics.py`: Bullet torso clearance before a tap, ball rolls, wall/furniture rebounds and settling at three ball sizes and frame rates.
- Command-attention, command-motion and task-chain regressions, TypeScript, lint and whitespace checks.

`metrics.json` contains the 27 full-rig comparisons. Its distances and speeds use scene units. They measure bone pivots, not mesh-surface penetration or real anatomical motion.

The native plant command was also exercised in the saved room. The sofa and lamp obstruct its approach, so the game displayed its existing unreachable-item notice. Leaf contact and withdrawal were verified by the rig/object tests; the obstructed native layout is not evidence of a successful plant interaction.

Native simulator verification used the existing **BrainPet Puzzle QA** simulator and Metro server. Fast Refresh was off, so the app was explicitly reloaded before the final review. The original ball was against the floor boundary beside the rocking chair; real contacts registered there, but the boundary limited rolling. For a clearer test, the ball was moved onto open floor through the room editor, then its original placement was restored with Undo. No saved layout was replaced.

`ball-contact.gif` is a cropped, enlarged native recording at real timing (20 FPS), showing the approach settling, paw taps, withdrawal and ball movement. Temporary live geometry diagnostics confirmed contact-driven impulses and approximately 0.40 scene units of ball displacement across the open-floor sequence. Those diagnostics were removed after testing.

`hanging-contact.gif` records the scratch-post toy in the same simulator at real timing. The head and post partly obscure the front paws from this camera angle; the rig and callback tests provide the more precise contact checks.
