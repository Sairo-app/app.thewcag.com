# Changelog

## v3.0.6 - 2026-07-22

**Faster website navigation**

- Removed the root App Router loading boundary that replaced every page with “Loading TheWCAG…” during ordinary navigation.
- Decoupled the public header from the blocking server-side session lookup so marketing pages can render and cache independently while account controls hydrate in place.
- Kept Screenshot tool visible as its own primary website destination and preserved the current reporting, integration, pricing, onboarding, and accessibility content.

**Standalone screenshot workflow**

- Added a dedicated Screenshot tool in the desktop utility navigation for region or full-screen capture, annotation, local copy/export, and intentional unlisted sharing without creating an audit.
- Kept standalone captures outside the active audit while reusing the production annotation engine, capture repository, native menus, shortcuts, and sharing path.
- Preserved finding-owned multi-capture evidence and the guided audit capture context introduced in the v3.0.5 workflow hardening.

**Finding identity integrity**

- Added immutable `WCG-F-YYYYMMDD-…` IDs with 130 bits of cryptographic entropy for issue badges, manual and AI-assisted findings, extension evidence, imports, exports, and published reports.
- Added local allocation-ledger repair, publishing-boundary validation, a non-recycling database registry, compact copyable UI labels, and regression coverage for duplicate and legacy records.
- Merged extension-to-desktop review intake, optional live OpenRouter authoring coverage, remediation status, report filtering, and public finding-ID presentation.

**Release quality**

- Reconciled the v3.0.5 audit-planning, guided-session, billing, security, accessibility-scan, packaging, and macOS notarization work with the new screenshot and identity systems.
- Updated the Electron release version to `3.0.6`; the `v3.0.6` tag triggers signed and notarized universal macOS artifacts plus the Windows release build.

## v3.0.4 - 2026-07-22

**Windows reliability**

- Fixed the installed Windows blank-window failure by retaining Electron's required `en-US` runtime locale and rejecting broken packages during release builds.
- Added visible startup failure recovery, renderer-process diagnostics, writable per-user Chrome native-host registration, and explicit isolated-profile support for packaged smoke tests.

**Audit planning**

- Added an auditor-controlled scoper with bounded public same-origin page inspection, exact representative URLs, template grouping, explained product-type and feature detection, eight built-in templates, guided test matrices, and a readiness gate before inspection.
- Added portable, bounded scoper metadata; invalidation after material manual scope changes; local-calendar start dates; safe cross-audit loading; and reset of stale final conclusions when a plan is replaced.
- Added a read-only Audit Coverage Map that connects each representative sample to guided runs, captures, findings, and mapped WCAG decisions, highlights trace gaps, preserves unassigned legacy work, and opens the relevant existing workflow screen.

**Guided audit sessions**

- Added a focused Inspect session with one-action next-test selection, exact sample location, step observations, run and sample status, contextual evidence capture, and full finding authoring in one workspace.
- Linked new runs, captures, and findings to their sample and test context without breaking older audits, and preserved those relationships through integrity-checked package export and import.
- Required every completed guided step to include an observation across planning, session progress, delivery readiness, and exported records.

**Build quality**

- Added repository-wide ESLint, packaging, and scoper regression coverage and made local Windows web builds avoid unsupported standalone symlink creation while preserving Linux and Docker standalone output.
- Upgraded Drizzle ORM and the PostCSS resolution to patched releases so the production dependency audit has no known vulnerabilities.

**Website onboarding**

- Added a responsive first-time audit guide with seven original screenshots captured from the current Windows desktop application, including the Audit Coverage Map and Guided Audit Session, detailed Plan-to-Deliver instructions, full-size image links, privacy and readiness callouts, HowTo metadata, and navigation/sitemap integration.
- Reframed the homepage workflow preview with original responsive SVG evidence artwork, focus and WCAG signals, reduced-motion-safe animation, and stable interactive Capture, AI Draft, Review, and Deliver states.

