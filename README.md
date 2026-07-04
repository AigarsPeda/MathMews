# Math Mews

Educational math puzzle game with a virtual cat companion. Built with Expo SDK 56 and React Native.

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

Open **Simulator** first (`open -a Simulator`). If `run:ios` fails with a code signing error, add your Apple ID in **Xcode → Settings → Accounts**, then set **Team** on the **MathMews** target in `ios/MathMews.xcworkspace`.

For day-to-day JS changes after the dev build is installed:

```bash
npx expo start
```

Press **`i`** to open on the simulator.

For in-app purchases, use an [EAS development build](https://docs.expo.dev/develop/development-builds/introduction/) — IAP does not work in Expo Go.

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
- [docs/privacy.html](docs/privacy.html) — public privacy policy (GitHub Pages)
- [doc/STYLE_GUIDE.md](doc/STYLE_GUIDE.md) — UI and copy guidelines

## Assets

Cat sprites and room items: [Cat Mega Bundle on itch.io](https://toffeecraft.itch.io/cat-mega-bundle)

https://aigarspeda.github.io/MathMews/privacy.html

### ISOmetric sprites

https://pixel-salvaje.itch.io/isometric-interiors
