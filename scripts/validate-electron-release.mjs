import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  validateElectronReleaseAssets,
  validateUpdaterMetadata,
} from "./electron-release-lib.mjs";

const directory = process.argv[2];
const version = process.argv[3];

if (!directory || !version) {
  console.error("usage: node scripts/validate-electron-release.mjs <artifact-directory> <version>");
  process.exit(1);
}

async function filesUnder(path, base = path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(next, base)));
    if (entry.isFile()) files.push(relative(base, next));
  }
  return files;
}

try {
  const files = await filesUnder(directory);
  const assets = validateElectronReleaseAssets(files, version);
  const macManifest = await readFile(join(directory, "latest-mac.yml"), "utf8");
  const windowsManifest = await readFile(join(directory, "latest.yml"), "utf8");
  validateUpdaterMetadata("latest-mac.yml", macManifest, version, assets.zip);
  validateUpdaterMetadata("latest.yml", windowsManifest, version, assets.exe);
  console.log(`validated complete Electron release v${version}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
