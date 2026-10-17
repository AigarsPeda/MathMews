# Server wallet and purchase ledger

This is the first backend stage of the release plan. It provides account wallets,
an immutable coin ledger, administrator adjustments, authenticated balance reads,
and an authenticated RevenueCat webhook with purchase/refund processing.

Migrations 001 through 011 are deployed to the existing MathMews Supabase project.
The 2026-10-17 room catalog and store promotion migrations are also deployed.
Current prices and scheduled sales are managed in `wallet_private.store_catalog`;
the app fetches them through `get_store_catalog()`. See [catalog and promotion instructions](../store-catalog.md).
`revenuecat-webhook`, `reconcile-purchases` and `delete-account` are deployed.
Live anonymous-account deletion passed, including actual RevenueCat removal and
Supabase Auth/save cleanup. Apple revocation and linked-provider native acceptance
remain pending. All Cron schedules remain disabled by the publisher's choice.
The mobile app now uses the server wallet for rewards and spending. The hosted
rollback suites and local webhook/client tests pass. The Edge Function and RevenueCat integration are active. A dashboard TEST event
returned HTTP 200. A simulated native Test Store purchase delivered 100 sandbox
coins through the webhook and ledger, and the running iOS game displayed 100 coins.
A live one-coin admin adjustment also appeared automatically and was reversed with
a compensating ledger entry. The 100 purchase-test coins remain available for testing.

## One project, separate environments

No additional database, Supabase project, Docker container, or paid upgrade is
required by this implementation. Development uses the hosted project's sandbox
rows. It does not run a local server database. Accounts share the existing Supabase
Auth service, while wallets, receipts, rewards and saved games carry an environment.
Existing game saves are sandbox. Production phone storage also has separate keys.

| Build profile | Data | RevenueCat |
| --- | --- | --- |
| development / development-device | sandbox | Test Store |
| preview | sandbox | Real platform SDK keys, for internal testing |
| store-sandbox | sandbox | Apple/Google sandbox billing, for TestFlight/Play tests |
| production | production | Apple/Google billing |

The production profile pins `EXPO_PUBLIC_APP_ENVIRONMENT=production`. Native store
sandbox receipts still come from Apple/Google rather than the RevenueCat Test Store.
Use the store-sandbox profile for those test builds. The SDK selects Test Store only
in development. Do not promote a sandbox build binary to the public store release.

A fresh account gets 42 welcome coins once per environment. Sandbox initialization
imports the highest historical cloud-save balance once, capped at 10,000 coins.
An existing wallet ledger entry, including an admin set to zero, takes precedence.
Production never imports development money. Starting another pet does not create
another welcome grant.

The client polls the wallet every 10 seconds while active and refreshes on foreground.
Item receipts and their wallet revision come from one database snapshot; receipt
delivery is not truncated by the API row limit. An older restored save triggers
receipt delivery again without duplicating items already recorded in that save.
Unchanged balances do not upload a new save or reload receipt history. Cloud saves
contain a cache; restoring them cannot write the authoritative wallet. Offline
puzzle attempts queue with stable IDs. The server chooses first/replay rewards
from its puzzle catalog and caps credits at 1,000 coins per UTC day. These are bounded
client assertions, not server proof that a player solved a puzzle.

Spending requires a server response and uses the server's catalog. The phone saves
a request ID before sending a debit. Connection loss retries that ID. Server order
receipts recover item delivery after a crash or an old cloud restore; permanent
applied receipt IDs prevent duplicate quantities. Unique unlocks cannot be charged
again for the same pet. Phone AsyncStorage remains the only local persistence.

## Apply the database migrations

Apply the SQL files in `supabase/migrations` in filename order, using the Supabase
SQL editor as `postgres`, or your normal migration runner. They are additive and
transactional. Apply each once. The game-wallet and environment migrations use the existing `public.game_saves` schema.
The regression script in `supabase/tests/wallet.sql` is separate from deployment.

The tables are:

