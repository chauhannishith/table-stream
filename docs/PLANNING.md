# table-stream — Implementation Planning

> **Status:** Initial draft — to be refined iteratively  
> **Last updated:** 2026-07-02 (Phase 0 decisions: SQLite, tax mode, invoice print, manual MVP ops)

## 1. System Context (Summary)

**table-stream** is a local-first restaurant POS and operational sync engine. Each **location** runs a central **hub** on-prem; all staff devices (waiter tablets, kitchen displays, counter, customer screen) connect to that hub over the restaurant LAN. The hub is the sole source of truth for live operations and local persistence.

**Cloud has two roles:**

1. **Control plane (always)** — business profile, subscription/licensing. Hub fetches org business details (GST, address, phone) from cloud for invoice printing. Hub is **enabled or disabled** based on subscription payment status.
2. **Data plane (optional)** — `cloud_sync_enabled` controls whether operational text is replicated upstream. When off, transactional data stays on the hub indefinitely.

**Invoice documents** (PDFs/rows) remain hub-local. **Business identity** (legal name, GST number, address, phone) is cloud-managed so the service operator can run subscriptions and centrally update branding across locations.

Multi-location deployments use an **`org_id`** to group locations under one organization.

### Core constraints

| Constraint | Implication |
|---|---|
| Hub as single source of truth | All devices read/write via the location hub over LAN — no peer-to-peer between tablets |
| Local partition tolerance | Floor ops work when hub is up on LAN; subscription validity requires cloud reachability at period end |
| **Cloud control plane** | Business profile + subscription status from cloud; **no offline grace** — service ends on last paid day |
| **Subscription gate** | Subscription ends on `current_period_end` — no extension; hub → `SUSPENDED` |
| **Suspended hub** | Read-only forever: view/reprint past invoices, **export all local data to Excel** — no new ops |
| **Optional data sync** | `cloud_sync_enabled = false` → operational data local only; `true` → full text backfill + incremental |
| Sub-millisecond floor ops | Hot path stays in hub Redis; disk DB on hub for durability |
| **Local-only invoice records** | Invoice rows/PDFs never replicated to cloud — printed using cloud-cached business header |
| Immutable local audit | Finalized invoices are append-only on the hub; corrections use void/credit-note rows |
| Race-free table allocation | Atomic leases + optimistic concurrency on commit |

### Deployment topology (per location)

```
  ORG (org_id) ── owns ──► Location A, Location B, …
                              │
                              ▼
                    ┌─────────────────────┐
                    │  LOCATION HUB       │  ← server deployed here
                    │  Redis · DB · API   │     (one hub per location)
                    │  Print · Sync agent │
                    └──────────┬──────────┘
                               │ LAN only (TLS)
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   ┌───────────┐         ┌───────────┐         ┌───────────┐
   │  Waiter   │         │  Kitchen  │         │  Counter  │
   │  tablets  │         │  display  │         │  + setup  │
   └───────────┘         └───────────┘         └───────────┘
                               │
                         ┌───────────┐
                         │ Customer  │
                         │ (takeaway)│
                         └───────────┘

                    Hub ──internet──► Cloud control plane (always)
                    │                 · business profile (GST, address, phone)
                    │                 · subscription / hub enable-disable
                    │
                    └──optional──────► Cloud data sync (if cloud_sync_enabled)
```

**Hub responsibilities:** Redis, local DB, REST/WebSocket API, print service, persist worker, **license-checker** (subscription + business profile), optional sync-agent/backfill.

**Device responsibilities:** Render UI, capture staff input, subscribe to hub pub/sub via WebSocket. Devices hold no authoritative state.

### Architecture layers

```
┌─────────────────────────────────────────────────────────────────┐
│  DEVICE LAYER (LAN clients)                                     │
│  Waiter · Kitchen · Counter · Customer  →  HTTPS/WSS → Hub API  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  HUB — ACTIVE LAYER                                               │
│  Redis (live ops) · Streams/PubSub                                │
└───────────────────────────────┬─────────────────────────────────┘
                                │ async persist
┌───────────────────────────────▼─────────────────────────────────┐
│  HUB — PERSISTENCE LAYER                                        │
│  Local SQLite / PostgreSQL  ·  sync outbox (if cloud enabled)   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ only if cloud_sync_enabled + online
┌───────────────────────────────▼─────────────────────────────────┐
│  CLOUD                                                          │
│  Control plane: org profile, subscription, hub entitlements     │
│  Data plane (optional): Kafka → cloud DB when cloud_sync_enabled │
│  ⚠ Invoice PDFs/rows stay on hub; business header from cloud    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Module 1 — Redis Data Structures

Redis is the **authoritative live state** on the hub during service hours. The hub's local DB is the **durability and recovery** source; Redis is rebuilt from DB + replay on cold start.

### 2.1 Key namespaces

| Prefix | Purpose |
|---|---|
| `ts:floor:{location_id}` | Table layout and live status (grouped by zone) |
| `ts:lease:{location_id}` | Short-lived resource locks |
| `ts:kds:{station_id}` | Per-station kitchen order queues |
| `ts:order:{order_id}` | In-flight order snapshots |
| `ts:takeaway:{location_id}` | Takeaway token queue + customer-facing status |
| `ts:token:{location_id}` | Dine-in / takeaway token counters |
| `ts:stream:events` | Cross-node fan-out (Redis Streams) |
| `ts:pub:floor` | Ephemeral UI broadcast (waiter / counter tablets) |
| `ts:pub:kds` | Kitchen display push channel |
| `ts:pub:customer` | Takeaway customer display push channel |

### 2.2 Table state (HASH per table)

**Key:** `ts:floor:{location_id}:table:{table_id}`

| Field | Type | Values / notes |
|---|---|---|
| `status` | string | `AVAILABLE` \| `OCCUPIED` \| `RESERVED` \| `DIRTY` |
| `zone_id` | string | from setup; drives zone-wise menu pricing for this table |
| `party_size` | int | nullable when `AVAILABLE` |
| `assigned_server_id` | string | nullable |
| `current_order_id` | string | nullable |
| `version` | int | monotonic; incremented on every mutation |
| `updated_at` | ISO8601 | last writer timestamp |
| `lease_token` | string | nullable; matches active lease if reserved/occupied transition in progress |

**Index sets (for O(1) floor queries):**

- `ts:floor:{location_id}:by_status:{status}` → SET of `table_id`
- `ts:floor:{location_id}:by_zone:{zone_id}` → SET of `table_id`
- `ts:floor:{location_id}:tables` → SET of all table IDs

**Mutation pattern:** Lua script or `WATCH`/`MULTI`/`EXEC` bundle:

1. Verify `version` matches expected (optimistic check on hot path)
2. Update HASH fields
3. Move `table_id` between status SETs
4. `XADD` to `ts:stream:events` with event payload

### 2.3 Atomic lease pattern (dual reservation prevention)

**Key:** `ts:lease:{location_id}:{resource_type}:{resource_id}`  
**Resource types:** `table`, `order_slot`, `payment_intent` (extend as needed)

| Field | Value |
|---|---|
| (string value) | `lease_token` (UUID v7) |
| TTL | 300 seconds (5 minutes) |

**Acquire script (conceptual):**

```
IF resource is AVAILABLE (or lease expired)
  SET lease key NX EX 300 → lease_token
  IF success → transition table to RESERVED with lease_token
  ELSE → return CONFLICT + current holder metadata
```

**Release paths:**

- **Happy path:** seating/payment completes → lease deleted, status → `OCCUPIED` or order finalized
- **Abandon path:** TTL expiry → keyspace notification or polling worker rolls table back to `AVAILABLE`
- **Explicit cancel:** client sends `lease_token`; script verifies match before release

**Companion key:** `ts:lease:{location_id}:meta:{lease_token}` (HASH) stores `{ resource_type, resource_id, actor_id, created_at }` for rollback workers.

### 2.4 Kitchen display queues (per station)

**Primary queue — sorted set (priority + FIFO tie-break):**

**Key:** `ts:kds:{station_id}:queue`  
**Score:** `{priority_bucket * 1e13} + {unix_ms}` (e.g. fire=0, normal=1, hold=2)

**Member:** `order_line_id`

**Line item detail — HASH:**

**Key:** `ts:kds:{station_id}:item:{order_line_id}`

| Field | Notes |
|---|---|
| `order_id` | parent order |
| `table_id` | nullable for takeaway |
| `order_type` | `DINE_IN` \| `TAKEAWAY` |
| `token_number` | display token — separate sequences per `order_type` |
| `item_name` | display label |
| `modifiers` | JSON array: `[{ "type": "add" \| "remove", "code": "extra_cheese", "label": "Extra cheese" }, ...]` |
| `special_instructions` | free text |
| `status` | `QUEUED` \| `IN_PROGRESS` \| `PREPARED` \| `RECALLED` — `PREPARED` hidden from view |
| `is_submitted` | `true` only — kitchen never receives draft lines |
| `submitted_at` | ISO8601 — set when waiter submits batch |
| `submit_batch` | int — add-on round number on same `order_id` |
| `kds_visible` | `false` when unstaged or after `PREPARED` |
| `queued_at` | ISO8601 |
| `version` | bump on bump/recall |

**Station subscription:** consumers read `XREAD BLOCK` on `ts:stream:events` filtered by `station_id`, or dedicated stream `ts:stream:kds:{station_id}`.

**Recall / 86 flow:** status → `RECALLED`; alert pushed to waiter via `ts:pub:floor`; waiter must cancel line; item remains in HASH for audit until order closes.

### 2.5 Live order snapshot

**Key:** `ts:order:{order_id}` (HASH)

| Field | Notes |
|---|---|
| `order_type` | `DINE_IN` \| `TAKEAWAY` |
| `table_id` | nullable for takeaway |
| `zone_id` | pricing zone — from table zone (dine-in) or counter-selected zone (takeaway) |
| `token_number` | e.g. dine-in `D-042`, takeaway `T-018` |
| `customer_name` | nullable; required for takeaway at counter |
| `customer_contact` | nullable; phone/email — local only, never synced |
| `status` | `DRAFT` \| `SUBMITTED` \| `IN_KITCHEN` \| `SERVED` \| `CHECK_PRINTED` \| `PAID` \| `VOID` |
| `fulfillment_status` | takeaway customer display — see §5.4 |
| `lines` | JSON (compact line array) or reference to line keys |
| `subtotal_cents` | computed on edge using zone prices |
| `version` | required for commit |
| `lease_token` | if checkout in progress |

**Active orders index:** `ts:floor:{location_id}:active_orders` (SET)

### 2.5.1 Token counters (dine-in vs takeaway)

Separate sequences — never shared between order types.

**Keys:**

- `ts:token:{location_id}:dine_in` → INT counter (resets per shift/day per setup policy)
- `ts:token:{location_id}:takeaway` → INT counter

**Allocation (Lua):** on order submit, `INCR` the appropriate counter → format with prefix from setup (`D-`, `T-`, or custom). Store on `ts:order:{order_id}` and mirror in edge DB.

### 2.5.2 Takeaway customer queue

**Key:** `ts:takeaway:{location_id}:queue` (sorted set)  
**Score:** `queued_at` unix ms  
**Member:** `order_id`

**Status HASH:** `ts:takeaway:{location_id}:order:{order_id}`

| Field | Notes |
|---|---|
| `token_number` | shown on customer display |
| `fulfillment_status` | `IN_QUEUE` \| `IN_KITCHEN` \| `BEING_PREPARED` \| `PACKED` \| `AT_COUNTER` |
| `queue_position` | derived rank in sorted set |
| `updated_at` | ISO8601 |

### 2.6 Redis Streams event envelope

All domain mutations emit a canonical envelope on `ts:stream:events`:

```json
{
  "event_id": "uuid-v7",
  "event_type": "table.status_changed | order.submitted | kds.item_queued | payment.completed | ...",
  "location_id": "loc_...",
  "aggregate_type": "table | order | payment",
  "aggregate_id": "...",
  "version": 42,
  "occurred_at": "2026-07-02T12:00:00.000Z",
  "actor_id": "staff_...",
  "payload": { }
}
```

**Consumer groups:**

| Group | Responsibility |
|---|---|
| `persist` | Write to local DB + outbox |
| `kds-*` | Station-specific fan-out |
| `ui-kitchen` | Kitchen web view WebSocket bridge |
| `ui-waiter` | Waiter tablet WebSocket bridge |
| `ui-counter` | Counter web view WebSocket bridge |
| `ui-customer` | Takeaway customer display WebSocket bridge |

### 2.7 Open decisions (Redis)

- [ ] Redis Cluster vs single instance per location gateway
- [ ] Stream trimming policy (`MAXLEN ~`) vs archival to local DB only
- [ ] Keyspace notifications vs dedicated lease-sweeper cron for TTL rollback
- [ ] Cold-start rebuild: full scan vs snapshot + incremental replay

---

## 3. Module 2 — Schema Definitions

Three schema families: **operational (hub)**, **invoices (hub-local)**, **cloud control plane (org profile + subscription)**, and **optional data sync**.

### 3.1 Design principles

| Layer | Mutability | Source of truth | ID strategy |
|---|---|---|---|
| Hub operational DB | Mutable rows with versioning | Location hub during service | UUID v7; `org_id` + `location_id` on all rows |
| **Hub invoices (local-only)** | Append-only; void/credit-note for corrections | Location hub permanently | `invoice_id` + `invoice_number` per location sequence |
| **Cloud org profile** | Admin-managed in cloud console | Cloud DB | `org_id` |
| **Cloud subscription** | Billing system updates | Cloud DB | `subscription_id` per `org_id` |
| Cloud data sync (optional) | Append-only events | Kafka → cloud DB | `event_id`; `org_id` partition |

**Identity hierarchy:**

```
org_id          → organization (brand / chain) — cloud-managed profile + subscription
  └── location_id   → single restaurant site — one hub per location
        └── hub_id      → physical hub instance (entitlement checked against org subscription)
