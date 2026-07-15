export const EXPECTED_PLATFORM_KEYS = ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"];

const PLATFORM_SPECS = {
  mac: {
    ext: ".app.tar.gz",
    keys: ["darwin-aarch64", "darwin-x86_64"],
  },
  windows: {
    ext: "-setup.exe",
    keys: ["windows-x86_64"],
  },
};

export function updaterArtifact(files, platform) {
  const spec = PLATFORM_SPECS[platform];
  if (!spec) throw new Error(`unknown platform "${platform}" (use "mac" or "windows")`);
  const archives = files.filter((file) => file.endsWith(spec.ext)).sort();
  if (archives.length !== 1) {
    throw new Error(`expected exactly one ${platform} updater artifact (${spec.ext}), found ${archives.length}`);
  }
  const archive = archives[0];
  const sigFile = `${archive}.sig`;
  if (!files.includes(sigFile)) throw new Error(`missing updater signature ${sigFile}`);
  return { ...spec, archive, sigFile };
}

export function createUpdaterPartial({ platform, version, files, signature, pubDate = new Date().toISOString() }) {
  const spec = updaterArtifact(files, platform);
  const url = `https://github.com/Sairo-app/app.thewcag.com/releases/download/v${version}/${encodeURIComponent(spec.archive)}`;
  return {
    version,
    notes: `TheWCAG ${version}`,
    pub_date: pubDate,
    platforms: Object.fromEntries(spec.keys.map((key) => [key, { signature, url }])),
  };
}

function assertPartial(data, name) {
  if (!data || typeof data !== "object" || typeof data.version !== "string" || !data.version) {
    throw new Error(`${name} has no valid version`);
  }
  if (!data.platforms || typeof data.platforms !== "object" || Array.isArray(data.platforms)) {
    throw new Error(`${name} has no platforms map`);
  }
  for (const [key, entry] of Object.entries(data.platforms)) {
    if (!EXPECTED_PLATFORM_KEYS.includes(key)) throw new Error(`${name} contains unexpected platform ${key}`);
    if (!entry || typeof entry.url !== "string" || !entry.url || typeof entry.signature !== "string" || !entry.signature.trim()) {
      throw new Error(`${name} has an incomplete ${key} updater entry`);
    }
  }
}

export function mergeUpdaterPartials(namedPartials) {
  if (namedPartials.length === 0) throw new Error("no updater manifest partials supplied");
  let base = null;
  const platforms = {};
  for (const { name, data } of namedPartials) {
    assertPartial(data, name);
    if (base && data.version !== base.version) {
      throw new Error(`updater version mismatch: ${name} is ${data.version}, expected ${base.version}`);
    }
    base ??= data;
    for (const [key, entry] of Object.entries(data.platforms)) {
      if (platforms[key]) throw new Error(`duplicate updater platform ${key} in ${name}`);
      platforms[key] = entry;
    }
  }
  const missing = EXPECTED_PLATFORM_KEYS.filter((key) => !platforms[key]);
  if (missing.length) throw new Error(`updater manifest is missing: ${missing.join(", ")}`);
  return {
    version: base.version,
    notes: base.notes,
    pub_date: base.pub_date,
    platforms,
  };
}

export function validateReleaseVersions(tag, versions) {
  const entries = Object.entries(versions);
  const unique = new Set(entries.map(([, version]) => version));
  if (unique.size !== 1) {
    throw new Error(`desktop versions do not match: ${entries.map(([name, version]) => `${name}=${version}`).join(", ")}`);
  }
  const version = entries[0]?.[1];
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
    throw new Error(`desktop version is not valid SemVer: ${version ?? "missing"}`);
  }
  if (tag !== `v${version}`) throw new Error(`release tag ${tag} does not match desktop version v${version}`);
  return version;
}