| Table | Purpose |
| --- | --- |
| `coin_wallets` | One account balance per environment, status and revision. |
| `coin_wallet_entries` | Immutable adjustments with before/after balance, reason, operator and request identity. |
| `coin_pack_products` | Server-owned product-to-coin mapping. |
| `coin_purchases` | Unique transactions and their delivered/refunded state. |
| `revenuecat_events` | Durable event results, including quarantine reasons. |
| `revenuecat_apps` | Explicit allowlist of RevenueCat apps, stores and environments. |

Sandbox and production wallets are separate. Public app roles can only read their
own non-closed wallets and ledger entries. They cannot grant, set, or directly
write balances. The webhook service role can execute the event processor; it
cannot call the administrator adjustment functions or directly edit these tables.

`get_my_coin_wallet('sandbox')` or `get_my_coin_wallet('production')` returns the
authenticated caller's wallet, creating a zero balance if needed. Anonymous
Supabase users have authenticated JWTs and can use it. A stale JWT for a deleted
account cannot create a new wallet.

## Adjust any account from the SQL editor

Find the account UUID. This lookup is for an administrator, not the mobile client:

```sql
select u.id as user_id, u.email, w.environment, w.balance, w.status
from auth.users u
left join public.coin_wallets w on w.user_id = u.id
order by u.created_at desc
limit 50;
```

Generate a request UUID once with `select gen_random_uuid();`. Replace the
placeholders below, retaining the same request UUID when retrying the same action.
Generating a fresh UUID for every retry would create additional adjustments.

Add 1,000 test coins:

```sql
select * from public.admin_adjust_coins(
  p_user_id := '<ACCOUNT_UUID>'::uuid,
  p_amount := 1000,
  p_reason := 'Testing room purchases',
  p_request_id := '<REQUEST_UUID>'::uuid,
  p_environment := 'sandbox',
  p_operator := 'Aigars'
);
```

Set an account to exactly 500 coins:

```sql
select * from public.admin_set_coin_balance(
  p_user_id := '<ACCOUNT_UUID>'::uuid,
  p_balance := 500,
  p_reason := 'Reset test balance',
  p_request_id := '<ANOTHER_REQUEST_UUID>'::uuid,
  p_environment := 'sandbox',
  p_operator := 'Aigars'
);
```

Use a negative `p_amount` to remove coins. Admin operations reject a resulting
negative balance, unknown accounts, and blocked/closed wallets. To adjust a live
wallet, explicitly choose `production`. Setting the same target twice with the
same request UUID returns the original adjustment and cannot erase later credits.
Reusing a request UUID with different parameters is rejected.

The operator label is supplied by the trusted administrator; the database records
the invoking database role separately. This does not identify individual dashboard
users who share a database role. Keep access to the SQL editor restricted to your
existing administrators. Use compensating adjustments to correct mistakes;
ledger rows reject updates and deletes. Do not edit balances through Table Editor.

## Configure RevenueCat delivery

1. Deploy `revenuecat-webhook` using the Supabase CLI or Edge Functions editor.
   `supabase/config.toml` disables the Supabase JWT gateway check for this external
   webhook; the handler requires its own strong Authorization credential before reading
   the body. Missing or short authorization configuration fails closed. The optional Bearer
   scheme and surrounding header whitespace are normalized; the secret itself must match.
2. Set the server-only `REVENUECAT_WEBHOOK_AUTHORIZATION` secret to a strong random
   value with at least 32 secret characters, such as `Bearer <random secret>`. Set exactly
   the same Authorization header in the RevenueCat webhook integration. Supabase
   provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the runtime. Never put
   these secrets in `EXPO_PUBLIC_*` or source control.
3. The actual Test Store app ID `appff09380af7` is registered. Register real store
   app IDs before accepting their purchases. The app ID is different from the project ID,
   bundle identifier and public SDK key. For the Test Store:

   ```sql
   insert into public.revenuecat_apps (app_id, store, environments)
   -- TODO: Replace this with the actual Apple app ID from RevenueCat.
   -- Also register the actual Google app ID using store = 'PLAY_STORE'.
   -- These placeholders are documentation only and must not be executed as-is.
   values ('<APPLE_REVENUECAT_APP_ID_REQUIRED>', 'APP_STORE', array['sandbox','production']);
   ```

   Register separate `APP_STORE` and `PLAY_STORE` apps when available, with the
   environments you intend to accept. Test Store production grants are forbidden.
