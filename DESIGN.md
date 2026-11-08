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
  secondaryDark: "#087F79"
  coin: "#F7B731"
  coinText: "#8B6914"
  text: "#2D3436"
  textMuted: "#636E72"
  hunger: "#FF9F43"
  happiness: "#FF6B9D"
  cleanliness: "#74B9FF"
  wisdom: "#A29BFE"
  success: "#247A3C"
  challengeText: "#5D408C"
  challengeBorder: "#BBA4E6"
  challengeSurface: "#F3EEFF"
  bossSurface: "#FFF3D9"
  bossBorder: "#C99632"
  bossStageComplete: "#D9EFDF"
  achievementLockedSurface: "#F0F1F1"
  achievementLockedBorder: "#D5D9DA"
  puzzle-background: "#FFFFFF"
  puzzle-card: "#FFFFFF"
  puzzle-cardBorder: "#D7DDE8"
  puzzle-primary: "#C32468"
  puzzle-primaryTop: "#CF296D"
  puzzle-primaryDark: "#931445"
  puzzle-secondary: "#C32468"
  puzzle-secondaryDark: "#8D1749"
  puzzle-selectedSurface: "#FFF0F6"
  puzzle-selectedStrong: "#FFE0ED"
  puzzle-text: "#24314B"
  puzzle-textMuted: "#5E687B"
  puzzle-coin: "#FFC83D"
  puzzle-coinText: "#765207"
  puzzle-rewardSurface: "#FFF3BF"
  puzzle-success: "#267324"
  puzzle-successSurface: "#EEFBDE"
  puzzle-progress: "#5BAE13"
  puzzle-progressTop: "#91E83D"
  puzzle-progressTrack: "#E7EAF2"
  puzzle-incorrect: "#C82E39"
  puzzle-incorrectSurface: "#FFF0F0"
  puzzle-warning: "#8B551C"
  puzzle-warningSurface: "#FFF1DB"
  puzzle-challenge: "#8036CD"
  puzzle-challengeSurface: "#F0D8FF"
  puzzle-headerGlow: "#D7F5E9"
  puzzle-playGlow: "#D7F5E9"
  puzzle-rewardGlow: "#D7F5E9"
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
    fontFamily: "MewsNunito900"
    fontSize: "24px"
    fontWeight: 900
    lineHeight: 32
  answer-label:
    fontFamily: "MewsNunito700"
    fontSize: "20px"
    fontWeight: 700
  stat-value:
    fontSize: "12px"
    fontWeight: 700
  challenge-clock:
    fontFamily: "MewsNunito900"
    fontSize: "20px"
    fontWeight: 900
  home-metric-value:
    fontSize: "16px"
    fontWeight: 700
  achievement-total:
    fontSize: "16px"
    fontWeight: 400
  home-metric-label:
    fontSize: "11px"
    fontWeight: 600
  lesson-title:
    fontFamily: "MewsNunito900"
    fontSize: "19px"
    fontWeight: 900
  lesson-number:
    fontFamily: "MewsNunito700"
    fontSize: "13px"
    fontWeight: 700
  lesson-status:
    fontFamily: "MewsNunito700"
    fontSize: "12px"
    fontWeight: 700
  lesson-activity-label:
    fontFamily: "MewsNunito700"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 17
  puzzle-heading:
    fontFamily: "MewsNunito900"
    fontSize: "30px"
    fontWeight: 900
  puzzle-body:
    fontFamily: "MewsNunito400"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 22
  puzzle-button:
    fontFamily: "MewsNunito900"
    fontSize: "17px"
    fontWeight: 900
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
  berry-puzzle-button:
    backgroundColor: "{colors.puzzle-primary}"
    textColor: "{colors.puzzle-card}"
    typography: "{typography.puzzle-button}"
    rounded: "{rounded.card}"
    padding: "12px 16px"
  puzzle-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    typography: "{typography.puzzle-action}"
    rounded: "{rounded.puzzle-action}"
    padding: "14px 20px"
  answer-choice:
    backgroundColor: "{colors.puzzle-card}"
    textColor: "{colors.puzzle-text}"
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
  lesson-list-row:
    backgroundColor: "{colors.puzzle-card}"
    textColor: "{colors.puzzle-text}"
    typography: "{typography.lesson-title}"
    rounded: "{rounded.card}"
    padding: "16px"
---

# Design system: Math Mews

## Overview

For new lesson visuals, follow the [puzzle style guide](docs/PUZZLE_STYLE_GUIDE.md): palette roles, exact mathematical geometry, component recipes, motion, accessibility and native review examples.

Math Mews pairs math puzzles with a cat living in furnished rooms. Preserve the home's warm cream shell, white cards, peach outlines, bold controls, pastel dimensional furniture, and expressive cat. Puzzle selection, play, results and picture help use the approved Berry direction: a white canvas, mint-to-white gradients, rounded Nunito text, berry actions, gold rewards and lime progress. Copy stays short, warm, and encouraging after mistakes.

The shared home and store system was reviewed against source and bundled art on 2026-10-16. The puzzle-only Berry documentation was refreshed from implementation on 2026-11-01. It covers the app beyond the original room-engine migration. The original shared-system review did not inspect a running native client. The Berry update has separate iOS simulator evidence below; it does not certify Android-device rendering or physical-device performance.

Use [PuzzleColors](constants/puzzle-theme.ts), [PuzzleFontAssets](constants/puzzle-fonts.ts) and [PuzzleText](components/puzzle/PuzzleText.tsx) for the scoped puzzle design. Home, care, store, Settings and the global navigator keep their existing palette and platform typography, except the home puzzle action and startup loader share the Berry accent. The shared home `MathStatsChip` remains. The retired rewards collection has no home, topic or Settings entry point. There are no bottom tabs in the puzzle flow.

Use [GameColors](constants/game.ts), the active screens in [app/](app/), and their shared components as implementation authority. [The puzzle style guide](docs/PUZZLE_STYLE_GUIDE.md) provides implementation patterns and review checks for lesson visuals. [.impeccable/native-room.json](.impeccable/native-room.json) records the original migration, including old camera and catalog facts; treat it as history.

