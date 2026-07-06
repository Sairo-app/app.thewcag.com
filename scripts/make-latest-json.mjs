// Builds the updater manifest (latest.json) from the bundle output.
// Run after `pnpm tauri build` with TAURI_SIGNING_PRIVATE_KEY set (that
// makes Tauri emit the .tar.gz updater artifact + .sig next to the app).
//
//   node scripts/make-latest-json.mjs
//
// Upload the printed artifact and dist-updater/latest.json to
// https://app.thewcag.com/downloads/desktop/
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const conf = JSON.parse(
  readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"),
);
const version = conf.version;
const bundleDir = join(root, "apps/desktop/src-tauri/target/release/bundle/macos");

const files = readdirSync(bundleDir);
const archive = files.find((f) => f.endsWith(".app.tar.gz"));
const sigFile = files.find((f) => f.endsWith(".app.tar.gz.sig"));
if (!archive || !sigFile) {
  console.error(
    "No updater artifact found. Build with TAURI_SIGNING_PRIVATE_KEY set:\n" +
      '  TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/thewcag-updater.key" pnpm tauri build',
  );
  process.exit(1);
}

const manifest = {
  version,
  notes: `TheWCAG ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "darwin-aarch64": {
      signature: readFileSync(join(bundleDir, sigFile), "utf8"),
      url: `https://app.thewcag.com/downloads/desktop/${encodeURIComponent(archive)}`,
    },
  },
};

const outDir = join(root, "dist-updater");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "latest.json"), JSON.stringify(manifest, null, 2));
console.log(`wrote dist-updater/latest.json (v${version})`);
console.log(`upload these to /downloads/desktop/ on the site:`);
console.log(`  ${join(bundleDir, archive)}`);
console.log(`  ${join(outDir, "latest.json")}`);
