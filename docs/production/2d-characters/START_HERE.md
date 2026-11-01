# Flat 2D characters and animation plan

31 October 2026. BrainPet repository, displayed product name Math Mews.

This is a production handoff for an AI agent. Build a small reusable cast for short scenes between math exercises. The user selected a simpler flat 2D style and explicitly removed decorative illustrations from active exercises. Produce one small, reviewable batch at a time.

The confirmed direction is flat 2D and scenes between exercises. The four designs, personalities, colors, story treatments, and production quantities below are proposals. The supplied board is concept art, not approved model sheets, separated layers, or usable animation frames. The Cat/Boba pilot was implemented on 1 November 2026. Read `production/STATUS.md` for delivered assets, integration and verification; Alder and Ada remain proposals.

## Start with these files

- `START_HERE.md`: the creative and production specification.
- `asset-plan.json`: exact IDs, palette tokens, clip lengths, dimensions, expected outputs, and proposed scene states. It is planning data, not a runtime asset registry.
- `AGENT_PROMPTS.md`: bounded tasks to paste into the next AI agent, starting with Phase 1 only.
- `concepts/character-lineup.png`: a proposed appearance reference for the four characters.
- `review.pdf`: a short visual review copy. This Markdown file and the manifest carry the detailed requirements.

Read this file, the manifest, and the board before producing art. When the board and written requirements differ, use the written requirements. In particular, remove the board's residual soft shading and use the exact flat palette tokens. Do not copy the board's labels, background, or expression-head arrangement into production characters.

## Goal and boundaries

The intended players are children roughly 6 to 12, with English and Latvian UI. The younger end must be able to understand the character action without reading dialogue. Use the product's warm, encouraging tone. A boss is a cooperative story milestone, not an enemy to hurt.

The active exercise contains navigation, one progress treatment, lives, the mathematical instruction and board, answers, help, and Check answer. No decorative character, scene thumbnail, idle loop, or expandable story panel appears while the child solves. Visuals needed for the mathematics, such as a balance or fraction pie, remain.

After a correct stage, combine the explanation and one short scene consequence on the existing result screen. After the final stage, give the completed mission a larger payoff. On a wrong answer, keep the math visible and provide specific retry guidance. Do not add a large sad performance. Continue is available without waiting for animation.

This scope changes only the puzzle interludes. Keep the existing 3D home, pet-care model, room furniture, app icons, economy, lives, puzzle IDs, saved progress, and achievement records. No speech, lip sync, new audio, new animation service, or new paid dependency is needed for the pilot. Use existing sound preferences if feedback sound is later connected.

## Cast and visual language

Use four recurring identities rather than generating a new protagonist for every level. Start production with the player cat and Boba. Alder and Ada are the next batch. The existing catalog already contains Boba the rabbit, Alder the beaver, and Ada the owl. Their personalities and new flat designs below are proposed additions.

All characters use clean closed shapes, solid fills, rounded charcoal outlines, and a small number of separable parts. No gradients, textures, 3D lighting, fur simulation, or frame-by-frame AI redraws. At a 512 by 512 character canvas, use a 5 px outer outline and 3 px interior marks, with round joins and caps. Keep small face details legible at a final character height of 96 px. Do not use color as the only identity cue.

Keep one default three-quarter pose facing the viewer's right. The same character can face left by a controlled rig transform. Do not mirror an entire rendered scene containing text. No text is burned into character or scene artwork. Character drawings occupy approximately x64 to x448 and y32 to y464 on their 512 square source canvas. The character's floor anchor is [256, 464]. Leave room for tails and ears during the entire clip.

For each character, make a 2048 by 2048 model sheet as SVG and PNG with front, default three-quarter, and side views, a silhouette, palette, and six face states: neutral, curious, pleased, proud, surprised, and reassuring. Reassuring means patient and kind, never pitying. These are design references, not six mandatory new animation clips.

### Player cat

ID `cat`. The on-screen name comes from the saved pet name. Minka is an example name in legacy stories, not text to place in an image.

Appearance: orange tabby with a broad cream blaze down the forehead, cream muzzle and chest, cream paws, triangular ears with pink interiors, a hooked striped tail, dark oval eyes, and a small gold collar tag. Preserve these recognizable features from the existing cat. The seated head is about 48 percent of the body silhouette height, excluding the tail. Keep four-legged cat anatomy. It may sit and lift a forepaw but must not walk like a person.

