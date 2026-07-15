---
name: accessibility-build-app
description: Maintain and extend TheWCAG's accessibility-auditing monorepo. Use for repository-specific work involving its Tauri 2 and React desktop app, native Rust screen capture and overlays, WCAG/APCA/color-vision math, annotation and audit workflows, Next.js account and report-sharing service, Auth.js device authorization, Postgres/Drizzle, Cloudflare R2, Docker/Coolify deployment, CI, signed desktop releases, updater manifests, or project documentation.
---

# Maintain TheWCAG

## Start from repository truth

1. Work from the monorepo root.
2. Run `git status --short --branch` before editing. Preserve unrelated user changes.
3. Read the nearest package manifest and the source files for the affected surface.
4. Treat executable code and configuration as authoritative. Use `PLAN.md` only as historical context.
5. Keep desktop, web, shared math, documentation, and release behavior aligned.
6. Verify in proportion to risk, then report exact commands and results.

Use this truth order when documentation disagrees:

1. Runtime source and tests
2. `package.json`, `Cargo.toml`, Tauri configuration, and Docker configuration
3. GitHub Actions workflows
4. `README.md` and `docs/RELEASING.md`
5. `CHANGELOG.md`
6. `PLAN.md` and `docs/SITE-INTEGRATION.md`, which contain historical plans

## Understand the repository

| Area | Responsibility | Primary files |
|---|---|---|
| Desktop UI | React interface for every Tauri window | `apps/desktop/src/main.tsx`, `apps/desktop/src/windows/`, `apps/desktop/src/styles.css` |
| Desktop bridge | Typed frontend wrappers for Rust commands and events | `apps/desktop/src/lib/ipc.ts` |
| Native desktop | Capture, overlays, lens, storage, auth, export, tray, shortcuts, updates | `apps/desktop/src-tauri/src/` |
| Desktop security | Tauri CSP and per-window capabilities | `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/capabilities/default.json` |
| Audit model | Project context shared by findings and checklist exports | `apps/desktop/src/lib/audit.ts` |
| Annotation model | Shapes, WCAG issue presets, geometry, and canvas rendering | `apps/desktop/src/lib/annotate/` |
| Accessibility math | Pure TypeScript WCAG contrast, APCA, formats, suggestions, CVD simulation | `packages/a11y-core/src/` |
| Website | Next.js marketing, authentication, account, admin, and report pages | `apps/web/app/`, `apps/web/components/` |
| Web data | Auth/device/report schema, migrations, quotas, and R2 access | `apps/web/lib/`, `apps/web/drizzle/` |
| Deployment | Standalone Next image and Postgres/web production stack | `apps/web/Dockerfile`, `docker-compose.yaml` |
| Delivery | Quality checks, signed platform builds, updater manifest, GitHub Release | `.github/workflows/`, `scripts/make-latest-json.mjs`, `scripts/merge-latest-json.mjs` |

The workspace contains three packages:

- `@accessibility-build/desktop`: Tauri 2, React 19, TypeScript, Vite, Tailwind CSS 4, and Rust.
- `@thewcag/web`: Next.js 15, React 19, Auth.js v5, Drizzle, Postgres, and Cloudflare R2.
- `@accessibility-build/a11y-core`: framework-independent TypeScript math. Keep it free of Tauri, DOM, and server-only imports.

## Preserve architectural invariants

### Desktop windows and IPC

- Keep one Vite/React bundle. Route the view from the Tauri window label in `apps/desktop/src/main.tsx`.
- Recognize these labels: `main`, `overlay-*`, `annotate`, `lens`, `countdown`, `findings`, `checklist`, and `palette`.
- Create native windows hidden and reveal them after the React effect commits. Do not wait for `requestAnimationFrame`; hidden WKWebViews can suspend it indefinitely.
- Keep the browser preview fallback working through `?view=<label>` for responsive and accessibility QA.
- Add or change IPC in both places: register the Rust command in `src-tauri/src/lib.rs`, then expose the typed wrapper in `src/lib/ipc.ts`.
- Add every new window label or wildcard to `src-tauri/capabilities/default.json` and grant only the permissions it needs.
- Keep Tauri command names, argument casing, raw-body headers, return types, and emitted event payloads synchronized.
- Preserve the explicit CSP. Expand a directive narrowly only when a real runtime dependency requires it.

### Desktop platform behavior