**Optional Pro hosted services**

- Kept the complete local audit workflow, exports, deterministic drafts, and bring-your-own-key AI free while adding one optional Pro plan for managed AI, hosted reports, analytics, storage, and hosted branding.
- Integrated Dodo Payments hosted checkout and customer portal with signed, bounded, idempotent, order-safe webhooks; allowlisted products; normalized entitlements; checkout/portal rate limits; lifecycle reconciliation; refund/dispute revocation; and billing-first account deletion.
- Added private report-object delivery, active-link and byte quotas, seven/thirty-day link grace, scheduled retention cleanup, legacy-report migration grace, versioned desktop entitlement states, pricing/account/billing UI, admin billing health, legal disclosures, and an operations runbook.

**Integrity, privacy, and product accuracy**

- Isolated every audit-scoped view during workspace changes, reset publication consent per capture, hardened report-publish follow-up handling, and required exact sample locations plus completed guided runs before a complete-audit conclusion.
- Bound and structurally validated public screenshot uploads, added expiring and revocable desktop tokens, account/device management, report-view deduplication, stricter security headers, versioned production migrations, and public privacy and terms pages.
- Corrected public contrast and screenshot documentation so it describes the current Electron workflow instead of shortcuts, zoom behavior, gradient analysis, or verdicts that are not present in the current renderer.

## v3.0.3 - 2026-07-22

**Auditor-controlled AI providers**

- Added production integrations for OpenAI, Anthropic Claude, and OpenRouter with provider-specific model selection, connection verification, bounded responses, timeout handling, and clear error recovery.
- Added a dedicated desktop settings interface for saving, testing, activating, replacing, and removing provider credentials without exposing complete API keys back to the renderer.
- Kept AI evidence sharing explicit and consent-based, with editable drafts, local fallback behavior, and provider provenance attached to generated findings.

**Desktop experience**

- Added immutable `WCG-F-YYYYMMDD-…` identities for browser evidence, screenshot issue badges, manual findings, checklist findings, imports, exports, and published reports, backed by local non-reuse safeguards and a global published-ID registry.
- Completed the responsive workspace pass across compact and resizable sidebars, settings, capture, evidence, review, delivery, and narrow-window layouts.
- Improved provider setup, validation feedback, empty states, keyboard focus, text wrapping, overflow containment, and destructive-action safeguards.

**Website**

- Rebuilt the homepage hero around the complete Capture, AI Draft, Review, and Deliver workflow with a compact keyboard-operable product preview.
- Updated the product story for the desktop application, Chrome evidence extension, user-selected AI providers, WCAG review, and controlled report publishing.
- Recalibrated orange action surfaces to use cream foreground text with WCAG AA contrast and added automated color-token regression tests.

## v3.0.2 - 2026-07-22

**Desktop startup hotfix**

- Bundled the TypeScript workspace contracts into Electron's production main process instead of loading raw source from packaged `node_modules`, fixing `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` at startup.
- Removed raw internal workspace packages from the application archive and added a release guard that rejects external workspace imports in the built main or preload bundles.
- Fixed the existing-window path so a second launch, Dock activation, or authentication callback focuses the running application without recursive window creation.
- Added regression coverage for the single-instance focus path and verified the corrected packaged macOS application through first-launch and second-launch smoke tests.

## v3.0.1 - 2026-07-21

**Professional auditor workflow**

