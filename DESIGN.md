---
name: Math Mews
description: Cozy pastel rooms for a native mobile math companion.
colors:
  background: "#FFF5EB"
  card: "#FFFFFF"
  cardBorder: "#FFE0CC"
  primary: "#C73948"
  primaryDark: "#A52C3B"
  secondary: "#4ECDC4"
  coin: "#F7B731"
  coinText: "#8B6914"
  text: "#2D3436"
  textMuted: "#636E72"
  hunger: "#FF9F43"
  happiness: "#FF6B9D"
  cleanliness: "#74B9FF"
  wisdom: "#A29BFE"
  success: "#247A3C"
typography:
  puzzle-action:
    fontSize: "18px"
    fontWeight: 800
  action-label:
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 20
  preview-title:
    fontSize: "22px"
    fontWeight: 800
  stat-value:
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 16
rounded:
  header-square: "12px"
  store-button: "14px"
  care-card: "16px"
  stage: "20px"
spacing:
  care-inset: "8px"
  action-gap: "10px"
  compact-stage-inset: "12px"
  stage-inset: "20px"
components:
  puzzle-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    typography: "{typography.puzzle-action}"
    rounded: "{rounded.stage}"
    padding: "14px 20px"
  care-action:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    typography: "{typography.action-label}"
    rounded: "{rounded.care-card}"
    padding: "8px"
  store-purchase:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.store-button}"
    height: "48px"
---

# Design system: Math Mews

## Overview

The existing Math Mews room is the visual authority. Preserve its cozy math-companion shell, pastel dimensional furniture, large expressive cat, warm cream background, and bold controls. PRODUCT.md defines this as an iOS and Android engine migration within the existing product.

The native room keeps the original Blender geometry and materials. Filament gives the observed room quieter highlights and darker mauve walls than the raster incumbent. Keep that native material character while retaining the recognizable room and furniture silhouettes. This document records the shipped migration direction; it does not approve a new visual concept.

Observed references are [sofa landing](docs/art/native-room-engine.png), [furniture preview](docs/art/native-room-store.png), and [ball preview](docs/art/native-room-ball.png). The migration reviewer returned `ship` with no material visual fixes. Screenshots cannot certify gait or Android interaction.

## Colors

The frontmatter extracts the existing `GameColors` values in `constants/game.ts`. Use the warm cream background and white cards to separate controls from the room. Peach borders define care cards, header controls, and room overlays.

The primary red identifies the puzzle CTA and store purchase action. Turquoise remains the secondary accent. Gold identifies coins, with the darker coin text for numbers. Hunger, happiness, cleanliness, and wisdom retain their existing orange, pink, blue, and lavender assignments. Charcoal labels and muted gray supporting text preserve the current hierarchy.

Room colors belong to the authored models. Mint seating and foliage, mauve walls, pink toys and textiles, pale flooring, and warm wooden edges remain recognizable in the observed room. Do not recolor GLB materials to match interface tokens.

## Typography

The inspected controls use React Native's platform default font. Preserve the existing bold label hierarchy and localized strings. The frontmatter records source sizes; `px` represents the numeric React Native baseline, not screenshot pixels. Home styles apply `moderateScale` relative to a 390-point screen width. Store preview styles use their literal numeric sizes.

The puzzle action uses weight 800, care labels use weight 700, and the store preview title uses weight 800. Keep supporting reward, price, and stat text subordinate. Preserve label space and dropdown indicators when localized copy grows.

## Layout

The portrait home places wallet and navigation controls above the room, care stats beneath it, and care actions above the wide Solve a Puzzle CTA. The room occupies the flexible central area. Keep Decorate near its upper left and zoom near its lower right. The compact stage uses a rounded outer card and an inset, clipped room viewport.

The world uses the incumbent orthographic view. `NativeRoomScene` sets a horizontal span of 7.85 world units and looks from `[8, 7, 8]` toward `[0, 0.9, 0]`; vertical coverage follows the viewport aspect ratio. Cat scale stays uniform during travel, so walking deeper into the room does not shrink it. Preserve its apparent size when adjusting viewport layout.

Saved normalized placements map to their original screen anchors. Preserve furniture scale, wall orientation, per-room layouts, and rug or wall-art ordering. Doors remain aligned to their wall and stationary. Store previews reuse the native room and cat models inside the existing purchase sheet.