Personality: curious, persistent, and warm. The cat helps rather than judges. Its visual signature is a head tilt followed by a small forepaw movement; the tail finishes slightly later than the head.

Actions: greet with a small head lift and one paw wave; acknowledge with a nod and soft closed-eye smile; celebrate with a short whole-body lift and planted landing. Use a calm seated variant if the hop becomes unclear at small size. The cat looks at the object first, then the partner, then the player at the final hold.

Identity constraints: no human hands, shoes, new clothes, changing coat patterns, missing limbs, or collar tag that floats away. Orange is the pilot coat. Later grey and white coats must be token substitutions in the same source geometry, not new drawings. Compare those substitutions to the current game previews before shipping them.

### Boba the rabbit

ID `boba`. Existing name and species, proposed personality.

Appearance: cream pear-shaped body, long pink-inner ears with one gently bent tip, short rounded forepaws, broad back feet, a small round tail, dark oval eyes, and one simple teal cap. The cap sits between the ears and follows the head. The ears account for roughly a third of total standing height. No scarf or additional clothing.

Personality: eager, practical, and slightly impatient with objects, never with the child. Boba may prepare too quickly, notice a harmless wobble, then settle the object carefully. The ears communicate attention before the body moves.

Actions: greet with one ear perk and a small wave; acknowledge with a relieved exhale and ear settle; celebrate with one low two-foot hop followed by a deliberate landing. In story scenes, Boba holds or steadies the basket while the cat helps.

Identity constraints: cap shape, bent-ear side, and body proportions remain constant. No giant circular eye discs, disappearing cap, or ear crossing through the brim. Keep both feet visibly planted at the final hold.

### Alder the beaver

ID `alder`. Existing name and species, proposed personality.

Appearance: a wide low brown body, rounded-square head, two small front incisors, a dark flat paddle tail visible to one side, short sturdy legs, and a simple golden apron with one pocket. The tail has at most three broad cross marks in production, even though the concept board shows more. The tail is about half the torso width. Avoid extra tools in the neutral model.

Personality: methodical and quietly pleased when pieces fit. Alder checks once, makes a small adjustment, then trusts the result. The child is a collaborator, not an apprentice being inspected.

Actions: greet with a slow open-paw wave; acknowledge with one grounded nod and slight shoulder rise; celebrate with a satisfied two-paw lift and gentle tail settle. Story actions include supporting a deck piece and inviting the cat across a finished footbridge.

Identity constraints: no heavy stomp, damage gag, weapons, or tooth clacking. Preserve the broad silhouette and low center of mass. The apron should not deform into an extra limb.

### Ada the owl

ID `ada`. Existing name and species, proposed personality.

Appearance: muted lilac body, plum wings and small ear tufts, an angular pale face mask, almond-shaped eyes with small amber accents, three broad lower feather forms, and small dark feet. Make the eye and mask shape distinctly different from a round green owl. No glasses, clothing, or graduation cap.

Personality: observant, imaginative, and happily surprised by discoveries. Ada can turn a page the wrong way, notice, and correct it. Avoid the all-knowing teacher stereotype.

Actions: greet with a head tilt and wing opening; acknowledge with a brief glance at the result and a pleased blink; celebrate with a small wing flourish and tall proud pose. Story actions include aligning loose pages and sharing a restored book with the cat.

Identity constraints: no spinning head, threatening stare, full flight cycle, or resemblance to Duolingo's Duo. Keep the tuft, mask, and wing shapes stable. Ada's eyes must not appear angry in the neutral pose.

## Palette

The exact colors are in `asset-plan.json`. Use charcoal `#2D3436` for outlines. Use UI cream `#FFF5EB` only for previews and the app background; production artwork has transparent alpha. Limit each character to its listed solid colors. A face expression changes shapes, not the character's palette.

| Character | Main colors | Main identifying shapes |
| --- | --- | --- |
| Cat | Orange, darker orange, cream, pink, gold, charcoal | Triangle ears, cream blaze, hooked tail |
| Boba | Cream, pink, teal, charcoal | Long ears, bent tip, cap, large back feet |
| Alder | Brown, dark brown, cream, gold, charcoal | Broad torso, paddle tail, small incisors |
| Ada | Lilac, plum, pale cream, amber, charcoal | Ear tufts, angular mask, almond eyes, wings |

## Animation library

Create three logical clips per character. Each plays once and holds its final pose. A short blink may be included within a clip; do not add continuous idle animation to the result screen. The first batch is six clips for Cat and Boba. The later cast extension adds six for Alder and Ada, twelve logical character clips in total.