```

**Rules:**

- **Invoice rows and PDFs stay on the hub** — never uploaded to cloud data plane.
- **Business details** (legal name, GST number, address, phone, logo) live in **cloud** — hub caches for offline invoice printing.
- **Subscription status** lives in **cloud** — hub checks on startup + periodic heartbeat; disables service if unpaid.
- When `cloud_sync_enabled` is off, operational data stays local; control plane checks still run when internet is available.

### 3.2 Hub operational schema (local SQLite / PostgreSQL)

#### `organizations`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `org_id` — stable identifier across all locations |
| `name` | TEXT | brand / chain name |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `locations`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `location_id` |
| `org_id` | TEXT FK | parent organization |
| `name` | TEXT | site name, e.g. "Downtown Branch" |
| `timezone` | TEXT | |
| `hub_id` | TEXT | current hub instance id — changes on hub replacement |
| `cloud_sync_enabled` | BOOL | **master switch** — `false` = local-only forever; `true` = sync aggregates when online |
| `config_json` | JSON | floor plan, hub LAN settings, device defaults |
| `sync_cursor` | TEXT nullable | last successfully upstreamed incremental event |
| `sync_state` | TEXT | `LOCAL_ONLY` \| `BACKFILL_RUNNING` \| `SYNCING` \| `BACKFILL_FAILED` |
| `backfill_cursor` | TEXT nullable | table/row checkpoint during historical backfill |
| `backfill_started_at` | TIMESTAMPTZ nullable | |
| `backfill_completed_at` | TIMESTAMPTZ nullable | |
| `hub_status` | TEXT | `ACTIVE` \| `SUSPENDED` — set by license checker |
| `license_last_checked_at` | TIMESTAMPTZ nullable | |
| `suspended_at` | TIMESTAMPTZ nullable | when subscription lapsed |
| `updated_at` | TIMESTAMPTZ | |

#### `hub_business_profile_cache` (fetched from cloud — for invoice print header)

Local cache of cloud-managed business details. Refreshed on hub startup, periodic heartbeat, and before invoice print if stale.

| Column | Type | Notes |
|---|---|---|
| `org_id` | TEXT PK | |
| `legal_name` | TEXT | |
| `trade_name` | TEXT nullable | display name if different from legal |
| `gst_number` | TEXT | GST / tax registration number |
| `address_lines_json` | JSON | street, city, state, postal code |
| `phone` | TEXT | |
| `email` | TEXT nullable | |
| `logo_path` | TEXT nullable | cached logo file on hub filesystem |
| `fetched_at` | TIMESTAMPTZ | last successful cloud fetch |
| `expires_at` | TIMESTAMPTZ | cache TTL — re-fetch after |

> Source of truth is **cloud** (`org_business_profiles` — §3.6). Hub cache is used while `ACTIVE` for LAN-speed invoice printing.

#### `devices` (LAN clients paired to hub)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `device_type` | TEXT | `WAITER` \| `KITCHEN` \| `COUNTER` \| `CUSTOMER` |
| `name` | TEXT | e.g. "Waiter iPad 2", "Grill KDS" |
| `device_token_hash` | TEXT | issued after pairing — authenticates LAN requests |
| `assigned_zone_ids` | JSON nullable | waiter devices — zone filter override |
| `assigned_station_ids` | JSON nullable | kitchen devices — station filter |
| `is_active` | BOOL | revoke to block device |
| `last_seen_at` | TIMESTAMPTZ nullable | heartbeat |
| `paired_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Pairing flow:** admin generates short-lived pairing code on hub → device enters code → hub issues `device_token` → device stores token and connects to hub base URL over LAN.

#### `staff` (users — local PIN auth)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `name` | TEXT | display name |
| `role` | TEXT | `ADMIN` \| `COUNTER` \| `WAITER` |
| `pin_hash` | TEXT | bcrypt/argon2 — never store plaintext PIN |
| `permissions_json` | JSON | overrides; see §5.12 |
| `assigned_zone_ids` | JSON | waiter zone filter — array of `zone_id` |
| `is_active` | BOOL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Auth model:** Staff PIN login via hub API on LAN only. Device token + staff session required for writes. Hub is not exposed to the public internet for device traffic.

#### `location_billing_config` (admin setup — tax defaults, service charge, tips)

| Column | Type | Notes |
|---|---|---|
| `location_id` | TEXT PK | |
| `tax_rules_json` | JSON | **default** rates + components — used when a zone has no override; see §5.14 |
| `price_tax_mode` | TEXT | `INCLUSIVE` \| `EXCLUSIVE` — how menu prices are entered in setup (location-wide) |
| `service_charge_rules_json` | JSON | e.g. `{ "enabled": true, "percent": 10, "label": "Service charge" }` |
| `tip_quick_actions_json` | JSON | two presets: `[{ "type": "percent", "value": 10 }, { "type": "fixed_cents", "value": 500 }]` |
| `updated_at` | TIMESTAMPTZ | |

#### `zones` (setup — customizable names + tax)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `name` | TEXT | operator-defined, e.g. "Terrace", "VIP", "Bar", "Takeaway" |
| `sort_order` | INT | display order in setup and waiter filter |
| `tax_rules_json` | JSON | per-zone rates — same shape as location `tax_rules_json` (e.g. `{ "cgst": 2.5, "sgst": 2.5 }` or `{ "gst": 18 }`). Empty `{}` → inherit location defaults. Operators may copy the same rates to every zone or set different ones. |
| `is_active` | BOOL | soft-disable without deleting price rows |
| `updated_at` | TIMESTAMPTZ | |

#### `tables`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `zone_id` | TEXT FK | drives **menu pricing** and **tax rates** for dine-in orders at this table |
| `label` | TEXT | e.g. "T12" |
| `capacity` | INT | |
| `pos_x` | INT nullable | floor-plan coordinates for waiter/counter views |
| `pos_y` | INT nullable | |
| `status` | TEXT | mirrors Redis enum |
| `version` | INT | optimistic concurrency |
| `updated_at` | TIMESTAMPTZ | |

#### `menu_items`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `category_id` | TEXT FK | → `menu_categories` |
| `name` | TEXT | |
| `base_price_cents` | INT | entered per `price_tax_mode` — see §5.14 |
| `kds_station_id` | TEXT | routing |
| `is_active` | BOOL | |
| `updated_at` | TIMESTAMPTZ | |

See **menu catalog** tables (`menu_categories`, `menu_tags`, `modifier_groups`, `modifier_options`) in the same section for tags and customization.

#### `menu_item_zone_prices` (setup — per-zone menu pricing)

| Column | Type | Notes |
|---|---|---|
| `menu_item_id` | TEXT FK | |
| `zone_id` | TEXT FK | |
| `price_cents` | INT | overrides `base_price_cents` for this zone |
| `updated_at` | TIMESTAMPTZ | |

**PK:** `(menu_item_id, zone_id)`

**Pricing rule:** at order time, resolve entered price from `menu_item_zone_prices` or `base_price_cents`, then derive pre-tax, tax, and line total per `price_tax_mode` (§5.14) using the order zone’s tax rules (see zone tax below). Snapshot all three onto `order_lines` — **never recalculate retroactively** when catalog prices change later.

#### `menu_categories`

Admin-defined groupings (e.g. Pizza, Burgers, Beverages). Items belong to exactly one category.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `name` | TEXT | display name — admin editable |
| `sort_order` | INT | POS menu ordering |
| `is_active` | BOOL | hidden when false |
| `updated_at` | TIMESTAMPTZ | |

