# Desktop release artifacts (served by app.thewcag.com)

Next.js serves this folder statically, so the desktop updater fetches
`https://app.thewcag.com/downloads/desktop/latest.json` from here.

For each release (from the monorepo root):

```sh
TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/accessibility-build.key" \
  pnpm --filter @accessibility-build/desktop build
node scripts/make-latest-json.mjs
# copy the DMG + .app.tar.gz(+ .sig) + dist-updater/latest.json here:
cp "apps/desktop/src-tauri/target/release/bundle/macos/TheWCAG.app.tar.gz"* apps/web/public/downloads/desktop/
cp "apps/desktop/src-tauri/target/release/bundle/dmg/"*.dmg apps/web/public/downloads/desktop/
cp dist-updater/latest.json apps/web/public/downloads/desktop/
```

Then redeploy the web service. (Large DMGs baked into the image are fine for
low volume; move to R2 + a redirect if they grow.)

Note: the updater signing key stays `~/.tauri/accessibility-build.key` — its
public key is baked into `tauri.conf.json`, so it must not be regenerated or
in-flight updates break.
