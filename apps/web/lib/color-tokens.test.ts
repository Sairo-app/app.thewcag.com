import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Oklch = readonly [lightness: number, chroma: number, hue: number];

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function readOklchToken(name: string): Oklch {
  const match = styles.match(new RegExp(`--${name}:\\s*oklch\\(([^)]+)\\)`));
  if (!match) throw new Error(`Missing --${name} OKLCH token`);

  const values = match[1].trim().split(/\s+/).map(Number);
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid --${name} OKLCH token`);
  }

  return values as unknown as Oklch;
}

function toLinearSrgb([lightness, chroma, hue]: Oklch) {
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.max(0, Math.min(1, channel)));
}

function relativeLuminance(color: Oklch) {
  const [red, green, blue] = toLinearSrgb(color);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: Oklch, second: Oklch) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("website color tokens", () => {
  const cream = readOklchToken("on-orange");

  it("keeps cream text accessible on the primary orange", () => {
    expect(contrastRatio(cream, readOklchToken("orange"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps cream text accessible on the orange hover state", () => {
    expect(contrastRatio(cream, readOklchToken("orange-hover"))).toBeGreaterThanOrEqual(4.5);
  });
});
