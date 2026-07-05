import { describe, expect, it } from "vitest";
import { contrastRatio, suggestAccessible, wcagVerdict } from "./contrast";
import { apcaLc } from "./apca";
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "./formats";
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

describe("suggestAccessible", () => {
  it("suggests passing variants for a failing pair", () => {
    const grey = hexToRgb("#999999")!; // 2.85:1 on white — fails AA
    const suggestions = suggestAccessible(grey, WHITE, 4.5);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(contrastRatio(s.color, WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("returns nothing to fix when target is unreachable in a direction", () => {
    // near-black against black: only "lighter" can pass
    const suggestions = suggestAccessible({ r: 10, g: 10, b: 10 }, BLACK, 4.5);
    expect(suggestions.every((s) => s.direction === "lighter")).toBe(true);
  });
});

describe("hsl round trip", () => {
  it("hslToRgb inverts rgbToHsl approximately", () => {
    const original = { r: 37, g: 99, b: 235 }; // brand blue
    const { h, s, l } = rgbToHsl(original);
    const back = hslToRgb(h, s, l);
    expect(Math.abs(back.r - original.r)).toBeLessThan(6);
    expect(Math.abs(back.g - original.g)).toBeLessThan(6);
    expect(Math.abs(back.b - original.b)).toBeLessThan(6);
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
