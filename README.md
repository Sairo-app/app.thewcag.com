# TheWCAG

TheWCAG is a production-oriented accessibility auditing workspace for macOS and Windows. It checks colors anywhere on screen, captures and annotates interface evidence, organizes WCAG 2.2 findings, and publishes client-ready reports through a companion web platform.

[![Release](https://img.shields.io/github/v/release/Sairo-app/app.thewcag.com?label=release)](https://github.com/Sairo-app/app.thewcag.com/releases/latest)
[![Quality checks](https://github.com/Sairo-app/app.thewcag.com/actions/workflows/quality.yml/badge.svg)](https://github.com/Sairo-app/app.thewcag.com/actions/workflows/quality.yml)
![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-2563eb)
![WCAG](https://img.shields.io/badge/audit-WCAG%202.2%20A%2FAA-c2410c)

## Product capabilities

### Desktop auditor

| Capability | What it provides |
|---|---|
| On-screen contrast picker | Samples foreground and background pixels from any application, displays the WCAG 2.x ratio and AA/AAA verdicts, reports signed APCA Lc, detects anti-aliased edges, and suggests nearby passing colors. A dragged background region finds the worst-contrast pixel across gradients or imagery. |
| Capture and annotation | Captures a region or full screen into a re-editable local document. Tools include issue badges, arrows, boxes, target measurement, contrast probes, focus-order markers, solid or pixel redaction, text, and non-destructive crop-to-new-capture. |
| Color-vision lens | Shows the screen beneath a floating always-on-top window with protanopia, deuteranopia, tritanopia, or achromatopsia simulation, adjustable severity, split view, freeze, low-acuity blur, low-contrast simulation, and PNG export. |
| Audit workspace | Stores project, target, scope, WCAG 2.2 A/AA standard, evaluator, and start date so findings and checklist exports carry the correct engagement context. |
| Findings register | Combines annotated and manual issues with WCAG criterion, severity, status, notes, search, filtering, and CSV, Markdown, or standalone HTML exports. |
| WCAG checklist | Tracks all 55 WCAG 2.2 Level A and AA criteria by POUR principle with pass, fail, not applicable, notes, progress, filters, and contextual CSV, Markdown, or HTML exports. |
| Palette matrix | Accepts up to 16 hex colors, persists the palette, calculates every foreground/background pair, visualizes AA-normal and AA-large/UI thresholds, and copies the matrix as CSV. |
| Evidence and reporting | Exports annotated PNGs, one-page finding sheets, Markdown, Jira markup, session logs, and shareable web reports. Exported annotation issues are merged into the findings register without overwriting later triage edits. |
| Capture library and settings | Keeps the 24 most recent captures locally with editable source data and annotated thumbnails. Includes remappable global shortcuts, launch-at-login, update installation, screen-permission guidance, and a tray/menu-bar workflow. |

Default global shortcuts are:

| Action | macOS | Windows |
|---|---:|---:|
| Check contrast | `⌥⌘P` | `Ctrl+Alt+P` |
| Capture and annotate | `⌥⌘S` | `Ctrl+Alt+S` |
| Toggle color-vision lens | `⌥⌘L` | `Ctrl+Alt+L` |

All three shortcuts can be changed in the application. The tray also exposes delayed contrast and capture modes for hover states, full-screen capture, target measurement, auditor tools, and application controls.

### Web platform

The Next.js application at [app.thewcag.com](https://app.thewcag.com) provides:

- Product, download, WCAG, APCA, color-vision, alt-text, screenshot-workflow, and accessibility-statement pages with canonical metadata, structured data, a sitemap, and robots controls.
- Passwordless Auth.js sign-in through Resend magic links.
- Browser-mediated desktop authorization using the `thewcag://` deep link.
- Bearer-authenticated report publishing from the desktop app.
- Public, unlisted report pages at `/s/[slug]`, with annotated screenshots, structured findings, severity summaries, view counts, social previews, and optional white-label branding.
- An authenticated screenshot library with link copying and deletion.
- Per-account logo, organization name, and accent-color branding.
- A protected admin area for platform metrics, users, devices, reports, storage, and destructive cleanup.
- Stable, platform-aware redirects to the latest GitHub release assets.

An account is required to publish and manage a report. Anyone with its link can view it without signing in. Captures remain on the local machine unless the user explicitly publishes one.

## System architecture

```mermaid
flowchart LR
    Core["a11y-core<br/>WCAG, APCA, formats, CVD"] --> DesktopUI["React desktop windows"]
    DesktopUI <--> IPC["Typed Tauri IPC and events"]
    IPC <--> Native["Rust native layer<br/>capture, overlay, lens, storage, tray"]
    Native <--> OS["macOS and Windows APIs"]

    Native -->|"system browser"| Connect["Next.js /connect"]
    Connect -->|"thewcag:// auth callback"| Native
    Native -->|"bearer API"| Web["Next.js device and report APIs"]
    Web <--> Postgres["Postgres<br/>auth, devices, report metadata"]
    Web <--> R2["Cloudflare R2<br/>report images and logos"]
    Web --> Public["Public /s/[slug] report"]
```

The accessibility core is intentionally framework-independent and currently consumed by the desktop app. It can be reused by web surfaces without bringing Tauri or DOM dependencies into the package.

### Desktop runtime

The desktop application uses one React bundle for multiple native windows. `apps/desktop/src/main.tsx` selects the UI from the current Tauri window label:

- `main`: audit workspace, contrast results, recent captures, account, settings, and session log.
- `overlay-*`: one frozen full-screen capture overlay per monitor.
- `annotate`: re-editable screenshot editor and report publisher.
- `lens`: live color-vision and low-vision simulation.
- `countdown`: passive delayed-capture HUD.
- `findings`, `checklist`, `palette`: standalone auditor tools.

Native commands are implemented in Rust and registered in `apps/desktop/src-tauri/src/lib.rs`; typed frontend calls and events live in `apps/desktop/src/lib/ipc.ts`. Tool windows are created hidden and revealed after React commits to prevent unpainted native-window flashes.

### Data and trust boundaries

- Desktop captures are stored in the OS application-data directory as a raw PNG, an editable JSON annotation document, and an annotated thumbnail.
- Audit context, findings, checklist results, palettes, and other application state are local JSON files.
- The desktop device token is stored in macOS Keychain or Windows Credential Manager. Only its SHA-256 hash is stored in Postgres.
- Published PNGs and brand logos live in Cloudflare R2. Postgres stores identity, sessions, device records, report metadata, issues, sizes, branding, and view counts.
- A published image is limited to 4 MB, a report to 100 issue rows, and each user to 1 GiB of stored report images.
- R2 objects are removed when owners or administrators delete reports. User deletion also purges owned reports and branding objects.

## Repository layout

```text
accessibility-build-app/
├── apps/
│   ├── desktop/                 Tauri 2 desktop application
│   │   ├── src/                 React windows, IPC wrappers, annotation model
│   │   └── src-tauri/           Rust native layer, capabilities, bundle config
│   └── web/                     Next.js website, API, auth, admin, and data layer
├── packages/
│   └── a11y-core/               Pure TypeScript accessibility calculations
├── scripts/                     Desktop icons and updater-manifest tooling
├── docs/                        Release and platform migration notes
├── .github/workflows/           Quality and signed release automation
├── docker-compose.yaml          Production Postgres and web stack
├── SKILL.md                     Repository-specific agent workflow
├── CHANGELOG.md                 Release history and unreleased changes
└── PLAN.md                      Historical original product plan
```

Important source maps:

| Concern | Location |
|---|---|
| Desktop window routing | `apps/desktop/src/main.tsx` |
| Main auditor workspace | `apps/desktop/src/windows/MainWindow.tsx` |
| Capture overlay | `apps/desktop/src/windows/OverlayWindow.tsx`, `src-tauri/src/overlay.rs` |
| Annotation editor | `apps/desktop/src/windows/AnnotateWindow.tsx`, `src/lib/annotate/` |
| Color-vision lens | `apps/desktop/src/windows/LensWindow.tsx`, `src-tauri/src/lens.rs` |
| Native IPC registration | `apps/desktop/src-tauri/src/lib.rs` |
| Local capture library | `apps/desktop/src-tauri/src/library.rs` |
| Desktop/web authentication | `apps/desktop/src-tauri/src/auth.rs`, `apps/web/app/connect/`, `apps/web/lib/device-auth.ts` |
| Report publishing | `apps/web/app/api/device/screenshots/route.ts` |
| Database model and startup migration | `apps/web/lib/schema.ts`, `apps/web/lib/migrate.ts` |
| R2 and quota enforcement | `apps/web/lib/r2.ts`, `apps/web/lib/quota.ts` |
| Release pipeline | `.github/workflows/release.yml`, `scripts/make-latest-json.mjs`, `scripts/merge-latest-json.mjs` |

## Requirements

- Node.js 22 or later
- pnpm 9.15.4 through Corepack
- Rust stable and Cargo
- Git
- macOS: Xcode Command Line Tools and macOS 12 Monterey or later
- Windows: 64-bit Windows 10 or 11, Microsoft C++ Build Tools, and WebView2
- Web data features: Docker Desktop or access to Postgres and S3-compatible object storage

## Install

```sh
corepack enable
pnpm install --frozen-lockfile
```

The workspace lockfile is committed. Use a frozen install in CI and when validating a clean checkout.

## Development

### Desktop application

Start the native application:

```sh
pnpm dev
```

This runs `tauri dev`, which starts Vite on port `5173`, builds the Rust application, and opens the native shell.

For browser-only responsive and accessibility inspection:

```sh
pnpm --filter @accessibility-build/desktop dev:vite
```

Open `http://localhost:5173/?view=main`. Other previewable views include `findings`, `checklist`, `palette`, `annotate`, `lens`, and `countdown`. Native IPC actions do not operate outside Tauri; the preview exists for rendered UI inspection.

macOS prompts for Screen Recording access when capture is first used. After granting it in System Settings, restart the application so the new process receives the permission. Windows does not use this permission flow.

### Website without full infrastructure

Copy the example and start Next.js:

```sh
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @thewcag/web dev
```

The site runs on [http://localhost:3100](http://localhost:3100). For public-content-only work, remove the placeholder `DATABASE_URL` from `.env.local` and leave the R2 credentials empty; this prevents the development server from attempting unavailable services. Authentication, account, admin, branding, and report routes require the services below. When `AUTH_RESEND_KEY` is empty in development, magic sign-in links are printed to the server console.

### Full local web stack

Start Postgres 16 and MinIO:

```sh
docker compose -f apps/web/docker-compose.dev.yml up -d
```

Use these local values in `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3100
AUTH_SECRET=replace-with-a-local-random-secret
AUTH_EMAIL_FROM="TheWCAG <login@thewcag.local>"
DATABASE_URL=postgres://postgres:postgres@localhost:5433/thewcag
R2_ENDPOINT=http://localhost:9000
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin
R2_BUCKET=thewcag-reports
R2_PUBLIC_URL=http://localhost:9000/thewcag-reports
ADMIN_EMAILS=
```

Create the development bucket, then start the website:

```sh
cd apps/web
node --env-file=.env.local scripts/dev-bucket.mjs
pnpm dev
```

The Next instrumentation hook applies the idempotent schema on server startup when `DATABASE_URL` is set. Production fails startup if migration fails; development logs the failure and keeps static UI work available.

Optional storage verification and sample data:

```sh
cd apps/web
node --env-file=.env.local scripts/verify-r2.mjs
node --env-file=.env.local scripts/dev-seed.mjs
```

## Environment variables

| Variable | Required for | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Web | Canonical application origin, callbacks, report links, metadata, sitemap, and robots output. |
| `AUTH_SECRET` | Auth | Auth.js signing secret. Generate a strong random value in production. |
| `AUTH_RESEND_KEY` | Production auth | Resend API key for magic-link email. If absent in development, the link is logged. |
| `AUTH_EMAIL_FROM` | Auth | Resend-verified sender address. |
| `DATABASE_URL` | Data features | Postgres connection for Auth.js, devices, users, reports, and branding. |
| `R2_ENDPOINT` | Report storage | Cloudflare R2 or S3-compatible endpoint. |
| `R2_ACCESS_KEY_ID` | Report storage | Object-storage access key. |
| `R2_SECRET_ACCESS_KEY` | Report storage | Object-storage secret. |
| `R2_BUCKET` | Report storage | Bucket name; production defaults conceptually to `thewcag-reports` but explicit configuration is validated before use. |
| `R2_PUBLIC_URL` | Production delivery | Public R2 custom domain or managed URL. If absent, the app streams objects through its image routes. |
| `ADMIN_EMAILS` | Admin | Comma-separated, case-insensitive list allowed to access `/admin`; unset means no admins. |

Never commit `.env` files, signing credentials, private updater keys, database credentials, or R2 secrets. The repository ignores local environment variants and retains only examples.

## Quality and verification

Run the complete repository gate:

```sh
pnpm verify
```

It currently performs:

1. The 14 `a11y-core` Vitest tests.
2. Desktop TypeScript validation.
3. Website TypeScript validation.
4. The desktop Vite production build.
5. The Next.js production build and route generation.

Focused commands:

```sh
pnpm test
pnpm typecheck
pnpm --filter @accessibility-build/a11y-core typecheck
pnpm --filter @accessibility-build/desktop build:vite
pnpm --filter @thewcag/web build
```

Validate native Rust/Tauri integration without producing installers:

```sh
pnpm --filter @accessibility-build/desktop tauri build --debug --no-bundle
```

Pull requests and pushes to `main` run the same `pnpm verify` gate in `.github/workflows/quality.yml`.

## Build and deployment

### Local desktop bundles

```sh
pnpm --filter @accessibility-build/desktop build
```

The base configuration produces the macOS application/DMG. On Windows, `tauri.windows.conf.json` switches the bundle target to NSIS. Local development artifacts are unsigned unless the appropriate platform and updater signing variables are provided.

### Website container

The production image is a multi-stage Node 22 Alpine build using Next standalone output. Its build context must be the monorepo root.

Build and run the complete production-shaped stack locally:

```sh
docker compose up --build
```

The root compose file runs Postgres and the web service, waits for database health, derives `DATABASE_URL` internally, exposes the app on port `3100`, and runs schema initialization through the server instrumentation hook. It is designed for a Coolify Docker Compose resource with `app.thewcag.com` routed to the `web` service on port `3100`.

## Releases and updates

Production desktop releases are tag-driven. Before tagging:

1. Synchronize the desktop version in `apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`, and `apps/desktop/src-tauri/tauri.conf.json`.
2. Update `CHANGELOG.md`.
3. Run `pnpm verify` and a native build on the relevant platforms.
4. Commit the version and changelog.
5. Create and push the exact `v<desktop-version>` tag.

```sh
git tag v2.4.1
git push origin v2.4.1
```

The release workflow refuses to publish unless all mandatory Apple, Windows, and Tauri updater signing credentials are present. It then:

1. Runs the quality gate.
2. Builds, signs, notarizes, and staples the macOS app and DMG.
3. Imports the Windows PFX and builds an Authenticode-signed NSIS installer.
4. Signs both updater artifacts with the Tauri updater key.
5. Generates platform manifest partials and merges them into `latest.json`.
6. Publishes the installers, updater archives, signatures, and manifest to a GitHub Release.

The application checks the latest GitHub Release manifest and offers an in-app update and restart. Read [docs/RELEASING.md](docs/RELEASING.md) before releasing; it is the secret and signing checklist.

## Security and accessibility baseline

- The desktop webviews use an explicit Tauri CSP and a shared capability allowlist.
- The website removes the framework header and sends content-type, referrer, permissions, and HSTS headers.
- Device tokens are random 256-bit values, hashed at rest, revocable, and stored in the native credential vault.
- Public reports use unguessable slugs and are marked `noindex`; possession of the link grants viewing access.
- Production database migration failures stop server startup instead of leaving a partially functioning service.
- The web root includes a skip link, semantic landmarks, responsive navigation, and page-level metadata.
- Desktop dialogs trap focus, icon controls have accessible names, status messages use live regions, controls are sized for WCAG 2.2 target guidance, and reduced-motion preferences are respected.

Changes should preserve keyboard access, visible focus, semantic names and states, contrast, 320 px website layouts, Windows compact desktop width, macOS wide desktop layout, and the `560 x 460` minimum auditor-tool windows.

## Project documentation

- [SKILL.md](SKILL.md): repository-specific implementation and verification workflow.
- [CHANGELOG.md](CHANGELOG.md): shipped versions and unreleased changes.
- [docs/RELEASING.md](docs/RELEASING.md): production signing and release operations.
- [docs/SCK-MIGRATION.md](docs/SCK-MIGRATION.md): planned macOS lens migration from deprecated CoreGraphics capture to ScreenCaptureKit.
- [docs/SITE-INTEGRATION.md](docs/SITE-INTEGRATION.md): historical integration plan; confirm current routes and behavior against source.
- [PLAN.md](PLAN.md): historical original v1 plan, not the current feature specification.

## Downloads

- [Download for macOS or Windows](https://app.thewcag.com/download)
- [Latest GitHub Release](https://github.com/Sairo-app/app.thewcag.com/releases/latest)
