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

# --- build ---
# Install and build in one stage. pnpm workspaces put each package's binaries
# in <pkg>/node_modules/.bin (e.g. apps/web/node_modules/.bin/next), so deps
# MUST be installed in the same stage that runs the build - copying only the
# root node_modules from a separate deps stage leaves `next` unresolved.
# Manifests are copied first so the install layer caches until they change.
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/a11y-core/package.json packages/a11y-core/
COPY packages/audit-contracts/package.json packages/audit-contracts/
RUN pnpm install --filter @thewcag/web... --frozen-lockfile
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @thewcag/web build

# --- runtime ---
FROM base AS runner
RUN addgroup --system --gid 1001 app \
  && adduser --system --uid 1001 --ingroup app app
ENV NODE_ENV=production
ENV PORT=3100
# Bind to all interfaces so Coolify's reverse proxy (Traefik, on the docker
# network) can reach the server. Without this, Next's standalone server can
# bind to localhost only -> Traefik returns "503 no available server".
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# Standalone (traced from the monorepo root) bundles the server, node_modules
# and packages. Server lives at apps/web/server.js; static + public sit beside it.
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public
COPY --from=build --chown=app:app /app/apps/web/drizzle ./apps/web/drizzle
COPY --from=build --chown=app:app /app/apps/web/scripts/migrate.mjs ./apps/web/scripts/migrate.mjs
USER app
EXPOSE 3100
# Apply versioned migrations before the application process receives traffic.
CMD ["sh", "-c", "node apps/web/scripts/migrate.mjs && exec node apps/web/server.js"]
