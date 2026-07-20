import assert from "node:assert/strict";
import test from "node:test";
import {
  validateElectronReleaseAssets,
  validateReleaseVersions,
  validateUpdaterMetadata,
} from "./electron-release-lib.mjs";

const files = [
  "TheWCAG-3.0.0-mac-universal.dmg",
  "TheWCAG-3.0.0-mac-universal.zip",
  "TheWCAG-3.0.0-mac-universal.zip.blockmap",
  "TheWCAG-3.0.0-win-x64.exe",
  "TheWCAG-3.0.0-win-x64.exe.blockmap",
  "latest-mac.yml",
  "latest.yml",
];

test("release tags must match the Electron package version", () => {
  assert.equal(
    validateReleaseVersions("v3.0.0", { root: "3.0.0", desktop: "3.0.0" }),
    "3.0.0",
  );
  assert.throws(
    () => validateReleaseVersions("v3.0.1", { package: "3.0.0" }),
    /does not match/,
  );
  assert.throws(
    () => validateReleaseVersions("v3.0.0", { root: "3.0.0", desktop: "3.0.1" }),
    /do not match/,
  );
});

test("a release requires complete macOS and Windows Electron artifacts", () => {
  assert.deepEqual(validateElectronReleaseAssets(files, "3.0.0"), {
    dmg: "TheWCAG-3.0.0-mac-universal.dmg",
    exe: "TheWCAG-3.0.0-win-x64.exe",
    zip: "TheWCAG-3.0.0-mac-universal.zip",
  });
  assert.throws(
    () => validateElectronReleaseAssets(files.filter((file) => !file.endsWith(".exe.blockmap")), "3.0.0"),
    /Windows installer blockmap/,
  );
});

test("legacy Tauri updater assets are rejected", () => {
  assert.throws(
    () => validateElectronReleaseAssets([...files, "TheWCAG.app.tar.gz"], "3.0.0"),
    /legacy Tauri release assets are forbidden/,
  );
});

test("updater metadata must identify the release artifact and integrity hash", () => {
  const metadata = [
    "version: 3.0.0",
    "files:",
    "  - url: TheWCAG-3.0.0-mac-universal.zip",
    "    sha512: abc123",
  ].join("\n");
  assert.doesNotThrow(() =>
    validateUpdaterMetadata(
      "latest-mac.yml",
      metadata,
      "3.0.0",
      "TheWCAG-3.0.0-mac-universal.zip",
    ),
  );
  assert.throws(
    () => validateUpdaterMetadata("latest-mac.yml", metadata, "3.0.1", "missing.zip"),
    /does not declare version/,
  );
});