4. Send RevenueCat webhooks to
   `https://<PROJECT_REF>.supabase.co/functions/v1/revenuecat-webhook`. Enable
   `NON_RENEWING_PURCHASE`, `CANCELLATION`, `REFUND_REVERSED`, and `TRANSFER` events.
   A dashboard `TEST` event is acknowledged without granting coins.
5. Configure RevenueCat App User IDs as the Supabase account UUID. The processor
   quarantines anonymous RevenueCat IDs and unknown accounts. Aliases do not
   authorize a transaction transfer to another account.

The handler stores only the fields needed for delivery, not subscriber attributes,
contact data, advertising IDs or raw receipts. It rejects invalid authorization,
malformed data and bodies larger than 64 KiB. Database failures return HTTP 503 so
RevenueCat can retry. Acknowledged events have been durably processed, ignored or
quarantined in one database transaction. Purchase grants are deduplicated by both
event ID and app/store/environment/transaction identity.

Refunds with `cancel_reason = CUSTOMER_SUPPORT` debit the original grant once,
even if coins have already been spent. This may leave debt, which future grants
offset. Newer refund-state timestamps win; refunds win timestamp ties. A refund
received before its purchase prevents a later stale grant. Unrecognized refund
reasons and ownership transfers require review rather than automatic changes.
Reversals affect only the original recorded coin quantity.

Review unresolved events in the SQL editor:

```sql
select event_id, state, reason, received_at
from public.revenuecat_events
where state in ('pending', 'quarantined')
order by received_at;
```

After correcting configuration, replay the stored event without changing its ID:

```sql
select public.record_revenuecat_event(event)
from public.revenuecat_events
where event_id = '<EVENT_ID>';
```

Closed wallets and transaction uniqueness survive auth deletion. A future deletion
workflow still needs to block wallets before cleanup and implement disclosed
retention/anonymization. This trigger is not a complete account-deletion service.
Reconciliation against RevenueCat's API after exhausted webhook retries, automatic
alias recovery and stronger earned-reward verification remain release-plan work.

## Verify locally and in CI

```sh
npm run typecheck:backend
npm run test:backend
```

These commands typecheck the backend and test the webhook handler with the existing
Node/TypeScript development tools. CI runs these checks without any database service.

For database behavior, run `supabase/tests/wallet.sql` and
`supabase/tests/game-wallet.sql` as `postgres` in your existing
Supabase project's SQL editor. It creates temporary test accounts, verifies admin
adjustments, retries, permissions, owner filtering, purchase grants, refunds and
account deletion, then rolls the entire transaction back. It must end with the
explicit success message. If an assertion fails, issue `rollback;` before further
queries. It does not alter real users' balances or require a separate database.
Live simultaneous-connection load testing is not part of this SQL script.

