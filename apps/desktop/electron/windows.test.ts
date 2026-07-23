import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => {
  class FakeBrowserWindow {
    static instances: FakeBrowserWindow[] = [];
    readonly id = FakeBrowserWindow.instances.length + 1;
    readonly webContents = {
      id: this.id,
      on: vi.fn(),
      send: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    };
    show = vi.fn();
    focus = vi.fn();
    restore = vi.fn();
    hide = vi.fn();
    destroy = vi.fn();
    setWindowButtonVisibility = vi.fn();
    isDestroyed = vi.fn(() => false);
    isMinimized = vi.fn(() => false);
    loadFile = vi.fn(async () => undefined);
    loadURL = vi.fn(async () => undefined);
    once = vi.fn();
    on = vi.fn();

    constructor() {
      FakeBrowserWindow.instances.push(this);
    }
  }

  return {
    FakeBrowserWindow,
    app: {
      isPackaged: true,
      on: vi.fn(),
    },
  };
});

vi.mock("electron", () => ({
  BrowserWindow: electron.FakeBrowserWindow,
  app: electron.app,
  screen: { getAllDisplays: vi.fn(() => []) },
}));

import { WindowManager } from "./windows";

describe("WindowManager", () => {
  beforeEach(() => {
    electron.FakeBrowserWindow.instances.length = 0;
    vi.clearAllMocks();
  });

  it("focuses the existing main window without creating recursively", () => {
    const manager = new WindowManager();
    const first = manager.createMain();

    manager.showMain();
    const second = manager.createMain();

    expect(second).toBe(first);
    expect(electron.FakeBrowserWindow.instances).toHaveLength(1);
    expect(first.show).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
  });

  it("flushes the open annotation before replacing its window", async () => {
    const manager = new WindowManager();
    const first = await manager.openAnnotate("cap-first123");
    const firstFake = electron.FakeBrowserWindow.instances[0];

    const opening = manager.openAnnotate("cap-second12");
    await vi.waitFor(() => {
      expect(firstFake.webContents.send).toHaveBeenCalledWith(
        "annotate:flush",
        expect.objectContaining({ token: expect.any(String) }),
      );
    });
    expect(firstFake.destroy).not.toHaveBeenCalled();
    expect(electron.FakeBrowserWindow.instances).toHaveLength(1);

    const request = firstFake.webContents.send.mock.calls.find(
      (call) => call[0] === "annotate:flush",
    )?.[1] as { token: string };
    manager.acknowledgeAnnotationFlush(firstFake.webContents.id, request.token, true);

    const second = await opening;
    expect(firstFake.destroy).toHaveBeenCalledOnce();
    expect(second).not.toBe(first);
    expect(electron.FakeBrowserWindow.instances).toHaveLength(2);
  });

  it("keeps the current annotation open when its flush fails", async () => {
    const manager = new WindowManager();
    await manager.openAnnotate("cap-first123");
    const first = electron.FakeBrowserWindow.instances[0];

    const opening = manager.openAnnotate("cap-second12");
    await vi.waitFor(() => expect(first.webContents.send).toHaveBeenCalled());
    const request = first.webContents.send.mock.calls[0][1] as { token: string };
    manager.acknowledgeAnnotationFlush(
      first.webContents.id,
      request.token,
      false,
      "Latest changes could not be saved",
    );

    await expect(opening).rejects.toThrow("Latest changes could not be saved");
    expect(first.destroy).not.toHaveBeenCalled();
    expect(electron.FakeBrowserWindow.instances).toHaveLength(1);
  });
});
