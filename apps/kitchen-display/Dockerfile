FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/kitchen-display/package.json ./apps/kitchen-display/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
ARG VITE_EDGE_WS_URL=ws://localhost:8443/v1/stream
ENV VITE_EDGE_WS_URL=$VITE_EDGE_WS_URL
COPY packages ./packages
COPY apps/kitchen-display ./apps/kitchen-display
RUN pnpm --filter @table-stream/shared-types build \
  && pnpm --filter @table-stream/kitchen-display build

FROM nginx:alpine AS runner
COPY apps/kitchen-display/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/kitchen-display/dist /usr/share/nginx/html
EXPOSE 80
