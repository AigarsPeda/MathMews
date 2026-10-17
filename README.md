# Math Mews

Educational math puzzle game with a virtual cat companion. Built with Expo SDK 57 and React Native.

## Getting started

```bash
npm install
```

### iOS (simulator or device)

The `ios/` folder is generated locally (gitignored). After a fresh clone or if you deleted `ios/`, regenerate the native project, then build:

```bash
npx expo prebuild --platform ios
npx expo run:ios
```

If the native project is out of date (e.g. app name or plugins changed), regenerate from scratch:

```bash
npx expo prebuild --platform ios --clean
npx expo run:ios
```

Open the simulator first through **Xcode → Open Developer Tool → Device Hub** on Xcode 27, or **Simulator** on earlier Xcode versions. If `run:ios` fails with a code signing error, add your Apple ID in **Xcode → Settings → Accounts**, then set **Team** on the **MathMews** target in `ios/MathMews.xcworkspace`.

The iOS configuration enables scene support for Xcode 27 and keeps CocoaPods resource bundles at the app's minimum iOS version, 16.4. These settings are reapplied when Expo regenerates `ios/`.

For day-to-day JS changes after the dev build is installed:

```bash
npx expo start --dev-client
```

Press **`i`** to open on the simulator. If Expo reports a simulator-launch timeout with Device Hub, open **Math Mews** directly in the booted device while Metro is running.

