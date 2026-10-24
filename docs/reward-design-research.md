# Reward design research, 24 October 2026

The brief is to make earned achievement films worth watching again and sharing. The chosen humor is playful visual comedy, with one deadpan, meme-like exception. This research informs a design direction; it does not establish that children will prefer the result. That needs observation with children.

## What the references actually do

| Primary source | Observation | Applied here |
| --- | --- | --- |
| [Team Asobi on Astro Bot](https://blog.playstation.com/2024/08/30/meet-astro-bots-new-monkey-friend-and-go-behind-the-scenes-with-team-asobi/) and the [official game's VIP section](https://www.playstation.com/en-us/games/astro-bot/) | Rescued characters perform funny moments, and their associated collectible items unlock special actions. | The reward is a particular character doing something memorable with a physical prop. A generic explosion of stars cannot carry the scene. |
| [Nintendo's Mario Wonder animation interview](https://www.nintendo.com/au/news-and-articles/ask-the-developer-vol-11-super-mario-bros-wonder-chapter-2/) | The developers increased expressive animation and adjusted face and body orientation so both movement direction and expressions remain legible. | Use the actual game cat, bring the camera closer, face the reaction toward the viewer, articulate the jump, and hold the expression. |
| [HAL Laboratory's Kirby and the Forgotten Land interview](https://www.nintendo.com/au/news-and-articles/ask-the-developer-vol-4-kirby-and-the-forgotten-land/) | The collectible figures include descriptions that add information about characters and the world. | Each film has a specific title and a story. Its world has a small collectible stage. The poster preserves the ending as a keepsake. |

These are design interpretations, not evidence that a particular camera scale, duration or joke will increase retention. We borrow the principles and create original cat scenes. There are no licensed characters or copied assets. Completion remains deterministic; the reference games' random collection systems are not part of this change.

## Diagnosis of the previous pass

The machinery and platforms occupied most of the image. The expressive game cat stood at the side. Many moving parts were too small to read on a phone, and the stories depended on growing a prop. Ten gags were repeated through 18 settings. Bigger cards exposed these limitations more clearly.

The replacement makes the cat the actor. The camera is lower and closer. Separate anticipation, action, and reaction beats give the viewer time to follow the cause and effect. A stable camera, restrained scenery and a longer final hold keep the performance legible. Six-second films are assembled from 48 poses, with 80 ms moving frames. The setup holds for 500 ms and the final reaction for 1,820 ms.

## Review criteria

- The setup and ending must be different and intelligible with the caption hidden.
- The face must remain visible during the final reaction at a 320-point screen width.
- The prop must follow a continuous path. No teleporting onto the cat.
- Feet stay on or inside the intended support. No legs through a box or trophy.
- Jump anticipation, airborne tuck, contact and settling must read as separate phases.
- Adjacent films should offer different actions and endings.
- Playback, pause, replay, Reduce Motion and sharing use the same final assets.

## Iteration notes

The first close-up review caught paws below the box floor and a clock bell that snapped into place. The revised box uses a raised, smaller sitting pose. The bell follows an arc to the cat's head. Jump scenes now use the existing articulated hop animation instead of moving a rigid standing pose. The trophy has a hollow interior and contains the seated cat.

A second story review found too many objects landing on heads. The fish now lands in the raised paw; the cat rides the duck; the sunflower loses its petals in a sneeze. The clock retains the hat gag and the sole deadpan reaction. Expression controls use the original face bones for widened eyes, an open mouth, happy eyelids and a flat stare.

Ten films are still reused across 18 world stages. This is an honest limit of this implementation, not a claim of 180 unique plots. The actor and stage are rendered separately with one camera, so future acting improvements can reach the collection without rebuilding the learning scenes.


## Follow-up: contact is part of the performance

User screenshots disproved the earlier visual sign-off: the scarf crossed the front legs, and the fish crossed the face. The previous 480-frame check measured framing, not physics. The implementation now includes a separate evaluated-mesh contact check and explicit support checks.

All ten films were revisited. Root positioning now survives pose sampling; grips use paw targets; container jumps clear their rims without scaling the cat; yarn is laid around the body with room for the tail. The fish catches below the face on both paws. The duck has a real open seat. The balloon starts clear of the ear and keeps a taut hand attachment. The clock rocks at floor level, and its bell settles on the measured crown. The watering can follows the paw, visible pollen motivates the sneeze, and falling petals settle flat. The disco star is held outside the cheek. Raised background props became flush ceramic inlays.

The final review must distinguish three questions: does the geometry avoid visible intersections, does the movement communicate cause and effect, and do children enjoy it? The first can be regression-tested, the second needs visual review, and the third remains a playtesting question.

Native inspection caught a separate playback problem: Pause reloaded the GIF at its first frame. The corrected viewer keeps native autoplay configuration stable and controls playback imperatively. The new native regression compares the movie pixels before and after pausing a held ending.
