# Accessibility.build Desktop

A macOS menu-bar utility that makes accessibility checks instant: pick colors
anywhere on screen and get WCAG/APCA contrast verdicts, capture and annotate
screenshots of issues, and view any part of the screen through a
color-blindness lens.

See [PLAN.md](PLAN.md) for the full roadmap. Current milestone: **M0**.

## Development

Requirements: Node 22+, pnpm 9+, Rust stable, Xcode Command Line Tools.

```sh
pnpm install
pnpm dev          # runs `tauri dev` (Vite + Rust)
pnpm test         # a11y-core unit tests
pnpm build        # signed .app + .dmg (requires signing identity)
```

Default hotkeys: ⌥⌘P pick color · ⌥⌘S screenshot.

## Layout

- `apps/desktop` — Tauri 2 app (React + TypeScript UI, Rust native layer)
- `packages/a11y-core` — pure TS accessibility math (contrast, APCA,
  colorblind matrices); no Tauri imports, reusable on the web
