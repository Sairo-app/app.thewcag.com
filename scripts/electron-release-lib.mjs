const LEGACY_ASSET_SUFFIXES = [".app.tar.gz", ".app.tar.gz.sig", "latest.json"];

export function validateReleaseVersions(tag, versions) {
  const entries = Object.entries(versions);
  const unique = new Set(entries.map(([, version]) => version));
  if (unique.size !== 1) {
    throw new Error(
      `desktop versions do not match: ${entries
        .map(([name, version]) => `${name}=${version}`)
        .join(", ")}`,
    );
  }
  const version = entries[0]?.[1];
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
    throw new Error(`desktop version is not valid SemVer: ${version ?? "missing"}`);
  }
  if (tag !== `v${version}`) {
    throw new Error(`release tag ${tag} does not match desktop version v${version}`);
  }
  return version;
}

function exactlyOne(files, predicate, label) {
  const matches = files.filter(predicate);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one ${label}, found ${matches.length}`);
  }
  return matches[0];
}

export function validateElectronReleaseAssets(files, version) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("no Electron release assets found");
  }
  const names = files.map((file) => file.split("/").pop()).filter(Boolean);
  const legacy = names.filter((name) =>
    LEGACY_ASSET_SUFFIXES.some((suffix) => name.endsWith(suffix)),
  );
  if (legacy.length) {
    throw new Error(`legacy Tauri release assets are forbidden: ${legacy.join(", ")}`);
  }

  const prefix = `TheWCAG-${version}-`;
  const dmg = exactlyOne(names, (name) => name.startsWith(prefix) && name.endsWith(".dmg"), "macOS DMG");
  const zip = exactlyOne(names, (name) => name.startsWith(prefix) && name.endsWith(".zip"), "macOS ZIP");
  const exe = exactlyOne(names, (name) => name.startsWith(prefix) && name.endsWith(".exe"), "Windows installer");
  exactlyOne(names, (name) => name === `${zip}.blockmap`, "macOS ZIP blockmap");
  exactlyOne(names, (name) => name === `${exe}.blockmap`, "Windows installer blockmap");
  exactlyOne(names, (name) => name === "latest-mac.yml", "macOS updater manifest");
  exactlyOne(names, (name) => name === "latest.yml", "Windows updater manifest");

  return { dmg, exe, zip };
}

export function validateUpdaterMetadata(name, contents, version, artifact) {
  if (!contents.includes(`version: ${version}`)) {
    throw new Error(`${name} does not declare version ${version}`);
  }
  if (!contents.includes(artifact)) {
    throw new Error(`${name} does not reference ${artifact}`);
  }
  if (!/(?:^|\n)\s*sha512:\s*\S+/m.test(contents)) {
    throw new Error(`${name} has no SHA-512 integrity value`);
  }
}