For in-app purchases, use an [EAS development build](https://docs.expo.dev/develop/development-builds/introduction/) — IAP does not work in Expo Go.

## Connected cat rooms

The cat, rooms, furniture, toys, and store room previews now render with native **Filament** on iOS and Android. All 288 catalog models and all 35 cat actions in three coats retain their original IDs. Saved offsets, sizes, orientations, and room assignments are projected into the 3D scene without rewriting the save. Walking follows obstacle-aware routes; its paw cadence follows distance traveled. An orthographic camera keeps the cat the same size throughout the room.

Bullet handles movable toys, gravity, and contact with the cat, furniture, floor, and room edges. Sofas provide a real seat and an approach point for climbing and resting. See [native room engine notes](docs/native-room-engine.md) for collision behavior, asset regeneration, tests, and native rebuild requirements.

The cat has a living room, bedroom, bathroom, and kitchen. Each space keeps its own furniture, toys, background, and saved layout. Existing saves start in the living room with their furnishings intact.

Tap **Decorate**, then **Choose an item**. Under **Add a door**, choose its destination and move the door into place. Tap **Done**, then tap the door and choose **Go to** its destination. New spaces include a return door. In decoration mode, a door’s menu can change its destination, size, or wall orientation.

Use **Find furniture and toys** in the room tools to furnish the current space. Tap placed toys or sofas to start their available play or resting actions. Idle play uses the objects placed in that space. The room name above the scene also opens a room picker.

## Startup regression tests

```bash
npm run test:startup
```

This checks the real Expo launch-plugin order, generation of all three native PNG sizes, Xcode's resource-copy references and repeatable prebuilds. It also checks exact still/animation pixels, the loading-bar placement, both image-decoding orders, and recovery from slow or failed asset loads. The suite runs on pull requests and pushes to `main` through GitHub Actions. It uses temporary files and requires no simulator or generated `ios/` folder.

After building an iOS release, check the packaged app as well:

```bash
node scripts/check-splash-continuity.mjs /absolute/path/MathMews.app
```

That verifies the final Info.plist and the PNGs inside the app bundle. After Expo or iOS upgrades, also cold-launch the release and visually check that the cat appears during the opening transition, then animates with live progress. The Node tests do not exercise iOS's system renderer.

## In-app purchases (RevenueCat)

Math Mews sells **coin packs only**. Real money credits `wallet.coins`; store purchases and extra lives spend coins. Feeding and visual help are free. Click the cat or room objects for their actions; new games start with a food bowl. Wallet setup and admin adjustments: [supabase/README.md](supabase/README.md). Store release work: [RELEASE_PLAN.md](RELEASE_PLAN.md).

### Development — Test Store (no Apple / Google accounts yet)

During development you do **not** need:

- Apple Developer Program ($99/year)
- Google Play Developer account ($25)

You **do** need a free [RevenueCat](https://www.revenuecat.com/) account and a **Test Store** in the dashboard:

1. RevenueCat → **Apps & providers** → create **Test Store** (if not already present)
2. Add consumable products matching `constants/iap-products.ts` (e.g. `mathmews_coins_100`)
3. Add products to your **default offering**

When `__DEV__` is true, the app uses `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY`, with the existing key in `constants/revenuecat.ts` as a fallback. Purchases show a RevenueCat test modal (success / fail / cancel) instead of the real App Store or Play billing UI.

Test with an EAS **development** build on a simulator or device — not Expo Go (Preview API Mode mocks purchases only).

### Production — platform API keys required

Before submitting to the App Store or Play Store, set **platform-specific** RevenueCat keys (from RevenueCat → **Project Settings → API keys** — iOS and Android, **not** the Test Store key).

Copy `.env.example` to `.env` (gitignored) for local production builds:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
```

For remote EAS builds, set these public SDK keys and the existing Supabase public
configuration in the EAS production environment. The ignored local `.env` is not
uploaded automatically. Never add database passwords or the private webhook
Authorization value to the phone's `EXPO_PUBLIC_*` configuration.

`eas build --profile production` selects production data in the existing Supabase
project. Use `--profile store-sandbox` with the preview environment for TestFlight
or Google Play sandbox billing. Local development uses separate sandbox rows and
phone storage in that same project. No second database or Docker is needed.

### TestFlight / App Store (local Xcode)

See [doc/APP_STORE_PLAN.md §5](doc/APP_STORE_PLAN.md#5-production-build-local-xcode). Summary:

```bash
# Only on a fresh clone without .env: copy .env.example, then fill its placeholders.
# Preserve an existing .env and its private backend configuration.
npx expo prebuild --platform ios
# create ios/.xcode.env.local with same EXPO_PUBLIC_* exports
open ios/MathMews.xcworkspace
# Xcode → Archive → Distribute to App Store Connect
```

### Release build safety

The production and store-sandbox EAS profiles reject missing or placeholder
Supabase configuration and platform RevenueCat keys before building. Runtime
configuration errors disable purchasing while keeping gameplay available.

Purchases never credit coins directly on the phone. The authenticated webhook
updates the server wallet, and the app refreshes it. Shop debits use the server
catalog; durable request and receipt IDs recover interrupted purchases. See the
wallet README for test/production isolation and admin SQL examples.

| Build                    | API key               | Apple / Google account |
| ------------------------ | --------------------- | ---------------------- |
| Development (`__DEV__`)  | Test Store (`test_…`) | Not required           |
| App Store / Play release | Platform keys via env | Required               |

**Never** submit to the stores with a `test_` API key.

## Assets

The rooms, furniture, beds, toys and app graphics use the existing Blender models. The cat is original geometry built by `scripts/3d/original_cat.py`, with a connected body and anatomical skeleton. `scripts/3d/game_cat.py` adds coat textures, expressions and all 36 game clips. Its editable rig is [cat-orange.blend](prototypes/cat-model/cat-orange.blend). No paid or downloaded cat assets are required. The native world uses GLBs in `assets/3d/native/`; transparent catalog images and small animation strips supply store/editor thumbnails. The original catalog library remains in `../BrainPet-blender-assest`.

See [3D asset instructions](assets/3d/README.md) for editable models and regeneration. Run `npm run assets:verify` to check asset coverage and animation states, `npm run assets:native` to rebuild the native models, or `npm run assets:3d` to rebuild catalog thumbnails.

The migration notes and verification results are in [HANDOFF.md](HANDOFF.md).

## Release account safeguards

Settings now has a parent-gated account protection/recovery section. The Apple
and Google provider flags in `.env` stay false until provider configuration and
native acceptance are complete. Store preflight requires the appropriate flag.
Production coin checkout requires a recoverable linked account; development and
sandbox guests remain available for testing. Phone saves are scoped to their
account as well as environment, and cancelled sign-in preserves the current game.

The authenticated deletion endpoint is deployed. Live anonymous-account deletion
passed against Supabase and RevenueCat using an agent-created disposable fixture.
Apple revocation still needs developer credentials. Cron remains disabled.
See [release status](RELEASE_PLAN.md) for the remaining submission requirements.

https://aigarspeda.github.io/MathMews/index.html
