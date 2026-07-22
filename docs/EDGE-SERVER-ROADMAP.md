# Edge Server — Phased Implementation Plan

> **Scope:** `apps/edge-server` only (Fastify hub gateway)  
> **Parent spec:** [`PLANNING.md`](./PLANNING.md)  
> **Status:** Active — implement in order; one PR per step unless noted  
> **Last updated:** 2026-07-03

---

## 1. Goals

| Goal | How |
|------|-----|
| Small, reviewable PRs | One step ID per PR (e.g. `E2.3`) |
| Easy to test | Every step ships **unit + route tests** before merge |
| Reusable logic | Business rules live in `services/` and `lib/` — routes stay thin |
| Device-ready health | Any LAN client can probe liveness and readiness |
| Hub as source of truth | SQLite is authoritative; Redis comes later (Phase E8) |

---

## 2. Code layout (target)

Introduce incrementally — do not scaffold empty folders ahead of need.

```text
apps/edge-server/src/
├── index.ts                 # boot: config → migrate → redis → listen
├── app.ts                   # buildApp(), register plugins
├── config.ts
├── plugins/
│   ├── db.ts                # decorate hubDb
│   └── auth.ts              # device + staff guards (later)
├── routes/
│   ├── health.ts            # GET /health, GET /health/ready
│   ├── status.ts            # GET /v1/status
│   ├── menu/                # catalog routes (Phase E2)
│   ├── setup/               # zones, tables, staff (Phase E3)
│   └── orders/              # orders, lines, billing (Phase E4–E6)
├── services/                # reusable business functions
│   ├── hub-seed.ts
│   ├── menu-catalog.ts
│   ├── pricing.ts
│   ├── order-lines.ts
│   └── billing.ts
├── repositories/            # Drizzle queries only (no HTTP)
│   ├── organizations.ts
│   ├── menu.ts
│   └── orders.ts
├── lib/
│   ├── errors.ts            # AppError, toProblemJson()
│   ├── snapshots.ts         # modifier/tag/price snapshots for order_lines
│   └── ids.ts               # id generation helpers
└── db/
    ├── client.ts
    ├── migrate.ts
    └── migrations/
```

**Layer rules**

| Layer | Responsibility | Tests |
|-------|----------------|-------|
| `routes/` | Parse request, call service, map status codes | `*.route.test.ts` via `app.inject()` |
| `services/` | Business rules, orchestration | `*.service.test.ts` unit tests |
| `repositories/` | SQL/Drizzle CRUD | tested via service tests or `*.repo.test.ts` with test DB |
| `lib/` | Pure helpers | `*.test.ts` |

---

## 3. Endpoint design conventions

### 3.1 URL layout

| Prefix | Purpose | Auth |
|--------|---------|------|
| `GET /health` | Liveness — process up | None |
| `GET /health/ready` | Readiness — DB (+ Redis when used) | None |
| `GET /v1/status` | Hub identity, subscription gate, sync flags | None (LAN trust MVP) |
| `GET /v1/...` | Reads | Device token (E7) / staff session (E7) |
| `POST /v1/...` | Writes | Device + staff as required |
| `PATCH /v1/...` | Partial updates | Same |
| `WSS /v1/stream` | Real-time events | Device token (E7) |

Version all product APIs under `/v1`. Health stays unversioned so load balancers and devices can use a stable probe.

### 3.2 Response shapes

**Success:** JSON body, appropriate `2xx`.

**Error:** consistent problem object:

```json
{
  "error": {
    "code": "MENU_ITEM_NOT_FOUND",
    "message": "Menu item not found",
    "details": {}
  }
}
```

Map in `lib/errors.ts` — services throw `AppError`, routes catch and serialize.

### 3.3 Write safety

- `POST` create → `201` + `Location` header optional
- Idempotency: `Idempotency-Key` header on order submit, payment, print job (later)
- Optimistic concurrency: `If-Match: <version>` on order/table updates (Phase E5+)
- All catalog price changes affect **future** lines only — snapshots at line-add (see `PLANNING.md` catalog rules)

### 3.4 Pagination (when lists grow)

`GET /v1/menu/items?zone_id=&limit=50&cursor=` — defer until needed; first steps return full location menu.

---

## 4. Health checks (required on every deployment)

Any device on the LAN must be able to verify the hub before pairing or syncing.

### 4.1 `GET /health` — liveness

Already stubbed. Extend minimally:

```json
{
  "status": "ok",
  "service": "edge-server",
  "hub_id": "hub_demo_001",
  "location_id": "loc_demo",
  "org_id": "org_demo",
  "uptime_seconds": 1234
}
```

