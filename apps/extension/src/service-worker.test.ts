import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PANEL_PORT_NAME,
  type ExtensionRequest,
  type ExtensionResponse,
} from "./shared/messages";
import { CAPTURE_TOO_LARGE_MESSAGE } from "./shared/storage";

const boundary = vi.hoisted(() => ({
  createEvidencePacket: vi.fn(),
  isProtectedBrowserPage: vi.fn(() => false),
  pageAccessMessage: vi.fn(() => "Capture failed"),
  runIssuePicker: vi.fn(),
}));

vi.mock("./evidence", () => ({ createEvidencePacket: boundary.createEvidencePacket }));
vi.mock("./page-access", () => ({
  isProtectedBrowserPage: boundary.isProtectedBrowserPage,
  pageAccessMessage: boundary.pageAccessMessage,
}));
vi.mock("./picker", () => ({ runIssuePicker: boundary.runIssuePicker }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("capture coordination", () => {
  it("shares one in-progress picker and screenshot capture per tab", async () => {
    let messageListener: (
      message: unknown,
      sender: unknown,
      sendResponse: (response: ExtensionResponse) => void,
    ) => boolean = () => false;
    let resolvePicker!: (value: unknown) => void;
    const pickerResult = new Promise((resolve) => { resolvePicker = resolve; });
    const executeScript = vi.fn()
      .mockImplementationOnce(() => pickerResult)
      .mockResolvedValue([]);
    const captureVisibleTab = vi.fn().mockResolvedValue("data:image/png;base64,AAAA");

    vi.stubGlobal("chrome", {
      sidePanel: { setPanelBehavior: vi.fn().mockResolvedValue(undefined) },
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onConnect: { addListener: vi.fn() },
        onMessage: {
          addListener: vi.fn((listener) => { messageListener = listener; }),
        },
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{
          id: 42,
          windowId: 7,
          active: true,
          url: "https://example.com/checkout",
        }]),
        get: vi.fn().mockResolvedValue({
          id: 42,
          windowId: 7,
          active: true,
          url: "https://example.com/checkout",
        }),
        captureVisibleTab,
      },
      scripting: { executeScript },
      storage: {
        local: {
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
      action: {
        setBadgeText: vi.fn().mockResolvedValue(undefined),
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      },
    });
    boundary.createEvidencePacket.mockResolvedValue({ id: "evidence-1" });
    await import("./service-worker");

    const request: ExtensionRequest = { type: "capture:start", mode: "element" };
    const first = new Promise<ExtensionResponse>((resolve) => {
      expect(messageListener(request, {}, resolve)).toBe(true);
    });
    const second = new Promise<ExtensionResponse>((resolve) => {
      expect(messageListener(request, {}, resolve)).toBe(true);
    });
    await vi.waitFor(() => {
      expect(executeScript.mock.calls.filter(([options]) => options.args?.[0] === "element")).toHaveLength(1);
    });

    resolvePicker([{
      result: {
        page: { url: "https://example.com/checkout" },
        target: { kind: "element" },
      },
    }]);

    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true, evidence: { id: "evidence-1" } },
      { ok: true, evidence: { id: "evidence-1" } },
    ]);
    expect(captureVisibleTab).toHaveBeenCalledTimes(1);
    expect(boundary.createEvidencePacket).toHaveBeenCalledTimes(1);
  });

  it("reports a storage quota rejection as a capture-size failure", async () => {
    let messageListener: (
      message: unknown,
      sender: unknown,
      sendResponse: (response: ExtensionResponse) => void,
    ) => boolean = () => false;
    const selection = {
      page: { url: "https://example.com/checkout" },
      target: { kind: "element" },
    };
    const executeScript = vi.fn().mockImplementation(({ func }) =>
      func === boundary.runIssuePicker ? Promise.resolve([{ result: selection }]) : Promise.resolve([]));
    const setBadgeText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("chrome", {
      sidePanel: { setPanelBehavior: vi.fn().mockResolvedValue(undefined) },
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onConnect: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn((listener) => { messageListener = listener; }) },
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42, windowId: 7, active: true, url: "https://example.com/checkout" }]),
        get: vi.fn().mockResolvedValue({ id: 42, windowId: 7, active: true, url: "https://example.com/checkout" }),
        captureVisibleTab: vi.fn().mockResolvedValue("data:image/png;base64,AAAA"),
      },
      scripting: { executeScript },
      storage: {
        local: {
          set: vi.fn().mockRejectedValue(new Error("QUOTA_BYTES quota exceeded")),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
      action: {
        setBadgeText,
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      },
    });
    boundary.createEvidencePacket.mockResolvedValue({ id: "evidence-too-large" });
    await import("./service-worker");

    const response = new Promise<ExtensionResponse>((resolve) => {
      expect(messageListener({ type: "capture:start", mode: "element" }, {}, resolve)).toBe(true);
    });

    await expect(response).resolves.toEqual({ ok: false, message: CAPTURE_TOO_LARGE_MESSAGE });
    expect(boundary.pageAccessMessage).not.toHaveBeenCalled();
    expect(setBadgeText).toHaveBeenCalledWith({ tabId: 42, text: "!" });
  });

  it("keeps badge state in the service worker and skips unread badges for connected panels", async () => {
    let messageListener: (
      message: unknown,
      sender: unknown,
      sendResponse: (response: ExtensionResponse) => void,
    ) => boolean = () => false;
    let connectListener: (port: {
      name: string;
      onMessage: { addListener: (listener: (message: unknown) => void) => void };
      onDisconnect: { addListener: (listener: () => void) => void };
    }) => void = () => undefined;
    let portMessage: (message: unknown) => void = () => undefined;
    const selection = {
      page: { url: "https://example.com/checkout" },
      target: { kind: "element" },
    };
    const executeScript = vi.fn().mockImplementation(({ func }) =>
      func === boundary.runIssuePicker ? Promise.resolve([{ result: selection }]) : Promise.resolve([]));
    const setBadgeText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("chrome", {
      sidePanel: { setPanelBehavior: vi.fn().mockResolvedValue(undefined) },
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onConnect: { addListener: vi.fn((listener) => { connectListener = listener; }) },
        onMessage: { addListener: vi.fn((listener) => { messageListener = listener; }) },
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42, windowId: 7, active: true, url: "https://example.com/checkout" }]),
        get: vi.fn().mockResolvedValue({ id: 42, windowId: 7, active: true, url: "https://example.com/checkout" }),
        captureVisibleTab: vi.fn().mockResolvedValue("data:image/png;base64,AAAA"),
      },
      scripting: { executeScript },
      storage: {
        local: {
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
      action: {
        setBadgeText,
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      },
    });
    boundary.createEvidencePacket.mockResolvedValue({ id: "evidence-visible" });
    await import("./service-worker");

    connectListener({
      name: PANEL_PORT_NAME,
      onMessage: { addListener: (listener) => { portMessage = listener; } },
      onDisconnect: { addListener: vi.fn() },
    });
    portMessage({ type: "panel-connected", windowId: 7 });

    const response = new Promise<ExtensionResponse>((resolve) => {
      expect(messageListener({ type: "capture:start", mode: "element" }, {}, resolve)).toBe(true);
    });
    await expect(response).resolves.toEqual({ ok: true, evidence: { id: "evidence-visible" } });
    expect(setBadgeText).not.toHaveBeenCalled();

    portMessage({ type: "evidence-seen", tabId: 42 });
    await vi.waitFor(() => {
      expect(setBadgeText).toHaveBeenCalledWith({ tabId: 42, text: "" });
    });
  });
});
