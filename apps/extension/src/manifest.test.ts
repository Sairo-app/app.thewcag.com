import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";

describe("extension surfaces", () => {
  it("opens a toolbar popup while keeping an optional side-panel workspace", () => {
    expect(manifest.action.default_popup).toBe("popup.html");
    expect(manifest.side_panel.default_path).toBe("sidepanel.html");
    expect(manifest.permissions).toContain("activeTab");
    expect(manifest.permissions).not.toContain("<all_urls>");
  });
});
