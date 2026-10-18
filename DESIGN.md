---
name: Math Mews
description: Cozy cat rooms and clear, encouraging math puzzles for native mobile.
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
  toolbar-label:
    fontSize: "13px"
    fontWeight: 700
  preview-title:
    fontSize: "22px"
    fontWeight: 800
  puzzle-question:
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 30
  answer-label:
    fontSize: "20px"
    fontWeight: 700
  stat-value:
    fontSize: "12px"
    fontWeight: 700
rounded:
  header-square: "12px"
  store-button: "14px"
  card: "16px"
  compact-stage: "16px"
  puzzle-action: "20px"
spacing:
  toolbar-gap: "8px"
  section-gap: "10px"
  compact-stage-inset: "12px"
  card-inset: "16px"
  screen-inset: "20px"
components:
  puzzle-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    typography: "{typography.puzzle-action}"
    rounded: "{rounded.puzzle-action}"
    padding: "14px 20px"
  answer-choice:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    typography: "{typography.answer-label}"
    rounded: "{rounded.card}"
    padding: "14px 16px"
  store-purchase:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.store-button}"
  name-input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.store-button}"
  header-square:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.header-square}"
---

# Design system: Math Mews

## Overview

Math Mews pairs math puzzles with a cat living in furnished rooms. Preserve the warm cream shell, white cards, peach outlines, bold controls, pastel dimensional furniture, and expressive cat. The room invites exploration; puzzle screens keep the question and next action easy to find. Copy stays short, warm, and encouraging after mistakes.

This guide describes the current iOS and Android implementation, reviewed against source and bundled art on 2026-10-16. It covers the app beyond the original room-engine migration. No running native client was inspected during this review; screenshots and source do not certify current device performance, movement quality, or accessibility across platforms.

Use [GameColors](constants/game.ts), the active screens in [app/](app/), and their shared components as implementation authority. [STYLE_GUIDE.md](doc/STYLE_GUIDE.md) provides implementation patterns and review checks for applying this system. [.impeccable/native-room.json](.impeccable/native-room.json) records the original migration, including old camera and catalog facts; treat it as history.

Superseded room, startup, and cat review imagery has been removed. Use the current exported cat models and [cat preview](assets/3d/cat-preview.png) for character proportions. Capture fresh native screenshots when reviewing the current application.

## Colors

The frontmatter copies the shared `GameColors` palette. The game screens use this light palette even though the navigator follows the system color scheme. A complete dark game theme is not implemented. The Expo template palette in `constants/theme.ts` does not define the game UI.

- Warm cream is the screen background. White cards and peach borders separate content and controls.
- Primary red identifies the main puzzle and purchase actions. Primary-dark supplies the home CTA shadow.
- Turquoise marks selection and secondary controls. Store tabs and the home Decorate tile use a pale mint surface, currently `#E8FAF8` in their styles.
- Decoration confirmation buttons use deep teal `#087F79` with white text and checkmarks. The measured white-to-teal contrast is 4.86:1; keep the pressed background dark enough for white labels.
- Gold identifies coins; darker coin text keeps amounts readable. Charcoal and muted gray establish text hierarchy.
- Orange, pink, and lavender identify the visible fed, happiness, and wisdom stats. Cleanliness blue remains a shared token, but the compact home panel currently shows only those three stats.
- Answer choices use turquoise for selected, green for correct, and soft orange for wrong. Keep textual feedback and selected/disabled semantics alongside color. Gentle wrong-answer orange is distinct from red placement-error outlines in the room editor.

Room materials belong to the Blender assets. Preserve the pastel walls, pale floors, warm wood, soft textiles, and authored furniture finishes. Weather, time, windows, curtains, and lamps change their lighting. Do not recolor GLBs to match UI tokens or force all rooms to the mauve of one older screenshot.

## Typography

Game controls use the platform default font. No custom Nunito or Fredoka font is loaded. Use the existing bold hierarchy and English/Latvian translations rather than introducing a new font identity.

The frontmatter records numeric React Native baseline sizes. `px` is a portable token notation, not a measurement of screenshot pixels. Most screen styles apply [moderateScale](utils/scale.ts) against a 390-point width; some sheets use literal sizes. These are representative component roles, not a universal type scale.

| Role | Current baseline | Source |
| --- | --- | --- |
| Home puzzle action | 18, weight 800 | `app/index.tsx` |
| Home toolbar label | 13, weight 700 | `app/index.tsx` |
| Store preview title | 22, weight 800 | `StorePreviewSheet` |
| Puzzle question | 20, weight 600, line height 30 | `PuzzleCard` |
| Answer choice | 20, weight 700 | `ChoiceButton` |
| Compact stat percentage | 12, weight 700 | `PetStatsPanel` |