**Category modifiers:** customization groups with `scope = CATEGORY` attach here (see `modifier_groups`). Example: all Pizzas offer *Thin crust*, *Cheese burst*, *Vegan base*.

#### `menu_tags`

Location-wide tag library — **not a fixed enum**. Admin creates/edits freely.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `code` | TEXT | stable slug, e.g. `vegan`, `very_spicy` |
| `label` | TEXT | display, e.g. "Very spicy" |
| `sort_order` | INT | |
| `is_active` | BOOL | |

**Examples (illustrative only):** vegan, fish, chicken, eggs, spicy, very_spicy, gluten_free, nuts.

**Unique:** `(location_id, code)`

#### `menu_item_tags`

Many-to-many: which tags apply to which menu item.

| Column | Type | Notes |
|---|---|---|
| `menu_item_id` | TEXT FK | |
| `tag_id` | TEXT FK | |

**PK:** `(menu_item_id, tag_id)`

Tags are informational (filtering, KDS badges, allergen hints) — they do **not** change price unless modeled as a priced modifier option.

#### `modifier_groups`

Configurable customization sets at **category** or **item** scope. Managed in admin console; synced to floor devices with the menu catalog.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `scope` | TEXT | `CATEGORY` \| `ITEM` |
| `category_id` | TEXT FK nullable | required when `scope = CATEGORY` |
| `menu_item_id` | TEXT FK nullable | required when `scope = ITEM` |
| `name` | TEXT | e.g. "Crust", "Extra toppings" |
| `min_select` | INT | minimum options guest must pick |
| `max_select` | INT nullable | null = unlimited |
| `is_required` | BOOL | |
| `sort_order` | INT | |
| `is_active` | BOOL | |

**Examples:**
- Category *Pizza* → group "Crust" with options *Thin*, *Cheese burst* (may be $0 or priced)
- Item *Margherita* → group "Extra toppings" with *Jalapeño*, *Chilli*, *Potato* each with `price_cents`

At order time the waiter UI merges **category groups** + **item groups** for the selected menu item.

#### `modifier_options`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `group_id` | TEXT FK | |
| `code` | TEXT | stable slug |
| `label` | TEXT | |
| `price_cents` | INT | additive cost; 0 = free option |
| `is_default` | BOOL | pre-selected in UI when applicable |
| `sort_order` | INT | |
| `is_active` | BOOL | |

**Unique:** `(group_id, code)`

#### Catalog → order snapshot rules (immutable pricing)

When a line is added to an order, the hub **copies** catalog state onto `order_lines`. Later admin edits to menu prices, modifier option prices, tags, or labels affect **only future lines**.

| Snapshotted field | Source at line-add time |
|---|---|
| `name` | `menu_items.name` |
| `unit_price_cents` | zone price matrix or `base_price_cents` |
| `tax_cents`, `line_total_cents` | computed once from billing config + modifiers |
| `modifiers_json` | array of `OrderLineModifierSnapshot` — each selected option's `group_id`, `option_id`, `label`, **`price_cents`** |
| `tags_json` | array of `{ tag_id, code, label }` from item tags at that moment |

```json
{
  "modifiers_json": [
    {
      "kind": "category_option",
      "group_id": "grp_crust",
      "group_name": "Crust",
      "option_id": "opt_thin",
      "code": "thin_crust",
      "label": "Thin crust",
      "price_cents": 0
    },
    {
      "kind": "item_option",
      "group_id": "grp_extras",
      "group_name": "Extra toppings",
      "option_id": "opt_jalapeno",
      "code": "jalapeno",
      "label": "Jalapeño",
      "price_cents": 150
    }
  ],
  "tags_json": [
    { "tag_id": "tag_vegan", "code": "vegan", "label": "Vegan" }
  ]
}
```

**Hard rules:**
1. Never recompute `order_lines` or `invoices` when catalog rows change — only new orders pick up new prices.
2. Reprints and cloud sync events use the **stored snapshot**, not live catalog lookups.
3. Void/recall flows create new lines; they do not mutate historical snapshots.

**Sync:** catalog tables (`menu_*`, `modifier_*`) publish to floor clients via hub API / optional cloud sync (`catalog.updated` event). Order lines carry their own snapshots upstream.

#### `orders`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `order_type` | TEXT | `DINE_IN` \| `TAKEAWAY` |
| `table_id` | TEXT FK nullable | required for dine-in |
| `zone_id` | TEXT FK | from table (dine-in) or counter selection (takeaway) |
| `token_number` | TEXT | separate sequences — e.g. `D-042` vs `T-018` |
| `customer_name` | TEXT nullable | required for takeaway |
| `customer_contact` | TEXT nullable | phone/email — local only |
| `status` | TEXT | lifecycle enum |
| `fulfillment_status` | TEXT nullable | takeaway customer pipeline — see §5.4 |
| `server_id` | TEXT nullable | assigned waiter — reassignable (§5.13) |
| `discount_type` | TEXT nullable | `PERCENT` \| `FIXED` — set before bill |
| `discount_value` | INT nullable | percent (e.g. 15) or cents (e.g. 500) |
| `discount_cents` | INT | computed snapshot at bill time |
| `service_charge_cents` | INT | from admin rules at bill time |
| `tip_cents` | INT | entered/edited before bill generation |
| `version` | INT | |
| `opened_at` | TIMESTAMPTZ | |
| `closed_at` | TIMESTAMPTZ nullable | |
| `subtotal_cents` | INT | |
| `tax_cents` | INT | |
| `total_cents` | INT | |

#### `order_lines`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `order_id` | TEXT FK | |
| `menu_item_id` | TEXT | |
| `name` | TEXT | snapshot at order time |
| `quantity` | INT | |
| `unit_price_cents` | INT | pre-tax unit price snapshot |
| `tax_cents` | INT | tax per line (or per unit × qty) |
| `line_total_cents` | INT | unit pre-tax + tax × qty (incl. modifier prices) |
| `modifiers_json` | JSON | `[OrderLineModifierSnapshot]` — see catalog snapshot rules above |
| `tags_json` | JSON | `[{ tag_id, code, label }]` — item tags at line-add time |
| `special_instructions` | TEXT | |
| `kds_station_id` | TEXT | routing |
| `status` | TEXT | `DRAFT` \| `QUEUED` \| `IN_PROGRESS` \| `PREPARED` \| `SERVED` \| `VOID` \| `RECALLED` |
| `is_submitted` | BOOL | `false` until waiter submits batch — kitchen never receives draft lines |
| `submitted_at` | TIMESTAMPTZ nullable | |
| `submit_batch` | INT | increments per submit action — supports add-on rounds on same `order_id` |
| `kds_visible` | BOOL | `false` when unstaged or after `PREPARED` — controls KDS display |
| `version` | INT | |

#### `payments` (edge — intent + outcome)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `order_id` | TEXT FK | |
| `status` | TEXT | `PENDING` \| `AUTHORIZED` \| `CAPTURED` \| `FAILED` \| `REFUNDED` |
| `amount_cents` | INT | |
| `tender_type` | TEXT | MVP: `CASH` \| `CARD` \| `OTHER` — manually assigned at counter |
| `provider` | TEXT nullable | post-MVP: stripe, square, etc. |
| `provider_ref` | TEXT nullable | post-MVP |
| `version` | INT | |
| `created_at` | TIMESTAMPTZ | |

#### `invoices` (edge — **local-only, never synced**)

Immutable billing record created when a check is finalized/paid. One order may reference one primary invoice; voids issue a separate credit-note row.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `invoice_id` |
| `location_id` | TEXT FK | |
| `order_id` | TEXT FK | |
| `payment_id` | TEXT FK nullable | |
| `invoice_number` | TEXT | human-readable; unique per `location_id` |
| `status` | TEXT | `ISSUED` \| `VOIDED` |
| `issued_at` | TIMESTAMPTZ | |
| `voided_at` | TIMESTAMPTZ nullable | |
| `void_reason` | TEXT nullable | |
| `replaces_invoice_id` | TEXT FK nullable | credit-note points to original |
| `subtotal_cents` | INT | snapshot at issue time |
| `tax_cents` | INT | |
| `discount_cents` | INT | |
| `tip_cents` | INT | |
| `total_cents` | INT | |
| `tender_summary_json` | JSON | `{ "card": 4850 }` — no raw card numbers |
| `line_items_json` | JSON | full item/modifier snapshot for reprint |
| `cashier_id` | TEXT FK nullable | staff who issued bill |
| `cashier_name` | TEXT | snapshot of `staff.name` at issue time |
| `token_number` | TEXT | daily-reset order token at issue time |
| `business_snapshot_json` | JSON | copy of `hub_business_profile_cache` at issue — GST, address, phone |
| `tax_breakdown_json` | JSON | per-component tax lines at issue time |
| `metadata_json` | JSON | table label, order type, location name, customer name |
| `document_path` | TEXT nullable | local PDF path |
| `content_hash` | TEXT | SHA-256 of canonical invoice JSON |

**Storage layout (local filesystem):**

```
{hub_data_dir}/invoices/{location_id}/{YYYY}/{MM}/{invoice_id}.pdf
```

**Hard boundary:** `invoices` rows and `document_path` blobs are **excluded** from `sync_outbox`, Kafka, and all cloud ingest paths. Backup/export is an on-prem operator action only.

#### `location_print_config` (admin setup — print stages only)

Business header fields are **not** edited here — they come from cloud (`hub_business_profile_cache`). This table controls print stage toggles and routing only.

| Column | Type | Notes |
|---|---|---|
| `location_id` | TEXT PK | |
| `print_stages_json` | JSON | per-stage enable + routing — see §5.15 |
| `updated_at` | TIMESTAMPTZ | |

**Example `print_stages_json`:**

```json
{
  "ordering": { "enabled": true, "auto_on_bill": true },
  "kitchen": { "enabled": true, "auto_on_submit": true, "split_by_station": true, "split_by_token": true },
  "collection": {
    "enabled": true,
    "auto_print_dine_in": false,
    "auto_print_takeaway": true,
    "trigger": "at_counter"
  }
}
```

#### `printers` (admin setup)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `name` | TEXT | e.g. "Kitchen grill", "Counter receipt" |
| `role` | TEXT | `ORDERING` \| `KITCHEN` \| `COLLECTION` |
| `connection_json` | JSON | IP/port, driver type — local network only |
| `kds_station_ids` | JSON nullable | kitchen printer → route by station when `split_by_station` |
| `is_active` | BOOL | |
| `updated_at` | TIMESTAMPTZ | |

#### `print_jobs` (hub print queue — local only)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `location_id` | TEXT FK | |
| `order_id` | TEXT FK | |
| `stage` | TEXT | `ORDERING` \| `KITCHEN` \| `COLLECTION` |
| `printer_id` | TEXT FK nullable | target printer; null = default for role |
| `submit_batch` | INT nullable | kitchen split — which batch/token slice |
| `payload_json` | JSON | rendered snapshot for reprint |
| `status` | TEXT | `PENDING` \| `PRINTING` \| `DONE` \| `FAILED` |
| `attempt_count` | INT | |
| `created_at` | TIMESTAMPTZ | |

