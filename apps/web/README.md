# app.thewcag.com

This package is the website, account service, and report-sharing backend for the TheWCAG desktop auditor. It combines public product and accessibility content with passwordless accounts, desktop device authorization, report storage, white-label presentation, and administration.

The canonical monorepo setup, architecture, environment, quality, deployment, and release instructions live in the [root README](../../README.md). This file documents the web package specifically.

## Stack

- Next.js 15 App Router and React 19
- Auth.js v5 with the Drizzle adapter and Resend magic links
- Drizzle ORM and Postgres 16
- Cloudflare R2 through its S3-compatible API
- Tailwind CSS 4
- Standalone Docker output for Coolify

## Responsibilities

- Render the marketing homepage, download page, product guides, WCAG/APCA educational pages, and accessibility statement.
- Authenticate browser users through one-time email links.
- Authorize desktop installations and return a `thewcag://auth` deep link.
- Verify revocable desktop bearer tokens.
- Accept annotated PNG reports, enforce input and storage limits, write images to R2, and write metadata to Postgres.
- Render public unlisted reports at `/s/[slug]` and manage an owner's reports at `/screenshots`.
- Store and apply optional white-label organization name, accent, and logo.
- Provide a hidden, email-allowlisted admin area for users, devices, reports, views, and storage.
- Resolve stable download URLs to the newest platform-specific GitHub release asset.

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/` and content pages | Public | Product, download, WCAG, APCA, CVD, alt-text, screenshot, and accessibility content. |
| `/signin`, `/signin/check` | Public | Request and confirm a magic-link sign-in. |
| `/connect` | Signed-in browser user | Authorize a desktop device and return to the app through `thewcag://auth`. |
| `/screenshots` | Signed-in owner | List, copy, and delete published screenshots. |
| `/brand` | Signed-in owner | Configure report logo, organization name, and accent color. |
| `/s/[slug]` | Public, unlisted | View a published accessibility report. |
| `/admin`, `/admin/users`, `/admin/reports` | `ADMIN_EMAILS` only | Platform metrics and destructive administration. |
| `GET /api/device/entitlements` | Desktop bearer token | Return device identity, publish feature status, and storage use/quota. |
| `POST /api/device/screenshots` | Desktop bearer token | Validate and publish a PNG report to R2 and Postgres. |
| `GET /api/s/[slug]/image` | Public | Redirect to the R2 CDN or stream the report image. |
| `GET /api/brand/[id]/logo` | Public | Redirect to or stream the report owner's logo. |
| `GET /api/desktop/download` | Public | Redirect to the latest macOS or Windows GitHub release asset. |
| `/api/auth/[...nextauth]` | Auth.js | Auth.js request handling. |

Public report pages are marked `noindex`. The sitemap contains only indexable marketing and guide pages; robots output excludes API, auth, account, and admin routes.

## Environment

Copy `.env.example` to `.env.local`. Required variables and local service values are documented in the [root README](../../README.md#environment-variables).

In development, an absent `AUTH_RESEND_KEY` causes the magic link to be printed to the server console. R2 configuration is validated on first object operation. `R2_PUBLIC_URL` is optional: when configured, image routes redirect to the CDN; otherwise they stream from the S3-compatible service.

## Local services

From the monorepo root:

```sh
docker compose -f apps/web/docker-compose.dev.yml up -d
```

Then, from this directory:

```sh
node --env-file=.env.local scripts/dev-bucket.mjs
pnpm dev
```

Postgres is exposed on `localhost:5433`; MinIO uses `localhost:9000` for S3 and `localhost:9001` for its console. The website runs on `localhost:3100`.

Useful scripts:

```sh
node --env-file=.env.local scripts/verify-r2.mjs
node --env-file=.env.local scripts/dev-seed.mjs
pnpm db:generate
```

The active development and production startup path runs the embedded idempotent migration from `instrumentation.ts` and `lib/migrate.ts`. `pnpm db:generate` is schema-development tooling; do not substitute an unreviewed generated migration for the startup path. If the schema changes, update `lib/schema.ts`, add the appropriate Drizzle migration, and mirror the additive operation in `lib/migrate.ts`.

## Storage and limits

- Report images and brand logos are R2 objects.
- Users, Auth.js records, device-token hashes, report metadata, branding, byte counts, and views are Postgres rows.
- Published images must be valid PNG data and no larger than 4 MB.
- A report accepts up to 100 issue objects, a 140-character title, and a 500-character description.
- Each user has a 1 GiB report-image quota.
- Brand logos accept PNG, JPEG, WEBP, or SVG and must be under 1 MB.
- Owner/admin deletion removes both metadata and the corresponding R2 object.

## Production

Use the root `docker-compose.yaml` as the Coolify Docker Compose resource. Route `app.thewcag.com` to the `web` service on port `3100`. The service waits for Postgres health, runs migrations during server startup, and exposes its own HTTP health check.

Coolify generates the Postgres password and Auth.js secret through its service variables. Configure Resend and R2 credentials explicitly. Set `ADMIN_EMAILS` only for accounts that should see the administration surface.

Build and verify from the monorepo root:

```sh
pnpm --filter @thewcag/web typecheck
pnpm --filter @thewcag/web build
docker compose up --build
```