- **Must not** call DB or Redis (fast probe)
- Used by Docker `HEALTHCHECK`, K8s liveness, waiter app splash screen

### 4.2 `GET /health/ready` — readiness

```json
{
  "status": "ok",
  "checks": {
    "sqlite": { "ok": true },
    "redis": { "ok": true }
  }
}
```

- `503` if SQLite unreachable
- Redis `ok: false` with `degraded` status until Phase E8 — then required `ok: true`
- Used before accepting operational traffic after restart

### 4.3 Tests (mandatory)

| Test | Assert |
|------|--------|
| `GET /health` | `200`, body contains `hub_id` |
| `GET /health/ready` | `200` when DB up |
| `GET /health/ready` | `503` when DB cannot be opened (mock/fail path) |

---

## 5. Testing policy

**Nothing merges without tests for that step.**

| Type | Tool | Location |
|------|------|----------|
| Unit | Vitest | `src/**/*.test.ts` next to source or `src/**/__tests__/` |
| Route / integration | Vitest + `app.inject()` | `src/routes/**/*.route.test.ts` |
| Test DB | SQLite `:memory:` or temp file | `src/test/fixtures.ts` |

**Per-PR checklist**

- [ ] Service functions have unit tests (happy path + at least one error path)
- [ ] New routes have `inject()` tests for status code + body shape
- [ ] `pnpm --filter @table-stream/edge-server test` passes
- [ ] `make check` passes (or `pnpm typecheck && pnpm lint && pnpm test`)

**Test helpers to add in E0.4**

- `createTestApp()` — in-memory DB, mock redis, test config
- `seedMinimalLocation()` — org, location, one zone, one menu item

---

## 6. Implementation phases

Each **step** = one PR. Complete in order unless a step says it can parallelize.

---

### Phase E0 — Server shell & health

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E0.1** | Refactor routes | Extract `routes/health.ts`, `routes/status.ts`; register from `app.ts` | Move existing `app.test.ts` assertions; still green |
| **E0.2** | Ready probe | `GET /health/ready` with SQLite `SELECT 1` | `200` ok, `503` when DB fails |
| **E0.3** | Error helper | `lib/errors.ts` + global Fastify error handler | Unit: `toProblemJson()`; route: `404` shape |
| **E0.4** | Test fixtures | `src/test/fixtures.ts`, `createTestApp()` | Fixture test: app boots, health works |

**Done when:** any device can `curl http://hub:8443/health` and `/health/ready` and get meaningful JSON.

---

### Phase E1 — Hub bootstrap & identity

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E1.1** | Seed service | `services/hub-seed.ts` — upsert org + location from `hub.config.yaml` on boot | Unit: seed idempotent (run twice, one row each) |
| **E1.2** | Repositories | `repositories/organizations.ts` — getById, upsert | Repo test against memory SQLite |
| **E1.3** | Wire boot | `index.ts` calls seed after migrate | Route: `/v1/status` includes seeded `location_name` |
| **E1.4** | Status enrich | `/v1/status` adds `db_ready`, `schema_version` (latest migration id) | inject tests |

**Reusable functions**

- `seedHubFromConfig(db, config): Promise<void>`
- `getHubIdentity(db, config): HubIdentity`

---

### Phase E2 — Menu catalog (admin setup API)

Build read paths before writes. Aligns with `menu_categories`, `menu_tags`, `modifier_*` schema.

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E2.1** | Categories R | `GET /v1/menu/categories` | Empty list + seeded list |
| **E2.2** | Categories W | `POST/PATCH /v1/menu/categories` | Create, update name, `is_active` |
| **E2.3** | Tags R/W | `GET/POST/PATCH /v1/menu/tags` | Unique `(location_id, code)` violation → `409` |
| **E2.4** | Items R | `GET /v1/menu/items?zone_id=` — resolves zone price | Price fallback to `base_price_cents` |
| **E2.5** | Items W | `POST/PATCH /v1/menu/items` + tag assignment | Tags linked via `menu_item_tags` |
| **E2.6** | Modifier groups | `GET/POST/PATCH /v1/menu/modifier-groups` (category + item scope) | Scope validation: category requires `category_id` |
| **E2.7** | Modifier options | `GET/POST/PATCH .../modifier-groups/:id/options` | `price_cents` stored; inactive hidden from menu read |
| **E2.8** | Zone prices | `PUT /v1/menu/items/:id/zone-prices` (batch) | Grid upsert; read reflects zone |

**Reusable functions**

- `services/menu-catalog.ts`: `listCategories`, `createCategory`, `listMenuForZone(zoneId)`, …
- `services/pricing.ts`: `resolveUnitPriceCents(menuItemId, zoneId)` — used by orders later
- `lib/snapshots.ts`: `buildModifierSnapshots(selections)`, `buildTagSnapshots(tagIds)` (stub until E4)

