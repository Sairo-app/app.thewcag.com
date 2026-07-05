# Releasing Accessibility Build

## One-time setup (requires your Apple account)

1. Join the [Apple Developer Program](https://developer.apple.com/programs/)
   ($99/yr).
2. In Xcode (or developer.apple.com → Certificates), create a
   **Developer ID Application** certificate and export it as `certificate.p12`
   with a password.
3. Create an app-specific password for notarization at
   [appleid.apple.com](https://appleid.apple.com) → Sign-In & Security.
4. Add these GitHub Actions secrets (Settings → Secrets → Actions):

   | Secret | Value |
   |---|---|
   | `APPLE_CERTIFICATE` | `base64 -i certificate.p12` |
   | `APPLE_CERTIFICATE_PASSWORD` | the p12 export password |
   | `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAMID)` |
   | `APPLE_ID` | your Apple ID email |
   | `APPLE_PASSWORD` | the app-specific password |
   | `APPLE_TEAM_ID` | your 10-character team ID |
   | `TAURI_SIGNING_PRIVATE_KEY` | contents of `~/.tauri/accessibility-build.key` |

   The updater keypair already exists at `~/.tauri/accessibility-build.key`
   (private — never commit) and its public key is baked into
   `tauri.conf.json`. **Back the private key up**; losing it means shipped
   apps can never update again.

## Every release

```sh
# 1. bump the version in apps/desktop/src-tauri/tauri.conf.json (+ Cargo.toml,
#    package.json), update CHANGELOG.md, commit
# 2. build signed + updater artifacts locally:
TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/accessibility-build.key" \
  pnpm --filter @accessibility-build/desktop build
# 3. generate the updater manifest:
node scripts/make-latest-json.mjs
# 4. upload the printed .app.tar.gz + latest.json to
#    https://accessibility.build/downloads/desktop/  (same folder as the DMG)
# 5. upload the DMG for new users, tag the release:
git tag v<version> && git push --tags   # CI builds the signed DMG too
```

Users on older versions see an "Update & restart" banner on next launch.

## Signing locally

With the certificate installed in your login keychain:

```sh
APPLE_SIGNING_IDENTITY="Developer ID Application: … (TEAMID)" \
APPLE_ID=… APPLE_PASSWORD=… APPLE_TEAM_ID=… \
TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/accessibility-build.key" \
  pnpm --filter @accessibility-build/desktop build
```

Tauri signs, notarizes and staples automatically when these are set. Signed
builds keep the Screen Recording permission across updates — the
re-grant-every-build pain only affects ad-hoc dev builds.

## Mac App Store (later)

The MAS build needs: App Sandbox entitlements, the updater stripped,
`macOSPrivateApi` disabled (vibrancy falls back to opaque), IAP for the paid
tier, and the lens migrated to ScreenCaptureKit (see `docs/SCK-MIGRATION.md`).
