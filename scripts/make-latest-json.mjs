// Emits a PER-PLATFORM updater manifest partial from the bundle output, so
// the macOS and Windows CI runners can each produce their piece; a later step
// (merge-latest-json.mjs) combines them into one latest.json.
//
//   node scripts/make-latest-json.mjs mac       # darwin-aarch64
//   node scripts/make-latest-json.mjs windows   # windows-x86_64
//
// Requires TAURI_SIGNING_PRIVATE_KEY at build time so Tauri emitted the
// updater archive + .sig next to the app.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const platform = (process.argv[2] || "mac").toLowerCase();
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(
  readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"),
).version;
const bundleRoot = join(root, "apps/desktop/src-tauri/target/release/bundle");

// Per-platform: where the updater archive lives, its extension, and the
// updater target key the Tauri updater looks up at runtime.
const SPECS = {
  mac: { dir: "macos", ext: ".app.tar.gz", key: "darwin-aarch64" },
  windows: { dir: "nsis", ext: "-setup.nsis.zip", key: "windows-x86_64" },
};
const spec = SPECS[platform];
if (!spec) {
  console.error(`unknown platform "${platform}" (use "mac" or "windows")`);
  process.exit(1);
}

const bundleDir = join(bundleRoot, spec.dir);
const files = readdirSync(bundleDir);
const archive = files.find((f) => f.endsWith(spec.ext));
const sigFile = files.find((f) => f.endsWith(`${spec.ext}.sig`));
if (!archive || !sigFile) {
  console.error(
    `No ${platform} updater artifact (${spec.ext}) in ${bundleDir}. Build with TAURI_SIGNING_PRIVATE_KEY set.`,
  );
  process.exit(1);
}

const partial = {
  version,
  notes: `TheWCAG ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    [spec.key]: {
      signature: readFileSync(join(bundleDir, sigFile), "utf8"),
      url: `https://github.com/Sairo-app/app.thewcag.com/releases/download/v${version}/${encodeURIComponent(archive)}`,
    },
  },
};

const outDir = join(root, "dist-updater");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `latest-${platform}.json`);
writeFileSync(outFile, JSON.stringify(partial, null, 2));
console.log(`wrote ${outFile} (${spec.key}, v${version})`);