**Endpoint summary (cumulative)**

```text
GET    /v1/menu/categories
POST   /v1/menu/categories
PATCH  /v1/menu/categories/:id
GET    /v1/menu/tags
POST   /v1/menu/tags
PATCH  /v1/menu/tags/:id
GET    /v1/menu/items
POST   /v1/menu/items
PATCH  /v1/menu/items/:id
PUT    /v1/menu/items/:id/zone-prices
GET    /v1/menu/modifier-groups?category_id=&menu_item_id=
POST   /v1/menu/modifier-groups
PATCH  /v1/menu/modifier-groups/:id
POST   /v1/menu/modifier-groups/:id/options
PATCH  /v1/menu/modifier-options/:id
```

---

### Phase E3 — Floor setup (zones, tables, staff)

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E3.1** | Zones CRUD | `GET/POST/PATCH /v1/zones` | Sort order, deactivate |
| **E3.2** | Tables CRUD | `GET/POST/PATCH /v1/tables` | Zone FK, `pos_x/y`, status enum |
| **E3.3** | Staff CRUD | `GET/POST/PATCH /v1/staff` | `pin_hash` never returned; role enum |
| **E3.4** | Billing config | `GET/PUT /v1/location/billing-config` | `price_tax_mode`, tax JSON |
| **E3.5** | KDS stations | `GET/POST/PATCH /v1/kds-stations` | Station sort order |

**Reusable functions**

- `hashPin(pin): string` in `lib/auth.ts` (bcrypt or argon2)
- `repositories/setup.ts` for zones/tables/staff

---

### Phase E4 — Orders & line snapshots (no kitchen yet)

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E4.1** | Create order | `POST /v1/orders` — dine-in / takeaway, `zone_id` | Dine-in requires `table_id` |
| **E4.2** | Add line | `POST /v1/orders/:id/lines` — snapshots price, modifiers, tags | Price change on catalog does not alter existing line |
| **E4.3** | Update draft line | `PATCH /v1/orders/:id/lines/:lineId` — qty, modifiers (draft only) | Rejects if `is_submitted` |
| **E4.4** | Remove draft line | `DELETE /v1/orders/:id/lines/:lineId` | Same guard |
| **E4.5** | Get order | `GET /v1/orders/:id` with lines + computed subtotal | Uses `shared-utils` billing |
| **E4.6** | List open orders | `GET /v1/orders?status=OPEN` | Filter by type/table |

**Reusable functions**

- `services/order-lines.ts`: `addLine()`, `snapshotLineFromCatalog()`, `assertDraftLine()`
- `services/billing.ts`: wraps `@table-stream/shared-utils` for order totals
- `lib/snapshots.ts`: full implementation + tests with fixture catalog

**Critical test:** change `modifier_options.price_cents` after line add → old line unchanged, new line gets new price.

---

### Phase E5 — Submit to kitchen & realtime stream

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E5.1** | Submit batch | `POST /v1/orders/:id/submit` — marks draft lines submitted, `submit_batch++` | Only drafts submitted; idempotent key |
| **E5.2** | Token issue | Assign `token_number` on takeaway submit (configurable prefix) | Daily counter in SQLite (Redis later) |
| **E5.3** | KDS read API | `GET /v1/kds/queue?station_id=` | Only submitted, `kds_visible` lines |
| **E5.4** | Line status | `PATCH /v1/kds/lines/:id/status` — `IN_PROGRESS`, `PREPARED` | Valid transitions only |
| **E5.5** | WebSocket | `/v1/stream` emits `order.submitted`, `line.updated` | WS test: connect, receive event after submit |

---

### Phase E6 — Billing, payments, invoices (local)

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E6.1** | Bill preview | `POST /v1/orders/:id/bill/preview` — discount, tip, tax | Matches `shared-utils` golden values |
| **E6.2** | Finalize bill | `POST /v1/orders/:id/bill` — locks totals on order | Blocked when `SUSPENDED` |
| **E6.3** | Payment | `POST /v1/orders/:id/payments` — CASH/CARD/OTHER | Tender recorded; invoice eligible |
| **E6.4** | Invoice row | `POST /v1/orders/:id/invoice` — local PDF path stub | Invoice number sequence |
| **E6.5** | Re-print | `GET /v1/invoices/:id` | Snapshot immutability |

---