## Elevation & Depth

The world gets depth from rounded meshes, material shading, contact shadows, and ambient occlusion. The scene uses `DefaultLight` and ambient occlusion with radius 0.3 and intensity 1. These are implementation facts; future lighting changes must preserve readable cat faces, furniture silhouettes, and the quieter native highlights seen in the references.

Interface depth stays modest. The puzzle CTA has the existing primary-dark shadow, vertical offset 3, opacity 0.25, radius 6, and Android elevation 3. Cards and control outlines supply most of the shell's separation. Keep world lighting independent of UI text and icons.

## Shapes

Keep the authored rounded cushions, cylindrical plant pots, soft cat paws and face, and beveled furniture edges. Preserve the cutaway corner-room silhouette and its raised wooden floor edge.

The interface uses rounded rectangles and pills. Care cards, the stage, store buttons, and square header chips retain the radii in the frontmatter. Header pills derive their radius from half their height. Header controls have a baseline height of 44; the room selector and zoom control also retain their existing 44-point minimum height.

## Components

- `PetStage` owns the existing room selection, Decorate, zoom, stats, interaction overlays, and editor controls. React Native keeps these touch targets and accessible menus around the native scene.
- `NativeRoomScene` renders room objects and the cat with Filament. Solid furniture and room bounds participate in collision handling; movable balls, yarn, and mice use Bullet bodies.
- `NativeCatActor` plays the original 35 actions plus a separate sofa sitting clip in orange, grey, and white coats. Walk phase advances with actual travel distance. Preserve sofa cushion landings, arrival poses, and action completion callbacks when changing motion. Live paw IK and active ragdoll joints are not implemented.
- `NativeRoomPreview` renders the same catalog models for purchase previews. Static store thumbnails, control artwork, and OS launch branding remain appropriate UI assets.
- Care cards, the activities menu, and the puzzle CTA retain their eligibility, completion, reward, and navigation behavior. Backgrounding or covering the room pauses native playback. Reduce Motion retains completion without continuous travel.

The native catalog contains 292 GLBs, including 288 inventory IDs, three cat coats, and airflow, under the 60 MiB asset budget. Keep catalog IDs and saved placements stable when extending the world. Engine details and verification live in [native-room-engine.md](docs/native-room-engine.md); migration metadata lives in [.impeccable/native-room.json](.impeccable/native-room.json).

## Do's and Don'ts

- Preserve the incumbent geometry, material palette, controls, and puzzle CTA hierarchy.
- Keep cat scale uniform, wall-mounted objects aligned, and saved placement anchors stable.
- Check movement and object contact in a running native client when changing animation, physics, or camera mapping.
- Reuse native models for live rooms, store room previews, and cat portraits.
- Do not replace the room with a new composition or introduce a new shell identity under this migration contract.
- Do not treat screenshots as evidence of gait quality, Android interactions, or real-device performance.
- Do not describe the rigged animation controller as live IK or active ragdoll simulation.

### Longhair cat revision

The user supplied a longhair figurine reference on 2026-10-05. Use its broad cheek line, large glossy eyes, thin pointed pink ears, connected chest and forelegs, and rounded hind haunches while retaining orange/cream, grey/white and white game coats. Smooth skin transitions must remain intact in motion. Room geometry, UI, saved placements and action meanings retain their existing design. Review exports in `docs/art/native-cat-rebuild/`; model construction and rig checks are documented in `docs/native-room-engine.md`.

The user's later real-cat photos guide the body proportions. Keep a continuous neck-to-shoulder line, a full ribcage with a narrower waist, and hips tucked beneath the sloping back when seated. Standing poses retain a level back. The expressive face remains stylized. The editable finished rig is `prototypes/cat-model/cat-orange.blend`.

The latest visual reference is a compact cartoon quadruped: a large rounded head, short neck, thick rounded legs and paws, smooth torso, upright hooked tail, small black eyes, clean cream and brown patches, and a thin red collar. Apply these proportions to every coat. The original Blender mesh and anatomical rest skeleton are generated together, with a sealed body, blended shoulder/hip weights and a dedicated coat texture. No paid or downloaded cat model is required.