#### `sync_outbox` (critical for local-first)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | equals `event_id` |
| `event_type` | TEXT | |
| `aggregate_type` | TEXT | |
| `aggregate_id` | TEXT | |
| `payload_json` | JSON | sync-bound payload — **must not contain invoice data** |
| `status` | TEXT | `PENDING` \| `IN_FLIGHT` \| `ACKED` \| `DEAD` |
| `attempt_count` | INT | |
| `next_attempt_at` | TIMESTAMPTZ | backoff scheduling |
| `last_error` | TEXT nullable | |
| `created_at` | TIMESTAMPTZ | |

#### `applied_events` (idempotency on edge replay)

| Column | Type | Notes |
|---|---|---|
| `event_id` | TEXT PK | |
| `applied_at` | TIMESTAMPTZ | |

### 3.3 Upstream sync (Kafka / cloud — **only when `cloud_sync_enabled`**)

When `cloud_sync_enabled = false`: no outbox rows, no sync-agent, no backfill — all data stays on the hub indefinitely.

When enabled, the hub syncs **operational text records** as JSON events. Text volume is small enough that a **full historical backfill from genesis** is the default when cloud is first turned on (or re-enabled after a gap).

#### Sync scope

| Syncs to cloud (text JSON) | Cloud control plane (always) | Never syncs (stays on hub) |
|---|---|---|
| `orders`, `order_lines`, `payments`, catalog | `org_business_profiles` (GST, address, phone) | `invoices` rows + PDF files |
| Shifts, void/discount events | `subscriptions`, `hub_entitlements` | `customer_contact` (PII) |
| | Subscription billing status | `staff.pin_hash`, device tokens, card tokens |

> **Invoice policy:** invoice bodies stay on hub. Business header on the printed invoice is fetched from cloud and snapshotted onto the invoice row at issue time (`business_snapshot_json`).

#### Topic map

| Topic | Content |
|---|---|
| `sync.backfill` | Historical row snapshots during initial / gap backfill |
| `order.placed` | Order + line items (text) on submit |
| `order.updated` | Line changes, voids, status transitions |
| `payment.completed` | Payment row (text) |
| `payment.refunded` | Refund row |
| `catalog.updated` | Menu, zones, prices |
| `shift.closed` | Shift totals |

#### Canonical envelope

```json
{
  "schema_version": 1,
  "event_id": "01J...",
  "event_type": "payment.completed",
  "occurred_at": "2026-07-02T12:00:00.000Z",
  "recorded_at": "2026-07-02T12:00:01.000Z",
  "location_id": "loc_abc",
  "org_id": "org_xyz",
  "hub_id": "hub_001",
  "correlation_id": "order_xyz",
  "idempotency_key": "payment.completed:pay_123",
  "actor": { "type": "staff", "id": "staff_42" },
  "payload": { }
}
```

#### Example: `payment.completed` payload (cloud-safe — no invoice body)

```json
{
  "payment_id": "pay_123",
  "order_id": "ord_456",
  "location_id": "loc_abc",
  "org_id": "org_xyz",
  "amount_cents": 4850,
  "tender_type": "card",
  "provider": "stripe",
  "occurred_at": "2026-07-02T12:00:00.000Z"
}
```

> `invoice_id`, line items, tax breakdown, and table/customer identifiers are written to the local `invoices` row only and are intentionally absent here.

#### Example: `order.placed` payload (full text)

```json
{
  "order_id": "ord_456",
  "location_id": "loc_abc",
  "org_id": "org_xyz",
  "order_type": "DINE_IN",
  "token_number": "D-042",
  "subtotal_cents": 3200,
  "line_items": [
    {
      "order_line_id": "ol_1",
      "name": "Pad Thai",
      "quantity": 1,
      "unit_price_cents": 1600,
      "modifiers": [{ "type": "add", "code": "extra_spicy", "label": "Extra spicy" }],
      "special_instructions": "No peanuts"
    }
  ],
  "occurred_at": "2026-07-02T11:45:00.000Z"
}
```

> No `customer_contact`, `invoice_id`, or `invoice_number` in any cloud payload.

### 3.4 Edge ↔ event mapping

| Edge mutation | Local persistence | Outbox / cloud sync (if `cloud_sync_enabled`) |
|---|---|---|
| Order submit | `orders`, `order_lines` | `order.placed` (full text) |
| Line edit / void | `order_lines` | `order.updated` |
| Payment capture | `payments` + **`invoices` (hub-local)** | `payment.completed` (payment text only) |
| Invoice void / credit note | `invoices` (hub-local) | `order.updated` signal — no invoice body |
| Order void | `orders`, `invoices` (hub-local) | `order.updated` |

**Skipped entirely when `cloud_sync_enabled = false`.**  
**Never synced (even when cloud enabled):** invoice rows/PDFs, `customer_contact`, PIN hashes, device tokens, card tokens.

**Never synced to cloud data plane (even when enabled):** invoice rows/PDFs, `customer_contact`, PIN hashes, device tokens, card tokens.

### 3.6 Cloud control plane schema (subscription & business profile)

Managed by the **service operator** (SaaS console / billing integration). Hubs pull from here — not pushed from restaurant staff.

#### `org_business_profiles` (cloud — source of truth for invoice header)

| Column | Type | Notes |
|---|---|---|
| `org_id` | TEXT PK | |
| `legal_name` | TEXT | |
| `trade_name` | TEXT nullable | |
| `gst_number` | TEXT | GST / tax registration — printed on every invoice |
| `address_lines_json` | JSON | full address for invoice header |
| `phone` | TEXT | |
| `email` | TEXT nullable | |
| `logo_url` | TEXT nullable | hub downloads and caches to `logo_path` |
| `updated_at` | TIMESTAMPTZ | |

#### `subscriptions` (cloud)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `org_id` | TEXT FK | |
| `plan` | TEXT | e.g. `standard`, `multi_location` |
| `status` | TEXT | `ACTIVE` \| `PAST_DUE` \| `SUSPENDED` \| `CANCELLED` |
| `current_period_end` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `hub_entitlements` (cloud — per location hub)

| Column | Type | Notes |
|---|---|---|
| `hub_id` | TEXT PK | |
| `org_id` | TEXT FK | |
| `location_id` | TEXT FK | |
| `enabled` | BOOL | **false when subscription unpaid** — hub must suspend ops |
| `disabled_reason` | TEXT nullable | e.g. `subscription_past_due` |
| `updated_at` | TIMESTAMPTZ | |

#### Hub license checker (runs on every hub)

```
on startup + every N minutes (e.g. 15):
  GET /v1/orgs/{org_id}/entitlement?hub_id={hub_id}
  response: { enabled, subscription_status, current_period_end, business_profile }

  if enabled AND now <= current_period_end:
    hub_status = ACTIVE
    refresh hub_business_profile_cache
  else:
    hub_status = SUSPENDED
    suspended_at = now (if not already set)
    enter read-only mode (see below)
```

**No grace period.** Service ends on the **last day** of the paid subscription period (`current_period_end`). There is no offline extension — if the hub cannot reach cloud after period end, it treats the subscription as lapsed. If cloud reports `enabled = false` or past period end, suspension is immediate.

- **Re-enable**: automatic on next successful check when subscription is renewed — restores full `ACTIVE` mode
- Business profile changes in cloud propagate on next refresh while `ACTIVE`

#### Suspended hub mode (read-only — lifetime access)

When `hub_status = SUSPENDED`, the hub **blocks all write operations** but retains **permanent read access** to historical data stored locally.

| Allowed (read-only) | Blocked |
|---|---|
| Browse past invoices (list, detail, search) | New orders, edits, kitchen submit |
| Reprint past invoices | New bills, payments, voids |
| **Export all local data to Excel** (`.xlsx`) | Menu/setup changes, staff changes |
| View orders, payments, reports from local DB | Print new kitchen/collection tickets |
| Admin login on counter view (archive section) | Device pairing (optional — TBD) |

**Excel export** (`GET /v1/export/full` or counter UI action):

- Generates a multi-sheet workbook from hub local DB
- Sheets (minimum): `invoices`, `orders`, `order_lines`, `payments`, `staff` (no PIN), `menu_items`, `daily_totals` (derived)
- Includes invoice numbers, token numbers, tax breakdowns, cashier, GST snapshot from `business_snapshot_json`
- File saved to hub filesystem + streamed to admin browser on LAN
- Available for the **lifetime of the hub** — data never deleted on suspension
- Export is **local only** — not uploaded to cloud

```
ACTIVE                          SUSPENDED (subscription lapsed)
  │                                      │
  ├─ full POS ops                        ├─ read-only archive UI
  ├─ new orders / billing                ├─ invoice browse + reprint
  └─ cloud profile refresh               └─ Excel export (all data)
```

### 3.7 Open decisions (schema)

- [ ] Cloud DB retention policy per `org_id` (indefinite vs rolling window)
- [ ] Invoice numbering scheme and legal retention period (local disk policy)
- [ ] Token reset policy: per shift vs daily rollover for dine-in / takeaway counters
- [ ] Waiter zone assignment: fixed zone per device vs staff picks zone at login
- [ ] Discount above threshold requires admin PIN
- [ ] Collection template: items-only vs include prices
- [ ] DUPLICATE watermark on reprints
- [ ] Printer driver: ESC/POS vs IPP

### 3.8 Hub database — SQLite (decided)

**Decision:** hub persistence uses **SQLite** (single file on hub hardware).

| SQLite fits hub well | When PostgreSQL would be reconsidered |
|---|---|
| Single hub writer — no multi-process DB concurrency | Multiple hub processes need concurrent writers at scale |
| Zero ops — no separate DB daemon on restaurant hardware | Central DB shared across many hubs at one site (unusual) |
| Easy backup — copy one file | Very high write volume exceeds SQLite comfort (rare for POS text) |
| Matches local-first, offline-first deployment | Team standardizes on Postgres tooling for cloud **and** hub |

Redis handles hot-path concurrency; SQLite is the durability layer behind a single hub process. Revisit only if hub architecture splits into multiple writer services.

## 5. Module 4 — Web Views, Zones & Setup

Four role-specific web views are **LAN clients** that connect exclusively to the location hub. They hold no authoritative state; all reads and writes go through the hub API (REST + WebSocket). Views work when the hub is reachable on LAN, independent of hub internet connectivity.

### 5.1 View overview

