FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/cloud-dashboard/package.json ./apps/cloud-dashboard/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY packages/shared-types ./packages/shared-types
COPY apps/cloud-dashboard ./apps/cloud-dashboard
RUN pnpm --filter @table-stream/shared-types build \
  && pnpm --filter @table-stream/cloud-dashboard build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/cloud-dashboard/.next/standalone ./
COPY --from=build /app/apps/cloud-dashboard/.next/static ./apps/cloud-dashboard/.next/static
COPY --from=build /app/apps/cloud-dashboard/public ./apps/cloud-dashboard/public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/cloud-dashboard/server.js"]