Superseded room, startup, and cat review imagery has been removed. Use the current exported cat models and [cat preview](assets/3d/cat-preview.png) for character proportions. Capture fresh native screenshots when reviewing the current application.

## Colors

Unprefixed color tokens retain the shared `GameColors` palette and incumbent special-level colors. Tokens beginning with `puzzle-` record the scoped `PuzzleColors` overrides. Boss presentation artwork was removed after the feature was retired. The game screens use this light palette even though the navigator follows the system color scheme. A complete dark game theme is not implemented.

- Home, store and shared screens retain warm cream backgrounds, white cards and peach borders. Puzzle screens use white, slate text `#24314B`, muted text `#5E687B` and cool gray borders `#D7DDE8`.
- Shared primary red identifies purchases. The home Solve a Puzzle action uses Berry primary and its dark Berry shadow. Puzzle primary actions use berry `#C32468`, a `#CF296D` gradient top and a `#931445` bottom edge.
- Turquoise marks selection and secondary controls outside the puzzle flow. Store tabs and the home Decorate tile use a pale mint surface, currently `#E8FAF8` in their styles.
- Decoration confirmation buttons use deep teal `#087F79` with white text and checkmarks. The measured white-to-teal contrast is 4.86:1; keep the pressed background dark enough for white labels.
- Gold identifies coins; darker coin text keeps amounts readable. Charcoal and muted gray establish text hierarchy.
- Puzzle progress uses lime `#5BAE13` with `#91E83D` on the play progress highlight and `#E7EAF2` tracks. Topic/lesson summaries retain success-green fill on the scoped gray border track. Lesson activity segments use berry `#8D1749` for practice, deep purple `#5D408C` for challenge, and dark gold `#765207` for boss. Keep exact counts and check/lock shapes alongside color.
- Orange, pink, and lavender identify the visible fed, happiness, and wisdom stats. Cleanliness blue remains a shared token, but the compact home panel currently shows only those three stats.
- Answer choices use berry borders on pale pink `#FFF0F6` when selected, green `#267324` on `#EEFBDE` when correct, and red `#C82E39` on `#FFF0F0` when wrong. Keep textual feedback and selected/disabled semantics alongside color. Wrong-answer red is scoped to puzzles.

Puzzle header gradients fade from mint `#D7F5E9` to white. The recommended Start/Continue card fades from the same mint to pale mint `#F2FBF7`, retaining Berry text and its Berry action. Gold `#FFC83D`, dark gold text `#765207` and pale gold `#FFF3BF` identify puzzle rewards. These gradients are static paint layers, excluded from touch handling and the accessibility tree.

Room materials belong to the Blender assets. Preserve the pastel walls, pale floors, warm wood, soft textiles, and authored furniture finishes. Weather, time, windows, curtains, and lamps change their lighting. Do not recolor GLBs to match UI tokens or force all rooms to the mauve of one older screenshot.

## Typography

Home, care, store and shared controls retain the platform default font. Puzzle screens load bundled Nunito at weights 400, 700 and 900 from [puzzle-fonts.ts](constants/puzzle-fonts.ts), with the [OFL license](assets/fonts/nunito/OFL.txt) shipped beside the font assets. `PuzzleText` maps requested weights below 600 to Nunito 400, 600 through 700 to Nunito 700, and 800 or above to Nunito 900. It preserves inline artwork and native text scaling, with platform fallback if font loading fails. The frontmatter records the rendered puzzle font weights; component styles may request intermediate weights. Keep English/Latvian translations.

The frontmatter records numeric React Native baseline sizes. `px` is a portable token notation, not a measurement of screenshot pixels. Most screen styles apply [moderateScale](utils/scale.ts) against a 390-point width; some sheets use literal sizes. These are representative component roles, not a universal type scale.

| Role | Current baseline | Source |
| --- | --- | --- |
| Home puzzle action | 18, weight 800 | `app/index.tsx` |
| Home toolbar label | 13, weight 700 | `app/index.tsx` |
| Store preview title | 22, weight 800 | `StorePreviewSheet` |
| Puzzle question | 24, Nunito 900, line height 32 | `PuzzleCard` |
| Answer choice | 20, Nunito 700 | `ChoiceButton` |
| Compact stat percentage | 12, weight 700 | `PetStatsPanel` |
| Home account value | 16, weight 700 | `CoinCounter`, `GameHeaderStats` |
| Home account label | 11, weight 600, muted | `CoinCounter`, `GameHeaderStats` |

The home account row contains Coins, Streak and Lives. Labels use 11-point text and 14-point line height; values use 16-point text and 20-point line height. Compact and stacked layouts preserve readable values and accessible labels.

Clock digits use tabular numbers. Compact labels and captions are smaller than body copy. Do not promote these small sizes to general reading text. Preserve wrapping and space for longer Latvian labels; retain accessibility labels when visible text shrinks or truncates. Stat percentages are drawn with Skia and expose their values through the surrounding accessible controls.

## Layout

The app is portrait-only in [app.json](app.json). The scaling helpers use a 390 × 844 baseline. Screens respect safe areas; long content scrolls, and onboarding avoids the keyboard. iPad support is enabled, but the current screens do not implement a separate two-column tablet layout.

The current cat home in [app/index.tsx](app/index.tsx) has this order:

1. One account bar contains Coins, Streak, Achievements, Lives and a 44-point Settings button, separated by slim dividers. Below 352 scaled points of available stat width, the four metrics use icons and numeric values in a single 48-point row. Compact achievements show the earned count; full totals and localized names remain in screen-reader labels and the collection. The life countdown fits below its heart and count without adding another metric row. Long coin balances receive extra width. Wider bars retain the centered labels and full values, including Awards or Balvas above the achievement count and total. Larger accessibility text uses two stat columns with labels and no vertical dividers between metrics. Settings stays inside the bar, with no floating control or reserved row above it.
2. A toolbar with the Decorate menu, time of day, and weather report. The clock tile shows its current period and a sun or moon icon beside the time. Morning uses the golden Blender sunrise with an upward arrow; Evening uses the orange Blender sunset with a downward arrow. Daytime retains the full sun and Night the crescent moon. Do not show the elapsed world-day count. Its menu uses four icon choices for the time of day, three short speed options with distinct Blender icons: a standing clock for Real time, a speedometer for Fast and a rocket for Very fast, and the same selected outline/checkmark treatment as weather. These tiles have a minimum height of 56.
3. A flexible, clipped room viewport. Below the scene, previous/next arrows, the room name, and four position dots browse the living room, bedroom, bathroom, and kitchen.
4. Three stat rings and a math-stats shortcut. Decoration controls occupy this area while editing; the hidden stats retain their space so the viewport does not jump.
5. The full-width Solve a Puzzle action with a supporting hint or saved shopping-goal progress.