- Completed the auditor speed and repeatability phase with built-in web, regression, desktop, and document audit templates plus reusable personal templates.
- Added guided authentication, checkout, forms, media, document, and component test runs with step observations and explicit progress or blocked states.
- Added keyboard-first checklist rows, configurable decision and navigation keys, a visible shortcut reference, and undo for the last decision.
- Added stable `F-001` style finding references, repeated-failure duplication, occurrence tracking, before-and-after evidence comparison, built-in and personal finding views, selected-item export, and undoable bulk owner, workflow status, severity, and target-date changes.
- Added complete local audit package import and export with bounded schema validation, SHA-256 integrity verification, capture and annotation preservation, ID remapping, and rollback when an import fails.
- Extended Markdown and printable HTML audit records with guided-run outcomes, stable references, repeat occurrences, duplication provenance, and remediation comparisons.
- Added Plan as the first workflow stage, with evaluation goals, included and excluded scope, test environments, assistive-technology coverage, methodology, auditor ownership, readiness gaps, and a structured representative sample of pages, flows, components, documents, and application states.
- Added criterion-level manual verification prompts and direct W3C Understanding references for every supported WCAG 2.2 Level A and AA success criterion, while keeping the prompts explicitly informative rather than normative.
- Corrected checklist, workspace, review, and export totals so a Level A target never counts Level AA criteria.
- Added manual finding authoring with evidence linkage, affected-user groups, severity rationale, remediation ownership, ticket and target-date tracking, accepted-risk rationale, status and severity filtering, and auditor-focused sorting.
- Added failure-to-finding traceability, required rationale for not-applicable decisions at delivery, required retest records before a finding can be marked verified fixed, and required rationale before risk can be accepted.
- Added portable Markdown and self-contained printable HTML audit exports covering the evaluation plan, structured sample, findings, remediation and retest records, evidence inventory, every applicable checklist decision, limitations, and the auditor's conclusion.
- Added guarded audit conclusions and delivery readiness checks that clearly distinguish a focused evidence report from a complete audit and prevent unresolved, incomplete, or contradictory records from being mistaken for a conformance-ready evaluation.
- Added a phased auditor product roadmap covering workflow speed, reusable templates, engineering integrations, collaboration, accessible reporting, advanced evidence, and enterprise trust controls.

**AI-assisted browser evidence**

- Added a privacy-first Manifest V3 Chrome extension with a toolbar quick-capture popup and a separate expanded evidence workspace, keyboard-accessible element and region selection, contextual high-DPI screenshots with clearly highlighted targets, sanitized semantic and DOM context, deterministic checks, explicit payload consent, structured draft editing, and local Markdown export.
- Added versioned shared contracts for browser evidence, AI finding drafts, WCAG 2.2 mappings, audit summaries, and the extension-to-desktop native protocol with strict bounds and validation tests.
- Added an allowlisted Electron native messaging host for macOS and Windows. It exposes audit summaries without credentials, sends authenticated generation requests from the desktop process, and saves confirmed `FindingV2` records plus local evidence and activity.
- Expanded the Evidence workspace with collapsible structured findings, contextual highlighted browser-evidence previews, affected-user groups, WCAG rationale and confidence, recommended fixes, example code, and manual confirmation tasks.
- Added a device-authenticated AI finding endpoint with explicit consent enforcement, per-account hourly and daily limits, strict structured output validation, WCAG allowlisting, privacy-safe metadata-only usage records, provider refusal handling, and a deterministic local fallback when AI is unavailable.
- Added the complete architecture, privacy model, release setup, and acceptance plan in `docs/AI-EXTENSION-IMPLEMENTATION.md`, and extended `pnpm verify` to cover the contracts and extension.

**Website and discoverability**

- Added dedicated indexable product pages for the complete accessibility audit workstation and Chrome evidence extension, with accurate availability, privacy, system-boundary, and platform-signing information.
- Updated the homepage, downloads, public guides, header, footer, sitemap, web manifest, social preview, canonical URLs, structured data, and cross-page product navigation to describe the current Plan, Inspect, Evidence, Review, and Deliver workflow.
- Centralized route metadata so every public SEO page has consistent Open Graph, Twitter, canonical, keyword, and indexability settings.
- Updated the public accessibility statement to cover the desktop app and Chrome extension and to avoid making an unsupported full-conformance claim.

