# TheWCAG

TheWCAG is a production-oriented accessibility auditing system for macOS, Windows, and Chrome. It combines native inspection and annotation tools, precise browser evidence capture, reviewable AI-assisted finding drafts, WCAG 2.2 audit management, and client-ready report publishing without treating automation as a substitute for expert judgment.

[![Release](https://img.shields.io/github/v/release/Sairo-app/app.thewcag.com?label=release)](https://github.com/Sairo-app/app.thewcag.com/releases/latest)
[![Quality checks](https://github.com/Sairo-app/app.thewcag.com/actions/workflows/quality.yml/badge.svg)](https://github.com/Sairo-app/app.thewcag.com/actions/workflows/quality.yml)
![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Chrome-2563eb)
![WCAG](https://img.shields.io/badge/audit-WCAG%202.2%20A%2FAA-c2410c)

| Surface | Primary purpose | Works without AI |
|---|---|---:|
| Electron desktop app | Inspect any application, annotate evidence, manage audits, review findings, and publish reports | Yes |
| Chrome extension | Mark an exact webpage element or region and collect bounded visual and semantic evidence | Yes |
| Next.js web platform | Authenticate devices, generate approved drafts, store report metadata, and serve shareable reports | Public pages and local development do |

The core audit workflow remains local-first. AI output is always a draft, WCAG mappings and severity remain suggestions until an auditor confirms them, and no finding is saved or published automatically.

## Product capabilities

### Desktop auditor

| Capability | What it provides |
|---|---|
| On-screen contrast picker | Samples foreground and background pixels from any application or monitor, displays the WCAG 2.x ratio and AA/AAA verdicts, reports signed APCA Lc, and suggests nearby passing colors. |
| Capture and annotation | Captures a region or full screen into a re-editable local document. Tools include issue badges, arrows, boxes, target measurement, contrast probes, focus-order markers, solid or pixel redaction, text, and non-destructive crop-to-new-capture. |
| Color-vision lens | Shows the screen beneath a protected, always-on-top window with protanopia, deuteranopia, tritanopia, or achromatopsia simulation, adjustable severity, split view, zoom, low-acuity blur, low-contrast simulation, and PNG export. |
| Audit workspace | Treats each project as an isolated audit with its own captures, findings, checklist, palette, reports, and activity history. The four-stage Inspect, Evidence, Review, and Share workflow keeps delivery state visible. |
| Findings register | Combines contrast and annotated issues with WCAG criterion, severity, status, notes, search, Markdown export, and report preparation. |
| WCAG checklist | Tracks all 55 WCAG 2.2 Level A and AA criteria by POUR principle with pass, fail, not applicable, notes, progress, filters, and contextual CSV or Markdown exports. |
| Palette matrix | Accepts up to 16 hex colors, persists the palette, calculates every foreground/background pair, visualizes AA-normal and AA-large/UI thresholds, and copies the matrix as CSV. |
| Evidence and reporting | Exports or copies annotated PNGs, merges annotation issues without overwriting later triage, and requires a report review, capture selection, privacy attestation, and authenticated account before publishing a shareable link. |
| Capture library and settings | Keeps up to 100 recent captures locally with editable source data and annotated thumbnails. Includes remappable global shortcuts, launch-at-login, update installation, screen-permission guidance, high-DPI capture, and a tray/menu-bar workflow. |

Default global shortcuts are:

| Action | macOS | Windows |
|---|---:|---:|
| Check contrast | `⌥⌘P` | `Ctrl+Alt+P` |
| Capture and annotate | `⌥⌘S` | `Ctrl+Alt+S` |
| Toggle color-vision lens | `⌥⌘L` | `Ctrl+Alt+L` |

All three shortcuts can be changed in the application. The tray and native application menu also expose contrast inspection, region and full-screen capture, the vision lens, auditor tools, and application controls.

### Chrome evidence extension

The Manifest V3 extension turns a browser observation into structured audit evidence without claiming automated conformance. The toolbar opens a compact popup for quick capture. The optional side panel is a separate, expanded workspace for reviewing evidence, controlling the approved payload, editing a generated draft, and saving the confirmed result.

The capture flow is:

1. Open the toolbar popup on the page being audited.
2. Choose **Select element** for one control, image, or text target, or **Select region** for a barrier spanning multiple elements.
3. Mark the target on the webpage. The service worker finishes the screenshot crop and stores the evidence even after Chrome closes the popup.
4. Reopen the popup when the toolbar badge shows `1`, then choose **Review in workspace**.
5. Inspect the marked crop, selector, semantic context, deterministic signals, and the complete bounded payload.
6. Describe the observed behavior and optional task context. Choose whether the screenshot, element text, and sanitized page address may be included.
7. Create a local structured draft or, when the paired desktop app is connected and signed in, generate an AI-assisted draft.
8. Confirm the title, description, actual and expected results, user impact, affected users, severity, WCAG mappings, recommendation, example fix, and reproduction steps before saving into an audit.

| Mode | Available behavior |
|---|---|
| Extension only | Element and region capture, marked high-DPI crop, deterministic checks, local persistence, local structured draft, Markdown export, and copy |
| Extension plus desktop | Lists local audits, saves confirmed findings and evidence into the selected audit, and keeps the device credential outside Chrome |
| Extension plus signed-in desktop and configured AI | Sends only the user-approved payload through the authenticated desktop process and returns a schema-validated, editable finding draft |

The extension requests temporary `activeTab` access only after a toolbar action. It does not request permanent access to every website. Regular `http` and `https` pages, including localhost, are supported. Chrome-owned pages such as `chrome://settings`, DevTools, the Chrome Web Store, and other protected browser surfaces cannot be inspected by extensions.

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
    DesktopUI <--> IPC["Allowlisted contextBridge IPC"]
    IPC <--> Native["Electron main process<br/>capture, overlay, lens, storage, tray"]
    Native <--> OS["macOS and Windows APIs"]

    Native -->|"system browser"| Connect["Next.js /connect"]
    Connect -->|"thewcag:// auth callback"| Native
    Native -->|"bearer API"| Web["Next.js device and report APIs"]
    Popup["Chrome quick-capture popup"] --> Worker["Extension service worker<br/>crop, checks, local storage"]
    Workspace["Expanded evidence workspace"] <--> Worker
    Worker -->|"temporary activeTab access"| Browser["Audited webpage"]
    Workspace -->|"allowlisted native messaging"| Native
    Web <--> Postgres["Postgres<br/>auth, devices, report metadata"]
    Web <--> R2["Cloudflare R2<br/>report images and logos"]
    Web --> Public["Public /s/[slug] report"]
```

The accessibility core is intentionally framework-independent and currently consumed by the desktop app. It can be reused by web surfaces without bringing Electron or DOM dependencies into the package.

### Desktop runtime

The desktop application uses one React bundle for multiple sandboxed Electron windows. `apps/desktop/src/main.tsx` selects the UI from the validated `view` query supplied by the main process:

- `main`: staged audit workstation with Inspect, Evidence, Review, and Share plus palette, vision, account, and settings utilities.
- `overlay`: one frozen full-screen inspection window per monitor.
- `annotate`: re-editable screenshot editor with keyboard-accessible annotation selection and a handoff into report review.
- `lens`: live color-vision and low-vision simulation.

Native services live in `apps/desktop/electron/`; the renderer sees only the allowlisted API exposed by `electron/preload.ts`. Context isolation, sandboxing, navigation blocking, CSP, sender validation, permission denial, bounded payload validation, ASAR packaging, hardened runtime, signed and notarized macOS releases, and integrity-checked updates form the desktop trust boundary. Electron is the repository's only desktop runtime. A bounded one-time importer preserves local data created by earlier desktop releases.

### Data and trust boundaries

- Desktop captures are stored in the OS application-data directory as a raw PNG, an editable JSON annotation document, and an annotated thumbnail.
- Audit context, findings, checklist results, palettes, activity, and report history are isolated per audit in local JSON files.
- Browser evidence is sanitized and retained locally until the auditor explicitly approves generation. The extension can omit its screenshot, element text, or sanitized page address from the approved payload.
- Form values and passwords are not extracted as semantic fields. The selected screenshot may still contain visible page content, which is why users can inspect and omit it before generation. Cookies, browser storage, authentication headers, network bodies, clipboard contents, browser history, executable page code, URL credentials, query parameters, and fragments are not collected.
- The desktop device token is stored in macOS Keychain or Windows Credential Manager. Only its SHA-256 hash is stored in Postgres.
- AI usage records contain operational metadata only. Evidence images, DOM excerpts, observations, and generated content are not written to the web database.
- Published PNGs and brand logos live in Cloudflare R2. Postgres stores identity, sessions, device records, report metadata, issues, sizes, branding, and view counts.
- A published image is limited to 4 MB, a report to 100 issue rows, and each user to 1 GiB of stored report images.
- R2 objects are removed when owners or administrators delete reports. User deletion also purges owned reports and branding objects.

## Repository layout

```text
accessibility-build-app/
├── apps/
│   ├── desktop/                 Electron desktop application
│   │   ├── electron/            Main process, preload, native services, IPC
│   │   ├── resources/           Canonical app icons, entitlements, pack hook
│   │   ├── src/app/             React workstation and tool views
│   │   ├── src/lib/annotate/    Reusable annotation geometry and rendering
│   │   └── src/shared/          Main/preload/renderer contracts
│   ├── extension/               Chrome popup, workspace, picker, and evidence capture
│   └── web/                     Next.js website, API, auth, admin, and data layer
├── packages/
│   ├── a11y-core/               Pure TypeScript accessibility calculations
│   └── audit-contracts/         Evidence, finding, WCAG, and native protocols
├── scripts/                     Desktop icon and Electron release validation
├── docs/                        Release and site-integration operations
├── .github/workflows/           Quality and signed release automation
├── docker-compose.yaml          Production Postgres and web stack
├── DESIGN.md                    Website visual system and accessibility rules
├── SKILL.md                     Repository-specific agent workflow
├── CHANGELOG.md                 Release history and unreleased changes
```

Important source maps:

| Concern | Location |
|---|---|
| Desktop window routing | `apps/desktop/src/main.tsx` |
| Main auditor workspace | `apps/desktop/src/app/Workspace.tsx` |
| Capture overlay | `apps/desktop/src/app/OverlayView.tsx`, `electron/services/screen-capture.ts` |
| Annotation editor | `apps/desktop/src/app/AnnotateView.tsx`, `src/lib/annotate/` |
| Color-vision lens | `apps/desktop/src/app/LensView.tsx` |
| Native IPC registration | `apps/desktop/electron/ipc.ts`, `electron/preload.ts` |
| Chrome evidence workflow | `apps/extension/src/sidepanel/App.tsx`, `src/picker.ts`, `src/evidence.ts` |
| Extension/desktop bridge | `apps/desktop/electron/native-host.ts`, `electron/services/native-protocol.ts` |
| Shared evidence contracts | `packages/audit-contracts/src/` |
| Local capture library | `apps/desktop/electron/services/captures.ts` |
| Desktop/web authentication | `apps/desktop/electron/services/auth.ts`, `apps/web/app/connect/`, `apps/web/lib/device-auth.ts` |
| AI finding authoring | `apps/web/app/api/device/ai/findings/route.ts`, `apps/web/lib/ai-finding.ts` |
| Report publishing | `apps/web/app/api/device/screenshots/route.ts` |
| Database model and startup migration | `apps/web/lib/schema.ts`, `apps/web/lib/migrate.ts` |
| R2 and quota enforcement | `apps/web/lib/r2.ts`, `apps/web/lib/quota.ts` |
| Release pipeline | `.github/workflows/release.yml`, `apps/desktop/electron-builder.yml` |

## Requirements

- Node.js 22 or later
- pnpm 9.15.4 through Corepack
- Git
- macOS: macOS 12 Monterey or later
- Windows: 64-bit Windows 10 or 11
- Chrome extension: Google Chrome 116 or later
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

This runs `electron-vite dev`, starts the renderer on port `5173`, builds the sandboxed main and preload processes, and opens the native Electron shell.

For browser-only responsive and accessibility inspection:

```sh
pnpm --filter @accessibility-build/desktop dev:vite
```

Open `http://localhost:5173/`. Browser preview provides safe local fallbacks for UI inspection; screen capture, global shortcuts, secure credentials, native windows, and updates operate only inside Electron.

macOS prompts for Screen Recording access when capture is first used. After granting it in System Settings, restart the application so the new process receives the permission. Windows does not use this permission flow.

### Chrome extension

Use Chrome 116 or newer. Build the unpacked extension:

```sh
pnpm build:extension
```

For continuous extension builds during development, run:

```sh
pnpm --filter @accessibility-build/extension dev
```

Then install the unpacked build:

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `apps/extension/dist`.
3. Pin TheWCAG to the Chrome toolbar.
4. Copy the 32-character extension ID Chrome assigns.
5. After every rebuild, click **Reload** on the extension card so Chrome replaces the popup, service worker, and side-panel bundle.

The desktop native host intentionally accepts only that exact extension ID. For a production-shaped local bridge, package and launch the desktop app with the ID embedded:

```sh
THEWCAG_EXTENSION_ID=<32-character-extension-id> \
  pnpm --filter @accessibility-build/desktop run pack
```

Open the resulting unpacked TheWCAG application once so it registers the per-user native host, then choose **Connect desktop app** in the extension. The native messaging registration is written per user and is allowlisted to the configured extension origin. Local capture and export remain available if pairing is absent or the desktop app is offline.

Release builds read the same value from the GitHub Actions repository variable `THEWCAG_EXTENSION_ID`. It must match the published Chrome Web Store extension ID before shipping the paired desktop release.

#### Extension troubleshooting

| Symptom | Resolution |
|---|---|
| The old side panel opens when the toolbar icon is clicked | Reload the unpacked extension in `chrome://extensions`. The current service worker clears Chrome's previously persisted side-panel-on-action setting. |
| “This browser page is protected by Chrome” | Switch to a regular `http` or `https` website. Chrome does not allow extensions to inject into browser-owned pages. |
| “This tab has not granted page access” | Reopen TheWCAG from the toolbar on that tab, then start the capture from the popup. This refreshes the temporary `activeTab` grant. |
| Localhost is reported as unavailable | Reload the latest unpacked build. `http://localhost` and `https://localhost` are treated as regular websites. |
| The popup closes while selecting | This is expected. Complete the selection, wait for the badge and page confirmation, then reopen the popup to review the stored evidence. |
| The desktop connector is not found | Rebuild the desktop app with the exact Chrome extension ID, launch it once to register the host, and reconnect from the extension. |
| AI generation is unavailable | Confirm the desktop app is connected and signed in, then check `OPENAI_API_KEY`, the AI limits, and the web service. A local structured draft remains available. |

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
AUTH_RESEND_KEY=
AUTH_EMAIL_FROM="TheWCAG <login@thewcag.local>"
DATABASE_URL=postgres://postgres:postgres@localhost:5433/thewcag
R2_ENDPOINT=http://localhost:9000
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin
R2_BUCKET=thewcag-reports
R2_PUBLIC_URL=http://localhost:9000/thewcag-reports
ADMIN_EMAILS=
OPENAI_API_KEY=
OPENAI_FINDING_MODEL=gpt-5.6-terra
AI_SAFETY_SALT=replace-with-a-separate-random-secret
AI_GENERATIONS_PER_HOUR=30
AI_GENERATIONS_PER_DAY=200
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
| `OPENAI_API_KEY` | Optional AI authoring | Server-only provider credential. If absent, the endpoint reports unavailable and the extension keeps its local draft. |
| `OPENAI_FINDING_MODEL` | Optional AI authoring | Configurable structured multimodal model, defaulting to `gpt-5.6-terra`. Change only after representative accessibility-finding evaluations. |
| `AI_SAFETY_SALT` | AI privacy | Separate secret used to derive a stable, non-reversible provider safety identifier from the device record. |
| `AI_GENERATIONS_PER_HOUR` | AI limits | Per-account rolling hourly generation limit. |
| `AI_GENERATIONS_PER_DAY` | AI limits | Per-account rolling daily generation limit. |

Desktop and extension builds also use:

| Variable | Required for | Purpose |
|---|---|---|
| `THEWCAG_EXTENSION_ID` | Paired extension releases | Exact 32-character Chrome extension ID embedded into the native-host allowlist. In GitHub Actions this is a repository variable, not a secret. |

Never commit `.env` files, signing credentials, private updater keys, database credentials, or R2 secrets. The repository ignores local environment variants and retains only examples.

## Quality and verification

Run the complete repository gate:

```sh
pnpm verify
```

It currently performs:

1. Shared accessibility-core and evidence-contract Vitest tests.
2. Extension crop geometry, deterministic drafts, privacy boundaries, protected-page classification, and popup/side-panel manifest tests.
3. Desktop storage, native-host, and native-protocol tests.
4. Website payload, device-connect, AI schema, and brand-logo validation tests.
5. Node release-version and updater-manifest tests.
6. TypeScript validation for contracts, extension, desktop, and website.
7. Extension and Electron production builds.
8. The Next.js production build and route generation.

Focused commands:

```sh
pnpm test
pnpm typecheck
pnpm --filter @accessibility-build/a11y-core typecheck
pnpm build:extension
pnpm --filter @accessibility-build/desktop build
pnpm --filter @thewcag/web build
```

Create an unpacked desktop application for local native validation:

```sh
pnpm --filter @accessibility-build/desktop run pack
```

Pull requests and pushes to `main` run the same `pnpm verify` gate in `.github/workflows/quality.yml`.

## Build and deployment

### Local desktop bundles

```sh
pnpm --filter @accessibility-build/desktop run pack
```

`pack` creates an unpacked application for the current platform. `dist:mac` creates universal DMG and ZIP artifacts; `dist:win` creates the Windows NSIS installer. Local artifacts are unsigned unless the platform signing and notarization variables are present.

### Website container

The production image is a multi-stage Node 22 Alpine build using Next standalone output. Its build context must be the monorepo root.

Build and run the complete production-shaped stack locally:

```sh
docker compose up --build
```

The root compose file runs Postgres and the web service, waits for database health, derives `DATABASE_URL` internally, exposes the app on port `3100`, and runs schema initialization through the server instrumentation hook. It is designed for a Coolify Docker Compose resource with `app.thewcag.com` routed to the `web` service on port `3100`.

## Releases and updates

Production desktop releases are tag-driven. Before tagging:

1. Update the desktop version in `apps/desktop/package.json`.
2. Update `CHANGELOG.md`.
3. Run `pnpm verify` and a native build on the relevant platforms.
4. Commit the version and changelog.
5. Create and push the exact `v<desktop-version>` tag.

```sh
git tag -a v3.0.1 -m "TheWCAG v3.0.1"
git push origin v3.0.1
```

The release workflow first rejects a tag that does not exactly match the desktop package version and refuses to publish unless all mandatory Apple signing and notarization credentials plus the valid repository variable `THEWCAG_EXTENSION_ID` are present. It then:

1. Runs the quality gate.
2. Builds, signs, notarizes, and staples a universal macOS app and DMG for Apple Silicon and Intel.
3. Builds an unsigned Windows NSIS installer. Windows may show an Unknown Publisher or SmartScreen warning until Authenticode signing is added.
4. Generates electron-updater metadata and differential blockmaps for macOS and Windows.
5. Publishes the installers, update archives, blockmaps, and platform manifests to one immutable GitHub Release.

The application checks the latest GitHub Release manifest and offers an in-app update and restart. Read [docs/RELEASING.md](docs/RELEASING.md) before releasing; it is the secret and signing checklist.

## Security and accessibility baseline

- Desktop renderers use context isolation, Chromium sandboxing, no Node integration, a strict CSP, denied web permissions, blocked navigation and popups, trusted-sender checks, and explicit IPC allowlists.
- The website removes the framework header and sends content-type, referrer, permissions, and HSTS headers.
- Device tokens are random 256-bit values, hashed at rest, revocable, and stored in the native credential vault.
- The Chrome native host is registered only for the configured extension ID, validates versioned bounded JSON, and keeps bearer credentials inside the desktop process.
- The Chrome extension uses a popup for capture initiation, temporary `activeTab` access instead of `<all_urls>`, local evidence persistence, bounded extraction, and an optional side panel for detailed review.
- AI authoring requires explicit payload consent, uses strict structured output validation, and records operational usage without storing evidence or finding content in Postgres.
- Public reports use unguessable slugs and are marked `noindex`; possession of the link grants viewing access.
- Production database migration failures stop server startup instead of leaving a partially functioning service.
- The web root includes a skip link, semantic landmarks, responsive navigation, and page-level metadata.
- Desktop dialogs trap focus, icon controls have accessible names, status messages use live regions, controls are sized for WCAG 2.2 target guidance, and reduced-motion preferences are respected.

Changes should preserve keyboard access, visible focus, semantic names and states, contrast, 320 px website layouts, the `920 x 640` desktop minimum, high-DPI capture, and reduced-motion behavior.

## Project documentation

- [DESIGN.md](DESIGN.md): Audit Lab visual language, responsive composition, interactive product-preview rules, and accessibility acceptance criteria.
- [SKILL.md](SKILL.md): repository-specific implementation and verification workflow.
- [CHANGELOG.md](CHANGELOG.md): shipped versions and unreleased changes.
- [docs/RELEASING.md](docs/RELEASING.md): production signing and release operations.
- [docs/SITE-INTEGRATION.md](docs/SITE-INTEGRATION.md): current desktop, website, authentication, publishing, and download integration.
- [docs/AI-EXTENSION-IMPLEMENTATION.md](docs/AI-EXTENSION-IMPLEMENTATION.md): browser evidence architecture, contracts, privacy boundaries, phased delivery, and acceptance criteria.

## Downloads

- [Download for macOS or Windows](https://app.thewcag.com/download)
- [Latest GitHub Release](https://github.com/Sairo-app/app.thewcag.com/releases/latest)
