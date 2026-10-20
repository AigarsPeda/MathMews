# Shared achievement media

`npm run assets:achievements` derives 180 gray previews and 180 transparent, looping GIFs from the shipped Blender scenes. Originals retain their editable Blender sources. Each GIF contains the two-second ending at 384 × 240, with the authored eight-frame-per-second timing. GIF delays alternate 120/130 ms to retain the two-second duration. The original and lesson boss packers regenerate affected share media after a render.

The 180 GIFs total 40.88 MiB; each stays below 1 MiB. These assets are bundled for offline exports. Gallery thumbnails do not decode GIFs. Only the selected in-app ending atlas is played, and only the selected GIF is prepared for sharing.

`utils/share-boss-achievement.ts` checks current completed puzzle IDs, resolves the bundled GIF to an app-local file with Expo Asset, and opens Expo Sharing with `image/gif` and `com.compuserve.gif`. The file contains the animation only. It carries no account, wallet, lives or completion data. Canceling the native dialog is treated as dismissal, with no success claim or game write. A destination app decides how to display the received GIF; this is not an integration with a social network's sticker library.

The native dependency is `expo-sharing`, installed for Expo SDK 57 and included in the rebuilt iOS development app. Its inbound share extension remains disabled. No Supabase migration is required. Local-file sharing is supported by Expo on iOS and Android; this implementation reports unavailability on web. See the [official Expo Sharing API](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/).

Run `npm run test:achievements` for grayscale, transparency, file budget, timing and retained motion across all 180 exports. Run `node scripts/check-curriculum.mjs` for lesson ordering and eligibility, and `node scripts/native/check-puzzle-drag.mjs --achievements --device <UDID>` for production UI with isolated saves. Native sharing tests open and cancel the share sheet without selecting a recipient.
