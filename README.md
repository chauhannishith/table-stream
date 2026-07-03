# Table Stream

Local-first restaurant POS monorepo: Turborepo + pnpm workspaces, strict TypeScript, Fastify edge hub, SQLite + Redis on LAN, PostgreSQL cloud ledger, PowerSync-style WAL replication.

## Repository layout

```text
table-stream/
├── apps/
│   ├── edge-server/         # Fastify hub gateway (SQLite + Redis)
│   ├── tablet-pos/          # Waiter touch UI (Vite)
│   ├── kitchen-display/     # Kitchen line (Vite + WebSocket stream)
│   └── cloud-dashboard/     # Back-office admin (Next.js + Postgres)
├── packages/
│   ├── shared-types/        # Drizzle schemas, enums, state machines
│   └── shared-utils/        # Tax and billing math
├── docker/                  # Postgres init, PowerSync config
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- Node.js 22+ and pnpm 9+ (optional, for local non-Docker dev)

## Quick start (Docker)

1. Copy environment template:

   ```bash
   cp .env.example .env
   ```

2. Start the full stack (production-like images):

   ```bash
   pnpm docker:up
   # or: docker compose up --build
   ```

3. Open services:

   | Service          | URL                          |
   |------------------|------------------------------|
   | Edge hub API     | http://localhost:8443/health |
   | Cloud dashboard  | http://localhost:3000        |
   | Cloud health     | http://localhost:3000/api/health |
   | Tablet POS       | http://localhost:5173        |
   | Kitchen display  | http://localhost:5174        |
   | PowerSync        | http://localhost:8080        |
   | PostgreSQL       | localhost:5432               |
   | Redis            | localhost:6379               |

## Development mode (hot reload)

```bash
pnpm docker:dev
```

Mounts source trees and runs `pnpm dev` inside Node containers for edge-server, cloud-dashboard, tablet-pos, and kitchen-display. Postgres and Redis use the same base compose file.

PowerSync is disabled in dev by default (`profiles: [sync]`). Enable with:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile sync up
```

## Hub configuration

Edit `apps/edge-server/hub.config.yaml` before first boot. Demo values match the seed data in `docker/postgres/init.sql`.

Hub SQLite lives in the Docker volume `hub_data` at `/var/lib/tablestream/hub.sqlite`.

## Database schemas

| Store    | Engine     | Definition                                      |
|----------|------------|-------------------------------------------------|
| Hub      | SQLite     | `packages/shared-types/src/hub/schema.ts`       |
| Cloud    | PostgreSQL | `packages/shared-types/src/cloud/schema.ts`       |
| Sync     | PowerSync  | `packages/shared-types/src/sync/powersync.ts`   |

Hub migrations: `apps/edge-server/src/db/migrations/0001_initial.sql`

Cloud DDL: `docker/postgres/init.sql` (applied on first Postgres boot)

## Local development (without Docker)

```bash
pnpm install
pnpm build
pnpm dev
```

Requires local Redis and PostgreSQL, or run only infrastructure:

```bash
docker compose up postgres redis
```

## Scripts

| Script           | Description                    |
|------------------|--------------------------------|
| `make check`     | Typecheck + lint + test (local) |
| `pnpm build`     | Turborepo build all packages   |
| `pnpm dev`       | Turborepo dev (all apps)       |
| `pnpm typecheck` | Strict TypeScript check        |
| `pnpm docker:up` | Docker Compose production-like |
| `pnpm docker:dev`| Docker Compose with hot reload |
