# Math Mews Apple App Store and Google Play release plan

Prepared 16 October 2026.

Math Mews has a substantial game implementation and an initial in-app purchase integration. It is not ready to accept production payments yet. Keep Expo, React Native, Supabase, and RevenueCat. The main work is reliable coin delivery and recovery, parent account handling, child privacy, production signing, and testing the actual store builds.

This plan covers an initial iOS and Android release with the existing 100, 500, and 1,200 coin packs. Subscriptions, ads, and external checkout are outside the proposed first release. The engineering recommendations below are distinguished from store requirements. Store policies do not prescribe the particular wallet architecture proposed here.

## Implementation progress

The first backend stage was applied to the existing MathMews Supabase project on
16 October 2026. It adds account wallets, an immutable purchase/adjustment ledger,
admin top-ups and exact balance changes, owner-only reads, transaction deduplication,
refund ordering and deleted-account protection. The hosted regression script passed
and rolled back all test accounts and test balance changes. No additional database,
container, or development dependency is required. Existing on-phone progress storage
is retained.

The server wallet is connected to the app. RevenueCat's Test Store webhook is
active, authenticates its Authorization header, and delivered a real native test
purchase into the sandbox wallet. Live administrator adjustments also appeared in
the game. Spending, rewards, durable item delivery, cloud-save isolation and build
configuration now use the server wallet. Migrations 001–011 are deployed.

The native-room regression now waits for asynchronous placement. The Home test
mocks and asset-policy fixtures were also brought up to date. The full game suite
passed. The room scheduler's render-time ref reads were moved into its effect so
the strict CI lint command can pass without disabling the compiler rule.

Account deletion now has a server outbox, write fencing, provider cleanup,
completion receipts, client retries and a service-only scheduled retry route.
Migrations 009–011 and the authenticated `delete-account` Edge Function are deployed.
Live anonymous-account acceptance passed: actual RevenueCat customer removal,
Supabase Auth/save deletion, old-session rejection and receipt-only completion.
Apple revocation still needs its private credentials and provider acceptance.
Cron remains disabled. Never test deletion on the owner's account.

The arithmetic parent gate was replaced with a six-digit reading/sequencing task;
coin offers re-lock on background. Account deletion and external policy links are
gated too. This interaction is not legal age verification or parental consent.
English/Latvian privacy drafts now describe accounts, wallet ownership, recovery
limits and retention. Public support/deletion page drafts are generated from the
same source. The external deletion request path is still a TODO.

Purchase reconciliation is now implemented and rollback-tested, with durable
pagination, original event replay, admin-balance preservation and scheduled retry
templates. Its secrets, schema and Edge Function are deployed and live sandbox
acceptance passed. The publisher selected manual operation only. Cron is
disabled and no service credential was stored in Vault. Manual calls work;
scheduled recovery must not be enabled without a new explicit request.

The user confirmed an intended audience starting around age 6–7 through age 69.
Treat this as a mixed child/adult audience. Launch countries, publisher identity,
support contact, developer enrollment and credentials remain unknown. They are
commented placeholders in `.env`/`.env.example`; store build checks reject missing
public identity, URLs and real platform billing keys. `npm run release:check`
prints the remaining public configuration names without exposing private values.

See [backend operations and SQL examples](supabase/README.md). The findings below
are the **original audit baseline**, not a list of all currently unresolved defects.
The current remaining work is listed at the end of this document.

## What the application already has

| Area | Current implementation | Release implication |
| --- | --- | --- |
| App | Expo SDK 57, React Native 0.86, Expo Router, native Filament rooms and cat animations | Use native development and release builds. Expo Go cannot validate the complete app. |
| Identity | Math Mews, bundle ID and package `com.mathmews.app`, version 1.0.0 | Verify ownership and availability in both developer accounts before uploading. |
| Game | Math puzzles, rewards, pet care, rooms, furniture, toys, skins, local persistence, multiple cloud saves | A first release does not need a game rewrite. Device quality and save compatibility still need validation. |
| Billing | RevenueCat React Native SDK 10.11.0, three product IDs, localized store prices, cancellation and pending results | The shop exists, but its money delivery and recovery logic needs completion. |
| Purchase gate | A parent sheet before the coin shop | The challenge is addition with operands 7 to 15 and 4 to 12, with three choices and unlimited retries. This is too close to the skills the game teaches to rely on as an adult gate. |
| Accounts | Anonymous Supabase sessions, secure session backup, native Apple sign-in, Google OAuth and parent email code service code | These are implemented paths, not evidence that production providers, redirects, email delivery, or all UI entry points work. |
| Privacy | In-app English and Latvian policies, a public HTML policy source, a delete-data action, license notices | The policies contain stale account/recovery claims, and deletion is incomplete. |
| Release setup | EAS project and production profile, generated local native projects, startup and game checks in CI | Production credentials, store records, real purchase tests, and accepted uploads remain to be verified. |

Important implementation references are [IAPProvider](contexts/IAPProvider.tsx), [RevenueCat service](services/iap/revenuecat.ts), [product catalog](constants/iap-products.ts), [GameProvider](contexts/GameProvider.tsx), [cloud schema](app/supabase/schema.sql), and [app configuration](app.json).

## Findings that affect launch

