# Math Mews release checklist

## Apple first

- [ ] Choose the legal publisher, monitored support email and launch countries. Fill `EXPO_PUBLIC_PUBLISHER_NAME` and `EXPO_PUBLIC_SUPPORT_EMAIL` in `.env` and EAS.
- [ ] Enroll in the [Apple Developer Program](https://developer.apple.com/programs/enroll/). Register `com.mathmews.app` and enable Sign in with Apple.
- [ ] Create the App Store Connect app. Complete paid-app agreements, tax/banking and applicable trader verification.
- [ ] Enable Apple in Supabase Authentication with `com.mathmews.app` as an accepted client ID. Enable manual identity linking to preserve the guest account and wallet.
- [ ] Create a Sign in with Apple `.p8` key. Add `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID=com.mathmews.app` and `APPLE_PRIVATE_KEY` to Supabase Secrets for account deletion. Keep private credentials off the phone.
- [ ] Enable `EXPO_PUBLIC_APPLE_AUTH_ENABLED=true` in a test build. Test account linking, cancellation, same-platform recovery and Apple authorization revocation during deletion before enabling it in release builds.
- [ ] Create three consumable products in App Store Connect: `mathmews_coins_100`, `mathmews_coins_500`, `mathmews_coins_1200`. Set prices and availability.
- [ ] Connect the Apple app and billing credentials to RevenueCat; configure server notifications and the default offering. Add its app ID to the backend allowlist. Set `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...` in `.env` and EAS.
- [ ] Finalize the GitHub Pages privacy, support and deletion pages. Set publisher/contact details, retention/deletion timeframes and an ownership-verification process for external deletion requests.
- [ ] Review SDK data collection, parent gates and child privacy for ages 6 and older. Decide Kids category eligibility; complete App Privacy and age-rating declarations.
- [ ] Prepare listing text, real iPhone/iPad screenshots and reviewer instructions. Build a distribution-signed app; inspect privacy manifests, permissions and crash symbols.
- [ ] Test a `store-sandbox` build through TestFlight on physical devices: repeat purchases, cancellation, pending approval, refunds, duplicate delivery, app-kill recovery, account recovery and deletion.
- [ ] Run `npm run release:check -- --platform ios`. Build with `production` after acceptance, verify production configuration, and submit the app with its initial coin products.

## Google and Android

- [ ] Enroll in [Google Play Console](https://support.google.com/googleplay/android-developer/answer/6112435), complete verification and create the app with package `com.mathmews.app`.
- [ ] Configure Google OAuth branding, support contact and test users. Create a **Web application** OAuth client with redirect URI `https://jcfppquntstgxubtlvqo.supabase.co/auth/v1/callback`.
- [ ] Enable Google in Supabase Authentication and save its Client ID/Secret there. Allow `mathmews://auth/callback` in Supabase redirect URLs; enable manual identity linking.
- [ ] Enable `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true` in a test build. Test linking, cancellation, same-platform recovery, wallet preservation and deletion before release enablement.
- [ ] Create the same three coin products in Play Console. Connect Google billing credentials and real-time notifications to RevenueCat; configure its offering and backend app allowlist. Set `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...` in `.env` and EAS.
- [ ] Complete Data safety, target audience/Families, age rating, app access, listing and screenshots. Use the finalized privacy/support/deletion pages.
- [ ] Build a signed AAB with Play App Signing. Check final permissions and native-library compatibility; test on a 16 KB Android environment.
- [ ] Test `store-sandbox` builds through Play with license testers and physical devices, covering the purchase/recovery/deletion scenarios above. New personal accounts require [12 closed-test participants for 14 continuous days](https://support.google.com/googleplay/android-developer/answer/14151465) before applying for production access.
- [ ] Run `npm run release:check -- --platform android`. Build with `production` after acceptance, verify production configuration and submit.

## Already implemented

- [x] Server wallet, purchase ledger, refunds, admin coin adjustments and app balance synchronization. Admin SQL examples: [Supabase operations](supabase/README.md).
- [x] RevenueCat Test Store webhook and manual purchase reconciliation deployed and tested; duplicate replay preserves the balance.
- [x] Account-isolated saves and gated recovery controls prepared. Anonymous account deletion passed live Supabase/RevenueCat testing; linked Apple/Google acceptance remains above.
- [x] 53 backend tests, TypeScript, strict lint, game/native-room, startup, crash-recovery and runtime-safety checks passed. Final store billing and signed-device acceptance remain outstanding.

## Keep unchanged

- Use the existing Supabase project with separate sandbox/production rows and phone storage. No Docker or additional database.
- Keep Cron disabled and reconciliation manual. Do not save a service-role credential in Vault without a new explicit request.
- Keep unknown credentials as commented placeholders. Private keys stay server-side; only public configuration uses `EXPO_PUBLIC_`.

https://aigarspeda.github.io/MathMews/index.html