Care actions open from the cat and placed-object menus. There is no separate home care-card row. Pinch zoom spans 1× to 3×, with panning when zoomed; there is no fixed lower-right zoom button. [RoomNavigation](components/pet/RoomNavigation.tsx) browses rooms independently of commands that send the cat through a door.

Placed objects also expose their own actions in those menus. Cupboards, drawers, lids, windows, ovens and laptops open and close with saved per-instance state. Suitable electronics, mixers, fires and taps have power or water actions with visible feedback. Passive furnishings offer Investigate when they have no existing cat activity. Sit in the drawer opens the selected unit and uses its top tray as the cat's landing point. Hide in cupboard opens a tall wardrobe or closet and lets the cat sit facing out of its lower compartment. Resized cupboards must have enough interior space. Both actions wait for the cat to get out before closing. Keep these actions ahead of editing tools, and retain the existing bed, seat, play and care commands. The capability review is in [item-interactions.json](data/item-interactions.json).

The room camera uses distant perspective with near-isometric framing, configured in [native-room-camera.ts](utils/native-room-camera.ts). It looks from `[56, 43.6, 56]` toward `[0, 0.9, 0]` and derives its field of view from the existing room span and viewport aspect. The cat's model scale stays uniform during travel; perspective allows slight apparent-size variation. Preserve the agreement between rendering, picking, and saved screen anchors when changing framing.

Keep per-room layouts, stable catalog IDs, normalized placement anchors, furniture proportions, wall orientation, and rug/wall-art ordering. The Decorate header menu stays available as Decorating while editing, with Shop in the same dropdown. The editor toolbar contains Undo and Choose an item, plus a movement/rotation/aiming dock below the room. Opening Shop and returning preserves decoration mode. Invalid drops show the attempted position in orange and blockers or crossed boundaries in red, then explain why the item returned to its saved position. Preserve arrow nudges as an alternative to dragging.

Other shared screens retain the cream background, a back action, readable titles, and scrollable content. Puzzle routes use the white Berry canvas with a 22-point scaled horizontal inset and no bottom tabs. Selection leads with a 30-point Nunito title, difficulty control, a recommended Start/Continue card, and topic rows. Play keeps Back, progress and lives in one header, with a fixed answer dock below the scrolling board. Puzzle learning follows difficulty, topic, lesson and puzzle. Topics show independent practice progress; lessons show available/completed/locked states. Gold boss missions expose three saved stages and a bilingual backstory. Lavender optional challenges show their duration before an explicit Start action. Their requirements and authoring flow are in [puzzle-curriculum.md](docs/puzzle-curriculum.md). Play places the question above its task-specific controls. Timed play keeps Back, the title and hearts, and progress above either the ready card or the persistent clock and scrolling puzzle board. Its action dock stays outside the scroll area, above the bottom safe area. The store has primary tabs, a decoration category sheet, an owned-only filter, and a two-column catalog grid.

Topic lesson lists keep the existing Back action, difficulty, topic title and introduction. A compact Practice + bosses count and green bar summarize required progress. Each lesson is a white card with a two-point cool gray outline, 16-point radius and 16-point padding. The scroll container leaves a 14-point gap over the white or fading mint canvas. Lesson number/state sits above the title and three equal, unboxed activity groups below. When the activity area is narrower than `moderateScale(340)`, labels move below their icons and stretch across each activity column. Activity labels allow up to two lines at a fixed 17-point baseline line height. Keep the full localized names and let long Latvian labels wrap without reducing the font size. Lesson headings wrap naturally, including longer Latvian titles. The individual lesson screen retains its existing summary.

## Elevation & Depth

The world gets depth from rounded meshes, material shading, ambient occlusion, and shadows. Home lighting follows the world clock and weather through `NativeWorldLighting`, plus window and lamp lights. `DefaultLight` remains the fallback for scenes without a clock, including store room previews; it no longer describes the home lighting system.

Ambient occlusion uses radius 0.3 and intensity 1 with medium quality/filtering. Grounding contact shadows follow furniture footprints and rugs. Supported device builds additionally enable cast/receive shadows with a limited light budget; iOS simulators use the fallback because native shadow maps are unsupported there. Preserve readable cat faces and furniture silhouettes through day/night changes. Physical-device shadow appearance and performance need runtime validation.

Puzzle buttons use a four-point dark bottom edge under a vertical berry gradient. Answer choices use two-point outlines with four-point bottom edges. The question has no enclosing card border; spacing separates the question and interaction. Header glows and selected cards provide the other puzzle depth cues.

Shared UI depth stays modest. The home puzzle CTA uses its primary-dark shadow with offset `[0, 3]`, opacity 0.25, radius 6, and Android elevation 3. A faint shadow below the room separates it from the stats. White surfaces and peach outlines do most of the remaining work. Keep scene lighting independent of UI text and icon colors.

## Shapes

Keep the cutaway corner-room silhouette, raised wooden floor edge, rounded cushions, soft paws, and beveled furniture. The current cat is a compact cartoon quadruped with a large rounded head, short neck, continuous torso, thick rounded legs and paws, triangular pink inner ears, small charcoal eyes, hooked upright tail, and a thin red collar with a small bell. Orange/cream, grey/white, and white coats share the same proportions and rig.

The current cat comes from [original_cat.py](scripts/3d/original_cat.py) and [game_cat.py](scripts/3d/game_cat.py). The editable orange rig is [cat-orange.blend](prototypes/cat-model/cat-orange.blend). Keep skin transitions smooth in standing, sitting, walking, sleep, and jump poses. Earlier longhair figurine and real-cat proportion notes are superseded by this implemented character. The older marketing concept is not the runtime mesh specification.

