import test from "node:test";
import assert from "node:assert/strict";
import {
  createUpdaterPartial,
  mergeUpdaterPartials,
  updaterArtifact,
  validateReleaseVersions,
} from "./release-manifest-lib.mjs";

test("a universal mac archive serves both native updater targets", () => {
  const files = ["TheWCAG.app.tar.gz", "TheWCAG.app.tar.gz.sig"];
  const partial = createUpdaterPartial({
    platform: "mac",
    version: "2.4.0",
    files,
    signature: "signed",
    pubDate: "2026-01-01T00:00:00.000Z",
  });
  assert.deepEqual(Object.keys(partial.platforms), ["darwin-aarch64", "darwin-x86_64"]);
  assert.equal(partial.platforms["darwin-aarch64"].url, partial.platforms["darwin-x86_64"].url);
});

test("artifact selection rejects missing signatures and ambiguous bundles", () => {
  assert.throws(() => updaterArtifact(["TheWCAG.app.tar.gz"], "mac"), /missing updater signature/);
  assert.throws(
    () => updaterArtifact(["a-setup.exe", "a-setup.exe.sig", "b-setup.exe", "b-setup.exe.sig"], "windows"),
    /exactly one/,
  );
});

test("manifest merge requires every desktop target and one consistent version", () => {
  const mac = createUpdaterPartial({
    platform: "mac",
    version: "2.4.0",
    files: ["TheWCAG.app.tar.gz", "TheWCAG.app.tar.gz.sig"],
    signature: "mac-sig",
  });
  const windows = createUpdaterPartial({
    platform: "windows",
    version: "2.4.0",
    files: ["TheWCAG-setup.exe", "TheWCAG-setup.exe.sig"],
    signature: "win-sig",
  });
  const merged = mergeUpdaterPartials([
    { name: "mac", data: mac },
    { name: "windows", data: windows },
  ]);
  assert.deepEqual(Object.keys(merged.platforms).sort(), ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]);
  assert.throws(() => mergeUpdaterPartials([{ name: "mac", data: mac }]), /missing: windows-x86_64/);
  assert.throws(
    () => mergeUpdaterPartials([{ name: "mac", data: mac }, { name: "windows", data: { ...windows, version: "2.5.0" } }]),
    /version mismatch/,
  );
});

test("release tags must match all desktop version sources", () => {
  assert.equal(validateReleaseVersions("v2.4.0", { package: "2.4.0", tauri: "2.4.0", cargo: "2.4.0" }), "2.4.0");
  assert.throws(() => validateReleaseVersions("v2.5.0", { package: "2.4.0", tauri: "2.4.0" }), /does not match/);
  assert.throws(() => validateReleaseVersions("v2.4.0", { package: "2.4.0", tauri: "2.3.0" }), /do not match/);
});