| View | Primary users | Read source | Write actions |
|---|---|---|---|
| **Kitchen** | Line cooks, KDS screens | `ts:kds:*`, `ts:pub:kds` | Mark item `PREPARED`; bump `IN_PROGRESS` |
| **Customer (takeaway)** | Pickup area display | `ts:takeaway:*`, `ts:pub:customer` | None (read-only) |
| **Waiter** | Floor staff | `ts:floor:*` filtered by zone, `ts:order:*` | Seat table, add/remove items, submit to kitchen, generate bill |
| **Counter** | Host / cashier | `ts:floor:*`, all orders | Edit table layout, manage table orders, create takeaway orders, generate bill |

```
                    ┌─────────────────────┐
  Setup (zones,     │   LOCATION HUB      │
  menu, printers)   │  API · Redis · DB   │
        ──────────► │  Print · Sync*      │
                    └──────────┬──────────┘
                               │ LAN (HTTPS / WSS)
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  ┌────────────┐        ┌────────────┐        ┌────────────┐
  │  Kitchen   │        │  Waiter    │        │  Counter   │
  │  display   │        │  tablets   │        │  + setup   │
  └────────────┘        └────────────┘        └────────────┘
                               │
                        ┌──────▼──────┐
                        │  Customer   │
                        │  (takeaway) │
                        └─────────────┘

  * Sync agent runs only when cloud_sync_enabled = true
```

### 5.2 Kitchen web view

**Purpose:** show incoming tickets with everything needed to prepare the dish.

**Per ticket / line item display:**

| Field | Source |
|---|---|
| Dish name | `order_lines.name` |
| Quantity | `order_lines.quantity` |
| Add toppings | `modifiers_json` where `type = "add"` |
| Remove toppings | `modifiers_json` where `type = "remove"` |
| Special instructions | `special_instructions` |
| Service mode | `order_type` — badge: **Dine-in** or **Takeaway** |
| Token / table ref | `token_number` (takeaway) or table `label` (dine-in) |

**Actions:**

- Tap line → mark `IN_PROGRESS`
- Tap again (or dedicated button) → mark `PREPARED` → line **removed from kitchen view** (`kds_visible = false`)
- **86 / sold out** → mark line `RECALLED`; push alert to waiter tablet to cancel/remove the item (§5.13)
- All lines `PREPARED` → order `fulfillment_status` advances (takeaway pipeline, §5.4)

**Kitchen view rule:** only show lines where `kds_visible = true` and `status` ∈ `{ QUEUED, IN_PROGRESS, RECALLED }`. `PREPARED` lines are cleared automatically. Add-on rounds on the same `order_id` appear as new submitted batches while earlier `PREPARED` lines stay hidden.

**Sorting:** FIFO by default; optional priority bump (fire table) via existing KDS sorted-set score.

### 5.3 Waiter web view

**Purpose:** manage dine-in service for a configured floor zone.

**Zone filter:** waiter device receives `assigned_zone_ids` from setup (one or more zones). Table map renders only tables in those zones via `ts:floor:{location_id}:by_zone:{zone_id}`.

**Table card (selected table):**

| Field | Notes |
|---|---|
| Table label + status | `AVAILABLE` / `OCCUPIED` / `RESERVED` / `DIRTY` |
| Customer name | captured on seat or first order |
| Customer contact | phone — local only |
| Current order lines | name, qty, line `status`, running subtotal |
| Zone | zone name from setup (determines menu prices) |

**Actions:**

- Seat / release table (lease-aware)
- Add items from zone-priced menu (lines start as `DRAFT`, `is_submitted = false`)
- Remove draft lines only (not yet submitted)
- Edit/unstage queued lines — only while `status = QUEUED` (not yet `IN_PROGRESS`); unstaging sets `kds_visible = false` and removes from kitchen (§5.13)
- **Submit to kitchen** — submits only new draft lines; sets `is_submitted`, `submitted_at`, `submit_batch++`, queues on KDS, triggers **kitchen print** (§5.15)
- Transfer table / hand off to another waiter (§5.13)
- **Generate bill** — discount + tip entry first (§5.14) → local invoice → **invoice print** (§5.15) → payment

Menu prices shown and charged using the table's `zone_id` → `menu_item_zone_prices`.

### 5.4 Customer web view (takeaway)

**Purpose:** read-only display for customers waiting on takeaway orders.

**Shown per active takeaway order:**

| Field | Notes |
|---|---|
| Token number | takeaway sequence only — e.g. `T-018` |
| Queue position | rank in `ts:takeaway:{location_id}:queue` |
| Status | one of the pipeline stages below |

**Takeaway fulfillment pipeline:**

```
IN_QUEUE → IN_KITCHEN → BEING_PREPARED → PACKED → AT_COUNTER
```

| Status | Meaning | Typical trigger |
|---|---|---|
| `IN_QUEUE` | Order accepted, waiting to start | counter submits takeaway order |
| `IN_KITCHEN` | Sent to kitchen | first line hits KDS |
| `BEING_PREPARED` | At least one line `IN_PROGRESS` | kitchen starts item |
| `PACKED` | All lines `PREPARED` | kitchen marks last item prepared |
| `AT_COUNTER` | Ready for pickup | counter staff confirms; triggers **collection print** if enabled in config |

Remove from customer display after pickup acknowledged (counter action) or configurable TTL.

### 5.5 Counter web view

**Purpose:** front-of-house control — layout, takeaway intake, billing.

**Setup / layout (admin subset):**

- Create and rename **zones** (`zones.name` — fully customizable)
- Assign tables to zones; drag/set `pos_x`, `pos_y` on floor plan
- Set **menu prices per zone** via `menu_item_zone_prices` matrix (menu item × zone)
- Configure token prefixes, **daily reset time**, and collection auto-print (dine-in vs takeaway)

**Operations:**

- View and edit table layout across all zones
- Open / manage table orders (same order detail as waiter)
- **Generate takeaway orders** — capture `customer_name`, `customer_contact`, assign `zone_id` for pricing, allocate takeaway `token_number`, enqueue to `ts:takeaway:*`
- Generate bill for dine-in or takeaway (local invoice) — **blocked when `SUSPENDED`**
- **Archive mode** (when suspended): browse/reprint past invoices, export all data to Excel

### 5.6 Token numbering rules

| Order type | Counter key | Display example | Notes |
|---|---|---|---|
| `DINE_IN` | `ts:token:{location_id}:dine_in` | `D-001`, `D-002`, … | issued on submit-to-kitchen or seat — TBD in setup |
| `TAKEAWAY` | `ts:token:{location_id}:takeaway` | `T-001`, `T-002`, … | issued when counter creates takeaway order |

- Sequences are **independent** — dine-in `D-005` and takeaway `T-005` can coexist
- Prefixes and pad width configurable in location setup
- Counters reset **daily** at configurable time (e.g. 04:00) — shown on all print stages

### 5.7 Zone-wise pricing (setup)

**Configuration flow (counter setup screen):**

1. Operator defines zones with custom names (e.g. "Main Hall", "Rooftop", "Delivery Counter")
2. Operator opens menu pricing grid: rows = menu items, columns = zones
3. Each cell sets `menu_item_zone_prices.price_cents`; empty cell falls back to `menu_items.base_price_cents`

**Runtime resolution:**

```
order.zone_id ← table.zone_id (dine-in) OR counter-selected zone (takeaway)
line.unit_price_cents ← menu_item_zone_prices[menu_item_id, zone_id] ?? base_price_cents
```

Prices are snapshotted onto `order_lines` at add-to-order time.

### 5.8 Real-time update contract

Devices subscribe to hub pub/sub channels via **WSS** (TLS on LAN):

| Channel | Subscribers | Events |
|---|---|---|
| `ts:pub:kds` | Kitchen devices | item queued, status → `IN_PROGRESS` / `PREPARED` |
| `ts:pub:floor` | Waiter, Counter devices | table status, new lines, 86 alerts, bill generated |
| `ts:pub:customer` | Customer display | `fulfillment_status` changes, queue position |
| `ts:stream:events` | hub persist worker | durable write-behind |

### 5.9 LAN security, hub discovery & device connectivity

**Hub discovery — recommended: mDNS primary, fixed IP fallback**

| Method | Role | Notes |
|---|---|---|
| **mDNS** (primary) | Auto-discovery at pairing | Hub advertises `_tablestream._tcp` as e.g. `tablestream-hub.local` — best UX, no IP hunting |
| **Fixed IP / hostname** (fallback) | Manual entry at pairing | Admin types `https://192.168.1.50:8443` when mDNS blocked (some routers/VLANs block multicast) |
| **Stored URL** (steady state) | After first successful pair | Device saves resolved hub URL; no rediscovery unless connection fails |

**Why not fixed IP alone?** DHCP can reassign the hub address unless IT reserves it — every IP change breaks all devices.

**Why not mDNS alone?** A minority of restaurant networks block multicast; manual fallback must exist.

**Ops best practice:** reserve hub MAC in router DHCP + use mDNS for day-to-day pairing.

| Concern | Approach |
|---|---|
| Transport | HTTPS + WSS on hub LAN interface — TLS cert (hub-generated or org CA) |
| Discovery | mDNS + manual fallback — see above |
| Device auth | Pairing code → `device_token` stored on device; sent on every request |
| Staff auth | PIN → hub-issued session token; scoped to staff permissions |
| Network boundary | Hub device API listens on LAN only; cloud ingest is a separate outbound path from hub |
| Revocation | Admin deactivates `devices.is_active` or rotates device token |

**Device → hub contract:**

- `GET /v1/...` — reads (menu, tables, orders, config)
- `POST /v1/...` — writes (submit order, mark prepared, bill, etc.)
- `WSS /v1/stream` — real-time events filtered by device type and assignment

### 5.10 Frontend — single web app (decided)

**Decision:** one **single web app** served by the hub, with **role-based routes** per device type.

| Route prefix | Device role | Example |
|---|---|---|
| `/kitchen` | `KITCHEN` | KDS screen |
| `/waiter` | `WAITER` | floor tablet |
| `/counter` | `COUNTER` | cashier + setup |
| `/customer` | `CUSTOMER` | takeaway display |

Device pairing stores `device_type` → browser opens the matching route. One build, one deploy artifact on the hub. Split into separate bundles post-MVP only if bundle size or release cadence demands it.

### 5.11 Open decisions (views & setup)

- [ ] Kitchen: per-station view vs unified expediter screen
- [ ] Customer display: show only `AT_COUNTER` + `PACKED` or full pipeline
- [ ] Dine-in token display — show on table ticket or internal only

### 5.12 Staff, auth & permissions

**Roles (default permission sets):**

| Role | Typical access |
|---|---|
| `ADMIN` | Full setup (zones, menu, prices, tax, staff users, printers), all order operations |
| `COUNTER` | Takeaway orders, billing, payments, table layout view, generate bills |
| `WAITER` | Zone-filtered tables, create/edit/delete **draft** lines, submit to kitchen, generate bill (if permitted) |

