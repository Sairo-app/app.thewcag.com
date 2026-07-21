import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const EXTENSION_ID = /^[a-p]{32}$/;
const HOST_NAME = "com.thewcag.app";

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
}): Promise<boolean> {
  const extensionId = await configuredExtensionId(options.resourcesPath);
  if (!extensionId || !["darwin", "win32"].includes(options.platform)) return false;
  const manifest = `${JSON.stringify(nativeHostManifest(options.executablePath, extensionId), null, 2)}\n`;

  if (options.platform === "darwin") {
    const path = join(
      options.homePath,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      `${HOST_NAME}.json`,
    );
    await writeAtomic(path, manifest);
    return true;
  }

  const directory = join(options.resourcesPath, "native-messaging");
  const manifestPath = join(directory, `${HOST_NAME}.json`);
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
  return true;
}
