import { describe, expect, it } from "vitest";
import {
  nativeHostExecutablePath,
  nativeHostManifest,
  nativeHostManifestPath,
} from "./native-host-registration";

describe("native host registration", () => {
  it("pins the exact extension origin and executable", () => {
    const manifest = nativeHostManifest("/Applications/TheWCAG.app/Contents/MacOS/TheWCAG", "abcdefghijklmnopabcdefghijklmnop");
    expect(manifest).toEqual({
      name: "com.thewcag.app",
      description: "TheWCAG local audit bridge",
      path: "/Applications/TheWCAG.app/Contents/MacOS/TheWCAG",
      type: "stdio",
      allowed_origins: ["chrome-extension://abcdefghijklmnopabcdefghijklmnop/"],
    });
  });

  it("rejects a wildcard or malformed extension ID", () => {
    expect(() => nativeHostManifest("/tmp/app", "*")).toThrow(/Invalid Chrome extension ID/);
  });

  it("stores the Windows manifest in the writable per-user data directory", () => {
    expect(nativeHostManifestPath({
      platform: "win32",
      homePath: "C:\\Users\\auditor",
      userDataPath: "C:\\Users\\auditor\\AppData\\Roaming\\TheWCAG",
    })).toBe("C:\\Users\\auditor\\AppData\\Roaming\\TheWCAG\\native-messaging\\com.thewcag.app.json");
  });

  it("registers the packaged binary-safe helper on Windows", () => {
    expect(nativeHostExecutablePath({
      platform: "win32",
      resourcesPath: "C:\\Program Files\\TheWCAG\\resources",
      executablePath: "C:\\Program Files\\TheWCAG\\TheWCAG.exe",
    })).toBe("C:\\Program Files\\TheWCAG\\resources\\native-messaging\\TheWCAG.NativeHost.exe");
  });

  it("keeps the application executable as the native host on macOS", () => {
    expect(nativeHostExecutablePath({
      platform: "darwin",
      resourcesPath: "/Applications/TheWCAG.app/Contents/Resources",
      executablePath: "/Applications/TheWCAG.app/Contents/MacOS/TheWCAG",
    })).toBe("/Applications/TheWCAG.app/Contents/MacOS/TheWCAG");
  });

  it("stores the macOS manifest in Chrome's per-user host directory", () => {
    expect(nativeHostManifestPath({
      platform: "darwin",
      homePath: "/Users/auditor",
      userDataPath: "/Users/auditor/Library/Application Support/TheWCAG",
    })).toBe("/Users/auditor/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.thewcag.app.json");
  });
});