Clock digits use tabular numbers. Compact labels and captions are smaller than body copy. Do not promote these small sizes to general reading text. Preserve wrapping and space for longer Latvian labels; retain accessibility labels when visible text shrinks or truncates. Stat percentages are drawn with Skia and expose their values through the surrounding accessible controls.

## Layout

The app is portrait-only in [app.json](app.json). The scaling helpers use a 390 × 844 baseline. Screens respect safe areas; long content scrolls, and onboarding avoids the keyboard. iPad support is enabled, but the current screens do not implement a separate two-column tablet layout.

The current cat home in [app/index.tsx](app/index.tsx) has this order:

1. A white account row with coins, streak, and settings.
2. A toolbar with the Decorate menu, world day/time, and weather report. These tiles have a minimum height of 56.
3. A flexible, clipped room viewport. Below the scene, previous/next arrows, the room name, and four position dots browse the living room, bedroom, bathroom, and kitchen.
4. Three stat rings and a math-stats shortcut. Decoration controls occupy this area while editing; the hidden stats retain their space so the viewport does not jump.
5. The full-width Solve a Puzzle action with a supporting hint or saved shopping-goal progress.

Care actions open from the cat and placed-object menus. There is no separate home care-card row. Pinch zoom spans 1× to 3×, with panning when zoomed; there is no fixed lower-right zoom button. [RoomNavigation](components/pet/RoomNavigation.tsx) browses rooms independently of commands that send the cat through a door.

Placed objects also expose their own actions in those menus. Cupboards, drawers, lids, windows, ovens and laptops open and close with saved per-instance state. Suitable electronics, mixers, fires and taps have power or water actions with visible feedback. Passive furnishings offer Investigate when they have no existing cat activity. Sit in the drawer opens the selected unit and uses its top tray as the cat's landing point. Hide in cupboard opens a tall wardrobe or closet and lets the cat sit facing out of its lower compartment. Resized cupboards must have enough interior space. Both actions wait for the cat to get out before closing. Keep these actions ahead of editing tools, and retain the existing bed, seat, play and care commands. The capability review is in [item-interactions.json](data/item-interactions.json).

The room camera uses distant perspective with near-isometric framing, configured in [native-room-camera.ts](utils/native-room-camera.ts). It looks from `[56, 43.6, 56]` toward `[0, 0.9, 0]` and derives its field of view from the existing room span and viewport aspect. The cat's model scale stays uniform during travel; perspective allows slight apparent-size variation. Preserve the agreement between rendering, picking, and saved screen anchors when changing framing.

Keep per-room layouts, stable catalog IDs, normalized placement anchors, furniture proportions, wall orientation, and rug/wall-art ordering. The Decorate header menu stays available as Decorating while editing, with Shop in the same dropdown. The editor toolbar contains Undo and Choose an item, plus a movement/rotation/aiming dock below the room. Opening Shop and returning preserves decoration mode. Invalid drops show the attempted position in orange and blockers or crossed boundaries in red, then explain why the item returned to its saved position. Preserve arrow nudges as an alternative to dragging.

Other screens share the cream background, a back action, readable titles, and scrollable content. The puzzle path has difficulty selection, progress, and available/completed/locked states. Play places the question above its task-specific controls. The store has primary tabs, a decoration category sheet, an owned-only filter, and a two-column catalog grid.

## Elevation & Depth

The world gets depth from rounded meshes, material shading, ambient occlusion, and shadows. Home lighting follows the world clock and weather through `NativeWorldLighting`, plus window and lamp lights. `DefaultLight` remains the fallback for scenes without a clock, including store room previews; it no longer describes the home lighting system.

Ambient occlusion uses radius 0.3 and intensity 1 with medium quality/filtering. Grounding contact shadows follow furniture footprints and rugs. Supported device builds additionally enable cast/receive shadows with a limited light budget; iOS simulators use the fallback because native shadow maps are unsupported there. Preserve readable cat faces and furniture silhouettes through day/night changes. Physical-device shadow appearance and performance need runtime validation.

UI depth stays modest. The home puzzle CTA uses its primary-dark shadow with offset `[0, 3]`, opacity 0.25, radius 6, and Android elevation 3. A faint shadow below the room separates it from the stats. White surfaces and peach outlines do most of the remaining work. Keep scene lighting independent of UI text and icon colors.

## Shapes

Keep the cutaway corner-room silhouette, raised wooden floor edge, rounded cushions, soft paws, and beveled furniture. The current cat is a compact cartoon quadruped with a large rounded head, short neck, continuous torso, thick rounded legs and paws, triangular pink inner ears, small charcoal eyes, hooked upright tail, and a thin red collar with a small bell. Orange/cream, grey/white, and white coats share the same proportions and rig.

