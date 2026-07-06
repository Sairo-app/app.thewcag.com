# syntax=docker/dockerfile:1
# Multi-stage build for the standalone Next.js server (Coolify/Docker).
# Build context must be the MONOREPO ROOT (accessibility-build-app), so the
# workspace + packages/a11y-core resolve. In Coolify set:
#   Build Pack: Dockerfile
#   Dockerfile Location: apps/web/Dockerfile
#   Base Directory: /
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/a11y-core/package.json packages/a11y-core/
RUN pnpm install --filter @thewcag/web... --frozen-lockfile=false

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @thewcag/web build

# --- runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3100
WORKDIR /app
# Standalone (traced from the monorepo root) bundles the server, node_modules
# and packages. Server lives at apps/web/server.js; static + public sit beside it.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3100
# Migrations run inside the server on boot (see instrumentation.ts).
CMD ["node", "apps/web/server.js"]
