FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY apps/edge-server/package.json ./apps/edge-server/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY packages ./packages
COPY apps/edge-server ./apps/edge-server
RUN pnpm --filter @table-stream/shared-types build \
  && pnpm --filter @table-stream/shared-utils build \
  && pnpm --filter @table-stream/edge-server build

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app/apps/edge-server
EXPOSE 8443
VOLUME ["/var/lib/tablestream"]
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
