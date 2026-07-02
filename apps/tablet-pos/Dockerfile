FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY apps/tablet-pos/package.json ./apps/tablet-pos/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
ARG VITE_EDGE_API_URL=http://localhost:8443
ENV VITE_EDGE_API_URL=$VITE_EDGE_API_URL
COPY packages ./packages
COPY apps/tablet-pos ./apps/tablet-pos
RUN pnpm --filter @table-stream/shared-types build \
  && pnpm --filter @table-stream/shared-utils build \
  && pnpm --filter @table-stream/tablet-pos build

FROM nginx:alpine AS runner
COPY apps/tablet-pos/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/tablet-pos/dist /usr/share/nginx/html
EXPOSE 80
