# Achievement comedy

The achievement is a short visual joke earned by finishing a boss mission. It is separate from the instructional mission animation. Learning checkpoints, completion IDs, rewards and save migration retain their existing behavior.

The collection now uses large, single-column movie cards. Locked cards explain the three-stage requirement and open the appropriate lesson. The Collected filter makes earned movies easy to find. Only the selected movie animates. Pause, replay, background handling and Reduce Motion support belong to `AchievementMovie`.

## Story direction

Each movie holds its setup, performs one exaggerated action and holds the punchline before looping. No captions or sound are required to understand the action. English and Latvian titles and descriptions accompany the player.

| Plot | Action and payoff |
| --- | --- |
| Who needs a bridge? | A character prepares to cross, then leaps over the perfectly good bridge. |
| That wasn't in the plan | Opening a book produces an enormous pop-up fish. |
| Just a little scarf | The scarf grows until its maker is wrapped in a striped outfit. |
| Act natural | Gears race; the character turns toward the camera as it moves closer. This is the single meme-style plot family. |
| The hat takes a holiday | A rising balloon carries off the passenger's hat on a string. |
| I can carry one more | A small delivery becomes a swaying tower of parcels. |
| Captain Quack | An oversized rubber duck takes over the tiny boat. |
| The fanciest hat stand | A fountain sends a hat up to the top of its water jet. |
| Accidental dance star | A character spins and hops beside the newly working light, then faces the viewer. |
| A slightly enormous victory | A trophy grows far larger than its recipient expected. |

These are ten plot families, not 180 independently written stories. The nine mechanism plots use each of the existing 18 settings and casts. Each world's finale gets the oversized trophy plot. The authored cat rig, warm materials, and physical props preserve the game's visual identity.

## Rebuild

1. `npm run assets:achievement-scenes` renders 24 RGBA poses per scene to `/tmp/brainpet-achievement-comedy` with Blender. The Python source supports `-- --id picnic-bridge` after the npm command, `--shard 0/2`, `--missing`, and `--preview`. Preview renders only four poses and is insufficient for packaging.
2. `npm run assets:achievements` crops using the union of all poses, then writes 512×448 GIFs, colored posters and grayscale locked previews. It also registers every asset for offline use. Selective packaging uses `-- --id picnic-bridge`.
3. `npm run test:achievements` checks registration, dimensions, grayscale previews, posters, duration, unique animated frames, transparency and file size.

GIFs last five seconds. Their static beginning and punchline have longer delays than the moving frames. Duplicate static poses may merge during GIF optimization. The app and native share sheet use the same GIF; reduced motion uses the poster. Sharing includes only the artwork, rechecks saved completion, and does not spend lives or grant coins.

## Verification

The native fixture in `scripts/native/achievements` exercises the production collection with isolated progress. It covers English, a 320-point Latvian collection, replay/pause, locked guidance, an empty Collected filter, native GIF sharing/cancel and unchanged wallet/progress. Run it on a dedicated simulator to avoid interference from another task's UI tests.

The GIF collection is 89.36 MiB, up from 40.88 MiB for the previous two-second clips. Every GIF remains below 1 MiB. Only the open movie is decoded and animated; lists use WebP posters. Physical-device memory/performance and Android still require device verification.
