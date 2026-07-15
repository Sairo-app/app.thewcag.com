# Releasing TheWCAG Desktop

Production desktop releases are created by the tag-triggered GitHub Actions workflow in `.github/workflows/release.yml`. The workflow requires signed macOS, signed Windows, and signed Tauri updater artifacts; it fails before building when any mandatory credential is missing.

Do not manually upload production installers or updater manifests. Use local builds only for development or release diagnosis.

## Release outputs

A successful `v*` tag publishes one GitHub Release containing:

- A signed, notarized, and stapled macOS DMG.
- The signed macOS `.app.tar.gz` updater archive and `.sig`.
- An Authenticode-signed Windows NSIS `-setup.exe` installer and updater `.sig`.
- A multi-platform `latest.json` updater manifest.

The application reads the manifest from:

```text
https://github.com/Sairo-app/app.thewcag.com/releases/latest/download/latest.json
```

The public website resolves `/api/desktop/download?os=mac|windows` to the corresponding installer in the latest GitHub Release.

## One-time signing setup

### Apple Developer ID

1. Join the Apple Developer Program.
2. Create a **Developer ID Application** certificate.
3. Export the certificate and private key as a password-protected `.p12`.
4. Create an Apple app-specific password for notarization.
5. Record the exact signing identity and 10-character team ID.

### Windows Authenticode

1. Obtain a Windows code-signing certificate accepted by SmartScreen and Authenticode.
2. Export the certificate and private key as a password-protected `.pfx`.
3. Base64-encode the `.pfx` as one uninterrupted value for GitHub Actions.

### Tauri updater

The updater public key is committed in `apps/desktop/src-tauri/tauri.conf.json`. Its matching private key signs updater artifacts.

Back up the private key and its password securely. Never commit them. Losing this key prevents already-installed applications from accepting future updates signed by a replacement key.

### GitHub Actions secrets

Configure these repository Actions secrets:

| Secret | Required | Value |
|---|---:|---|
| `APPLE_CERTIFICATE` | Yes | Base64-encoded Developer ID `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Yes | Password used to export the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Yes | `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` | Yes | Apple Developer account email |
| `APPLE_PASSWORD` | Yes | Apple app-specific password |
| `APPLE_TEAM_ID` | Yes | 10-character Apple team ID |
| `WINDOWS_CERTIFICATE` | Yes | Base64-encoded Authenticode `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | Yes | Password used to export the `.pfx` |
| `TAURI_SIGNING_PRIVATE_KEY` | Yes | Full Tauri updater private key contents |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Yes | Updater private-key password |
| `WINDOWS_TIMESTAMP_URL` | No | Certificate issuer timestamp URL; defaults to DigiCert |

The release preflight treats every entry marked **Yes** as mandatory. This is intentional: unsigned production artifacts must never be published as a fallback.

## Prepare a release

1. Choose the next semantic version.
2. Synchronize that version in:
   - `apps/desktop/package.json`
   - `apps/desktop/src-tauri/Cargo.toml`
   - `apps/desktop/src-tauri/tauri.conf.json`
3. Move the relevant entries from `CHANGELOG.md`'s Unreleased section into the new version heading.
4. Confirm the updater endpoint and public key in `tauri.conf.json` are unchanged unless performing a deliberate updater migration.
5. Install and run the complete quality gate:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

6. Validate native integration on the current development platform:

```sh
pnpm --filter @accessibility-build/desktop tauri build --debug --no-bundle
```

7. Review the final diff, commit it, and push `main`.

Do not use the root workspace package version as the desktop release version. The three desktop files listed above are the release source of truth.

## Publish the release

Create an annotated tag only after the preparation commit is present on `main`:

```sh
git tag -a v2.4.1 -m "TheWCAG v2.4.1"
git push origin v2.4.1
```

Use the exact `v<desktop-version>` format. The workflow runs four stages:

1. `release-preflight` verifies all mandatory signing credentials.
2. `quality` installs with the frozen lockfile and runs `pnpm verify`.
3. `build-mac` and `build-windows` build and sign platform artifacts in parallel.
4. `publish` merges updater partials and creates the GitHub Release.

Monitor all jobs. A pushed tag is not a successful release until the `publish` job completes and the GitHub Release contains every expected artifact.

## Verify the published release

After the workflow succeeds:

1. Open the GitHub Release and confirm the DMG, macOS updater archive/signature, Windows installer/signature, and `latest.json` are present.
2. Inspect `latest.json` and confirm its version matches the tag and its platform URLs point to that same release.
3. Download both installers through `https://app.thewcag.com/download` or the platform-specific API redirect.
4. Confirm the macOS package reports a valid Developer ID signature and notarization.
5. Confirm Windows reports the expected Authenticode signer and timestamp.
6. Launch the previous production version and verify it discovers, installs, and restarts into the new version.
7. Smoke-test contrast capture, annotation, the lens, sign-in, report publishing, and report viewing on both platforms.

Do not replace artifacts underneath an already-published updater manifest. If a shipped release is invalid, fix the problem and publish a new patch version so installed clients see an immutable, monotonic update path.

## Local builds

### Unsigned development bundle

```sh
pnpm --filter @accessibility-build/desktop build
```

Local builds are unsigned unless signing credentials are available. They are suitable for development and internal diagnostics, not distribution.

### Signed macOS diagnostic build

With the Developer ID certificate installed in the current keychain:

```sh
APPLE_SIGNING_IDENTITY="Developer ID Application: Name (TEAMID)" \
APPLE_ID="developer@example.com" \
APPLE_PASSWORD="app-specific-password" \
APPLE_TEAM_ID="TEAMID1234" \
TAURI_SIGNING_PRIVATE_KEY_PATH="/secure/path/to/updater-private-key" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="updater-key-password" \
pnpm --filter @accessibility-build/desktop build
```

Use environment injection from a secure secret manager where possible. Avoid placing secrets in shell history.

### Updater manifest diagnostics

After a signed platform build has produced its updater archive and signature:

```sh
node scripts/make-latest-json.mjs mac
node scripts/make-latest-json.mjs windows
node scripts/merge-latest-json.mjs dist-updater
```

Each platform command must run on a filesystem containing that platform's `target/release/bundle` output. CI runs them on separate platform workers and merges downloaded partials during `publish`.

`dist-updater/` is generated and ignored. Never commit generated manifests or signatures.

## Platform notes

- The base Tauri bundle configuration targets macOS app/DMG output and requires macOS 12 or later.
- `tauri.windows.conf.json` changes the Windows bundle to NSIS and supplies the compact Windows main-window configuration.
- The current updater scripts emit `darwin-aarch64` and `windows-x86_64` platform keys. Adding another architecture requires a build job, an updater artifact, and a manifest entry for that exact Tauri target.
- The bundle identifier currently ends in `.app`. Tauri warns about this on macOS; changing it is an application identity, permission, keychain, and update migration—not a routine patch-release edit.
- A future Mac App Store build requires separate sandbox entitlements, no direct updater, `macOSPrivateApi` disabled, and the lens migration described in `SCK-MIGRATION.md`.
