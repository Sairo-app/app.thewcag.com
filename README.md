# TheWCAG

**Instant accessibility checks, anywhere on screen.** A desktop app for macOS and Windows that checks WCAG color contrast, simulates color blindness, and turns annotated screenshots into shareable accessibility reports.

![Release](https://img.shields.io/github/v/release/Sairo-app/app.thewcag.com?label=release)
![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-2563eb)

## What it does

- **Contrast, anywhere on screen.** Pick any two pixels and read the exact WCAG 2.1/2.2 ratio, AA/AAA verdict, and APCA Lc, with worst-case detection across gradients. Not just in the browser, any app.
- **Color-blindness lens.** View any window live through protanopia, deuteranopia, tritanopia, and low-acuity vision.
- **Capture and annotate.** Grab a region, flag issues against specific WCAG success criteria, set severity, measure 24px target sizes, and probe contrast inside the capture.
- **Auditor tools.** Findings register, WCAG 2.2 checklist, and a pairwise palette contrast matrix.
- **Shareable reports.** Publish an annotated screenshot to a link anyone can open in a browser, no account needed to view.

## Download

Get the latest macOS (`.dmg`) or Windows (`.exe`) installer:

- **[app.thewcag.com/download](https://app.thewcag.com/download)** (recommended), or
- **[GitHub Releases](https://github.com/Sairo-app/app.thewcag.com/releases/latest)**

The app auto-updates. Global hotkeys are configurable in the app; defaults are `⌥⌘P` contrast, `⌥⌘S` capture, `⌥⌘L` lens (Alt+Win equivalents on Windows).

> Installers are not yet code-signed, so macOS Gatekeeper and Windows SmartScreen may warn on first launch. The app still installs and updates normally.

## Repository layout

This is a pnpm monorepo:

- **`apps/desktop`** - the Tauri 2 app (React + TypeScript UI, Rust native layer). Screen capture is cross-platform via `xcap`; the color-blindness lens uses a per-OS capture path.
- **`apps/web`** - [app.thewcag.com](https://app.thewcag.com): the account + sharing backend and marketing site (Next.js). Magic-link auth for the app, shareable reports stored in Cloudflare R2 (1 GiB per-user quota), and SEO content pages. See [apps/web/README.md](apps/web/README.md).
- **`packages/a11y-core`** - pure TypeScript accessibility math (contrast, APCA, color-blindness matrices). No Tauri imports; shared by both the app and the website.

## Development

Requirements: Node 22+, pnpm 9+, Rust stable. On macOS also install the Xcode Command Line Tools; on Windows the MSVC build tools (Visual Studio Build Tools + WebView2).

```sh
pnpm install

pnpm --filter @accessibility-build/desktop dev   # desktop app (tauri dev)
pnpm --filter @thewcag/web dev                    # website (next dev)
pnpm test                                         # a11y-core unit tests
```

## Building and releases

Build the desktop app locally:

```sh
cd apps/desktop
pnpm tauri build            # produces the installer + updater artifacts
```

Releases are automated. Push a tag and CI does the rest:

```sh
git tag v2.3.1 && git push origin v2.3.1
```

The [release workflow](.github/workflows/release.yml) builds macOS and Windows in parallel, then publishes one GitHub Release containing the `.dmg`, the `.exe`, and a multi-platform `latest.json` so the auto-updater serves both platforms. macOS notarization and Windows Authenticode signing turn on automatically when their secrets are configured.

See [CHANGELOG.md](CHANGELOG.md) for release history and [PLAN.md](PLAN.md) for the roadmap.
