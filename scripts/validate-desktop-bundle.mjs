import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputRoots = [
  resolve(root, "apps/desktop/out/main"),
  resolve(root, "apps/desktop/out/preload"),
];
const workspaceImport = /(?:from\s*|import\s*\()\s*["']@accessibility-build\//;

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await javascriptFiles(path));
    else if (extname(entry.name) === ".js") files.push(path);
  }
  return files;
}

const files = (await Promise.all(outputRoots.map(javascriptFiles))).flat();
const offenders = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  if (workspaceImport.test(source)) offenders.push(relative(root, file));
}

if (offenders.length > 0) {
  console.error("Desktop production bundles contain runtime imports of TypeScript workspace packages:");
  for (const file of offenders) console.error(`- ${file}`);
  console.error("Bundle these dependencies instead of externalizing them.");
  process.exit(1);
}

console.log(`desktop bundles contain no external workspace imports (${files.length} files checked)`);
