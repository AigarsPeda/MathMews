# Feline model references

The current connected cat skin uses the user's standing and seated cat photos to guide the neck-to-shoulder line, ribcage, waist, croup and tucked seated hips. The face remains stylized. Front elbows bend backward; rear knees bend forward and hocks turn back toward the heel.

Blender's [Rigify paw documentation](https://docs.blender.org/manual/ru/4.5/addons/rigging/rigify/rig_types/limbs.html) describes separate front and rear paw chains and informed the joint structure. Shared procedural pose controls remain the animation source.

Two external starting models were considered: [squibblejack's rigged cat](https://blendswap.com/blend/23047) and [LazyGraph's rigged feline base mesh](https://blendswap.com/blend/27158). Their authors list them under CC0. Neither model was downloaded or imported.

The app now uses native Filament geometry and Bullet toy collisions. Thumbnail ground-contact measurements still preserve the original saved-placement projection; live cat/furniture contact and object depth come from the 3D world. The earlier sprite depth and separate toy-texture approach has been removed. See [current model and engine notes](../native-room-engine.md) and the review images in `native-cat-rebuild/`.
