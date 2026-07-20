import { describe, expect, it } from "vitest";
import { selectElectronInstaller, type DesktopReleaseAsset } from "./desktop-release";

const assets: DesktopReleaseAsset[] = [
  { name: "TheWCAG-3.0.0-mac-universal.dmg", browser_download_url: "https://example.com/mac" },
  { name: "TheWCAG-3.0.0-win-x64.exe", browser_download_url: "https://example.com/windows" },
  { name: "latest-mac.yml", browser_download_url: "https://example.com/latest-mac" },
  { name: "latest.yml", browser_download_url: "https://example.com/latest-windows" },
];

describe("selectElectronInstaller", () => {
  it("selects platform installers only from a complete Electron release", () => {
    expect(selectElectronInstaller(assets, "mac")).toBe("https://example.com/mac");
    expect(selectElectronInstaller(assets, "windows")).toBe("https://example.com/windows");
  });

  it("rejects legacy Tauri release filenames", () => {
    const legacy = [
      { name: "TheWCAG_2.4.0_aarch64.dmg", browser_download_url: "https://example.com/old-mac" },
      { name: "TheWCAG_2.4.0_x64-setup.exe", browser_download_url: "https://example.com/old-windows" },
      { name: "latest.json", browser_download_url: "https://example.com/old-manifest" },
    ];
    expect(selectElectronInstaller(legacy, "mac")).toBeNull();
    expect(selectElectronInstaller(legacy, "windows")).toBeNull();
  });

  it("rejects an incomplete cross-platform release", () => {
    expect(
      selectElectronInstaller(
        assets.filter((asset) => asset.name !== "latest.yml"),
        "mac",
      ),
    ).toBeNull();
  });
});
