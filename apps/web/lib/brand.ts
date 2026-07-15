export const BRAND_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const BRAND_LOGO_MAX_BYTES = 1_000_000;

export function validateBrandLogoMeta(type: string, size: number): string | null {
  if (!BRAND_LOGO_TYPES[type]) return "Logo must be a PNG, JPG, WEBP, or SVG.";
  if (size > BRAND_LOGO_MAX_BYTES) return "Logo must be under 1 MB.";
  return null;
}

/** SVG is kept as a supported feature, but active and externally loaded content is rejected. */
export function isSafeBrandSvg(bytes: Uint8Array): boolean {
  const source = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!/<svg(?:\s|>)/i.test(source)) return false;
  const blocked = [
    /<!doctype/i,
    /<!entity/i,
    /<script(?:\s|>)/i,
    /<foreignObject(?:\s|>)/i,
    /\son[a-z]+\s*=/i,
    /(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:|file:)/i,
    /url\s*\(\s*["']?\s*(?:https?:|\/\/|data:|javascript:|file:)/i,
    /@import/i,
  ];
  return blocked.every((pattern) => !pattern.test(source));
}

export function hasValidBrandLogoSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/svg+xml") return isSafeBrandSvg(bytes);
  if (type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/webp") {
    return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}