- Treat macOS and Windows as first-class targets. Test platform branches instead of assuming identical window or capture APIs.
- Require macOS Screen Recording permission before capture or lens work. Permission changes take effect for a new process, so retain the restart path.
- Use one frozen overlay per monitor. Preserve scale-factor conversion between logical window coordinates and physical captured pixels.
- Keep the Windows main-window override in `tauri.windows.conf.json`; the base Tauri config describes the macOS-style shell.
- Preserve the macOS below-window lens capture and the Windows `WDA_EXCLUDEFROMCAPTURE` path. The frontend expects `[width LE][height LE][RGBA bytes]` on both platforms.
- Keep global shortcuts configurable and transactional: reject duplicates or OS failures and roll back to the previous registered set.
- Keep the main window alive in the tray when closed. Tool windows should close normally.

### Local data and privacy

- Keep raw captures local until the user explicitly publishes.
- Store a capture as `<id>.png`, its editable document as `<id>.json`, and its gallery preview as `<id>.thumb.png` under the Tauri application data directory.
- Sanitize capture IDs and store keys before constructing paths.
- Keep audit context, findings, checklist state, palettes, and similar JSON in the native store directory.
- Store the desktop device token only in macOS Keychain or Windows Credential Manager through `keyring`; never put it in frontend storage or logs.
- Use solid redaction as the safe default. Describe pixelation as cosmetic because it can be reversible.

### Authentication and report sharing

- Start sign-in in the system browser at `/connect` with a random state nonce and sanitized device name.
- Require the returned `thewcag://auth?token=...&state=...` state to match the in-memory nonce before storing the token.
- Store only the SHA-256 token hash in Postgres. Send the raw token only as an HTTPS bearer credential.
- Resolve device tokens through `verifyDeviceToken`, reject revoked devices, and update `lastSeenAt` best-effort.
- Publish reports through `POST /api/device/screenshots`. Validate PNG signature and size, cap issue data, enforce the per-user quota before writing, and remove an R2 object when the database insert fails.
- Keep public report URLs at `/s/[slug]` and image delivery at `/api/s/[slug]/image`.
- Keep public reports unindexed and avoid counting known crawlers or the report owner as views.
- Delete both database metadata and R2 objects when users, owners, or admins revoke content.
- Apply white-label name, accent, and logo only from the report owner. Validate logo type, size, and color.

### Web data and deployment

- Treat Postgres as the source for users, sessions, devices, report metadata, branding, sizes, and view counts.
- Treat R2 as the source for report images and brand logos.
- Keep `lib/schema.ts`, `drizzle/0000_init.sql`, and the embedded idempotent SQL in `lib/migrate.ts` aligned when the schema changes.
- Make migrations retryable after failure. Fail production startup when migrations fail; allow development to continue for static UI work.
- Preserve build-time database laziness: importing `lib/db.ts` must not connect during `next build`.
- Keep production output standalone and build the Docker image from the monorepo root.
- Preserve port `3100`, `HOSTNAME=0.0.0.0`, the Postgres health dependency, and the web health check.
- Keep updater manifests uncached and retain the global security headers in `next.config.mjs`.
- Gate `/admin` through `ADMIN_EMAILS` and return not-found to unauthorized users.

### Shared accessibility math

- Keep calculations deterministic and side-effect free.
- Preserve WCAG thresholds: 4.5:1 normal AA, 7:1 normal AAA, 3:1 large/UI AA, and 4.5:1 large AAA.
- Preserve APCA polarity; do not convert signed Lc into an unsigned value except for rating bands.
- Keep accessible-color suggestions based on the nearest HSL lightness change in either reachable direction.
- Add boundary tests when changing color parsing, luminance, ratios, thresholds, APCA, suggestions, or CVD matrices.
- Reuse `a11y-core` instead of duplicating contrast logic in desktop components.

## Follow the appropriate change workflow

### Change desktop UI or behavior

1. Locate the window component and its Rust dependency.
2. Trace every `ipc.*` call to the registered Rust command.
3. Check keyboard operation, focus order, names, live regions, target size, narrow layouts, and reduced motion.
4. Check both the native window minimum size and browser preview widths.
5. Run desktop type checking and the Vite build.
6. Run a native Tauri build when Rust, IPC, capabilities, Tauri configuration, capture, auth, updater, or window creation changes.

### Add an auditor tool or window

1. Add the React window component.
2. Register the label in `main.tsx`.
3. Create or focus the native window in Rust.
4. Add the label to Tauri capabilities.
5. Add tray/main-window entry points only when the workflow needs them.
6. Keep browser preview support and test the minimum native dimensions.
7. Persist user data through native storage rather than `localStorage`.

### Change annotation behavior

