import { describe, expect, it } from "vitest";
import { classifyNativeConnectorFailure } from "./native";

describe("native connector diagnostics", () => {
  it.each([
    ["Specified native messaging host not found.", "not-registered"],
    ["Native messaging host host name is not registered.", "not-registered"],
    ["Access to the specified native messaging host is forbidden.", "extension-not-allowed"],
    ["Native host has exited.", "host-exited"],
    ["The pipe to the native messaging host was broken before the message was read.", "host-exited"],
    ["Error when communicating with the native messaging host.", "protocol-error"],
    ["TheWCAG desktop returned an invalid response.", "protocol-error"],
    ["An unexpected browser failure occurred.", "unknown"],
  ] as const)("classifies %s", (message, expected) => {
    expect(classifyNativeConnectorFailure(message)).toBe(expected);
  });
});