Implementation references: [Supabase function security](https://supabase.com/docs/guides/database/functions),
[external Edge Function authentication](https://supabase.com/docs/guides/functions/auth),
[RevenueCat event definitions](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields),
[RevenueCat webhook retries](https://www.revenuecat.com/docs/integrations/webhooks).

## Store configuration still required

`.env` and `.env.example` contain commented placeholders for the missing Apple
`appl_...` and Google `goog_...` public SDK keys. Development's test key uses
`EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY`. Expo configuration rejects a production
or store-sandbox build with missing, placeholder, or Test Store platform keys.
Copy public values into the corresponding EAS production/preview environment for
remote builds, because the ignored local `.env` is not uploaded automatically.

TODO before real billing: create/connect the Apple and Google apps in this same
RevenueCat project, create and approve the three consumable products in each store,
add them to the offering, and register their actual app IDs in `revenuecat_apps`.
The IDs cannot be inferred from the project ID or bundle ID. Never add a placeholder
app ID as an active allowlist entry. The webhook secret belongs only in Supabase
Secrets and RevenueCat, never in the phone or a public environment variable.

This wallet work is not a complete store approval. Account deletion, privacy/Kids
requirements, parent purchase controls, store metadata, signing and device billing
acceptance tests remain listed in `RELEASE_PLAN.md`.

An optional private local copy may be kept as `REVENUECAT_WEBHOOK_AUTHORIZATION`
in the ignored `.env`. Supabase does not read that file: set its VALUE under the
server secret name `REVENUECAT_WEBHOOK_AUTHORIZATION` and in RevenueCat separately.
Do not paste the variable name or `=` sign into either value field.

The native parent gate and coin catalog now share one sheet. Passing the gate
changes its content, avoiding an iOS presentation race between two sibling sheets.
`npm run test:backend` includes interrupted purchases, restart recovery, old-save
recovery, account/save isolation, environment selection, SDK identity serialization,
credential formatting and the single-sheet parent gate.

## Account deletion

Migration `202610160009_account_deletion.sql` and Edge Function `delete-account`
are deployed. Live anonymous-account acceptance passed on 17 October 2026,
including actual RevenueCat customer removal. Only the agent-created fixture was
deleted; the owner's account and 3,200-coin balance remain unchanged. Cron is disabled.
The hosted transactional tests also passed with fixture changes rolled back.

The app first requests its own deletion using the authenticated RPC, persists a
server-generated status receipt, and invokes the authenticated Edge Function.
The function verifies the JWT with Supabase Auth, derives the target from that
identity and ignores client-supplied user IDs. Both wallet environments close and
new save writes are rejected. A successful native Apple code exchange is bound
to the stored Apple subject before revocation. RevenueCat cleanup must succeed
before Auth and every cloud save are removed. The limited ledger remains as a
pseudonymous transaction tombstone. Set its legally required retention schedule
before publication. The private outbox has RLS and no app-readable provider data.

An accepted job remains pending after an outage. The app keeps its local game,
session and receipt; it does not start another guest or report success. The
receipt can check pending/completed without the deleted Auth session. The prepare
RPC alone does not authorize background completion. Only the Edge Function
confirms the job after the phone persisted that receipt.

Remaining provider and operational acceptance:

1. The existing RevenueCat V2 key and project ID are saved in Supabase Secrets
   and customer deletion permission has passed live acceptance. TODO: configure
   `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY` with
   the corresponding Sign in with Apple .p8 key. Private placeholders remain in
   `.env`; Supabase does not load that local file automatically.
2. Keep gateway JWT verification enabled. The handler additionally verifies the
   current user through Auth. Never reuse the webhook credential for deletion.
3. Anonymous deletion passed. TODO: native linked Google/Apple accounts, app-kill
   and expired-session acceptance on both platforms. Local tests cover provider
   outages and honest pending status. Never use the owner's account as a fixture.
4. Cron and Vault remain unused by the publisher's manual-only choice. The optional
   `supabase/cron/account-deletion.sql` template requires a new explicit request.
   A service-authenticated `/delete-account/retry` invocation retries up to five
   confirmed non-Apple-blocked jobs. Apple cleanup needs a fresh native code.
5. Monitor pending requests, set the promised completion timeframe and implement
   the public ownership-verified request process before submitting Google's
   deletion URL. No completion deadline has been asserted.

Current source checks include backend unit tests, app/backend TypeScript, strict CI
lint, startup and full game regressions. The stale native-room matcher, Home test
mocks and missing effect-asset fixtures have been fixed. Real Apple/Google billing
and deletion provider acceptance still need their credentials and physical devices.

`npm run release:check` validates both platforms; append `-- --platform ios` or
`-- --platform android` to check one. Missing identity/support URLs now fail store
builds too. `node --env-file-if-exists=.env scripts/backend/generate-legal-pages.mjs`
regenerates draft public privacy/support/deletion pages; privacy content comes from
`legal/privacy-policy-content.ts`. Finalize all TODOs before publication.

## Purchase reconciliation, deployed and tested

Migration `202610160010_purchase_reconciliation.sql`, the four files in
`functions/reconcile-purchases`, and `cron/purchase-reconciliation.sql` implement
server recovery for missed webhook delivery. Migrations 009–011 and the Edge
Function are deployed; both RevenueCat secrets are saved and verified. The
publisher chose manual reconciliation only. Cron is disabled and no service
credential was stored in Vault.
They use the existing hosted database. No Docker, second project, additional
runtime service or npm dependency is required.

The app requests recovery at wallet initialization and at most once per five
minutes while active, after native payment succeeds, and from Restore. Requests
can only accelerate the caller's own environment and have a server cooldown.
Failure to queue recovery does not disable the existing wallet or turn an SDK
receipt into a client coin grant. Restore reports that recovery is queued.

A service-authenticated worker claims three jobs with expiring leases. Each job
processes one page of 25 purchases or historical events, then saves its cursor.
Partial failures repeat the page with deterministic IDs. The immutable ledger's
transaction key prevents another grant when a webhook arrives before or after
recovery. Reconciliation adds ledger deltas; it never replaces the balance with
an API total. An administrator's exact balance adjustment therefore survives
repeated recovery of an already credited purchase.

The worker fetches RevenueCat API v2 with a server-only key. It maps internal
product IDs to their store SKUs and app IDs, then uses the existing server
product/app allowlists. Both the current and original purchase owner must be
the canonical Supabase UUID. Transfers, unexpected identities, multi-quantity
purchases and incomplete financial events require review. Sandbox and production
remain separate in both API queries and database validation.

Purchase snapshots establish that a transaction exists. `owned` never cancels an
existing refund. For a snapshot-only refund, purchase time is a conservative
lower bound, not an invented current refund time. Original event timestamps from
RevenueCat history handle cancellations and refund reversals. A conflicting
snapshot cannot overwrite newer refund history; unresolved conflicts are kept
in the private review table. Missing customers or missing purchases never imply
refunds. Raw subscriber attributes, purchase prices and country data are not
persisted by this worker.

A complete sweep runs again after six hours. A recent request schedules a short
follow-up, including a checkout requested while a worker was already processing.
Rate limits and provider failures back off ten minutes without losing the cursor.
The optional Cron template polls every minute and invokes the worker only for
due jobs. It is not activated: the publisher chose manual operation. App recovery
requests persist in the queue until a manual service-authenticated worker call.
The existing purchase webhook remains active for normal delivery.

Deployment status in the existing project:

- Complete: both RevenueCat secrets are saved and their digests verified.
- Complete: migrations 009–011 and `reconcile-purchases` are deployed. Gateway
  JWT verification remains enabled; a read-only PostgREST authorization check
  independently verifies alternate service JWTs and service-only permission.
- Complete: live Test Store purchases and event history passed, including a
  recovered 500-coin purchase and a full replay without duplicate credits.
- Manual operation selected by the publisher: Cron remains disabled, hosted
  Cron/pg_net were not enabled, and no service credential was saved in Vault.
  Keep the Cron template for a future explicit request; do not activate it as
  an outstanding approval item. Run the deployed worker manually with a valid
  service-role credential to process queued recovery requests.
- Still required for release: real Apple/Google sandbox billing, refund/provider
  acceptance and disposable-account deletion testing with their credentials.

Administrator monitoring in the Supabase SQL editor:

```sql
select user_id, environment, phase, next_attempt_at, lease_until,
       last_completed_at, last_error, attempts
from wallet_private.purchase_reconciliation
order by next_attempt_at;

select user_id, environment, source_id, reason, details, last_seen_at
from wallet_private.purchase_reconciliation_issues
order by last_seen_at desc;

select event_id, reason, received_at
from public.revenuecat_events
where state = 'quarantined'
order by received_at desc;
```

Resolve ownership/refund conflicts against verified store/RevenueCat records.
Never fabricate a transaction, edit ledger entries, or transfer a previously
credited transaction by changing the phone's save. An explicitly audited admin
adjustment is available for a support decision, separately from purchase history.

`supabase/tests/purchase-reconciliation.sql` verifies purchase recovery, duplicate
webhooks, refund order/reversals, preserved admin balances, lease/cursor safety,
cooldowns, environment isolation and deletion fencing. The migration-plus-test
transaction passed in the existing hosted project and rolled back all changes.
Node tests cover the API reader, service authorization, strict identity mapping,
pagination confinement, partial failures and schema validation.

API references: [customer purchases and event history](https://www.revenuecat.com/docs/api-v2/customer/resources),
[purchase state and store transaction identifiers](https://www.revenuecat.com/docs/api-v2/purchase),
[product and app mapping](https://www.revenuecat.com/docs/api-v2/product).

### RevenueCat server key version

Use one **V2** secret API key for reconciliation and account deletion. Grant only
`customer_information:customers:read_write`,
`customer_information:purchases:read` and `project_configuration:products:read`.
Save it as `REVENUECAT_SECRET_API_KEY` in Supabase Secrets. Also set
`REVENUECAT_PROJECT_ID` to the API V2 identifier displayed in Project Settings,
`projfbac6be5` for this project. The dashboard slug `fbac6be5` is not that identifier.
The prepared deletion provider now calls the V2 endpoint and confirms customer
removal before advancing its outbox. An asynchronous queued response remains
pending until a subsequent customer lookup returns not found. No V1 key is needed.
Both functions are now deployed; see the dated acceptance records below. Cron remains disabled.

### Live acceptance on 16 October 2026

Both RevenueCat secret digests match the ignored local configuration. The API
project ID is `projfbac6be5`. Gateway JWT verification remains enabled. A real
service-role JWT was verified through PostgREST; anonymous worker calls returned
401. The original exact-token comparison did not accept the dashboard credential,
so migration 011 and the database-verified service authorization fallback were
deployed. This does not trust unsigned JWT claims or grant client access.

The first live sandbox sweep processed six purchases and six history events,
with no errors, quarantines or review items. It recovered one missed 500-coin
purchase: wallet 2,700 → 3,200, revision 7 → 8. Replaying both phases processed
the same six purchases/events without another ledger grant; the wallet remained
3,200 at revision 8. The running iOS game displayed 3,200 automatically.
Hosted rollback tests covered admin balance preservation, refunds, leases,
permissions, environment isolation and deletion fencing. All 40 backend unit
tests, backend TypeScript and targeted strict lint passed.

The publisher explicitly selected manual deployment and testing only. Cron
remains disabled and no service-role credential was stored in Vault. Queue
requests persist until a manual service-authenticated worker call. Scheduled
recovery is not an outstanding approval item and must not be activated without
a new explicit request. Real Apple/Google sandbox billing and linked-provider
deletion acceptance remain release requirements; anonymous deletion passed on 17 October. See `deployments/2026-10-16-purchase-reconciliation.json`.


## Account recovery safeguards

Settings contains a parent-gated account protection and recovery section. Keep
`EXPO_PUBLIC_APPLE_AUTH_ENABLED` and `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` false until
Supabase provider credentials/redirects and native identity linking/recovery are
tested. Production checkout requires a linked account; guest sandbox testing
continues to work. Cancelling recovery preserves the current session. Google
OAuth uses PKCE and only accepts a code returned to the active auth flow.

Phone game caches and archives carry an account owner and environment. Switching
accounts archives the previous game, restores the target account's own cache or
starts fresh, and never uploads the previous account's progress into that account.
Cloud read failures do not authorize an upload over an unknown remote state.
Completed deletion also clears the deleted account's phone archives.

## Live deletion acceptance

`supabase/deployments/2026-10-17-account-deletion.json` records the deployed source
and the successful disposable-account test. For agent-run acceptance only:

```bash
node --env-file=.env scripts/backend/check-account-deletion-live.mjs --confirm-disposable-account
```

This command creates and removes its own anonymous account, sandbox save/wallet
and RevenueCat customer. It cannot target an existing account. If provider cleanup
is pending, rerun the same command; its private temporary journal preserves the
fixture and receipt, and is removed after success. This is separate from ordinary
manual purchase reconciliation. Cron and Vault remain unused.
