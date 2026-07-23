import { describe, expect, it } from "vitest";
import {
  CAPTURE_CANVAS_ERROR,
  canvasPngDataUrl,
  requireCanvas2d,
} from "../lib/annotate/canvas";

describe("annotation canvas safety", () => {
  it("turns a missing 2D context into a user-facing capture error", () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => requireCanvas2d(canvas)).toThrow(CAPTURE_CANVAS_ERROR);
  });

  it("rejects Chromium's empty data URL sentinel", () => {
    const canvas = { toDataURL: () => "data:," } as unknown as HTMLCanvasElement;
    expect(() => canvasPngDataUrl(canvas)).toThrow(CAPTURE_CANVAS_ERROR);
  });
});
