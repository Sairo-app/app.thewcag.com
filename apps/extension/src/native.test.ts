import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyNativeConnectorFailure,
  generateDesktopDraft,
  listDesktopAudits,
  pingDesktop,
} from "./native";
import type { EvidencePacketV1 } from "@accessibility-build/audit-contracts";

const REQUEST_ID = "e1f6ebf8-8f42-4373-a3d2-3ea5b64f0ac7";

type NativeCallback = (response: unknown) => void;

function installNativeResponder(
  responder?: (request: Record<string, unknown>, callback: NativeCallback) => void,
) {
  const sendNativeMessage = vi.fn((
    _host: string,
    request: Record<string, unknown>,
    callback: NativeCallback,
  ) => responder?.(request, callback));
  vi.stubGlobal("crypto", { randomUUID: () => REQUEST_ID });
  vi.stubGlobal("chrome", {
    runtime: {
      lastError: undefined,
      sendNativeMessage,
    },
  });
  return sendNativeMessage;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("native connector diagnostics", () => {
  it.each([
    ["Specified native messaging host not found.", "not-registered"],
    ["Native messaging host host name is not registered.", "not-registered"],
    ["Access to the specified native messaging host is forbidden.", "extension-not-allowed"],
    ["Native host has exited.", "host-exited"],
    ["The pipe to the native messaging host was broken before the message was read.", "host-exited"],
    ["TheWCAG desktop did not respond within 10 seconds.", "timeout"],
    ["Error when communicating with the native messaging host.", "protocol-error"],
    ["TheWCAG desktop returned an invalid response.", "protocol-error"],
    ["An unexpected browser failure occurred.", "unknown"],
  ] as const)("classifies %s", (message, expected) => {
    expect(classifyNativeConnectorFailure(message)).toBe(expected);
  });

  it("times out when the desktop host never responds", async () => {
    vi.useFakeTimers();
    installNativeResponder();

    const rejected = expect(pingDesktop()).rejects.toMatchObject({
      failure: "timeout",
      message: expect.stringMatching(/desktop did not respond within 10 seconds/i),
    });
    await vi.advanceTimersByTimeAsync(10_000);

    await rejected;
  });

  it("allows the longer generation window before timing out", async () => {
    vi.useFakeTimers();
    installNativeResponder();

    const rejected = expect(generateDesktopDraft({} as EvidencePacketV1)).rejects.toMatchObject({
      failure: "timeout",
      message: expect.stringMatching(/desktop did not respond within 60 seconds/i),
    });
    await vi.advanceTimersByTimeAsync(60_000);

    await rejected;
  });

  it("rejects malformed native response bodies", async () => {
    installNativeResponder((request, callback) => callback({
      protocolVersion: 1,
      requestId: request.requestId,
      ok: true,
      type: "audits:list",
      audits: [{
        id: "aud-checkout1",
        project: "Checkout",
        target: "example.com",
        standard: "WCAG 2.2 AA",
        active: "yes",
        updatedAt: 10,
      }],
    }));

    await expect(listDesktopAudits()).rejects.toMatchObject({ failure: "protocol-error" });
  });

  it("surfaces a cross-version desktop error with an update hint", async () => {
    installNativeResponder((request, callback) => callback({
      protocolVersion: 2,
      requestId: request.requestId,
      ok: false,
      type: "error",
      code: "version-mismatch",
      message: "Desktop protocol 2 cannot read this extension request.",
      retryable: false,
    }));

    await expect(pingDesktop()).rejects.toThrow(
      /Desktop protocol 2 cannot read this extension request\. Update TheWCAG desktop and this extension/i,
    );
  });
});