Cat navigation combines floor A* with directed connections across suitable chairs, sofas and low, sturdy objects. [Traversal links](utils/native-cat-traversal.ts) follow the live furniture scale and rotation, validate takeoff/landing space, and sweep each flight against furniture and open doors. Jump costs include preparation and recovery, so a clear floor route stays preferable. Seat crossings use seated arrivals, a short reposition and a seated takeoff. Do not turn fragile decorations or powered appliances into automatic perches.

[Locomotion](utils/native-cat-locomotion.ts) rounds collision-free corners, gives tight turns more time, accelerates and brakes, and shares the same flight curve between planning and playback. Native walking stays synchronized to distance travelled. Hops tuck the paws and reach the landing with the forepaws first. [Turning](utils/native-cat-turn.ts) leads with the head, bends the legs, and steps each paw through turns of at most 45 degrees while three paws stay planted. Native IK preserves foot positions and level soles independently of torso rotation. [Walking starts](utils/native-cat-walk-launch.ts) overlap the final turn steps and keep each paw anchored until its first swing joins the walking gait. Short journeys use shorter strides; traversals restore the normal stride before the next leg. Interrupted turns retain the visible head, body and foot poses. Pause/resume preserves the itinerary clock and turn contacts, and decorating waits for a traversing cat to reach the floor. Reduce Motion skips spatial traversal. Keep [route regressions](scripts/check-cat-locomotion.mjs), [turning regressions](scripts/check-cat-turning.mjs), native playback checks, and Blender paw-contact checks together when changing these behaviors.

UI shapes are rounded rectangles and pills. Square header controls and toolbar tiles use radius 12, standalone store buttons and the name input use 14, and many cards and answer choices use 16. Catalog cards use 24 with inset previews and actions derived from their spacing. The compact stage uses radius 16 with a 12-point horizontal inset; the home puzzle CTA retains radius 20. Berry puzzle buttons and answer choices use radius 16; the recommended lesson panel uses 20. The question has no enclosing rounded card. These baselines are usually moderately scaled. Header pills derive their radius from half their height.

## Nested corners

Use [insetRadius](utils/border-radius.ts) for surfaces that follow the same contour: `innerRadius = max(0, outerRadius − inset)`. The inset is the actual distance between the edges, including border width and padding. Scale dimensions first, then subtract. Give the inner fill, clipping layer and outline the same derived radius.

| Family | Outer radius | Total inward offset | Inner radius at the baseline size |
| --- | --- | --- | --- |
| Fraction strips and decimal grids | 12 | 6 | 6 |
| Difficulty tabs | 14 | 4 | 10 |
| Spatial-grid cells | 12 | 4 padding + 2 border | 6 |
| Trail-tile inset | 25 | 7 offset + 1 border | 17 |
| Store previews and full-width actions | 24 | 10 padding + 2 border | 12 |
| Chart-bar top highlight | 10 | 1 border | 9 |
| Clock dial | 115 | 14 rim | 101 |

All five store-card families share [StoreCardLayout](constants/store-card-layout.ts). Their outer radius is 24 so previews and actions retain soft corners at the existing spacing. Diagram frames use `DiagramFrameMetrics` in [puzzle-theme.ts](constants/puzzle-theme.ts). Store badges and standalone controls within panels are separate shapes, not inset copies of the containing panel.

Native borders already derive their interior curves; do not subtract a border twice. Coincident surfaces have zero inset and share a radius, including full-width progress fills and the compensated home-room viewport. A measuring jug’s fill clip and outline share the same outer bounds; its native border supplies the inner curve. Mathematical polygon vertices and individual tokens keep their own geometry. Raised tile faces and glints follow their intended depth or silhouette rather than inheriting an unrelated panel’s radius.

Native corner review, 2026-11-08: [six-screen preview](docs/qa/nested-corners/2026-11-08/preview.png) covers all five store-card families, diagram controls, trail tiles and 320-point content. [Validation details](docs/qa/nested-corners/2026-11-08/results.json) record the iOS simulator and code checks.

## Components

Reuse the existing components and their state handling rather than copying only their appearance.

