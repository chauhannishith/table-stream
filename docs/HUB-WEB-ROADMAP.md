# Hub Web — Phased Implementation Plan

> **Scope:** LAN floor UI — counter, setup, kitchen, waiter, customer views  
> **Parent spec:** [`PLANNING.md`](./PLANNING.md) §5 (Module 4), §7 Phases 1–3  
> **Backend contract:** [`EDGE-SERVER-ROADMAP.md`](./EDGE-SERVER-ROADMAP.md) (E0–E11 complete on main)  
> **Status:** Active — implement in order; one PR per step unless noted  
> **Last updated:** 2026-07-23

---

## 1. Goals

| Goal | How |
|------|-----|
| Small, reviewable PRs | One step ID per PR (e.g. `F1.5`) |
| Easy to test | Component tests + flow tests with mocked hub API before merge |
| Thin UI, fat hub | All business rules stay in edge-server; UI calls REST + WSS only |
| Counter-first | Validate full takeaway golden path before KDS / waiter complexity |
| One deploy artifact | Single Vite app with role routes (`/counter`, `/kitchen`, …) per `PLANNING.md` §5.10 |

**Not in this roadmap:** `apps/cloud-dashboard` (cloud control plane — see `PLANNING.md` Phase 4–5).

---

## 2. App target

**Decision:** evolve `apps/tablet-pos` into the **hub web shell** (all role routes). Keep package name for now; rename to `apps/hub-web` in **F0.1** if desired.

| Current stub | Target route | Device role |
|--------------|--------------|-------------|
| `tablet-pos` `/waiter` | `/waiter` | `WAITER` |
| *(new)* | `/counter` | `COUNTER` |
| `kitchen-display` | `/kitchen` | `KITCHEN` |
| *(new)* | `/customer` | `CUSTOMER` |

`apps/kitchen-display` remains a dev convenience until **F2.1** merges kitchen into the unified app; then deprecate or proxy to `/kitchen`.

---

## 3. Code layout (target)

Introduce incrementally — do not scaffold empty folders ahead of need.

```text
apps/tablet-pos/src/          # hub web app (rename later)
├── main.tsx
├── App.tsx                   # role routes
├── lib/
│   ├── api-client.ts         # fetch wrapper, auth headers, problem JSON
│   ├── auth-storage.ts       # device_token, staff_token in sessionStorage
│   ├── hub-config.ts         # VITE_EDGE_API_URL, WS URL
│   └── format.ts             # money, dates (reuse shared-utils where possible)
├── hooks/
│   ├── useHubStatus.ts
│   ├── useStaffSession.ts
│   └── useHubStream.ts       # WSS /v1/stream (Phase F2+)
├── components/
│   ├── layout/               # shell, nav, suspended banner
│   ├── forms/                # shared inputs, validation messages
│   └── money/                # cents display, tax breakdown rows
├── features/
│   ├── pairing/              # F0.3
│   ├── auth/                 # F0.4 staff PIN
│   ├── setup/                # F1.x admin screens
│   ├── counter/              # F1.11+ takeaway + billing
│   ├── kitchen/              # F2.x KDS
│   └── waiter/               # F3.x table map
└── test/
    ├── setup.ts              # vitest + Testing Library
    └── mocks/                # MSW handlers for hub API
```

**Layer rules**

| Layer | Responsibility | Tests |
|-------|----------------|-------|
| `lib/api-client.ts` | HTTP, headers, error mapping | Unit: problem JSON, 401 retry |
| `hooks/` | Session, polling, stream state | Hook tests with mock client |
| `features/*` | Screens + local UI state | RTL component + user-flow tests |
| `components/` | Presentational, no fetch | Snapshot / interaction tests |

---

## 4. Hub API usage (frontend contract)

All product calls go to edge-server `/v1/*`. Reference for step planning — full doc TBD as `docs/API.md`.

### 4.1 Auth headers

