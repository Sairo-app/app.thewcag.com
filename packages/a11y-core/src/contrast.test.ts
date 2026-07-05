import { describe, expect, it } from "vitest";
import { contrastRatio, wcagVerdict } from "./contrast";
import { apcaLc } from "./apca";
import { hexToRgb, rgbToHex } from "./formats";
import { simulateRgb } from "./colorblind";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

describe("contrast", () => {
  it("black on white is 21:1", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it("is symmetric", () => {
    const a = { r: 30, g: 90, b: 200 };
    expect(contrastRatio(a, WHITE)).toBeCloseTo(contrastRatio(WHITE, a), 6);
  });

  it("#767676 on white passes AA normal (4.54:1)", () => {
    const grey = hexToRgb("#767676")!;
    const v = wcagVerdict(grey, WHITE);
    expect(v.normalAA).toBe(true);
    expect(v.normalAAA).toBe(false);
  });

  it("#777777 on white fails AA normal (4.48:1)", () => {
    const grey = hexToRgb("#777777")!;
    expect(wcagVerdict(grey, WHITE).normalAA).toBe(false);
  });
});

describe("apca", () => {
  it("black on white is around Lc 106", () => {
    expect(apcaLc(BLACK, WHITE)).toBeGreaterThan(100);
  });

  it("white on black is strongly negative", () => {
    expect(apcaLc(WHITE, BLACK)).toBeLessThan(-100);
  });
});

describe("formats", () => {
  it("round-trips hex", () => {
    expect(rgbToHex(hexToRgb("#1e293b")!)).toBe("#1E293B");
  });

  it("expands shorthand hex", () => {
    expect(hexToRgb("#fff")).toEqual(WHITE);
  });

  it("rejects garbage", () => {
    expect(hexToRgb("#12345")).toBeNull();
  });
});

describe("colorblind", () => {
  it("keeps greys grey under achromatopsia", () => {
    const grey = { r: 128, g: 128, b: 128 };
    expect(simulateRgb(grey, "achromatopsia")).toEqual(grey);
  });

  it("collapses red toward yellow-brown under protanopia", () => {
    const red = simulateRgb({ r: 255, g: 0, b: 0 }, "protanopia");
    expect(red.r).toBeLessThan(120);
  });
});
