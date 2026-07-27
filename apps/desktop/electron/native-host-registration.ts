import { execFile } from "node:child_process";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, posix, win32 } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const EXTENSION_ID = /^[a-p]{32}$/;
const HOST_NAME = "com.thewcag.app";
const WINDOWS_HOST_EXECUTABLE = "TheWCAG.NativeHost.exe";

export async function configuredExtensionId(resourcesPath: string): Promise<string | null> {
  const fromEnvironment = process.env.THEWCAG_EXTENSION_ID?.trim();
  if (fromEnvironment && EXTENSION_ID.test(fromEnvironment)) return fromEnvironment;
  try {
    const value = (await readFile(join(resourcesPath, "native-messaging", "extension-id.txt"), "utf8")).trim();
    return EXTENSION_ID.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** Firefox allowlists an add-on id, not a `chrome-extension://` origin. */
const GECKO_ID = /^[^\s@]+@[^\s@]+$|^\{[0-9a-fA-F-]{36}\}$/;

export const DEFAULT_GECKO_ID = "extension@thewcag.com";

export function configuredGeckoId(): string {
  const fromEnvironment = process.env.THEWCAG_GECKO_ID?.trim();
  return fromEnvironment && GECKO_ID.test(fromEnvironment) ? fromEnvironment : DEFAULT_GECKO_ID;
}

export function nativeHostManifest(executablePath: string, extensionId: string): Record<string, unknown> {
  if (!EXTENSION_ID.test(extensionId)) throw new Error("Invalid Chrome extension ID");
  return {
    name: HOST_NAME,
    description: "TheWCAG local audit bridge",
    path: executablePath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}

export function firefoxNativeHostManifest(executablePath: string, geckoId: string): Record<string, unknown> {
  if (!GECKO_ID.test(geckoId)) throw new Error("Invalid Firefox add-on ID");
  return {
    name: HOST_NAME,
    description: "TheWCAG local audit bridge",
    path: executablePath,
    type: "stdio",
    allowed_extensions: [geckoId],
  };
}

export function nativeHostExecutablePath(options: {
  platform: NodeJS.Platform;
  resourcesPath: string;
  executablePath: string;
}): string {
  return options.platform === "win32"
    ? win32.join(options.resourcesPath, "native-messaging", WINDOWS_HOST_EXECUTABLE)
    : options.executablePath;
}

export function nativeHostManifestPath(options: {
  platform: NodeJS.Platform;
  homePath: string;
  userDataPath: string;
}): string | null {
  if (options.platform === "darwin") {
    return posix.join(
      options.homePath,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      `${HOST_NAME}.json`,
    );
  }
  if (options.platform === "win32") {
    return win32.join(options.userDataPath, "native-messaging", `${HOST_NAME}.json`);
  }
  return null;
}

/**
 * Firefox reads its own directory on macOS and its own registry key on Windows,
 * so the manifest is written twice rather than shared with Chrome's location.
 */
export function firefoxNativeHostManifestPath(options: {
  platform: NodeJS.Platform;
  homePath: string;
  userDataPath: string;
}): string | null {
  if (options.platform === "darwin") {
    return posix.join(
      options.homePath,
      "Library",
      "Application Support",
      "Mozilla",
      "NativeMessagingHosts",
      `${HOST_NAME}.json`,
    );
  }
  if (options.platform === "win32") {
    return win32.join(options.userDataPath, "native-messaging", `${HOST_NAME}.firefox.json`);
  }
  return null;
}

async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
}

export async function registerNativeMessagingHost(options: {
  platform: NodeJS.Platform;
  resourcesPath: string;
  executablePath: string;
  homePath: string;
  userDataPath: string;
}): Promise<boolean> {
  const extensionId = await configuredExtensionId(options.resourcesPath);
  const manifestPath = nativeHostManifestPath(options);
  if (!extensionId || !manifestPath) return false;
  const hostExecutablePath = nativeHostExecutablePath(options);
  if (options.platform === "win32") {
    await access(hostExecutablePath);
  }
  const manifest = `${JSON.stringify(nativeHostManifest(hostExecutablePath, extensionId), null, 2)}\n`;
  const firefoxPath = firefoxNativeHostManifestPath(options);
  const firefoxManifest = `${JSON.stringify(
    firefoxNativeHostManifest(hostExecutablePath, configuredGeckoId()),
    null,
    2,
  )}\n`;

  if (options.platform === "darwin") {
    await writeAtomic(manifestPath, manifest);
    // Firefox may not be installed; its directory is created regardless so the
    // bridge works the moment the add-on is added.
    if (firefoxPath) await writeAtomic(firefoxPath, firefoxManifest);
    return true;
  }

  await writeAtomic(manifestPath, manifest);
  await run("reg.exe", [
    "ADD",
    `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
    "/ve",
    "/t",
    "REG_SZ",
    "/d",
    manifestPath,
    "/f",
  ], { windowsHide: true });
  if (firefoxPath) {
    await writeAtomic(firefoxPath, firefoxManifest);
    await run("reg.exe", [
      "ADD",
      `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${HOST_NAME}`,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      firefoxPath,
      "/f",
    ], { windowsHide: true });
  }
  return true;
}
