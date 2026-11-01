# Trail finish marker

`milestone.blend` and `renders/milestone.png` are the editable Blender source and transparent render for the live gold finish marker. The app uses `assets/3d/trail-props/milestone.webp`.

Rebuild it with `npm run assets:trail-props`. The shared geometry in `scripts/3d/build-trail-props.py` also supplies the yarn, pencils and fraction pieces used by the [current sixty-asset collections](../trail-collections/README.md).

The superseded sixteen-prop exports and previews were removed. The current collections and their source scenes remain in `prototypes/trail-collections/`. Run `npm run test:trail-collections` to check the collection sprites, finish marker and track layouts.
