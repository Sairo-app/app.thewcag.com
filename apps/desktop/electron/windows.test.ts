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
});
