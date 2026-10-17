# Making room decorating easier

Research and implementation review, 17 October 2026.

The decorating task should feel like moving toys around a dollhouse. A child chooses a piece of furniture, drags it somewhere, changes its appearance if wanted, and returns to playing with the cat. The screen should explain the next action without requiring knowledge of editors, layers or degrees.

This review uses official game manuals, publisher support pages and platform guidance. It is a desk review and a native simulator check, not a usability study with children. The findings below describe documented interfaces. Their application to BrainPet is our design judgment.

## What established games do

| Reference | Documented behavior | Decision for BrainPet |
| --- | --- | --- |
| Animal Crossing: Happy Home Designer | The official manual shows a picture catalog, touching furniture to select it, dragging to move, and tapping to rotate. A separate trash destination removes furniture. Advanced duplication and other features unlock later. | Lead with direct manipulation and pictures. Give frequent actions a small, visible vocabulary. Keep advanced tools separate. Use a storage box here because our action returns an owned item to storage. |
| Toca Boca World | Home Designer divides furniture, objects and surfaces into categories and subcategories, including rooms. Its Style Selector offers an empty or furnished starting home. | Keep the placed-item picker visual and explain what it contains. Keep buying in Shop. A future inventory drawer and optional starter layouts deserve a separate change. |
| The Sims 4 | EA documents selecting an object in Build Mode, repeated fixed-angle turns and placement. Free rotation has a separate control sequence, with controls varying by input device. | Offer large left/right quarter-turn buttons first. Keep arbitrary angles under Fine tune. Save accepted turns automatically; collision checks still reject blocked angles. |
| Apple interaction guidance | Gestures should support direct manipulation and immediate feedback. Undo supports exploration by making actions reversible. Touch controls should suit the device. | Teach the existing drag gesture, keep directional alternatives, and expose Undo in the editor rather than hiding it in a sheet. |

