import { describe, expect, it } from "vitest";
import { nativeHostManifest } from "./native-host-registration";

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
});
