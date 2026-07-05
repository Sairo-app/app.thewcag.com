# Accessibility.build Desktop — v1 Plan

**Product**: A macOS (later Windows) menu-bar utility for developers and
designers that makes accessibility checks instant: pick colors anywhere on
screen and get WCAG/APCA contrast verdicts, capture and annotate screenshots
of issues, and view any part of the screen through a color-blindness lens.

**Brand / distribution**: Sold and downloaded from Accessibility.build.
Free at launch; paid tier (URL scans + PDF reports) comes post-v1.

---

## Locked decisions

| Decision | Choice |
|---|---|
| Audience (v1) | Developers & designers checking their own work |
| v1 scope | 3 tools: contrast checker + eyedropper, screenshot annotator, color-blindness lens |
| Platform order | macOS first; Windows after macOS is solid |
| Pricing at launch | Free; Paddle/license wiring deferred to paid tier |
| Stack | Tauri 2 + React + TypeScript + Tailwind; Rust for the native layer |
| Distribution | Direct download + auto-update first; Mac App Store channel later (config kept dormant but compatible) |

---

## Architecture

```
accessibility-build-app/
├── PLAN.md
├── package.json                 # pnpm workspace root
├── apps/
│   └── desktop/
│       ├── src/                 # React UI (TypeScript + Tailwind)
│       │   ├── windows/         # one entry per Tauri window
│       │   │   ├── main/        # tool hub / settings
│       │   │   ├── picker/      # eyedropper HUD + contrast panel
│       │   │   ├── annotate/    # screenshot annotation canvas
│       │   │   └── lens/        # color-blindness lens (chromeless, always-on-top)
│       │   └── lib/             # UI-side helpers, IPC wrappers
│       └── src-tauri/
│           ├── src/
│           │   ├── capture.rs   # screen/region/pixel capture (xcap / ScreenCaptureKit)
│           │   ├── picker.rs    # cursor tracking + zoom-region streaming
│           │   ├── lens.rs      # region capture stream for the lens window
│           │   ├── tray.rs      # menu-bar item + menu
│           │   ├── shortcuts.rs # global hotkeys
│           │   └── permissions.rs # Screen Recording TCC status + onboarding triggers
│           ├── capabilities/    # Tauri v2 permission scopes per window
│           └── tauri.conf.json  # + tauri.mas.conf.json overlay (dormant)
└── packages/
    └── a11y-core/               # pure TS, no Tauri imports — shared with web later
        ├── contrast.ts          # WCAG 2.x ratio + AA/AAA verdicts (normal/large text, UI components)
        ├── apca.ts              # wrapper around apca-w3
        ├── colorblind.ts        # protanopia/deuteranopia/tritanopia/achromatopsia matrices
        └── formats.ts           # hex/rgb/hsl/oklch parsing + conversion
```