The current cat comes from [original_cat.py](scripts/3d/original_cat.py) and [game_cat.py](scripts/3d/game_cat.py). The editable orange rig is [cat-orange.blend](prototypes/cat-model/cat-orange.blend). Keep skin transitions smooth in standing, sitting, walking, sleep, and jump poses. Earlier longhair figurine and real-cat proportion notes are superseded by this implemented character. The older marketing concept is not the runtime mesh specification.

Cat navigation combines floor A* with directed connections across suitable chairs, sofas and low, sturdy objects. [Traversal links](utils/native-cat-traversal.ts) follow the live furniture scale and rotation, validate takeoff/landing space, and sweep each flight against furniture and open doors. Jump costs include preparation and recovery, so a clear floor route stays preferable. Seat crossings use seated arrivals, a short reposition and a seated takeoff. Do not turn fragile decorations or powered appliances into automatic perches.

[Locomotion](utils/native-cat-locomotion.ts) rounds collision-free corners, gives tight turns more time, accelerates and brakes, and shares the same flight curve between planning and playback. Native walking stays synchronized to distance travelled. Hops tuck the paws and reach the landing with the forepaws first. [Turning](utils/native-cat-turn.ts) leads with the head, bends the legs, and steps each paw through turns of at most 45 degrees while three paws stay planted. Native IK preserves foot positions and level soles independently of torso rotation. [Walking starts](utils/native-cat-walk-launch.ts) overlap the final turn steps and keep each paw anchored until its first swing joins the walking gait. Short journeys use shorter strides; traversals restore the normal stride before the next leg. Interrupted turns retain the visible head, body and foot poses. Pause/resume preserves the itinerary clock and turn contacts, and decorating waits for a traversing cat to reach the floor. Reduce Motion skips spatial traversal. Keep [route regressions](scripts/check-cat-locomotion.mjs), [turning regressions](scripts/check-cat-turning.mjs), native playback checks, and Blender paw-contact checks together when changing these behaviors.

UI shapes are rounded rectangles and pills. Square header controls and toolbar tiles use radius 12, store buttons and the name input use 14, and many cards and answer choices use 16. The compact stage uses radius 16 with a 12-point horizontal inset; the home puzzle CTA and puzzle question card use radius 20. These baselines are usually moderately scaled. Header pills derive their radius from half their height.

## Components

Reuse the existing components and their state handling rather than copying only their appearance.

- [PetStage](components/pet/PetStage.tsx) coordinates the scene, gestures, object/cat menus, speech, room navigation, stats, and decoration dock. Native hit testing and React Native controls must continue to agree after zooming or moving objects.
- [PetStatsPanel](components/pet/PetStatsPanel.tsx) shows fed, happiness, and wisdom rings with percentages. Tapping a ring opens a detail sheet. The math-stats shortcut leads to topic progress. Stat changes animate while active and respect Reduce Motion.
- Switching play and decoration modes uses a 220 ms fade with a 6–8 point vertical shift on controls. Keep the scene viewport fixed; outgoing controls immediately stop receiving touches and leave the accessibility tree. Reduce Motion and inactive rooms switch instantly. Both bottom actions retain the play footer footprint during the crossfade. Opening Size or Turn and going Back uses a 180 ms fade/8-point entrance with a quicker 100 ms exit; only the floating dock changes height, leaving the scene viewport fixed. Skip nested entrance/exit animations and respect Reduce Motion for both tool and dock transitions.
- Room decoration leads with dragging. The selected-item dock shows a picture, Turn, Size, Put away and More; precise movement and extra tools are secondary. Face other wall stays visible as a full-width action for supporting furniture and wall attachments, alongside their other controls, and hides while resizing. The resize panel shows only the item name, Smaller, Bigger and Back, plus feedback if a resize is blocked. Undo stays visible. Place here clears one selection; the bottom Done decorating action leaves the editor and replaces the puzzle CTA during editing. Exact rotation stays under Fine tune. Valid turns save automatically on a tap, slider release or numeric entry; Back keeps the angle, and Undo can reverse it. See [the research and interaction review](docs/room-decoration-ux.md).
- [RoomActionMenu](components/pet/RoomActionMenu.tsx) uses platform-native menus through `NativeActionMenu`: SwiftUI on iOS and Material menus on Android. Retain grouped actions, disabled/destructive states, and the app's untinted icon artwork.
- [AppIcon](components/ui/AppIcon.tsx) displays the original Blender-rendered artwork from [app-icons.ts](constants/app-icons.ts). The surrounding control supplies its accessible name. [IconText](components/ui/IconText.tsx) replaces supported inline markers with that same artwork while preserving localized word order. Use this family for new game actions.
- [AppBottomSheet](components/ui/AppBottomSheet.tsx) uses native Expo UI presentation. Standard sheets open at half height; expanded sheets use an 88% fraction on iOS and full height on Android. Preserve scrolling, dismissal, and bottom safe-area padding.
- [PuzzleCard](components/puzzle/PuzzleCard.tsx), [ChoiceButton](components/puzzle/ChoiceButton.tsx), and task-specific puzzle components keep the question, interaction, and feedback distinct. White answer buttons have peach outlines at rest, clear selection/result states, and a 56-point scaled minimum height. [ResultOverlay](components/puzzle/ResultOverlay.tsx) supplies the next/retry/help path. Worked visual help is free; preserve its explanation and practice flow.
- [StoreTabBar](components/store/StoreTabBar.tsx) groups rooms, beds, toys, decor, and cat colors. The store opens a category for the current home room. Catalog cards distinguish buying, ownership, placement, and equipping. Purchase/place flows can return to decoration mode with the affected item selected. [StorePreviewSheet](components/store/StorePreviewSheet.tsx) shows a 300-point native room preview, price, purchase eligibility, saved goal, and close action. Purchase buttons have a 48-point minimum height, not a fixed height.
- [GameHeaderStats](components/economy/GameHeaderStats.tsx) currently displays coins and streak. Lives remain in game state but are not rendered by this header. Supported real-money coin-pack flows pass through `ParentGateSheet`; room goods use game coins. Keep purchase feedback and unaffordable states explicit. Feeding is free.
- [Onboarding](app/onboarding/name-pet.tsx) offers English/Latvian selection, cat coat choice, a named input with a character count, and a bottom continue action. Cloud restore candidates can replace this form with a restore choice. [Settings](app/settings/index.tsx) groups language, graphics/diagnostics, privacy, licenses, and data management in bordered white sections.
- [SplashGate](components/branding/SplashGate.tsx) keeps the cream branding screen and cat visible while assets and initial scenes prepare. Its bar reflects loading progress. Preserve the still-to-native-cat transition and timeout recovery. Prepared home rooms switch directly; unpainted scenes retain the outgoing view until ready.