- [PetStage](components/pet/PetStage.tsx) coordinates the scene, gestures, object/cat menus, speech, room navigation, stats, and decoration dock. Native hit testing and React Native controls must continue to agree after zooming or moving objects.
- [PetStatsPanel](components/pet/PetStatsPanel.tsx) shows fed, happiness, and wisdom rings with percentages. Tapping a ring opens a detail sheet. The math-stats shortcut leads to topic progress. Stat changes animate while active and respect Reduce Motion.
- Switching play and decoration modes uses a 220 ms fade with a 6–8 point vertical shift on controls. Keep the scene viewport fixed; outgoing controls immediately stop receiving touches and leave the accessibility tree. Reduce Motion and inactive rooms switch instantly. Both bottom actions retain the play footer footprint during the crossfade. Opening Size or Turn and going Back uses a 180 ms fade/8-point entrance with a quicker 100 ms exit; only the floating dock changes height, leaving the scene viewport fixed. Skip nested entrance/exit animations and respect Reduce Motion for both tool and dock transitions.
- Room decoration leads with dragging. The selected-item dock shows a picture, Turn, Size, Put away and More; precise movement and extra tools are secondary. Face other wall stays visible as a full-width action for supporting furniture and wall attachments, alongside their other controls, and hides while resizing. The resize panel shows only the item name, Smaller, Bigger and Back, plus feedback if a resize is blocked. Undo stays visible. Place here clears one selection; the bottom Done decorating action leaves the editor and replaces the puzzle CTA during editing. Exact rotation stays under Fine tune. Valid turns save automatically on a tap, slider release or numeric entry; Back keeps the angle, and Undo can reverse it. See [the research and interaction review](docs/room-decoration-ux.md).
- [RoomActionMenu](components/pet/RoomActionMenu.tsx) uses platform-native menus through `NativeActionMenu`: SwiftUI on iOS and Material menus on Android. Retain grouped actions, disabled/destructive states, and the app's untinted icon artwork.
- [AppIcon](components/ui/AppIcon.tsx) displays the original Blender-rendered artwork from [app-icons.ts](constants/app-icons.ts). The surrounding control supplies its accessible name. [IconText](components/ui/IconText.tsx) replaces supported inline markers with that same artwork while preserving localized word order. Use this family for new game actions. Timed challenges use the front-facing lavender stopwatch with gold controls, `challenge-timer`. Icon render functions live in [render_app_icons.py](scripts/3d/render_app_icons.py). Their editable scenes are in [icons.blend](docs/art/app-icons/source/icons.blend); authoring and bundle checks remain in the [icon guide](docs/art/app-icons/README.md).
- [BossStoryScene](components/puzzle/BossStoryScene.tsx) is retained only for archived art previews. Runtime lessons and result sheets do not import boss scenes or achievement media.
- [TimedChallenge](components/puzzle/TimedChallenge.tsx) offers No timer or a timed final section in the normal Berry layout. Plain text explains the coin difference; there is no reward badge or separate challenge card. Easy, Medium, and Hard limits are three, four, and five minutes. One saved deadline covers the timer-choice puzzle and every later puzzle in the level, including result sheets, leaving the route and picture help. Successful answers stay provisional, with pending coins shown on results; finishing the run commits its progress and pays the double reward together. Timeout costs at most one life once, clears pending progress and coins, and returns to the timer choice. Prior completion stays saved. Wrong answers retain their ordinary one-life cost. Picture help appears only during a puzzle. The persistent clock uses a 24-point stopwatch, a muted label, and purple 20-point bold tabular digits; digits turn berry in the final thirty seconds. Preserve text and timer accessibility semantics alongside color.
- [AppBottomSheet](components/ui/AppBottomSheet.tsx) uses native Expo UI presentation. Standard sheets open at half height; expanded sheets use an 88% fraction on iOS and full height on Android. Preserve scrolling, dismissal, and bottom safe-area padding. The optional `backgroundColor` prop lets puzzle result/help sheets request white while other native sheets retain their existing defaults.
- [PuzzleCard](components/puzzle/PuzzleCard.tsx), [ChoiceButton](components/puzzle/ChoiceButton.tsx), and task-specific puzzle components keep the question, interaction, and feedback distinct. The question uses a 24/32-point Nunito 900 heading without an enclosing border. White answer buttons have cool gray outlines at rest, berry selection, green correct and red incorrect states, and a 64-point scaled minimum height. Answer choices have no corner marks; selected and disabled accessibility states and textual retry/result feedback remain. [ResultOverlay](components/puzzle/ResultOverlay.tsx) supplies the next/retry/help path. Results use a mint-to-white glow, gold reward panel and berry next action. Worked visual help uses the same white canvas and scoped typography. It remains free; preserve its explanation and practice flow.
- [StoreTabBar](components/store/StoreTabBar.tsx) groups rooms, beds, toys, decor, and cat colors. The store opens a category for the current home room. Catalog cards distinguish buying, ownership, placement, and equipping. Purchase/place flows can return to decoration mode with the affected item selected. [StorePreviewSheet](components/store/StorePreviewSheet.tsx) shows a 300-point native room preview, price, purchase eligibility, saved goal, and close action. Purchase buttons have a 48-point minimum height, not a fixed height.
- [GameHeaderStats](components/economy/GameHeaderStats.tsx) places Coins, Streak and Lives in the home account row. The lives metric shows the heart, current count and next-life countdown below the cap. It opens the existing refill sheet. Coins retain the parent-gated coin-pack flow. Puzzle completions do not rerender a reward-collection control.
- [Onboarding](app/onboarding/name-pet.tsx) offers English/Latvian selection, cat coat choice, a named input with a character count, and a bottom continue action. Cloud restore candidates can replace this form with a restore choice. [Settings](app/settings/index.tsx) groups language, graphics/diagnostics, privacy, licenses, and data management in bordered white sections.
- [SplashGate](components/branding/SplashGate.tsx) keeps the cream branding screen and cat visible while assets and initial scenes prepare. Its bar reflects loading progress. Preserve the still-to-native-cat transition and timeout recovery. Prepared home rooms switch directly; unpainted scenes retain the outgoing view until ready.

The live room, store preview, and cat portraits use Filament models. `NativeCatActor` reads authored timings from [clips.json](scripts/3d/clips.json), currently 37 clips per coat including `sit`, `wash`, and `batToy`. Walking follows travel distance; rest/play holds the actual arrival pose. Limb IK is baked during authoring, not a live runtime IK or active ragdoll system. Bullet handles movable toy bodies and contact with the controlled cat and room obstacles. Feeding props and effects, curtains, fridge doors/lights, lamps, weather, and airflow have their own state and pause rules.

Backgrounding and hidden rooms pause ongoing native updates. Reduce Motion suppresses continuous travel and effects such as lightning while preserving action completion. [Simple graphics](lib/graphics-mode.ts) provides still-image room/object/cat fallbacks and explains previews that require 3D. An explicit graphics choice persists; automatic crash recovery applies for the session. Keep fallback care callbacks completing so controls do not remain blocked.

Asset counts and sizes change with the catalog and belong in generated reports or engine checks, not permanent visual rules. Use [native-model-sources.ts](constants/native-model-sources.ts), [inventory.json](scripts/3d/inventory.json), and the actual GLBs to verify coverage. The timed challenge and special-card extension was reviewed in native portrait on 2026-10-20; its [finish review](docs/qa/curriculum-expansion/2026-10-20/finish-review.md) records the passing states and evidence limits.

The boss scene and achievement collection extension was retired on November 8, 2026. Its artwork, authoring tools and feature-specific QA captures have been removed. The legacy achievement route redirects to topics; saved puzzle IDs and rewards remain compatible.

