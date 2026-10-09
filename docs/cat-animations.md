# Adding cat animations and room interactions

The exporter and app both read `scripts/3d/clips.json`. Each entry is `[frameCount, fps]`. A new key automatically becomes a `CatAnimationId` and can be used by a room activity step. All three cat skins must contain the same clips.

1. Add the clip's frame count and rate to `scripts/3d/clips.json`.
2. Author its pose in `scripts/3d/game_cat.py`. Use `scripts/3d/cat_model.py` for procedural controls and expressions. Keep the cat's root stationary; room navigation controls translation, heading and jump height. Recover to a compatible pose at the end of a one-shot clip.
3. Use the clip in `utils/room-activities.ts`. A step declares its animation, duration, movement and target. Add a one-shot clip to `ROOM_ONE_SHOT_CLIPS` in `constants/cat-room-motion.ts`; other room clips loop until their step ends.
4. For a new furnishing interaction, add one entry to `constants/room-commands.ts`, its target predicate and its plan builder. This registry supplies the cat menu, furnishing menu, icon, section and activity type. Add its label to both locale files. Menu eligibility must stay cheap; solve navigation when the command starts.
5. Rebuild the three native cats:

   ```sh
   BRAINPET_BLENDER_ASSET_DIR=/tmp/brainpet-native-blends \
     /Applications/Blender.app/Contents/MacOS/Blender --background \
     --python-exit-code 1 --python scripts/3d/export-native.py -- --cats
   npm run assets:cat-thumbnails
   ```

   Follow the native startup capture workflow in `docs/native-room-engine.md` if the cat's idle appearance changes. Keep launch artwork synchronized with the shipped GLB.
6. Run `npm run animations:check`, `npm run typecheck` and `npm run lint`. Add a regression for the interaction's rendered arrival, interruption, background pause and Reduce Motion. Check it on the iPhone simulator, including a rotated/scaled furnishing beside a wall.

An activity step can use any authored clip directly:

```ts
{ position, mood: "idle", animation: "wash", durationMs: 6000 }
```

The room scheduler owns completion. Native steps wait for the visible cat to finish, rather than letting a JavaScript timer advance ahead of rendering. Callbacks that award food or other care effects must only run after a successful command. Each departure step keeps its source furnishing's instance ID when the next command targets something else.

For a command initiated by a menu, pass the timestamp returned by `onRoomInteraction` into `startActivity`. This prevents a delayed save-context render from treating the command's own tap as a cancellation.

# Catalog performance

Shop and decoration pickers use two-column virtualized lists, starting with six cards. Catalog pictures are still images; opening a detail preview mounts its native scene. The splash loader downloads catalog images and warms the Expo Image memory/disk cache. Decoded startup thumbnails have a 12-million-pixel budget, about 46 MiB for RGBA pixels. Larger images stay on disk. Native scene models remain bounded and load on demand.
