# Changelog

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
