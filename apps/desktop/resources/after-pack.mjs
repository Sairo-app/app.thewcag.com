import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const run = promisify(execFile);

/**
 * electron-builder injects broad macOS usage descriptions and enables
 * NSAllowsArbitraryLoads in its base Electron plist. TheWCAG denies those
 * permissions at runtime and only connects to HTTPS, so remove the unused
 * declarations before signing and make App Transport Security explicit.
 */
export default async function afterPack(context) {
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
