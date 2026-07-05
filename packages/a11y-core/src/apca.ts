// @ts-expect-error apca-w3 ships no type definitions
import { APCAcontrast, sRGBtoY } from "apca-w3";
import type { Rgb } from "./formats";

/**
 * APCA Lc contrast (WCAG 3 draft). Polarity matters: positive Lc means dark
 * text on a light background, negative means light on dark. |Lc| >= 60 is a
 * rough body-text floor, >= 75 preferred, >= 45 for large/bold text.
 */
export function apcaLc(fg: Rgb, bg: Rgb): number {
  const txtY = sRGBtoY([fg.r, fg.g, fg.b]);
  const bgY = sRGBtoY([bg.r, bg.g, bg.b]);
  const lc = Number(APCAcontrast(txtY, bgY));
  return Math.round(lc * 10) / 10;
}

/** Coarse human-readable rating for an APCA Lc value. */
export function apcaRating(lc: number): "fail" | "large-only" | "body-min" | "body-good" {
  const abs = Math.abs(lc);
  if (abs >= 75) return "body-good";
  if (abs >= 60) return "body-min";
  if (abs >= 45) return "large-only";
  return "fail";
}
