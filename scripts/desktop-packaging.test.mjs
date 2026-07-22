import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  validatePackagedRuntime,
  windowsNativeHostPath,
} from "../apps/desktop/resources/after-pack.mjs";

const root = resolve(import.meta.dirname, "..");

test("desktop packaging retains Electron's Windows fallback locale", async () => {
  const config = await readFile(join(root, "apps/desktop/electron-builder.yml"), "utf8");
  assert.match(config, /electronLanguages:\s*\r?\n(?:\s*#.*\r?\n)*\s*- en-US(?:\r?\n|$)/);
});

test("Windows package validation rejects a missing locale", async () => {
  const appOutDir = await mkdtemp(join(tmpdir(), "thewcag-packaging-"));
  try {
    await assert.rejects(
      validatePackagedRuntime({ electronPlatformName: "win32", appOutDir }),
      /missing Electron's required locale/,
    );
  } finally {
    await rm(appOutDir, { recursive: true, force: true });
  }
});

test("Windows package validation rejects an empty locale", async () => {
  const appOutDir = await mkdtemp(join(tmpdir(), "thewcag-packaging-"));
  try {
    await mkdir(join(appOutDir, "locales"), { recursive: true });
    await mkdir(join(appOutDir, "resources"), { recursive: true });
    await writeFile(join(appOutDir, "locales", "en-US.pak"), "");
    await writeFile(join(appOutDir, "resources", "app.asar"), "application");
    await assert.rejects(
      validatePackagedRuntime({ electronPlatformName: "win32", appOutDir }),
      /missing Electron's required locale/,
    );
  } finally {
    await rm(appOutDir, { recursive: true, force: true });
  }
});

test("Windows package validation rejects a missing application archive", async () => {
  const appOutDir = await mkdtemp(join(tmpdir(), "thewcag-packaging-"));
  try {
    await mkdir(join(appOutDir, "locales"), { recursive: true });
    await writeFile(join(appOutDir, "locales", "en-US.pak"), "locale");
    await assert.rejects(
      validatePackagedRuntime({ electronPlatformName: "win32", appOutDir }),
      /missing the packaged application archive/,
    );
  } finally {
    await rm(appOutDir, { recursive: true, force: true });
  }
});

test("Windows package validation rejects a missing native messaging host", async () => {
  const appOutDir = await mkdtemp(join(tmpdir(), "thewcag-packaging-"));
  try {
    await mkdir(join(appOutDir, "locales"), { recursive: true });
    await mkdir(join(appOutDir, "resources"), { recursive: true });
    await writeFile(join(appOutDir, "locales", "en-US.pak"), "locale");
    await writeFile(join(appOutDir, "resources", "app.asar"), "application");
    await assert.rejects(
      validatePackagedRuntime({ electronPlatformName: "win32", appOutDir }),
      /missing the binary-safe Chrome native messaging host/,
    );
  } finally {
    await rm(appOutDir, { recursive: true, force: true });
  }
});

test("Windows package validation accepts a complete runtime", async () => {
  const appOutDir = await mkdtemp(join(tmpdir(), "thewcag-packaging-"));
  try {
    const locales = join(appOutDir, "locales");
    const resources = join(appOutDir, "resources");
    await mkdir(locales, { recursive: true });
    await mkdir(resources, { recursive: true });
    await writeFile(join(locales, "en-US.pak"), "locale");
    await writeFile(join(resources, "app.asar"), "application");
    await mkdir(join(resources, "native-messaging"), { recursive: true });
    await writeFile(windowsNativeHostPath(appOutDir), "native host");
    await validatePackagedRuntime({ electronPlatformName: "win32", appOutDir });
  } finally {
    await rm(appOutDir, { recursive: true, force: true });
  }
});