**Granular permissions** (`permissions_json` overrides role defaults):

| Permission | Description |
|---|---|
| `orders.create` | Add items / open orders |
| `orders.edit` | Modify draft or queued (pre-`IN_PROGRESS`) lines |
| `orders.delete` | Remove draft lines; void with policy |
| `orders.submit` | Send batch to kitchen |
| `orders.bill` | Generate bill / invoice |
| `orders.void` | Void closed or in-flight orders (admin/manager) |
| `setup.manage` | Zones, menu, pricing, tax, printers, staff — admin only |

**Authentication:**

- Staff added by admin with name, role, optional permission overrides, PIN (4–6 digits)
- PIN verified server-side on hub against `pin_hash`
- Hub reachable on restaurant LAN only for device traffic
- Device session: waiter tablet stays logged in per shift; re-PIN for sensitive actions (void, discount) — TBD

### 5.13 Order lifecycle & table operations

**Single growing order per table/session:** dine-in uses one `order_id` per seated table. Add-on rounds append new `order_lines`; each **submit** action sends only unsubmitted draft lines to the kitchen.

```
DRAFT ──submit──► QUEUED ──kitchen start──► IN_PROGRESS ──prepared──► PREPARED (cleared from KDS)
                     │                              │
                     │ edit/unstage (allowed)       │ modify blocked
                     ▼                              ▼
                  removed from KDS              recall / 86 flow
```

| Scenario | Rule |
|---|---|
| **Draft lines** | `is_submitted = false`, `status = DRAFT` — waiter/counter only; removable freely |
| **Submit to kitchen** | Flip draft → `QUEUED`, set `submitted_at`, `kds_visible = true`, increment `submit_batch`, trigger **kitchen print(s)** |
| **Add-on order** | New items as `DRAFT` on same `order_id`; next submit sends only the new batch; prior `PREPARED` lines stay off KDS |
| **Edit after queued** | Allowed only while `status = QUEUED` (not `IN_PROGRESS`). **Unstage** → `kds_visible = false`, remove from KDS; line returns to editable draft or re-queues on resubmit |
| **Edit after in progress** | Not allowed inline — use **recall** (kitchen marks issue) or **re-fire** (new line item copy) |
| **86 / sold out** | Kitchen taps 86 → line `RECALLED` + alert to assigned waiter's device → waiter must cancel/remove line and notify customer |
| **Prepared** | Kitchen marks `PREPARED` → auto-clear from kitchen view; waiter view still shows item status |

**Table operations:**

| Operation | Behavior |
|---|---|
| **Transfer table** | Move `order_id` + `current_order_id` from table A → B; update Redis floor state; KDS tickets show new table label |
| **Merge tables** | Combine active orders onto primary table (lines merged under survivor `order_id`); secondary table → `AVAILABLE` |
| **Split table** | Partial line move to new table's order (same party, two checks) — requires both tables `OCCUPIED` |
| **Hand off waiter** | Update `orders.server_id` + `tables.assigned_server_id`; pending alerts follow new waiter |

### 5.14 Billing, discounts, tax, tips & payment (MVP)

**Flow before generate bill:**

1. Review line items (all rounds, zone-priced snapshot)
2. Apply **discount** (optional) — `PERCENT` (e.g. 15%) or `FIXED` (e.g. ₹50 / 500 cents)
3. Apply **tax** from the order’s **zone** tax rules (fallback: location defaults) + **service charge** from `location_billing_config`
4. Enter **tip** — custom amount **or** two quick-action buttons (admin-configured: % or fixed value each)
5. **Generate bill** → snapshot totals onto order + create local `invoices` row
6. Record **payment** — manually select tender: `CASH` \| `CARD` \| `OTHER`

**Tax display & menu price mode (`price_tax_mode`):**

Admin chooses once per location in billing setup:

| Mode | Menu entry | Stored on line | Invoice columns per item |
|---|---|---|---|
| `EXCLUSIVE` | pre-tax price | `unit_price_cents` = pre-tax | **Price** (pre-tax), **Tax**, **Amount** (price + tax) × qty |
| `INCLUSIVE` | tax-included price | back-calculate pre-tax from tax % | same three columns |

**Inclusive back-calculation:**

```
entered_price = tax-included amount (from menu / zone price)
pre_tax       = entered_price / (1 + combined_tax_rate)
tax           = entered_price - pre_tax
amount        = entered_price   (= pre_tax + tax)
```

**Invoice and UI always show all three** — price (pre-tax), tax, amount (price + tax) — regardless of entry mode. Waiter menu may show entered price; bill/invoice shows the breakdown.

**Zone-based tax rates:**

- Each zone has `tax_rules_json` with the same shape as location defaults (e.g. `{ "cgst": 2.5, "sgst": 2.5 }` → 5% combined, or `{ "gst": 18 }` → 18%).
- Resolution: `orders.zone_id` → `zones.tax_rules_json` if non-empty → else `location_billing_config.tax_rules_json`.
- Operators may set the **same** rates on every zone (no practical difference from location-only tax) or **different** rates per seating area / takeaway counter.
- A single order uses **one** zone, so one rate set applies to that check. Per-item tax classes (e.g. alcohol 18% + food 5% on the same bill) are **post-MVP**.

**Invoice tax totals:**

- `tax_breakdown_json` stores component amounts for the applied zone rules (e.g. `{ "cgst": …, "sgst": … }` or `{ "gst": … }`).
- Reporting / export should be able to group collected tax by **combined rate** (e.g. total at 5%, total at 18%) across invoices when zones differ.

**Admin-customizable billing setup:**

| Setting | Example |
|---|---|
| `price_tax_mode` | `INCLUSIVE` or `EXCLUSIVE` (location-wide) |
| Location tax rules | Default `{ "cgst": 2.5, "sgst": 2.5 }` — fallback when zone rules empty |
| Zone tax rules | Per zone; copy defaults or override (outdoor / AC / bar / takeaway) |
| Service charge | percent + label; on/off per location |
| Tip quick actions | two presets: e.g. 10% and ₹100 fixed |
| Discount caps | max percent requiring admin PIN — TBD |

**Computation order:**

```
subtotal (sum of line snapshots)
→ apply discount → discounted subtotal
→ apply tax on discounted subtotal (zone rates)
→ add service charge
→ add tip
→ total
```

**Post-MVP (out of initial scope):**

- Split bill across diners
- Partial payments / split tender
- Integrated card terminal / payment webhooks (Stripe, Square)
- Auto card capture when online
- Per-item / category tax classes (alcohol vs food on one check)
### 5.15 Printing (ordering · kitchen · collection)

Printing is available at **every service stage**. Each stage has its own template, printer role, and on/off toggle in `location_print_config`. All prints are hub-local only.

#### Print stages overview

| Stage | When triggered | Printer role | Auto-print default |
|---|---|---|---|
| **Ordering (invoice)** | Generate bill; reprint anytime | `ORDERING` | On first bill; unlimited reprints |
| **Kitchen** | Submit batch to kitchen | `KITCHEN` | On — ticket(s) to line |
| **Collection** | Pickup ready (`AT_COUNTER`) or manual | `COLLECTION` | **Configurable** per restaurant |

Manual **reprint** available at any stage from order/invoice history (counter/admin).

```
  Order placed ──submit──► KITCHEN print(s)
       │
  Generate bill ─────────► INVOICE print (GST, tax, invoice #, token, cashier)
       │
  Ready at counter ──────► COLLECTION print (if enabled)
```

#### 5.15.1 Invoice print (ordering stage)

May be printed **any number of times**, **before or after payment**. Direct POS/card-terminal integration is post-MVP — tender is manually recorded on the hub.

| Print state | Payment section on invoice |
|---|---|
| **Before payment** | Omitted — no tender type or amount paid |
| **After payment** | Shows tender type (`CASH` / `CARD` / `OTHER`) and amount paid |

Each print uses the current payment state. Reprints after payment include the payment block; reprints before payment do not. All prints snapshot header + lines from `invoices` row (or draft bill before invoice is finalized).

**Required fields (complete checklist):**

| Section | Fields |
|---|---|
| **Business header** | Legal/trade name, **GST number**, full **address**, **phone**, email (optional), logo |
| **Invoice identity** | **Invoice number** (after bill finalized), date/time, location name |
| **Order reference** | **Token number** (daily-reset `D-` / `T-`), order type, table label (dine-in) |
| **Parties** | **Customer name**, **cashier name** |
| **Line items** | qty, **price** (pre-tax), **tax**, **amount** (price + tax), modifiers, special instructions |
| **Totals** | subtotal, discount, **tax breakdown**, service charge, tip, **grand total** |
| **Payment** | tender + amount — **only when payment recorded** |
| **Footer** | Thank-you message; `DUPLICATE` watermark on reprints — TBD |

**Data sources at print time:**

| Field | Source |
|---|---|
| Business header | `hub_business_profile_cache` ← cloud `org_business_profiles` |
| Invoice number | `invoices.invoice_number` — hub-local sequence |
| Token number | `orders.token_number` |
| Customer name | `orders.customer_name` |
| Cashier | `staff.name` of bill actor → `invoices.cashier_name` |
| Tax breakdown | `invoices.tax_breakdown_json` from `location_billing_config` |
| Line items | `invoices.line_items_json` snapshot |

Before printing (when `ACTIVE`), hub refreshes business profile from cloud if cache expired. If `SUSPENDED`, block new bills; **reprint** of past invoices still allowed.

Routes to `role = ORDERING` printers. `print_stages_json.ordering.auto_on_bill` controls first auto-print; manual reprint always available from counter.

#### 5.15.2 Kitchen print

Printed on **submit to kitchen** (per `submit_batch`). Same item detail as collection ticket, optimized for prep.

**Required fields:**

| Field | Source |
|---|---|
| Token number | `orders.token_number` — prominent header on every ticket |
| Order type | **Dine-in** / **Takeaway** badge |
| Table label | dine-in; omitted or shown for takeaway per template |
| Submit batch | `submit_batch` number + timestamp |
| Per line | qty, dish name, add/remove modifiers, special instructions |
| Station | routing label when split by station |

**Split rules (configurable):**

| Mode | Behavior |
|---|---|
| `split_by_station` | One print per `kds_station_id` — only lines routed to that station |
| `split_by_token` | Separate ticket per token when multiple active orders batch together |
| Combined | Both — e.g. grill station gets token `T-018` batch 2 ticket only |

Kitchen can receive **multiple prints per submit** — e.g. one per station, each headed with the same token number. Controlled by `print_stages_json.kitchen`.

#### 5.15.3 Collection print (pickup / handoff ticket)

Printed when order reaches pickup stage or counter manually prints. Simpler than ordering invoice — **no prices/tax** unless restaurant enables extended template.

