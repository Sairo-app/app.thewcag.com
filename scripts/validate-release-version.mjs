import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateReleaseVersions } from "./release-manifest-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tag = process.argv[2] ?? "";
const desktopPackage = JSON.parse(readFileSync(join(root, "apps/desktop/package.json"), "utf8"));
const tauri = JSON.parse(readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
const cargo = readFileSync(join(root, "apps/desktop/src-tauri/Cargo.toml"), "utf8");
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? "";

try {
  const version = validateReleaseVersions(tag, {
    "apps/desktop/package.json": desktopPackage.version,
    "tauri.conf.json": tauri.version,
    "Cargo.toml": cargoVersion,
  });
  console.log(`release tag and desktop versions agree: v${version}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