| Priority | Finding | Required outcome |
| --- | --- | --- |
| P0 | Successful SDK purchases immediately call `adjustCoins` and then upload the save. The database lets the user write the entire save JSON, including wallet and credited purchase IDs. | Add a durable server-owned record of verified purchase grants. An editable save must not establish payment or overwrite the authoritative paid balance. |
| P0 | There is no backend purchase event handler, reconciliation job, or refund handler in the repository. Only the active purchase callback grants coins. | Deliver a paid purchase after a crash, delayed approval, or network interruption. Process duplicate events once and reconcile missed events. |
| P0 | RevenueCat configures anonymously, then `logIn(userId)` runs later without being awaited by purchases. Errors are swallowed, and there is no explicit billing identity reset on account changes. | Disable purchase until the intended customer identity is confirmed. Handle account switching, sign-out, deletion, and failed login without charging the wrong profile. |
| P0 | Restoring calls RevenueCat restore, reloads a cloud save, and always returns zero. Reloading replaces the local save. | Recover the current server balance and ownership without overwriting newer progress or granting historical consumables twice. |
| P0 | `deleteRemoteUserData` deletes only `game_saves`. Its false result is ignored by `deleteAllUserData`, which signs out and creates another anonymous session. | Delete the authentication account and associated data through a server endpoint. Report remote failure accurately and prevent background sync from recreating deleted data. |
| P0 | The parent gate tests simple arithmetic. Settings also exposes an external policy link without a gate. | Provide an adult-oriented parent area and cover purchase opportunities and external links for an Apple Kids release. Keep policy text readable inside the app. |
| P0 | The generated Android release build uses the debug signing configuration. | Produce a correctly signed AAB using an upload key and Play App Signing, or verified EAS credential management. Never upload the debug-signed local release. |
| P0 | `npm run test:game` fails at `scripts/check-native-room.mjs:1685` because the test cannot find the expected wall-placement repair effect. | Determine whether the regression test is obsolete or intended behavior is missing. Resolve it and get CI green before submission. This failure alone does not establish a device runtime bug. |
| P1 | Existing launch docs say invalid RevenueCat keys crash the app and Apple/Google account linking is deferred. Current code disables IAP on configuration failure and already contains account linking paths. | Update launch instructions to match the final behavior. Keep graceful runtime degradation and add a build-time configuration check. |

Local purchase deduplication already exists in `utils/coin-ledger.ts`, including persistent `creditedPurchaseIds`. Preserve its useful behavior, but it does not replace account-wide server deduplication or recovery across devices and saves. Cloud conflict selection currently chooses one complete save using client timestamps; that must not decide a financial balance.

## Decisions to settle first

