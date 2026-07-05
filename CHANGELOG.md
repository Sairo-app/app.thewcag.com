# Changelog

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