### Phase E7 — Auth (device + staff)

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E7.1** | Device pairing | `POST /v1/devices/pair` → `device_token` | Invalid code → `401` |
| **E7.2** | Device guard | `plugins/auth.ts` — `X-Device-Token` on `/v1/*` except health/status | Missing token → `401` |
| **E7.3** | Staff PIN login | `POST /v1/auth/staff/login` → session token | Lockout after N failures |
| **E7.4** | Permission guard | Role checks on setup vs waiter routes | Waiter cannot `POST /v1/menu/items` |

---

### Phase E8 — Redis hot path (after SQLite flows work)

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E8.1** | Redis health | `/health/ready` requires Redis ping | Fails when Redis down |
| **E8.2** | Table leases | `services/table-lease.ts` + atomic SET | Dual waiter lease conflict |
| **E8.3** | KDS cache | Mirror submitted lines to `ts:kds:*` | Fallback read from SQLite if Redis miss |
| **E8.4** | Pub/sub stream | WS backed by Redis streams | Integration test with test Redis |

---

### Phase E9 — Print jobs

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E9.1** | Printers CRUD | `GET/POST/PATCH /v1/printers` | |
| **E9.2** | Print config | `GET/PUT /v1/location/print-config` | Stage toggles JSON |
| **E9.3** | Enqueue job | `POST /v1/print-jobs` — kitchen / invoice / collection | Job row + status machine |

---

### Phase E10 — License gate & suspended mode

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E10.1** | License checker | Poll control plane / env; update `locations.hub_status` | `SUSPENDED` on lapse |
| **E10.2** | Write guard | Middleware blocks mutating routes when suspended | `GET` allowed, `POST` → `403` |
| **E10.3** | Business profile cache | Refresh `hub_business_profile_cache` | Used on invoice header |
| **E10.4** | Export stub | `GET /v1/export/full` — JSON archive MVP | Read-only when suspended |

---

### Phase E11 — Zone-based tax rates

Tax rates are configured **per zone** (same JSON shape as location `tax_rules_json`). Operators may set identical rates on every zone, or different rates (e.g. outdoor vs AC, bar vs dining). Empty/missing zone rules inherit `location_billing_config.tax_rules_json`.

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **E11.1** | Schema | `zones.tax_rules_json` + migration; Drizzle + seed defaults | Migration applies; existing zones inherit location |
| **E11.2** | Zones API | Create/update/list expose `tax_rules`; validate component map | CRUD round-trip |
| **E11.3** | Billing resolve | Line/bill tax from `orders.zone_id` → zone rules → location fallback | Different zones → different tax on bill |
| **E11.4** | Invoice breakdown | Snapshot applied rules; `tax_breakdown` by component; aggregate by combined rate when needed | Invoice shows rate totals (e.g. 5% vs 18% across orders) |

**Out of scope for E11:** per-item / category tax classes (alcohol vs food on the same check). Zone tax applies to the whole order via `orders.zone_id`.

---

## 7. Suggested PR sequence (first 10 PRs)

Start here — each is independently testable:

1. **E0.1** — Route plugin split  
2. **E0.2** — `/health/ready`  
3. **E0.4** — Test fixtures (`createTestApp`)  
4. **E1.1–E1.2** — Hub seed service + repo  
5. **E1.3** — Wire seed on boot  
6. **E2.1–E2.2** — Categories read/write  
7. **E2.4–E2.5** — Menu items read/write  
8. **E3.1** — Zones  
9. **E4.1–E4.2** — Create order + add line with snapshots  
10. **E4.5** — Get order with totals  

Kitchen submit (E5), auth (E7), and Redis (E8) intentionally come **after** a takeaway order can be created and read from SQLite alone.

---

## 8. Out of scope for this roadmap

- Cloud ingest / sync-agent (see `PLANNING.md` Phase 4)
- PowerSync tablet SQLite (client-side; hub API is the contract)
- Frontend UI implementation (`tablet-pos`, `kitchen-display`) — consume these APIs
- mDNS discovery, TLS provisioning — separate infra steps

---

## 9. Definition of done (edge-server MVP)

- [ ] `/health` and `/health/ready` pass from Docker and LAN devices
- [ ] Hub seeds org/location from config
- [ ] Full menu catalog CRUD with tags and modifiers
- [ ] Create takeaway order → add lines → snapshot prices → submit → KDS queue
- [ ] Bill + payment + local invoice row
- [ ] Device + staff auth on all `/v1` routes (except health/status)
- [ ] Test coverage: every route and service listed above has tests; `pnpm test` green
- [ ] `make check` green on Node 22

---

## 10. Refinement log

| Date | Change |
|------|--------|
| 2026-07-22 | Phase E11 — zone-based tax rates (after E10 complete) |
| 2026-07-03 | Initial edge-server phased roadmap |