**Why this split**: `a11y-core` is pure TypeScript so the same contrast and
simulation logic can later power free web tools on Accessibility.build
(same playbook as Suparbase's free tools). Everything Tauri-specific stays
in `apps/desktop`.

**Key crates/deps**: `xcap` (capture), `tauri-plugin-global-shortcut`,
`tauri-plugin-updater`, `tauri-plugin-autostart` (launch at login, opt-in),
`apca-w3` (npm), Konva.js only if annotation outgrows plain canvas.

**Windows model**: one hidden main process; each tool opens its own small
chromeless window. The lens window is `always_on_top`, transparent frame,
draggable/resizable; it captures the region *behind itself* and redraws it
filtered at ~30fps (Sim Daltonism's approach — no OS-level screen filter
needed, and it stays Mac App Store-sandbox-compatible).

---

## Milestones

### M0 — Skeleton (the walking app)
Scaffold that proves the riskiest plumbing before any feature work.
- pnpm workspace + Tauri 2 app boots; tray icon with menu (Pick Color /
  Screenshot / Lens / Settings / Quit); no Dock icon (LSUIElement).
- Global hotkeys registered and configurable (defaults: ⌥⌘P pick,
  ⌥⌘S screenshot, ⌥⌘L lens).
- **Screen Recording permission onboarding**: detect TCC status, friendly
  explainer window ("why we need this"), deep-link to System Settings,
  detect grant without requiring relaunch where possible. This is the #1
  support risk for the whole product — it gets built first, not last.
- `capture.rs` proves: full-screen capture, region capture, single-pixel
  read under cursor, all on both Intel and Apple Silicon.
- CI: GitHub Actions building a signed macOS DMG on tag.

**Exit criteria**: hotkey → capture a pixel's color → show it in a window,
on a clean macOS account with no permissions pre-granted.

### M1 — Contrast checker + eyedropper (the hook)
- Magnified loupe follows cursor (zoomed region stream from Rust), click to
  lock foreground color, second click for background; ESC cancels.
- Results panel: WCAG ratio with AA/AAA pass/fail for normal text, large
  text, and UI components (3:1) **and** APCA Lc score side by side.
- Color formats: hex/rgb/hsl/oklch, click-to-copy; recent-pairs history
  (persisted locally).
- Suggested fixes: nearest passing color (lighten/darken foreground) shown
  as one-click alternatives.
- Menu-bar quick mode: pick two colors without opening the full window.

**Exit criteria**: a designer can verify any on-screen pair in under 5
seconds from hotkey press.

### M2 — Screenshot + annotation (the workflow)
- Capture modes: region (drag), window, full screen; capture the lens
  window's filtered output too (screenshot *as a colorblind user sees it*).
- Annotation canvas: arrows, rectangles, text labels, blur (for redacting),
  and an **a11y issue tag** — a numbered badge with a preset label
  (contrast, focus indicator, target size, alt text, other) + note.
- Export: PNG to clipboard/file; "copy as Markdown" bundles the image
  reference plus a numbered issue list — pastes straight into a GitHub
  issue or PR review.
- Local capture library (recent captures, reopen to re-annotate).

**Exit criteria**: capture → tag three issues → paste a ready-to-file
GitHub issue in under 2 minutes.

### M3 — Color-blindness lens (the wow)
- Floating resizable lens window; filter picker: protanopia, deuteranopia,
  tritanopia, achromatopsia (matrices from `a11y-core/colorblind.ts`,
  Machado/Brettel-based).
- ~30fps region stream behind the window, WebGL color-matrix shader in the
  lens webview; target <15% CPU on Apple Silicon at default lens size.
- Freeze-frame toggle, screenshot-the-lens shortcut, severity slider
  (anomaly vs full dichromacy).

**Exit criteria**: smooth lens dragging over a playing video without
stutter; a side-by-side capture exported in one click.

### M4 — Polish + launch
- Onboarding tour (first run), settings (hotkeys, launch at login, filter
  defaults), empty states, error states (permission revoked mid-use).
- Signing + notarization pipeline finalized; Sparkle-style auto-update via
  tauri-plugin-updater with a static JSON manifest on Accessibility.build.
- Landing page + download on Accessibility.build; basic anonymous
  usage-count telemetry (opt-in only) to learn which tool gets used.
- Launch checklist: Product Hunt, a11y newsletters/communities, before/after
  GIFs of the lens for social.

**Exit criteria**: a stranger can download, install, grant permission, and
run all three tools with zero guidance.

### Post-v1 (ordered, not scheduled)
1. **Windows port** — swap capture backend (Windows.Graphics.Capture via
   xcap), WebView2 quirks, MSI/NSIS installer, Azure Trusted Signing.
2. **Paid tier**: URL audit (axe-core injected into a Tauri webview,
   violations list with element screenshots) + branded PDF/HTML report
   export. Paddle/Lemon Squeezy checkout on the site, license key in-app.
3. **Mac App Store channel**: enable App Sandbox entitlements, strip
   updater, IAP for the paid tier, `tauri.mas.conf.json` goes live.
4. Target-size (24×24) overlay checker, text-zoom/reflow preview.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Screen Recording permission scares users / breaks silently when revoked | M0 builds the onboarding + status detection first; every capture call handles the denied state with a recovery prompt |
| Lens performance (capture→filter→draw loop) | Prototype in M0 spike; if webview canvas can't hold 30fps, fall back to smaller default lens or native Metal path later |
| `xcap` gaps on newer macOS (ScreenCaptureKit changes) | M0 exit criteria include capture on current macOS; keep a thin trait over capture so the backend is swappable |
| Future App Store sandbox compatibility | No feature may require non-sandboxable APIs; review at each milestone (current feature set is all sandbox-safe — Sim Daltonism precedent) |
| Scope creep toward the consultant workflow | v1 defers reports/scans entirely; "copy as Markdown" is the only concession to reporting |

## Success criteria for v1
- Time-to-value: hotkey → contrast verdict in <5s.
- A designer keeps it running in the menu bar after a week (retention, not installs, is the metric).
- The lens GIF is shareable enough that launch posts demo it in one loop.
