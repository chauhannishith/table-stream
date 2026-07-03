# Table Stream — agent guide

Read `.cursor/skills/table-stream/SKILL.md` first for repo conventions, layer ownership, and commit tags.

Quick reference:

- **Monorepo:** pnpm workspaces + Turborepo (`apps/*`, `packages/*`)
- **Node:** 22+ (see `.nvmrc`)
- **Local verify:** `make check` (typecheck + lint + test)
- **Docker dev:** `make dev`
- **Planning:** `docs/PLANNING.md` is the product/architecture spec
- **Schemas:** `packages/shared-types/src/hub/schema.ts` (edge), `cloud/schema.ts` (ledger)
- **Commit areas:** `front` | `back` | `db` | `middleware` | `infra` | `monorepo`

Do not run `pnpm install` or start servers unless the user asks.