1. Confirm the intended ages and launch countries. Existing plans describe ages 7 to 12, while policy text says all ages. Use the real audience consistently in the product, listing, and disclosures. Apple Kids age bands and the app's content age rating are separate decisions. Google's Families rules apply when children are among the target audiences. [Apple children's experiences](https://developer.apple.com/kids/), [Google target audience guidance](https://support.google.com/googleplay/android-developer/answer/9867159).
2. Confirm whether the publisher is an individual or organization, who owns both store accounts, and whether memberships and merchant verification are complete. These dashboard states cannot be established from source code.
3. Decide where coins belong. Today each saved pet has a separate wallet. I recommend one server wallet per parent account for v1, with pet saves holding gameplay state. If separate pet wallets are essential, bind every purchase to a durable server-side save identifier before billing and keep transaction uniqueness global across those wallets.
4. Decide the offline spending policy. The simplest secure first release keeps puzzles and pet care offline, queues earned rewards for synchronization, and requires a connection to spend coins. Fully offline coin spending needs a separate reconciliation design and more testing. This changes the current local wallet behavior and needs a product decision before implementation.
5. Finalize coin pack prices and value. Retain free puzzle earnings and avoid prompts that pressure children to spend money to care for their cat. Show the store's localized price, not a hardcoded currency amount.
6. For reliable recovery, I recommend requiring a recoverable parent account before the first real-money purchase. Children can continue to play locally without parent sign-in. This is an engineering/product recommendation, not a universal store sign-in requirement. For v1, promise only the recovery routes actually tested; Apple-only and Google-only sign-in do not automatically provide cross-platform account recovery.

The implementation below assumes an account wallet, online spending, and parent authentication before real-money purchases. A guest with an anonymous Supabase account also gets a server wallet for earned coins. Linking a parent identity should preserve that Supabase user ID. If the parent signs into an existing account instead, use a server-authorized, one-time guest-progress merge; never add two snapshots of the same wallet. First launch offline keeps progress and provisional earned rewards locally. Spending starts after connection and server synchronization. Set the reward and migration caps in Phase 1.

## Implementation of in-app purchases

### Products and store configuration

Use the existing IDs in both stores and keep their coin quantities in a server-side allowlist as well as the display catalog.

Use Apple In-App Purchase and Google Play Billing, through RevenueCat, for the native coin checkout. This plan assumes standard store distribution without enrolling in alternative-payment programs. Purchased coins must not expire. [Apple purchase rules](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Google payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

| Product ID | Coins | Apple product type | Google product behavior |
| --- | ---: | --- | --- |
| `mathmews_coins_100` | 100 | Consumable | Repeatable one-time product, consumed after purchase |
| `mathmews_coins_500` | 500 | Consumable | Repeatable one-time product, consumed after purchase |
| `mathmews_coins_1200` | 1,200 | Consumable | Repeatable one-time product, consumed after purchase |

In App Store Connect, create the products, choose prices and countries, complete localized names/descriptions, and add IAP review screenshots. Include the first IAP products with the app version submitted for review. In Play Console, create and activate the corresponding one-time products and purchase options, configure availability and prices, and confirm repeat purchases work.

Connect both real stores to the existing RevenueCat project and add all three products to the intended offering. Configure Apple's In-App Purchase key and other credentials requested by RevenueCat's current setup flow. Configure Google's service credentials and permissions. Add App Store server notifications and Google's real-time developer notifications to RevenueCat. These platform notifications and RevenueCat-to-app-backend webhooks are separate connections. [RevenueCat store setup](https://www.revenuecat.com/docs/projects/connect-a-store), [Apple IAP submission](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase).

The app should continue using RevenueCat's normal transaction finishing and consumption behavior. Confirm it in sandbox and Play license tests; do not add a second client acknowledgement or consumption path without a specific SDK requirement.

### Server wallet and transaction ledger

Recommended implementation: Supabase Postgres plus server functions, with RevenueCat continuing to validate store purchases. Add versioned migrations in a tracked backend directory outside `app/`. Do not use `drop-iap-grants.sql` as the new purchase architecture.

The backend needs:

- A wallet owned by a Supabase account, including an anonymous guest account, or by a save if the separate-wallet option is chosen. Parent authentication is required before purchasing packs.
- An immutable purchase record containing store, app/package, environment, transaction identifier or purchase token, product ID, owner, quantity, and delivery/refund state.
- A unique constraint on the canonical store transaction identity, scoped by store, app, and environment. Also deduplicate webhook event IDs. One transaction must never grant to two customers or pets.
- A wallet-entry ledger for purchase grants, spends, earned rewards, refunds, and controlled support corrections. Store earned and purchased origins so refunds and support can be handled accurately.
- Server endpoints for balance, purchase reconciliation, and atomic coin spending plus item ownership. Use an idempotency key for each spend, a server price catalog, a nonnegative-spend check, and a database transaction or row lock.
- An idempotent earned-reward endpoint if the recommended shared wallet is adopted. The proposed v1 protocol accepts bounded client assertions for free gameplay rewards: record a durable puzzle-instance/event key before play, retain it across retries, validate the puzzle/reward configuration, cap rewards per event and per account/day, and persist server uniqueness. Bind events to their originating guest/account and transfer them once during an authorized guest merge. Show pending rewards until accepted. Multiple devices share the same server cap. This deliberately tolerates limited fabricated free-play claims within the cap; it is not proof that a puzzle was solved. Server-issued offline attempts and stronger anti-cheat are additional scope if that tradeoff is unacceptable.
- Read access limited to the owner. Deny direct client inserts/updates to financial tables. Client save uploads must not write wallet balances or authoritative purchased-item ownership.

Receiving a RevenueCat event should follow this sequence:

1. Authenticate the webhook using a configured authorization secret. Check app, environment, product allowlist, and mapped customer. Keep sandbox/Test Store grants separate from production money.
2. Persist the event durably before acknowledging it. Process through an idempotent worker or database transaction. Return a retriable failure if durable storage fails.
3. For a verified consumable purchase, insert its purchase record and grant the configured quantity exactly once. Ordinary RevenueCat consumables use the `NON_RENEWING_PURCHASE` event.
4. Publish or expose the committed balance. The client displays success after it observes the delivered grant. If delivery is delayed, show a payment-received/pending-delivery state, never ask the user to buy again to recover it.
5. Reconcile at startup, foreground, and a user-initiated recovery action. Use authenticated server checks against RevenueCat's recorded purchases, not a transaction ID asserted by the phone. Add a scheduled reconciliation job because webhook retries are finite.
6. Handle refunds and reversals as new idempotent ledger entries. Define how spent coins affect the balance and future spending; use parent-facing support messaging. Preserve only the transaction data needed for disclosed retention obligations.

Quarantine events whose customer mapping is missing or deleted. A delayed purchase webhook must never recreate a deleted parent account. Resolve account aliases and merges explicitly so recovery does not copy balances to a second identity.

Use the Supabase user ID as the canonical owner and RevenueCat App User ID, with any legacy aliases stored in a server mapping. Record the owner on first verified delivery. A restore or RevenueCat alias change must not transfer an already-delivered transaction to a new account. Quarantine conflicting claims; allow any deliberate ownership transfer only through an authenticated, audited recovery process that moves the original ledger rather than granting again. Retain the minimum permitted transaction-deduplication record through account deletion under the documented retention policy.

RevenueCat documents that ordinary consumable delivery bookkeeping remains the developer's responsibility. It also offers a managed In-App Currency ledger. That is a valid alternative to custom balance storage, but spending still requires a backend. Choose one financial source of truth. Do not operate independently writable RevenueCat and Supabase balances. Given the current multi-save economy, I recommend Supabase first unless a short implementation spike shows managed currency materially reduces the work. [Consumable purchase handling](https://www.revenuecat.com/docs/platform-resources/non-subscriptions), [webhook delivery](https://www.revenuecat.com/docs/integrations/webhooks), [managed In-App Currency](https://www.revenuecat.com/docs/offerings/virtual-currency).

### Administrator coin adjustments in Supabase

The owner must be able to top up or set the coin balance of their own account or any other account for testing and support. Include this capability in Phase 2, using Supabase's SQL editor rather than building an admin application.

Provide two privileged database functions:

| Proposed function | Purpose | Example operation |
| --- | --- | --- |
| `admin_adjust_coins` | Apply a positive or negative coin adjustment to a selected wallet | Add 1,000 coins to an account. |
| `admin_set_coin_balance` | Set a selected wallet to a nonnegative target balance | Set a test account to exactly 500 coins. |

Identify the target by its Supabase user UUID, plus save ID if separate pet wallets are selected. Provide an admin-only lookup query for locating linked accounts and their wallets. Anonymous accounts use their UUID; they may not have an email address. Each operation takes a reason and a unique request ID, locks the wallet, and writes the adjustment and resulting balance in one database transaction. Setting a target balance calculates the difference under the same lock. Repeating a request must not apply it twice; reusing an ID with different arguments must fail.

Record the operator identifier, database role, timestamp, reason, environment, previous balance, adjustment, and new balance. Classify these entries as `admin_adjustment`, separately from paid purchase grants and gameplay rewards. Do not fabricate store transactions or change RevenueCat purchase history. Apply the same wallet validation and concurrency rules as other wallet operations, reject deleted/deleting accounts, and keep test and production wallets separate.

Restrict execution to the designated administrative database role used for this workflow. Revoke access from ordinary app roles, including `anon` and `authenticated`, and keep any elevated credentials out of the mobile app. Direct edits to wallet balances or save JSON should not be the supported adjustment path because they bypass ledger accounting.

The client must fetch the changed balance on its next wallet refresh, foreground, or startup. A stale client save must never undo the adjustment. These manual credits support balance and spending tests; actual checkout and transaction-delivery testing still uses Apple/Google sandbox purchases.

### Client changes

- Refactor `contexts/IAPProvider.tsx` to distinguish SDK configuration, authenticated billing identity, catalog readiness, payment pending, and delivery pending. Await identity changes and block purchases during them.
- Replace direct `adjustCoins` purchase grants with a request to reconcile and fetch the authoritative wallet. Do not treat `CustomerInfo` entitlements as a remaining coin balance.
- Refresh balance after startup, account recovery, foregrounding, and a completed purchase. Recover approved Ask to Buy and delayed Play payments without requiring the original purchase promise to remain alive.
- Keep `CoinPackSheet` and its localized store prices. Add clear offline, unavailable-product, delayed-delivery, retry, and support states. Hold the purchase lock for the full operation and reset it in `finally`.
- Separate restoring saved games from recovering the current coin balance. Spent consumables must not be reissued. Restoring an older pet save must never roll back a server wallet.
- Remove the always-zero restore result and misleading success paths. Surface a useful recovery result based on server state.
- Add a release configuration check that rejects missing, test, or wrong-platform RevenueCat keys before packaging. Current runtime guards only reject empty and `test_` keys and gracefully disable purchases on failure.
- Allow real Apple/Google sandbox testing in native development builds through explicit environment selection. Currently every `__DEV__` build automatically uses RevenueCat Test Store. TestFlight and Play test-track release builds must use their real platform public SDK keys.

Public RevenueCat SDK keys and the Supabase publishable key belong in the client. Store private keys, service-account JSON, Supabase service-role credentials, and RevenueCat secret API keys belong only in protected build/backend settings. `EXPO_PUBLIC_*` values are bundled into the app and are not secrets.

### Existing save migration

Keep existing game progress and pet layouts. Import existing earned balances once under a capped migration rule, keyed by the legacy save and canonical account. Treat that import as unverified earned credit, not a paid purchase; repeated restores or guest merges must not repeat it. Validate any historical real-money transactions through RevenueCat before recognizing them as paid grants. Test Store transactions must never become production paid credits. Preserve the old local credited IDs for migration auditing, but establish server uniqueness independently. Test new games, old saves, restored saves, multiple pets, account linking, and two devices before turning on production sales.

## Parent controls, privacy, and account deletion

### Parent area

Replace the arithmetic multiple-choice gate with an adult-oriented interaction appropriate for the actual ages. Do not make another task that the game teaches children to solve. Put real-money offers, parent sign-in, email entry, external support/policy links, and destructive account actions behind the parent area. Re-lock it when dismissed or backgrounded. Keep an in-app privacy explanation available without opening a website. Test every alternate navigation path.

Apple's Kids rules restrict purchase opportunities, external links, third-party data sharing, and analytics. Google also restricts SDKs and identifiers in child-directed apps. Audit RevenueCat, Supabase, authentication providers, logs, and every other networked SDK against the actual child-facing configuration; absence of ads is not sufficient. [Apple Kids requirements](https://developer.apple.com/app-store/review/guidelines/#kids-category), [Google Families requirements](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en).

Have a privacy specialist assess the data collected during automatic anonymous sign-in and cloud upload, lawful processing and any required parental consent in the selected countries, processor terms, and retention periods. A purchase gate and an anonymous UUID do not by themselves establish legal compliance. The FTC's guidance also points to the amended COPPA Rule as the current authority. [FTC children's privacy guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).

### Complete account deletion

Add an authenticated server endpoint that verifies the requester, stops or invalidates further sync, deletes the Supabase auth user and associated saves, and deletes or anonymizes relevant RevenueCat/backend data under the retention policy. Revoke Sign in with Apple credentials when applicable. Keep administrative credentials off the phone.

Persist an authorized deletion job with the required provider identifiers before deleting authentication. Mark the account as deleting server-side and reject new saves and purchases immediately. The worker must retry provider cleanup and revocation independently of the user's session, remove account data, and delete the auth user after required identifiers have been captured. Return a request reference and a way to check completion after sign-out. An accepted job is pending until cleanup completes; it must not be reported as already finished. Delayed financial events go to the deleted-account quarantine, not a new wallet. Disclose any narrowly retained transaction records and their deletion schedule.

Pause cloud writers during deletion. Clear local save data and secure session backups only after the remote deletion is confirmed, or show an explicit pending request with a retry path. Do not silently abandon a failed remote deletion and start a new account. Keep a simple game reset separate from account deletion.

Publish an HTTPS page where a parent can request deletion without reinstalling. Explain ownership verification, deletion scope, timing, and any retained transaction records. Complete the Play Console data deletion declarations. [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).

### Policies and disclosures

Update `legal/privacy-policy-content.ts` and `docs/privacy.html` together in English and Latvian. Remove the claim that account linking is a future feature. Explain parent accounts/email if enabled, actual recovery limits, wallet ownership, processors, deletion, retention, and non-expiring purchased coins. Add a parent-facing terms/support page describing consumable purchases and help with delivery or refunds.

Complete Apple's App Privacy and Google's Data safety forms from an actual data inventory. Include purchase history, custom user IDs, cloud gameplay data, and parent contact data when collected. RevenueCat's Apple guidance calls for purchase history under app functionality and analytics; check how this interacts with the chosen Kids configuration before shipping. Review the final archive's privacy manifests and required-reason API declarations. Advertising tracking permission is not a default requirement for this app. [RevenueCat privacy disclosures](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy).

GitHub Pages is configured at `https://aigarspeda.github.io/MathMews/`. The privacy, support and deletion draft URLs are set in `.env` and `.env.example`. A prepared workflow change restricts Pages to the four public HTML files and stylesheet; publishing that workflow change still needs GitHub workflow permission. The current live workflow uploads the remote `docs/` folder. Final publisher/contact, retention and deletion terms still need approval before store submission. See `docs/README.md` for regeneration and deployment instructions.

Confirm distribution rights for models, images, fonts, videos, puzzle text, and store graphics. Keep the existing dependency notices current and retain provenance for original assets. The asset-license list is empty, so verify that every bundled asset is original or has any required license recorded before publication.

## Apple publication work

1. Activate Apple Developer Program membership and confirm the correct legal publisher. Complete paid-app agreements, tax and banking information, EU trader status and verification where applicable. Membership is listed at US$99 per year, with local pricing shown at enrollment. [Enrollment](https://developer.apple.com/programs/enroll/), [EU trader information](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/).
2. Register `com.mathmews.app`, enable required Sign in with Apple capability, configure production Supabase Apple credentials, and create the App Store Connect record. Use a distinct, increasing build number for each upload.
3. Build with a supported Xcode and SDK. Apple's current minimum upload requirement is Xcode 26 and iOS/iPadOS 26 SDKs or later. The configured iOS 16.4 deployment target is a different setting. Verify the effective deployment target imposed by the installed native dependencies. [Current Apple requirements](https://developer.apple.com/news/upcoming-requirements/).
4. Produce a distribution-signed archive through local Xcode or EAS. Pin the chosen build environment, provide production public configuration during JS bundling, and verify a clean checkout can reproduce the build. Both native folders are ignored, so lasting native fixes must live in config plugins or scripts.
5. Validate the final archive, SDK privacy manifests, encryption/export compliance answers, icons, splash, signing capabilities, and absence of development UI. Determine the encryption exemption from the actual app instead of blindly setting a flag.
6. Complete metadata in the intended languages: description, subtitle, keywords, categories, updated age-rating questions, privacy, copyright, support URL, and IAP review information. Claim accessibility support only after testing it.
7. Capture real game screens: puzzle, visual help, cat room, customization, and rewards. Supply the required iPhone screenshots and 13-inch iPad screenshots while `supportsTablet` remains true. Apple's current table requires an iPhone Dynamic Island medium-display screenshot; follow that table and Connect's validation rather than the older local checklist's device-size claims. [Screenshot requirements](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).
8. Test a release build through TestFlight. Use real store sandbox purchases, not just RevenueCat Test Store. Submit the app with its initial consumable products and clear reviewer instructions for reaching the parent shop, testing recovery, and deleting an account. Provide review access to account-only features without requiring a reviewer to use a personal account.
9. Use manual release after approval so production backend configuration and product availability can be checked immediately before launch.

## Google Play publication work

1. Complete Play developer identity verification, account type, payments profile, tax/bank details, and any account-specific device or developer verification tasks. Registration is listed at US$25 once. Create the Math Mews record with the same package. [Play Console enrollment](https://support.google.com/googleplay/android-developer/answer/6112435).
2. Use Play App Signing and protect/back up the upload key. Replace the generated debug release signing path or use EAS-managed signing. Configure monotonically increasing Android `versionCode` values.
3. Target Android 16/API 36 or higher for a new submission under current requirements. The existing generated debug manifest targets 36, and its merged billing metadata reports Billing Library 8.3.0. Those are encouraging debug-build facts, not proof of a compliant release AAB. Confirm the final release uses a supported billing version; version 7's ordinary deadline was 31 August 2026. [Target API requirements](https://developer.android.com/google/play/requirements/target-sdk), [Billing version deadlines](https://developer.android.com/google/play/billing/deprecation-faq).
4. Verify every packaged native library, including Filament, Skia, worklets and React Native, for 16 KB page-size compatibility. Test on a 16 KB environment and inspect the release bundle/Play checks. Google's current documentation requires compatibility for apps targeting API 35 or higher and lists 1 February 2027 as an update enforcement date. Make compatibility a first-release acceptance condition. [16 KB guidance](https://developer.android.com/guide/practices/page-sizes).
5. Audit the merged release manifest and remove unneeded permissions through durable Expo configuration. The local generated manifest includes overlay and legacy storage permissions that need justification or removal. Confirm the billing permission and billing-version metadata are present in the final artifact.
6. Upload a signed AAB to internal testing. Configure license testers and separately authorize access to the test track. Validate repeat consumable purchases, pending payments, cancellation, refunds, and delivery recovery on a physical Play-enabled device.
7. Complete target audience, Families declarations, Data safety, account deletion URL, IARC content rating, ads declaration, app access/reviewer instructions, countries, and product availability. Add localized listing copy, a 512 by 512 store icon, a 1024 by 500 feature graphic, and real phone screenshots. Check tablet requirements for the distribution selected in Console.
8. If the developer uses a personal account created after 13 November 2023, plan for at least 12 testers continuously opted into a closed test for 14 days before applying for production access. Internal testing does not satisfy this condition. Record real testing feedback; access is not automatic when the timer ends. Start recruitment early. [Google testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465).
9. Review the pre-launch report and Android vitals, resolve blocking issues, and apply for production access where needed. If a controlled launch date is needed, publish to a closed test first even when the account is exempt from the mandatory 14-day test, then verify managed publishing is available and enable it before the production submission. Google does not support managed publishing for an app's first publication. If it remains unavailable, finish backend/product readiness before submitting and plan for publication after approval. Choose an initial country set deliberately; use percentage staged rollouts for subsequent updates where supported. [Publishing controls and prerequisites](https://support.google.com/googleplay/android-developer/answer/9859654).

## Verification and launch acceptance

The review ran TypeScript, lint, startup checks, game regressions, and runtime asset verification. TypeScript, lint, startup checks, and runtime assets pass. The game suite fails on the room-placement assertion described above. There was no booted iOS simulator, and no hands-on store purchase or signed release build was exercised. Store accounts, production backend policies, credentials, and console status still need verification.

Before either submission, require the following results from the actual release artifacts:

| Test | Acceptance condition |
| --- | --- |
| All three packs, both stores | Correct localized price and quantity; repeat buying the same pack works. |
| Cancel or decline | No grant and no stuck purchase button. |
| Ask to Buy and Play pending payment | No early grant; later approval delivers once, including after a restart. |
| Kill app immediately after payment | Reopening recovers delivery without buying again. |
| Network loss after payment | Pending delivery survives restart and eventually completes once. |
| Duplicate, delayed, forged, or reordered events | Invalid events rejected; a transaction grants once; refund state converges. |
| Webhook outage beyond provider retry window | Reconciliation finds undelivered verified purchases. |
| Two devices spending concurrently | No duplicated spend, lost paid credit, or negative spendable balance. |
| Admin top-up or target-balance change | Only an admin can adjust any selected wallet; the ledger records it, retries apply once, concurrent spending stays consistent, and the app receives the new balance on refresh. |
| Reinstall/new device | Parent recovery restores the remaining balance and owned items; spent coins are not reissued. |
| Switch pets, restore older save, change account | Correct owner and balance; no funds copied from another save or account. |
| Guest play, guest linking, existing-parent sign-in | Offline provisional rewards synchronize once; guest merges cannot duplicate rewards, balances, or migration credit. |
| Store account reused with another app account | Existing transactions retain their original owner; alias/restore conflicts and deleted-account events are quarantined. |
| Offline play and reconnect | Gameplay works under the chosen policy; reward events do not replay and cloud sync cannot overwrite financial state. |
| Refund before/after spending | Defined ledger adjustment and useful parent support path. |
| Delete account with network failure | Failure or pending status is honest; retry completes auth, save and provider deletion without re-upload. |
| Parent controls | Purchases, external links, account controls, and destructive actions cannot bypass the gate. |
| Native quality | Cold start, background/foreground, room switching, memory pressure, long play, low graphics mode, text sizing, screen readers and Reduce Motion checked. |

Use at least a physical iPhone, an iPad because support is enabled, a lower-memory Android phone, and a current Android device. Exercise the oldest effective supported OS and current OS versions. Check startup, memory, battery/thermal behavior and the 3D fallback on those devices. Upload native symbols so store crash reports are actionable. Keep crash diagnostics free of unnecessary child data.

CI should run the existing checks plus meaningful backend tests for purchase authentication, duplicate delivery, concurrent spends, migration, refunds, account isolation, and deletion failure. Add a release preflight for required configuration and signed artifact checks. Do not replace failing behavior tests with checks that merely assert source text exists.

## Work sequence and estimate

These are planning estimates for one developer familiar with the code, not a fixed quote. They assume the existing game is retained, no major native engine issue appears on physical devices, and the recommended online financial model is accepted.

| Phase | Work | Engineering effort | Exit condition |
| --- | --- | --- | --- |
| 1 | Audience, wallet/offline decisions, account inventory, test recruitment, final product catalog | 1 to 2 days | Publisher and v1 behavior settled; console setup started. |
| 2 | Server ledger, verified grants, identity binding, recovery, refunds, admin coin adjustments, migration, financial tests | 5 to 8 days | Money and administrator-adjustment scenarios pass against the staging backend. |
| 3 | Parent area, production account recovery, deletion endpoint/page, privacy/disclosures | 4 to 6 days | Parent and deletion flows pass; child data assessment resolved. |
| 4 | Reproducible signed builds, native compatibility, release configuration, CI failure | 2 to 4 days | Accepted TestFlight build and Play internal AAB. |
| 5 | Real purchase QA, physical-device fixes, screenshots, listing and review preparation | 3 to 5 days | Acceptance matrix passes; both submissions ready. |

Allow about 15 to 25 engineering days. Calendar time also includes enrollment/verification, any required 14-day Play closed test, tester engagement, privacy assessment, store review, and possible resubmission. Several external tasks can run alongside implementation. A working allowance is roughly 5 to 8 calendar weeks, with wider variance if accounts or native compatibility are not ready.

Budget separately for memberships, store commissions under the enrolled programs, RevenueCat, Supabase hosting/backups/server jobs, transactional email if enabled, physical test devices, and privacy review. Confirm the RevenueCat account has webhook access and the selected currency features before committing to the design. Check current service pricing instead of treating the SDK as cost-free infrastructure. [RevenueCat pricing](https://www.revenuecat.com/pricing).

After launch, monitor failed product loads, verified purchases without grants, duplicate events, pending-delivery age, refunds, deletion jobs, crashes and ANRs. Prepare a switch to disable new coin sales while retaining delivery/recovery for already-paid purchases. Keep backend changes compatible with the released app. Agree on who responds to purchase support and store rejection messages.

The first implementation milestone should be a test-store purchase that survives an immediate app kill and delivers exactly once through the server ledger. Once that works, wire up real store sandbox billing and complete the remaining release acceptance tests.


## Implementation status, 16 October 2026

The server wallet, immutable purchase ledger, admin adjustments, server catalog
spending, bounded puzzle rewards, receipt recovery and app wallet connection are
implemented. Migrations 001 through 008 have been applied to the existing Supabase
project. Development and production use separate wallet/save environments and
phone storage within that single project. No Docker or second database is used.
The RevenueCat Edge Function and webhook are active. Dashboard delivery returned
HTTP 200, and a native Test Store purchase delivered 100 sandbox coins through the
server ledger to the running iOS game. A live admin adjustment also refreshed in
the game and was reversed. Interrupted purchase, restart, old-save and account
isolation tests pass. Details and admin examples are in `supabase/README.md`.

The production EAS profile selects production data and validates required billing
configuration. The store-sandbox profile selects sandbox data for TestFlight/Play
billing tests. `.env` has commented placeholders for the missing iOS and Android
public RevenueCat keys. Real store app IDs are deliberately not guessed or activated.

TODO: Supply Apple/Google developer and store configuration, actual RevenueCat
platform app keys and app IDs, consumable product approvals, offering configuration,
signing credentials, final metadata/screenshots, privacy declarations, audience/Kids
decisions and the remaining account-deletion and parent-control work described above.
The full game regression suite also has a pre-existing native room `repairEffect`
assertion failure at `scripts/check-native-room.mjs:1685`. These external requirements
and acceptance checks still block calling the app ready
for public store submission. Test purchase delivery, refund handling and app-kill
recovery on real Apple/Google sandbox billing before enabling paid sales.

## Current next steps after regression fixes

1. TODO, publisher: decide the individual/organization legal identity, monitored
   support email, launch countries and developer enrollment. The confirmed target
   includes children about 6 and older plus adults; do not describe the app as
   adult-only or assume the Apple Kids category without a deliberate listing choice.
2. TODO, credentials: configure real Apple and Google apps/products in RevenueCat,
   store billing credentials, real platform SDK keys and server allowlist IDs.
   Complete store agreements, tax/banking, signing and upload-key management.
3. TODO, deletion provider acceptance: the Edge Function is deployed and live
   anonymous/RevenueCat deletion passed. Add Apple revocation credentials and
   verify linked Google/Apple accounts, a killed app and expired sessions on both
   platforms. Outage/retry behavior has local tests. Cron stays disabled under
   the publisher's manual-only choice; the supplied template is optional.
4. TODO, privacy and public site: confirm child-data handling and any required
   parental consent for selected countries; set legal retention and deletion
   timeframes. Finalize the generated GitHub Pages privacy/support/deletion drafts. Configure
   the monitored support email to enable the external deletion request button,
   and operate/test its ownership-verification and completion process.
   Current HTML pages are clearly marked drafts and must not be submitted as live
   policy/support/deletion URLs. Complete App Privacy, Data safety and Families forms.
5. Manual recovery selected: keep purchase reconciliation Cron disabled and do
   not store its service credential in Vault. Revisit automatic recovery before
   production launch only with a new explicit publisher request. The secrets,
   migrations 009–011 and reconciliation worker are deployed; a live Test Store
   sweep recovered 500 missing coins and replayed without duplicate credits. Real
   Apple/Google sandbox billing and provider refund acceptance remain required.
6. TODO, release acceptance: create distribution-signed iOS and Android artifacts;
   inspect final permissions/privacy manifests, native 16 KB compatibility and
   signing. Test TestFlight and a Play test track on physical devices, including
   consumables, pending payments, refunds, account recovery and deletion. Prepare
   real screenshots and localized store listings; finish account-specific testing
   requirements and submission review. Production approval is not established by
   source tests or RevenueCat Test Store purchases.

Validation in this implementation pass: app/backend TypeScript, strict lint,
backend unit tests, startup checks and full game tests; hosted transactional
account-deletion tests with all changes rolled back. Public release preflight
intentionally fails until the documented configuration placeholders are filled.

## Purchase recovery and artifact checks implemented

Purchase reconciliation is now implemented in migration 010 and
`supabase/functions/reconcile-purchases`. Startup/foreground wallet work,
completed payments and Restore queue the account's own recovery job. A durable
server worker scans paginated purchases and original RevenueCat event history,
uses server app/product allowlists and the existing ledger, preserves admin
balances, and records ambiguous ownership/refund cases for review. It rejects
cross-environment data and expired workers. The hosted transactional regression
passed with migration 009/010 and all disposable fixtures rolled back.

The reconciliation function and migrations 009–011 are deployed. Both RevenueCat
secrets are saved and verified. The live sandbox sweep processed six purchases
and their history, recovered a missed 500-coin purchase and updated the running
iOS game to 3,200 coins. A full replay preserved balance 3,200 and revision 8.
There were no worker errors, quarantines or review items. Anonymous worker access
returned 401. Cron remains inactive by publisher choice; no service credential
was stored in Vault. See the operations details in `supabase/README.md`.

A reusable Android artifact check was added:

```sh
npm run release:android:pages -- path/to/app.apk --json
npm run release:android:pages -- path/to/app.aab --json
npm run test:release
```

It inspects every packaged arm64/x86_64 ELF LOAD alignment, RELRO page rounding
against writable data, and uncompressed APK native ZIP offsets. AAB offsets are
not treated as installed APK offsets. It reads artifacts without modifying or
signing them and uses Python's standard library. Parser tests run in CI.

The existing **debug APK** passed these static checks for 56 native libraries;
Android Build-Tools 36 `zipalign -c -P 16 4` also passed. The artifact has target
SDK 36 and billing permission, and remains explicitly debuggable. Its 47
nonaligned RELRO ends are followed by gaps rather than writable bytes inside the
rounded protection range. This is a static layout observation, not a runtime
compatibility guarantee. The SHA-256 and scope are recorded in
`docs/benchmarks/android-pages-2026-10-16.json`.

TODO: run the checks again on the final distribution artifact and APKs generated
from its AAB, inspect release permissions/signing and run on a 16 KB environment.
No final signed iOS/Android artifact, store upload or store approval is claimed.
References: [Android 16 KB guidance](https://developer.android.com/guide/practices/page-sizes),
[AOSP linker protection logic](https://android.googlesource.com/platform/bionic/+/refs/heads/main/linker/linker_phdr.cpp).

Settings now has a parent-gated account protection/recovery interface. Provider
flags remain disabled until credentials, redirects and native recovery acceptance
are complete. Cancellation preserves the guest session; Google uses PKCE rather
than accepting arbitrary deep-link tokens. Local games are bound to their account,
archived separately on switches and prevented from uploading to another account.
Archive restoration retains its original timestamp so stale progress cannot
overwrite newer cloud data. Paid production checkout requires a linked account;
sandbox guests can still test purchases. These safeguards have regression tests.
The privacy drafts continue to mark actual provider recovery as pending.
Older store checklists have a current-status notice and corrected audience,
publisher placeholders, wallet/deletion status and runtime configuration behavior.

### RevenueCat V2 key setup

The API V2 project identifier has been verified in RevenueCat Settings as
`projfbac6be5` and filled in the ignored local `.env`. The server key form is
prepared for V2 with Customers read/write, Purchases read and Products read.
The generated V2 key is saved in the ignored local `.env`. Read-only live
checks for the existing customer, sandbox purchases, event history and products
all returned HTTP 200 with the expected response format. Saving the key and
project ID in Supabase Secrets is complete. Both server functions use V2 and
are deployed; the dated acceptance sections below give their current status. The deletion provider checks for actual customer
removal after the asynchronous delete request and leaves the outbox pending
while that customer is still present. The later live deletion test used only an
agent-created disposable customer.

### Purchase reconciliation deployment acceptance

Secrets `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_PROJECT_ID` are saved in the
existing Supabase project. Migrations 009–011 and `reconcile-purchases` are
deployed. The live acceptance result and source hashes are recorded in
`supabase/deployments/2026-10-16-purchase-reconciliation.json`. The latest status
supersedes the earlier key-setup note: credentials and manual recovery are live;
manual operation was selected, so Cron remains disabled and its Vault setup
was cancelled without saving a secret.


### Account recovery and deletion acceptance — 17 October 2026

- `delete-account` is deployed with gateway JWT verification enabled and additional
  Auth `/user` verification. It cannot accept a client-selected deletion target.
- A fresh anonymous fixture, sandbox save/wallet and RevenueCat customer were
  created for acceptance. The first response correctly remained pending during
  RevenueCat's asynchronous deletion; a retry completed. RevenueCat GET returned
  404, the old Supabase session was rejected, saves were gone, and the private
  receipt confirmed completion without a session. An incorrect receipt returned
  no status. The private temporary test journal was removed.
- Public keys and ordinary-user calls to the server retry route returned 401.
  Save writes were blocked as soon as deletion started. No existing account was
  deleted. The owner's wallet remained 3,200 coins at revision 8.
- Source hashes and acceptance results are in
  `supabase/deployments/2026-10-17-account-deletion.json`. The opt-in live checker
  `scripts/backend/check-account-deletion-live.mjs` accepts no existing account ID.
- `.env` and `.env.example` have commented Apple/Google recovery flags, both false.
  Store preflight requires the platform's flag after provider acceptance;
  missing credentials and publisher details still intentionally block store builds.
- No Docker, second Supabase project, extra database, Vault credential or Cron
  schedule was introduced.

Verification for this pass: 53 backend tests, app/backend TypeScript, strict lint,
startup, crash recovery, native runtime safety, Android artifact-check unit tests
and the full game/native-room suite passed. Release preflight intentionally
reports missing real store SDK keys, provider enablement and publisher/contact
values. Final store binaries and real Apple/Google billing remain unverified.
