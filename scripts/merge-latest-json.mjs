// Merges per-platform updater partials (latest-mac.json, latest-windows.json)
// produced by make-latest-json.mjs into one multi-platform latest.json.
//
//   node scripts/merge-latest-json.mjs <dir-with-partials>
//
// Recursively finds every latest-*.json under the given dir (CI downloads the
// build jobs' artifacts there) and unions their `platforms` maps.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeUpdaterPartials } from "./release-manifest-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const searchDir = process.argv[2] || join(root, "dist-updater");

function findPartials(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findPartials(full));
    else if (/^latest-.+\.json$/.test(entry)) out.push(full);
  }
  return out;
}

const partials = findPartials(searchDir);
if (partials.length === 0) {
  console.error(`no latest-*.json partials found under ${searchDir}`);
  process.exit(1);
}

const namedPartials = partials.map((file) => ({ name: file, data: JSON.parse(readFileSync(file, "utf8")) }));
const manifest = mergeUpdaterPartials(namedPartials);
for (const { name, data } of namedPartials) {
  console.log(`merged ${name}: ${Object.keys(data.platforms).join(", ")}`);
}

const outDir = join(root, "dist-updater");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "latest.json"), JSON.stringify(manifest, null, 2));
console.log(`wrote dist-updater/latest.json with platforms: ${Object.keys(manifest.platforms).join(", ")}`);
