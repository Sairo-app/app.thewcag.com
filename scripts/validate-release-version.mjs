import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateReleaseVersions } from "./electron-release-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tag = process.argv[2] ?? "";
const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const desktopPackage = JSON.parse(readFileSync(join(root, "apps/desktop/package.json"), "utf8"));

try {
  const version = validateReleaseVersions(tag, {
    "package.json": rootPackage.version,
    "apps/desktop/package.json": desktopPackage.version,
  });
  console.log(`release tag and desktop versions agree: v${version}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
