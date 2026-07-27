/**
 * Chrome exposes the side panel through `chrome.sidePanel`; Firefox has no such
 * API and uses `sidebarAction` with the `sidebar_action` manifest key instead.
 * Both builds share one source tree, so every panel call goes through here.
 *
 * Neither call is essential to a capture: if the surface is missing or the
 * browser refuses, the failure is swallowed exactly as the Chrome-only code did.
 */

interface SidePanelApi {
  setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
  open(options: { windowId: number }): Promise<void>;
}

interface SidebarActionApi {
  open(): Promise<void> | void;
}

function sidePanel(): SidePanelApi | null {
  const api = (globalThis as { chrome?: { sidePanel?: SidePanelApi } }).chrome?.sidePanel;
  return api && typeof api.open === "function" ? api : null;
}

function sidebarAction(): SidebarActionApi | null {
  const scope = globalThis as {
    browser?: { sidebarAction?: SidebarActionApi };
    chrome?: { sidebarAction?: SidebarActionApi };
  };
  const api = scope.browser?.sidebarAction ?? scope.chrome?.sidebarAction;
  return api && typeof api.open === "function" ? api : null;
}

/**
 * Keeps the toolbar action opening the popup rather than the panel. Firefox has
 * no equivalent setting, so this is a no-op there.
 */
export async function keepActionPopupOnClick(): Promise<void> {
  const panel = sidePanel();
  if (!panel || typeof panel.setPanelBehavior !== "function") return;
  try {
    await panel.setPanelBehavior({ openPanelOnActionClick: false });
  } catch {
    // The panel simply keeps its default behaviour.
  }
}

/**
 * Opens the review surface. Must be called while handling a user gesture: both
 * browsers reject a panel opened from anywhere else.
 */
export async function openReviewPanel(windowId: number): Promise<boolean> {
  const panel = sidePanel();
  if (panel) {
    try {
      await panel.open({ windowId });
      return true;
    } catch {
      return false;
    }
  }
  const sidebar = sidebarAction();
  if (!sidebar) return false;
  try {
    await sidebar.open();
    return true;
  } catch {
    return false;
  }
}
