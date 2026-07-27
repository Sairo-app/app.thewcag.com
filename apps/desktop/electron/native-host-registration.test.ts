import { describe, expect, it } from "vitest";
import {
  configuredGeckoId,
  DEFAULT_GECKO_ID,
  firefoxNativeHostManifest,
  firefoxNativeHostManifestPath,
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

describe("Firefox native messaging", () => {
  it("allowlists the add-on id instead of a chrome-extension origin", () => {
    const manifest = firefoxNativeHostManifest("/Applications/TheWCAG.app/Contents/MacOS/TheWCAG", "extension@thewcag.com");
    expect(manifest).toMatchObject({
      name: "com.thewcag.app",
      type: "stdio",
      allowed_extensions: ["extension@thewcag.com"],
    });
    expect(manifest).not.toHaveProperty("allowed_origins");
  });

  it("accepts a braced UUID add-on id", () => {
    expect(() =>
      firefoxNativeHostManifest("/bin/host", "{d9d0a4a8-0f4f-4f2e-9a1a-2b3c4d5e6f70}"),
    ).not.toThrow();
  });

  it("rejects an id that is neither an email-style id nor a UUID", () => {
    expect(() => firefoxNativeHostManifest("/bin/host", "not an id")).toThrow(/Firefox add-on ID/);
  });

  it("writes to Mozilla's own directory on macOS", () => {
    expect(
      firefoxNativeHostManifestPath({ platform: "darwin", homePath: "/Users/a", userDataPath: "/u" }),
    ).toBe("/Users/a/Library/Application Support/Mozilla/NativeMessagingHosts/com.thewcag.app.json");
  });

  it("keeps the Windows manifest separate from Chrome's", () => {
    const chrome = nativeHostManifestPath({ platform: "win32", homePath: "C:\\Users\\a", userDataPath: "C:\\data" });
    const firefox = firefoxNativeHostManifestPath({ platform: "win32", homePath: "C:\\Users\\a", userDataPath: "C:\\data" });
    expect(firefox).not.toBe(chrome);
    expect(firefox).toContain("firefox");
  });

  it("has no registration target on Linux", () => {
    expect(
      firefoxNativeHostManifestPath({ platform: "linux", homePath: "/home/a", userDataPath: "/u" }),
    ).toBeNull();
  });

  it("falls back to the default add-on id when the override is unusable", () => {
    const previous = process.env.THEWCAG_GECKO_ID;
    process.env.THEWCAG_GECKO_ID = "nonsense id";
    expect(configuredGeckoId()).toBe(DEFAULT_GECKO_ID);
    process.env.THEWCAG_GECKO_ID = "audit@example.com";
    expect(configuredGeckoId()).toBe("audit@example.com");
    if (previous === undefined) delete process.env.THEWCAG_GECKO_ID;
    else process.env.THEWCAG_GECKO_ID = previous;
  });
});
