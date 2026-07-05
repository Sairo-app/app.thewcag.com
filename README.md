# Accessibility.build Desktop

A macOS menu-bar utility that makes accessibility checks instant: pick colors
anywhere on screen and get WCAG/APCA contrast verdicts, capture and annotate
screenshots of issues, and view any part of the screen through a
color-blindness lens.

See [PLAN.md](PLAN.md) for the roadmap and [CHANGELOG.md](CHANGELOG.md) for
releases. Current version: **v1.0.0** (contrast checker, capture + annotate,
colorblind lens).

Default hotkeys: ⌥⌘P check contrast · ⌥⌘S capture & annotate · ⌥⌘L lens.

## Development

Requirements: Node 22+, pnpm 9+, Rust stable, Xcode Command Line Tools.

```sh
pnpm install
pnpm dev          # runs `tauri dev` (Vite + Rust)
pnpm test         # a11y-core unit tests
pnpm build        # signed .app + .dmg (requires signing identity)
```

## Layout

- `apps/desktop` — Tauri 2 app (React + TypeScript UI, Rust native layer)
- `packages/a11y-core` — pure TS accessibility math (contrast, APCA,
  colorblind matrices); no Tauri imports, reusable on the web