| Clip ID | Length | Pilot export | Purpose |
| --- | --- | --- | --- |
| `greet` | 1000 ms | 8 frames at 8 fps | Optional mission entry or a new character introduction |
| `acknowledge` | 1000 ms | 8 frames at 8 fps | A small stage success |
| `celebrate` | 2000 ms | 16 frames at 8 fps | Mission completion |

These are proposed BrainPet timings, not measurements of Duolingo. The pilot deliberately matches the existing eight-fps boss player. Author reusable key poses and interpolated transforms, optionally previewed at 24 fps, then sample the delivery frames. If the eight-fps result stutters, simplify travel and strengthen held poses first. A smoother runtime profile is a separate follow-up, not an implicit dependency change.

For a one-second clip: establish the pose at 0 ms; prepare during 125 to 250 ms; make the main gesture during 250 to 500 ms; settle during 500 to 750 ms; hold the clear final pose from 750 ms onward. For a two-second clip: establish and prepare through 375 ms; perform the main action through 1125 ms; settle through 1500 ms; hold from 1500 ms onward. Species-specific timing can move within these ranges while preserving total duration.

Use small anticipation, a readable main action, and a settled ending. Head turns should normally stay within 12 degrees; larger body hops need visible preparation and landing. Keep body squash/stretch within about 5 percent for this restrained style. The animation should remain understandable with sound off. Do not shake the screen, flash the whole frame, or cover the explanation with particles.

The last frame of a story clip must match its destination checkpoint still. Do not snap back to neutral at completion. Hiding or interrupting a clip must leave navigation usable and must not trigger another reward.

## Proposed story kits

Each kit has four still states, two one-second checkpoint clips, and one two-second ending. The image only communicates story progress; it does not provide hidden mathematical clues. Quantities, answers, names, and translated text stay in native UI. Characters and reusable props must be composed from the same source assets across all states.

Scene interactions need their own deterministic choreography. Reuse the character rigs and useful poses from the generic library, but do not try to make packing a basket by replaying a generic nod. The manifest's scene action labels describe the feedback category, not a mandatory source clip.

### Pilot kit Boba picnic

Proposed presentation ID `picnic-boba-2d`. Characters: Cat and Boba. Props: one basket with hinged lid and handle, one wrapped lunch bundle, one folded/unfolded blanket. A simple ground strip is allowed, but no scenic horizon or decorative forest is needed.

| State or clip | What is visible and what changes |
| --- | --- |
| `state-0` | Cat and Boba beside a closed empty basket and folded blanket. The lunch bundle rests beside the basket. |
| `reaction-1` | Boba opens the basket lid; Cat leans forward to look. End with the basket open and both actors settled. |
| `state-1` | Open basket, bundle still outside, folded blanket. |
| `reaction-2` | Cat slides the single bundle into the basket; Boba steadies the handle, then closes the lid. |
| `state-2` | Closed packed basket, folded blanket, no bundle outside. |
| `outcome` | Boba unfolds the blanket in one clear motion, places the closed basket beside it, and both characters settle into pleased seated poses. |
| `state-3` | Open blanket, packed basket, both characters pleased. The completed picnic remains visible. |

Do not show the current branch-rescue title or balloon-launch copy with this new picnic sequence. If this kit is adopted, the developer must update its title and all stage text together in English and Latvian, while preserving puzzle and save IDs. Asset production alone must not rewrite curriculum data. The pilot demonstrates presentation and does not silently replace the entire catalog.

### Later kit Alder footbridge

Proposed ID `bridge-alder-2d`. Characters: Cat and Alder. Props: a small stylized stream strip, bridge supports, one deck piece. State 0 has an unfinished crossing. Reaction 1 aligns the supports. Reaction 2 fits the deck. The ending lets the cat take a few short steps across while Alder waves. Every phase shows a safe, small crossing; there is no falling, panic, or punishment scene. Keep a stationary camera and show the completed bridge in state 3.

### Later kit Ada reading nook

Proposed ID `book-ada-2d`. Characters: Cat and Ada. Props: a book cover, one grouped stack of loose pages, a low reading stand. Reaction 1 aligns the stack, reaction 2 closes the cover around it, and the ending opens the book on the stand as Cat and Ada lean in. A simple nonverbal decorative picture may be visible on the page, but no words or numbers. State 3 holds the readable finished action.

## Asset construction and export