The live room, store preview, and cat portraits use Filament models. `NativeCatActor` reads authored timings from [clips.json](scripts/3d/clips.json), currently 37 clips per coat including `sit`, `wash`, and `batToy`. Walking follows travel distance; rest/play holds the actual arrival pose. Limb IK is baked during authoring, not a live runtime IK or active ragdoll system. Bullet handles movable toy bodies and contact with the controlled cat and room obstacles. Feeding props and effects, curtains, fridge doors/lights, lamps, weather, and airflow have their own state and pause rules.

Backgrounding and hidden rooms pause ongoing native updates. Reduce Motion suppresses continuous travel and effects such as lightning while preserving action completion. [Simple graphics](lib/graphics-mode.ts) provides still-image room/object/cat fallbacks and explains previews that require 3D. An explicit graphics choice persists; automatic crash recovery applies for the session. Keep fallback care callbacks completing so controls do not remain blocked.

Asset counts and sizes change with the catalog and belong in generated reports or engine checks, not permanent visual rules. Use [native-model-sources.ts](constants/native-model-sources.ts), [inventory.json](scripts/3d/inventory.json), and the actual GLBs to verify coverage. Technical behavior and checks are documented in [native-room-engine.md](docs/native-room-engine.md) and [cat-animations.md](docs/cat-animations.md).

## Do's and Don'ts

- Do preserve the cozy room identity, shared UI palette, current cat proportions, and clear puzzle-action hierarchy.
- Do keep saved layouts, item IDs, wall mounting, and screen-to-world placement consistent.
- Do preserve English/Latvian copy, screen-reader names/values/states, room-navigation accessibility actions, and editor nudges. Hidden rooms and hidden stats must stay out of the accessibility tree.
- Do keep controls comfortably tappable. Room arrows are 44 points, shared header controls use a scaled 44 baseline, and major actions generally use 48 or 56. These are observed component values, not proof that every target meets one universal minimum.
- Do check small-screen layout, larger system text, both languages, Reduce Motion, simple graphics, and native menu/sheet behavior when changing their controls.
- Do validate motion, object contact, lighting, and camera changes in a running native client. Review physical-device shadows separately from simulator output.
- Don't restore the removed home care-card row, room picker, or fixed zoom button based on old screenshots.
- Don't treat historical migration approval, catalog counts, or screenshots as current runtime verification.
- Don't replace the current character with the earlier longhair, dog/video, or marketing-concept design.
- Don't claim a complete dark theme, two-column tablet UI, live paw IK, or active ragdoll simulation unless those are implemented and verified.
