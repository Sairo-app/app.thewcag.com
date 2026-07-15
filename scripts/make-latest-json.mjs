// Emits a PER-PLATFORM updater manifest partial from the bundle output, so
// the macOS and Windows CI runners can each produce their piece; a later step
// (merge-latest-json.mjs) combines them into one latest.json.
//
//   node scripts/make-latest-json.mjs mac       # universal: arm64 + Intel
//   node scripts/make-latest-json.mjs windows   # windows-x86_64
//
// Requires TAURI_SIGNING_PRIVATE_KEY at build time so Tauri emitted the
// updater archive + .sig next to the app.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createUpdaterPartial, updaterArtifact } from "./release-manifest-lib.mjs";

const platform = (process.argv[2] || "mac").toLowerCase();
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(
  readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"),
).version;
const targetDir = platform === "mac" ? "universal-apple-darwin/release" : "release";
const bundleRoot = join(root, "apps/desktop/src-tauri/target", targetDir, "bundle");
const bundleDir = join(bundleRoot, platform === "mac" ? "macos" : "nsis");

const files = readdirSync(bundleDir);
const artifact = updaterArtifact(files, platform);
const partial = createUpdaterPartial({
  platform,
  version,
  files,
  signature: readFileSync(join(bundleDir, artifact.sigFile), "utf8").trim(),
});

const outDir = join(root, "dist-updater");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `latest-${platform}.json`);
writeFileSync(outFile, JSON.stringify(partial, null, 2));
console.log(`wrote ${outFile} (${Object.keys(partial.platforms).join(", ")}, v${version})`);