**Release**

- Prepared desktop version 3.0.1 and extension version 0.2.0 for the tag-driven GitHub release workflow.
- Documented the local Chrome Native Messaging connection and the separate authenticated website path for AI generation, report publishing, accounts, and downloads.

## v3.0.0 — 2026-07-21

**Desktop**

- Rebuilt the desktop product from scratch on Electron with a sandboxed main,
  preload, and renderer architecture while preserving the existing web auth,
  publishing, and local-data contracts.
- Added the staged audit workstation: Inspect, Evidence, Review, and Share,
  plus a searchable command bar, real audit switcher, contextual metrics, and
  activity history in a light cream, charcoal, and orange visual system.
- Isolated captures, findings, checklist state, contrast history, palettes,
  activity, and published reports by audit, with automatic legacy migration.
- Added an accountable report draft that requires capture selection, included
  finding review, a sensitive-information attestation, and sign-in before the
  existing publishing service can create a public link.
- Rebuilt contrast inspection, multi-monitor high-DPI capture, the protected
  color-vision lens, annotation and crop tools, capture library, findings,
  the complete 55-criterion WCAG 2.2 checklist, palette matrix, settings,
  secure sign-in, report publishing, and integrity-checked automatic updates.
- Added atomic JSON and capture persistence, bounded IPC validation, one-time
  legacy desktop data migration, OS-encrypted credentials, global shortcuts, native
  menus and tray, reduced motion, permission guidance, and browser preview.
- Added Electron main-process and storage tests plus desktop and compact-window
  visual QA with explicit keyboard-label and overflow checks.
- Added keyboard movement and semantic selection for canvas annotations,
  filterable command navigation, visible pressed states, deletion recovery,
  and responsive behavior down to the 920 by 640 minimum window.
- Added clean, persistent resizing for the workflow navigation, audit status,
  annotation tools, and annotation properties panels, with mouse, keyboard,
  double-click reset, and compact-window safeguards.
- Replaced every native application and installer icon with the canonical
  orange website mark and added a reproducible macOS and Windows icon generator.
- Removed the former Rust runtime, obsolete renderer windows, static updater
  artifacts, and legacy release-manifest tooling. Electron is now the only
  desktop runtime in the repository.

**Web**

- Rebuilt the homepage and public marketing pages as the original Audit Lab
  system: warm cream canvas, compact IBM Plex typography, olive-ink hairlines,
  focused orange actions, practical pastel tool cards, and a keyboard-operable
  Contrast/Evidence/Vision playground. Added `DESIGN.md` to preserve the visual,
  responsive, interaction, and accessibility rules across future pages.
- Added an accessible mobile navigation down to 320px, stronger production
  security headers, enforced build-time type validation, fail-fast production
  migrations, and aligned platform requirements with the desktop configuration.
- Hardened device authorization nonces, bounded public report issue metadata,
  serialized per-account storage quota checks, and made logo replacement
  rollback-safe with file-signature and active-SVG validation.

**Release safety**

- Extended `pnpm verify` to run Electron service tests and the production
  main/preload/renderer build.
- Replaced the Tauri release pipeline with electron-builder: universal signed
  and notarized macOS DMG/ZIP output, unsigned Windows NSIS output,
  differential blockmaps, and electron-updater platform manifests.
- Tagged releases must match the desktop package version and have all required
  Apple signing and notarization credentials. Windows installers are published
  unsigned and identified as such in the GitHub release.
- GitHub Releases now reject legacy Tauri assets, validate the complete Electron
  installer and updater set, publish checksums, and explicitly mark the new
  Electron release as latest.

## v2.4.0 — 2026-07-09

The editor release: Snagit-class ergonomics, kept WCAG-native.

**Desktop**

- **Wider launch window**: opens at 900×740 (maximizable), with a two-column
  workspace — capture tools up top, contrast + auditor tools left, your
  library (account, captures, recent pairs, log, shortcuts) right.
