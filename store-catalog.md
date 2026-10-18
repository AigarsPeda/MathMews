# Shop items, prices and promotions

Supabase owns current coin prices. The app reads `get_store_catalog()` at startup,
when the shop opens, when it returns to the foreground, and every 30 seconds while
active. Sale boundaries update an open shop automatically. The server's clock
determines sale timing. No Cron job is needed.

The room artwork and translations ship with the app. Adding a new model still
needs an app update, but changing a price or scheduling a promotion does not need
another update after this catalog-enabled version is installed.

## Change a price

In the Supabase Table Editor, select the `wallet_private` schema and open
`store_catalog`. Find a row using `kind` and `item_id`. Edit `price` to change its
normal coin price. These rows can only be edited by the project administrator;
players can read the public price response and submit purchases.

Each row also has:

| Column | Meaning |
| --- | --- |
| `sale_price` | Discounted coin price, including zero for a free promotion. Null disables the sale. |
| `sale_starts_at` | Optional starting timestamp. Null starts immediately. |
| `sale_ends_at` | Optional ending timestamp. Null keeps the sale active until cleared. |
| `sale_label` | Optional short label such as `Autumn sale`. Without a label, the app uses its translated `Sale` label. |

Sale prices cannot be negative or exceed the normal price. An end date must be
after the start date. When a sale ends, the normal price returns automatically.

Discounted store cards and previews show a percentage badge, the crossed-out
original price, and the optional sale label. Percentages use the actual coin
saving rounded down. Timed sales also show a live countdown, using the same
server-adjusted clock as pricing. The countdown shows days/hours for long sales
and seconds in the final hour. Sales without an end date show no countdown.
A store-wide banner advertises active offers even while browsing another
category. Its View deals action opens the matching category and clears the
Owned filter. Tabs with active offers show a Sale badge. Different campaign end
dates stay separate so the banner countdown matches the advertised offer.
Expired discounts disappear automatically; English and Latvian are supported.
Timestamps are stored as `timestamptz`; include a timezone when entering a date.
Custom labels are displayed as entered in both languages.

For example, this SQL schedules a 25% discount on rooms for seven days:

```sql
update wallet_private.store_catalog
set sale_price = floor(price * 0.75)::integer,
    sale_starts_at = now(),
    sale_ends_at = now() + interval '7 days',
    sale_label = 'Autumn sale'
where kind = 'room' and price > 0;
```

To stop that room promotion immediately:

```sql
update wallet_private.store_catalog
set sale_price = null, sale_starts_at = null, sale_ends_at = null, sale_label = null
where kind = 'room';
```

Checkout sends the price shown to the player. Supabase calculates the actual
price again inside the purchase transaction. A mismatch rejects the purchase
without spending coins, refreshes the shop and asks the player to try again.
Successful purchase retries replay their original receipt even if a promotion
has changed. Installed older clients and pending older requests keep using the
existing endpoint; the server still chooses their actual price.

If a price refresh fails, the last in-memory snapshot remains visible. On a cold
offline launch, bundled initial prices provide display defaults. After the wallet has synced once, virtual-coin purchases can be queued offline.
The app persists each request before granting the item, reserves its displayed
price from the cached balance, and shows the number waiting to sync. Puzzle
rewards also remain queued and replay in timestamp order with purchases.

The account/environment-scoped AsyncStorage outbox survives app restarts. Each
purchase keeps its request ID and expected price on every retry. A lost response
cannot charge or deliver the same purchase twice. Requests for another pet wait
until that pet is opened. Normal pet progress continues through cloud snapshots;
real-money coin packs still require verified server delivery.

Supabase decides the final balance and price. If it rejects a pending purchase,
the app releases its reservation, removes the provisional ownership and all
placements in active, named and saved room layouts, clears editor Undo history
that could restore the item, then shows a notification
until acknowledged. Confirmed copies stay owned. A rejected room finish falls
back to a previously owned finish. Rejection tombstones prevent older restored
snapshots from bringing cancelled items back. The expected-price check rejects
expired promotions rather than silently charging more. Confirmed purchases are
never cancelled merely because a later queued purchase fails.

## Add a room

Add one entry to `data/room-catalog.json`. Copy an existing entry and choose a new,
permanent ID such as `room31`. Define its English and Latvian name/description,
wall and floor patterns/colors, and `initialPrice`.

```sh
npm run catalog:build -- room31
```

This command validates the definition, generates app registrations, translations,
bundled display defaults and Blender inventory, builds its PNG and GLB, verifies
the assets, and creates a new Supabase migration for the item if needed. Apply
that printed migration using the project's normal migration runner or SQL Editor.
Changing only metadata can use `npm run catalog:sync` without Blender.

