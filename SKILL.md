---
name: accessibility-build-app
description: Maintain TheWCAG's Electron accessibility workstation, Next.js service, shared accessibility math, storage, authentication, publishing, and signed GitHub Releases.
---

# Maintain TheWCAG

## Repository truth

Work from the monorepo root, preserve unrelated changes, and treat runtime source,
tests, package manifests, Electron configuration, and workflows as authoritative.
Keep desktop, web, shared math, documentation, and release behavior aligned.

| Area | Primary location |
|---|---|
| Electron main, preload, native services, IPC | `apps/desktop/electron/` |
| React workstation and native-window views | `apps/desktop/src/app/` |
| Shared desktop contracts | `apps/desktop/src/shared/desktop.ts` |
| Annotation geometry and rendering | `apps/desktop/src/lib/annotate/` |
| WCAG, APCA, formats, suggestions, CVD | `packages/a11y-core/src/` |
| Next.js site, auth, reports, and admin | `apps/web/` |
| Signed Electron delivery | `.github/workflows/release.yml`, `apps/desktop/electron-builder.yml` |

## Desktop invariants

- Electron is the only desktop runtime.
- Keep renderers sandboxed with context isolation, no Node integration, blocked
  navigation, denied web permissions, a restrictive CSP, and trusted-sender IPC.
- Keep the preload and main-process channel allowlists synchronized.
- Treat macOS and Windows as first-class targets. Preserve multi-monitor and
  high-DPI coordinate conversion, screen-permission recovery, content protection,
  configurable transactional shortcuts, native menus, tray behavior, and updates.
- Keep captures local until explicit publishing. Sanitize store keys and capture
  IDs before constructing paths and use atomic persistence.
- Preserve the bounded one-time importer for data from earlier desktop releases.
- Store device tokens only in macOS Keychain or Windows Credential Manager.

## Website and data invariants

- Authenticate and authorize device, report, branding, and admin operations on the
  server. Store only token hashes in Postgres.
- Validate PNGs, metadata bounds, ownership, and quota before R2 writes; clean up
  R2 whenever database work fails or records are deleted.
- Keep `lib/schema.ts`, Drizzle migrations, and startup migrations aligned.
- Keep production builds database-lazy and fail production startup on migration
  failure.
- Preserve public report `noindex` behavior and unguessable slugs.

## Accessibility invariants

- Preserve keyboard operation, visible focus, semantic names and states, live
  status announcements, reduced motion, and contrast-safe UI.
- Test the website at 320 px and the desktop at its 920 by 640 minimum without
  horizontal overflow.
- Keep accessibility math deterministic and covered at threshold boundaries.
  Reuse `a11y-core` instead of duplicating contrast logic.

## Release invariants

- The release tag must exactly match `apps/desktop/package.json`.
- Production releases require Apple Developer ID signing and notarization.
  Windows installers are published unsigned and must be identified honestly in
  release notes until a CI-compatible Authenticode service is adopted.
- GitHub Releases is the only installer and update source. Require DMG, universal
  ZIP, NSIS EXE, blockmaps, `latest-mac.yml`, `latest.yml`, and checksums.
- Native icons are generated from `apps/web/public/logo.png` with
  `pnpm --filter @accessibility-build/desktop icons`.
- Never commit certificates, keys, passwords, environment files, build output, or
  generated release artifacts.

## Commands

```sh
pnpm dev
pnpm --filter @accessibility-build/desktop dev:vite
pnpm --filter @thewcag/web dev
pnpm verify
pnpm --filter @accessibility-build/desktop run pack
```

Before handoff, run focused tests, `pnpm verify`, `git diff --check`, inspect the
staged diff, and verify the packaged native renderer still has `--enable-sandbox`.
