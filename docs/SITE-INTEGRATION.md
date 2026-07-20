# Desktop and website integration

TheWCAG ships one product across two surfaces:

- The Electron app owns local screen capture, contrast inspection, annotation,
  audit state, the vision lens, native shortcuts, and offline work.
- The Next.js service owns browser authentication, device authorization,
  report publishing, account administration, public report links, and the
  platform download redirect.

The desktop never embeds the website as its application shell. It opens the
system browser for sign-in and communicates with the service over HTTPS.

## Authentication

1. The app creates a random state nonce and opens `/connect` in the system browser.
2. The authenticated page verifies the request and returns a device token through
   the registered `thewcag://auth` protocol.
3. The Electron main process requires an exact state match before accepting the
   token.
4. The raw token is stored in macOS Keychain or Windows Credential Manager.
5. Postgres stores only the SHA-256 token hash. Devices can be revoked from the
   account and administrative surfaces.

Renderer code never receives native credential-vault access. The allowlisted
preload bridge exposes only the account operations required by the UI.

## Report publishing

The report draft remains local until the user explicitly publishes it. Publishing
requires a signed-in account, a selected capture, reviewed findings, and the
sensitive-information attestation.

`POST /api/device/screenshots` validates the bearer token, PNG signature, payload
size, issue count, and storage quota before writing the image to R2 and metadata to
Postgres. Public reports are available at `/s/[slug]`; images are streamed through
`/api/s/[slug]/image`. Deleting reports or users also removes the associated R2
objects.

## Downloads and updates

GitHub Releases is the only desktop artifact source. The website route
`/api/desktop/download?os=mac|windows` resolves the latest non-prerelease release
through the GitHub API and redirects to its DMG or NSIS installer.

Tagged builds publish:

- A signed and notarized universal macOS DMG and ZIP.
- An Authenticode-signed Windows x64 NSIS installer.
- Electron differential-update blockmaps.
- `latest-mac.yml` and `latest.yml` for `electron-updater`.
- `SHA256SUMS.txt` for manual verification.

The release workflow rejects legacy archive formats and will not publish when any
platform artifact, updater manifest, integrity value, or signing credential is
missing. Do not copy installers into `apps/web/public`; the stable download route
keeps the website independent of application bundle size.

## Shared contracts

- `apps/desktop/src/shared/desktop.ts` defines the main, preload, and renderer IPC
  contract.
- `packages/a11y-core` contains deterministic WCAG, APCA, color conversion, and
  color-vision calculations shared by product surfaces.
- The custom protocol remains `thewcag://` and the app identifier remains
  `com.thewcag.app` so existing sign-in links, permissions, and updates continue
  to work.

## Security invariants

- Screen content stays local until explicit publishing.
- Device tokens never enter localStorage, renderer logs, or report payloads.
- Browser navigation and popups are blocked in Electron; external HTTPS links use
  the system browser.
- Renderers use the Chromium sandbox, context isolation, no Node integration, and
  a restrictive content security policy.
- The website verifies authorization and ownership server-side for every device,
  report, branding, and administrative operation.

See [RELEASING.md](RELEASING.md) for signing, tagging, and GitHub Release steps.
