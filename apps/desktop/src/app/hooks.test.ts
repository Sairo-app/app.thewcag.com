import { describe, expect, it } from "vitest";
import { messageFromError } from "./hooks";

describe("desktop error messages", () => {
  it("replaces canvas security exceptions with a recovery message", () => {
    expect(
      messageFromError(
        new Error(
          "Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported.",
        ),
      ),
    ).toBe(
      "The capture could not be prepared. Close and reopen it, then try again.",
    );
  });

  it("does not expose technical browser failures", () => {
    expect(
      messageFromError(
        new Error("Failed to execute renderer operation"),
        "The export could not be completed.",
      ),
    ).toBe("The export could not be completed.");
  });

  it("keeps useful user-facing errors", () => {
    expect(messageFromError(new Error("Capture not found"))).toBe(
      "Capture not found",
    );
  });
});