Prefer editable layered SVG sources plus a small deterministic animation description. The recipient is a coding AI agent; do not require access to a commercial animation editor. Generate concept art if useful, then rebuild approved shapes into stable named vector parts. Never ask an image model to redraw every animation frame independently, and never disguise a full-board raster embedded inside an SVG as editable vector art.

Character sources use a 512 by 512 viewBox. Scene composition uses a 1024 by 640 source canvas. Final frames use 512 by 320 RGBA PNG with transparent alpha, giving the existing 1.6 aspect ratio. Use the same camera, scale, floor anchor, and bounds for every frame of a clip and its checkpoint still. Keep a 24 px inset inside the final frame for every moving body part and prop. Set line weight in source coordinates so the final outer outline is about 2.5 px.

Required named groups: `root`, `tail` when applicable, `body`, `head`, `face`, separate left and right front limbs or wings, separate feet, ears when applicable, and accessories. Document each group's pivot in its own character file metadata. The rig hierarchy, pivots, and primitive shapes are implementation choices for Phase 1; they must be written down and held constant thereafter. Prop objects remain separate from the character rig.

Deliver eight-frame clips as four-column WebP atlases of 2048 by 640. Deliver sixteen-frame clips as four-column atlases of 2048 by 1280. Fill cells left to right, then top to bottom. Export PNG frames numbered from 00 and a separate final still. PNG frame sequences and SVG sources are authoring files; only selected WebP atlases and stills belong in the native runtime bundle.

Generic character clips are centered on a 512 by 320 frame for reuse by the current player; model-sheet exports remain square. Scene atlases contain the composed actors and props. Use sRGB, transparent margins, and clean antialiased edges. Inspect against both cream and charcoal previews to catch matte fringes. Keep text in native UI so English and Latvian use the same visual assets.

Treat 2 MiB of compressed shipping media for the orange-only pilot as a provisional budget. Report actual totals and any visual compromise before expanding. A 2048 by 1280 RGBA atlas is roughly 10 MiB decoded even when its WebP file is small. Load only the active clip, release it when hidden, and use the checkpoint still for Reduce Motion. Do not claim device performance until native profiling has run.

## App behavior and integration boundary

The art-production phases below do not edit application code. A later integration task may route a selected boss to the new kit. New assets should live beside the existing 3D exports so rollback is straightforward. The source builders must be updated alongside any generated registry changes; do not patch generated JSON and then let the generator undo it.

For that integration, use `assets/2d/bosses/{sceneId}/{coatId}/` for selected shipping scene media, with `state-0.png` through `state-3.png`, `reaction-1.webp`, `reaction-2.webp`, and `outcome.webp`. Start with `picnic-boba-2d/orange/`. Keep authoring sources in the package's `production/` directory. The integrating agent must select one current boss using the existing `picnic-balloon` scene, record its exact puzzle ID, and update its English and Latvian copy together. Do not change every level that shares that scene. Generic character clips only enter the app bundle if an actual screen uses them.

For a correct answer, validate and persist the answer using the existing code, then display the result and appropriate clip. The renderer never awards coins, spends lives, or saves a stage. Continue can dismiss immediately. Backgrounding pauses playback; returning may resume or show the destination still, but cannot replay a transaction. Reduce Motion shows the destination still immediately with the same explanation and action. Missing media falls back to text and a known still, never a blocked Continue button.

Show one focal scene in the result. The existing result component also renders a companion portrait; suppress duplicate focal character presentations when adopting the new kit. Avoid a separate celebration page after the existing result screen. Resume opens at the next unsolved task; replay uses the current attempt's phase while respecting saved rewards.

## Production batches and exact pilot scope

| Batch | Work | Completion evidence |
| --- | --- | --- |
| 1 | Cat and Boba: two layered SVG masters, two model sheets as SVG and PNG, preview page, palette/rig metadata | Inspect full size and 96 px silhouettes. No animation or app integration yet. |
| 2 | Six logical character clips: greet, acknowledge, celebrate for each pilot character | Six atlases, six final stills, 64 frame PNGs, source timelines, replayable contact-sheet/animation preview |
| 3 | One Boba picnic kit: four stills and three composite clips | Three atlases, four checkpoint PNGs, 32 frame PNGs, scene/timeline source, preview of all states and transitions |
| 4 | Scoped native pilot integration | No illustration during solving; correct stage and ending behavior; English/Latvian, accessibility and save/reward checks |
| 5 | Optional cast and mission expansion | Alder and Ada add six character clips; bridge and book add two kits. Do this only when requested. |

