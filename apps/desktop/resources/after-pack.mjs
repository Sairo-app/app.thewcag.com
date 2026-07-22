import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";

const run = promisify(execFile);
const WINDOWS_NATIVE_HOST = "TheWCAG.NativeHost.exe";

export function windowsNativeHostPath(appOutDir) {
  return join(appOutDir, "resources", "native-messaging", WINDOWS_NATIVE_HOST);
}

function windowsCSharpCompiler() {
  const windows = process.env.WINDIR || process.env.SystemRoot || "C:\\Windows";
  return [
    join(windows, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe"),
    join(windows, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe"),
  ];
}

export async function compileWindowsNativeHost(context) {
  if (context.electronPlatformName !== "win32") return null;
  const output = windowsNativeHostPath(context.appOutDir);
  const directory = join(context.appOutDir, "resources", "native-messaging");
  const source = join(context.packager.projectDir, "resources", "native-host", "WindowsNativeHost.cs");
  await mkdir(directory, { recursive: true });

  let compiler = null;
  for (const candidate of windowsCSharpCompiler()) {
    if (await stat(candidate).then((details) => details.isFile()).catch(() => false)) {
      compiler = candidate;
      break;
    }
  }
  if (!compiler) throw new Error("Windows package requires the .NET Framework C# compiler");

  await run(compiler, [
    "/nologo",
    "/optimize+",
    "/target:exe",
    `/out:${output}`,
    source,
  ], { windowsHide: true });
  return output;
}

export async function validatePackagedRuntime(context) {
  if (context.electronPlatformName !== "win32") return;
  const requiredFiles = [
    {
      path: join(context.appOutDir, "locales", "en-US.pak"),
      description: "Electron's required locale",
    },
    {
      path: join(context.appOutDir, "resources", "app.asar"),
      description: "the packaged application archive",
    },
    {
      path: windowsNativeHostPath(context.appOutDir),
      description: "the binary-safe Chrome native messaging host",
    },
  ];
  for (const required of requiredFiles) {
    try {
      const details = await stat(required.path);
      if (!details.isFile() || details.size === 0) throw new Error("empty");
    } catch {
      throw new Error(`Windows package is missing ${required.description}: ${required.path}`);
    }
  }
}

/**
 * electron-builder injects broad macOS usage descriptions and enables
 * NSAllowsArbitraryLoads in its base Electron plist. TheWCAG denies those
 * permissions at runtime and only connects to HTTPS, so remove the unused
 * declarations before signing and make App Transport Security explicit.
 */
export default async function afterPack(context) {
  await compileWindowsNativeHost(context);
  await validatePackagedRuntime(context);

  const extensionId = (process.env.THEWCAG_EXTENSION_ID || "").trim();
  if (/^[a-p]{32}$/.test(extensionId)) {
    const resources = context.electronPlatformName === "darwin"
      ? join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : join(context.appOutDir, "resources");
    const directory = join(resources, "native-messaging");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "extension-id.txt"), `${extensionId}\n`, { mode: 0o600 });
  }

  if (context.electronPlatformName !== "darwin") return;
  const plist = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    "Contents",
    "Info.plist",
  );

  await run("/usr/bin/plutil", [
    "-replace",
    "NSAppTransportSecurity.NSAllowsArbitraryLoads",
    "-bool",
    "NO",
    plist,
  ]);

  for (const key of [
    "NSAudioCaptureUsageDescription",
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSBluetoothAlwaysUsageDescription",
    "NSBluetoothPeripheralUsageDescription",
  ]) {
    await run("/usr/bin/plutil", ["-remove", key, plist]).catch(() => undefined);
  }
}
