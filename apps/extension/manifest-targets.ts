/**
 * Both stores are built from the single `manifest.json`. Firefox needs four
 * documented departures from Chrome's MV3, so they are derived here rather than
 * kept in a second file that would drift.
 */

export type ExtensionTarget = "chrome" | "firefox";

/** Overridable so a fork or a self-distributed build can use its own id. */
export const DEFAULT_GECKO_ID = "extension@thewcag.com";

/**
 * Firefox MV3 shipped `sidebarAction` and event pages; it has neither
 * `sidePanel` nor a background service worker.
 */
export const FIREFOX_MINIMUM_VERSION = "115.0";

export function chromeManifest(base: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(base);
}

export function firefoxManifest(
  base: Record<string, unknown>,
  geckoId: string = DEFAULT_GECKO_ID,
): Record<string, unknown> {
  const manifest = structuredClone(base);

  // 1. Firefox has no background service worker in MV3; it runs an event page.
  const background = manifest.background as { service_worker?: string; type?: string } | undefined;
  if (background?.service_worker) {
    manifest.background = { scripts: [background.service_worker], type: background.type ?? "module" };
  }

  // 2. `side_panel` is Chrome-only. The same document is the Firefox sidebar.
  const sidePanel = manifest.side_panel as { default_path?: string } | undefined;
  if (sidePanel?.default_path) {
    manifest.sidebar_action = {
      default_panel: sidePanel.default_path,
      default_title: manifest.short_name ?? manifest.name,
      default_icon: manifest.icons,
      open_at_install: false,
    };
    delete manifest.side_panel;
  }

  // 3. `sidePanel` is not a Firefox permission; the sidebar needs none.
  if (Array.isArray(manifest.permissions)) {
    manifest.permissions = (manifest.permissions as string[]).filter((name) => name !== "sidePanel");
  }

  // 4. An explicit id is required for AMO and to allowlist the extension in the
  //    native messaging host manifest.
  manifest.browser_specific_settings = {
    gecko: { id: geckoId, strict_min_version: FIREFOX_MINIMUM_VERSION },
  };

  // Chrome-only key; harmless but rejected by AMO's linter.
  delete manifest.minimum_chrome_version;

  return manifest;
}

export function manifestForTarget(
  base: Record<string, unknown>,
  target: ExtensionTarget,
  geckoId?: string,
): Record<string, unknown> {
  return target === "firefox" ? firefoxManifest(base, geckoId) : chromeManifest(base);
}
