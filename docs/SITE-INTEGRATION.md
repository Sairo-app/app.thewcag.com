# Extension, desktop, and website integration

TheWCAG ships one product across three deliberately separated surfaces:

- The Chrome extension owns user-initiated webpage selection, contextual visual
  and semantic evidence capture, payload review, and draft editing.
- The Electron app owns local screen capture, contrast inspection, annotation,
  audit state, browser-evidence persistence, the native extension bridge, the
  vision lens, native shortcuts, encrypted device and AI-provider credentials,
  provider selection, and offline work.
- The Next.js service owns browser authentication, device authorization,
  authorized AI generation, report publishing, account administration, public
  report links, and the platform download redirect.

The extension does not send evidence directly to the website. It connects to the
desktop through Chrome Native Messaging. The desktop never embeds the website as
its application shell. It opens the system browser for sign-in and communicates
with the service over HTTPS only when a connected feature is requested.

## Connection paths

### Extension to desktop

1. The desktop installer embeds the exact 32-character production extension ID.
2. The desktop registers the `com.thewcag.app` native host for the current user
   when the application starts.
3. Chrome permits only the allowlisted extension origin to start that host.
4. Each request and response uses a versioned, size-bounded JSON contract.
5. The native host exposes audit summaries, stores approved evidence and
   confirmed findings, and forwards generation requests without revealing the
   account bearer token to Chrome.

If the desktop app is unavailable, the extension still captures evidence and can
create a local structured draft. Audit persistence and all provider-backed AI
drafting require the desktop connection.

### Desktop to website

The desktop contacts `app.thewcag.com` over HTTPS for device authorization,
entitlement checks, managed AI generation, report publishing, and release
downloads. When OpenAI, Claude, or OpenRouter is active, the Electron main process
contacts that provider directly and the website is not in the request path. The
website is not involved in local extension capture, native messaging, audit
storage, bring-your-own-key requests, or offline exports.

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
preload bridge exposes only account operations and redacted provider status. A
saved AI key can be replaced, verified, selected, or removed, but never read back.

## Report publishing

The report draft remains local until the user explicitly publishes it. Publishing
requires a signed-in account, a selected capture, reviewed findings, and the
sensitive-information attestation.

`POST /api/device/screenshots` validates the bearer token, PNG signature, payload
size, issue count, and storage quota before writing the image to R2 and metadata to
Postgres. Public reports are available at `/s/[slug]`; images are streamed through
`/api/s/[slug]/image`. Deleting reports or users also removes the associated R2
objects.

## AI-assisted finding drafts

The extension first shows the exact screenshot, element text, and sanitized page
address that could be sent. The auditor can withhold each section independently
and must approve the payload explicitly. The extension sends the bounded evidence
packet to the desktop native host, which uses the provider selected in Settings:

- **TheWCAG managed** adds the encrypted device credential and posts to
  `POST /api/device/ai/findings`. The service enforces account limits and records
  operational usage only, not evidence or generated content.
- **OpenAI** calls the Responses API directly with the user's encrypted key.
- **Claude** calls Anthropic's Messages API directly with the user's encrypted key.
- **OpenRouter** calls its chat-completions API directly with the user's encrypted key.

All paths use a constrained JSON schema, replace model-supplied WCAG names and
levels with the versioned local catalog, and validate the complete draft against
the shared audit contract. Withheld screenshots, element text, and page addresses
are omitted before the request is built. The editable draft returns through the
desktop to the extension for human review. Nothing is saved as a finding until the
auditor confirms it.

## Downloads and updates

GitHub Releases is the only desktop artifact source. The website route
`/api/desktop/download?os=mac|windows` resolves the latest non-prerelease release
through the GitHub API and redirects to its DMG or NSIS installer.

Tagged builds publish:

- A signed and notarized universal macOS DMG and ZIP.
- An unsigned Windows x64 NSIS installer.
- Electron differential-update blockmaps.
- `latest-mac.yml` and `latest.yml` for `electron-updater`.
- `SHA256SUMS.txt` for manual verification.

The release workflow rejects legacy archive formats and will not publish when any
platform artifact, updater manifest, integrity value, or required Apple signing
credential is missing. Do not copy installers into `apps/web/public`; the stable
download route keeps the website independent of application bundle size.

## Shared contracts

- `apps/desktop/src/shared/desktop.ts` defines the main, preload, and renderer IPC
  contract.
- `packages/audit-contracts` defines evidence, AI draft, WCAG mapping, and native
  messaging contracts shared by the extension, desktop, and website.
- `packages/a11y-core` contains deterministic WCAG, APCA, color conversion, and
  color-vision calculations shared by product surfaces.
- The custom protocol remains `thewcag://` and the app identifier remains
  `com.thewcag.app` so existing sign-in links, permissions, and updates continue
  to work.

## Security invariants

- Screen content stays local until explicit publishing.
- Extension evidence stays local until explicit generation consent or publishing.
- The native host accepts only the configured extension ID and never returns the
  desktop bearer token.
- Device tokens never enter localStorage, renderer logs, or report payloads.
- AI-provider keys never enter localStorage, the extension, report payloads, or
  renderer-facing configuration. At rest they are an encrypted, mode-`0600` file.
- Browser navigation and popups are blocked in Electron; external HTTPS links use
  the system browser.
- Renderers use the Chromium sandbox, context isolation, no Node integration, and
  a restrictive content security policy.
- The website verifies authorization and ownership server-side for every device,
  report, branding, and administrative operation.

See [RELEASING.md](RELEASING.md) for signing, tagging, and GitHub Release steps.
