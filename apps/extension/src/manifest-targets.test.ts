import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chromeManifest,
  DEFAULT_GECKO_ID,
  FIREFOX_MINIMUM_VERSION,
  firefoxManifest,
  manifestForTarget,
} from "../manifest-targets";

const base = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../manifest.json"), "utf8"),
) as Record<string, unknown>;

describe("chromeManifest", () => {
  it("ships the source manifest unchanged", () => {
    expect(chromeManifest(base)).toEqual(base);
  });

  it("does not share structure with the source", () => {
    const copy = chromeManifest(base) as { permissions: string[] };
    copy.permissions.push("mutated");
    expect(base.permissions).not.toContain("mutated");
  });
});

describe("firefoxManifest", () => {
  const firefox = firefoxManifest(base);

  it("converts the service worker into an event page", () => {
    expect(firefox.background).toEqual({ scripts: ["service-worker.js"], type: "module" });
    expect(firefox.background).not.toHaveProperty("service_worker");
  });

  it("replaces the side panel with a sidebar action pointing at the same document", () => {
    expect(firefox.side_panel).toBeUndefined();
    expect(firefox.sidebar_action).toMatchObject({
      default_panel: "sidepanel.html",
      open_at_install: false,
    });
  });

  it("declares the add-on id, a minimum Firefox version, and no data collection", () => {
    expect(firefox.browser_specific_settings).toEqual({
      gecko: {
        id: DEFAULT_GECKO_ID,
        strict_min_version: FIREFOX_MINIMUM_VERSION,
        data_collection_permissions: { required: ["none"] },
      },
    });
  });

  it("accepts an overridden add-on id", () => {
    const custom = firefoxManifest(base, "audit@example.com");
    expect(custom.browser_specific_settings).toMatchObject({ gecko: { id: "audit@example.com" } });
  });

  it("drops Chrome-only keys the AMO linter rejects", () => {
    expect(firefox.minimum_chrome_version).toBeUndefined();
    expect(firefox.permissions).not.toContain("sidePanel");
  });

  it("keeps the permissions Firefox does honour", () => {
    expect(firefox.permissions).toEqual(expect.arrayContaining(["activeTab", "scripting", "storage"]));
    expect(firefox.optional_permissions).toEqual(["nativeMessaging"]);
  });

  it("keeps manifest version 3 and the shared content security policy", () => {
    expect(firefox.manifest_version).toBe(3);
    expect(firefox.content_security_policy).toEqual(base.content_security_policy);
  });

  it("leaves the source manifest untouched", () => {
    expect(base.side_panel).toEqual({ default_path: "sidepanel.html" });
    expect(base.browser_specific_settings).toBeUndefined();
  });
});

describe("manifestForTarget", () => {
  it("selects the requested target", () => {
    expect(manifestForTarget(base, "chrome")).toEqual(base);
    expect(manifestForTarget(base, "firefox")).toHaveProperty("sidebar_action");
  });
});
