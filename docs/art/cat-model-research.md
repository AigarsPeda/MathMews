# Feline body and room depth

The head retains the existing mesh, proportions, facial attachments, ear material assignments, coat markings and expression controls. The body is fitted to that head with a narrower chest, a tucked standing waist and continuous tapered limbs. Front elbows bend backward; rear knees bend forward and hocks turn back toward the heel. The joint curves and standing torso morph are baked into the editable Blender clips.

Blender's [Rigify paw documentation](https://docs.blender.org/manual/ru/4.5/addons/rigging/rigify/rig_types/limbs.html) describes separate front and rear paw chains. It provides a useful reference for their joint structure. The existing procedural pose controls remain the animation source for this app.

Two possible external starting models were found: [squibblejack's rigged cat](https://blendswap.com/blend/23047) and [LazyGraph's rigged feline base mesh](https://blendswap.com/blend/27158). Their authors list them under CC0. Neither file was downloaded or imported; compatibility with this app has not been tested.

Room rendering sorts floor objects by their visible ground contact. The contacts are measured from all 273 padded item sprites by `scripts/3d/measure-room-depth.mjs`. Moving objects and dragged items update their depth on the animation thread. Wall decorations and rugs stay behind floor objects; a sofa supports the cat's depth while it sits or sleeps on the cushion. Saved order resolves objects at the same depth.

Ball, yarn and feather props have separate transparent texture pages and share the cat's playback clock. Blender holdouts preserve the portions covered by the cat's paws. Projected ground contacts determine prop depth independently of bounce height. Each active texture layer retains its current and next page.

This is sprite-based depth and occlusion. It does not add a full 3D collision simulation to the room.

Checks include grounded walks, joint direction and torso attachment, all procedural limb connections, saved curve/morph playback, care recovery, box containment, synchronized prop frames, foreground/background crossings and menu priority. The existing head was compared against the previous model with order-independent geometry fingerprints.
