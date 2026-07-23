import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import manifest from "../manifest.json";
import { EXTENSION_ICON_SIZES, writeExtensionAssets } from "../vite.config";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("extension surfaces", () => {
  it("opens a toolbar popup while keeping an optional side-panel workspace", () => {
    expect(manifest.action.default_popup).toBe("popup.html");
    expect(manifest.side_panel.default_path).toBe("sidepanel.html");
    expect(manifest.permissions).toContain("activeTab");
    expect(manifest.permissions).toContain("unlimitedStorage");
    expect(manifest.permissions).not.toContain("<all_urls>");
  });

  it("generates a distinct square PNG for every declared icon size", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-extension-assets-"));
    temporaryDirectories.push(directory);
    await writeExtensionAssets(directory);

    for (const size of EXTENSION_ICON_SIZES) {
      expect(manifest.icons[String(size) as keyof typeof manifest.icons]).toBe(`icon-${size}.png`);
      const metadata = await sharp(join(directory, `icon-${size}.png`)).metadata();
      expect({ width: metadata.width, height: metadata.height, format: metadata.format }).toEqual({
        width: size,
        height: size,
        format: "png",
      });
    }
  });
});