The pre-Berry lesson-list extension has a [direction contract](docs/qa/lesson-progress/2026-10-20/direction.md), [research record](docs/qa/lesson-progress/2026-10-20/research.md) and [finish review](docs/qa/lesson-progress/2026-10-20/finish-review.md), with disposition ship and no material fixes. Native checks passed mixed progress, special-only remaining work, untouched/locked rows, started-with-zero, all difficulty tiers, serialized reopening and narrow Latvian. The final card boundaries also passed all three native cases; the final label-fit bundle passed the targeted narrow Latvian, Medium and Hard case, with the matching proof captures and production Easy capture updated; see the [production cards](docs/qa/lesson-progress/2026-10-20/lesson-cards-production.png). See the [mixed list](docs/qa/lesson-progress/2026-10-20/lesson-progress-mixed.png), [specials left](docs/qa/lesson-progress/2026-10-20/lesson-progress-specials-left.png) and [narrow Latvian](docs/qa/lesson-progress/2026-10-20/lesson-progress-narrow-latvian.png). All 180 lesson model-state checks and the icon checks passed. This evidence does not certify physical devices, Android rendering or large accessibility text. The broad game test suite has an existing failure in `check-pet-stat-animation` at the replay navigation assertion, which expects a path but receives `dismissTo`; it did not pass in full. The single detector run recorded only an advisory for the existing `#E8FAF8` completion box, with no new lesson-list drift.

The [Berry verification record](docs/qa/berry/2026-11-01/results.json) records passing iOS simulator checks for selection, selected answers and results, saved lesson progress, all difficulties and narrow Latvian. Final review confirmed readable wrapped lesson labels and a white native result-sheet inset. See [selection](docs/qa/berry/2026-11-01/selection.png), [selected answer](docs/qa/berry/2026-11-01/puzzle-selected.png), [result](docs/qa/berry/2026-11-01/result.png) and [narrow Latvian lesson](docs/qa/berry/2026-11-01/lesson-narrow-lv.png). Bottom fixture controls and the floating Expo gear in these captures are development controls. Android-device rendering was not verified.

Technical behavior and checks are documented in [native-room-engine.md](docs/native-room-engine.md) and [cat-animations.md](docs/cat-animations.md).

## Do's and Don'ts

- Do keep Berry scoped to puzzle selection, play, results and picture help. Preserve the pet home, store, Settings and global navigation definitions.
- Don't add bottom tabs to the puzzle flow or apply Nunito through shared `IconText`, `MathStatsChip` or `AchievementsLink`.

- Do keep the ten-task lesson path, durable timer, saved puzzle identities and ordinary cat-care coins. Do not restore boss gates or the retired collection.
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

Puzzle refinement, 2026-11-01: selection, play and result header glows now fade from mint `#D7F5E9` to white. Active questions omit the small lesson title, puzzle-count row, type label and coin badge. Progress remains in the accessible header bar; earned coins appear in the result. Berry actions, essential task instructions and pet home are unchanged.

Puzzle header refinement, 2026-11-01: lives use one heart and the current numeric count in the existing refill button. Session progress is one 16-point continuous lime bar on a gray rounded track, with a lighter inset highlight. Fill follows completed tasks, initializes from saved progress and respects Reduce Motion. Home lives and lesson activity segments are unchanged.

Difficulty switching, 2026-11-01: a single Berry indicator slides across the persistent Easy/Medium/Hard control over 240 ms with cubic deceleration. The recommendation and topic list enter with a 220 ms fade and 14-point horizontal shift in the selected direction. Changing difficulty updates route parameters in place, preserves the selector and scroll container, and does not push or replace a screen. Both animations respect Reduce Motion; initial load does not animate.

Shared action accent, 2026-11-01: the home Solve a Puzzle button and startup loading bar now use the same Berry `PuzzleColors.primary` (`#C32468`) as puzzle actions. The home button shadow uses `PuzzleColors.primaryDark` (`#931445`), and its loading spinner uses Berry as well. Home layout, typography, cream background, room artwork and the teal Finish decorating action retain their existing styles.

Topic trail, 2026-11-02: soft dimensional tiles follow a solid lavender route with rounded right-angle turns. Stable paired stops alternate between left and right, with intermediate stops linking them. The recommended tile retains its raspberry face, halo, localized start/continue/replay tag and actual lesson title. Completed tiles remain cream with green check seals; future tiles retain pale mint faces and lock icons. Decorations and the rendered finish medallion are removed from every track. The finish remains a localized text label beyond the last level. The layout reserves space beside the active tile for its title; below 300 points of available trail width, the title moves below the tile and the route uses wider loops around that space. The current level stays visible on entry, and the fixed Play action is unchanged. Reduce Motion still disables the halo pulse. The retained Blender files and sprites are not loaded by the trail. See `docs/qa/rounded-path/2026-11-02/results.json` for simulator and layout verification.

Topic selection continuation, 2026-11-01: a mint card below the difficulty picker restores the saved level title, puzzle progress and Berry Continue playing action. It opens the next unfinished puzzle directly, prioritizes an active challenge, and continues the most recently played topic after a completed level. It follows the selected difficulty, remains hidden before any activity or when that difficulty is finished, and omits story/boss captions.

Topic route variety, 2026-11-07: each of the eleven topics has its own authored sequence of tile positions, varying distances between stops, corner radii and turn heights. Short hops and broad loops alternate with occasional longer stretches containing extra rounded turns. These routes keep the solid lavender rounded-turn style, dimensional tiles and opposite-side lesson titles. Topic identity determines the route, so unlocks and reopening never shuffle the stops. Narrow layouts keep extra space below each tile for localized titles. Current-level entry scrolling uses the same topic layout as the rendered trail.

Everyday math, 2026-11-07: five additional topics reuse Berry controls and the existing lesson paths. Diagram givens use readable analog clocks, labelled bar-chart scales, outlined polygons, numbered transformation grids, pretend prices, graduated liquid vessels and cuboid dimensions. Berry identifies a marked position; text and geometry also carry meaning. Diagrams stay still while answering. Picture help presents a separate worked example; screen-reader descriptions include the available givens. Charts and price groups fit narrow screens, and shape/vessel groups wrap.

Chart bars, 2026-11-08: everyday and Cat-plan charts share soft berry, teal and lavender columns with rounded upper corners, a solid face and one broad inset highlight. All shading stays inside each bar's measured height, so its upper edge still aligns with the correct gridline and every base stays on zero. Missing bars retain a neutral dashed question-mark placeholder. Keep A/B/C labels, axis ticks, accessible givens and the existing value scale.

