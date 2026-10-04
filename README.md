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

Math Mews sells **coin packs only**. Real money credits `wallet.coins`; everything else (store, feed, lives, visual help) spends coins as usual. Full plan: [doc/IAP_PLAN.md](doc/IAP_PLAN.md).

### Development — Test Store (no Apple / Google accounts yet)

During development you do **not** need:

- Apple Developer Program ($99/year)
- Google Play Developer account ($25)

You **do** need a free [RevenueCat](https://www.revenuecat.com/) account and a **Test Store** in the dashboard:

1. RevenueCat → **Apps & providers** → create **Test Store** (if not already present)
2. Add consumable products matching `constants/iap-products.ts` (e.g. `mathmews_coins_100`)
3. Add products to your **default offering**

When `__DEV__` is true, the app uses the **Test Store API key** from `constants/revenuecat.ts` automatically. Purchases show a RevenueCat test modal (success / fail / cancel) instead of the real App Store or Play billing UI.

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

For EAS production builds, set secrets instead (optional — v1 uses local Xcode):

```bash
eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_...
eas secret:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value goog_...
```

### TestFlight / App Store (local Xcode)

See [doc/APP_STORE_PLAN.md §5](doc/APP_STORE_PLAN.md#5-production-build-local-xcode). Summary:

```bash
cp .env.example .env   # fill production keys
npx expo prebuild --platform ios
# create ios/.xcode.env.local with same EXPO_PUBLIC_* exports
open ios/MathMews.xcworkspace
# Xcode → Archive → Distribute to App Store Connect
```

### Release build safety

Release builds (`__DEV__` false) **crash on launch** if:

- A production API key is **missing**, or
- A **Test Store** key (`test_…`) is still configured

This is intentional — misconfigured store builds must not ship. Logic lives in `utils/revenuecat-keys.ts`; configuration runs in `contexts/IAPProvider.tsx`.

| Build                    | API key               | Apple / Google account |
| ------------------------ | --------------------- | ---------------------- |
| Development (`__DEV__`)  | Test Store (`test_…`) | Not required           |
| App Store / Play release | Platform keys via env | Required               |

**Never** submit to the stores with a `test_` API key.

## Docs

- [doc/GAME_PLAN.md](doc/GAME_PLAN.md) — game design and implementation status
- [doc/IAP_PLAN.md](doc/IAP_PLAN.md) — coin pack IAP rollout
- [doc/SUPABASE_PLAN.md](doc/SUPABASE_PLAN.md) — local-first cloud save + remote puzzles
- [doc/APP_STORE_PLAN.md](doc/APP_STORE_PLAN.md) — iOS App Store production checklist (full)
- [doc/APP_STORE_CHECKLIST.md](doc/APP_STORE_CHECKLIST.md) — iOS App Store quick tick-list
- [doc/PLAY_STORE_CHECKLIST.md](doc/PLAY_STORE_CHECKLIST.md) — Google Play quick tick-list
- [docs/privacy.html](docs/privacy.html) — public privacy policy (GitHub Pages)
- [doc/STYLE_GUIDE.md](doc/STYLE_GUIDE.md) — UI and copy guidelines

## Assets

The cat, rooms, furniture, beds, toys and app graphics use original Blender models. Editable scenes live in the sibling folder `../BrainPet-blender-assest`, currently `/Users/aigarspeda/Desktop/BrainPet-blender-assest`. The game uses transparent images and animation atlases in `assets/3d/` while retaining its existing room controls and saved inventory IDs.

See [3D asset instructions](assets/3d/README.md) for editable models and regeneration. Run `npm run assets:verify` to check asset coverage and animation states, or `npm run assets:3d` to render and pack the collection.

The migration notes and verification results are in [HANDOFF.md](HANDOFF.md).