Existing pattern names are validated by `scripts/catalog/sync.mjs`. An entirely
new pattern also needs its authoring code in `scripts/3d/room_finishes.py` and its
name in the validator. Color variants of existing patterns need only the JSON
entry. `BLENDER_BIN` can select a non-default Blender executable.

Keep existing room IDs in the manifest because saved purchases refer to them.
`initialPrice` seeds a new server row and supplies offline display defaults. It
never overrides an existing server price or promotion.

## Other items and checks

Furniture, beds, toys and skins retain their existing model/category authoring
files. Add their initial display price to `data/store-prices.json`, then run
`npm run catalog:sync` to generate their insert-only server registration. New
geometry still needs the usual PNG/GLB build. Changing live prices only requires
the Supabase table, without editing this JSON.

```sh
npm run catalog:check
npm run test:catalog
```

`catalog:check` detects stale room outputs and items missing a server seed.
Repeated sync runs are idempotent. Applied migrations are never rewritten.
The older `scripts/backend/generate-wallet-catalog.mjs` entry point now also
creates forward-only item and puzzle seeds and preserves existing server edits.

Database regression checks are in `supabase/tests/store-catalog.sql`. Run them as
the project administrator; their fixtures and ledger entries roll back.

## Bedroom furnishings and lower coin prices

On October 17, 2026, all 414 paid catalog entries were reduced to half their previous virtual coin price, rounded down. Free entries stay free. Lives cost 7 coins. Active sale prices were scaled with their base prices; campaign labels and start/end times were preserved. Real-money coin packs were not changed.

The seven added bedroom items cost 2–28 coins. Full-size beds support **Sleep on bed** and **Snuggle under covers** from the bed or cat menu, including all seven existing human bed colors. Small pet baskets have no duvet actions.

The source models live in `scripts/3d/bedroom_additions.py`. `Bed cover lift` is the quilt node used by the renderer; `bed.surface` and `bed.covered` in the exported model catalog define the mattress contacts. Keep these when adding a bed variant.

The applied SQL is recorded in `supabase/deployments/2026-10-17-bedroom-prices.json`. The named Supabase query is **Store - Bedroom Furniture and Half-Price Coin Items**. Its exact price targets make it safe to rerun without halving prices again. Future routine catalog syncs continue to preserve server-managed prices.

## Item interactions

`data/item-interactions.json` reviews every decoration ID, including visual variants. It is shared by the app menus and the Blender exporter. Existing fridges, curtains, lamps, beds, toys and cat activities keep their specialized behavior.

| Items | Interaction |
| --- | --- |
| Cupboards, wardrobes and sink cabinets | Swing doors open and closed, revealing shelves and stored linen. The oak wardrobe, Japanese closet and two office closets also offer Hide in cupboard when their resized interior fits the cat. Closing waits for the cat to leave. |
| Dressers, nightstands, vanity drawers and modular kitchen drawers | Slide out real trays. Sit in the drawer opens the selected copy and sends the cat into its top tray. Closing waits for the cat's exit. |
| Chests, storage boxes and first-aid kits | Open and close their lid or front. |
| Windows and doors | Open and close a moving sash, leaf or sliding panel. The window's outside sky stays in the wall opening. |
| Laptops, oven and microwave doors, projection screen | Open, close or retract their moving parts. |
| Displays, consoles and office electronics | Turn on and off with screen or status-light feedback. Existing animated machines run while powered. |
| Mixers | Turn on rotating whisks and beaters, or stop them. |
| Taps and dispensers | Run water and stop it. |
| Fireplace, lantern, pumpkin and cauldron | Switch their glow or flame effects on and off. |
| Other decorations | Keep their existing cat activity, or offer Investigate using a reachable floor position. Rooms, coats and colors retain their customization purpose. |

Opening and power state belong to each placed instance and survive local saves, cloud layout normalization and room changes. Open-part clearance is derived from the shipped mesh hierarchy. Cat navigation checks the selected tray, approach and jump path. Existing ownership reconciliation removes these items normally if a queued purchase is cancelled.

When adding an item, add its capability entry alongside the normal catalog entry. `scripts/3d/item_interactions.py` authors named moving groups and power materials; `scripts/3d/export-native.py` records their pivots, travel and drawer contact in the generated native catalog. A `cat: "cupboardHide"` entry raises the interior shelf and exports a lower-compartment contact and clearance. Rebuild a changed model with the existing native export command and `--items --id=<itemId>`. The export also rebuilds placement bounds. Do not edit generated pivots by hand.

Run `node scripts/check-item-interactions.mjs` and `npm run test:game`. The checks cover catalog completeness, independent copies, saved state, shipped moving parts, drawing callbacks, all four drawer orientations, safe exit, and the actual room menus.