Learning diagrams, 2026-11-08: measuring jugs use a pale glass body, a recognizable handle, teal water and an external scale. The water surface remains horizontal at the exact amount/capacity ratio, with a fixed 200-point scale independent of the outline. Reading exercises hide the amount caption. Clock faces have a thick golden rim, white dial and colored hands; digital times use a quiet inset panel. Counting polygons retain exact vertices with solid golden or blue fills and one rounded inset highlight parallel to the upper edge, with the restrained light color of the progress bar. Rotated squares follow the upper-right diagonal. Large side facets are removed so flat shapes do not look folded. Cuboids distinguish top, front and side with flat lavender faces and tonal edges. Spatial grids use rounded cells in a light frame. Shared `DiagramColors` keep these materials and empty fraction pieces consistent; counting actions use Berry controls. Unit grids, fraction partitions, coordinate axes and number-line ticks retain precise geometry. This follows the clarity, limited detail and reusable math-visual principles in https://blog.duolingo.com/shape-language-duolingos-art-style/ and https://blog.duolingo.com/developing-math/, using Math Mews colors and original geometry.

Action-led puzzle motion, 2026-11-07: sharing deals one object per tap, keeps the undealt pool in place and exposes unequal intermediate groups before a full round. The small cat portrait stays mounted while its gesture restarts. Place-value exchanges retain all ten unit identities as loose squares gather into a rod or return to the ones column; quantity-changing operations redraw directly to avoid implying an exchange. Board movement takes 280–400 ms and cancels on newer actions. Correcting a mistake selects the modest proud nod, including at lesson endpoints. Ordinary cat reactions use a single 750 ms performance and never gate Continue. Reduce Motion settles teaching objects immediately and holds one cat pose; inactive boards do not animate.


Lesson simplification, 2026-11-08: the reward collection, adventure movies and milestone performances are removed from navigation and results. Older collection links return to topics. Cat plans appears after the regular subjects, separated by a divider, in topic selection and has three ten-task plans per difficulty: Prepare a picnic, Make a reading corner, Plan a cat party. Tasks use existing clock, bar, shape, money and capacity diagrams. The final three tasks retain the existing timed/untimed choice. Completion gives a short practical outcome, ordinary coins and one usable decoration on the first completion of each plan. Saved legacy boss questions remain ordinary tasks in the continuous path, never a separate mode or gate.

Mistake recovery, 2026-11-08: a rejected unchanged answer offers Try again, returning to the task without clearing work or charging a life. The answer must change before checking again. Empty lives replace the disabled check with Refill lives to try again and explain that completed tasks are saved. Back to path remains available after mistakes, empty lives and timer failures. Result-sheet navigation waits for native dismissal.

Cat-plan furnishings, 2026-11-08: the current plan previews its decoration above Play. First completion shows the actual item in the result and offers Place in house, opening the existing room editor with that item selected. Nine plans have nine stable inventory rewards; their receipts persist with the pet save through replays, cloud restores and learning resets. Existing completed plans receive missing rewards on load. Ordinary lesson feedback keeps the cat; the furnishing is the focal image only at these plan endpoints.

Shopping clarity, 2026-11-08: Cat-plan price diagrams pair each existing item illustration with a localized name and price, without a button-like border. Prompts name the purchase and hints address the current calculation. Screen-reader descriptions pair every item with its price. Worked examples use different amounts. See `docs/qa/shopping-clarity/2026-11-08/` for native English and narrow Latvian/Russian evidence.

Friendly math visuals, 2026-11-08: the supplied Duolingo references guide simplification toward flat color, bold silhouettes and generous scale. Everyday diagrams use no gloss gradients. Measurement rectangles use larger equal units, pale blue interiors, blue grid lines and bold colored boundaries; dimensional labels use dark teal. Coordinate boards use the same pale blue material and blue point markers with dark labels. Their plot spans up to 280 points even for short ranges, with 28-point markers centered on exact coordinates. Geometry and bridge controls share the two-point outline and four-point bottom edge of the puzzle controls. Mathematical boundaries, touch coordinates and undisclosed values stay authoritative.

Fraction, number-line and balance consistency, 2026-11-08: fraction pies, equal strips, matching grids and decimal units now share the geometry palette: solid blue quantities with clear boundaries. Strips and decimal grids use white empty regions, softer blue rules and a rounded pale-blue frame with concentric inner corners (12-point outer radius minus 6-point inset gives a 6-point inner radius); pies retain pale blue empty regions and teal boundaries. Partition spacing, unit counts and touch coordinates remain unchanged; the model’s outermost corners receive decorative clipping. Integer, signed and fractional number lines use pale blue stages, bold teal rules and blue markers centered on their original values. Berry remains the action color. Both arithmetic balances and equation boards use the same original scale with equal blue pans, a golden beam and a broad base; zero remains explicit on an empty equation pan. Related fraction, decimal and function-machine controls use the shared tactile bottom edge. Existing touch mapping, answer privacy, animation and Reduce Motion behavior are preserved.

