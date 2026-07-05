import type { Rgb } from "./formats";

export type ColorblindType =
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia";

/**
 * 3x3 sRGB transform matrices (row-major) for dichromacy simulation,
 * Machado, Oliveira & Fernandes (2009), severity 1.0. Achromatopsia uses
 * Rec.601 luminance weights. Also consumed as a WebGL color matrix by the
 * lens shader in M3.
 */
export const COLORBLIND_MATRICES: Record<ColorblindType, number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868,
    0.114503, 0.786281, 0.099216,
    -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968,
    0.280085, 0.672501, 0.047413,
    -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779,
    -0.078411, 0.930809, 0.147602,
    0.004733, 0.691367, 0.3039,
  ],
  achromatopsia: [
    0.299, 0.587, 0.114,
    0.299, 0.587, 0.114,
    0.299, 0.587, 0.114,
  ],
};

/** Simulate how a single color appears with the given color-vision deficiency. */
export function simulateRgb(color: Rgb, type: ColorblindType): Rgb {
  const m = COLORBLIND_MATRICES[type];
  const apply = (row: number) =>
    clamp255(m[row * 3] * color.r + m[row * 3 + 1] * color.g + m[row * 3 + 2] * color.b);
  return { r: apply(0), g: apply(1), b: apply(2) };
}

function clamp255(v: number): number {
  return Math.round(Math.min(255, Math.max(0, v)));
}