The orange-only pilot therefore includes two characters, six generic clips, one story kit with three composite clips, and four scene states. Character frame counts are 8 + 8 + 16 per character, 64 total. Scene clips add 32 frames, 96 delivery frames overall. Model sheets and final stills are separate outputs. No GIF is a shipping asset.

Before a production release that presents the cat as the player's pet, generate grey and white color variants from the same geometry and timelines. This multiplies render outputs, not authored choreography: only cat-bearing clips and stills need variants. The asset manifest records pilot and release coat requirements separately. Do not substitute a fixed orange cat for a player's other coat without an explicit product decision.

## Acceptance checks

- All four planned silhouettes are distinguishable without color. The pilot must prove this for Cat and Boba.
- Model sheets, neutral pose, and all frames preserve markings, limb count, cap/apron shape, outline weight, and proportions.
- Character SVGs contain real named vector groups and no external fonts, scripts, network images, or embedded full-board raster.
- Every production raster has the stated dimensions and alpha; atlas frame order and counts match `asset-plan.json`.
- Every frame keeps ears, tail, feet, props, and strokes inside the safe area. Check every frame, not only endpoints.
- Hands/paws touch carried props; planted feet do not slide; lids rotate around their hinge; held objects do not jump between characters.
- Every story clip ends at its declared checkpoint still. No rewind, snap to neutral, or object duplication occurs.
- Preview at full size and 320 px scene width. One gesture should remain clear without reading the caption or hearing sound.
- In the later native pilot, Continue works during playback, Reduce Motion and backgrounding behave correctly, and repeated taps do not duplicate rewards.
- If a requirement fails, fix that batch and rerun only its relevant checks. Do not expand the cast to avoid fixing a weak pilot.

## Current progress and useful context

Completed here: inspected existing character identities and boss media layout; researched Duolingo's documented use of reactions and interludes; agreed flat 2D with the user; produced one proposed lineup board; wrote this plan, manifest, and bounded prompts. Update on 1 November: Cat/Boba masters, clips, one scene kit, coat variants and scoped native integration are complete. See `production/STATUS.md` for verification and limits.

What worked in the design research: giving the math task the opening viewport; moving story feedback to the existing result flow; reusing short checkpoint and ending clips. Existing media already provides a practical atlas player.

What did not work: the large boss mission panel hid the actual task. A compact thumbnail was proposed and rejected by the user as unnecessary. The current Boba title mentions a basket in branches while its stage copy describes balloon launch. Do not carry this inconsistency into new scenes. The generated concept board is useful for character direction but has residual shading and is not a production model sheet.

## Repository map

The working repository is `/Users/aigarspeda/Desktop/BrainPet`. If this package is opened elsewhere, locate that project before integration; art-production tasks can run in their own directory.

| Existing source | Why the next agent may need it |
| --- | --- |
| `app/play.tsx` | Mission panel before the puzzle; later removal is an integration task |
| `components/puzzle/ResultOverlay.tsx` | Existing correct-answer scene and companion presentation |
| `components/puzzle/BossStoryScene.tsx` | Still/atlas rendering, aspect ratio, background and Reduce Motion behavior |
| `utils/boss-story.ts` | Stage progression and 125 ms frame timing |
| `constants/boss-scene-assets.ts` | Current generated registry; do not overwrite the entire catalog |
| `scripts/3d/pack-lesson-bosses.mjs` | Four-column 512 by 320 packing convention |
| `data/lesson-boss-scenes.json` | Existing names, species, and story IDs |
| `scripts/puzzles/lesson-boss-stories.mjs` | Story generator that must agree with eventual copy changes |
| `assets/3d/cat-preview.png` and `constants/cat-skins.ts` | Existing cat identity and coat variants |

Source was inspected on 31 October 2026. Re-read current files and preserve unrelated working-tree edits before integration. The historical root handoff describes the 3D home and remains relevant there; this plan does not replace it.

## Research references

Duolingo is a reference for when to use character feedback, not a design to copy. It also includes characters in some exercises. The user chose a stricter puzzle-only active screen for this project.

- Character reactions and mid-lesson interludes: https://blog.duolingo.com/building-character/
- Readable shapes, exaggeration, and humor: https://blog.duolingo.com/shape-language-duolingos-art-style/
- State-driven character animation: https://blog.duolingo.com/world-character-visemes/
- Mathematical visuals and interaction: https://blog.duolingo.com/developing-math/

The production recipe, cast personalities, timing targets, and media budgets in this plan are project proposals. They are not claimed Duolingo specifications.
