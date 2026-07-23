export const BRAND_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const BRAND_LOGO_MAX_BYTES = 1_000_000;
export const BRAND_ASSET_TOKEN_PATTERN = /^br_[a-f0-9]{32}$/;

export function isBrandAssetToken(value: string): boolean {
  return BRAND_ASSET_TOKEN_PATTERN.test(value);
}

export function brandLogoPath(token: string | null | undefined): string | null {
  return token && isBrandAssetToken(token) ? `/api/brand/${token}/logo` : null;
}

export function validateBrandLogoMeta(type: string, size: number): string | null {
  if (!BRAND_LOGO_TYPES[type]) return "Logo must be a PNG, JPG, or WEBP.";
  if (size > BRAND_LOGO_MAX_BYTES) return "Logo must be under 1 MB.";
  return null;
}

export function hasValidBrandLogoSignature(type: string, bytes: Uint8Array): boolean {
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