1. Update `model.ts` for persisted shape or document changes.
2. Keep old document parsing safe; introduce a version migration before changing the stored schema.
3. Update geometry, hit testing, editing, and export rendering together.
4. Ensure the canvas export, report sheet, Markdown/Jira output, findings register, thumbnail, and public publish payload agree.
5. Preserve undo/redo, autosave, recent-capture switching, keyboard tools, zoom, and crop behavior.

### Change the web application

1. Classify the route as public marketing, authenticated account, device API, public report, or admin.
2. Apply authentication and ownership checks server-side.
3. Validate input sizes and types before database or R2 writes.
4. Keep canonical metadata, robots behavior, sitemap inclusion, skip link, headings, and responsive navigation correct.
5. Run web type checking and a production Next build.
6. Exercise Postgres/R2 paths when touching auth, reports, branding, quotas, admin deletion, or migrations.

### Change the database schema

1. Make changes additive when possible.
2. Update `lib/schema.ts`.
3. Generate or edit the Drizzle migration.
4. Mirror the migration in `lib/migrate.ts` for standalone startup.
5. Test a new database and an already-migrated database.
6. Verify cascade and R2 cleanup behavior separately; database cascades cannot delete object storage.

### Change release or updater behavior

1. Keep the desktop version synchronized in:
   - `apps/desktop/package.json`
   - `apps/desktop/src-tauri/Cargo.toml`
   - `apps/desktop/src-tauri/tauri.conf.json`
2. Update `CHANGELOG.md`.
3. Keep the release tag exactly `v<desktop-version>`.
4. Preserve mandatory Apple signing/notarization, Windows Authenticode signing, and Tauri updater signing preflight.
5. Keep macOS and Windows updater partials compatible with `merge-latest-json.mjs`.
6. Never commit private signing keys, certificates, passwords, `.env` files, or generated updater artifacts.
7. Read `docs/RELEASING.md` before creating a production tag.

## Use the command matrix

Install from the root:

```sh
corepack enable
pnpm install --frozen-lockfile
```

Run development surfaces:

```sh
pnpm dev                                      # native Tauri desktop
pnpm --filter @accessibility-build/desktop dev:vite
pnpm --filter @thewcag/web dev                # Next.js on :3100
```

Use Vite browser previews such as `http://localhost:5173/?view=main`, `?view=findings`, `?view=checklist`, and `?view=palette`. Native-only IPC actions intentionally do not work in these previews.

Run focused checks:

```sh
pnpm --filter @accessibility-build/a11y-core test
pnpm --filter @accessibility-build/a11y-core typecheck
pnpm --filter @accessibility-build/desktop typecheck
pnpm --filter @accessibility-build/desktop build:vite
pnpm --filter @thewcag/web typecheck
pnpm --filter @thewcag/web build
```

Run the standard repository gate:

```sh
pnpm verify
```

This gate runs 14 current core tests, desktop and web type checking, the desktop Vite production build, and the Next production build. If test counts change, report the observed count rather than copying this number blindly.

Validate native integration when applicable:

```sh
pnpm --filter @accessibility-build/desktop tauri build --debug --no-bundle
```

Run local web infrastructure when needed:

```sh
docker compose -f apps/web/docker-compose.dev.yml up -d
cd apps/web
node --env-file=.env.local scripts/dev-bucket.mjs
node --env-file=.env.local scripts/verify-r2.mjs
```

## Apply accessibility and UX acceptance criteria

- Operate every action with a keyboard and provide visible focus.
- Use semantic controls and explicit accessible names for icon-only actions.
- Trap focus in modal dialogs, close them with Escape, and return focus sensibly.
- Announce async success and failure through live regions without relying on color.
- Keep interactive targets at least 24 by 24 CSS pixels where practical.
- Test the desktop main view at its Windows width and wider macOS width.
- Test tool windows at their `560 x 460` minimum.
- Test the website at `320`, `375`, `768`, and desktop widths without horizontal overflow.
- Respect `prefers-reduced-motion` and avoid motion that blocks operation.
- Keep foreground, muted text, borders, state colors, and focus indicators contrast-safe.
- Preserve user data on failed operations and make destructive actions explicit or confirmable.

## Complete the work

Before handing off:

1. Run `git diff --check`.
2. Confirm no secret, local environment, build, target, or updater artifacts are staged.
3. Run the smallest focused checks plus `pnpm verify` for cross-surface or production changes.
4. Run the native build for Rust/Tauri changes.
5. Check documentation links and command names against current files.
6. Review `git status --short --branch` and the staged diff.
7. Commit only when requested, using a message that describes the actual scope.
8. Push only when requested or explicitly included in the requested workflow.