Sources: [Nintendo manual, sections 10–12, PDF pages 22–28](https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_3ds_2/animal_crossing__happy_home_designer/ElectronicManual_Nintendo3DS_AnimalCrossingHappyHomeDesigner_EN.pdf), [Toca Boca decoration menu](https://tocaboca.helpshift.com/hc/en/3-toca-boca-world/faq/138-what-s-new-in-the-home-designer-decoration-menu/), [Toca Boca Style Selector](https://tocaboca.helpshift.com/hc/en/3-toca-boca-world/faq/259-introducing-the-style-selector/), [EA rotation controls](https://help.ea.com/en/articles/the-sims/the-sims-4/how-to-rotate-sims-4/), [Apple gestures](https://developer.apple.com/design/human-interface-guidelines/gestures), [Apple Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo).

These games support the same broad direction, but they do not prove that one layout will work for our audience. In particular, a stylus interface and a controller interface have different constraints from a phone touchscreen. We are adopting their separation of simple actions and advanced tools, rather than copying their exact button arrangements.

## Problems in the previous flow

The app already supported direct dragging, but its most prominent instructions taught movement with four buttons. The child had to translate an intended furniture position into a series of Left, Right, Up and Down taps.

The Options menu mixed unrelated tasks. Magnifying glasses meant changing furniture size, while similar arrows meant changing draw order. “Send backward” could easily sound like moving a rug toward the back wall. Rotation appeared both in the menu and as a numerical angle button. There was no clear reason to prefer one entry point.

“Done” finished working with a selected item and also left decoration mode. Meanwhile, a much larger red puzzle button competed with both actions. “Remove” and the trash icon suggested losing an item permanently even though it stayed owned. Undo existed, but was hidden inside Choose an item.

The picker also needed more truthful instructions. It lists objects already placed in this room; it is not the full collection of owned furniture. Instructions should not imply otherwise.

## Implemented interaction

1. Enter Decorate. The header says Decorating, and the bottom action becomes Done decorating. The puzzle action returns after leaving the editor.
2. Drag furniture directly in the room, or use Choose an item to pick a picture. The picker explains that these are the items currently in this room.
3. The selected item has its picture and name in the dock. A short hint explains dragging and releasing. Place here clears that selection so another item can be chosen. Accepted moves are already saved; this button is not a separate save transaction.
4. Turn opens Turn left and Turn right. Accepted quarter turns save immediately. Fine tune exposes the slider and decimal angle field; releasing the slider saves once, while valid numeric input saves as it changes. Back leaves the tools and keeps the angle. Blocked angles never overwrite the last accepted rotation. There is no confirmation or Cancel button for furniture rotation.
5. Size shows only the item name, Smaller, Bigger and Back, with minus/plus artwork instead of magnifying glasses. The item picture, Place here, drag instructions, wall action, extra Size heading and standing size hint are hidden in this panel. Existing item-specific limits and room boundaries still apply, with feedback if a resize is blocked.
6. Put away uses a storage box, removes the selected placed instance and closes its controls. It does not revoke ownership. The picker explains where to find stored items in Shop → Owned. Undo can restore the placement.
7. More contains Move a little and any item-specific extra tools. The four directional buttons remain available there, and existing screen-reader movement actions on objects remain available. Layer order, style variants, power, spotlight aim and wall-facing options keep their existing callbacks.
8. Undo is visible beside Shop and Choose an item. It stays available during furniture rotation and closes the rotation tool when used. It is temporarily disabled during a spotlight preview, which still has Cancel. Existing ownership checks continue to prevent Undo from restoring a revoked purchase.

Face other wall appears directly in the dock for every supporting item, including wardrobe furniture, windows and posters, without opening More. It hides while resizing to keep the Size panel focused. Its full-width button leaves room for the complete label in English and Latvian. Window decorations keep their wall-switching action rather than receiving unsupported free rotation. Switching the selected object resets its local tool panel, so a new selection does not inherit a previous object's Size or Move a little view.

## Engineering boundaries

The change reuses the native geometry picker, live drag previews, collision resolver, accepted-drop persistence, virtualized picture picker and room history. The editing dock grows upward over the existing footer space without changing the scene viewport. This matters because a viewport shift can change screen-to-world placement.

The dock routes actions using semantic IDs instead of translated labels or icon names. Platform menu IDs remain positional, preserving the existing native adapter. Main controls have word labels and minimum touch areas of at least 44 points, usually 48–60. Labels can wrap; the selected-item heading can wrap its placement button on narrow screens or with larger text. English and Latvian strings cover the same flow.

Automated checks exercise both languages, disclosure of Size and Move a little, exact action callbacks, disabled size limits, window behavior, quarter-turn wraparound, automatic saving, invalid numeric input, slider-release persistence and Back without cancellation. Existing checks cover scene projection, collision feedback, placement persistence, purchase-to-editor handoff and ownership-safe history. Native inspection is still necessary for actual layout and menu presentation.

## Follow-up work worth testing

An owned-inventory drawer would remove the Shop → Owned detour when adding something already purchased. It should clearly separate Place from Buy and show how many copies remain available. That is the strongest next flow improvement; the current placed-item picker should not be relabeled as inventory until it actually contains unplaced items.

Optional room templates could help children who find a blank room intimidating. Preview a template before applying it and preserve Undo. Never replace a child's arrangement just because a starter layout was selected accidentally.

A short, dismissible first-use demonstration could show a furniture piece being dragged. Build it only if observation shows that the static hint is insufficient. Avoid teaching every advanced tool at once.

Before declaring the flow child-tested, observe children from the actual target age range with a parent or guardian's consent. Use neutral tasks: move a rug beside a bed, make it bigger, turn a chair, put something away, undo it and finish decorating. Record whether the child discovers dragging, distinguishes Put away from deleting, finds Undo and exits without help. Test on a small phone, with larger text and with a child who prefers the directional controls. Ask them to show what they would do; do not lead them toward a particular button.

Success means completing those tasks with fewer prompts and accidental actions. This review provides a testable design, not evidence that those outcomes have already been achieved.

## Verification for this change

- TypeScript and ESLint passed for the changed native screens and controls.
- The full game check suite passed, including the new control-flow checks. After changing the home finish action, its Home integration checks passed again.
- On the running iOS client, checked the picture picker, switching selected items, the Size panel, resize → Undo, Put away → Undo, More → Move a little, and the dedicated finish action. The rug returned after both Undo checks. The follow-up automatic-save check rotated the rug to 90°, left and reopened Turn with 90° still selected, then restored the test angle using Undo directly from the rotation tool.
- English and Latvian control flows are covered by the new automated checks. Native screenshots were inspected in English. Android presentation, the full system text-size range and observation with children remain to be checked on their actual devices.
