# Walking back and shoulders, 24 October 2026

Walking now alternates the height and forward travel of the shoulders with the forepaw cycle. The chest twists first and the pelvis follows later. Stronger middle-back flex and support compression connect those movements. The neck counter-rotates to retain the gaze, and leg IK retains the existing paw paths and sole orientations.

The old skin binding assigned the same 35% spine influence along the whole torso. This softened the bend into a nearly uniform offset. The revised Blender binding concentrates spine influence in the middle and gives the chest and pelvis more influence at the ends. All three coats and the editable orange Blender source were rebuilt. The rig and authored animation channels are unchanged.

## Visual review

- [Before and after close-up](walking-comparison.gif): previous implementation on the left, revised runtime and skin weights on the right. These are Blender renders of actual native actor matrices, with the camera following the root and heading. Playback is approximately real time.
- [Existing simulator recording](native-walking.gif): 16 seconds of floor investigation and return movement on the ordinary Home screen. This is a crop of the production native renderer at 12 FPS, played at real time.

The final orange model was reloaded in the existing BrainPet Puzzle QA iPhone 18 Pro simulator, using the existing Metro server on port 8081. Review covered walking in the bedroom, departure to the living room, investigation across the rug, and the walking approach to the sofa followed by its jump. No simulator or test screen was created. The overnight routine initially kept the cat in bed; the room command succeeded after its safe exit.

The shoulder alternation and back curve are clearer in motion, especially from behind. The short torso and large head still make the back less prominent at normal room scale than in the close-up.

## Validation

Passed `check-cat-spine`, `check-cat-turning`, `check-cat-landing-walk`, `check-cat-fluid-motion`, `check-cat-room-flow`, `check-cat-paw-contact`, `check-cat-motion-flow`, and `check-cat-jump-anatomy`. These checks use the actual actor and cover all three coats at 30/60/120 FPS where applicable. TypeScript, ESLint, native launch validation and whitespace checks passed.

The expanded spine check requires alternating shoulder loading and checks all three head rotation axes. [Metrics](metrics.json) compare the final torso overlay against disabled torso offsets, not against the previous implementation. At 60 FPS, walking retained the paw paths within 0.0000024 model units while the shoulder moved up to 0.080 model units.

Blender deformation checks passed five poses in each of 53 clips for all three coats, 795 samples. A separate check of 30 runtime walking poses found finite vertices and no stretched mesh edges. An asset comparison found all 20,988 skeletal animation channels unchanged across the three rebuilt coats.