Diagram color families, 2026-11-08: geometry and general number lines retain blue; fraction pies, matching grids, equivalent strips and fraction number lines use lavender; decimal grids and place-value blocks use the same bright gold as the shapes, with a pale cream frame. Each family has shared fill, pale background, grid and edge tokens in `DiagramColors`. Reference and learner models share a color, as do different decimal units. Empty strip/grid cells remain white. Berry actions, green/red feedback, exact geometry and concentric corner rules are unchanged. This family palette supersedes the earlier all-blue quantity treatment above. See [the puzzle style guide](docs/PUZZLE_STYLE_GUIDE.md#palette) and [native palette examples](docs/qa/diagram-palette/2026-11-08/preview.png).

Chart layout, 2026-11-08: bar-chart tasks use tighter question and scroll spacing. Plot heights follow the viewport while retaining at least 20 scaled points per tick interval; larger text and dense scales expand naturally. Subject labels use bold 16/22 type, scale values bold tabular 14/20, and A/B/C heavy 17/24. The shared Blender cat-head icon faces forward. Answer targets and the fixed check dock retain their sizes; scrolling remains available when needed. [iPhone 15 captures](docs/qa/chart-phone-layout/2026-11-08/preview.png) and [verification details](docs/qa/chart-phone-layout/2026-11-08/results.json) cover English, Latvian, Russian and accessibility-sized text.

Clock and ribbon refinement, 2026-11-08: clock tasks share the compact diagram spacing and use a viewport-sized dial. Time labels are treated as short answer choices so three times can share a row. Larger text falls back to full-width choices before a time would wrap. Dial numbers scale together with the face and hands, preserving hour positions. The counted blue and red ribbons are Blender fabric bows with rounded loops, wrapped knots and V-notched tails, viewed from the front. Their source remains in `prototypes/puzzle-objects/puzzle-objects.blend`; `build-puzzle-objects.py -- --only ribbon-blue,ribbon-red` rebuilds them while retaining the other saved scenes.

[Clock and ribbon native review](docs/qa/clock-ribbon/2026-11-08/preview.png) verifies the standard iPhone 15 layout, with [test details](docs/qa/clock-ribbon/2026-11-08/results.json) for translations, larger text and preserved Blender scenes.

Equation and ratio clarity, 2026-11-08: ratio questions now name bottles and litres, with identical bottle drawings for small counts, labelled numerals for large counts, a known total and one missing total above the keypad. Equations show only the current balance, explain x and use verb-labelled actions. A sentence reports the last action. Once x is isolated, the operation controls give way to the instruction to Check answer. Reset clears that status. This supersedes the earlier arithmetic-arrow and multiple-question-mark treatment. Use `RatioTableModel` and `EquationBoardModel`; see [the teaching recipes](docs/PUZZLE_STYLE_GUIDE.md#explain-the-task-before-the-method).

Puzzle reward cleanup, 2026-11-08: every untimed task uses the ordinary difficulty reward, including tasks retained from older grouped lessons. The app catalog has practice and challenge kinds, with no story metadata or mission-specific UI/companion messages. Original IDs and grouped deep links remain compatible with saves. Enabling the timer and finishing the remaining three tasks pays twice the ordinary reward; untimed play has no multiplier. All 540 hosted reward rows are normalized, and all 339 timer scopes passed payout checks in sandbox and production. See `supabase/deployments/2026-11-08-regular-puzzle-rewards.json`. This supersedes earlier boss reward and presentation notes in this document.

Immediate topic entry, 2026-11-08: topic paths mount with the current level already visible, using final measured content bounds and an initial native content offset. Entry and return from play issue no delayed scroll command or scroll animation. Returning reuses the viewport measurement and resets only the scroll view before painting; normal manual scrolling remains available. Narrow layouts and the final level use the same bounds as the rendered path.

Android topic-entry verification, 2026-11-08: the Android 16/API 36 emulator passed immediate level 5/10 entry, a 320-point layout, normal manual scrolling and Android Back returning from play. Frame samples show the current tile in its final position as the path first appears, with no scroll from the top. No Android-specific code change was required. Native captures, viewport bounds and build/source hashes are in `docs/qa/topic-entry/2026-11-08/android/`.

Android puzzle-motion check, 2026-11-08: four consecutive transitions passed functional checks in an Android 16/API 36 emulator, including cumulative progress, cleared answers and stable header/dock bounds. Smoothness remains unverified: software rendering dropped frames, and a hardware-rendered rerun showed a blank play area plus a later native crash during development reload. The cause was not isolated. See `docs/qa/puzzle-motion/2026-11-08/android/README.md`; do not treat this as Android-device performance approval.

Lesson activity mix, 2026-11-08: every ten-task level has at least three activity formats, at most five tasks of one format and no run longer than two. Alternate answer controls reuse the lesson's givens and stable puzzle IDs. Written answers use a small keypad with localized decimal punctuation, time entry, erase and clear; proposed answers use the existing true/false controls, and model-based choices use the existing answer buttons. The shared Check action, mistake recovery, lives and rewards remain in the play screen. Model previews keep the quantities needed for the alternate question visible. See [the activity-mix verification](docs/qa/activity-mix/2026-11-08/results.json) for curriculum checks and iPhone simulator evidence in English, Latvian and Russian.

Android puzzle-motion follow-up, 2026-11-08: backported the Screens listener initialization/teardown fix and Reanimated settled-prop synchronization fix. Ten debug cold launches, three final optimized cold launches and four optimized puzzle changes passed with no native crash or persistent blank screen. Pixel checks verified progress remains filled after idle, scrolling and typing. Fade/slide and fill interpolation were reviewed from native captures. Emulator frame drops remain; physical-device frame pacing is unverified. Evidence is in `docs/qa/puzzle-motion/2026-11-08/android-fix/`. Both fixes require a native rebuild.

Android animation performance follow-up, 2026-11-08: the continuous progress fill translates fixed-size rounded layers instead of animating width. A persistent scroll view resets to the top immediately while only the new task content remounts. Its 280 ms, 28-point arrival starts after layout at 85% opacity, preserving readable first paint; Reduce Motion starts fully visible and undisplaced. The optimized emulator bar comparison reduced native deadline misses from 12.83% to 7.69%. Task scroll reset, cumulative fill, cleared answers, stable header/dock and normal/reduced-motion captures passed. Occasional long native buffer-presentation stalls remain, and physical Android frame pacing is unverified. Rejected SVG and portrait-pause experiments are not retained. See `docs/qa/puzzle-motion/2026-11-08/android-performance/README.md`.

Android result handoff, 2026-11-08: native result sheets keep their existing closing animation and dismissal-before-navigation contract. Filament listeners now cancel without waiting for an in-flight 3D frame; owned callback snapshots preserve native resource lifetime and stale subscriptions retain only weak references. This removes the multi-second JavaScript stall when a result portrait unmounts. Fifteen optimized stress handoffs passed, and four final-binary 3D checks committed the next route 10–25 ms after the close promise, with median 17 ms, versus roughly 5 seconds in the matched 3D baseline. Back/swipe dismissal, duplicate taps, exiting a result and normal/reduced motion passed. A cold emulator GPU presentation spike remains in the evidence, so physical-device frame pacing is unverified. This native fix requires rebuilding Android. See `docs/qa/puzzle-motion/2026-11-08/android-handoff/README.md`.