- **Captures gallery**: past captures render as thumbnails showing your
  annotations (not the bare screenshot); click to reopen, edit and share.
- **Annotate editor overhaul**:
  - Two-row toolbar: big labeled tools on top, a contextual properties bar
    (severity quick-styles, palette, redact options, undo/zoom) below, and an
    Export menu (Markdown / Jira / report sheet) beside a primary Share button.
  - **Filmstrip**: recent captures along the bottom; one click switches
    captures in place.
  - **Crop tool (C)**, non-destructive: the crop becomes a new capture with
    annotations shifted along; the original stays in the library.
  - **Severity quick-styles**: Blocker/Major/Minor sets the sticky severity
    and draw color in one click.
  - Status bar with capture dimensions, per-tool hints and findings count.
- **Share without annotations**: publishing no longer requires markup; a bare
  screenshot shares as a clean image.
- **Flash-free windows**: every tool window is created hidden and revealed
  after its UI is ready — no more unpainted-frame blink.

**Web (app.thewcag.com)**

- Screenshot-first public share page (logo-only header, viewer layout).
- **White-label branding**: set a logo, name and accent color at /brand with a
  live report preview; shared links lead with your brand.
- **Admin panel** at /admin (gated by ADMIN_EMAILS): users, reports, storage.
- Auth-aware header, sign-in reachable, favicon, icons in nav + footer, three
  new SEO pages (WCAG 2.2 checklist, APCA explainer, alt-text guide).

## v2.3.0 — 2026-07-08

- **Windows support**: cross-platform capture via xcap, per-OS keychain,
  Windows lens capture-exclusion, NSIS installer + updater artifacts.
- Release pipeline hardening: correct Windows updater artifact naming,
  notarized-vs-ad-hoc macOS build split, responsive Annotate/Lens toolbars.

## v2.2.0 — 2026-07-06

Bold, clean, professional UI pass.

- Brand accent switched to the **TheWCAG orange** (from the TW logo) across
  buttons, active states, focus rings and the contrast wash; white text on
  orange for strong, confident primary actions.
- The **TW logo** now sits in the main-window header beside a heavier
  wordmark.
- The contrast ratio is the hero: rendered much larger and extra-bold.
- Cards are crisper with a defined border and soft depth shadow; larger
  radius for a more premium feel.

## v2.1.0 — 2026-07-06

Production release pipeline + React 19.

- **Distribution via GitHub Releases**: tagging `v*` builds the signed DMG +
  updater artifacts and publishes a GitHub Release with them. The
  auto-updater reads `releases/latest/download/latest.json`; the DMG is a
  public download. `app.thewcag.com/api/desktop/download` is a stable
  "always latest" link.
- Publish endpoint and account link now target `/screenshots` on
  app.thewcag.com.
- Monorepo unified on **React 19** (desktop upgraded from 18).

Note: until an Apple Developer ID cert is in the repo secrets, the DMG is
ad-hoc signed and macOS shows an "unidentified developer" prompt on first
launch. The CI notarizes automatically once the secrets are present.

## v2.0.0 — 2026-07-06 — TheWCAG

Rebrand to **TheWCAG**, with a dedicated backend at **app.thewcag.com**.

- Product renamed to TheWCAG (window title, wordmark, tray, copy). New bundle
  identifier `com.thewcag.app` and `thewcag://` deep-link scheme — a fresh
  install (re-grant Screen Recording once).
- Account + sharing now point at **app.thewcag.com** (was accessibility.build):
  magic-link sign-in, device authorization, and report publishing hit the new
  `/api/device/*` endpoints; the auto-updater reads
  `app.thewcag.com/downloads/desktop/latest.json`.
- New **apps/web** in the monorepo: a lean Next.js service (Auth.js magic-link
  via Resend · Postgres for metadata + auth · Cloudflare R2 for image blobs ·
  Docker/Coolify) that does exactly two things — authenticate the app and
  store/share report images at public `/reports/<slug>` links.

