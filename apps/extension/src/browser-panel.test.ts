import { afterEach, describe, expect, it, vi } from "vitest";
import { keepActionPopupOnClick, openReviewPanel } from "./browser-panel";

const scope = globalThis as Record<string, unknown>;

afterEach(() => {
  delete scope.chrome;
  delete scope.browser;
});

describe("keepActionPopupOnClick", () => {
  it("asks Chrome to leave the action opening the popup", async () => {
    const setPanelBehavior = vi.fn().mockResolvedValue(undefined);
    scope.chrome = { sidePanel: { setPanelBehavior, open: vi.fn() } };

    await keepActionPopupOnClick();

    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: false });
  });

  it("does nothing on a browser without the side panel API", async () => {
    scope.browser = { sidebarAction: { open: vi.fn() } };
    await expect(keepActionPopupOnClick()).resolves.toBeUndefined();
  });

  it("swallows a rejection from the browser", async () => {
    scope.chrome = {
      sidePanel: { setPanelBehavior: vi.fn().mockRejectedValue(new Error("no")), open: vi.fn() },
    };
    await expect(keepActionPopupOnClick()).resolves.toBeUndefined();
  });
});

describe("openReviewPanel", () => {
  it("opens the Chrome side panel for the current window", async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    scope.chrome = { sidePanel: { open, setPanelBehavior: vi.fn() } };

    await expect(openReviewPanel(7)).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith({ windowId: 7 });
  });

  it("falls back to the Firefox sidebar, which takes no window", async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    scope.browser = { sidebarAction: { open } };

    await expect(openReviewPanel(7)).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith();
  });

  it("accepts a sidebar exposed on the chrome namespace", async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    scope.chrome = { sidebarAction: { open } };

    await expect(openReviewPanel(1)).resolves.toBe(true);
  });

  it("reports failure when the browser refuses", async () => {
    scope.chrome = {
      sidePanel: { open: vi.fn().mockRejectedValue(new Error("gesture required")), setPanelBehavior: vi.fn() },
    };

    await expect(openReviewPanel(1)).resolves.toBe(false);
  });

  it("reports failure when no panel surface exists", async () => {
    await expect(openReviewPanel(1)).resolves.toBe(false);
  });
});
