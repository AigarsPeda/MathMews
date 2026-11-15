# Feline model references

The current connected cat skin uses the user's standing and seated cat photos to guide the neck-to-shoulder line, ribcage, waist, croup and tucked seated hips. The face remains stylized. Front elbows bend backward; rear knees bend forward and hocks turn back toward the heel.

Blender's [Rigify paw documentation](https://docs.blender.org/manual/ru/4.5/addons/rigging/rigify/rig_types/limbs.html) describes separate front and rear paw chains and informed the joint structure. Shared procedural pose controls remain the animation source.

Two external starting models were considered: [squibblejack's rigged cat](https://blendswap.com/blend/23047) and [LazyGraph's rigged feline base mesh](https://blendswap.com/blend/27158). Their authors list them under CC0. Neither model was downloaded or imported.

The app now uses native Filament geometry and Bullet toy collisions. Thumbnail ground-contact measurements still preserve the original saved-placement projection; live cat/furniture contact and object depth come from the 3D world. The earlier sprite depth and separate toy-texture approach has been removed. See [current model and engine notes](../native-room-engine.md) and [DESIGN.md](../../DESIGN.md). Superseded cat review images have been removed; use current exported assets or generate fresh diagnostic renders.

## Cartoon restyle, 15 November 2026

The earlier skin was reviewed from a turnaround and every clip family and scored about 40/100: a flat-bottomed helmet head with a slab face, hard three-colour blocks, long thin legs with paws no wider than the leg, a stiff antenna tail and paper-thin ears. The skeleton, clip list and runtime were sound, so the restyle keeps every bone name and rest position and changes the surface, coat, face and the poses that fold a limb tightly.

### What the references say

| Source | Finding | Applied as |
| --- | --- | --- |
| [Micah Breitweiser, Little Kitty, Big City](https://www.gamedeveloper.com/art/deep-dive-how-little-kitty-big-city-rejects-realism-to-achieve-authenticity) | A minimal rig ("just a mesh, a skeleton, and some foot IK"), one fluid line from nose to tail, ears that lead a look, and four clear expressions made the cat read as more cat, not less. | One fused plush surface, a tail that moves as a travelling wave, and a face limited to a few readable states. |
| [Cathy Feraday Miller, Animating Four-Legged Beasts](https://www.gamedeveloper.com/art/animating-four-legged-beasts) | Chest and hips are two offset bouncing balls, the head a third; tails and toes come last; flat tangents and linear paths read as mechanical. | Kept the runtime's offset chest/hip motion; added eased holds to the idle head instead of a sine sway. |
| [Disney Research, Designing Animated Characters for Children of Different Ages](https://la.disneyresearch.com/wp-content/uploads/Designing-Animated-Characters-for-Children-of-Different-Ages-Paper.pdf) and the baby-schema literature summarised in [NYU ITP Adjacent, "It's So Cute"](https://itp.nyu.edu/adjacent/issue-7/its-so-cute/) | Large head, large low eyes, plump cheeks, small nose and chin drive perceived cuteness. Lorenz's list is a design heuristic, not settled science. | Cheeked "mochi" head about half the standing height, large glossy eyes set low and wide, small pink nose, soft blush. |
| [Ira Marcks, Silhouette and Shape](https://www.skillshare.com/en/classes/silhouette-and-shape-drawing-cartoon-cats-in-procreate/438863712) | Rounded forms and a clear silhouette carry a cartoon cat. | Rounded ear tips, chunky legs, mitten paws, thicker tail. |
| [Lester Banks, tail overlap](https://lesterbanks.com/2017/12/tips-animating-tail-using-overlap/) | The base leads and each joint peaks a little later. | `tail_wave` in `game_cat.py`: per-joint pitch and sway with a growing phase lag, looping exactly. |
| [MoCap Online, idle animation](https://mocaponline.com/blogs/mocap-news/idle-animation-loop) and [AnimSchool, idle layers](https://blog.animschool.edu/2024/06/14/breathing-life-into-idle-animations) | An idle without visible breathing reads as a statue; layer breath, weight shift and small secondary beats. | Two breaths per idle loop that lift and fill the chest, a weight shift before the paw lift, two held head tilts. |

These are references for principles. No mesh, rig, texture or clip was imported, and no numerical match to another production is claimed.

### Decisions

- **Surface.** `original_cat.py` fuses a round head with cheeks and a small muzzle, a bean torso with a deeper chest and round rump, chunky legs, mitten paws with three toes, thicker ears and a plush tail. The inner ear is painted on the ear's front face; the old separate insert floated in front of the shell.
- **Coat.** `coat_pixels` paints one symmetrical design for all three coats: cream muzzle, blaze, bib, belly and mittens; three forehead strokes, three saddle bands, tail rings and a darker tail tip; blush, toe lines and collar.
- **Face.** `add_face` projects every feature onto the fused head, so it follows the cheeks. Stroke bones sit on their own stroke, so a brow tilts in place. A smiling crescent replaces the eye instead of drawing over a slit, and the same crescent turned over is the sleeping eye.
- **Skin weights.** The hip and knee blend bands no longer overlap, and the body's weights are relaxed over neighbouring vertices. The skull, ears and soles keep their authored weights.
- **Drawn-in limbs.** A limb as thick as it is long cannot fold tightly: the upper segment shears into a fin and the joint pinches. `limb_pose(..., soft=)` keeps a gentle bend down to a share of full reach and then scales the upper and lower segments uniformly toward the body, leaving the paw unscaled where it belongs. It is used for the seated hind legs, the three resting poses, the jump tuck, the crawl and the box clips. Uniform scale keeps every child transform an exact translation, rotation and scale. The runtime's contact IK measures segment lengths from the live joints, so it follows.
- **Resting tail.** The tail is posed by forward kinematics along one open arc, each joint adding the smallest turn to the one before it and blended joint by joint. Posing joints independently stretched the tube and wrung it into links, and blending whole orientations flipped sides once the tip had turned half way round.
