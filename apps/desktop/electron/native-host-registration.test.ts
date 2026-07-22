import { describe, expect, it } from "vitest";
import { nativeHostManifest, nativeHostManifestPath } from "./native-host-registration";

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

  it("stores the macOS manifest in Chrome's per-user host directory", () => {
    expect(nativeHostManifestPath({
      platform: "darwin",
      homePath: "/Users/auditor",
      userDataPath: "/Users/auditor/Library/Application Support/TheWCAG",
    })).toBe("/Users/auditor/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.thewcag.app.json");
  });
});
