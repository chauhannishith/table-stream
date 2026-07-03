---
name: table-stream
description: >-
  Table Stream monorepo conventions — local-first restaurant POS. Use when working
  in this repo on architecture, Docker, schemas, commits, or app boundaries.
---

# Table Stream

Local-first restaurant POS. One **edge hub** per location (Fastify + SQLite + Redis). Optional cloud ledger (Postgres). Floor devices are LAN clients.

## Repository map

| Path | Layer | Role |
|------|-------|------|
| `apps/edge-server` | back | Hub gateway, SQLite, Redis, migrations |
| `apps/tablet-pos` | front | Waiter touch UI (Vite) |
| `apps/kitchen-display` | front | KDS (Vite + WebSocket) |
| `apps/cloud-dashboard` | front | Admin / analytics (Next.js + Postgres) |
| `packages/shared-types` | db | Drizzle schemas, enums, Zod contracts |
| `packages/shared-utils` | back | Tax and billing math |
| `docker/` | infra | Postgres init, PowerSync config |

Deep spec: `docs/PLANNING.md`

## Commands

```bash
make check      # typecheck + lint + test (no Docker)
make dev        # Docker Compose hot reload
make up         # production-like Docker stack
pnpm build      # Turborepo build all
```

Node 22+ required (`.nvmrc`). Copy `.env.example` → `.env` before Docker.

## Docker compose files

- `docker-compose.yml` — base services
- `docker-compose.dev.yml` — Vite/Fastify hot reload ports
- `docker-compose.prod.yml` — nginx frontend port mappings for `make up`

Do not use YAML merge tags (`!override`) — split prod/dev port files instead.

## Data rules

- **Hub-authoritative:** orders, order_lines, payments, invoices, menu catalog
- **Cloud ledger:** subscriptions, business profile, sync_records, reporting facts
- **Order snapshots:** prices, modifiers, tags copied onto `order_lines` at line-add time — catalog price changes never alter past orders
- **Menu catalog:** `menu_categories`, `menu_tags`, `modifier_groups`, `modifier_options`

## Code conventions

- Strict TypeScript; project references use `"composite": true` in packages
- Next.js imports: no `.js` suffix (`import x from '../lib/db'`)
- Node ESM apps: `.js` suffix in relative imports is OK
- Prefer smallest diff; one logical change per commit
- Commit tags: `feat(back):`, `feat(front):`, `feat(db):`, `feat(middleware):`, `chore(infra):`

## Health endpoints

| Service | URL |
|---------|-----|
| Edge hub | `GET /health` |
| Cloud dashboard | `GET /api/health` |

## Do not

- Run `pnpm install` or servers unless the user asks
- Commit `.env` (only `.env.example`)
- Recalculate historical order line prices from live catalog
