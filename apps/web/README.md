# app.thewcag.com

The account &amp; sharing backend for the TheWCAG desktop app. It does exactly
two things:

1. **Authenticate the app** — magic-link email sign-in (Auth.js + Resend);
   the app exchanges a browser session for a device token it stores in the
   macOS Keychain.
2. **Store &amp; share reports** — annotated report images go to Cloudflare R2,
   metadata to Postgres, served at public `app.thewcag.com/reports/<slug>`
   links with social-preview cards.

## Stack

Next.js 15 (standalone) · Auth.js v5 (Resend magic link) · Drizzle + Postgres
(metadata + auth) · Cloudflare R2 (image blobs). Deployed via Docker/Coolify.

## Environment

Copy `.env.example` and fill in:

- `NEXT_PUBLIC_APP_URL` — `https://app.thewcag.com`
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM` — [Resend](https://resend.com) magic-link email
- `DATABASE_URL` — Postgres
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare R2

## Database

```sh
# from apps/web, with DATABASE_URL set
pnpm db:migrate        # applies drizzle/0000_init.sql
```

## Deploy (Coolify)

- New resource → **Dockerfile**
- **Dockerfile Location**: `apps/web/Dockerfile`
- **Base Directory**: `/` (build context = monorepo root, so packages resolve)
- Port: `3100`
- Set the env vars above; point `app.thewcag.com` at the service.

## Cloudflare R2 (image storage)

Screenshot images live entirely in R2; only metadata is in Postgres.

1. **Create a bucket** (e.g. `thewcag-reports`).
2. **API token**: R2 → Manage API Tokens → create a token with **Object Read &
   Write** scoped to the bucket. Set `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
   and `R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`.
3. **Public access for reads** (so Cloudflare's CDN serves images, not the app):
   - Best: connect a **custom domain** (e.g. `cdn.thewcag.com`) to the bucket,
     then set `R2_PUBLIC_URL=https://cdn.thewcag.com`.
   - Or enable the managed **r2.dev** URL and set `R2_PUBLIC_URL` to it.
   - No CORS config is needed (images are used via `<img>` and `og:image`).

How it works: writes and deletes go through the S3 API (`lib/r2.ts`); reads go
through `/api/s/[slug]/image`, which **302-redirects to `R2_PUBLIC_URL`** so the
bytes come from Cloudflare, never the app server. `og:image` points straight at
the CDN URL. If `R2_PUBLIC_URL` is unset (local dev), the route streams the
object instead. The client is validated at first use and fails fast with a
clear error if any R2 var is missing.

## Routes

| Route | Purpose |
|---|---|
| `/signin`, `/signin/check` | magic-link sign-in |
| `/connect` | device authorization → `thewcag://auth?token=…` deep link |
| `POST /api/device/reports` | publish (bearer device token) → R2 + metadata |
| `GET /api/device/entitlements` | who am I (bearer) |
| `GET /api/reports/[slug]/image` | stream image from R2 |
| `/reports/[slug]` | public share page (OG cards) |
| `/reports` | my shared reports (manage / delete) |
| `/downloads/desktop/latest.json` | desktop updater manifest (no-cache) |