| Header | When |
|--------|------|
| `X-Device-Token` | Every `/v1/*` request after pairing (edge E7.2) |
| `X-Staff-Token` | Setup writes + sensitive ops (edge E7.4) |

Exempt on client: pairing endpoints, `/health`, `/v1/status`.

### 4.2 Error shape

Parse hub problem JSON (`lib/errors.ts` on server):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "…",
    "details": {}
  }
}
```

UI maps `403 FORBIDDEN` (suspended) → read-only banner; block write actions.

### 4.3 Real-time

| Step | Transport | Use |
|------|-----------|-----|
| F1.x | Polling / manual refresh | Counter MVP acceptable |
| F2.3+ | `WSS /v1/stream` | KDS queue, floor updates |

---

## 5. Golden paths (acceptance)

### 5.1 Phase F1 — Counter takeaway (MVP)

```
pair device → staff PIN (ADMIN/COUNTER)
  → setup: zones + menu + billing (minimal)
  → create TAKEAWAY order (zone, customer_name)
  → add lines (zone-priced menu)
  → submit to kitchen
  → bill preview → finalize bill
  → payment (CASH/CARD/OTHER)
  → issue invoice → reprint
```

### 5.2 Phase F2 — Kitchen

```
(counter/waiter submits order)
  → KDS queue shows lines (station filter)
  → mark IN_PROGRESS → PREPARED
  → line leaves queue
```

### 5.3 Phase F3 — Waiter dine-in

```
waiter PIN → zone-filtered table map
  → seat table → add draft lines → submit batch
  → add-on round → bill → pay → invoice