**Required fields:**

| Field | Source |
|---|---|
| Token number | `orders.token_number` |
| Ordered products | line names + qty |
| Customizations | add/remove modifiers + special instructions |
| Order type | Dine-in / Takeaway |

**Restaurant config (per location):**

| Setting | Purpose |
|---|---|
| `collection.enabled` | master on/off for collection stage |
| `auto_print_dine_in` | auto-print when dine-in ready — default **off** |
| `auto_print_takeaway` | auto-print when takeaway `AT_COUNTER` — default **on** |
| `trigger` | `at_counter` \| `packed` \| `manual_only` |

Routes to printer(s) with `role = COLLECTION`. Restaurant chooses whether dine-in, takeaway, both, or neither auto-print.

#### 5.15.4 Token numbers on prints

- Token counters **reset daily** (configurable reset time, e.g. 04:00)
- Every print stage shows the same `token_number` for that order
- Dine-in (`D-xxx`) and takeaway (`T-xxx`) sequences remain independent

#### 5.15.5 Hub print service

| Concern | Approach |
|---|---|
| Render | hub-print service builds ESC/POS (or IPP) from stage template + order snapshot |
| Queue | `print_jobs` table — retry on failure, non-blocking to order flow |
| Routing | match `printer.role` + optional `kds_station_ids` filter |
| Reprint | counter/admin re-queues `print_jobs` from `payload_json` or invoice snapshot |
| Failure | warning on device UI; order/kitchen state unchanged |
| Cloud | all print payloads and jobs stay on hub — never synced |

#### 5.15.6 Open decisions (printing)

- [ ] DUPLICATE watermark on reprints
- [ ] Printer driver: ESC/POS vs IPP

### 5.17 Menu catalog administration (counter / admin console)

The **counter admin console** (hub UI — future route on counter/tablet) manages the full menu catalog per location. Nothing is hard-coded; all examples below are illustrative.

| Admin action | Tables affected |
|---|---|
| Create/rename/reorder categories | `menu_categories` |
| Create/edit tags (vegan, spicy, …) | `menu_tags` |
| Assign tags to items | `menu_item_tags` |
| Add category-wide modifier groups (pizza crust options) | `modifier_groups` (`scope = CATEGORY`) |
| Add item-specific extras (jalapeño +₹15) | `modifier_groups` (`scope = ITEM`) + `modifier_options` |
| Set base & zone prices | `menu_items`, `menu_item_zone_prices` |

**Waiter / POS flow:**
1. Pick category → item (tags shown as badges).
2. UI presents merged modifier groups: category defaults + item-specific groups.
3. On confirm, hub writes `order_lines` with full price + modifier + tag snapshots.
4. Kitchen receives submitted lines including modifier labels and tags.

**Price change policy:** editing `base_price_cents`, `menu_item_zone_prices.price_cents`, or `modifier_options.price_cents` takes effect on the **next** line added. Open draft lines may be refreshed only while still `DRAFT` and not yet submitted — once submitted or billed, snapshots are frozen.

### 5.16 Post-MVP backlog

| Feature | Notes |
|---|---|
| Split bill | Divide order lines across multiple payers |
| Partial payment | Multiple tenders against one bill |
| Card terminal / POS integration | Auto-capture; payment block always on invoice |
| Payment provider sync | Original cloud webhook → aggregate signal only |

---

## 4. Module 3 — Local-First Sync & Optional Cloud

### 4.1 Goals

1. **Never block floor ops** on network availability
2. **Respect `cloud_sync_enabled`** — when off, zero cloud traffic and indefinite local retention
3. When enabled: **full historical backfill** then incremental sync — idempotent, keyed by `org_id`
4. **Automatic recovery** from extended outages (outbox grows on hub, drains when online)
5. **Observable** sync health per hub — including backfill progress

### 4.2 Component diagram

```
┌──────────────┐     XREADGROUP      ┌─────────────────┐
│ Redis Stream │ ──────────────────► │ persist worker  │
│ (on hub)     │                     │ (hub process)   │
└──────────────┘                     └────────┬────────┘
                                              │ txn
                                              ▼
                                     ┌─────────────────┐
                                     │ hub local DB    │
                                     │  + sync_outbox* │
                                     └────────┬────────┘
                                              │
┌──────────────┐     poll + backoff          │
│ sync agent   │ ◄───────────────────────────┘
│ (hub)        │
└──────┬───────┘
       │
┌──────▼───────┐   on enable / gap   ┌─────────────────┐
│ backfill     │ ◄────────────────── │ location sync   │
│ worker       │                     │ state (cursor)  │
└──────┬───────┘                     └─────────────────┘
       │ outbound HTTPS (hub → cloud only)
       │ idle when cloud_sync_enabled=false
       ▼
┌──────────────┐     produce     ┌─────────────────┐
│ ingest API   │ ──────────────► │ Kafka           │
│ (cloud)      │  partition:     │  key: org_id    │
└──────────────┘  org_id         └────────┬────────┘
                                          ▼
                                 ┌─────────────────┐
                                 │ settle workers  │
                                 │ → cloud DB      │
                                 │   (per org_id)  │
                                 └─────────────────┘
```

### 4.3 persist worker (Redis → local DB)

**Input:** Redis Stream consumer group `persist`  
**Behavior:**

1. Read batch of stream entries
2. In a single DB transaction:
   - Apply mutation to operational tables (upsert with `version` check)
   - Insert into `sync_outbox` only if `cloud_sync_enabled` AND event is sync-bound AND passes invoice-field strip validation
   - Write `invoices` row + local document when payment finalizes — **never** enqueue invoice data
   - Insert into `applied_events`
3. `XACK` on success

On version conflict: write conflict row to `sync_conflicts` table (TBD) and alert; do not ACK until resolved or escalated.

### 4.4 Toggling `cloud_sync_enabled`

#### Enable (local → cloud)

Admin sets `cloud_sync_enabled = true`. Hub does **not** block floor ops.

```
1. Set sync_state = BACKFILL_RUNNING
2. backfill-worker scans hub DB tables in chronological order from genesis:
   orders → order_lines → payments → catalog → staff (redacted) → …
3. Each row → POST /v1/ingest/backfill { text JSON, idempotency_key: "{table}:{pk}" }
4. Advance backfill_cursor after each committed batch
5. On complete: sync_state = SYNCING
6. sync-agent drains sync_outbox (incremental events since backfill started)
7. Steady state: incremental only via outbox + live persist
```

- **Full history from the beginning** — text JSON is lightweight; no need to sync only from toggle moment
- Backfill is **background, throttled** — cap batch rate so LAN floor ops stay priority
- Idempotent cloud ingest — safe to re-run backfill after failure (duplicate keys → 409)
- If hub was offline for months then re-enabled: backfill catches up from `backfill_cursor` gap

#### Disable (cloud → local only)

```
1. Set cloud_sync_enabled = false immediately (hard stop outbound)
2. sync-agent + backfill-worker halt — no drain required
3. Hub local DB unchanged — continues as sole source of truth
4. Cloud retains data already synced (no delete / tombstone cascade)
5. sync_state = LOCAL_ONLY
```

Re-enabling later resumes backfill from last `backfill_cursor` for any rows mutated while cloud was off.

### 4.5 sync agent (outbox → cloud)

Runs on hub **only when `sync_state = SYNCING`**. Idle when `LOCAL_ONLY`.

Long-running hub process (systemd service). State machine per outbox row:

```
PENDING → IN_FLIGHT → ACKED
              ↓ (retryable error)
         PENDING (backoff)
              ↓ (max attempts)
            DEAD (manual replay)
```

**Algorithm (poll loop):**

```
loop:
  if sync_state != SYNCING: idle
  if not network_up(): sleep; continue

  rows = SELECT * FROM sync_outbox
         WHERE status IN ('PENDING','IN_FLIGHT')
           AND next_attempt_at <= now()
         ORDER BY created_at
         LIMIT batch_size
         FOR UPDATE SKIP LOCKED

  for row in rows:
    mark IN_FLIGHT
  commit

  for row in rows:
  try:
    POST /v1/ingest/events { envelope incl. org_id, location_id, hub_id }
    on 200/409 (duplicate): mark ACKED
  catch retryable:
    mark PENDING, attempt_count++, exponential backoff
  catch fatal:
    mark DEAD
```

**Backoff:** `min(cap, base * 2^attempt)` with jitter; default cap 15 minutes.

**Network detection:** combine ICMP/gateway ping + TCP probe to ingest host + recent HTTP success.

### 4.6 Cloud ingest API

- Validates schema version and required fields
- `POST /v1/ingest/backfill` — bulk historical row ingest (backfill worker)
- `POST /v1/ingest/events` — incremental live events (sync-agent)
- **Rejects hub-local-only fields** (`invoice_id`, `invoice_number`, `document_path`, `customer_contact`, `pin_hash`, card tokens)
- Deduplicates on `idempotency_key` or `event_id` (return 409 with existing offset)
- Produces to Kafka with partition key = `org_id` (ordering per org; `location_id` in payload)
- Returns `{ "accepted": true, "offset": "..." }`

### 4.7 Settle workers (Kafka → cloud DB)

- Consumer group per topic or unified multi-topic consumer
- Insert into `sync_records` (raw JSONB text, immutable) — full operational text, keyed by `org_id` + `location_id`
- Upsert reporting projections: `daily_location_totals`, `orders_fact`, `payments_fact`
- **No invoice PDFs, `pin_hash`, or `customer_contact` in cloud DB**
- Commit Kafka offset only after DB commit

### 4.8 Kafka scaling (multi-location / full text sync)

Full operational text sync across many locations needs a sized Kafka tier:

| Scale | Guidance |
|---|---|
| Single org, few locations | Single Kafka cluster; partition by `org_id` |
| Many orgs / hundreds of locations | Dedicated Kafka cluster; increase partitions per `org_id`; batch ingest API |
| Backfill storms | Throttle hub backfill rate; ingest API buffers → Kafka async; monitor lag per org |

Start with **one Kafka cluster + org_id partitioning**. Split clusters when consumer lag or disk retention outgrows a single cluster — not needed on day one.

### 4.9 Failure modes

| Scenario | Behavior |
|---|---|
| Internet down mid-shift | Outbox grows on hub (if cloud enabled); floor unaffected via LAN while `ACTIVE` |
| `cloud_sync_enabled` flipped on mid-shift | Backfill starts in background; floor ops unaffected |
| `cloud_sync_enabled` flipped off | Hard stop outbound; local hub continues |
| Subscription past `current_period_end` | Immediate `SUSPENDED` — no grace, even if hub offline |
| Hub suspended | Read-only: invoices + Excel export for lifetime; no new ops |
| Backfill interrupted | Resume from `backfill_cursor`; idempotent ingest |
| Duplicate delivery | Cloud dedupe on `event_id` / `idempotency_key` |
| Hub disk full | Alert; stop accepting new outbox rows (floor still on LAN) — ops escalation |
| Redis lost, DB intact | Rebuild Redis from DB + unreplayed stream entries |
| DB lost, Redis intact | Critical alert; snapshot Redis to emergency dump; restore from last backup |
| Clock skew | Use UUID v7 + `occurred_at` from hub NTP-synced clock; cloud records `recorded_at` |

