# Changelog

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