## v1.7.2 — 2026-07-06

- App icon is now the real Accessibility.build brand mark (the white "A"),
  regenerated from the site's `android-chrome-512x512.png` for the Dock,
  Finder and installer. The menu-bar tray icon is derived from the same
  mark as a monochrome template that adapts to light/dark menu bars
  (`scripts/make-tray-from-brand.mjs`).
- Removed the permission status dot from the header — the setup card
  already communicates whether Screen Recording is granted.

## v1.7.1 — 2026-07-06

Hardened the shared-report portal.

- Published reports now carry a description (severity counts + WCAG criteria)
  shown on the public share page alongside a severity summary and a
  copy-link button.
- Report images are validated as real PNGs within a size cap before storage;
  slug allocation retries on the (astronomically unlikely) collision.
- New **My shared reports** page on the site (`/reports`) to review, copy
  links for, and delete published reports — deleting revokes the link.

## v1.7.0 — 2026-07-06

Five new tools for logging and auditing issues — all fully local.

- **Findings Register** — a persistent master list of every issue you log,
  with a status workflow (open / in-progress / fixed / won't-fix), search
  and severity/status filters, inline editing, manual entries, and CSV /
  Markdown / HTML export. Issues you tag in Capture & Annotate flow in
  automatically (deduped) whenever you export or publish.
- **WCAG 2.2 Checklist** — the full Level A + AA success criteria grouped by
  principle, each with pass / fail / N-A and a note, a progress bar, and
  Markdown / HTML export. Persisted between sessions.
- **Focus-order tool** in the annotation editor (press O) — click elements
  in sequence to draw a numbered, connected tab-order path for auditing
  WCAG 2.4.3 Focus Order.
- **Palette contrast matrix** — paste a design system's hex colors and get
  the full pairwise WCAG contrast grid with AA/AA-large/fail shading and CSV
  export.
- **Measure Screen** — freeze the screen and drag to measure any element in
  physical pixels, with live WCAG 2.5.8 target-size (24×24) verdicts; drop
  as many measurements as you like, no capture required.

All three tool windows open from the tray and the main window; the register
and checklist persist to a local store under Application Support.

## v1.6.0 — 2026-07-06

Share annotated reports through the Accessibility.build portal.

- **Share button** in the annotation editor publishes the one-page finding
  sheet (annotated image + issue table) to your account and returns a
  public `accessibility.build/reports/<id>` link — copied to the clipboard
  and opened in the browser in one click.
- The shared page renders the image and a numbered findings list with
  severity colors and WCAG criteria, plus social-preview cards (the report
  image is the OG image) — paste the link in Slack/Jira/GitHub and it
  unfurls. Requires sign-in (v1.5.0); revoked tokens fall back gracefully.
- Reports are unlisted (unguessable slug, noindex) so client screenshots
  stay private-by-link.

Site side (branch `feat/desktop-integration`): `publishedReports` table +
migration 0011, `POST /api/desktop/reports`, `GET /api/reports/[slug]/image`,
public `/reports/[slug]` page with OG/Twitter meta.

## v1.5.0 — 2026-07-06

Sign in with your Accessibility.build account.

- **Account sign-in** via the browser: the app opens the site's Clerk-authed
  connect page, which hands a device token back through the
  `accessibility-build://` deep link. The token is stored in the macOS
  Keychain — never on disk in plaintext.
- **Shared credits**: the main window shows your email and live credit
  balance pulled from the site; the same balance you top up on the web.
- **Entitlements** endpoint tells the app which paid features are unlocked
  (URL scans, AI alt-text, cloud reports) — the backbone for the paid tier.
- **Revocable devices**: each connection is a row you can kill from the
  site; the app falls back to signed-out if its token is revoked.
- Sign out clears the Keychain token.

Site side (separate repo, branch `feat/desktop-integration`): `desktopDevices`
table + migration, `/desktop/connect` page, `/api/desktop/entitlements`,
`/api/desktop/devices`, `/api/desktop/download`, `latest.json` no-cache
header, `/desktop` page + JSON-LD. See docs/SITE-INTEGRATION.md.

## v1.4.0 — 2026-07-06

The annotation editor, rebuilt properly.

**Never lose work**
- Every capture becomes a document: pixels + annotations saved to the app
  library, autosaved continuously — close the window, reopen from the new
  "Captures" card in the main window, keep editing
- Corrupted or missing docs degrade gracefully to a fresh canvas

**Engine**
- Editor logic extracted into pure modules (model / geometry / render):
  precise segment hit-testing for arrows, cached rendering, per-tool logic
- Zoom & pan viewport: pinch or ⌘scroll to zoom, scroll to pan, ⌘0 fit,
  ⌘+/⌘−, space-drag; exports always at true pixel size

**Tools**
- Auto-measure: click any element — flood-fill detects its bounds and
  drops a measured box with the 2.5.8 verdict (drag still works)
- Contrast probe (P): click two pixels in the capture for a ratio pill
  with AA verdict; attaches as evidence to the selected issue's note
- Solid redaction is now the default (pixelation can be reversed on text;
  it remains available as a style)
- Issue badges are colored by severity (blocker red / major amber / minor
  gray) — triage readable at a glance, palette stays for drawing tools
- Issue templates: choosing a criterion pre-fills an editable finding note
- Shift constrains arrows to 45° and boxes to squares; ghost badge number
  follows the cursor; hovering an issue in the panel highlights its badge
- "Report" export: one-page finding sheet PNG — annotated image on top,
  numbered issue table (criterion, severity, note) below

## v1.3.0 — 2026-07-06

The launch-readiness release.

**Distribution**
- Auto-updater: signed update artifacts, in-app "Update & restart" banner,
  manifest generator (`scripts/make-latest-json.mjs`), CI uploads updater
  artifacts; endpoint https://accessibility.build/downloads/desktop/latest.json
- Developer ID signing + notarization fully wired in CI and documented in
  docs/RELEASING.md — activates the moment Apple credentials are added
- New app icon (brand-blue squircle, split contrast disc) and a proper
  monochrome template tray icon that adapts to menu-bar light/dark
- /desktop download page added to the Accessibility.build site (branch
  `feat/desktop-app-page` in the site repo)

**Tools**
- Multi-monitor: every display gets a frozen overlay; a text-color pick on
  one screen carries to the others for cross-display pairs
- Countdown HUD during delayed capture — closes itself right before the
  frame freezes so it never appears in the shot
- Session log: every checked pair, capture and annotated export accumulates
  into a card in the main window; copy or save the whole session as a
  Markdown audit summary
- Annotate: resize handles on arrows, boxes, redactions and measures;
  double-click text labels to edit them
- First-run onboarding tour (three steps + permission prompt)

**Docs**
- docs/SCK-MIGRATION.md: concrete plan for moving the lens from the
  deprecated CGWindowListCreateImage to ScreenCaptureKit (needed for the
  Mac App Store build; current API works through macOS 15)

## v1.2.0 — 2026-07-06

Apple-grade UI, two overlay bug fixes, and the auditor feature set.

**Look & feel**
- Native macOS vibrancy (translucent window over desktop blur), overlay
  title bar with hidden title, macOS-style segmented controls and switches
- Consistent micro-animations with Apple spring easing; full
  `prefers-reduced-motion` support; focus-visible rings everywhere

**Fixes**
- Picker loupe now appears immediately at screen center (was invisible
  until the mouse moved)
- Overlay ignores clicks for 250ms after opening — the click that launched
  the tool can no longer register as a pick or drop a stray badge

**Auditor features**
- Delayed capture (3s) for hover states, menus, tooltips — tray items and
  hover "3s" buttons on the tool cards
- Worst-case contrast over gradients/images: during the background step,
  drag a region to find its lowest-contrast pixel vs your text color
- Anti-aliased-edge warning in the loupe ("edge — nudge ←→")
- Text-size modes (normal / large / UI) with a single AA verdict, correct
  thresholds (4.5:1 vs 3:1) and matching fix targets
- "Copy finding" — one-click audit sentence with WCAG SC reference
- CVD-simulated ratios (protan/deutan/tritan/mono) shown live; flags pairs
  that pass normally but fail under color-vision deficiency (1.4.1)
- Annotate: issue types mapped to WCAG SCs (1.4.3, 2.4.7, 2.5.8, 1.1.1,
  4.1.2, 2.1.1, 1.4.1), severity per issue (blocker/major/minor), measure
  tool (M) with auto 2.5.8 target-size fail flag, Copy Jira export
- Lens: severity slider (anomalous trichromacy, Machado interpolation),
  low-vision filters — blur (B) and low contrast sensitivity (L)

## v1.1.0 — 2026-07-06

Customizable shortcuts + a depth pass on all three tools.

**Keyboard shortcuts**
- Fully customizable from the main window: click a shortcut, press the new
  combo. Persisted to disk, applied instantly, conflict-checked, and rolled
  back automatically if macOS rejects the combo. Tray menu labels follow.

**Contrast picker**
- Arrow keys nudge the pick point one physical pixel (⇧ = 10) for
  pixel-perfect picking; Enter/Space picks; C copies the hovered hex
- Live AA / AA-large / fail badge in the loupe while choosing the
  background color
- Copy buttons on both hex fields; suggestions now include background
  fixes as well as text fixes; history has a Clear button

**Capture & annotate**
- Undo/redo (⌘Z / ⇧⌘Z) across add, move, and delete
- Tool hotkeys: V select · I issue · A arrow · R box · X redact · T text
- Space in the capture overlay grabs the full screen (no dragging)
- Issue badges use the selected palette color with auto-contrast numerals

**Colorblind lens**
- Split view (D or the ◧ button): left half original, right half filtered,
  with labels — ideal for before/after screenshots
- 1–5 switch filters, Space freezes

## v1.0.0 — 2026-07-06

First full release. Three tools, one menu-bar app (macOS).

**Contrast checker (⌥⌘P)**
- Frozen-frame fullscreen picker with a magnified pixel loupe
- Two-click text/background picking with a live ratio readout in the loupe
- WCAG 2.x verdicts (AA/AAA, normal/large text, UI components) + APCA Lc
- "Make it pass" — one-click nearest AA-passing color suggestions
- Editable hex fields, swap, live preview, history of recent pairs

**Capture & annotate (⌥⌘S)**
- Drag-to-select region capture with pixel dimensions
- Annotation editor: numbered issue badges (contrast / focus indicator /
  target size / alt text / label / keyboard / other) with notes, arrows,
  boxes, redaction (pixelate), and text labels
- Export: save PNG, copy PNG to clipboard, and Copy Markdown — a
  GitHub-ready numbered issue list

**Colorblind lens (⌥⌘L)**
- Always-on-top floating lens showing the screen behind it through
  protanopia / deuteranopia / tritanopia / achromatopsia simulation
  (Machado matrices, WebGL)
- Captures *below* the window, so the lens never sees itself
- Freeze frame and save-what-the-lens-sees

**App**
- Theme mirrors accessibility.build (same HSL tokens), auto light/dark
- Screen Recording permission onboarding with System Settings deep-link
- Launch at login, tray menu, full-screen capture to Desktop
- ~6MB app bundle (Tauri 2)

## v0.1.0 — 2026-07-06

M0 skeleton: tray app, global hotkeys, capture layer, a11y-core, CI.