### 4.10 Observability (per hub)

| Metric | Purpose |
|---|---|
| `hub_status` | `ACTIVE` / `SUSPENDED` |
| `subscription_period_end` | days until `current_period_end` |
| `sync_state` | `LOCAL_ONLY` / `BACKFILL_RUNNING` / `SYNCING` |
| `backfill_progress_pct` | backfill job completion |
| `outbox_pending_count` | backlog pressure (only when cloud enabled) |
| `outbox_oldest_pending_age_seconds` | sync lag SLA (only when cloud enabled) |
| `invoices_local_count` | local storage growth |
| `sync_agent_last_success_at` | heartbeat |
| `redis_stream_lag` | persist worker health |
| `lease_rollback_total` | abandoned seating detection |

### 4.11 Open decisions (sync)

- [ ] Backfill throttle defaults (rows/sec per hub)
- [ ] Bi-directional sync (menu cloud → hub) — separate read-only config channel
- [ ] Conflict resolution UX for version mismatches at billing time

---

## 6. Suggested Repository Layout (Future)

```
table-stream/
├── docs/
│   └── PLANNING.md          ← this document
├── packages/
│   ├── hub-api/               # REST + WSS — LAN-facing hub API for all devices
│   ├── hub-export/              # Excel export from local DB (suspended + admin)
│   ├── hub-redis/             # Lua scripts, key helpers, stream envelopes
│   ├── hub-db/                # migrations, repositories, outbox
│   ├── license-checker/       # subscription + business profile fetch from cloud
│   ├── control-plane-api/     # cloud: org profile, subscriptions, entitlements
│   ├── sync-agent/            # incremental outbox drain (optional data plane)
│   ├── backfill-worker/       # historical hub DB → cloud (on enable)
│   ├── ingest-api/            # cloud event gateway (org_id partitioned)
│   ├── settle-worker/         # Kafka → cloud projections per org
│   ├── web/                     # single app — role routes: /kitchen, /waiter, /counter, /customer
├── schemas/
│   ├── hub/                   # SQL migrations
│   └── events/                # JSON Schema for cloud-safe sync payloads (no invoice fields)
└── deploy/
    ├── hub/                   # per-location hub compose / systemd units
    └── cloud/                 # Kafka, ingest, workers (optional central stack)
```

---

## 7. Phased Implementation Roadmap

> **Edge hub API:** see [`EDGE-SERVER-ROADMAP.md`](./EDGE-SERVER-ROADMAP.md) for phased `apps/edge-server` steps (small PRs, tests required, health checks).

### Phase 0 — Foundations

- [x] Hub DB: **SQLite**
- [x] Frontend: **single web app**, role-based routes
- [x] Hub provisioning: **manual config file** (MVP)
- [x] Subscription: **manual env/config** (MVP)
- [x] Tax mode: inclusive / exclusive setup; three-column line display
- [x] Invoice print: unlimited before/after payment; tender block after payment only
- [ ] Choose language runtime
- [ ] `hub.config.yaml` + env vars for org/location/subscription (see §10)
- [ ] `organizations` + `locations` schema with `org_id`, `hub_status`, `cloud_sync_enabled`
- [ ] Cloud control plane stub (manual entitlement endpoint or config override)
- [ ] Hub license-checker + `hub_business_profile_cache` + `SUSPENDED` read-only mode
- [ ] Hub API skeleton + device pairing + LAN TLS
- [ ] Redis key conventions and stream envelope implementation
- [ ] Setup schema: `zones`, `menu_items`, `menu_item_zone_prices`, `tables`, `devices`
- [ ] Local dev compose: hub (Redis + SQLite) + web app + stub control plane

### Phase 1 — Setup, staff & counter (local only)

- [ ] Staff CRUD + PIN auth (admin, counter, waiter roles)
- [ ] Zone CRUD with customizable names
- [ ] Menu + per-zone pricing grid
- [ ] Admin billing config: tax, service charge, tip quick actions
- [ ] Printer setup (kitchen + receipt)
- [ ] Table layout editor (zone assignment, positions)
- [ ] Counter web view: create takeaway order, allocate takeaway token

### Phase 2 — Kitchen, printing & customer views

- [ ] Draft vs submit flow (`is_submitted`, `submit_batch`)
- [ ] Order submit → KDS queue + **kitchen print** (split by station/token)
- [ ] `location_print_config` + three printer roles (ordering, kitchen, collection)
- [ ] Kitchen web view: `IN_PROGRESS` / `PREPARED` (auto-clear prepared from view)
- [ ] 86 flow: kitchen alert → waiter cancel
- [ ] Takeaway fulfillment + **collection print** (configurable dine-in/takeaway)
- [ ] Daily-reset token counters on all print stages
- [ ] Separate dine-in / takeaway token sequences

### Phase 3 — Waiter view, table ops & billing

- [ ] Waiter zone-filtered table map
- [ ] Add-on rounds on same `order_id`
- [ ] Unstage/edit queued lines (pre-`IN_PROGRESS`)
- [ ] Transfer table, merge/split, waiter handoff
- [ ] Discount (percent/fixed) + tip entry + generate bill
- [ ] **Invoice print** with cloud business header (GST, address, phone, tax breakdown, invoice #, token, cashier)
- [ ] Manual payment tender (cash/card/other) + reprint at any stage
- [ ] persist worker: stream → hub DB

### Phase 4 — Optional cloud sync

- [ ] `cloud_sync_enabled` toggle + `sync_state` machine
- [ ] backfill-worker: full historical text sync from genesis
- [ ] sync-agent: incremental outbox drain
- [ ] ingest API (`/backfill` + `/events`) + settle workers per `org_id`
- [ ] Kafka org partitioning + backfill throttle

### Phase 5 — Hardening

- [ ] Lease sweeper, cold-start rebuild, chaos testing (partition simulation)
- [ ] Dead letter replay tooling
- [ ] Suspended hub archive UI + full Excel export
- [ ] Multi-location org dashboards (cloud enabled locations only)

---

## 8. Refinement Log

| Date | Change |
|---|---|
| 2026-07-02 | Initial planning doc created from system context |
| 2026-07-22 | Zone-based tax rates (`zones.tax_rules_json`); location tax as fallback; item tax classes post-MVP |
| 2026-07-02 | Invoices constrained to local-only storage; cloud sync scoped to aggregate signals |
| 2026-07-02 | Added Module 4: kitchen, customer, waiter, counter views; zones; separate tokens; zone pricing |
| 2026-07-02 | Staff/PIN auth, order lifecycle (draft/submit/add-on), table ops, billing, printing; post-MVP scope |
| 2026-07-02 | Hub-and-spoke LAN topology, `org_id` model, optional `cloud_sync_enabled` |
| 2026-07-02 | mDNS discovery + fixed IP fallback; full text backfill on cloud enable; hard stop on disable |
| 2026-07-02 | Stage-based printing: ordering invoice, kitchen tickets, collection pickup |
| 2026-07-02 | Cloud business profile + subscription licensing; full invoice print field spec |
| 2026-07-02 | No offline grace; suspended hubs read-only with lifetime invoice access + Excel export |
| 2026-07-02 | Phase 0 locked: SQLite, single web app, manual config MVP, tax modes, invoice print rules |

---

## 10. Phase 0 Decisions — MVP Operations (manual)

For MVP, **hub provisioning** and **subscription state** are operator-controlled via config — no Stripe, no self-serve signup console.

### 10.1 Hub config file (`hub.config.yaml`)

Placed on hub hardware at first deploy. Operator (or vendor) fills in values manually.

```yaml
org_id: org_xyz
location_id: loc_downtown
hub_id: hub_001
location_name: "Downtown Branch"
timezone: Asia/Kolkata

control_plane:
  url: https://control.example.com   # or file:// stub for local dev
  # MVP: entitlement can be overridden locally (see env below)

cloud_sync_enabled: false

lan:
  bind: 0.0.0.0
  port: 8443
  tls_cert: /etc/tablestream/hub.crt
  tls_key: /etc/tablestream/hub.key
  mdns_name: tablestream-hub

data_dir: /var/lib/tablestream
```

On first boot, hub reads config → seeds `locations` row → begins license checks against `control_plane.url`.

### 10.2 Subscription & entitlement — env override (MVP)

Until a billing admin console exists, subscription state is set via **environment variables** or a sidecar config `subscription.env`:

```bash
SUBSCRIPTION_STATUS=ACTIVE          # ACTIVE | SUSPENDED
SUBSCRIPTION_PERIOD_END=2026-12-31T23:59:59Z
HUB_ENTITLED=true                   # false → SUSPENDED

# Business profile (MVP local override when control plane unreachable)
ORG_LEGAL_NAME="Acme Restaurants Pvt Ltd"
ORG_GST_NUMBER=29AAAAA0000A1Z5
ORG_ADDRESS_JSON='{"line1":"123 Main St","city":"Bangalore","postal":"560001"}'
ORG_PHONE="+91 80 1234 5678"
```

**MVP license-checker behavior:**

1. If `HUB_ENTITLED` / env vars present → use them (skip cloud call) — for dev and early deploys
2. Else `GET control_plane /v1/orgs/{org_id}/entitlement` → use cloud response
3. Post-MVP: replace env override with Stripe webhook → cloud DB → entitlement API

### 10.3 Business profile source (MVP)

| Environment | Profile source |
|---|---|
| Production (early) | Cloud control plane API |
| Dev / offline demo | `ORG_*` env vars seed `hub_business_profile_cache` |
| Post-MVP | Cloud admin console only; env override removed |

### 10.4 Post-MVP replacements

| MVP (manual) | Production |
|---|---|
| `hub.config.yaml` hand-edited | Provisioning portal generates config + pairing QR |
| `SUBSCRIPTION_*` env vars | Stripe webhook → `subscriptions` table |
| `ORG_*` env vars | `org_business_profiles` admin UI |

---

## 9. Next Refinement Topics

1. **Choose language runtime** (last major Phase 0 blocker)
2. Formal JSON Schema files for cloud ingest events
3. Print templates per stage (ordering ESC/POS, kitchen, collection)
4. Lua script specs for lease acquire, token allocation, table transfer, submit-batch
5. **Hub API contract** (`docs/API.md`) — REST + WSS surface per view
6. Web view wireframes (single app, four routes)
7. Merge/split table edge cases (active kitchen items mid-merge)
