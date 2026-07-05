import { hslToRgb, rgbToHsl, type Rgb } from "./formats";

/** WCAG 2.x relative luminance (sRGB). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio, 1..21. Order of arguments does not matter. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface WcagVerdict {
  ratio: number;
  /** Normal text: AA >= 4.5, AAA >= 7 */
  normalAA: boolean;
  normalAAA: boolean;
  /** Large text (>=18pt or 14pt bold): AA >= 3, AAA >= 4.5 */
  largeAA: boolean;
  largeAAA: boolean;
  /** Non-text UI components & graphical objects (WCAG 1.4.11): >= 3 */
  uiAA: boolean;
}

export interface Suggestion {
  color: Rgb;
  ratio: number;
  direction: "darker" | "lighter";
}

/**
 * Nearest variants of `adjust` (keeping hue/saturation, walking lightness)
 * that reach `target` contrast against `against`. Returns up to one result
 * per direction, nearest-first.
 */
export function suggestAccessible(adjust: Rgb, against: Rgb, target = 4.5): Suggestion[] {
  const { h, s, l } = rgbToHsl(adjust);
  const found: Suggestion[] = [];
  for (const direction of ["darker", "lighter"] as const) {
    const step = direction === "darker" ? -1 : 1;
    for (let li = l + step; li >= 0 && li <= 100; li += step) {
      const candidate = hslToRgb(h, s, li);
      const ratio = contrastRatio(candidate, against);
      if (ratio >= target) {
        found.push({ color: candidate, ratio: Math.round(ratio * 100) / 100, direction });
        break;
      }
    }
  }
  return found.sort(
    (a, b) => Math.abs(a.color.r - adjust.r) + Math.abs(a.color.g - adjust.g) + Math.abs(a.color.b - adjust.b)
      - (Math.abs(b.color.r - adjust.r) + Math.abs(b.color.g - adjust.g) + Math.abs(b.color.b - adjust.b)),
  );
}

export function wcagVerdict(fg: Rgb, bg: Rgb): WcagVerdict {
  const ratio = contrastRatio(fg, bg);
  return {
    ratio: Math.round(ratio * 100) / 100,
    normalAA: ratio >= 4.5,
    normalAAA: ratio >= 7,
    largeAA: ratio >= 3,
    largeAAA: ratio >= 4.5,
    uiAA: ratio >= 3,
  };
}