```

---

## 6. Implementation phases

Each **step** = one PR. Complete in order unless a step says it can parallelize.

---

### Phase F0 — App shell & auth

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **F0.1** | Route shell | `/counter`, `/waiter`, `/kitchen`, `/customer` stubs; role redirect from `device_type` (localStorage) | RTL: routes render |
| **F0.2** | API client | `lib/api-client.ts` — base URL, JSON, problem errors, auth headers | Unit: error parse, header injection |
| **F0.3** | Device pairing | Pairing code entry → `POST /v1/devices/pair` → store `device_token` | Flow: success + invalid code |
| **F0.4** | Staff login | PIN pad → `POST /v1/auth/staff/login` → store `staff_token` + staff DTO | Flow: valid PIN, lockout message |
| **F0.5** | Hub status bar | `GET /v1/status` — location name, `hub_status`, `schema_version` | Renders ACTIVE vs SUSPENDED |
| **F0.6** | Test harness | Vitest + Testing Library + MSW; `createTestRender()` helper | Example test green in CI |

**Reusable pieces**

- `api.get/post/patch/put(path, body?)`
- `AuthProvider` — device + staff context
- `SuspendedBanner` — blocks primary actions when `hub_status === 'SUSPENDED'`

**Done when:** unpaired device sees pairing screen; paired + logged-in staff reaches `/counter` home.

---

### Phase F1 — Setup & counter (local only)

Maps to `PLANNING.md` Phase 1. Admin screens live under `/counter/setup/*` (ADMIN + `setup.manage`). Counter ops under `/counter/*`.

#### F1.A — Setup (admin)

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **F1.1** | Zones | List / create / rename / deactivate; `tax_rules` editor (flat % map) | CRUD round-trip against MSW |
| **F1.2** | Staff | List / create / edit role; PIN set on create; never show `pin_hash` | Create waiter + admin |
| **F1.3** | Categories | `GET/POST/PATCH /v1/menu/categories` | Active/inactive toggle |
| **F1.4** | Tags | Tag list + create; duplicate code shows hub error | 409 message surfaced |
| **F1.5** | Menu items | Item list (by category), create/edit name + base price | Empty menu state |
| **F1.6** | Modifiers | Modifier groups (item scope) + options with price extras | Add option, price reflected in preview |
| **F1.7** | Zone prices | Grid: items × zones → `PUT /v1/menu/items/:id/zone-prices` | Cell edit + fallback to base |
| **F1.8** | Billing config | Tax rules, `price_tax_mode`, service charge, tip quick actions | Validation error for nested tax JSON |
| **F1.9** | Tables | Table list by zone; create label + capacity; basic `pos_x/y` | Zone FK error handling |
| **F1.10** | Printers | Printer list + roles; print config GET/PUT (ordering/kitchen/collection) | Save/load stages JSON |

**Parallelize after F1.3:** F1.4–F1.6 (menu) can ship in sequence; F1.9 tables can parallel F1.7 if different authors.

#### F1.B — Counter operations (takeaway MVP)

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **F1.11** | New takeaway | Form: zone, customer name → `POST /v1/orders` | 201 + order id |
| **F1.12** | Menu picker | Browse items for order zone; add line with qty | Line appears with snapshotted price |
| **F1.13** | Order detail | `GET /v1/orders/:id` — lines, running subtotal | Draft lines editable |
| **F1.14** | Submit | `POST /v1/orders/:id/submit` — token issued | Token displayed (e.g. `T-001`) |
| **F1.15** | Bill | Preview → `POST /v1/orders/:id/bill` — lock totals | Discount/tip inputs (optional MVP) |
| **F1.16** | Pay | Tender select → `POST /v1/orders/:id/payments` | Order status PAID |
| **F1.17** | Invoice | Issue + `GET /v1/invoices/:id` reprint; show tax breakdown + business header | Snapshot fields visible |

**F1 MVP done when:** counter completes §5.1 golden path against Docker dev stack without curl.

---

### Phase F2 — Kitchen, printing & customer views

Maps to `PLANNING.md` Phase 2. Kitchen UI primarily on `/kitchen`.

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **F2.1** | KDS queue | Station selector → `GET /v1/kds/queue?station_id=` | FIFO list, dine-in vs takeaway badge |
| **F2.2** | Line actions | Tap → `PATCH /v1/kds/lines/:id/status` (`IN_PROGRESS`, `PREPARED`) | Valid transitions only |
| **F2.3** | Live stream | `useHubStream` — refresh queue on `order.submitted` / line events | WS mock pushes update |
| **F2.4** | Ticket detail | Modifiers, special instructions, token/table ref | Renders snapshot fields |
| **F2.5** | Print trigger | After submit — `POST /v1/print-jobs` (kitchen stage) | Job id returned; status poll UI stub |
| **F2.6** | Customer display | `/customer` — takeaway pipeline read-only (`fulfillment_status`) | Status labels match §5.4 |
| **F2.7** | Collection print | Counter “ready for pickup” → collection print job | Config respects print stages |

**Done when:** submit from counter → ticket on KDS → PREPARED clears line → customer display updates.

---

### Phase F3 — Waiter view, table ops & billing

Maps to `PLANNING.md` Phase 3. Primary route: `/waiter`.

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **F3.1** | Zone filter | Table map from `assigned_zone_ids` | Waiter sees subset only |
| **F3.2** | Table map | `GET /v1/tables?zone_id=` — status colors, select table | AVAILABLE / OCCUPIED |
| **F3.3** | Dine-in order | Open order on seat; `zone_id` from table | Dine-in validation |
| **F3.4** | Draft lines | Add / edit qty / delete draft lines | Submitted lines read-only |
| **F3.5** | Submit batch | Submit only draft lines; show `submit_batch` | Add-on round test |
| **F3.6** | Unstage queued | Edit line while `QUEUED` (pre-`IN_PROGRESS`) | Hidden from KDS after unstage |
| **F3.7** | Bill + pay | Same as F1.15–F1.17 on dine-in order | Invoice with table context |
| **F3.8** | Transfer table | UI + hub API when table-transfer endpoint exists | Defer if backend not ready |
| **F3.9** | 86 / recall | Surface kitchen recall alert via stream | Waiter cancel flow |

**Note:** F3.8 depends on edge-server table-transfer API (post-MVP in edge roadmap). Keep UI stubbed until backend lands.

---

### Phase F4 — Suspended mode & archive UI

| Step | PR scope | Deliverables | Tests |
|------|----------|--------------|-------|
| **F4.1** | Read-only mode | Global write guard in API client + UI disable | POST returns 403 → toast |
| **F4.2** | Invoice archive | Browse paid orders / reprint invoices when suspended | GET invoice works |
| **F4.3** | Export trigger | Button → `GET /v1/export/full` download JSON | File download in browser |

Maps to edge E10 + `PLANNING.md` suspended archive UX.

---

## 7. Suggested PR sequence (first 12 PRs)

Start here — each independently demoable:

1. **F0.1** — Route shell (`/counter`, `/waiter`, …)  
2. **F0.2** — API client + problem JSON  
3. **F0.3** — Device pairing  
4. **F0.4** — Staff PIN login  
5. **F0.6** — Vitest + MSW harness  
6. **F1.1** — Zones setup  
7. **F1.5** — Menu items list (read-only counter menu first)  
8. **F1.11** — Create takeaway order  
9. **F1.12** — Add lines  
10. **F1.14** — Submit + token  
11. **F1.15–F1.17** — Bill → pay → invoice (one PR or three small)  
12. **F2.1** — KDS queue (then merge `kitchen-display` into app)

Kitchen and full setup screens intentionally come **after** a takeaway order works end-to-end.

---

## 8. Testing conventions

| Type | Tool | Required per step |
|------|------|-------------------|
| Unit | Vitest | API client, formatters, reducers |
| Component | Testing Library | Forms, lists, error states |
| Flow | MSW + RTL | Pairing, login, one happy-path screen |
| E2E (later) | Playwright optional | Full golden path in Docker dev |

Run locally:

```bash
pnpm --filter @table-stream/tablet-pos typecheck
pnpm --filter @table-stream/tablet-pos test    # after F0.6 adds vitest
make check                                     # monorepo gate
```

Commit tags: `feat(front):`, `test(front):`, `chore(front):`

---

## 9. Out of scope for this roadmap

- `apps/cloud-dashboard` — subscriptions, org admin, sync ledger (`PLANNING.md` Phase 4–5)
- PowerSync / offline SQLite on tablets — hub REST remains contract
- mDNS discovery UI — manual hub URL entry for MVP (pairing stores URL)
- ESC/POS driver integration — print job enqueue only until print service exists
- Merge/split table edge cases — `PLANNING.md` §9.7; after F3 core
- Per-item tax classes — post-MVP (zone tax only, edge E11)

---

## 10. Definition of done (hub web Phase F1)

- [ ] Device pairs and staff logs in on LAN dev stack
- [ ] Admin can configure zones, menu (minimal), billing tax rules
- [ ] Counter completes takeaway: create → lines → submit → bill → pay → invoice
- [ ] SUSPENDED hub shows banner; invoice reprint + export still work
- [ ] `pnpm --filter @table-stream/tablet-pos test` green; `make check` green on Node 22

---

## 11. Related docs (to add)

| Doc | Purpose | Owner step |
|-----|---------|------------|
| `docs/API.md` | REST + WSS reference per view | Before F1.11 (or parallel F0.2) |
| Wireframes | `/counter/setup`, takeaway flow | Before F1.11 |
| `docs/KITCHEN-ROADMAP.md` | *(optional split if F2 grows)* | Only if F2 steps exceed ~10 PRs |

---

## 12. Refinement log

| Date | Change |
|------|--------|
| 2026-07-23 | Initial hub web roadmap — F0 shell, F1 setup+counter, F2 kitchen, F3 waiter, F4 suspended UI |
| 2026-07-23 | Edge-server E0–E11 complete; tax snapshot fix PR #31 — frontend can assume frozen invoice tax |
