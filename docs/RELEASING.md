# Releasing TheWCAG Desktop

Production Electron releases are built by `.github/workflows/release.yml` from an exact `v<desktop-version>` tag. macOS signing and notarization are mandatory. Windows installers are intentionally unsigned until a CI-compatible Authenticode service is adopted.

## Release outputs

Each GitHub Release contains:

- A signed and notarized universal macOS DMG.
- A signed and notarized universal macOS ZIP used by `electron-updater`.
- An unsigned Windows x64 NSIS installer.
- Differential update blockmaps.
- `latest-mac.yml` and `latest.yml` update metadata.
- `SHA256SUMS.txt` covering every attached Electron artifact.

The website's platform download route resolves the current DMG or NSIS installer from the same GitHub repository. Installed applications use the provider configured in `apps/desktop/electron-builder.yml`.

## One-time signing setup

### Apple Developer ID

1. Create a Developer ID Application certificate in the Apple Developer account.
2. Export the certificate and private key as a password-protected `.p12`.
3. Create an Apple app-specific password for notarization.
4. Record the 10-character Apple team ID.

### Windows distribution

The Windows installer is currently built without Authenticode signing. Users may
see an Unknown Publisher or SmartScreen warning. No Windows signing secret is
required by the release workflow.

### GitHub Actions secrets

| Secret | Purpose |
|---|---|
| `APPLE_CERTIFICATE` | Base64 `.p12` supplied to electron-builder as `CSC_LINK`. |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` password. |
| `APPLE_ID` | Apple Developer account used for notarization. |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific notarization password. |
| `APPLE_TEAM_ID` | Apple Developer team ID. |

Never commit certificates, passwords, exported keychain files, or signing environment files.

### Chrome extension pairing

Create the repository variable `THEWCAG_EXTENSION_ID` with the exact
32-character ID of the published Chrome Web Store extension. The ID contains
only the letters `a` through `p`. Release preflight rejects a missing or invalid
value, and the pack hook embeds it into both desktop platforms so the native
messaging host can allowlist only that extension origin.

## Prepare and publish

1. Update `package.json` and `apps/desktop/package.json` to the same next semantic version.
2. If the website mark changed, regenerate and inspect both native icon formats on macOS:

```sh
pnpm --filter @accessibility-build/desktop icons
```

3. Move the relevant `CHANGELOG.md` entries into that version.
4. Run the full gate and produce an unpacked native application:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm --filter @accessibility-build/desktop run pack
pnpm smoke:desktop:packaged
```

The automated Windows smoke test launches the real packaged renderer with an isolated temporary profile, skips registry and update side effects, and fails when the React root is blank or shows startup recovery.

5. Smoke-test the unpacked app on the current platform: launch, screen permission, contrast pair, region and full-screen capture, annotation save/reopen, lens, checklist persistence, sign-in, report publishing, and update check.
6. Load the release-candidate extension, connect it to the packaged desktop app,
   select an element and a region, inspect payload omission, generate both local
   and AI-assisted drafts, save into an audit, and reopen the marked evidence.
7. Commit and push the release preparation.
8. Create and push an annotated tag that exactly matches `apps/desktop/package.json`:

```sh
git tag -a v3.0.6 -m "TheWCAG v3.0.6"
git push origin v3.0.6
```

The workflow runs the repository quality gate, builds macOS and Windows in parallel, uploads the signed macOS and unsigned Windows artifacts, and creates one GitHub Release. Release artifacts are treated as immutable by policy: fixes ship under a new patch version.

## Verify the published release

1. Confirm the release contains DMG, ZIP, NSIS EXE, blockmaps, `latest-mac.yml`, and `latest.yml`.
2. Verify the version and download URLs in both update manifests.
3. Confirm the DMG and app report the expected Developer ID signature and a successful notarization ticket.
4. Confirm the Windows installer is clearly identified as unsigned and installs after the expected operating-system warning.
5. Test the website download redirect for both platforms.
6. Launch the prior production version and verify automatic update discovery, download, restart, and version change.
7. Repeat the core capture, annotation, lens, auth, and publishing smoke tests on both platforms.
8. On both platforms, confirm Chrome connects only through the published
   extension ID and that uninstalling or disabling the extension leaves the
   desktop app fully usable.

Do not replace artifacts under an existing tag. Publish a patch version when a shipped artifact needs correction so updater metadata stays immutable and monotonic.

## Local builds

```sh
# Renderer, main process, and preload only
pnpm --filter @accessibility-build/desktop build

# Unpacked app for the current platform
pnpm --filter @accessibility-build/desktop run pack

# Installers
pnpm --filter @accessibility-build/desktop dist:mac
pnpm --filter @accessibility-build/desktop dist:win
```

Local Windows packages are unsigned. Local macOS packages are development artifacts unless the Apple signing and notarization variables are present.

For a signed macOS diagnostic build, provide the same variables used by CI:

```sh
CSC_LINK="/secure/path/thewcag-developer-id.p12" \
CSC_KEY_PASSWORD="certificate-password" \
APPLE_ID="developer@example.com" \
APPLE_APP_SPECIFIC_PASSWORD="app-specific-password" \
APPLE_TEAM_ID="TEAMID1234" \
THEWCAG_EXTENSION_ID="abcdefghijklmnopabcdefghijklmnop" \
pnpm --filter @accessibility-build/desktop dist:mac
```

For Windows, run `dist:win` on a Windows host. No signing environment variables are required.

## Release invariants

- App identity remains `com.thewcag.app`; changing it affects permissions, protocol registration, secure storage, and update continuity.
- The custom `thewcag://` protocol must remain registered for browser-mediated desktop sign-in.
- The native messaging manifest must name `com.thewcag.app` and allow only the
  configured Chrome extension origin; wildcard origins are forbidden.
- macOS hardened runtime and the committed entitlements must remain enabled.
- Windows update manifests must retain their SHA-512 integrity values and come from the canonical GitHub Release.
- `latest-mac.yml`, `latest.yml`, installer files, and blockmaps must come from the same build and version.
- Legacy `.app.tar.gz`, `.sig`, and `latest.json` assets are rejected. GitHub Releases contains Electron artifacts only.
- Production renderers remain sandboxed with context isolation, no Node integration, and the IPC allowlists in preload and main kept in sync.
